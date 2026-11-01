import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateHeadNineAxis, keyformAt, lattice, refine, levelParts, dragKeyform, deformerTree } from '../studio/nine-axis-model.js';
import { nineAxisArtifacts } from '../../.agents/skills/live2d-maker/shared/nine-axis.ts';

const part = (keyforms: Record<string, number[][]>, extra = {}): any => ({ id: 'hair/bangs', level: 'hair', texture: 'layers/000.png', textureBounds: [0, 0, 10, 10], bbox: [0, 0, 10, 10], cols: 1, rows: 1, keyforms, ...extra });
const rest = [[0, 0], [10, 0], [0, 10], [10, 10]];

test('Keyforms blend linearly on ParamAngleX and hold beyond the end keys', () => {
  const p = part({ '0': rest, '-30': rest.map(([x, y]) => [x - 30, y]) });
  assert.deepEqual([...keyformAt(p, -15)].slice(0, 2), [-15, 0]);
  assert.deepEqual([...keyformAt(p, -40)].slice(0, 2), [-30, 0]);
  assert.deepEqual([...keyformAt(p, 20)].slice(0, 2), [0, 0]);
});

test('ParamAngleY keyforms add their offset from the rest form to the X blend', () => {
  const p = part({ '0': rest, '-30': rest.map(([x, y]) => [x - 30, y]) }, { keyformsY: { '30': rest.map(([x, y]) => [x, y - 6]), '-30': rest.map(([x, y]) => [x, y + 3]) } });
  assert.deepEqual([...keyformAt(p, 0, 15)].slice(0, 2), [0, -3]);
  assert.deepEqual([...keyformAt(p, -15, -30)].slice(0, 2), [-15, 3]);
  assert.deepEqual([...keyformAt(part({ '0': rest }), 0, 30)].slice(0, 2), [0, 0], '没有 Y 关键形时不动');
  assert.throws(() => validateHeadNineAxis({ version: 1, kind: 'head-nine-axis', levels: [{ id: 'hair', includes: ['hair'] }], parts: [{ ...p, keyformsY: { '30': rest.slice(1) } }] }), /Y 关键形 30/);
});

test('Art mesh refinement follows the warp bilinearly inside each cell', () => {
  const pts = new Float32Array([0, 0, 10, 0, 0, 10, 20, 10]), out = refine(pts, 1, 1, 2);
  assert.deepEqual([...out.slice(8, 10)], [7.5, 5]);  // cell centre
  assert.deepEqual([...lattice(part({ '0': rest }))], [0, 0, 10, 0, 0, 10, 10, 10]);
});

test('Soft selection moves the grabbed point fully and neighbours by falloff only', () => {
  const moved = dragKeyform(rest, 0, 4, 0, 20);
  assert.deepEqual(moved[0], [4, 0]);
  assert.ok(moved[1][0] > 10 && moved[1][0] < 14);
  assert.deepEqual(moved[3], [10 + 4 * (1 - (Math.hypot(10, 10) / 20) ** 2) ** 2, 10]);
  assert.deepEqual(dragKeyform(rest, 0, 4, 0, 0)[1], [10, 0]);
});

test('Validation rejects incomplete keyforms and unknown levels', () => {
  const doc = (p: any) => ({ version: 1, kind: 'head-nine-axis', levels: [{ id: 'face', includes: ['face'] }], parts: [p] });
  assert.throws(() => validateHeadNineAxis(doc(part({ '-30': rest }))), /静止关键形/);
  assert.throws(() => validateHeadNineAxis(doc(part({ '0': rest.slice(1) }))), /4 个控制点/);
  assert.throws(() => validateHeadNineAxis(doc(part({ '0': rest }, { level: 'body' }))), /未知层级/);
});

test('Pink Doll ships a head-only nine-axis document with the three preview levels', async () => {
  const doc = validateHeadNineAxis(JSON.parse(await readFile(new URL('../../demos/pink-doll/' + nineAxisArtifacts.headDeformers, import.meta.url), 'utf8')));
  assert.ok(doc.parts.every((p: any) => /^(face|hair)\/|^head_accessories/.test(p.id)), '只含头部图层');
  assert.deepEqual(doc.levels.map((l: any) => levelParts(doc, l.id).length > 0), [true, true, true]);
  assert.ok(levelParts(doc, 'face').every((p: any) => p.level === 'face'));
  assert.ok(levelParts(doc, 'hair').some((p: any) => p.level === 'hair') && !levelParts(doc, 'hair').some((p: any) => p.level === 'accessory'));
  for (const p of doc.parts) {
    await readFile(new URL('../../demos/pink-doll/nine-axis/step02_angle-x/' + p.texture, import.meta.url));
    assert.deepEqual(Object.keys(p.keyforms).sort(), ['-30', '0', '30'].sort());
  }
  assert.deepEqual(deformerTree(doc).map((l: any) => l.id), ['face', 'hair', 'accessory']);
});
