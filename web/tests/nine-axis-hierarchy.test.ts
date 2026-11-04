import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editNineAxis } from '../../.agents/skills/live2d-maker/shared/nine-axis-edit.js';
import { evaluatePoints, keyformAt, validateHeadNineAxis } from '../../.agents/skills/live2d-maker/shared/nine-axis-model.js';
import { saveNineAxis } from '../nine-axis-save.ts';

const rest = [[0, 0], [10, 0], [0, 10], [10, 10]];
const part = (id: string): any => ({ id, level: 'face', group: 'test', texture: 'layers/a.png', textureBounds: [0, 0, 10, 10], bbox: [0, 0, 10, 10], cols: 1, rows: 1,
  keyforms: { '-30': structuredClone(rest), '0': structuredClone(rest), '30': structuredClone(rest) } });
const fixture = (): any => ({ version: 2, kind: 'head-nine-axis', levels: [{ id: 'face', includes: ['face'] }],
  parameters: [{ id: 'ParamAngleX', keys: [-30, 0, 30] }], deformers: [], parts: [part('a'), part('b')] });

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
  const path = 'nine-axis/step02_angle-x/deformers.json'; await mkdir(join(root, 'nine-axis/step02_angle-x'), { recursive: true });
  const doc = fixture(); await writeFile(join(root, path), JSON.stringify(doc));
  const stat = await lstat(join(root, path)), version = `${stat.mtimeMs}:${stat.size}`;
  const edited = editNineAxis(doc, [{ action: 'transform', id: 'a', x: -30, translate: [2, 0] }]);
  const saved = await saveNineAxis(root, { path, version, document: edited });
  assert.deepEqual(JSON.parse(await readFile(join(root, path), 'utf8')).parts[0].keyforms['-30'][0], [2, 0]);
  await assert.rejects(saveNineAxis(root, { path, version, document: doc }), /已变化/);
  const changed = structuredClone(edited); changed.parts[0].texture = 'layers/other.png';
  await assert.rejects(saveNineAxis(root, { path, version: saved.version, document: changed }), /不能替换图层/);
});
