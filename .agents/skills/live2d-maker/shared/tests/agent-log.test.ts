import assert from 'node:assert/strict';
import fs, { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { AgentLog } from '../codex/agent-log.ts';
import { followNativeLog } from '../codex/native-log.ts';
import { createTaskLog, readTaskLog } from '../../workflow/log.ts';

test('concurrent agents and raster steps write the same task log, retaining independent request records', async t => {
  const root = await mkdtemp(join(tmpdir(), 'layering-log-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const a = await AgentLog.create(join(root, 'part-layering/agents'), 'hair/right', { prompt: 'draw' });
  const b = await AgentLog.create(join(root, 'raster-layering/step02/agents'), 'step02', { prompt: 'repair' });
  await Promise.all([a.recordProtocol({ method: 'layering/tool', params: { name: 'preview_svg', success: true } }),
    b.record({ type: 'item.completed', item: { type: 'agent_message', id: 'message', text: '修画完成' } })]);
  await AgentLog.retry(a.directory, { attempt: 1, nextAttempt: 2, delayMs: 5000, error: 'HTTP503' });
  await a.finish({ status: 'completed' }); await b.finish({ status: 'completed' });
  const log = await readFile(join(root, 'workflow.log'), 'utf8');
  assert.match(log, /\[hair\/right\].*preview_svg/s); assert.match(log, /\[step02\] 消息：修画完成/);
  assert.match(log, /HTTP503/);
  for (const agent of [a, b]) {
    const files = await readdir(agent.directory);
    // The retry left its wait deadline next to the record.
    assert.deepEqual(files.sort(), ['events.jsonl', 'prompt.md', 'request.json', 'result.json', ...(agent === a ? ['retry-wait.json'] : [])]);
    assert.equal(await readFile(join(agent.directory, 'prompt.md'), 'utf8'), agent === a ? 'draw' : 'repair');
  }
});

test('native diagnostics reach workflow.log without treating an updater notice as a failure', async t => {
  const root = await mkdtemp(join(tmpdir(), 'layering-native-log-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = await AgentLog.create(join(root, 'clothing-part-layering/agents'), '衣服返修', {});
  const native = join(root, 'native.log'), errors: string[] = [];
  await writeFile(native, 'I1022 request started\nE1022 timeout awaiting response headers\nI1022 auto_updater.go:334] Spawned background update process with PID 123\n');
  await followNativeLog(native, log, message => errors.push(message)).close();
  const text = await readFile(join(root, 'workflow.log'), 'utf8');
  assert.match(text, /timeout awaiting response headers/);
  assert.match(text, /Spawned background update process/);
  assert.deepEqual(errors, []);
  await assert.rejects(readFile(native), { code: 'ENOENT' });
});

test('Claude tool-only activity after rate limiting updates the sole workflow log and its web summary', async t => {
  const root = await mkdtemp(join(tmpdir(), 'layering-cli-log-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = await AgentLog.create(join(root, 'character-assembly/agents'), 'assembly', {});
  await log.recordProtocol({ type: 'system', subtype: 'api_retry', attempt: 5, error: 'rate_limit' });
  await log.recordProtocol({ type: 'assistant', message: { content: [
    { type: 'thinking', thinking: 'private reasoning', signature: 'private signature' },
    { type: 'tool_use', id: 'fit', name: 'Bash', input: { command: 'python fit.py', description: 'Fit clothing transform' } },
  ] } });
  await log.recordProtocol({ type: 'system', subtype: 'task_notification', tool_use_id: 'fit', status: 'completed', summary: 'Fit clothing transform' });
  await log.recordProtocol({ type: 'user', message: { content: [
    { type: 'tool_result', tool_use_id: 'fit', is_error: false, content: 'Fit completed: scale=0.418' },
  ] } });
  const text = await readFile(join(root, 'workflow.log'), 'utf8');
  assert.match(text, /退避重试（第 5 次）.*rate_limit/);
  assert.match(text, /工具开始：Bash（fit）/);
  assert.match(text, /后台工具完成：fit/);
  assert.match(text, /工具完成：fit.*scale=0.418/);
  assert.doesNotMatch(text, /private reasoning|private signature/);
  const latest = await readTaskLog(root);
  assert.ok(latest.message);
  assert.match(latest.message, /scale=0.418/);
});

test('CLI image results and long tool output stay readable without discarding the raw request record', async t => {
  const root = await mkdtemp(join(tmpdir(), 'layering-cli-media-log-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = await AgentLog.create(join(root, 'raster-layering/agents'), 'step02', {});
  const data = 'fixture-image-data';
  await log.recordProtocol({ type: 'user', message: { content: [
    { type: 'tool_result', tool_use_id: 'preview', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data } }] },
    { type: 'tool_result', tool_use_id: 'inspect', is_error: true, content: 'missing input\n' + 'x'.repeat(8000) },
  ] } });
  const text = await readFile(join(root, 'workflow.log'), 'utf8');
  assert.match(text, /工具完成：preview/);
  assert.match(text, /二进制数据/);
  assert.doesNotMatch(text, new RegExp(data));
  assert.match(text, /工具失败：inspect.*missing input/);
  assert.match(text, /内容较长/);
  assert.ok(text.length < 5000);
  assert.match(await readFile(join(log.directory, 'events.jsonl'), 'utf8'), new RegExp(data));
});

test('AGV native tool steps and step errors reach workflow.log without logging response token deltas', async t => {
  const root = await mkdtemp(join(tmpdir(), 'layering-agv-log-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = await AgentLog.create(join(root, 'character-assembly/agents'), 'assembly', {});
  const tool = { step_index: 2, step_type: 'tool', tool_name: 'run_command',
    tool_info: { name: 'run_command', parameters: { CommandLine: 'python fit.py' } } };
  await log.recordProtocol({ event: 'step_update', step_update: { ...tool, state: 'ACTIVE' } });
  await log.recordProtocol({ event: 'step_update', step_update: { step_index: 3, step_type: 'error_message', state: 'DONE', text_delta: 'upstream timeout' } });
  await log.recordProtocol({ event: 'step_update', step_update: { ...tool, state: 'DONE', duration_seconds: 8.5,
    tool_info: { ...tool.tool_info, output: 'fit complete' } } });
  await log.recordProtocol({ event: 'step_update', step_update: { step_index: 4, step_type: 'agent_response', state: 'ACTIVE', text_delta: 'partial response' } });
  const text = await readFile(join(root, 'workflow.log'), 'utf8');
  assert.match(text, /工具开始：run_command（步骤 2）.*python fit.py/);
  assert.match(text, /步骤错误：3；DONE/);
  assert.match(text, /upstream timeout/);
  assert.match(text, /工具完成：run_command（步骤 2）.*fit complete.*8.5 秒/);
  assert.doesNotMatch(text, /partial response/);
  assert.match(await readFile(join(log.directory, 'events.jsonl'), 'utf8'), /partial response/);
  const latest = await readTaskLog(root);
  assert.ok(latest.message);
  assert.match(latest.message, /工具完成：run_command/);
});

test('Codex SDK and app-server command/tool events already share the same human log', async t => {
  const root = await mkdtemp(join(tmpdir(), 'layering-codex-log-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = await AgentLog.create(join(root, 'part-layering/agents'), 'face', {});
  await log.record({ type: 'item.started', item: { type: 'command_execution', id: 'command', command: 'python inspect.py',
    aggregated_output: '', status: 'in_progress' } });
  await log.record({ type: 'item.completed', item: { type: 'command_execution', id: 'command', command: 'python inspect.py',
    aggregated_output: 'inspection complete', exit_code: 0, status: 'completed' } });
  await log.recordProtocol({ method: 'item/started', params: { item: { type: 'commandExecution', id: 'native-command', command: 'inspect native' } } });
  await log.recordProtocol({ method: 'item/commandExecution/outputDelta', params: { delta: 'raw command fragment' } });
  await log.recordProtocol({ method: 'item/tool/call', params: { tool: 'preview_svg', arguments: { path: 'draft.svg' } } });
  await log.recordProtocol({ result: { contentItems: [{ type: 'inputText', text: 'preview complete' }], success: true } }, 'out');
  await log.recordProtocol({ method: 'item/completed', params: { item: { type: 'commandExecution', id: 'native-command', aggregatedOutput: 'native complete' } } });
  await log.recordProtocol({ method: 'error', params: { error: { message: 'native error' }, willRetry: true } });
  await log.record({ type: 'error', message: 'SDK error' });
  const text = await readFile(join(root, 'workflow.log'), 'utf8');
  for (const pattern of [/命令开始：python inspect.py/, /命令完成：python inspect.py/, /inspection complete/,
    /item\/started/, /工具调用：preview_svg/, /工具结果：/, /preview complete/, /native complete/, /native error/, /SDK error/]) {
    assert.match(text, pattern);
  }
  assert.doesNotMatch(text, /raw command fragment/);
  assert.match(await readFile(join(log.directory, 'events.jsonl'), 'utf8'), /raw command fragment/);
});

test('a locked workflow summary retries its open and preserves the agent result if it stays locked', async t => {
  const root = await mkdtemp(join(tmpdir(), 'layering-log-busy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = await AgentLog.create(join(root, 'part-layering/agents'), 'face', {});
  const path = join(root, 'workflow.log'), append = fs.appendFile, open = fs.open;
  const sharingViolation = Object.assign(new Error('file is in use'), { code: 'EBUSY', syscall: 'open' });
  let blockedAppends = 2, blockedRead = false;
  const appendMock = t.mock.method(fs, 'appendFile', async (...args: Parameters<typeof append>) => {
    if (args[0] === path && blockedAppends > 0) { blockedAppends--; throw sharingViolation; }
    return append(...args);
  });
  const openMock = t.mock.method(fs, 'open', async (...args: Parameters<typeof open>) => {
    if (args[0] === path && blockedRead) throw sharingViolation;
    return open(...args);
  });
  const warning = t.mock.method(console, 'error', () => {});
  syncBuiltinESMExports();
  try {
    await log.record({ type: 'turn.started' });
    assert.equal(blockedAppends, 0);
    assert.equal((await readFile(path, 'utf8')).match(/开始处理/g)?.length, 1);
    assert.equal(warning.mock.callCount(), 0);

    blockedAppends = Infinity; blockedRead = true;
    const summary = createTaskLog(root);
    summary.write('总调度进度');
    const [, displayed] = await Promise.all([log.finish({ status: 'completed' }), readTaskLog(root), summary.flush()]);
    assert.equal(JSON.parse(await readFile(join(log.directory, 'result.json'), 'utf8')).status, 'completed');
    assert.match(displayed.text, /暂时无法读取/);
    assert.equal(warning.mock.callCount(), 1);
    assert.equal(warning.mock.calls[0].arguments[1], sharingViolation);

    blockedAppends = 0; blockedRead = false;
    await log.record({ type: 'item.completed', item: { type: 'agent_message', id: 'message', text: '已恢复写入' } });
    assert.match((await readTaskLog(root)).text, /已恢复写入/);
  } finally {
    appendMock.mock.restore();
    openMock.mock.restore();
    syncBuiltinESMExports();
  }
});
