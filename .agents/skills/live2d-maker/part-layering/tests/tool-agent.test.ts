import {requestLogNames} from '../../shared/tests/request-logs.ts';
import {checkCodexCapabilities, loadWorkflowEnvironment} from '../../shared/codex/environment.ts';
import { profile } from '../profile.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import { CodexAgents } from '../../shared/codex/agents.ts';
import { workflowLogPath } from '../../shared/codex/agent-log.ts';
import { AgentRuntime, interruptedTaskPrompt } from '../../shared/codex/agent-runtime.ts';
import { textResult, type FunctionTool } from '../../shared/codex/function-tools.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { fakeAppServer } from './fake-app-server.ts';
import { nodeExecutables } from './node-executables.ts';

async function fixture(t: TestContext) {
  nodeExecutables(t);
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'part-layering-native-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, logDirectory: join(directory, 'part-layering/agents') };
}
async function log(root: string) {
  const names = await requestLogNames(root);
  const directory = join(root, names[0]);
  return {
    request: JSON.parse(await readFile(join(directory, 'request.json'), 'utf8')),
    events: await readFile(join(directory, 'events.jsonl'), 'utf8'),
    transcript: await readFile(workflowLogPath(root), 'utf8'),
    result: JSON.parse(await readFile(join(directory, 'result.json'), 'utf8')),
  };
}
function tool(execute: FunctionTool['execute']): FunctionTool {
  return { name: 'probe', description: 'test', inputSchema: { type: 'object', properties: {} }, execute };
}

test('未声明时限的原生工具回合不注册超时计时器', async t => {
  t.mock.method(AbortSignal, 'timeout', () => assert.fail('不应自行设置超时'));
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, []);
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.directory), codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory });
  await agents.run({ name: '无默认超时', prompt: 'test', tools: [tool(async () => textResult('ok'))] });
  const record = await log(f.logDirectory);
  assert.equal(record.request.task.timeoutMs, null);
  assert.equal(record.result.status, 'completed');
});

test('原生初始分组可裁剪放大回传图片、保存正式分组，开放自带终端并正确续跑', async t => {
  const f = await fixture(t), directory = join(f.directory, 'part-layering');
  const references = { directory: join(directory, 'references'), baseSubject: join(directory, 'references', 'base-subject.png'),
    simplifiedSubject: 'unused', judgment: 'unused' };
  await mkdir(references.directory, { recursive: true });
  await sharp({ create: { width: 100, height: 200, channels: 4, background: '#ff0000' } }).png().toFile(references.baseSubject);
  const grouping = { groups: [{ name: 'head', groups: [], note: '头部' }] };
  const server = await fakeAppServer(f.directory, [
    { tool: 'view_bitmap', arguments: { path: references.baseSubject, crop: [10, 20, 20, 30], scale: 2 } },
    { tool: 'write_groups', arguments: grouping },
  ]);
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.directory), codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory,
    config: { custom_auth: 'test-secret-must-not-log' } });
  const steps = { ...createLayeringSteps(agents), async drawOutline() {
    return { status: 'pending' as const, message: '本测试仅验证首次分组' };
  } };
  const result = await runLayering({ profile, directory, references, groups: null, steps });
  assert.equal(result.groups[0].id, 'head');
  await assert.rejects(readFile(join(f.directory, 'progress.json')), { code: 'ENOENT' });
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const initialize = protocol.find(item => item.method === 'initialize');
  assert.equal(initialize.params.capabilities.experimentalApi, true);
  const thread = protocol.find(item => item.method === 'thread/start');
  assert.equal(thread.params.cwd, join(directory, 'step08_initial/workspace'));
  assert.equal(thread.params.model, 'gpt-6.1-sol');
  assert.equal(thread.params.config['features.shell_tool'], true);
  assert.equal(thread.params.config['features.unified_exec'], true);
  assert.equal(thread.params.sandbox, 'danger-full-access');
  assert.equal(thread.params.config['features.multi_agent'], false);
  assert.equal(thread.params.config['features.image_generation'], false);
  assert.equal(thread.params.config.custom_auth, 'test-secret-must-not-log');
  assert.deepEqual(thread.params.dynamicTools.map((item: { type: string; name: string }) => [item.type, item.name]), [
    ['function', 'view_bitmap'],
    ['function', 'write_groups'],
  ]);
  const turn = protocol.find(item => item.method === 'turn/start');
  assert.equal(turn.params.effort, 'high');
  assert.deepEqual(turn.params.input.map((item: { type: string }) => item.type), ['text']);
  assert.ok(turn.params.input[0].text.includes(`素体参考图：${references.baseSubject}`));
  const observation = protocol.find(item => item.id === 'call-1').result;
  assert.equal(observation.success, true);
  const preview = JSON.parse(observation.contentItems[0].text);
  assert.deepEqual(preview.crop, [10, 20, 20, 30]);
  assert.equal(preview.width, 40);
  assert.equal(preview.height, 60);
  assert.equal(observation.contentItems[1].type, 'inputImage');
  assert.equal(preview.savedPath.startsWith(join(directory, 'step08_initial/workspace/bitmaps') + sep), true);
  const image = Buffer.from(observation.contentItems[1].imageUrl.split(',')[1], 'base64');
  assert.deepEqual(await readFile(preview.savedPath), image);
  const imageMetadata = await sharp(image).metadata();
  assert.equal(imageMetadata.width, 40);
  assert.equal(imageMetadata.height, 60);
  const submission = protocol.find(item => item.id === 'call-2').result;
  assert.equal(submission.success, true);
  const saved = JSON.parse(submission.contentItems[0].text).path;
  assert.equal(saved, join(directory, 'step08_initial/groups.json'));
  assert.deepEqual(JSON.parse(await readFile(saved, 'utf8')), {
    groups: [{ id: 'head', kind: 'group', name: 'head', note: '头部' }],
  });
  const logged = await log(f.logDirectory);
  assert.equal(logged.request.transport, 'app-server');
  assert.equal(logged.result.status, 'completed');
  assert.equal(logged.result.finalResponse, '文件已保存，不返回 JSON。');
  assert.equal(logged.result.usage.total.inputTokens, 12);
  assert.match(logged.transcript, /测试工具选择摘要/);
  assert.match(logged.transcript, /view_bitmap/);
  assert.match(logged.transcript, /write_groups/);
  for (const value of [logged.events, logged.transcript, JSON.stringify(logged.request)]) {
    assert.doesNotMatch(value, /test-secret-must-not-log/);
  }
  await runLayering({ profile, directory, references, groups: null, steps });
  assert.equal((await requestLogNames(f.logDirectory)).length, 1);
});

test('函数异常回传 success=false，保留参数与错误，回合失败不记成功', async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [{ tool: 'probe', arguments: { value: 1 } }], 'failed');
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.directory), codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory });
  await assert.rejects(agents.run({ name: '异常', prompt: 'test', tools: [tool(async () => { throw new Error('工具参数错误'); })] }), /测试回合失败/);
  const messages = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const response = messages.find(item => item.id === 'call-1').result;
  assert.equal(response.success, false);
  assert.match(response.contentItems[0].text, /工具参数错误/);
  const logged = await log(f.logDirectory);
  assert.equal(logged.result.status, 'failed');
  assert.match(logged.transcript, /工具参数错误/);
});

test('绘制会话多轮沿用一个 thread，回调按当前回合绑定；关闭后不能复用', async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [{ tool: 'probe', arguments: {} }]);
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.directory), codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory });
  const session = agents.createSession();
  const calls: string[] = [];
  try {
    const first = await session.run({ name: '绘制', prompt: '第一次绘制', tools: [tool(async () => { calls.push('draw'); return textResult('draw'); })] });
    const second = await session.run({ name: '返修', prompt: '只按意见修正', tools: [tool(async () => { calls.push('repair'); return textResult('repair'); })] });
    assert.equal(second.threadId, first.threadId);
    assert.deepEqual(calls, ['draw', 'repair']);
    const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(protocol.filter(message => message.method === 'thread/start').length, 1);
    const turns = protocol.filter(message => message.method === 'turn/start');
    assert.equal(turns.length, 2);
    assert.ok(turns.every(message => message.params.threadId === first.threadId));
    const names = await requestLogNames(f.logDirectory);
    assert.equal(names.length, 2);
    const results = await Promise.all(names.map(name => readFile(join(f.logDirectory, name, 'result.json'), 'utf8')));
    assert.ok(results.every(value => JSON.parse(value).threadId === first.threadId));
    const changed = await session.run({ name: '再次', prompt: 'test', tools: [tool(async () => textResult('no'))] });
    assert.equal(changed.threadId, first.threadId);
  } finally { await session.close(); }
  await assert.rejects(session.run({ name: '已关闭', prompt: 'test', tools: [] }), /已关闭/);
});

test('独立 review 会话不设沙箱，原生工具仍可由程序保存报告', async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [{ tool: 'probe', arguments: {} }]);
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.directory), codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory });
  await agents.run({ name: 'review', prompt: 'test', tools: [tool(async () => textResult('report'))] });
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(protocol.find(message => message.method === 'thread/start').params.sandbox, 'danger-full-access');
  assert.equal(protocol.find(message => message.method === 'thread/start').params.config['features.image_generation'], false);
  assert.equal(protocol.find(message => message.id === 'call-1').result.success, true);
});

test('绘制会话同时开放原生生图和函数工具，保存生图路径与事件，返修沿用开关', async t => {
  const f = await fixture(t);
  const savedPath = join(f.directory, 'detail-reference.png');
  const bytes = await sharp({ create: { width: 20, height: 30, channels: 4, background: '#fff' } }).png().toBuffer();
  await sharp(bytes).toFile(savedPath);
  const resultData = bytes.toString('base64');
  const server = await fakeAppServer(f.directory, [{ tool: 'probe', arguments: {} }], 'completed', [{
    type: 'imageGeneration', id: 'detail-1', status: 'completed', savedPath, result: resultData,
    revisedPrompt: '基于原参考局部放大，结构清晰优先，不添加不存在的细节。', failure: null,
  }]);
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.directory), codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory });
  const session = agents.createSession();
  const task = { name: '绘制', prompt: '产出 SVG，必要时生图辅助辨认。', imageGeneration: true,
    tools: [tool(async () => textResult('preview'))] };
  try {
    const first = await session.run(task);
    assert.deepEqual(first.images, [{ savedPath }]);
    const logged = await log(f.logDirectory);
    assert.deepEqual(logged.result.images, [{ savedPath: 'detail-reference.png' }]);
    assert.match(logged.events, /imageGeneration/);
    assert.ok(logged.events.includes(resultData));
    assert.match(logged.transcript, /结构清晰优先/);
    assert.match(logged.transcript, /图片数据/);
    assert.ok(!logged.transcript.includes(resultData));
    const second = await session.run({ ...task, name: '返修' });
    assert.equal(second.threadId, first.threadId);
    assert.deepEqual(second.images, [{ savedPath }]);
    const changed = await session.run({ ...task, imageGeneration: false });
    assert.equal(changed.threadId, first.threadId);
    const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const resumed = protocol.find(item => item.method === 'thread/resume');
    assert.equal(resumed.params.config['features.image_generation'], false);
    const threads = protocol.filter(item => item.method === 'thread/start');
    assert.equal(threads.length, 1);
    assert.equal(threads[0].params.config['features.image_generation'], true);
    assert.equal(threads[0].params.config['features.unified_exec'], true);
    assert.equal(threads[0].params.dynamicTools[0].name, 'probe');
  } finally { await session.close(); }
});

test('关闭保留会话能取消挂起的工具并释放进程，不等待回合超时', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [{ tool: 'probe', arguments: {} }]);
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.directory), codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory });
  const session = agents.createSession();
  const called = Promise.withResolvers<void>();
  const run = session.run({ name: '挂起', prompt: 'test', timeoutMs: 60_000, tools: [tool(async () => {
    called.resolve();
    return new Promise(() => {});
  })] });
  const rejected = assert.rejects(run, /会话已结束/);
  await called.promise;
  await session.close();
  await rejected;
  assert.equal((await log(f.logDirectory)).result.status, 'failed');
});

test('错误会话或未知工具的请求不能执行已绑定函数', async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [
    { tool: 'probe', arguments: {}, threadId: 'another-thread' }, { tool: 'unregistered', arguments: {} },
  ]);
  let calls = 0;
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.directory), codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory });
  await agents.run({ name: '隔离', prompt: 'test', tools: [tool(async () => { calls++; return textResult('ok'); })] });
  assert.equal(calls, 0);
  const messages = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(messages.filter(item => typeof item.id === 'string').every(item => item.result.success === false));
});

test('原生回合超时、提前 EOF 与函数内部挂起都终止并保存失败日志', async t => {
  for (const mode of ['hang', 'eof', 'tool-hang']) {
    const f = await fixture(t);
    const server = await fakeAppServer(f.directory, mode === 'tool-hang' ? [{ tool: 'probe', arguments: {} }] : [],
      mode === 'tool-hang' ? 'completed' : mode);
    const environment = loadWorkflowEnvironment({}, f.directory);
    // Measure the turn deadline after local CLI capability startup has completed.
    await checkCodexCapabilities(environment, { codexPathOverride: server.executable });
    const agents = new CodexAgents({ environment, codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory });
    const started = Date.now();
    await assert.rejects(agents.run({ name: mode, prompt: 'test', timeoutMs: 500,
      tools: [tool(async () => new Promise(() => {}))] }));
    assert.ok(Date.now() - started < 5000);
    assert.equal((await log(f.logDirectory)).result.status, 'failed');
  }
});

test('原生重连通知交给 CLI 完成，仅运行一个 turn', async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [], 'completed', [], {nativeReconnect:true});
  const agents = new CodexAgents({codexPathOverride:server.executable,cwd:f.directory,logDirectory:f.logDirectory});
  await agents.run({name:'内置恢复',prompt:'test',tools:[tool(async () => textResult('ok'))]});
  const protocol = (await readFile(server.capture,'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(protocol.filter(message => message.method === 'turn/start').length, 1);
  assert.equal((await log(f.logDirectory)).result.status, 'completed');
});

test('原生生图事件的相对 savedPath 是协议异常：本回合失败，不按当前目录或任务根猜测', async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [{tool:'probe',arguments:{}}], 'completed',
    [{type:'imageGeneration',status:'completed',savedPath:'generated.png'}]);
  const agents = new CodexAgents({codexPathOverride:server.executable,cwd:f.directory,logDirectory:f.logDirectory,
    runtime:new AgentRuntime(3, async () => {})});
  await assert.rejects(agents.run({name:'相对生图',prompt:'test',imageGeneration:true,tools:[tool(async () => textResult('已提交'))]}),
    /Codex 原生生图 savedPath 必须是绝对路径：generated\.png/);
  const protocol = (await readFile(server.capture,'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(protocol.filter(message => message.method === 'turn/start').length, 1);
});

test('原生容量失败恢复同一 thread，续接只发固定的中断继续提示，结果保留已有生图，每次尝试都留日志', async t => {
  const f = await fixture(t);
  const savedPath = join(f.directory,'existing-image.png');
  const server = await fakeAppServer(f.directory, [{tool:'probe',arguments:{}}], 'completed',
    [{type:'imageGeneration',status:'completed',savedPath}], {failedTurns:2,skipCallsAfterFailure:true});
  let submissions = 0;
  const messages: string[] = [];
  const agents = new CodexAgents({codexPathOverride:server.executable,cwd:f.directory,logDirectory:f.logDirectory,
    progress:message => messages.push(message),runtime:new AgentRuntime(3, async () => {})});
  const originalPrompt = '复核第 2 轮，candidateHash=current-v2；报告中的第 1 轮属于旧候选。';
  const result = await agents.run({name:'恢复',prompt:originalPrompt,imageGeneration:true,
    tools:[tool(async () => {submissions++;return textResult('已提交');})]});
  assert.equal(result.threadId, 'native-thread');
  assert.deepEqual(result.images,[{savedPath}]);
  assert.equal(submissions, 1);
  const protocol = (await readFile(server.capture,'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(protocol.filter(message => message.method === 'thread/start').length, 1);
  const turns = protocol.filter(message => message.method === 'turn/start');
  assert.equal(turns.length, 3);
  assert.ok(turns.every(message => message.params.threadId === 'native-thread'));
  assert.ok(turns[0].params.input[0].text.replace(/\r\n/g, '\n').startsWith(originalPrompt+'\n'));
  assert.match(turns[0].params.input[0].text, /当前工作区/);
  assert.ok(turns.slice(1).every(message => message.params.input[0].text.startsWith(interruptedTaskPrompt())));
  assert.ok(turns.slice(1).every(message => !message.params.input[0].text.includes(originalPrompt)));
  assert.ok(turns.slice(1).every(message => !message.params.input[0].text.includes('existing-image.png')));
  assert.equal((await requestLogNames(f.logDirectory)).length, 3);
  assert.equal(messages.filter(message => message.includes('限流等待（临时错误）')).length, 2);
  const names = await requestLogNames(f.logDirectory);
  const statuses = await Promise.all(names.map(async name => JSON.parse(await readFile(join(f.logDirectory,name,'result.json'),'utf8')).status));
  assert.deepEqual(statuses.sort(), ['completed','failed','failed']);
});

test('关闭会话能取消退避等待，不再开启下一次尝试', {timeout:5000}, async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [], 'completed', [], {failedTurns:1});
  const waiting = Promise.withResolvers<void>();
  const runtime = new AgentRuntime(1, async (_ms, signal) => {
    waiting.resolve();
    await new Promise<void>((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason), {once:true}));
  });
  const agents = new CodexAgents({codexPathOverride:server.executable,cwd:f.directory,logDirectory:f.logDirectory,runtime});
  const session = agents.createSession();
  const rejected = assert.rejects(session.run({name:'取消恢复',prompt:'test',tools:[tool(async () => textResult('ok'))]}), /会话已结束/);
  await waiting.promise;
  await session.close();
  await rejected;
  const protocol = (await readFile(server.capture,'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(protocol.filter(message => message.method === 'turn/start').length, 1);
});

test('无工具一次性回合、原生任务和保留会话共享同一个并发限制', {timeout:5000}, async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory,[{tool:'probe',arguments:{}}]);
  const agents = new CodexAgents({codexPathOverride:server.executable,cwd:f.directory,logDirectory:f.logDirectory,agentConcurrency:1});
  const session = agents.createSession();
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const first = session.run({name:'保留会话',prompt:'test',tools:[tool(async () => {
    entered.resolve();await release.promise;return textResult('ok');
  })]});
  try {
    await entered.promise;
    const plain = agents.run({name:'无工具排队',prompt:'test'});
    const native = agents.run({name:'原生排队',prompt:'test',tools:[tool(async () => textResult('ok'))]});
    await new Promise(setImmediate);
    assert.equal((await requestLogNames(f.logDirectory)).length, 1);
    release.resolve();
    await Promise.all([first,plain,native]);
    assert.equal((await requestLogNames(f.logDirectory)).length, 3);
  } finally {release.resolve();await session.close();}
});

test('图片被内容策略拦截：本批图片换成文字后在新会话继续，多张图引导逐张读取', async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [{ tool: 'probe', arguments: {} }], 'completed', [], { blockedTurns: 1 });
  const replaced: string[] = [], started: string[] = [];
  const agents = new CodexAgents({ codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory,
    runtime: new AgentRuntime(3, async () => assert.fail('拦截不是临时错误，不退避重试')) });
  const session = agents.createSession(undefined, { onThreadReplacement: async id => { replaced.push(id); },
    onSessionStarted: async id => { started.push(id); } });
  t.after(() => session.close());
  // Images reach the model only through tool results.
  const result = await session.run({ name: '拦截', prompt: '原始任务', tools: [tool(async () => ({ success: true, contentItems: [
    { type: 'inputImage', imageUrl: 'data:image/png;base64,AA' }, { type: 'inputImage', imageUrl: 'data:image/png;base64,AB' }] }))] });
  await session.close();
  assert.equal(result.threadId, 'native-thread-2');
  assert.deepEqual(replaced, ['native-thread-1']);
  assert.deepEqual(started, ['native-thread-1', 'native-thread-2']);
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const [injected] = protocol.filter(message => message.method === 'thread/inject_items');
  const history = JSON.stringify(injected.params.items);
  assert.ok(!history.includes('"type":"input_image"') && !history.includes('"instructions"'));
  assert.equal(history.split('工具 probe 的返回').length - 1, 2);
  const turns = protocol.filter(message => message.method === 'turn/start');
  assert.deepEqual(turns.map(message => message.params.threadId), ['native-thread-1', 'native-thread-2']);
  assert.equal(turns[1].params.input.length, 1);
});

test('历史里没有图片可换时，内容策略拦截按致命错误结束', async t => {
  const f = await fixture(t);
  const server = await fakeAppServer(f.directory, [], 'completed', [], { blockedTurns: 1 });
  const agents = new CodexAgents({ codexPathOverride: server.executable, cwd: f.directory, logDirectory: f.logDirectory,
    runtime: new AgentRuntime(3, async () => assert.fail('不重试')) });
  await assert.rejects(agents.run({ name: '无图拦截', prompt: '原始任务', tools: [tool(async () => textResult('ok'))] }), /content policy/);
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(protocol.filter(message => message.method === 'turn/start').length, 1);
});
