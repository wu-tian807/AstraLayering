import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CodexAgents, type AgentTask } from '../../shared/codex/agents.ts';
import { findGroup, GroupStore, writeAtomic } from '../../shared/part/groups.ts';
import { drawGroupOutline, reviewGroupOutline } from '../../shared/part/outline-agent.ts';
import { fixture, seedInitialGroups, shape } from './layering-fixture.ts';
import { nodeExecutables } from './node-executables.ts';
import { fakeDebug } from '../../shared/tests/fake-codex.ts';
import { promptInput } from '../../shared/tests/prompt-input.ts';

const signal = new AbortController().signal;
// Repair turns rely on the drawing turn's input; without a thread the mock reads it from the recovery text.
const inputs = (task: AgentTask) => promptInput(task.prompt.includes('【本次输入】') ? task.prompt : task.recoveryPrompt!);
const tool = (task: AgentTask, name: string) => task.tools!.find(item => item.name === name)!;

async function noteFixture(t: TestContext, note: string) {
  const f = await fixture(t);
  await seedInitialGroups(f.directory, [
    { id: 'band', kind: 'group', name: 'band', note },
    { id: 'tail', kind: 'part', name: 'tail', note: '独立长幅', metadata: { preserved: true } },
  ]);
  const store = await GroupStore.open(f.directory);
  const candidate = join(f.directory, 'step09_outline/band/outline.svg');
  await writeAtomic(candidate, shape('band'));
  return { ...f, store, group: findGroup(store.snapshot(), 'band'), outline: { path: candidate },
    outputPath: candidate, reportPath: join(f.directory, 'step09_outline/band/review.json') };
}

test('note-only feedback is persisted and visible to the next reviewer without changing correct geometry', async t => {
  const before = '束带随腰运动。前结及长幅根部位于前带之前。保留隐藏搭接。';
  const replacement = '前结在前带之前，长幅根部在前带之后';
  const after = before.replace('前结及长幅根部位于前带之前', replacement);
  const f = await noteFixture(t, before), svg = await readFile(f.outline.path);
  const originalSibling = f.store.snapshot().groups[1];
  let reviews = 0, repairs = 0;
  const result = await reviewGroupOutline(f, { async run(task) {
    const input = inputs(task);
    assert.ok(!task.tools!.some(item => item.name === 'update_group_note'));
    assert.equal(input.group.note, reviews ? after : before);
    await tool(task, 'preview_svg').execute({ path: input.candidate, mode: 'blend' }, signal);
    await tool(task, 'submit_review').execute({ verdict: reviews++ ? 'pass' : 'revise',
      feedback: '只修正 note 的长幅根部层序；轮廓正确，保持不变。' }, signal);
    return { text: 'reviewed', images: [] };
  } }, { async run(task) {
    repairs++;
    await tool(task, 'update_group_note').execute({ oldText: '前结及长幅根部位于前带之前', newText: replacement }, signal);
    await tool(task, 'preview_svg').execute({ path: inputs(task).outputSvg, mode: 'blend' }, signal);
    return { text: 'note repaired', images: [] };
  } });
  assert.equal(result.status, 'completed');
  assert.equal(reviews, 2);
  assert.equal(repairs, 1);
  assert.equal(findGroup((await GroupStore.open(f.directory)).snapshot(), 'band').note, after);
  assert.deepEqual((await GroupStore.open(f.directory)).snapshot().groups[1], originalSibling);
  assert.deepEqual(await readFile(f.outline.path), svg);
});

test('note repair is bound to one group, requires a unique match and preserves concurrent updates', async t => {
  const f = await noteFixture(t, '重复；重复；原层序');
  await drawGroupOutline(f, { async run(task) {
    // Without the drawing thread, the recovery prompt restores the drawing task before the repair.
    assert.doesNotMatch(task.prompt, /对照纯衣服参考与本组 note|【本次输入】/);
    assert.ok(task.recoveryPrompt);
    const update = tool(task, 'update_group_note');
    await assert.rejects(update.execute({ oldText: '原层序', newText: '新层序', groupId: 'tail' }, signal), /仅提交/);
    await assert.rejects(update.execute({ oldText: '重复', newText: '新说明' }, signal), /唯一匹配/);
    await assert.rejects(update.execute({ oldText: '不存在', newText: '新说明' }, signal), /唯一匹配/);
    await assert.rejects(update.execute({ oldText: '原层序', newText: ' ' }, signal), /非空/);
    await f.store.update(document => { findGroup(document, 'tail').note = '另一组的并发更新'; });
    await update.execute({ oldText: '原层序', newText: '新层序' }, signal);
    assert.equal(findGroup(f.store.snapshot(), 'tail').note, '另一组的并发更新');
    await f.store.update(document => { findGroup(document, 'band').note = '本组已被其他调用更新'; });
    await assert.rejects(update.execute({ oldText: '新层序', newText: '覆盖修改' }, signal), /已变化/);
    assert.equal(findGroup(f.store.snapshot(), 'band').note, '本组已被其他调用更新');
    await tool(task, 'preview_svg').execute({ path: inputs(task).outputSvg, mode: 'blend' }, signal);
    return { text: 'checked', images: [] };
  } }, { candidate: f.outline.path, round: 1 });
  const saved = JSON.parse(await readFile(f.store.path, 'utf8'));
  assert.equal(saved.groups[0].note, '本组已被其他调用更新');
  assert.equal(saved.groups[1].note, '另一组的并发更新');
  assert.deepEqual(saved.groups.map((group: { id: string; kind: string }) => [group.id, group.kind]),
    [['band', 'group'], ['tail', 'part']]);
});

test('initial outline drawing can correct its own note without changing the group tree', async t => {
  const f = await noteFixture(t, '原说明');
  await drawGroupOutline(f, { async run(task) {
    await tool(task, 'update_group_note').execute({ oldText: '原说明', newText: '已核对的新说明' }, signal);
    await tool(task, 'write_outline_svg').execute({ svg: shape('band') }, signal);
    await tool(task, 'preview_svg').execute({ path: inputs(task).outputSvg, mode: 'blend' }, signal);
    return { text: 'drawn', images: [] };
  } });
  assert.equal(findGroup(f.store.snapshot(), 'band').note, '已核对的新说明');
});

test('initial drawing and repair reuse one actual app-server session with stable tool definitions', async t => {
  nodeExecutables(t);
  const f = await noteFixture(t, '原说明');
  const executable = join(f.directory, 'fake-app-server.mjs');
  const requests = join(f.directory, 'requests.jsonl');
  await writeFile(executable, `#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';
const send = value => process.stdout.write(JSON.stringify(value) + '\\n');
${fakeDebug()}
let turns = 0;
for await (const line of createInterface({ input: process.stdin })) {
  const message = JSON.parse(line);
  appendFileSync(${JSON.stringify(requests)}, JSON.stringify(message) + '\\n');
  if (message.method === 'initialize') send({ id: message.id, result: {} });
  if (message.method === 'thread/start') send({ id: message.id, result: { thread: { id: 'drawing-thread' } } });
  if (message.method === 'turn/start') {
    const turn = { id: 'turn-' + ++turns, status: 'inProgress' };
    send({ id: message.id, result: { turn } });
    send({ method: 'turn/completed', params: { threadId: 'drawing-thread', turn: { ...turn, status: 'completed' } } });
  }
}
`, 'utf8');
  await chmod(executable, 0o755);
  const session = new CodexAgents({ codexPathOverride: executable, cwd: f.directory }).createSession();
  t.after(() => session.close());
  const threads: (string | null | undefined)[] = [];
  const drawing = { async run(task: AgentTask) {
    const result = await session.run(task);
    threads.push(result.threadId);
    if (threads.length === 1) await tool(task, 'write_outline_svg').execute({ svg: shape('band') }, signal);
    else await tool(task, 'update_group_note').execute({ oldText: '原说明', newText: '修正说明' }, signal);
    await tool(task, 'preview_svg').execute({ path: inputs(task).outputSvg, mode: 'blend' }, signal);
    return result;
  } };
  await drawGroupOutline(f, drawing);
  await drawGroupOutline(f, drawing, { candidate: f.outline.path, round: 1 });
  assert.deepEqual(threads, ['drawing-thread', 'drawing-thread']);
  assert.equal(findGroup((await GroupStore.open(f.directory)).snapshot(), 'band').note, '修正说明');
  const messages = (await readFile(requests, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(messages.filter(message => message.method === 'thread/start').length, 1);
  const turns = messages.filter(message => message.method === 'turn/start').map(message => JSON.stringify(message.params.input));
  assert.equal(turns.length, 2);
  // The repair is the drawing thread's next turn: it points to the review file, not the drawing task or its input again.
  assert.match(turns[0], /对照纯衣服参考与本组 note[\s\S]*【本次输入】/);
  assert.doesNotMatch(turns[1], /对照纯衣服参考与本组 note|【本次输入】/);
  assert.match(turns[1], /review.json 中 reviews 最后一条（第 1 轮 review）/);
});
