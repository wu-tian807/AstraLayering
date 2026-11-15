import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { artifactPath, draftPath } from '../../shared/part/artifact-facts.ts';
import { groupStepId } from '../../shared/part/part-steps.ts';
import { partSteps } from '../../shared/step-paths.js';
import { readStep } from '../../shared/step-chain.ts';
import { sessionPath } from '../../shared/agents/step-session.ts';
import { acquireTaskLock } from '../state.ts';
import { applyStepAction, applyTaskAction, listSteps, validStepId } from '../step-actions.ts';

async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'step-actions-')), task = join(dir, 'case');
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(task);
  return { dir, task, act: (section: string, step: string, action: string) => applyStepAction({ name: 'case', dir, section, step, action }) };
}
async function put(path: string, value: string) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); }
const text = (path: string) => readFile(path, 'utf8');
const gone = (path: string) => assert.rejects(readFile(path), { code: 'ENOENT' }, path);
const completed = (outputs: Record<string, string>) => JSON.stringify({ stamp: 's', inputs: {}, outputs });

for (const section of ['part-layering', 'clothing-part-layering']) {
  test(`${section} enumerates nested steps without reading agent data or drawing workspaces`, async t => {
    const f = await fixture(t), root = join(f.task, section);
    const parent = groupStepId('body', 'completion'), child = groupStepId('body/arm/hand', 'completion');
    const reduce = 'step10_reduce/depth03';
    for (const id of [parent, child, reduce]) await put(join(root, id, '.running'), '');
    const ignored = [join(root, 'agents/attempt/cli-data'), join(root, parent, 'workspace')];
    for (const path of ignored) { await mkdir(path, { recursive: true }); await chmod(path, 0); }
    try {
      assert.deepEqual((await listSteps(root, section as any)).map(step => step.id),
        [reduce, parent, groupStepId('body/arm', 'completion'), child].sort());
    } finally {
      for (const path of ignored) await chmod(path, 0o700);
    }
  });
}

for (const section of ['part-layering', 'clothing-part-layering']) {
  test(`${section} 补全步骤：继续不动，恢复只清会话，重试删除本步产物与草稿且不碰别组`, async t => {
    const f = await fixture(t), root = join(f.task, section), step = join(root, groupStepId('head/eye', 'completion'));
    const part = artifactPath(root, 'head/eye', 'completion'), other = artifactPath(root, 'body', 'completion');
    await put(join(step, '.running'), JSON.stringify({ inputs: {} }));
    const session = sessionPath(root, groupStepId('head/eye', 'completion'));
    await put(session, JSON.stringify({ threadId: 'thread-1', harness: 'codex' }));
    await put(part, 'part'); await put(draftPath(part), 'draft'); await put(other, 'body');
    await put(join(root, groupStepId('body', 'completion'), '.completed'), completed({ '../../parts/body.svg': 'h' }));
    // A child group's step nests in its completed parent's directory.
    await put(join(root, groupStepId('head', 'completion'), '.completed'), completed({}));
    assert.deepEqual((await listSteps(root, section as any)).map(entry => [entry.id, entry.status, entry.session]),
      [[groupStepId('body', 'completion'), 'completed', false], [groupStepId('head', 'completion'), 'completed', false],
        [groupStepId('head/eye', 'completion'), 'running', true]]);

    assert.match(await f.act(section, groupStepId('head/eye', 'completion'), 'continue'), /继续/);
    assert.equal(JSON.parse(await text(session)).threadId, 'thread-1');

    assert.match(await f.act(section, groupStepId('head/eye', 'completion'), 'resume'), /thread-1/);
    await gone(session);
    assert.equal(JSON.parse(await text(session + '.history.jsonl')).threadId, 'thread-1');
    assert.equal(await text(part), 'part');
    assert.equal(await text(draftPath(part)), 'draft');
    assert.match(await f.act(section, groupStepId('head/eye', 'completion'), 'resume'), /恢复等同继续/);

    await f.act(section, groupStepId('head/eye', 'completion'), 'retry');
    assert.equal((await readStep(step)).status, 'absent');
    await gone(part); await gone(draftPath(part));
    assert.equal(await text(other), 'body');
    assert.equal((await readStep(join(root, groupStepId('body', 'completion')))).status, 'completed');
  });
}

test('任务级操作作用于全部中断或失败的步骤，已完成步骤不动', async t => {
  const f = await fixture(t), task = (action: string) => applyTaskAction({ name: 'case', dir: f.dir, action });
  const part = join(f.task, 'part-layering'), clothing = join(f.task, 'clothing-part-layering');
  const faceId = groupStepId('face', 'children'), shirtId = groupStepId('shirt', 'completion');
  const face = join(part, faceId), shirt = join(clothing, shirtId);
  const faceSession = sessionPath(part, faceId), shirtSession = sessionPath(clothing, shirtId);
  const done = join(part, groupStepId('body', 'completion')), shirtPart = artifactPath(clothing, 'shirt', 'completion');
  for (const [step, session] of [[face, faceSession], [shirt, shirtSession]]) {
    await put(join(step, '.running'), JSON.stringify({ inputs: {} }));
    await put(session, JSON.stringify({ threadId: 'thread-' + step.length }));
  }
  const doneSession = sessionPath(part, groupStepId('body', 'completion'));
  await put(join(done, '.completed'), completed({})); await put(doneSession, '{}');
  // Its deliveries are intact, so retry leaves it.
  await put(artifactPath(part, 'body', 'completion'), 'body'); await put(join(done, 'check.json'), '{}');
  await put(draftPath(shirtPart), 'draft');

  assert.match(await task('continue'), /step12_children\/face[\s\S]*step11_completion\/shirt/);
  assert.equal((await readStep(face)).status, 'running');
  await task('resume');
  await gone(faceSession); await gone(shirtSession);
  assert.equal(await text(doneSession), '{}');
  assert.equal(await text(draftPath(shirtPart)), 'draft');
  await task('retry');
  assert.equal((await readStep(face)).status, 'absent'); assert.equal((await readStep(shirt)).status, 'absent');
  await gone(draftPath(shirtPart));
  assert.equal((await readStep(done)).status, 'completed');
  await assert.rejects(task('resume'), /没有中断或失败的步骤/);
  assert.match(await task('continue'), /从未完成处续跑/);
});

test('任务级重试也重做已标记完成但缺少交付的步骤；继续与恢复不碰它们', async t => {
  const f = await fixture(t), task = (action: string) => applyTaskAction({ name: 'case', dir: f.dir, action });
  const raster = join(f.task, 'raster-layering'), part = join(f.task, 'part-layering');
  const intact = join(raster, 'step01'), lost = join(raster, 'step02'), merge = join(part, partSteps.merge);
  for (const step of [intact, lost]) await put(join(step, '.completed'), '');
  for (const file of ['character-depth.kra', 'report.md']) await put(join(intact, file), 'x');
  await put(join(lost, 'report.md'), 'x');
  await put(join(merge, '.completed'), '');
  const listed = Object.fromEntries((await listSteps(raster, 'raster-layering')).map(entry => [entry.id, entry.missing]));
  assert.equal(listed.step01, undefined);
  assert.ok(listed.step02?.length && listed.step02.every(path => path.startsWith('step02/')));
  assert.deepEqual((await listSteps(part, 'part-layering')).find(entry => entry.id === partSteps.merge)?.missing, ['preview.svg']);
  assert.match(await task('continue'), /从未完成处续跑/);
  await assert.rejects(task('resume'), /没有中断或失败的步骤/);
  assert.match(await task('retry'), /step02[\s\S]*step13_merge|step13_merge[\s\S]*step02/);
  assert.equal((await readStep(lost)).status, 'absent'); assert.equal((await readStep(merge)).status, 'absent');
  assert.equal((await readStep(intact)).status, 'completed');
});

test('part 合并与遮挡重试删除步骤外的产物；已完成步骤只能重试', async t => {
  const f = await fixture(t), root = join(f.task, 'part-layering');
  await put(join(root, partSteps.merge, '.completed'), completed({ '../preview.svg': 'h' }));
  await put(join(root, 'preview.svg'), 'preview'); await put(join(root, 'preview.draft.svg'), 'draft');
  await put(join(root, partSteps.occlusion, '.running'), JSON.stringify({ inputs: {} })); await put(join(root, 'occlusion.json'), '{}');
  await assert.rejects(f.act('part-layering', partSteps.merge, 'continue'), /已完成/);
  await assert.rejects(f.act('part-layering', partSteps.merge, 'resume'), /已完成/);
  await f.act('part-layering', partSteps.merge, 'retry');
  await gone(join(root, 'preview.svg')); await gone(join(root, 'preview.draft.svg'));
  await f.act('part-layering', partSteps.occlusion, 'retry');
  await gone(join(root, 'occlusion.json'));
  await assert.rejects(f.act('part-layering', 'step09_outline/../step08_initial', 'retry'), /没有步骤/);
  await assert.rejects(f.act('part-layering', partSteps.initial, 'retry'), /不存在/);
});

for (const section of ['raster-layering', 'clothing-raster-layering', 'character-assembly']) {
  test(`${section} 步骤：恢复清除本步骤会话并记录，重试只删除该步骤`, async t => {
    const f = await fixture(t), root = join(f.task, section);
    await put(sessionPath(root, 'step02'), JSON.stringify({ threadId: 'thread-r', harness: 'claude' }));
    await put(join(root, 'step01', '.completed'), 'legacy'); await put(join(root, 'step01', 'kept.kra'), 'kra');
    await put(join(root, 'step02', '.running'), JSON.stringify({ inputs: {} })); await put(join(root, 'step02', 'draft.kra'), 'draft');
    assert.deepEqual((await listSteps(root, section as any)).map(entry => entry.id), ['step01', 'step02']);
    await f.act(section, 'step02', 'resume');
    await gone(sessionPath(root, 'step02'));
    const history = JSON.parse(await text(sessionPath(root, 'step02') + '.history.jsonl'));
    assert.deepEqual({ ...history, replacedAt: undefined }, { threadId: 'thread-r', harness: 'claude', reason: '网页恢复：清除会话，保留产物', replacedAt: undefined });
    assert.equal(await text(join(root, 'step02', 'draft.kra')), 'draft');
    assert.match(await f.act(section, 'step02', 'resume'), /恢复等同继续/);
    await f.act(section, 'step02', 'retry');
    assert.equal((await readStep(join(root, 'step02'))).status, 'absent');
    assert.equal(await text(join(root, 'step01', 'kept.kra')), 'kra');
    await assert.rejects(f.act(section, 'merge', 'retry'), /没有步骤/);
  });
}

test('重试清除输出写在该步骤的 agent 尝试记录，其他步骤与无输出记录的保留', async t => {
  const f = await fixture(t), root = join(f.task, 'raster-layering'), agents = join(root, 'agents');
  await put(join(root, 'step01', '.running'), JSON.stringify({ inputs: {} }));
  await put(join(root, 'step02', '.running'), JSON.stringify({ inputs: {} }));
  const attempt = (name: string, request: unknown) => put(join(agents, name, 'request.json'), JSON.stringify(request));
  await attempt('t1-raster_step01-a', { outputDirectory: 'raster-layering/step01', task: { step: 'raster_step01' } });
  await attempt('t2-raster_step01_review-b', { task: { outputDirectory: join(root, 'step01', 'review') } });
  await attempt('t3-raster_step02-c', { outputDirectory: 'raster-layering/step02' });
  await attempt('t4-legacy-d', { task: {} });
  await put(join(agents, 't1-raster_step01-a', 'cli-data', 'x'), 'x');
  await put(join(agents, 'sessions.json'), JSON.stringify({
    s1: { harness: 'claude', data: 'raster-layering/agents/t1-raster_step01-a/cli-data', workspace: 'raster-layering/step01/workspace' },
    s2: { harness: 'claude', data: 'raster-layering/agents/t3-raster_step02-c/cli-data', workspace: 'raster-layering/step02/workspace' } }));
  assert.match(await f.act('raster-layering', 'step01', 'retry'), /2 次 agent 尝试记录/);
  await gone(join(agents, 't1-raster_step01-a', 'request.json'));
  await gone(join(agents, 't2-raster_step01_review-b', 'request.json'));
  assert.ok(await text(join(agents, 't3-raster_step02-c', 'request.json')));
  assert.ok(await text(join(agents, 't4-legacy-d', 'request.json')));
  assert.deepEqual(Object.keys(JSON.parse(await text(join(agents, 'sessions.json')))), ['s2']);
});

test('阴影重试只重置所选模式的 step01，另一模式不动', async t => {
  const f = await fixture(t), root = join(f.task, 'shadow');
  await put(join(root, 'step01_normal-depth', '.running'), JSON.stringify({ inputs: {} }));
  await put(join(root, 'step01_mask', '.running'), JSON.stringify({ inputs: {} }));
  assert.deepEqual((await listSteps(root, 'shadow')).map(entry => entry.id), ['step01_mask', 'step01_normal-depth']);
  await f.act('shadow', 'step01_normal-depth', 'retry');
  assert.equal((await readStep(join(root, 'step01_normal-depth'))).status, 'absent');
  assert.equal((await readStep(join(root, 'step01_mask'))).status, 'running');
});

test('空步骤 id 只能继续整条管线，保留工作区与步骤记录', async t => {
  const f = await fixture(t), root = join(f.task, 'part-layering');
  const step = join(root, groupStepId('face', 'outline'));
  await put(join(step, '.running'), JSON.stringify({ inputs: {} }));
  await put(join(step, 'workspace', 'draft.svg'), 'working draft');
  await assert.rejects(f.act('part-layering', '', 'retry'), /没有步骤/);
  assert.match(await f.act('part-layering', '', 'continue'), /保留全部产物/);
  assert.equal((await readStep(step)).status, 'running');
  assert.equal(await text(join(step, 'workspace', 'draft.svg')), 'working draft');
});

test('运行中的任务持有锁时拒绝步骤操作', async t => {
  const f = await fixture(t), root = join(f.task, 'raster-layering');
  await put(join(root, 'step01', '.running'), JSON.stringify({ inputs: {} }));
  const release = await acquireTaskLock(f.task);
  try { await assert.rejects(f.act('raster-layering', 'step01', 'retry')); }
  finally { await release(); }
  assert.equal((await readStep(join(root, 'step01'))).status, 'running');
  await assert.rejects(f.act('raster-layering', 'step01', 'redo'), /未知操作/);
});

test('步骤 id 只接受管线自己的步骤目录', () => {
  assert.ok(validStepId('part-layering', 'step12_children/head/children/eye'));
  assert.ok(validStepId('part-layering', 'step05_simplified'));
  assert.ok(validStepId('clothing-part-layering', 'step10_reduce/depth02'));
  assert.ok(validStepId('shadow', 'step01_mask'));
  assert.ok(!validStepId('part-layering', 'step11_completion'));
  assert.ok(!validStepId('part-layering', 'step11_completion/head/eye'));
  assert.ok(!validStepId('part-layering', 'step13_merge/head'));
  assert.ok(!validStepId('raster-layering', 'step09_outline/head'));
  assert.ok(!validStepId('part-layering', 'step09_outline/../step08_initial'));
});
