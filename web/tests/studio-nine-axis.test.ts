import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateHeadNineAxis, keyformAt, lattice, refine, levelParts, dragKeyform, deformerTree, evaluatePoints, nodes, meshIndices } from '../../.agents/skills/live2d-maker/shared/nine-axis-model.js';
import { legacyNineAxisArtifacts } from '../../.agents/skills/live2d-maker/shared/nine-axis.ts';

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
  assert.throws(() => validateHeadNineAxis({ version: 2, deformers: [], kind: 'head-nine-axis', levels: [{ id: 'hair', includes: ['hair'] }], parts: [{ ...p, keyformsY: { '30': rest.slice(1) } }] }), /Y 关键形 30/);
});

test('Diagonal corners blend bilinearly with the axis keyforms', () => {
  const corner = rest.map(([x, y]) => [x - 40, y - 10]);
  const p = part({ '0': rest, '-30': rest.map(([x, y]) => [x - 30, y]) }, { keyformsY: { '30': rest.map(([x, y]) => [x, y - 6]) }, keyformsXY: { '-30,30': corner } });
  assert.deepEqual([...keyformAt(p, -30, 30)].slice(0, 2), [-40, -10]);
  assert.deepEqual([...keyformAt(p, -15, 15)].slice(0, 2), [(-30 - 40) / 4, (-6 - 10) / 4]);
  assert.deepEqual([...keyformAt(p, -30, 0)].slice(0, 2), [-30, 0], '轴上的关键形不受斜向角影响');
  assert.throws(() => validateHeadNineAxis({ version: 2, deformers: [], kind: 'head-nine-axis', levels: [{ id: 'hair', includes: ['hair'] }], parts: [{ ...p, keyformsXY: { '-30': corner } }] }), /斜向 关键形参数无效/);
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
  const doc = (p: any) => ({ version: 2, deformers: [], kind: 'head-nine-axis', levels: [{ id: 'face', includes: ['face'] }], parts: [p] });
  assert.throws(() => validateHeadNineAxis(doc(part({ '-30': rest }))), /静止关键形/);
  assert.throws(() => validateHeadNineAxis(doc(part({ '0': rest.slice(1) }))), /4 个控制点/);
  assert.throws(() => validateHeadNineAxis(doc(part({ '0': rest }, { level: 'body' }))), /未知层级/);
});

test('Validation accepts mask parts and clips that name other parts', () => {
  const doc = (...parts: any[]) => ({ version: 2, deformers: [], kind: 'head-nine-axis', levels: [{ id: 'hair', includes: ['hair'] }], parts });
  const mask = part({ '0': rest }, { id: 'hair/mask', role: 'mask' });
  assert.doesNotThrow(() => validateHeadNineAxis(doc(mask, part({ '0': rest }, { clip: { by: ['hair/mask'], invert: true } }))));
  assert.throws(() => validateHeadNineAxis(doc(mask, part({ '0': rest }, { clip: { by: ['hair/none'] } }))), /裁切来源无效/);
  assert.throws(() => validateHeadNineAxis(doc(part({ '0': rest }, { role: 'shadow' }))), /未知角色/);
});

test('Pink Doll ships authored face warps, local feature meshes and fixed neck', async () => {
  const doc = validateHeadNineAxis(JSON.parse(await readFile(new URL('../../demos/pink-doll/' + legacyNineAxisArtifacts.headDeformers, import.meta.url), 'utf8')));
  assert.ok(doc.parts.every((p: any) => /^(face|hair)\/|^neck(\/|$)|^head_accessories/.test(p.id)), '只含头部图层');
  assert.deepEqual(doc.levels.map((l: any) => l.id), ['face']);
  assert.ok(doc.deformers.length > 0);
  assert.ok(doc.parts.some(p => p.parent));
  assert.ok(levelParts(doc, 'face').every((p: any) => p.level === 'face'));
  for (const p of doc.parts) {
    await readFile(new URL('../../demos/pink-doll/nine-axis/step02_angle-x/' + p.texture, import.meta.url));
    assert.deepEqual(Object.keys(p.keyforms).sort(), ['-30', '0', '30'].sort());
  }
  assert.deepEqual(deformerTree(doc).map((l: any) => l.id), ['face']);
  const neck = doc.parts.find(p => p.id === 'neck')!;
  assert.equal(neck.parent, undefined);
  assert.deepEqual(neck.keyforms['-30'], neck.keyforms['0']);
  assert.deepEqual(neck.keyforms['30'], neck.keyforms['0']);
  for(const x of [-30,-15,0,15,30]){
    assert.deepEqual([...evaluatePoints(doc,neck,x,0)],neck.keyforms['0'].flat());
    for(const n of nodes(doc)){
      const points=evaluatePoints(doc,n,x,0,2),indices=meshIndices(n.cols*2,n.rows*2);
      for(let i=0;i<indices.length;i+=3){const a=indices[i]*2,b=indices[i+1]*2,c=indices[i+2]*2;
        const area=(points[b]-points[a])*(points[c+1]-points[a+1])-(points[b+1]-points[a+1])*(points[c]-points[a]);
        assert.ok(area<0,`${n.id} folded at ${x},0`);
      }
    }
  }
});
