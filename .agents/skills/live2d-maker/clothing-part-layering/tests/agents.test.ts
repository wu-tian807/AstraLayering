import {requestLogNames} from '../../shared/tests/request-logs.ts';
import { executionPaths, workspacePrompt } from '../../shared/agents/workspace.ts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CodexAgents } from '../../shared/codex/agents.ts';
import { workflowLogPath } from '../../shared/codex/agent-log.ts';
import { AgentCallError, AgentRuntime } from '../../shared/codex/agent-runtime.ts';
import { fakeAppServer } from '../../part-layering/tests/fake-app-server.ts';
import { nodeExecutables } from './node-executables.ts';

// One-shot turns without function tools run through the same app-server session as every other turn.
const section = 'clothing-part-layering';

async function fixture(t: TestContext, ...server: Parameters<typeof fakeAppServer> extends [string, ...infer Rest] ? Rest : never) {
  nodeExecutables(t);
  const directory = await realpath(await mkdtemp(join(tmpdir(), `${section}-agents-`)));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { executable, capture } = await fakeAppServer(directory, ...server);
  const logDirectory = join(directory, `${section}/agents`);
  const messages: string[] = [];
  const agents = new CodexAgents({ codexPathOverride: executable, cwd: directory, logDirectory,
    runtime: new AgentRuntime(3, async () => {}), progress: message => messages.push(message) });
  const protocol = async () => (await readFile(capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  return { agents, directory, logDirectory, messages, protocol };
}

async function readLog(root: string) {
  const names = await requestLogNames(root);
  assert.equal(names.length, 1);
  const directory = join(root, names[0]);
  return {
    directory,
    request: JSON.parse(await readFile(join(directory, 'request.json'), 'utf8')),
    transcript: await readFile(workflowLogPath(root), 'utf8'),
    result: JSON.parse(await readFile(join(directory, 'result.json'), 'utf8')),
  };
}

const saved = (error: string | null = null) => JSON.stringify({ error });
// Codex native imagegen reports absolute savedPath values.
const generatedPath = '/case/step01/workspace/generated/image.png';

test('无工具一次性回合走 app-server：只读、关闭 shell，记录输入与结果和绝对 savedPath', async t => {
  const finalText = saved();
  const f = await fixture(t, [], 'completed', [{ type: 'imageGeneration', status: 'completed', savedPath: generatedPath }], { finalText });
  const result = await f.agents.run({ name: '生成', prompt: '测试提示词', imageGeneration: true });
  const log = await readLog(f.logDirectory);
  assert.equal(result.text, finalText);
  assert.equal(result.threadId, 'native-thread');
  assert.equal(result.logDirectory, log.directory);
  assert.deepEqual(result.images, [{ savedPath: generatedPath }]);
  assert.ok(log.request.prompt.startsWith(workspacePrompt('测试提示词', executionPaths({ cwd: f.directory }, f.directory))));
  assert.equal(log.request.task.timeoutMs, null);
  assert.equal(log.result.status, 'completed');
  assert.match(log.transcript, /测试工具选择摘要/);
  const thread = (await f.protocol()).find(message => message.method === 'thread/start').params;
  assert.equal(thread.cwd, join(f.directory, 'workspace'));
  assert.equal(thread.sandbox, 'danger-full-access');
  assert.deepEqual(thread.dynamicTools, []);
  assert.equal(thread.config['features.image_generation'], true);
  assert.equal(thread.config['features.shell_tool'], false);
  assert.equal(thread.config['features.unified_exec'], false);
});

test('任务显式要求时一次性回合可开放 shell', async t => {
  const f = await fixture(t, []);
  await f.agents.run({ name: '可写', prompt: 'test', shell: true });
  const thread = (await f.protocol()).find(message => message.method === 'thread/start').params;
  assert.equal(thread.sandbox, 'danger-full-access');
  assert.equal(thread.config['features.shell_tool'], true);
});

test('模型返回生图错误时报错并保留最终回复；文本含 overloaded 也不自动重新生成', async t => {
  const finalText = saved('server overloaded');
  const f = await fixture(t, [], 'completed', [], { finalText });
  await assert.rejects(f.agents.run({ name: '生图工具失败', prompt: 'test', imageGeneration: true }), (error: AgentCallError) => {
    assert.ok(error instanceof AgentCallError); assert.match(error.message, /server overloaded/);
    assert.equal(error.threadId, 'native-thread'); assert.equal(error.finalResponse, finalText);
    assert.ok(error.logDirectory?.startsWith(f.logDirectory + '/'));
    return true;
  });
  const log = await readLog(f.logDirectory);
  assert.equal(log.result.status, 'failed');
  assert.equal(log.result.finalResponse, finalText);
  assert.equal((await f.protocol()).filter(message => message.method === 'turn/start').length, 1);
});

test('生图回合以本轮记录的图片为准，回复误报失败也交付该图', async t => {
  const f = await fixture(t, [], 'completed', [{ type: 'imageGeneration', status: 'completed', savedPath: generatedPath }],
    { finalText: saved('工具未提供可读取的图片保存路径') });
  const result = await f.agents.run({ name: '误报', prompt: 'test', imageGeneration: true });
  assert.deepEqual(result.images, [{ savedPath: generatedPath }]);
  assert.equal((await readLog(f.logDirectory)).result.status, 'completed');
});

test('生图回合没有生成图片时不能记为成功', async t => {
  const f = await fixture(t, [], 'completed', [], { finalText: saved() });
  await assert.rejects(f.agents.run({ name: '缺图', prompt: 'test', imageGeneration: true }), /缺图 没有生成图片/);
  assert.equal((await readLog(f.logDirectory)).result.status, 'failed');
});

test('回合失败与提前 EOF 都记为失败', async t => {
  const failed = await fixture(t, [], 'failed');
  await assert.rejects(failed.agents.run({ name: '失败测试', prompt: 'test' }), /测试回合失败/);
  assert.equal((await readLog(failed.logDirectory)).result.status, 'failed');
  const eof = await fixture(t, [], 'eof');
  await assert.rejects(eof.agents.run({ name: '中断测试', prompt: 'test' }), /事件流结束/);
  assert.equal((await readLog(eof.logDirectory)).result.status, 'failed');
});

test('同名并发调用写入不同目录', async t => {
  const f = await fixture(t, []);
  const results = await Promise.all([
    f.agents.run({ name: '同名', prompt: 'first' }), f.agents.run({ name: '同名', prompt: 'second' }),
  ]);
  assert.notEqual(results[0].logDirectory, results[1].logDirectory);
  assert.equal((await requestLogNames(f.logDirectory)).length, 2);
  const prompts = await Promise.all(results.map(async result =>
    JSON.parse(await readFile(join(result.logDirectory!, 'request.json'), 'utf8')).prompt));
  assert.deepEqual(prompts, ['first', 'second'].map(prompt => workspacePrompt(prompt, executionPaths({ cwd: f.directory }, f.directory))));
});
