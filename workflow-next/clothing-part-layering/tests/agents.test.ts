import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CodexAgents } from '../agents.ts';
import { AgentRuntime, interruptedTaskPrompt } from '../agent-runtime.ts';
import { nodeExecutables } from './node-executables.ts';

const started = { type: 'thread.started', thread_id: 'test-thread' };
const reasoning = { type: 'item.completed', item: { id: 'reason', type: 'reasoning', text: '测试公开摘要' } };
const completed = { type: 'turn.completed', usage: { input_tokens: 12, cached_input_tokens: 4, output_tokens: 3, reasoning_output_tokens: 1 } };

async function fixture(t: TestContext, events: unknown[], extraCode = '') {
  nodeExecutables(t);
  const directory = await mkdtemp(join(tmpdir(), 'part-layering-agents-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = join(directory, 'fake-codex.mjs');
  await writeFile(executable, `#!/usr/bin/env node
let prompt = ''; for await (const chunk of process.stdin) prompt += chunk;
for (const event of ${JSON.stringify(events)}) process.stdout.write(JSON.stringify(event) + '\\n');
${extraCode}
`, 'utf8');
  await chmod(executable, 0o755);
  const logDirectory = join(directory, 'logs');
  const messages: string[] = [];
  const agents = new CodexAgents({
    codexPathOverride: executable, cwd: directory, logDirectory,
    progress: message => messages.push(message),
  });
  return { agents, directory, logDirectory, messages, executable };
}

async function readLog(root: string) {
  const names = await readdir(root);
  assert.equal(names.length, 1);
  const directory = join(root, names[0]);
  return {
    directory,
    request: JSON.parse(await readFile(join(directory, 'request.json'), 'utf8')),
    events: (await readFile(join(directory, 'events.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
    transcript: await readFile(join(directory, 'transcript.log'), 'utf8'),
    result: JSON.parse(await readFile(join(directory, 'result.json'), 'utf8')),
  };
}

test('真实 SDK 流接口记录输入、摘要、工具与未知事件字段、结果和用量', async t => {
  const finalResponse = JSON.stringify({ savedPath: 'generated.png', error: null });
  const nativeImageEvent = { type: 'item.started', item: { id: 'image', type: 'image_generation', detail: { prompt: '测试生图要求' } } };
  const toolEvent = { type: 'item.completed', item: {
    id: 'tool', type: 'mcp_tool_call', server: 'test', tool: 'inspect', arguments: { input: 'test' },
    result: { content: [{ type: 'text', text: 'test result' }], structured_content: null }, status: 'completed',
  } };
  const f = await fixture(t, [started, { type: 'turn.started' }, nativeImageEvent, reasoning, toolEvent,
    { type: 'item.completed', item: { id: 'final', type: 'agent_message', text: finalResponse } }, completed]);
  const result = await f.agents.run({
    name: '生成', prompt: '测试提示词', imageGeneration: true,
    images: [{ path: join(f.directory, 'reference.png'), description: '图 1：测试图片' }],
  });
  const log = await readLog(f.logDirectory);
  assert.equal(result.text, finalResponse);
  assert.equal(result.threadId, 'test-thread');
  assert.equal(result.logDirectory, log.directory);
  assert.deepEqual(result.images, [{ savedPath: join(f.directory, 'generated.png') }]);
  assert.equal(log.request.prompt, '测试提示词\n\n图 1：测试图片');
  assert.equal(log.request.input[2].path, join(f.directory, 'reference.png'));
  assert.equal(log.request.task.timeoutMs, null);
  assert.equal(log.events.length, 7);
  assert.deepEqual(log.events[2].event, nativeImageEvent);
  assert.match(log.transcript, /测试公开摘要/);
  assert.match(log.transcript, /test result/);
  assert.equal(log.result.status, 'completed');
  assert.equal(log.result.usage.input_tokens, 12);
  assert.ok(log.result.elapsedMs >= 0);
  assert.ok(f.messages.some(message => message.includes('测试公开摘要')));
});

test('未声明时限的 SDK 回合不注册超时计时器', async t => {
  t.mock.method(AbortSignal, 'timeout', () => assert.fail('不应自行设置超时'));
  const f = await fixture(t, [started, completed]);
  await f.agents.run({ name: '无默认超时', prompt: 'test' });
  assert.equal((await readLog(f.logDirectory)).result.status, 'completed');
});

test('SDK turn.failed 保留中途事件和失败原因', async t => {
  const f = await fixture(t, [started, reasoning, { type: 'turn.failed', error: { message: '工具失败' } }]);
  await assert.rejects(f.agents.run({ name: '失败测试', prompt: 'test' }), /工具失败/);
  const log = await readLog(f.logDirectory);
  assert.equal(log.result.status, 'failed');
  assert.equal(log.result.threadId, 'test-thread');
  assert.equal(log.result.error, '工具失败');
  assert.match(log.transcript, /测试公开摘要/);
  assert.equal(log.events.at(-1).event.type, 'turn.failed');
});

test('超时保留已收到的记录，不自动重试', async t => {
  const f = await fixture(t, [started, reasoning], 'setTimeout(() => {}, 10000);');
  const timeout = new AbortController();
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    assert.equal(ms, 1000);
    return timeout.signal;
  });
  const agents = new CodexAgents({codexPathOverride:f.executable,cwd:f.directory,logDirectory:f.logDirectory,
    progress:message => {
      if (message.includes('思考摘要：测试公开摘要')) timeout.abort(new DOMException('测试超时', 'TimeoutError'));
    }});
  await assert.rejects(agents.run({ name: '超时测试', prompt: 'test', timeoutMs: 1000 }));
  const log = await readLog(f.logDirectory);
  assert.equal(log.result.status, 'failed');
  assert.ok(log.result.error);
  assert.match(log.transcript, /测试公开摘要/);
});

test('未完成的事件流不能记为成功', async t => {
  const f = await fixture(t, [started, reasoning]);
  await assert.rejects(f.agents.run({ name: '中断测试', prompt: 'test' }), /未收到 turn.completed/);
  assert.equal((await readLog(f.logDirectory)).result.status, 'failed');
});

test('生成失败或最终路径无效时保留原始最终回复', async t => {
  const finalResponse = JSON.stringify({ savedPath: null, error: '未生成图片' });
  const f = await fixture(t, [started,
    { type: 'item.completed', item: { id: 'final', type: 'agent_message', text: finalResponse } }, completed]);
  await assert.rejects(f.agents.run({ name: '生成失败', prompt: 'test', imageGeneration: true }), /未生成图片/);
  const log = await readLog(f.logDirectory);
  assert.equal(log.result.status, 'failed');
  assert.equal(log.result.finalResponse, finalResponse);
});

test('同名并发调用写入不同目录', async t => {
  const f = await fixture(t, [started,
    { type: 'item.completed', item: { id: 'final', type: 'agent_message', text: 'ok' } }, completed]);
  const results = await Promise.all([
    f.agents.run({ name: '同名', prompt: 'first' }), f.agents.run({ name: '同名', prompt: 'second' }),
  ]);
  assert.notEqual(results[0].logDirectory, results[1].logDirectory);
  assert.equal((await readdir(f.logDirectory)).length, 2);
  const prompts = await Promise.all(results.map(async result =>
    JSON.parse(await readFile(join(result.logDirectory!, 'request.json'), 'utf8')).prompt));
  assert.deepEqual(prompts, ['first', 'second']);
});

test('SDK 内置重连的 error 通知不提前打断回合，不开启外层恢复', async t => {
  const f = await fixture(t, [started, { type: 'error', message: 'Reconnecting... 2/5' }, completed]);
  await f.agents.run({ name: '内置重连', prompt: 'test' });
  const record = await readLog(f.logDirectory);
  assert.equal(record.result.status, 'completed');
  assert.equal(record.events.length, 3);
});

test('SDK 容量终态失败后沿用 thread 恢复，保留已生成图片及每次请求和退避记录', async t => {
  const f = await fixture(t, [], `
import {readFile, appendFile} from 'node:fs/promises';
const capture = new URL('./calls.jsonl', import.meta.url);
const previous = await readFile(capture, 'utf8').catch(() => '');
await appendFile(capture, JSON.stringify({args:process.argv.slice(2),prompt})+'\\n');
const write = event => process.stdout.write(JSON.stringify(event)+'\\n');
write(${JSON.stringify(started)});
if (!previous) {
  write({type:'item.completed',item:{id:'image',type:'image_generation',savedPath:'generated.png'}});
  write({type:'turn.failed',error:{message:'Selected model is at capacity. Please try a different model.'}});
} else {
  write({type:'item.completed',item:{id:'message',type:'agent_message',text:JSON.stringify({savedPath:'generated.png',error:null})}});
  write(${JSON.stringify(completed)});
}`);
  const agents = new CodexAgents({codexPathOverride:f.executable,cwd:f.directory,logDirectory:f.logDirectory,
    runtime:new AgentRuntime(3, async () => {})});
  const result = await agents.run({name:'SDK恢复',prompt:'只调用一次生图',imageGeneration:true,
    images:[{path:join(f.directory,'reference.png'),description:'参考图'}]});
  assert.equal(result.threadId, 'test-thread');
  assert.deepEqual(result.images, [{savedPath:join(f.directory,'generated.png')}]);
  const calls = (await readFile(join(f.directory,'calls.jsonl'),'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(calls.length, 2);
  assert.ok(!calls[0].args.includes('resume'));
  const resumeIndex = calls[1].args.indexOf('resume');
  assert.equal(calls[1].args[resumeIndex + 1], 'test-thread');
  assert.match(calls[0].prompt, /只调用一次生图/);
  assert.ok(calls[1].prompt.startsWith(interruptedTaskPrompt));
  assert.ok(calls[1].prompt.includes(join(f.directory,'generated.png')));
  assert.ok(!calls[1].args.includes('--image'));
  const names = await readdir(f.logDirectory);
  assert.equal(names.length, 2);
  const records = await Promise.all(names.map(async name => ({
    result:JSON.parse(await readFile(join(f.logDirectory,name,'result.json'),'utf8')),
    events:await readFile(join(f.logDirectory,name,'events.jsonl'),'utf8'),
  })));
  assert.deepEqual(records.map(record => record.result.status).sort(), ['completed','failed']);
  assert.ok(records.some(record => record.events.includes('retry.scheduled')));
});

test('模型已结束后返回生图错误，即使文本含 overloaded 也不自动重新生成', async t => {
  const f = await fixture(t, [started,{type:'item.completed',item:{id:'final',type:'agent_message',
    text:JSON.stringify({savedPath:null,error:'server overloaded'})}},completed]);
  await assert.rejects(f.agents.run({name:'生图工具失败',prompt:'test',imageGeneration:true}), /server overloaded/);
  assert.equal((await readdir(f.logDirectory)).length, 1);
});
