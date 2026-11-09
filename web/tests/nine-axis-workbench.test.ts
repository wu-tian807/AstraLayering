import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { nineAxisProgress } from '../nine-axis-progress.ts';
import { inventory } from '../files.ts';
import { snapshot } from '../snapshot.ts';
import { sectionSteps, stepArtifacts } from '../progress.js';
import { nineAxisSteps, nineAxisGroupSteps, nineAxisArtifacts } from '../../.agents/skills/live2d-maker/shared/nine-axis.ts';
import { evaluatePoints, validateHeadNineAxis, nineAxisCapabilities, keyformAt } from '../../.agents/skills/live2d-maker/shared/nine-axis-model.js';
import { saveNineAxis } from '../nine-axis-save.ts';
import { lstat } from 'node:fs/promises';
import { applyStepAction, applyTaskAction } from '../../.agents/skills/live2d-maker/workflow/step-actions.ts';
import { readStepSession, writeStepSession } from '../../.agents/skills/live2d-maker/shared/agents/step-session.ts';
import { stepDeliveries } from '../../.agents/skills/live2d-maker/shared/step-deliveries.ts';

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

test('final four-step UI presents three parallel children and no retired video/pitch steps', () => {
  assert.deepEqual(nineAxisSteps, ['step01_video', 'step02_angles', 'step03_angle-xy', 'step04_jaw-line']);
  const steps = sectionSteps[6]; assert.deepEqual(steps.map(step => step.id), [...nineAxisSteps]);
  assert.equal(steps[1].childrenMode, 'parallel');
  assert.deepEqual(steps[1].children.map(step => step.id), nineAxisGroupSteps);
  for (const id of nineAxisGroupSteps) assert.ok(stepArtifacts[6][id].some(item => item.path === `nine-axis/${id}/deformers.json`));
});

test('independent waits and failures never mark running or completed siblings throttled', async t => {
  const f = await fixture(t), since = new Date(Date.now() - 1000).toISOString();
  await f.put('step02_angles/.running');
  await f.put('step02_angles/left/.completed'); await f.put('step02_angles/left/deformers.json', '{}');
  await f.complete('step02_angles/left');
  for (const group of ['up', 'down']) {
    await f.put(`step02_angles/${group}/.running`);
    await f.put(`agents/${group}/request.json`, { task: { step: 'nine_axis_head', name: `单轴 ${group}`,
      outputDirectory: group === 'up' ? join(f.root, 'nine-axis/step02_angles/up') : 'nine-axis/step02_angles/down' } });
  }
  await f.put('agents/up/retry-wait.json', { until: new Date(Date.now() + 60000).toISOString(), error: '429 up only' });
  let value = await f.get({ active: true, since });
  assert.deepEqual(nineAxisGroupSteps.map(id => value.states[id]), ['done', 'throttled', 'running']);
  assert.equal(value.states.step02_angles, 'running');
  assert.equal(value.messages['step02_angles/up'], '429 up only'); assert.equal(value.messages['step02_angles/down'], undefined);
  await f.put('agents/down/result.json', { status: 'failed' });
  value = await f.get({ active: true, since });
  assert.deepEqual(nineAxisGroupSteps.map(id => value.states[id]), ['done', 'throttled', 'failed']);
  assert.equal(value.status, 'throttled');
  assert.deepEqual(f.errors, []);
});

test('child retry marker layout keeps completed siblings; retained XY waits for all children and parent merge', async t => {
  const f = await fixture(t);
  for (const id of [...nineAxisGroupSteps, 'step02_angles', 'step03_angle-xy']) {
    await f.put(`${id}/.completed`); await f.put(`${id}/deformers.json`, '{}');
    await f.complete(id);
  }
  assert.equal((await f.get()).mergeComplete, true);
  // This is the layout the workflow retry must leave, under its task lock.
  await rm(join(f.root, 'nine-axis/step02_angles/up'), { recursive: true });
  await rm(join(f.root, 'nine-axis/step02_angles/.completed'));
  await f.put('step02_angles/.running');
  const before = await readFile(join(f.root, 'nine-axis/step02_angles/down/deformers.json'));
  let value = await f.get();
  assert.equal(value.mergeComplete, false); assert.equal(value.states['step02_angles/left'], 'done');
  assert.equal(value.states['step02_angles/down'], 'done'); assert.equal(value.states['step02_angles/up'], 'pending');
  assert.equal(value.states['step03_angle-xy'], 'available');
  assert.match(value.messages['step03_angle-xy'], /父合并全部完成/);
  assert.deepEqual(await readFile(join(f.root, 'nine-axis/step02_angles/down/deformers.json')), before);
  await f.put('step02_angles/up/.completed'); await f.put('step02_angles/up/deformers.json', '{}');
  await f.complete('step02_angles/up');
  assert.equal((await f.get()).mergeComplete, false, 'finished children still wait for the parent merge');
  await rm(join(f.root, 'nine-axis/step02_angles/.running')); await f.put('step02_angles/.completed');
  value = await f.get(); assert.equal(value.mergeComplete, true); assert.equal(value.states['step03_angle-xy'], 'done');
});

test('parent completion cannot hide a missing child delivery; snapshot exposes exact child recovery IDs', async t => {
  const f = await fixture(t);
  for (const id of [...nineAxisGroupSteps, 'step02_angles']) await f.complete(id);
  await rm(join(f.root, 'nine-axis/step02_angles/up/deformers.json'));
  const value = await f.get();
  assert.equal(value.states.step02_angles, 'failed');
  assert.deepEqual(value.steps.find(step => step.id === 'step02_angles/up')!.missing, ['step02_angles/up/deformers.json']);
  const result = await snapshot(f.root, 'case', dirname(f.root));
  assert.deepEqual(result.sections.find(section => section.id === 'nine-axis')!.steps.map(step => step.id), ['step02_angles', ...nineAxisGroupSteps]);
});

test('native child continue preserves its thread, resume keeps authors, retry reopens only its parent merge', async t => {
  const f = await fixture(t), root = join(f.root, 'nine-axis');
  await f.put('step02_angles/.completed'); await f.put('step02_angles/deformers.json', 'old merged');
  for (const group of ['left', 'up', 'down']) {
    await f.put(`step02_angles/${group}/.${group === 'up' ? 'running' : 'completed'}`);
    await f.put(`step02_angles/${group}/deformers.json`, `author ${group}`);
    await writeStepSession(root, `step02_angles/${group}`, { threadId: `thread-${group}` });
  }
  const act = (action: string) => applyStepAction({ name: basename(f.root), dir: dirname(f.root), section: 'nine-axis', step: 'step02_angles/up', action });
  await act('continue');
  assert.equal((await readStepSession(root, 'step02_angles/up'))!.threadId, 'thread-up');
  assert.equal(await readFile(join(root, 'step02_angles/up/deformers.json'), 'utf8'), 'author up');
  const progress = await f.get();
  assert.deepEqual(nineAxisGroupSteps.map(id => progress.steps.find(step => step.id === id)!.threadId), ['thread-left', 'thread-up', 'thread-down']);
  await act('resume');
  assert.equal(await readStepSession(root, 'step02_angles/up'), undefined);
  assert.equal(await readFile(join(root, 'step02_angles/up/deformers.json'), 'utf8'), 'author up');
  await writeStepSession(root, 'step02_angles/up', { threadId: 'new-up-thread' });
  await act('retry');
  await assert.rejects(readFile(join(root, 'step02_angles/up/deformers.json')), { code: 'ENOENT' });
  assert.equal(await readStepSession(root, 'step02_angles/up'), undefined);
  await assert.rejects(readFile(join(root, 'step02_angles/.completed')), { code: 'ENOENT' });
  assert.equal(await readFile(join(root, 'step02_angles/.running'), 'utf8'), '');
  for (const group of ['left', 'down']) {
    assert.equal(await readFile(join(root, `step02_angles/${group}/deformers.json`), 'utf8'), `author ${group}`);
    assert.equal((await readStepSession(root, `step02_angles/${group}`))!.threadId, `thread-${group}`);
    await readFile(join(root, `step02_angles/${group}/.completed`));
  }
});

test('taskwide retry of a nested group never deletes its parent subtree or completed siblings', async t => {
  const f = await fixture(t), root = join(f.root, 'nine-axis');
  await f.put('step02_angles/.running');
  for (const group of ['neutral', 'left', 'up', 'down']) {
    await f.put(`step02_angles/${group}/.${group === 'up' ? 'running' : 'completed'}`);
    await f.put(`step02_angles/${group}/deformers.json`, group);
    if (group === 'left' || group === 'down') await f.complete(`step02_angles/${group}`);
  }
  await applyTaskAction({ name: basename(f.root), dir: dirname(f.root), action: 'retry' });
  for (const group of ['neutral', 'left', 'down']) assert.equal(await readFile(join(root, `step02_angles/${group}/deformers.json`), 'utf8'), group);
  await assert.rejects(readFile(join(root, 'step02_angles/up/deformers.json')), { code: 'ENOENT' });
  await readFile(join(root, 'step02_angles/.running'));
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
    .replace("'./nine-axis-render.js'", JSON.stringify(new URL('../../.agents/skills/live2d-maker/shared/nine-axis-render.js', import.meta.url).href));
  return import('data:text/javascript,' + encodeURIComponent(source));
}

test('main corners enable the plane with sparse auxiliary keys; missing main corners and merged-only stages stay restricted', async () => {
  const panel = await panelModule(), doc = composed(), part = doc.parts[0];
  part.keyforms['-15'] = rest.map(([x, y]) => [x + 2, y]);
  part.keyformsY['12.5'] = rest.map(([x, y]) => [x, y + 3]);
  assert.equal(panel.nineAxisCapabilities, nineAxisCapabilities, 'workbench uses the model module for preview directions');
  assert.equal(nineAxisCapabilities(doc).region, 'plane');
  assert.deepEqual([...keyformAt(part, -15, 12.5)].slice(0, 2), [2, 3], 'unmade auxiliary intersections use the renderer composition');
  assert.equal(nineAxisCapabilities(doc, false).region, 'cross', 'a merged single-axis phase cannot claim authored corners');
  delete part.keyformsXY['-30,25'];
  assert.equal(nineAxisCapabilities(doc).region, 'cross');
  part.keyformsXY['-30,25'] = [[NaN, 0]];
  assert.equal(nineAxisCapabilities(doc).plane, false);
});

test('workbench loads the embedded source composition unchanged and reloads same-version stage switches', async t => {
  const { HeadNineAxisPanel, nineAxisCapabilities } = await panelModule(), doc = composed(), requested: string[] = [], installed: any[] = [];
  t.mock.method(globalThis, 'fetch', async (url: any) => {
    const path = new URL(String(url), 'http://local/').searchParams.get('path')!; requested.push(path);
    return path.endsWith('.json') ? Response.json(doc) : new Response('texture');
  });
  const previous = (globalThis as any).createImageBitmap;
  (globalThis as any).createImageBitmap = async () => ({});
  t.after(() => { if (previous) (globalThis as any).createImageBitmap = previous; else delete (globalThis as any).createImageBitmap; });
  const panel = Object.create(HeadNineAxisPanel.prototype);
  Object.assign(panel, { epoch: 0, doc: null as any, stopSwing() {}, clear() { this.doc = null; }, status() {}, error(message: string) { assert.fail(message); },
    install(doc: any, images: any[], allowPlane: boolean) { this.doc = doc; installed.push({ doc, images, allowPlane }); } });
  await panel.load({ folder: '/fixture', nineAxis: { available: true, path: nineAxisArtifacts.headDeformers, version: '1', stage: 'y' } });
  assert.deepEqual(installed[0].doc, doc);
  assert.deepEqual([...evaluatePoints(panel.doc, panel.doc.parts[0], -15, 0)].slice(0, 2), [-1, 0]);
  assert.deepEqual([...evaluatePoints(panel.doc, panel.doc.parts[0], 0, 12.5)].slice(0, 2), [0, -1]);
  assert.equal(nineAxisCapabilities(panel.doc, installed[0].allowPlane).region, 'cross');
  assert.equal(requested[1], 'nine-axis/step02_angles/layers/face.png');
  await panel.load({ folder: '/fixture', nineAxis: { available: true, path: nineAxisArtifacts.angleUpDeformers, version: '1', stage: 'up' } });
  assert.equal(installed.length, 2, 'switching source paths reloads even if revisions match');
  assert.equal(requested[3], 'nine-axis/step02_angles/up/layers/face.png');
  await panel.load({ folder: '/fixture', nineAxis: { available: false, path: nineAxisArtifacts.angleUpDeformers, version: '1', stage: 'up' } });
  assert.equal(panel.doc, null, 'availability changes clear an unchanged cached document');
  assert.equal(requested.length, 4);
});

test('saving merged correction grids preserves every embedded source snapshot', async t => {
  const f = await fixture(t), doc = composed(); await f.put('step02_angles/deformers.json', doc);
  const file = join(f.root, nineAxisArtifacts.headDeformers), info = await lstat(file), version = `${info.mtimeMs}:${info.size}`;
  const changed = structuredClone(doc); changed.axisSources[0].doc.parts[0].keyforms['-30'][0][0] -= 1;
  await assert.rejects(saveNineAxis(f.root, { path: nineAxisArtifacts.headDeformers, version, document: changed }), /不能替换图层、来源或层级/);
  const edited = structuredClone(doc); edited.parts[0].keyforms['-30'] = rest.map(([x, y]) => [x + .5, y]);
  await saveNineAxis(f.root, { path: nineAxisArtifacts.headDeformers, version, document: edited });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).axisSources, doc.axisSources);
});
