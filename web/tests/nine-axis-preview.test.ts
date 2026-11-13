import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nineAxisCapabilities } from '../../.agents/skills/live2d-maker/shared/nine-axis-model.js';
import { nextPreviewSelection, nineAxisPreviewModes } from '../../.agents/skills/live2d-maker/shared/nine-axis-preview.js';

const rest = [[0, 0], [10, 0], [0, 10], [10, 10]];
function fixture(): any {
  const part = (id: string, level: string, full = false) => ({ id, level, cols: 1, rows: 1, bbox: [0, 0, 10, 10],
    textureBounds: [0, 0, 10, 10], texture: 'layers/0.png', keyforms: { '-30': rest, '0': rest, '30': rest },
    ...(full ? { keyformsY: { '-25': rest, '25': rest }, keyformsXY: Object.fromEntries([-30, 30].flatMap(x => [-25, 25].map(y => [`${x},${y}`, rest]))) } : {}) });
  return { version: 2, kind: 'head-nine-axis', authoring: { stage: 'accessories' },
    parameters: [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [0], status: '本步仅制作左右' }],
    levels: [{ id: 'face', includes: ['face'] }, { id: 'hair', includes: ['face', 'hair'] }, { id: 'accessory', includes: ['face', 'hair', 'accessory'] }],
    deformers: [], parts: [part('face/eyes', 'face', true), part('hair/front', 'hair'), part('head_accessories/hat', 'accessory')] };
}

test('face retains its full authored plane while cumulative hair and accessories have independent horizontal limits', () => {
  const doc = fixture(), before = JSON.stringify(doc), [face, hair, accessory] = nineAxisPreviewModes(doc);
  assert.deepEqual([face.available, hair.available, accessory.available], [true, true, true]);
  assert.equal(face.axes.region, 'plane'); assert.deepEqual(face.axes.y.keys, [-25, 0, 25]);
  for (const mode of [hair, accessory]) { assert.equal(mode.axes.region, 'horizontal'); assert.deepEqual(mode.axes.y.keys, [0]); }
  assert.equal(nineAxisCapabilities(doc).region, 'horizontal', 'the production authoring scope stays unchanged');
  assert.equal(JSON.stringify(doc), before, 'preview never rewrites model parameters or forms');
  assert.equal(nineAxisPreviewModes(doc, false)[0].axes.region, 'cross', 'an unfinished merge cannot announce corners');
});

test('static unmade context cannot unlock a combination or restrict authored face motion', () => {
  const doc = fixture();
  doc.parts = [doc.parts[0], { ...doc.parts[1], id: '__kra__/unmade-hair', keyforms: { '0': rest } }];
  const [face, hair, accessory] = nineAxisPreviewModes(doc);
  assert.equal(face.axes.plane, true); assert.equal(hair.available, false); assert.equal(accessory.available, false);
  assert.equal(hair.scope.has('__kra__/unmade-hair'), false);
});

test('capabilities include actual Warp ancestors and clip sources but not unrelated nodes', () => {
  const doc = fixture();
  doc.deformers = [{ ...doc.parts[1], id: 'shared-carrier' }];
  assert.equal(nineAxisPreviewModes(doc)[0].axes.plane, true);
  doc.parts[0].parent = 'shared-carrier';
  assert.equal(nineAxisPreviewModes(doc)[0].axes.plane, false);
  delete doc.parts[0].parent;
  doc.parts[0].clip = { by: ['head_accessories/hat'] };
  const face = nineAxisPreviewModes(doc)[0];
  assert.equal(face.scope.has('head_accessories/hat'), true); assert.equal(face.axes.plane, false);
});

test('newly made combinations become default once; saves preserve manual selection and removals fall back', () => {
  const doc = fixture(), modes = nineAxisPreviewModes(doc);
  let state = nextPreviewSelection(null, modes.map(mode => ({ ...mode, available: mode.id === 'face' })));
  assert.equal(state.level, 'face');
  state = nextPreviewSelection(state, modes.map(mode => ({ ...mode, available: mode.id !== 'accessory' })));
  assert.equal(state.level, 'hair');
  state.level = 'face';
  state = nextPreviewSelection(state, modes.map(mode => ({ ...mode, available: mode.id !== 'accessory' })));
  assert.equal(state.level, 'face', 'polling does not take away a manual choice');
  state = nextPreviewSelection(state, modes); assert.equal(state.level, 'accessory');
  state = nextPreviewSelection(state, modes.map(mode => ({ ...mode, available: mode.id !== 'accessory' })));
  assert.equal(state.level, 'hair');
  state = nextPreviewSelection(state, modes); assert.equal(state.level, 'accessory');
});
