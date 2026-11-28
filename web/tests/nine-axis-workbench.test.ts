import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { nineAxisProgress } from '../nine-axis-progress.ts';
import { inventory } from '../files.ts';
import { snapshot } from '../snapshot.ts';
import { sectionSteps, stepArtifacts } from '../progress.js';
import { nineAxisSteps, nineAxisGroupSteps, nineAxisPitchSteps, nineAxisArtifacts } from '../../.agents/skills/live2d-maker/shared/nine-axis.ts';
import { evaluatePoints, validateHeadNineAxis, nineAxisCapabilities, keyformAt } from '../../.agents/skills/live2d-maker/shared/nine-axis-model.js';
import { saveNineAxis } from '../nine-axis-save.ts';
import { lstat } from 'node:fs/promises';
import { applyStepAction, applyTaskAction } from '../../.agents/skills/live2d-maker/workflow/step-actions.ts';
import { readStepSession, writeStepSession } from '../../.agents/skills/live2d-maker/shared/agents/step-session.ts';
import { stepDeliveries } from '../../.agents/skills/live2d-maker/shared/step-deliveries.ts';
import { hairRounds, hairRoundLabel } from '../../.agents/skills/live2d-maker/nine-axis/hair-progress.ts';
import { headSideLimit } from '../head-motion.js';

async function fixture(t: any) {
  const root = await mkdtemp(join(tmpdir(), 'nine-workbench-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, value: unknown = '') => {
    const file = join(root, 'nine-axis', path); await mkdir(dirname(file), { recursive: true });
    await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const errors: string[] = [];
  const get = async (observation = {}) => nineAxisProgress(root, new Set(await inventory(root)), errors, observation);
  const complete = async (id: string) => {
    for (const file of await stepDeliveries(join(root, 'nine-axis'), 'nine-axis', id)) {
      await mkdir(dirname(file), { recursive: true });
      try { await readFile(file); } catch { await writeFile(file, '{}'); }
    }
    await put(id + '/.completed');
  };
  return { root, put, get, errors, complete };
}

test('web presents every current workflow step and keeps hair rounds inside one executable step', () => {
  assert.deepEqual(nineAxisSteps, ['step01_preparation','step02_video','step03_frames','step04_angles','step05_frames','step06_angle-xy','step07_jaw-line','step08_hair','step09_head-accessories','step10_head-pitch','step11_head-angle-xy','step12_head-roll']);
  const steps = sectionSteps[6]; assert.deepEqual(steps.map(step => step.id), nineAxisSteps);
  assert.equal(steps[3].childrenMode, 'parallel');
  assert.deepEqual(steps[3].children.map(step => step.id), ['step04_angles/model','step04_angles/video']);
  assert.deepEqual(steps[3].children[0].children.map(step => step.id), nineAxisGroupSteps);
  for (const id of nineAxisGroupSteps) assert.ok(stepArtifacts[6][id].some(item => item.path === `nine-axis/${id}/deformers.json`));
  assert.deepEqual(steps[7].children,[]);
  assert.deepEqual(steps[7].rounds?.map(round => [round.id, round.title]), hairRounds.map(round => [round, hairRoundLabel(round)]));
  assert.equal(steps[9].childrenMode,'parallel');assert.deepEqual(steps[9].children.map(step=>step.id),nineAxisPitchSteps);
  assert.equal(steps[9].rounds,undefined);
  assert.deepEqual(steps[10].children, []); assert.equal(steps[10].rounds, undefined);
  for (const name of ['head-xy.json', 'deformers.json', 'notes.md'])
    assert.ok(stepArtifacts[6]['step11_head-angle-xy'].some(item => item.path === `nine-axis/step11_head-angle-xy/${name}`));
  for (const id of ['step08_hair', 'step09_head-accessories']) {
    for (const name of ['deformers.json', 'character-nine-axis.kra', 'notes.md']) assert.ok(stepArtifacts[6][id].some(item => item.path === `nine-axis/${id}/${name}`));
  }
});

test('head-pitch shows independent parallel children without completing the unmerged parent',async t=>{
  const f=await fixture(t);await f.put('step10_head-pitch/.running');await f.complete('step10_head-pitch/up');
  await f.put('step10_head-pitch/down/.running');
  let value=await f.get();
  assert.equal(value.states['step10_head-pitch/up'],'done');assert.notEqual(value.states['step10_head-pitch'],'done');
  await f.complete('step10_head-pitch/down');value=await f.get();
  assert.notEqual(value.states['step10_head-pitch'],'done');
  await f.complete('step10_head-pitch');value=await f.get();assert.equal(value.states['step10_head-pitch'],'done');
});

test('whole-head corners expose one step session, current KRA preview and an independent completion marker', async t => {
  const f = await fixture(t), step = 'step11_head-angle-xy';
  await f.complete('step10_head-pitch'); await f.put(step + '/.running');
  const document = 'nine-axis/step09_head-accessories/character-nine-axis.kra';
  await f.put('step09_head-accessories/character-nine-axis.kra', 'saved KRA');
  await f.put(step + '/deformers.json', { source: { document } });
  for (const direction of ['up', 'down'])
    await writeStepSession(join(f.root, 'nine-axis'), `step10_head-pitch/${direction}`, { threadId: direction + '-thread', harness: 'codex' });
  await writeStepSession(join(f.root, 'nine-axis'), step, { threadId: 'four-corner-thread', harness: 'codex' });
  let value = await f.get();
  assert.equal(value.states['step10_head-pitch'], 'done'); assert.equal(value.states[step], 'interrupted');
  assert.equal(value.steps.find(entry => entry.id === step)!.threadId, 'four-corner-thread');
  assert.equal(value.threadId, 'four-corner-thread');
  assert.equal(value.previews[step].path, document);
  await f.complete(step); value = await f.get(); assert.equal(value.states[step], 'done');
  assert.deepEqual(f.errors, []);
});

test('hair round activity follows the current call without assigning the previous round to the next', async t => {
  const f = await fixture(t), since = new Date(Date.now() - 1000).toISOString();
  await f.put('step08_hair/.running');
  await f.put('step08_hair/hair-progress.json', { version: 2, completed: ['front'], next: 'side' });
  await f.put('agents/00-front/request.json', { task: { name: '前发左右制作', outputDirectory: 'nine-axis/step08_hair' } });
  await f.put('agents/00-front/result.json', { status: 'completed' });
  let value = await f.get({ since });
  assert.deepEqual(value.hair, { rounds: { front: 'done', side: 'pending', back: 'pending', remaining: 'pending' }, next: 'side', awaitingContinue: true });
  assert.equal(value.states.step08_hair, 'interrupted');
  await f.put('agents/01-side/request.json', { task: { name: '侧发左右制作', outputDirectory: join(f.root, 'nine-axis/step08_hair') } });
  value = await f.get({ active: true, since });
  assert.equal(value.hair!.rounds.side, 'running'); assert.equal(value.hair!.awaitingContinue, false);
  await f.put('agents/01-side/retry-wait.json', { until: new Date(Date.now() + 60000).toISOString(), error: '429 side only' });
  value = await f.get({ active: true, since });
  assert.equal(value.hair!.rounds.side, 'throttled');
  assert.equal(value.messages.step08_hair, '429 side only');
  await rm(join(f.root, 'nine-axis/agents/01-side/retry-wait.json'));
  await f.put('agents/01-side/result.json', { status: 'failed' });
  value = await f.get({ failed: true, since, reason: 'delivery missing' });
  assert.deepEqual(value.hair!.rounds, { front: 'done', side: 'failed', back: 'pending', remaining: 'pending' });
  assert.equal(value.states['step09_head-accessories'], 'pending');
  assert.deepEqual(f.errors, []);
});

test('the first active hair round is visible before the first progress file is saved', async t => {
  const f = await fixture(t), since = new Date(Date.now() - 1000).toISOString();
  await f.put('step08_hair/.running');
  await f.put('agents/front/request.json', { task: { name: '前发左右制作', outputDirectory: 'nine-axis/step08_hair' } });
  const value = await f.get({ active: true, since });
  assert.deepEqual(value.hair!.rounds, { front: 'running', side: 'pending', back: 'pending', remaining: 'pending' });
  await assert.rejects(readFile(join(f.root, 'nine-axis/step08_hair/hair-progress.json')), { code: 'ENOENT' });
  assert.deepEqual(f.errors, []);
});

test('viewing an unsupported hair progress record leaves its files intact', async t => {
  const f = await fixture(t), progress = { version: 1, completed: ['front', 'side', 'back'], next: 'done' };
  await f.put('step08_hair/hair-progress.json', progress); await f.put('step08_hair/.completed');
  const value = await f.get();
  assert.equal(value.states.step08_hair, 'done', 'the snapshot does not replace completion markers');
  assert.equal(value.hair, undefined);
  assert.deepEqual(JSON.parse(await readFile(join(f.root, 'nine-axis/step08_hair/hair-progress.json'), 'utf8')), progress);
  await readFile(join(f.root, 'nine-axis/step08_hair/.completed'));
  await assert.rejects(readFile(join(f.root, 'nine-axis/step08_hair/.running')), { code: 'ENOENT' });
  assert.match(f.errors[0], /version:2/);
});

test('round records and saved products never complete a step or its downstream accessories', async t => {
  const f = await fixture(t);
  await f.put('step08_hair/.running');
  await f.put('step08_hair/deformers.json', {});
  await f.put('step08_hair/hair-progress.json', { version: 2, completed: [...hairRounds], next: 'done' });
  let value = await f.get();
  assert.equal(value.states.step08_hair, 'interrupted');
  assert.equal(value.products.step08_hair, true);
  assert.deepEqual(Object.values(value.hair!.rounds), Array(4).fill('done'));
  assert.equal(value.states['step09_head-accessories'], 'pending');
  await f.put('step08_hair/.completed');
  await f.put('step08_hair/hair-progress.json', '{unfinished');
  value = await f.get();
  assert.equal(value.states.step08_hair, 'done'); assert.equal(value.hair, undefined);
  assert.match(f.errors.at(-1)!, /hair-progress\.json/);
});

test('hair status uses the saved set and order of configured rounds', async t => {
  const f = await fixture(t);
  await f.put('step08_hair/.running');
  const order = ['front', 'back', 'side'];
  await f.put('step08_hair/hair-progress.json', { version: 2, completed: ['front'], next: 'back',
    rounds: order.map(id => ({ id, prompts: [`prompts/${id}.md`] })) });
  const value = await f.get();
  assert.deepEqual(Object.keys(value.hair!.rounds), order);
  assert.equal(value.hair!.next, 'back');
  assert.equal(value.hair!.rounds.front, 'done');
  assert.equal(value.hair!.rounds.remaining, undefined);
});

test('hair and accessories preview the KRA bound by their cumulative model instead of a stale PNG', async t => {
  const f = await fixture(t);
  for (const id of ['step08_hair', 'step09_head-accessories']) {
    const document = `nine-axis/${id}/character-nine-axis.kra`;
    await f.put(`${id}/character-nine-axis.kra`, 'saved KRA');
    await f.put(`${id}/character-nine-axis.png`, 'stale PNG');
    await f.put(`${id}/deformers.json`, { source: { document } });
    await f.put(`${id}/notes.md`, 'Saved stage notes');
    const value = await f.get();
    assert.equal(value.previews[id].path, document);
    assert.equal(value.reports[id].path, `nine-axis/${id}/notes.md`);
    assert.equal(value.states[id], 'pending', 'a saved preview does not imply execution');
  }
  assert.deepEqual(f.errors, []);
});

test('independent waits and failures never mark running or completed siblings throttled', async t => {
  const f = await fixture(t), since = new Date(Date.now() - 1000).toISOString();
  await f.put('step04_angles/model/.running');
  await f.put('step04_angles/model/left/.completed'); await f.put('step04_angles/model/left/deformers.json', '{}');
  await f.complete('step04_angles/model/left');
  for (const group of ['up', 'down']) {
    await f.put(`step04_angles/model/${group}/.running`);
    await f.put(`agents/${group}/request.json`, { task: { step: 'nine_axis_head', name: `单轴 ${group}`,
      outputDirectory: group === 'up' ? join(f.root, 'nine-axis/step04_angles/model/up') : 'nine-axis/step04_angles/model/down' } });
  }
  await f.put('agents/up/retry-wait.json', { until: new Date(Date.now() + 60000).toISOString(), error: '429 up only' });
  let value = await f.get({ active: true, since });
  assert.deepEqual(nineAxisGroupSteps.map(id => value.states[id]), ['done', 'throttled', 'running']);
  assert.equal(value.states['step04_angles/model'], 'throttled');
  assert.equal(value.messages['step04_angles/model/up'], '429 up only'); assert.equal(value.messages['step04_angles/model/down'], undefined);
  await f.put('agents/down/result.json', { status: 'failed' });
  value = await f.get({ active: true, since });
  assert.deepEqual(nineAxisGroupSteps.map(id => value.states[id]), ['done', 'throttled', 'failed']);
  assert.equal(value.status, 'throttled');
  assert.deepEqual(f.errors, []);
});

test('a running axis with saved output and no current call is shown as available', async t => {
  const f = await fixture(t), since = new Date(Date.now() - 1000).toISOString();
  await f.put('step04_angles/model/.running');
  await f.put('step04_angles/model/left/.running');
  await f.put('step04_angles/model/left/deformers.json', '{}');
  await f.put('step04_angles/model/up/.running');
  await f.put('step04_angles/model/up/deformers.json', '{}');
  await f.put('agents/up/request.json', { task: { step: 'nine_axis_head', name: '单轴 up', outputDirectory: 'nine-axis/step04_angles/model/up' } });
  const value = await f.get({ active: true, since });
  assert.deepEqual(nineAxisGroupSteps.map(id => value.states[id]), ['available', 'running', 'pending']);
  assert.equal(value.products['step04_angles/model/left'], true);
  assert.deepEqual(f.errors, []);
});

test('a model merge call remains active when a child only has saved output', async t => {
  const f = await fixture(t), since = new Date(Date.now() - 1000).toISOString();
  const parent = 'step04_angles/model', child = nineAxisGroupSteps[0];
  await f.put(`${parent}/.running`);
  await f.put(`${child}/.running`); await f.put(`${child}/deformers.json`, '{}');
  await f.put('agents/merge/request.json', { task: { name: '模型合并', outputDirectory: `nine-axis/${parent}` } });
  let value = await f.get({ active: true, since });
  assert.equal(value.states[parent], 'running');
  assert.equal(value.states[child], 'available');
  await f.put('agents/merge/retry-wait.json', { until: new Date(Date.now() + 60000).toISOString(), error: '429 merge' });
  value = await f.get({ active: true, since });
  assert.equal(value.states[parent], 'throttled');
  assert.equal(value.states[child], 'available');
  assert.deepEqual(f.errors, []);
});

test('child retry marker layout keeps completed siblings; retained XY keeps its own completed result', async t => {
  const f = await fixture(t);
  for (const id of [...nineAxisGroupSteps, 'step04_angles/model', 'step06_angle-xy']) {
    await f.put(`${id}/.completed`); await f.put(`${id}/deformers.json`, '{}');
    await f.complete(id);
  }
  assert.equal((await f.get()).states['step04_angles/model'], 'done');
  // This is the layout the workflow retry must leave, under its task lock.
  await rm(join(f.root, 'nine-axis/step04_angles/model/up'), { recursive: true });
  await rm(join(f.root, 'nine-axis/step04_angles/model/.completed'));
  await f.put('step04_angles/model/.running');
  const before = await readFile(join(f.root, 'nine-axis/step04_angles/model/down/deformers.json'));
  let value = await f.get();
  assert.equal(value.states['step04_angles/model'], 'interrupted'); assert.equal(value.states['step04_angles/model/left'], 'done');
  assert.equal(value.states['step04_angles/model/down'], 'done'); assert.equal(value.states['step04_angles/model/up'], 'pending');
  assert.equal(value.states['step06_angle-xy'], 'done');
  assert.equal(value.messages['step06_angle-xy'], undefined);
  assert.deepEqual(await readFile(join(f.root, 'nine-axis/step04_angles/model/down/deformers.json')), before);
  await f.put('step04_angles/model/up/.completed'); await f.put('step04_angles/model/up/deformers.json', '{}');
  await f.complete('step04_angles/model/up');
  assert.equal((await f.get()).states['step04_angles/model'], 'interrupted', 'finished children still wait for the parent merge');
  await rm(join(f.root, 'nine-axis/step04_angles/model/.running')); await f.put('step04_angles/model/.completed');
  value = await f.get(); assert.equal(value.states['step04_angles/model'], 'done'); assert.equal(value.states['step06_angle-xy'], 'done');
});

test('completion markers remain authoritative when intermediate deliveries are missing', async t => {
  const f = await fixture(t);
  for (const id of [...nineAxisGroupSteps, 'step04_angles/model']) await f.complete(id);
  await rm(join(f.root, 'nine-axis/step04_angles/model/up/deformers.json'));
  const value = await f.get();
  assert.equal(value.states['step04_angles/model'], 'done');
  assert.equal(value.states['step04_angles/model/up'], 'done');
  assert.deepEqual(value.messages, {});
  const result = await snapshot(f.root, 'case', dirname(f.root));
  assert.deepEqual(result.sections.find(section => section.id === 'nine-axis')!.steps.map(step => step.id), ['step04_angles', 'step04_angles/model', ...nineAxisGroupSteps]);
});

test('native child continue preserves its thread, resume keeps authors, retry reopens only its parent merge', async t => {
  const f = await fixture(t), root = join(f.root, 'nine-axis');
  await f.put('step04_angles/model/.completed'); await f.put('step04_angles/model/deformers.json', 'old merged');
  for (const group of ['left', 'up', 'down']) {
    await f.put(`step04_angles/model/${group}/.${group === 'up' ? 'running' : 'completed'}`);
    await f.put(`step04_angles/model/${group}/deformers.json`, `author ${group}`);
    await writeStepSession(root, `step04_angles/model/${group}`, { threadId: `thread-${group}` });
  }
  const act = (action: string) => applyStepAction({ name: basename(f.root), dir: dirname(f.root), section: 'nine-axis', step: 'step04_angles/model/up', action });
  await act('continue');
  assert.equal((await readStepSession(root, 'step04_angles/model/up'))!.threadId, 'thread-up');
  assert.equal(await readFile(join(root, 'step04_angles/model/up/deformers.json'), 'utf8'), 'author up');
  const progress = await f.get();
  assert.deepEqual(nineAxisGroupSteps.map(id => progress.steps.find(step => step.id === id)!.threadId), ['thread-left', 'thread-up', 'thread-down']);
  await act('resume');
  assert.equal(await readStepSession(root, 'step04_angles/model/up'), undefined);
  assert.equal(await readFile(join(root, 'step04_angles/model/up/deformers.json'), 'utf8'), 'author up');
  await writeStepSession(root, 'step04_angles/model/up', { threadId: 'new-up-thread' });
  await act('retry');
  await assert.rejects(readFile(join(root, 'step04_angles/model/up/deformers.json')), { code: 'ENOENT' });
  assert.equal(await readStepSession(root, 'step04_angles/model/up'), undefined);
  await assert.rejects(readFile(join(root, 'step04_angles/model/.completed')), { code: 'ENOENT' });
  assert.equal(await readFile(join(root, 'step04_angles/model/.running'), 'utf8'), '');
  for (const group of ['left', 'down']) {
    assert.equal(await readFile(join(root, `step04_angles/model/${group}/deformers.json`), 'utf8'), `author ${group}`);
    assert.equal((await readStepSession(root, `step04_angles/model/${group}`))!.threadId, `thread-${group}`);
    await readFile(join(root, `step04_angles/model/${group}/.completed`));
  }
});

test('taskwide retry of a nested group never deletes its parent subtree or completed siblings', async t => {
  const f = await fixture(t), root = join(f.root, 'nine-axis');
  await f.put('step04_angles/model/.running');
  await f.put('step01_preparation/deformers.json', 'neutral');
  for (const group of ['left', 'up', 'down']) {
    await f.put(`step04_angles/model/${group}/.${group === 'up' ? 'running' : 'completed'}`);
    await f.put(`step04_angles/model/${group}/deformers.json`, group);
    if (group === 'left' || group === 'down') await f.complete(`step04_angles/model/${group}`);
  }
  await applyTaskAction({ name: basename(f.root), dir: dirname(f.root), action: 'retry' });
  assert.equal(await readFile(join(root, 'step01_preparation/deformers.json'), 'utf8'), 'neutral');
  for (const group of ['left', 'down']) assert.equal(await readFile(join(root, `step04_angles/model/${group}/deformers.json`), 'utf8'), group);
  await assert.rejects(readFile(join(root, 'step04_angles/model/up/deformers.json')), { code: 'ENOENT' });
  await readFile(join(root, 'step04_angles/model/.running'));
});

const rest = [[0, 0], [10, 0], [0, 10], [10, 10]];
function composed(): any {
  const root: any = { version: 2, kind: 'head-nine-axis', levels: [{ id: 'face', includes: ['face'] }], deformers: [],
    parameters: [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [-25, 0, 25] }],
    parts: [{ id: 'face', level: 'face', texture: 'layers/face.png', textureBounds: [0, 0, 10, 10], bbox: [0, 0, 10, 10], cols: 1, rows: 1,
      keyforms: Object.fromEntries([-30, 0, 30].map(key => [key, structuredClone(rest)])),
      keyformsY: Object.fromEntries([-25, 0, 25].map(key => [key, structuredClone(rest)])),
      keyformsXY: Object.fromEntries([-30, 30].flatMap(x => [-25, 25].map(y => [`${x},${y}`, structuredClone(rest)]))) }] };
  root.axisSources = ['x', 'up', 'down'].map(axis => {
    const doc = structuredClone(root), part = doc.parts[0]; delete part.keyformsXY;
    const keys = axis === 'x' ? [-30, 0, 30] : [0];
    part.keyforms = Object.fromEntries(keys.map(key => [key, rest.map(([x, y]) => [x + key / 15, y])]));
    if (axis === 'x') delete part.keyformsY;
    else part.keyformsY = { [axis === 'up' ? 25 : -25]: rest.map(([x, y]) => [x, y + (axis === 'up' ? -2 : 3)]) };
    doc.parameters = [{ id: 'ParamAngleX', keys }, { id: 'ParamAngleY', keys: axis === 'x' ? [0] : [0, axis === 'up' ? 25 : -25] }];
    return { axis, sha256: 'a'.repeat(64), doc };
  });
  return validateHeadNineAxis(root);
}

async function panelModule() {
  // Browser-relative imports are served from shared/. Resolve them to those
  // same modules for Node, retaining the actual model and renderer functions.
  const source = (await readFile(new URL('../studio/nine-axis-panel.js', import.meta.url), 'utf8'))
    .replace("'./nine-axis-model.js'", JSON.stringify(new URL('../../.agents/skills/live2d-maker/shared/nine-axis-model.js', import.meta.url).href))
    .replace("'./nine-axis-preview.js'", JSON.stringify(new URL('../../.agents/skills/live2d-maker/shared/nine-axis-preview.js', import.meta.url).href))
    .replace("'../head-motion.js'", JSON.stringify(new URL('../head-motion.js', import.meta.url).href))
    .replace("'./layer-model.js'", JSON.stringify(new URL('../studio/layer-model.js', import.meta.url).href))
    .replace("'./nine-axis-render.js'", JSON.stringify(new URL('../../.agents/skills/live2d-maker/shared/nine-axis-render.js', import.meta.url).href));
  return import('data:text/javascript,' + encodeURIComponent(source));
}

test('workbench angle inputs exclude side lobes while preserving all main poses and available axes', async () => {
  const { projectNineAxisAngles } = await panelModule(), axes = nineAxisCapabilities(composed());
  for (const x of [-30, 0, 30]) for (const y of [-25, 0, 25]) {
    assert.deepEqual(projectNineAxisAngles(axes, x, y), { x, y });
  }
  for (const side of [-1, 1]) for (const pitch of [-1, 1]) {
    assert.deepEqual(projectNineAxisAngles(axes, side * 30, pitch * 12.5), { x: side * 15, y: pitch * 12.5 });
  }
  const asymmetric = { ...axes, x: { min: -20, max: 40 }, y: { min: -10, max: 30 } };
  assert.deepEqual(projectNineAxisAngles(asymmetric, -20, -5), { x: -10, y: -5 });
  assert.deepEqual(projectNineAxisAngles(asymmetric, 40, 15), { x: 20, y: 15 });
  assert.deepEqual(projectNineAxisAngles({ ...axes, plane: false }, 30, 12.5, 'x'), { x: 30, y: 0 });
  assert.deepEqual(projectNineAxisAngles({ ...axes, plane: false }, 30, 12.5, 'y'), { x: 0, y: 12.5 });
  assert.deepEqual(projectNineAxisAngles({ ...axes, plane: false, y: { min: 0, max: 0 } }, -30, 25), { x: -30, y: 0 });
  assert.equal(projectNineAxisAngles(axes, NaN, 0), null);
});

test('Z shortcuts use the authored roll limits and preserve the X and Y pose', async t => {
  const { HeadNineAxisPanel } = await panelModule();
  const doc = composed(), axes = nineAxisCapabilities(doc), elements = new Map<string, any>();
  doc.headRoll = { pivot: [0, 0], parts: [doc.parts[0].id] };
  doc.parameters!.push({ id: 'ParamAngleZ', min: -12, max: 12, keys: [-12, 0, 12] });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const element = (key: string) => {
    if (!elements.has(key)) elements.set(key, { children: [], replaceChildren(...children: unknown[]) { this.children = children; } });
    return elements.get(key);
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    querySelector: element,
    createElement: () => ({ dataset: {} }),
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const panel = Object.create(HeadNineAxisPanel.prototype), drawn: number[][] = [];
  Object.assign(panel, { doc, level: 'face', modes: [{ id: 'face', axes }], value: 8, valueY: 6, valueZ: 0,
    installPad() {}, syncPose() { drawn.push([this.value, this.valueY, this.valueZ]); } });
  panel.configureLevel();
  const keys = element('#nine-axis-keys-z');
  assert.equal(element('#nine-axis-z').hidden, false);
  for (const button of [keys.children[0], keys.children[2], keys.children[1]]) button.onclick();
  assert.deepEqual(drawn, [[8, 6, -12], [8, 6, 12], [8, 6, 0]]);
  delete doc.headRoll;
  panel.configureLevel();
  assert.equal(element('#nine-axis-z').hidden, true);
  assert.deepEqual(keys.children, []);
});

test('mouse follow respects available poses and held roll keys move continuously within the active preview', async t => {
  const { HeadNineAxisPanel } = await panelModule();
  const doc = composed(), panel = Object.create(HeadNineAxisPanel.prototype);
  doc.headRoll = { pivot: [0, 0], parts: [doc.parts[0].id] };
  doc.parameters!.push({ id: 'ParamAngleZ', min: -12, max: 12, keys: [-12, 0, 12] });
  let frame: ((time: number) => void) | undefined;
  let renders = 0;
  const display = { activeElement: null as { isContentEditable: boolean } | null, querySelector: () => null };
  for (const [key, value] of Object.entries({
    document: display,
    requestAnimationFrame: (callback: (time: number) => void) => { frame = callback; return 1; },
    cancelAnimationFrame: () => { frame = undefined; },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  Object.assign(panel, {
    doc, axes: nineAxisCapabilities(doc), active: true, following: false, value: 0, valueY: 0, valueZ: 0, rollKeys: new Set(),
    view: { getBoundingClientRect: () => ({ left: 50, top: 30, width: 320, height: 320 }) },
    syncPose() { renders++; },
  });
  const advance = (time: number) => {
    const callback = frame;
    frame = undefined;
    assert.ok(callback);
    callback(time);
  };
  const pointer = { pointerType: 'mouse', clientX: 368, clientY: 126, buttons: 0 };
  panel.trackPointer(pointer);
  assert.deepEqual([panel.value, panel.valueY], [0, 0]);
  panel.following = true;
  panel.trackPointer(pointer);
  panel.trackPointer({ ...pointer, clientX: 352 });
  assert.equal(renders, 0);
  advance(0);
  assert.equal(renders, 1);
  assert.ok(panel.value > 0 && panel.valueY > 0);
  assert.ok(Math.abs(panel.value / 30) <= headSideLimit(panel.valueY / 25));
  let previous = panel.valueY;
  const edge = { ...pointer, clientX: 368 };
  for (let y = 125; y >= 60; y--) {
    panel.trackPointer({ ...edge, clientY: y });
    assert.ok(Math.abs(panel.valueY - previous) < .3, 'moving vertically near the edge must not snap to an endpoint');
    previous = panel.valueY;
  }
  advance(8);
  const xy = [panel.value, panel.valueY];
  let consumed = 0;
  const press = (key: string, extra = {}) => panel.rollKeyDown({ key, preventDefault() { consumed++; }, ...extra });
  const release = (key: string) => panel.rollKeyUp({ key });
  press('a');
  assert.deepEqual([panel.value, panel.valueY, panel.valueZ], [...xy, -1]);
  advance(16); advance(32);
  assert.ok(panel.valueZ < -1 && panel.valueZ > -2);
  const held = panel.valueZ;
  press('a', { repeat: true });
  assert.equal(panel.valueZ, held);
  release('a');
  assert.equal(frame, undefined);
  press('D', { shiftKey: true });
  assert.equal(panel.valueZ, held + 5);
  advance(48); advance(64);
  assert.ok(panel.valueZ > held + 6);
  display.activeElement = { isContentEditable: true };
  const beforeFocus = panel.valueZ;
  advance(80);
  assert.equal(panel.valueZ, beforeFocus);
  assert.equal(frame, undefined);
  display.activeElement = null;
  press('d', { target: { isContentEditable: true } });
  press('a', { ctrlKey: true });
  panel.viewDrag = () => {};
  press('d');
  assert.equal(consumed, 3);
  panel.viewDrag = null;
  panel.valueZ = 11;
  press('D', { shiftKey: true });
  assert.equal(panel.valueZ, 12);
  release('D');
  panel.active = false;
  press('a');
  assert.equal(panel.valueZ, 12);
});

test('workbench dragging inside excluded lobes follows the boundary tangent in all four quadrants', async () => {
  const { HeadNineAxisPanel } = await panelModule();
  for (const side of [-1, 1]) for (const pitch of [-1, 1]) {
    const panel = Object.create(HeadNineAxisPanel.prototype), doc = composed(), before = JSON.stringify(doc);
    Object.assign(panel, { doc, axes: nineAxisCapabilities(doc), value: 0, valueY: 0, padDrag: { id: 1, axis: null },
      padCoordinates(event: any) { return { x: event.x, y: event.y }; }, schedulePoseFrame() {} });
    const move = (x: number, y: number) => panel.padPointerMove({ pointerId: 1, x, y });
    const onBoundary = () => assert.ok(Math.abs(Math.abs(panel.value / 30) - headSideLimit(panel.valueY / 25)) < 1e-12);
    move(side * 27, pitch * 5);
    onBoundary();
    const start = { x: panel.value, y: panel.valueY };
    move(side * 27, pitch * 5.5);
    onBoundary();
    assert.ok(pitch * (panel.valueY - start.y) > 0, 'vertical pointer travel advances along the boundary');
    const vertical = { x: panel.value, y: panel.valueY };
    move(side * 27.3, pitch * 5.5);
    onBoundary();
    assert.ok(pitch * (panel.valueY - vertical.y) < 0, 'horizontal outward travel slides toward the cardinal pose');
    assert.ok(side * (panel.value - vertical.x) > 0);
    move(0, 0);
    assert.deepEqual([panel.value, panel.valueY], [0, 0]);
    assert.equal(JSON.stringify(doc), before, 'preview controls never edit the model');
  }
});

test('single axes enable diagonal preview with sparse auxiliary keys; malformed authored corners remain blocked', async () => {
  const panel = await panelModule(), doc = composed(), part = doc.parts[0];
  part.keyforms['-15'] = rest.map(([x, y]) => [x + 2, y]);
  part.keyformsY['12.5'] = rest.map(([x, y]) => [x, y + 3]);
  assert.equal(panel.nineAxisCapabilities, nineAxisCapabilities, 'workbench uses the model module for preview directions');
  assert.equal(nineAxisCapabilities(doc).region, 'plane');
  assert.deepEqual([...keyformAt(part, -15, 12.5)].slice(0, 2), [2, 3], 'unmade auxiliary intersections use the renderer composition');
  assert.equal(nineAxisCapabilities(doc, false).region, 'cross', 'an explicit single-axis preview restriction is respected');
  delete part.keyformsXY['-30,25'];
  assert.equal(nineAxisCapabilities(doc).region, 'plane');
  part.keyformsXY['-30,25'] = [[NaN, 0]];
  assert.equal(nineAxisCapabilities(doc).plane, false);
});

test('workbench loads the embedded source composition unchanged and reloads same-version stage switches', async t => {
  const { HeadNineAxisPanel, nineAxisCapabilities } = await panelModule(), doc = composed(), requested: string[] = [], installed: any[] = [];
  t.mock.method(globalThis, 'fetch', async (url: any) => {
    const path = new URL(String(url), 'http://local/').searchParams.get('path')!; requested.push(path);
    return path.endsWith('.json') ? Response.json({ doc, author: doc, version: '1', studioLayers: [], textures: ['./texture?path=' + path.replace(/[^/]+$/, 'layers/face.png')] }) : new Response('texture');
  });
  const previous = (globalThis as any).createImageBitmap;
  (globalThis as any).createImageBitmap = async () => ({});
  t.after(() => { if (previous) (globalThis as any).createImageBitmap = previous; else delete (globalThis as any).createImageBitmap; });
  const panel = Object.create(HeadNineAxisPanel.prototype);
  Object.assign(panel, { epoch: 0, doc: null as any, clear() { this.doc = null; }, status() {}, error(message: string) { assert.fail(message); },
    install(doc: any, images: any[], allowPlane: boolean) { this.doc = doc; installed.push({ doc, images, allowPlane }); } });
  const fixture = { folder: '/fixture', nineAxis: { available: true, path: nineAxisArtifacts.headDeformers, version: '1', stage: 'y' } };
  await Promise.all([panel.load(fixture), panel.load(fixture)]);
  assert.deepEqual(installed[0].doc, doc);
  assert.deepEqual([...evaluatePoints(panel.doc, panel.doc.parts[0], -15, 0)].slice(0, 2), [-1, 0]);
  assert.deepEqual([...evaluatePoints(panel.doc, panel.doc.parts[0], 0, 12.5)].slice(0, 2), [0, -1]);
  assert.equal(nineAxisCapabilities(panel.doc, installed[0].allowPlane).region, 'plane');
  assert.equal(requested[1], 'nine-axis/step04_angles/model/layers/face.png');
  await panel.load({ folder: '/fixture', nineAxis: { available: true, path: nineAxisArtifacts.angleUpDeformers, version: '1', stage: 'up' } });
  assert.equal(installed.length, 2, 'switching source paths reloads even if revisions match');
  assert.equal(requested[3], 'nine-axis/step04_angles/model/up/layers/face.png');
  await panel.load({ folder: '/fixture', nineAxis: { available: false, path: nineAxisArtifacts.angleUpDeformers, version: '1', stage: 'up' } });
  assert.equal(panel.doc, null, 'availability changes clear an unchanged cached document');
  assert.equal(requested.length, 4);
});

test('saving merged correction grids preserves every embedded source snapshot', async t => {
  const f = await fixture(t), doc = composed(); await f.put('step04_angles/model/deformers.json', doc);
  const file = join(f.root, nineAxisArtifacts.headDeformers), info = await lstat(file), version = `${info.mtimeMs}:${info.size}`;
  const changed = structuredClone(doc); changed.axisSources[0].doc.parts[0].keyforms['-30'][0][0] -= 1;
  await assert.rejects(saveNineAxis(f.root, { path: nineAxisArtifacts.headDeformers, version, document: changed }), /不能替换图层、来源或层级/);
  const edited = structuredClone(doc); edited.parts[0].keyforms['-30'] = rest.map(([x, y]) => [x + .5, y]);
  await saveNineAxis(f.root, { path: nineAxisArtifacts.headDeformers, version, document: edited });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).axisSources, doc.axisSources);
});

test('staged progress shows draft model and generated video before branches complete independently', async t => {
  const f = await fixture(t);
  await f.put('step01_preparation/.running');
  await f.put('step04_angles/.running');
  await f.put('step04_angles/model/.running');
  await f.put('step04_angles/model/up/.running');
  await f.put('step04_angles/model/up/deformers.json', composed());
  await f.put('step04_angles/video/.running');
  await f.put('step04_angles/video/left-up.mp4', 'generated video');
  let value = await f.get();
  assert.equal(value.states['step04_angles/model/up'], 'interrupted');
  assert.equal(value.states['step04_angles/video'], 'interrupted');
  await f.complete('step04_angles/video');
  value = await f.get({ active: true });
  assert.equal(value.states['step04_angles/video'], 'done');
  assert.equal(value.states['step04_angles/model/up'], 'available');
  assert.equal(value.states.step04_angles, 'available');
});

test('focus camera interpolates and reaches the exact restore target', async () => {
  const { HeadNineAxisPanel } = await panelModule();
  const panel = Object.create(HeadNineAxisPanel.prototype);
  const from = { zoom: 2.5, pan: [-.5, 0] }, to = { zoom: 1, pan: [0, .4] };
  Object.assign(panel, { stage: { ...from }, cameraMove: { from, to } });
  panel.moveCamera(10);
  assert.equal(panel.stage.zoom, from.zoom);
  panel.moveCamera(140);
  assert.ok(panel.stage.zoom < from.zoom && panel.stage.zoom > to.zoom);
  panel.moveCamera(270);
  assert.deepEqual(panel.stage, to);
  assert.equal(panel.cameraMove, null);
});

test('the fit control restores its default action when the head preview closes', async t => {
  const { HeadNineAxisPanel } = await panelModule();
  const fit = { textContent: '适应', setAttribute() {}, removeAttribute() {} };
  const hide = { hidden: true };
  const elements: Record<string, object> = { '#fit': fit, '#nine-axis-focus-layers': hide };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    querySelector: (selector: string) => elements[selector] ?? {},
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const panel = Object.create(HeadNineAxisPanel.prototype);
  const stage = { source: {}, zoom: 2, pan: [.1, .2], render() {} };
  const layers = { session: 'fixture', focus: new Set(['body']) as Set<string> | null, setFocus(keep: null) { this.focus = keep; } };
  Object.assign(panel, { active: true, inSharedPreview: true, doc: {}, stage, layers, rollKeys: new Set(),
    focus: { home: { zoom: 1, pan: [0, 0] } }, updateLayers: () => panel.syncFocus() });
  panel.syncFocus();
  assert.equal(fit.textContent, '退出聚焦');
  assert.equal(hide.hidden, false);
  panel.activate(false, true);
  assert.equal(panel.canFocus, false);
  assert.equal(fit.textContent, '适应');
  assert.equal(hide.hidden, true);
  assert.equal(layers.focus, null);
  assert.deepEqual([stage.zoom, stage.pan], [1, [0, 0]]);
});

test('focus hides only in preview, and eye edits made while focused survive restoring the view', async () => {
  const { LayerPanel } = await import(new URL('../studio/layer-panel.js', import.meta.url).href);
  const panel = Object.create(LayerPanel.prototype);
  const layers = [
    { id: 'foreground', visible: true },
    { id: 'group', group: true, visible: true },
    { id: 'front', visible: true, parentId: 'group' },
    { id: 'mask', mask: true, visible: true, parentId: 'front' },
    { id: 'middle', visible: true, parentId: 'group' },
    { id: 'back', visible: true, parentId: 'group' },
    { id: 'background', visible: true },
  ];
  Object.assign(panel, { layers, session: 'fixture', render() {}, queue() {}, undo: [] });
  panel.setFocus(new Set(['front', 'back']));
  const eye = () => panel.previewLayers().map((row: { visible: boolean }) => row.visible);
  assert.deepEqual(eye(), [false, true, true, true, false, true, false]);
  assert.ok(layers.every(row => row.visible));
  panel.setVisible('foreground', true);
  assert.equal(eye()[0], true);
  panel.setVisible('foreground', false);
  panel.setFocus(null);
  assert.deepEqual(eye(), [false, true, true, true, true, true, true]);
  assert.equal(panel.undo.length, 1);
});

test('a saved projection follows its posed caster and clips to the posed receiver', async () => {
  const path = new URL('../../.agents/skills/live2d-maker/shared/nine-axis-render.js', import.meta.url);
  const { HeadNineAxisRenderer } = await import(path.href);
  const doc = composed(), caster = doc.parts[0], passLayers: string[][] = [];
  caster.uuid = 'caster-uuid';
  doc.headRoll = { pivot: [0, 0], parts: [caster.id, 'receiver'] };
  doc.parameters.push({ id: 'ParamAngleZ', min: -15, max: 15 });
  const receiver = { ...structuredClone(caster), id: 'receiver', uuid: 'receiver-uuid' };
  doc.parts.push(receiver);
  const engine = {
    getDrawingBufferSize: (size: any) => size.set(100, 100),
    setRenderTarget() {},
    render(scene: any) {
      passLayers.push(scene.children.filter((mesh: any) => mesh.visible).map((mesh: any) => mesh.userData.part?.id ?? mesh.userData.id));
    },
  };
  const renderer = new HeadNineAxisRenderer(null, engine), texture = { width: 1, height: 1 };
  renderer.install(doc, doc.parts.map(() => texture));
  renderer.setStaticLayers([{ uuid: 'cast', visible: true, blend: 'multiply', opacity: 100, bounds: [3, 4, 1, 1], order: 2, image: texture,
    projection: { casters: [caster.uuid], receivers: [receiver.uuid] } }]);
  const frame = { x0: 0, y0: 0, width: 100, height: 100 };
  const shown = new Set([caster.id, receiver.id]);
  renderer.draw(frame, 30, 25, shown, undefined, 15, { reuseXY: true });
  assert.deepEqual(passLayers, [[receiver.id], [caster.id, receiver.id, '__studio__/cast']]);
  const mesh = renderer.meshes.get('__studio__/cast');
  assert.equal(mesh.material.uniforms.clipMode.value, 1);
  const [x, y] = mesh.geometry.attributes.position.array, angle = Math.PI / 12;
  // Sample (3,4) takes the caster's (+2,-2) from independent X/Y source
  // shapes, then rolls about the same pivot. The receiver has different X/Y.
  assert.ok(Math.abs(x - (5 * Math.cos(angle) - 2 * Math.sin(angle))) < 1e-5);
  assert.ok(Math.abs(y - (5 * Math.sin(angle) + 2 * Math.cos(angle))) < 1e-5);
  const poseVersion = mesh.geometry.attributes.position.version;
  passLayers.length = 0;
  renderer.draw(frame, 30, 25, shown, undefined, 15, { reuseXY: true });
  assert.deepEqual(passLayers, [[caster.id, receiver.id, "__studio__/cast"]]);
  assert.equal(mesh.geometry.attributes.position.version, poseVersion);
  passLayers.length = 0;
  renderer.draw(frame, 30, 25, shown, undefined, 15, { reuseXY: true, opacity: (part: {id: string}) => part.id === receiver.id ? .5 : 1 });
  assert.deepEqual(passLayers, [[receiver.id], [caster.id, receiver.id, "__studio__/cast"]]);
  passLayers.length = 0;
  renderer.draw(frame, 0, 0, new Set([caster.id]), undefined, 15);
  assert.deepEqual(passLayers, [[caster.id]]);

  passLayers.length = 0;
  renderer.draw(frame, 0, 0, new Set([receiver.id]), undefined, 0);
  assert.deepEqual(passLayers, [[receiver.id]], 'a composition without the caster also hides its saved shadow');
});

test('studio uses the chosen head composition at neutral and posed angles, matching the workflow preview', async () => {
  const { HeadNineAxisPanel } = await panelModule(), panel = Object.create(HeadNineAxisPanel.prototype);
  const doc = composed(), hair = { ...structuredClone(doc.parts[0]), id: 'hair', level: 'hair' }, accessory = { ...structuredClone(doc.parts[0]), id: 'accessory', level: 'accessory' };
  doc.parts.push(hair, accessory);
  const draws: { shown: Set<string>; x: number; y: number }[] = [];
  Object.assign(panel, { doc, active: true, inSharedPreview: true, value: 0, valueY: 0, valueZ: 0,
    selected: null, shownMasks: new Set(), mode: { scope: new Set(['face', 'hair']) },
    stage: { canvasFrame: () => ({ x0: 0, y0: 0, width: 100, height: 100 }) },
    view: { getBoundingClientRect: () => ({ width: 100 }) }, drawOverlay() {}, layers: {},
    view3: { draw(_frame: any, x: number, y: number, shown: Set<string>) { draws.push({ shown, x, y }); } } });
  assert.equal(panel.present(), true, 'neutral uses the authored model rather than switching to the KRA composite');
  assert.deepEqual([...draws.at(-1)!.shown], ['face', 'hair']);
  panel.value = -30; panel.valueY = 25; panel.present();
  assert.deepEqual([...draws.at(-1)!.shown], ['face', 'hair']);
  panel.mode.scope.add('accessory'); panel.present();
  assert.deepEqual([...draws.at(-1)!.shown], ['face', 'hair', 'accessory']);
  panel.value = panel.valueY = 0; panel.active = false;
  assert.equal(panel.present(), false, 'other neutral workspaces keep their original paint view');
});

test('dynamic studio preview preserves angles and defers refresh during user edits or parameter dragging', async t => {
  const { HeadNineAxisPanel } = await panelModule();
  const previous = (globalThis as any).location;
  (globalThis as any).location = { search: '?nineStage=up' };
  t.after(() => { if (previous) (globalThis as any).location = previous; else delete (globalThis as any).location; });
  const panel = Object.create(HeadNineAxisPanel.prototype);
  const initial = { folder: '/fixture', nineAxis: { path: 'nine-axis/step04_angles/model/up/deformers.json', version: '1' } };
  let requests = 0, installs = 0;
  Object.assign(panel, { active: true, project: initial, doc: {}, dirty: new Set(), value: 0, valueY: 12.5,
    async load(next: any) { installs++; this.project = next; this.value = this.valueY = 0; },
    setValue(x: number,y: number) { this.value=x; this.valueY=y; }, status(message: string) { assert.fail(message); } });
  t.mock.method(globalThis, 'fetch', async (url: any) => {
    requests++; assert.match(String(url), /nineStage=up/);
    return Response.json({ ...initial, nineAxis: { ...initial.nineAxis, version: '2' } });
  });
  await panel.refresh();
  assert.equal(installs, 1); assert.deepEqual([panel.value,panel.valueY], [0,12.5]);
  panel.dirty.add('local edit'); await panel.refresh();
  panel.dirty.clear(); panel.padDrag = { id: 1 }; await panel.refresh();
  assert.equal(requests,1);
  panel.padDrag = null;
  t.mock.method(globalThis,'fetch',async () => { panel.padDrag = { id: 1 }; return Response.json(initial); });
  await panel.refresh(); assert.equal(installs,1, 'a drag started during fetch also protects the current preview');
  panel.padDrag = null; panel.doc = null;
  t.mock.method(globalThis,'fetch',async () => Response.json(panel.project));
  await panel.refresh(); assert.equal(installs,2, 'an interrupted model load retries even when its revision is unchanged');
});

test('empty tasks use the current staged progress and a live section reports startup before the first model call', async t => {
  const f = await fixture(t);
  const pending = await f.get(); assert.equal(pending.status, 'pending');
  const active = await f.get({ active: true }); assert.equal(active.status, 'running');
});

test('a previous section success cannot become a later standalone step error, while actual failures retain their reason', async t => {
  const f = await fixture(t), time = new Date().toISOString(), step = 'step11_head-angle-xy';
  await f.put(step + '/.running');
  for (const status of ['completed', 'failed']) {
    const summary = status === 'completed' ? 'previous operation succeeded' : 'current operation failed';
    await writeFile(join(f.root, 'run.json'), JSON.stringify({ version: 1, from: 'nine-axis', to: 'nine-axis', jobs: 1,
      status, createdAt: time, updatedAt: time, sections: { 'nine-axis': { status, updatedAt: time, summary } } }));
    const value = (await snapshot(f.root, basename(f.root), dirname(f.root))).sections.find(section => section.id === 'nine-axis')!;
    assert.equal(value.states[step], status === 'failed' ? 'failed' : 'interrupted');
    assert.deepEqual(value.messages, status === 'failed' ? { [step]: summary } : {});
  }
});

test('nine-axis shows actual Krita queue/reservation/use and discards a dead owner record', async t => {
  const f = await fixture(t), name = basename(f.root), dir = dirname(f.root);
  const get = async () => (await snapshot(f.root, name, dir)).sections.find(section => section.id === 'nine-axis')!;
  const base = { section: join(f.root, 'nine-axis'), owner: process.pid, since: new Date().toISOString(), limit: 4 };
  for (const state of ['waiting', 'reserved', 'running']) {
    await f.put('krita.json', { ...base, state, ...(state === 'running' ? { pid: process.pid, version: '5.3', startedAt: base.since, bridge: '/private/bridge' } : {}) });
    assert.equal((await get()).krita?.state, state);
  }
  await f.put('krita.json', { ...base, state: 'running', owner: 2147483647, pid: process.pid });
  assert.equal((await get()).krita, null);
  await f.put('krita.json', { ...base, state: 'running', pid: 2147483647 });
  assert.equal((await get()).krita?.state, 'reserved', 'a crashed application still holds the worker reservation');
  await rm(join(f.root, 'nine-axis/krita.json')); assert.equal((await get()).krita, null);
});

test('renderer preserves coarse tessellation and reduces dense meshes per axis', async () => {
  const path = new URL('../../.agents/skills/live2d-maker/shared/nine-axis-render.js', import.meta.url);
  const { renderMeshSamples, SUB } = await import(path.href);
  const bbox = [10, 20, 118, 220];
  const coarse = renderMeshSamples({ bbox, cols: 4, rows: 4 });
  assert.deepEqual([coarse.cols, coarse.rows], [4 * SUB, 4 * SUB]);
  const dense = renderMeshSamples({ bbox, cols: 25, rows: 32 });
  assert.ok(dense.points.length < (25 * SUB + 1) * (32 * SUB + 1));
  assert.deepEqual([...dense.points.slice(0, 2), ...dense.points.slice(-2)], bbox);
  const mixed = renderMeshSamples({ bbox, cols: 4, rows: 32 });
  assert.equal(mixed.cols, coarse.cols);
  assert.equal(mixed.rows, dense.rows);
});

test('pad input coalesces multiple moves into a single lightweight pose update', async t => {
  const { HeadNineAxisPanel } = await panelModule();
  const original = globalThis.requestAnimationFrame;
  let callback: FrameRequestCallback | undefined;
  globalThis.requestAnimationFrame = next => {
    assert.equal(callback, undefined); callback = next; return 1;
  };
  t.after(() => { globalThis.requestAnimationFrame = original; });
  const doc = composed(), frames: number[][] = [];
  const panel = Object.assign(Object.create(HeadNineAxisPanel.prototype), {
    doc, axes: nineAxisCapabilities(doc), value: 0, valueY: 0, valueZ: 0,
    padDrag: { id: 1, axis: null }, rollKeys: new Set(),
    padCoordinates(event: { clientX: number; clientY: number }) { return { x: event.clientX, y: event.clientY }; },
    sync() { assert.fail('pose input should not rebuild the tree'); },
    syncPose() { frames.push([this.value, this.valueY]); },
  });
  for (const clientX of [4, 7, 10]) panel.padPointerMove({ pointerId: 1, clientX, clientY: 5 });
  assert.equal(frames.length, 0);
  assert.ok(callback);
  callback(16);
  assert.deepEqual(frames, [[panel.value, panel.valueY]]);
  assert.notEqual(frames[0][0], 0);
});
