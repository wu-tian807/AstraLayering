import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, realpath, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshot } from '../snapshot.ts';
import { acquireTaskLock, configureRun, saveRun } from '../../.agents/skills/live2d-maker/workflow/state.ts';
import { svgHash } from '../../.agents/skills/live2d-maker/shared/part/artifact-facts.ts';
import { groupSummary } from '../progress.js';

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10Z"/></svg>');
async function fixture(t: any, section = 'part-layering') {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'part-progress-'))), task = join(dir, 'test');
  await mkdir(task);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const put = async (path: string, value: any) => {
    const target = join(task, section, path); await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  };
  const get = async () => {
    const value = await snapshot(task, 'test', dir);
    return { ...value, part: value.sections.find(item => item.id === section)! };
  };
  // Step markers as the scheduler leaves them (see shared/step-chain.ts).
  const mark = (step: string, status: 'completed' | 'running' = 'completed') => put(`${step}/.${status}`, '');
  return { dir, task, put, get, mark };
}

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: sibling completion remains authoritative despite missing previews and review findings`, async t => {
  const f = await fixture(t, section);
  const groups = Array.from({ length: 12 }, (_, i) => ({ id: 'part_' + i, kind: 'part', groups: [] }));
  await f.put('groups.json', { groups });
  for (const [i, group] of groups.entries()) {
    await f.mark('step09_outline/' + group.id);
    if (i === 5) continue;
    await f.put('step09_outline/' + group.id + '/outline.svg', svg);
    await f.put('step09_outline/' + group.id + '/review.json', {
      groupId: group.id, reviews: [{ verdict: i === 10 ? 'revise' : 'pass', candidateHash: svgHash(svg), feedback: group.id, observations: [] }],
    });
  }
  const original = await readFile(join(f.task, section, 'groups.json'));
  const value = await f.get();
  assert.deepEqual(value.part.groups.map((node: any) => node.id), groups.map(group => group.id));
  for (const [i, node] of value.part.groups.entries()) {
    assert.equal(node.webPhases.outline, 'done', node.id);
    assert.equal(node.webPhases.review, 'done', node.id);
  }
  assert.equal(value.part.groups[5].webMessages.outline, '已完成');
  assert.equal(value.part.groups[10].webDetails.review, '需要返修');
  assert.deepEqual(await readFile(join(f.task, section, 'groups.json')), original);
});

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: drafts, publication, hash-matched reviews, reduction, completion and child analysis`, async t => {
  const f = await fixture(t, section);
  const group = { id: 'body', kind: 'group', groups: [] };
  await f.put('groups.json', { groups: [group] });
  const original = await readFile(join(f.task, section, 'groups.json'));
  await f.put('step09_outline/body/outline.draft.svg', svg);
  assert.equal((await f.get()).part.groups[0].webPhases.outline, 'pending', 'a draft in an unmarked step is a leftover the run deletes');
  await f.mark('step09_outline/body', 'running');
  let value = await f.get();
  assert.equal(value.part.groups[0].webPhases.outline, 'interrupted');
  assert.equal(value.part.groups[0].webMessages.outline, '已中断');
  assert.equal(value.part.groups[0].webHasProducts.outline, true);
  assert.match(value.part.groups[0].webDetails.outline, /草稿/);
  const version = value.fileVersions[section + '/step09_outline/body/outline.draft.svg'];
  await f.put('step09_outline/body/outline.draft.svg', svg + '\n');
  value = await f.get();
  assert.notEqual(value.fileVersions[section + '/step09_outline/body/outline.draft.svg'], version);
  assert.equal(value.part.groups[0].webPhases.outline, 'interrupted', 'an inactive draft is never running');
  await f.put('step09_outline/body/outline.svg', svg);
  await rm(join(f.task, section, 'step09_outline/body/outline.draft.svg'));
  assert.equal((await f.get()).part.groups[0].webPhases.outline, 'interrupted');
  const review = { verdict: 'pass', candidateHash: svgHash(svg), feedback: '通过', observations: [] };
  await f.put('step09_outline/body/review.json', { groupId: 'body', reviews: [{ ...review, candidateHash: 'stale' }] });
  assert.equal((await f.get()).part.groups[0].webPhases.review, 'interrupted');
  await f.put('step09_outline/body/review.json', { groupId: 'body', reviews: [review] });
  assert.equal((await f.get()).part.groups[0].webPhases.review, 'interrupted', 'a passed review counts once its step is completed');
  await f.mark('step09_outline/body');
  assert.equal((await f.get()).part.groups[0].webPhases.review, 'done');
  assert.deepEqual((await f.get()).part.groups[0].webReviewRounds.map((round: any) => [round.review.status, round.repair.status]),
    [['done', 'skipped'], ['skipped', 'skipped']]);
  await f.put('step09_outline/body/review.json', { groupId: 'body', reviews: [review, { ...review, verdict: 'revise', candidateHash: 'old', repairedCandidateHash: svgHash(svg) }] });
  assert.equal((await f.get()).part.groups[0].webMessages.review, '已完成');
  assert.match((await f.get()).part.groups[0].webDetails.review, /不再复审/);
  await f.put('step10_reduce/depth01/body.svg', svg);
  assert.equal((await f.get()).part.groups[0].webPhases.reduction, 'pending', 'an unmarked reduction is a leftover');
  await f.mark('step10_reduce/depth01', 'running');
  assert.equal((await f.get()).part.groups[0].webPhases.reduction, 'interrupted');
  await f.mark('step10_reduce/depth01');
  const completed = svg;
  await f.put('parts/body.svg', completed);
  await f.put('step11_completion/body/check.json', { groupId: 'body', passed: true });
  await f.mark('step11_completion/body');
  value = await f.get();
  assert.deepEqual(value.part.groups[0].webPhases, { outline: 'done', review: 'done', reduction: 'done', completion: 'done', completionCheck: 'done', children: 'pending' });
  assert.deepEqual(await readFile(join(f.task, section, 'groups.json')), original, 'display must not save restored steps');
  await f.put('groups.json', { groups: [{ ...group, groups: [{ id: 'body/torso', kind: 'part', groups: [] }] }] });
  await f.mark('step12_children/body');
  value = await f.get();
  assert.equal(value.part.groups[0].webPhases.children, 'done');
  assert.equal(value.part.groups[0].groups[0].webPhases.outline, 'pending');
  // Rerunning the step clears its completed marker: the old check is only a record.
  await rm(join(f.task, section, 'step11_completion/body/.completed'));
  await f.mark('step11_completion/body', 'running');
  assert.equal((await f.get()).part.groups[0].webPhases.completionCheck, 'interrupted');
});

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: completed nested parts show every phase from native artifact paths`, async t => {
  const f = await fixture(t, section), id = 'face/eye_left/iris';
  await f.put('groups.json', { groups: [{ id: 'face', groups: [{ id: 'face/eye_left', groups: [{ id, kind: 'part', groups: [] }] }] }] });
  const item = 'face/children/eye_left/children/iris';
  await f.put(`step09_outline/${item}/outline.svg`, svg);
  await f.put(`step09_outline/${item}/review.json`, { groupId: id, reviews: [
    { verdict: 'pass', candidateHash: svgHash(svg), feedback: '通过', observations: [] },
  ] });
  await f.put(`step10_reduce/depth03/${id}.svg`, svg);
  await f.put(`parts/${id}.svg`, svg);
  await f.put(`step11_completion/${item}/check.json`, { groupId: id, passed: true });
  for (const step of [`step09_outline/${item}`, 'step10_reduce/depth03', `step11_completion/${item}`, `step12_children/${item}`]) await f.mark(step);
  const value = await f.get(), node = value.part.groups[0].groups[0].groups[0];
  assert.deepEqual(node.webPhases, Object.fromEntries(['outline', 'review', 'reduction', 'completion', 'completionCheck', 'children'].map(phase => [phase, 'done'])));
  assert.equal(node.webReviewRounds[0].review.status, 'done');
  assert.ok(value.files.includes(`${section}/step09_outline/${item}/outline.svg`));
  assert.deepEqual(value.errors ?? [], []);
});

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: hidden outlines and reviews finish together once the skip step completes`, async t => {
  const f = await fixture(t, section);
  const group = { id: 'iris', kind: 'part', hiddenInReference: true, groups: [] };
  await f.put('groups.json', { groups: [group] });
  const original = await readFile(join(f.task, section, 'groups.json'));
  const hiddenSource = '<svg xmlns="http://www.w3.org/2000/svg" data-hidden-in-reference="true"><g data-group-path="iris"/></svg>';
  assert.equal((await f.get()).part.groups[0].webPhases.review, 'pending', 'the flag alone is not a completed skip');
  await f.mark('step09_outline/iris', 'running');
  await f.put('step09_outline/iris/outline.svg', hiddenSource);
  assert.equal((await f.get()).part.groups[0].webPhases.review, 'interrupted', 'an interrupted skip still needs its completed marker');
  await rm(join(f.task, section, 'step09_outline/iris/.running'));
  await f.mark('step09_outline/iris');
  let value = await f.get(), node = value.part.groups[0];
  assert.equal(node.webPhases.outline, 'done');
  assert.equal(node.webPhases.review, 'done');
  assert.match(node.webDetails.outline, /原图不可见.*已跳过/);
  assert.match(node.webDetails.review, /原图不可见.*已跳过/);
  assert.equal(node.webReviewSkip.skip, true);
  assert.equal(node.webReviewSkip.reason, node.webDetails.review);
  assert.deepEqual(node.webReviewRounds.map((round: any) => [round.review.status, round.repair.status]),
    [['skipped', 'skipped'], ['skipped', 'skipped']]);
  assert.ok(node.webReviewRounds.every((round: any) => round.review.reportIndex === undefined && round.repair.reportIndex === undefined));
  assert.equal(value.files.some(file => file.endsWith('/review.json')), false, 'skipped reviews have no invented report');
  await f.put('step10_reduce/depth01/iris.svg', hiddenSource);
  await f.put('parts/iris.svg', svg);
  await f.put('step11_completion/iris/check.json', { groupId: 'iris', passed: true });
  for (const step of ['step10_reduce/depth01', 'step11_completion/iris', 'step12_children/iris', 'step13_merge']) await f.mark(step);
  await f.put('preview.svg', svg);
  value = await f.get();
  assert.ok(Object.values(value.part.groups[0].webPhases).every(status => status === 'done'));
  assert.equal(value.part.states.layers, 'done');
  assert.equal(value.part.states.merge, 'done');
  assert.deepEqual(await readFile(join(f.task, section, 'groups.json')), original, 'display does not rewrite scheduler facts');
  await f.put('groups.json', { groups: [{ ...group, hiddenInReference: false }] });
  assert.equal((await f.get()).part.groups[0].webPhases.review, 'done', 'completion is independent of report contents');
  await f.put('groups.json', { groups: [group] });
  await rm(join(f.task, section, 'step09_outline/iris/outline.svg'));
  value = await f.get();
  assert.equal(value.part.groups[0].webPhases.outline, 'done');
  assert.equal(value.part.groups[0].webPhases.review, 'done', 'missing exports do not change completion');
});

test('parent-copied arms finish without review reports and show the completed tree icon', async t => {
  const f = await fixture(t), id = 'arms/arm_left', step = 'arms/children/arm_left';
  const group = { id, outlineFromParent: { x: 10, y: 10, width: 20, height: 30 }, groups: [] };
  await f.put('groups.json', { groups: [{ id: 'arms', groups: [group] }] });
  const original = await readFile(join(f.task, 'part-layering/groups.json'));
  const node = async () => (await f.get()).part.groups[0].groups[0];
  assert.equal((await node()).webPhases.review, 'pending');
  await f.put(`step09_outline/${step}/outline.svg`, svg);
  await f.mark(`step09_outline/${step}`, 'running');
  assert.equal((await node()).webPhases.review, 'interrupted', 'copy metadata and an in-flight SVG are insufficient');
  await rm(join(f.task, `part-layering/step09_outline/${step}/.running`));
  await f.mark(`step09_outline/${step}`);
  let value = await node();
  assert.equal(value.webPhases.review, 'done');
  assert.match(value.webDetails.review, /父组.*复制.*已跳过/);
  assert.equal(value.webReviewSkip.skip, true);
  assert.equal(value.webReviewSkip.reason, value.webDetails.review);
  assert.ok(value.webReviewRounds.every((round: any) => round.review.status === 'skipped' && round.repair.status === 'skipped'));
  assert.ok(value.webReviewRounds.every((round: any) => /父组.*复制/.test(round.review.detail)));
  assert.equal(groupSummary(value).status, 'pending', 'completion and child analysis still need to finish');
  await f.put(`step10_reduce/depth02/${id}.svg`, svg);
  await f.put(`parts/${id}.svg`, svg);
  await f.put(`step11_completion/${step}/check.json`, { groupId: id, passed: true });
  for (const path of ['step10_reduce/depth02', `step11_completion/${step}`, `step12_children/${step}`]) await f.mark(path);
  value = await node();
  assert.ok(Object.values(value.webPhases).every(status => status === 'done'));
  assert.equal(groupSummary(value).status, 'done');
  assert.deepEqual(await readFile(join(f.task, 'part-layering/groups.json')), original);
  assert.equal((await f.get()).files.some(file => file.endsWith('/review.json')), false);
  await rm(join(f.task, `part-layering/step09_outline/${step}/outline.svg`));
  value = await node();
  assert.equal(value.webPhases.outline, 'done');
  assert.equal(value.webPhases.review, 'done', 'missing previews do not invalidate completion');
});

test('both skip reasons use the same decision when old failed calls are present', async t => {
  const f = await fixture(t);
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'part-layering' }, f.task);
  run.status = 'failed'; run.activeSections = ['part-layering'];
  run.runner = { id: 'old-runner', pid: process.pid, startedAt: new Date(Date.now() - 1000).toISOString(), finishedAt: new Date().toISOString() };
  run.sections['part-layering']!.status = 'failed'; await saveRun(f.task, run);
  for (const flags of [{ hiddenInReference: true }, { outlineFromParent: { x: 0, y: 0, width: 10, height: 10 } }]) {
    await f.put('groups.json', { groups: [{ id: 'body', ...flags, groups: [] }] });
    await f.mark('step09_outline/body');
    await f.put('step09_outline/body/outline.svg', svg);
    for (const mode of ['组轮廓绘制', '组轮廓review']) {
      await f.put(`agents/${mode}/request.json`, { task: { name: mode + '-body' } });
      await f.put(`agents/${mode}/result.json`, { status: 'failed' });
    }
    const node = (await f.get()).part.groups[0];
    assert.equal(node.webReviewSkip.skip, true);
    assert.equal(node.webPhases.outline, 'done');
    assert.equal(node.webPhases.review, 'done');
    assert.ok(node.webReviewRounds.every((round: any) => round.review.status === 'skipped'));
  }
});

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: initial and depth requests show running without outputs, and candidates remain previewable`, async t => {
  const f = await fixture(t, section);
  const run = await configureRun({ name: 'test', dir: f.dir, from: section as any, to: section as any }, f.task);
  run.status = 'running'; run.activeSections = [section as any];
  run.runner = { id: 'test-runner', pid: process.pid, startedAt: new Date(Date.now() - 1000).toISOString() };
  run.sections[section as 'part-layering']!.status = 'running';
  await saveRun(f.task, run);
  const release = await acquireTaskLock(f.task); t.after(async () => { await release(); });
  await f.mark('step08_initial', 'running');
  await f.put('agents/initial/request.json', { task: { name: '首次分组识别' } });
  assert.equal((await f.get()).part.states.initial, 'running');
  await f.put('groups.json', { groups: [{ id: 'body', kind: 'part', groups: [] }] });
  await f.mark('step08_initial');
  assert.equal((await f.get()).part.states.initial, 'done', 'the completion marker takes precedence over a stale call');
  await f.put('agents/initial/result.json', { status: 'completed' });
  assert.equal((await f.get()).part.states.initial, 'done');
  await f.mark('step14_occlusion', 'running');
  await f.put('agents/depth/request.json', { task: { name: '最终遮挡层级规划' } });
  assert.equal((await f.get()).part.states.occlusion, 'running');
  await f.mark('step14_occlusion', 'running');
  await f.put('step14_occlusion/workspace/candidate.svg', svg);
  let value = await f.get();
  assert.equal(value.part.states.occlusion, 'running');
  assert.ok(value.files.includes(section + '/step14_occlusion/workspace/candidate.svg'));
  await f.put('agents/depth/result.json', { status: 'completed' });
  assert.equal((await f.get()).part.states.occlusion, 'running');
  await f.put('occlusion.json', { version: 3, direction: 'back-to-front', sourceHash: 'input',
    layers: [{ id: 'body', level: 0, note: 'body', check: { passed: true, note: 'checked' } }] });
  assert.equal((await f.get()).part.states.occlusion, 'running', 'the table counts once its step is completed');
  await f.mark('step14_occlusion');
  assert.equal((await f.get()).part.states.occlusion, 'done');
  await rm(join(f.task, section, 'occlusion.json'));
  run.runner.finishedAt = new Date().toISOString(); await saveRun(f.task, run);
  value = await f.get();
  assert.equal(value.part.states.occlusion, 'done', 'completed outcomes survive omitted previews');
  assert.equal(value.part.messages.occlusion, undefined);
});

test('preparation activity is visible before an image, and matching published references complete independently', async t => {
  const f = await fixture(t);
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'part-layering' }, f.task);
  run.status = 'running'; run.activeSections = ['part-layering'];
  run.runner = { id: 'test-runner', pid: process.pid, startedAt: new Date(Date.now() - 1000).toISOString() };
  await saveRun(f.task, run);
  const release = await acquireTaskLock(f.task); t.after(async () => { await release(); });
  for (const [step, phase] of [['part_pose_judgment', 'standard'], ['part_simplify', 'simplified'], ['part_base_subject', 'base']]) {
    await f.mark(({standard:'step04_standard', simplified:'step05_simplified', base:'step06_base'} as Record<string,string>)[phase], 'running');
    await f.put(`agents/${step}/request.json`, { task: { step, name: step } });
    const value = await f.get();
    assert.equal(value.part.states[phase], 'running'); assert.equal(value.part.states.preparation, 'running');
    await f.put(`agents/${step}/result.json`, { status: 'completed' });
  }
  for (const [step, name] of [['step04_standard', 'standard'], ['step05_simplified', 'simplified-subject'], ['step06_base', 'base-subject']]) {
    await f.put(`references/${name}.png`, svg);
    await f.mark(step);
  }
  let value = await f.get();
  assert.equal(value.part.states.preparation, 'done');
  assert.deepEqual(['standard', 'simplified', 'base'].map(phase => value.part.states[phase]), ['done', 'done', 'done']);
  // Without its marker the step is a leftover the next run deletes and redoes.
  await rm(join(f.task, 'part-layering/step06_base/.completed'));
  await rm(join(f.task, 'part-layering/step06_base/.running'));
  value = await f.get();
  assert.equal(value.part.states.base, 'pending'); assert.equal(value.part.states.preparation, 'pending');
});

test('人物参考以完成标记判定成功，缺少展示图不会改变执行状态', async t => {
  const f = await fixture(t);
  for (const [step, name] of [['step04_standard', 'standard'], ['step05_simplified', 'simplified-subject'], ['step06_base', 'base-subject']] as const) {
    await f.put(`references/${name}.png`, svg);
    await f.mark(step);
  }
  let value = await f.get();
  assert.equal(value.part.states.preparation, 'done');
  assert.deepEqual(['standard', 'simplified', 'base'].map(phase => value.part.states[phase]), ['done', 'done', 'done']);
  assert.equal(value.files.some(file => file.endsWith('/judgment.json')), false);
  await rm(join(f.task, 'part-layering/references/base-subject.png'));
  value = await f.get();
  assert.equal(value.part.states.base, 'done');
  assert.equal(value.part.messages.base, undefined);
  assert.equal(value.part.states.preparation, 'done');
});

test('a completed merge step is complete before the whole part section finishes', async t => {
  const f = await fixture(t), group = { id: 'body', kind: 'part', groups: [] };
  await f.put('groups.json', { groups: [group] });
  await f.put('step09_outline/body/outline.svg', svg);
  await f.put('step09_outline/body/review.json', { groupId: 'body', reviews: [{ verdict: 'pass', candidateHash: svgHash(svg), feedback: 'ok', observations: [] }] });
  await f.put('step10_reduce/depth01/body.svg', svg);
  await f.put('parts/body.svg', svg);
  await f.put('step11_completion/body/check.json', { groupId: 'body', passed: true });
  for (const step of ['step08_initial', 'step09_outline/body', 'step10_reduce/depth01', 'step11_completion/body', 'step12_children/body']) await f.mark(step);
  await f.put('preview.svg', svg);
  assert.equal((await f.get()).part.states.merge, 'pending', 'a merge output without its step marker is a leftover');
  await f.mark('step13_merge', 'running');
  assert.equal((await f.get()).part.states.merge, 'interrupted');
  await f.mark('step13_merge');
  assert.equal((await f.get()).part.states.merge, 'done');
  // Current step records store task-relative output keys; the view reads them against the task root.
  await f.put('step13_merge/.completed', { stamp: 'stamp', inputs: {}, outputs: { 'part-layering/preview.svg': svgHash(svg) }, paths: 'task' });
  const current = await f.get();
  assert.equal(current.part.states.merge, 'done');
  assert.deepEqual(current.errors ?? [], []);
  await rm(join(f.task, 'part-layering/step13_merge/.completed'));
  assert.equal((await f.get()).part.states.merge, 'interrupted');
});

test('running markers establish activity; calls refine phases and dead runners interrupt them', async t => {
  const f = await fixture(t);
  await f.put('groups.json', { groups: ['body', 'hair', 'neck'].map(id => ({ id, groups: [] })) });
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'part-layering' }, f.task);
  run.status = 'running'; run.activeSections = ['part-layering'];
  run.runner = { id: 'test-runner', pid: process.pid, startedAt: new Date(Date.now() - 1000).toISOString() };
  run.sections['part-layering']!.status = 'running';
  await saveRun(f.task, run);
  const release = await acquireTaskLock(f.task); t.after(async () => { await release(); });
  await f.put('agents/current/request.json', { task: { name: '组轮廓绘制-body' } });
  await f.put('agents/old/request.json', { task: { name: '组轮廓绘制-hair' } });
  await utimes(join(f.task, 'part-layering/agents/old/request.json'), 1, 1);
  await f.mark('step09_outline/body', 'running');
  await f.mark('step09_outline/hair', 'running');
  await f.put('step09_outline/hair/outline.draft.svg', svg);
  let value = await f.get();
  assert.deepEqual(value.part.groups.map(node => node.webPhases.outline), ['running', 'running', 'pending']);
  await f.put('step09_outline/body/outline.svg', svg);
  assert.equal((await f.get()).part.groups[0].webPhases.outline, 'running');
  await f.put('agents/current/result.json', { status: 'completed' });
  await f.put('agents/review/request.json', { task: { name: '组轮廓review-body' } });
  value = await f.get();
  assert.equal(value.part.groups[0].webPhases.outline, 'running');
  assert.equal(value.part.groups[0].webPhases.review, 'running');
  assert.equal(value.part.groups[0].webReviewRounds[0].review.status, 'running');
  run.runner.finishedAt = new Date().toISOString(); await saveRun(f.task, run);
  assert.equal((await f.get()).part.groups[0].webPhases.review, 'interrupted');
});

test('a call waiting to retry shows 限流等待 with the logged error verbatim until its wait ends, apart from running and pending', async t => {
  const f = await fixture(t);
  await f.put('groups.json', { groups: ['body', 'hair'].map(id => ({ id, groups: [] })) });
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'part-layering' }, f.task);
  run.status = 'running'; run.activeSections = ['part-layering'];
  run.runner = { id: 'test-runner', pid: process.pid, startedAt: new Date(Date.now() - 1000).toISOString() };
  run.sections['part-layering']!.status = 'running';
  await saveRun(f.task, run);
  const release = await acquireTaskLock(f.task); t.after(async () => { await release(); });
  await f.mark('step09_outline/body', 'running');
  await f.put('agents/body/request.json', { task: { name: '组轮廓绘制-body' } });
  await f.mark('step09_outline/hair', 'running');
  await f.put('agents/hair/request.json', { task: { name: '组轮廓绘制-hair' } });
  const wait = (ms: number) => f.put('agents/body/retry-wait.json', { reason: 'rate-limit', error: 'Rate limit exceeded: 429 Too Many Requests', until: new Date(Date.now() + ms).toISOString() });
  await wait(60_000);
  let value = await f.get();
  assert.deepEqual(value.part.groups.map(node => node.webPhases.outline), ['throttled', 'running']);
  assert.equal(value.part.groups[0].webMessages.outline, '限流等待');
  assert.equal(value.part.states.outline, 'running');
  await f.put('agents/hair/result.json', { status: 'completed' });
  assert.equal((await f.get()).part.states.outline, 'running', 'the other marked step is still running');
  await f.put('agents/review/request.json', { task: { name: '组轮廓review-hair' } });
  await f.put('agents/review/retry-wait.json', { reason: 'transient', error: 'stream disconnected before completion', until: new Date(Date.now() + 60_000).toISOString() });
  value = await f.get();
  assert.equal(value.part.groups[1].webPhases.review, 'throttled');
  assert.equal(value.part.groups[1].webReviewRounds[0].review.status, 'throttled');
  assert.equal(value.part.groups[1].webReviewRounds[0].review.detail, 'stream disconnected before completion');
  assert.equal(value.part.groups[0].webDetails.outline, 'Rate limit exceeded: 429 Too Many Requests');
  // The wait has passed: the next attempt is running.
  await wait(-1);
  assert.equal((await f.get()).part.groups[0].webPhases.outline, 'running');
  // The wait file is a server-side record; the page never receives it.
  assert.ok(!value.files.some(path => path.endsWith('retry-wait.json')));
});

test('a CLI attempt that failed and scheduled a retry stays 限流等待; a result after the wait ends the call', async t => {
  const f = await fixture(t);
  await f.put('groups.json', { groups: [{ id: 'body', groups: [] }] });
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'part-layering' }, f.task);
  run.status = 'running'; run.activeSections = ['part-layering'];
  run.runner = { id: 'test-runner', pid: process.pid, startedAt: new Date(Date.now() - 10_000).toISOString() };
  run.sections['part-layering']!.status = 'running';
  await saveRun(f.task, run);
  const release = await acquireTaskLock(f.task); t.after(async () => { await release(); });
  const at = (path: string, seconds: number) => utimes(join(f.task, 'part-layering', path), new Date(), new Date(Date.now() - seconds * 1000));
  // Claude and AGV CLI: each attempt has its own record, finished as failed before the retry wait is written.
  await f.mark('step09_outline/body', 'running');
  await f.put('agents/body/request.json', { task: { name: '组轮廓绘制-body' } });
  await f.put('agents/body/result.json', { status: 'failed' });
  await f.put('agents/body/retry-wait.json', { reason: 'rate-limit', error: 'API Error: 429 rate_limit_error', until: new Date(Date.now() + 60_000).toISOString() });
  await at('agents/body/result.json', 2); await at('agents/body/retry-wait.json', 1);
  let value = await f.get();
  assert.equal(value.part.groups[0].webPhases.outline, 'throttled');
  assert.equal(value.part.groups[0].webDetails.outline, 'API Error: 429 rate_limit_error');
  // Codex keeps one record across retries: its later result ends the call.
  await f.put('agents/body/result.json', { status: 'completed' });
  value = await f.get();
  assert.notEqual(value.part.groups[0].webPhases.outline, 'throttled');
  assert.equal(value.part.groups[0].webPhases.outline, 'running', 'the step remains running until its completion marker is written');
});

test('a failed current group and initial request are marked failed while their drafts remain visible; recovery clears old failures', async t => {
  const f = await fixture(t);
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'part-layering' }, f.task);
  run.status = 'failed'; run.activeSections = ['part-layering'];
  run.runner = { id: 'failed-runner', pid: process.pid, startedAt: new Date(Date.now() - 1000).toISOString(), finishedAt: new Date().toISOString() };
  run.sections['part-layering']!.status = 'failed'; await saveRun(f.task, run);
  await f.put('groups.json', { groups: [{ id: 'body', groups: [] }] });
  await f.mark('step08_initial');
  await f.mark('step09_outline/body', 'running');
  await f.put('step09_outline/body/outline.draft.svg', svg);
  await f.put('agents/draw/request.json', { task: { name: '组轮廓绘制-body' } });
  await f.put('agents/draw/result.json', { status: 'failed' });
  await f.put('agents/initial/request.json', { task: { step: 'part_initial_groups', name: '首次分组识别' } });
  await f.put('agents/initial/result.json', { status: 'failed' });
  let value = await f.get();
  assert.equal(value.part.groups[0].webPhases.outline, 'failed');
  assert.equal(value.part.states.initial, 'done', 'a stale failed call cannot reopen a completed step');
  assert.ok(value.files.includes('part-layering/step09_outline/body/outline.draft.svg'));
  run.status = 'running'; run.sections['part-layering']!.status = 'running';
  run.runner = { id: 'new-runner', pid: process.pid, startedAt: new Date().toISOString() }; await saveRun(f.task, run);
  const release = await acquireTaskLock(f.task); t.after(async () => { await release(); });
  value = await f.get();
  assert.equal(value.part.groups[0].webPhases.outline, 'running');
  assert.equal(value.part.states.initial, 'done');
});

test('unsafe group paths and symlinked drafts cannot expose outside files', async t => {
  const f = await fixture(t);
  await f.put('groups.json', { groups: [{ id: '../../../private', groups: [] }] });
  assert.match((await f.get()).errors.join(), /group id 无效/);
  await f.put('groups.json', { groups: [{ id: 'body', groups: [] }] });
  await mkdir(join(f.task, 'part-layering/step09_outline'), { recursive: true });
  await mkdir(join(f.dir, 'private'));
  await writeFile(join(f.dir, 'private/outline.svg'), svg);
  // A directory junction covers symlinked parents without requiring Windows'
  // file-symlink privilege (or enabling Developer Mode on the user's machine).
  await symlink(join(f.dir, 'private'), join(f.task, 'part-layering/step09_outline/body'), process.platform === 'win32' ? 'junction' : 'dir');
  const value = await f.get();
  assert.equal(value.part.groups[0].webPhases.outline, 'pending');
  assert.ok(!value.files.includes('part-layering/step09_outline/body/outline.svg'));
});

test('lanes skipped because the subject was not dressed show as skipped with their reason, not pending', async t => {
  const f = await fixture(t);
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'shadow' }, f.task);
  const summary = '素体换装沿用了简化参考，没有衣服需要拆分和绘制，跳过';
  for (const id of ['clothing-part-layering', 'clothing-raster-layering'] as const)
    run.sections[id] = { status: 'completed', skipped: true, updatedAt: new Date().toISOString(), summary };
  await saveRun(f.task, run);
  const { sections } = await f.get();
  for (const id of ['clothing-part-layering', 'clothing-raster-layering']) {
    const lane = sections.find(item => item.id === id)!;
    assert.equal(lane.status, 'skipped'); assert.equal(lane.skipped, true);
    assert.ok(Object.values(lane.states).every(state => state === 'skipped'), id);
  }
  assert.notEqual(sections.find(item => item.id === 'raster-layering')!.status, 'skipped');
});

test('a lane that failed shows as failed while the other lane runs on', async t => {
  const f = await fixture(t, 'clothing-raster-layering');
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'shadow' }, f.task);
  run.status = 'running'; run.activeSections = ['part-layering', 'clothing-raster-layering'];
  run.runner = { id: 'test-runner', pid: process.pid, startedAt: new Date(Date.now() - 1000).toISOString() };
  run.sections['part-layering']!.status = 'running';
  run.sections['clothing-raster-layering'] = { status: 'failed', updatedAt: new Date().toISOString(), summary: 'ENAMETOOLONG' };
  await saveRun(f.task, run);
  const release = await acquireTaskLock(f.task); t.after(async () => { await release(); });
  // The failed section never cleared its running marker.
  await f.mark('step01', 'running');
  const { sections } = await f.get();
  const lane = sections.find(item => item.id === 'clothing-raster-layering')!;
  assert.equal(lane.status, 'failed'); assert.equal(lane.states.step01, 'failed');
  assert.equal(sections.find(item => item.id === 'part-layering')!.status, 'running');
  // The step it left mid-way says why; a review it was on carries the reason instead of the draw step.
  assert.equal(lane.messages.step01, 'ENAMETOOLONG');
  await f.put('step01/report.md', 'drawn');
  const review = (await f.get()).sections.find(item => item.id === 'clothing-raster-layering')!;
  assert.equal(review.states['review-01'], 'failed');
  assert.deepEqual(review.messages, { 'review-01': 'ENAMETOOLONG' });
});

test('after a run fails, a step another lane left running is not shown as failed', async t => {
  const f = await fixture(t, 'clothing-raster-layering');
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'part-layering', to: 'shadow' }, f.task);
  run.status = 'failed'; run.activeSections = [];
  run.sections['clothing-raster-layering'] = { status: 'failed', updatedAt: new Date().toISOString(), summary: 'ENAMETOOLONG' };
  await saveRun(f.task, run);
  await f.mark('step01', 'running');
  await mkdir(join(f.task, 'raster-layering/step01'), { recursive: true });
  await writeFile(join(f.task, 'raster-layering/step01/.running'), '');
  const { sections } = await f.get();
  assert.equal(sections.find(item => item.id === 'clothing-raster-layering')!.states.step01, 'failed');
  // Stopped or interrupted, it continues on the next run.
  const interrupted = sections.find(item => item.id === 'raster-layering')!;
  assert.equal(interrupted.states.step01, 'interrupted');
  assert.notEqual(interrupted.status, 'failed');
  assert.ok(!Object.values(interrupted.messages).includes('ENAMETOOLONG'), 'another lane does not inherit the failure');
});
