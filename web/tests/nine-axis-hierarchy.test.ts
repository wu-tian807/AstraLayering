import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editNineAxis } from '../../.agents/skills/live2d-maker/shared/nine-axis-edit.js';
import { evaluatePoints, keyformAt, validateHeadNineAxis, inverseWarpPoint, warpPoint } from '../../.agents/skills/live2d-maker/shared/nine-axis-model.js';
import { saveNineAxis } from '../nine-axis-save.ts';

const rest = [[0, 0], [10, 0], [0, 10], [10, 10]];
const part = (id: string): any => ({ id, level: 'face', group: 'test', texture: 'layers/a.png', textureBounds: [0, 0, 10, 10], bbox: [0, 0, 10, 10], cols: 1, rows: 1,
  keyforms: { '-30': structuredClone(rest), '0': structuredClone(rest), '30': structuredClone(rest) } });
const fixture = (): any => ({ version: 2, kind: 'head-nine-axis', levels: [{ id: 'face', includes: ['face'] }],
  parameters: [{ id: 'ParamAngleX', keys: [-30, 0, 30] }], deformers: [], parts: [part('a'), part('b')] });

test('inverse backtracking resolves the real mirrored face boundary cycle without changing the warp or tolerance', () => {
  // run1 linear.json e49dffcbb07d: the mirrored face-silhouette's last row,
  // translated by [546, 298.375]. Fourteen controls retain the failing edge;
  // the original undamped Newton loop fails on this reduced reproduction.
  const grid: any = { id: 'face-silhouette-boundary', bbox: [0, 0, 163, 22.625], cols: 6, rows: 1, interpolation: 'smooth' };
  const points = [
    62.2908935546875, 20.851104736328125, 63.03900146484375, 6.421905517578125,
    74.8980712890625, -2.75390625, 102.59100341796875, -5.313812255859375,
    134.0574951171875, -6.000701904296875, 150.9976806640625, 0.5166015625, 161.9932861328125, 9.94189453125,
    81.6990966796875, 54.04541015625, 79.43792724609375, 37.610107421875,
    97.51251220703125, 29.603607177734375, 112.08538818359375, 22.423187255859375,
    125.6165771484375, 28.0321044921875, 150.0477294921875, 16.594390869140625, 159.56048583984375, 21.402496337890625,
  ];
  const before = [...points], target: [number, number] = [80.92315397492484, 50.5309130427313];
  const local = inverseWarpPoint(grid, points, ...target), actual = warpPoint(grid, points, ...local);
  assert.ok(Math.hypot(actual[0] - target[0], actual[1] - target[1]) < 1e-5, 'inverse must satisfy the unchanged canvas-pixel tolerance');
  assert.ok(Math.hypot(local[0] - 30.925464887942663, local[1] - 37.093315384646026) < 1e-4);
  assert.deepEqual(points, before, 'the solution never modifies authored controls');
});

test('inverse retains successful affine results and rejects folded, singular and invalid solutions', () => {
  const grid = part('inverse-test'), affine = [4, 2, 19, 2, 4, 9, 19, 9];
  const target = warpPoint(grid, affine, 3, 6), local = inverseWarpPoint(grid, affine, ...target);
  assert.ok(Math.hypot(local[0] - 3, local[1] - 6) < 1e-5);
  assert.deepEqual(inverseWarpPoint(grid, rest.flat(), 3, 6), [3, 6]);
  assert.throws(() => inverseWarpPoint(grid, [10, 0, 0, 0, 10, 10, 0, 10], 3, 6), /无法反解父级变形/, 'an exact root on an inverted warp cannot be accepted');
  assert.throws(() => inverseWarpPoint(grid, [0, 0, 0, 0, 0, 10, 0, 10], 0, 6), /无法反解父级变形/, 'an exact root on a collapsed warp cannot be accepted');
  assert.throws(() => inverseWarpPoint(grid, affine, NaN, 6), /无法反解父级变形/);
});

test('artist creates arbitrary groups; parent transforms children, local edits leave siblings unchanged', () => {
  const doc = editNineAxis(fixture(), [{ action: 'create_warp', id: 'chosen-by-artist', targets: ['a', 'b'], cols: 2, rows: 2 },
    { action: 'transform', id: 'chosen-by-artist', x: -30, translate: [7, 3] }]);
  assert.deepEqual([...evaluatePoints(doc, doc.parts[0], -30)].slice(0, 2), [7, 3]);
  const corrected = editNineAxis(doc, [{ action: 'transform', id: 'a', x: -30, translate: [2, 0] }]);
  assert.deepEqual([...evaluatePoints(corrected, corrected.parts[0], -30)].slice(0, 2), [9, 3]);
  assert.deepEqual([...evaluatePoints(corrected, corrected.parts[1], -30)].slice(0, 2), [7, 3]);
  assert.deepEqual(doc.parts[0].keyforms['-30'], rest, 'local edit does not mutate its input or parent');
});

test('nested parent composition and canvas-space drag resolve back into child coordinates', () => {
  const doc = editNineAxis(fixture(), [{ action: 'create_warp', id: 'outer', targets: ['a', 'b'] },
    { action: 'create_warp', id: 'inner', parent: 'outer', targets: ['a'] },
    { action: 'transform', id: 'outer', x: -30, translate: [4, 2] },
    { action: 'transform', id: 'inner', x: -30, translate: [3, 0] },
    { action: 'drag', id: 'a', x: -30, row: 0, col: 0, delta: [1, 1], radius: 0 }]);
  assert.deepEqual([...evaluatePoints(doc, doc.parts[0], -30)].slice(0, 2), [8, 3]);
  assert.deepEqual([...evaluatePoints(doc, doc.parts[1], -30)].slice(0, 2), [4, 2]);
});

test('reparent and remove preserve already authored keyforms rather than reset them', () => {
  const doc = editNineAxis(fixture(), [{ action: 'create_warp', id: 'shared', targets: ['a', 'b'] }, { action: 'transform', id: 'shared', x: -30, translate: [6, 2] }]);
  const before = [...evaluatePoints(doc, doc.parts[0], -30)];
  const detached = editNineAxis(doc, [{ action: 'reparent', targets: ['a'], parent: null }]);
  assert.deepEqual([...evaluatePoints(detached, detached.parts[0], -30)], before);
  const removed = editNineAxis(doc, [{ action: 'remove_warp', id: 'shared' }]);
  assert.equal(removed.deformers.length, 0);
  assert.deepEqual([...evaluatePoints(removed, removed.parts[0], -30)], before);
});

test('cycles, folded grids, and moving or parenting the fixed neck are rejected atomically', () => {
  const doc = editNineAxis(fixture(), [{ action: 'create_warp', id: 'shared', targets: ['a'] }]);
  assert.throws(() => editNineAxis(doc, [{ action: 'reparent', targets: ['shared'], parent: 'shared' }]), /循环/);
  assert.throws(() => editNineAxis(doc, [{ action: 'points', id: 'a', x: -30, points: [{ row: 0, col: 0, to: [30, 30] }] }]), /折叠/);
  const neck = fixture(); neck.parts.push(part('neck'));
  assert.throws(() => editNineAxis(neck, [{ action: 'create_warp', id: 'head', targets: ['neck'] }]), /脖子必须保持固定/);
  assert.throws(() => editNineAxis(neck, [{ action: 'transform', id: 'neck', x: -30, translate: [1, 1] }]), /脖子不能跟随/);
  assert.deepEqual(neck.deformers, []);
});

test('ellipse passes through all three keyed poses and intermediate edits preserve sampled pose', () => {
  const doc = fixture(), p = doc.parts[0];
  p.keyforms['-30'] = rest.map(([x, y]) => [x - 5, y - 2]); p.keyforms['30'] = rest.map(([x, y]) => [x + 5, y - 2]);
  const ellipse = editNineAxis(doc, [{ action: 'interpolation', id: 'a', x: 'ellipse' }]);
  for (const x of [-30, 0, 30]) assert.deepEqual([...keyformAt(ellipse.parts[0], x)], p.keyforms[String(x)].flat());
  const halfway = [...keyformAt(ellipse.parts[0], -15)];
  assert.ok(halfway[1] > -1, 'curved path avoids the straight chord');
  const keyed = editNineAxis(ellipse, [{ action: 'transform', id: 'a', x: -15, translate: [0, 0] }]);
  assert.equal(keyed.parts[0].parameterInterpolation?.x, 'linear');
  assert.deepEqual([...keyformAt(keyed.parts[0], -15)], halfway);
  assert.throws(() => validateHeadNineAxis({ ...fixture(), version: 1 }), /version 2/);
});

test('workbench saves keyforms; stale revisions and changed texture identities cannot overwrite source', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-save-')); t.after(() => rm(root, { recursive: true, force: true }));
  const path = 'nine-axis/step02_angles/deformers.json'; await mkdir(join(root, 'nine-axis/step02_angles'), { recursive: true });
  const doc = fixture(); await writeFile(join(root, path), JSON.stringify(doc));
  const stat = await lstat(join(root, path)), version = `${stat.mtimeMs}:${stat.size}`;
  const edited = editNineAxis(doc, [{ action: 'transform', id: 'a', x: -30, translate: [2, 0] }]);
  const saved = await saveNineAxis(root, { path, version, document: edited });
  assert.deepEqual(JSON.parse(await readFile(join(root, path), 'utf8')).parts[0].keyforms['-30'][0], [2, 0]);
  await assert.rejects(saveNineAxis(root, { path, version, document: doc }), /已变化/);
  const changed = structuredClone(edited); changed.parts[0].texture = 'layers/other.png';
  await assert.rejects(saveNineAxis(root, { path, version: saved.version, document: changed }), /不能替换图层/);
});


test('Validation accepts mask parts and clips that name other parts', () => {
  const doc = (...parts: any[]) => ({ ...fixture(), parts });
  const mask = { ...part('mask'), role: 'mask' };
  assert.doesNotThrow(() => validateHeadNineAxis(doc(mask, { ...part('image'), clip: { by: ['mask'], invert: true } })));
  assert.throws(() => validateHeadNineAxis(doc(mask, { ...part('image'), clip: { by: ['missing'] } })), /裁切来源无效/);
  assert.throws(() => validateHeadNineAxis(doc({ ...part('image'), role: 'shadow' })), /未知角色/);
});
