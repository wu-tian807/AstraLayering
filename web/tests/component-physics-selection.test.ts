import { test } from 'node:test';
import assert from 'node:assert/strict';
import { physicsComponentsAt } from '../studio/component-physics-selection.js';
import { ComponentScene } from '../studio/component-physics-model.js';
import { componentDefaults } from '../studio/component-physics-schema.js';

const layer = (id: string, alpha: number, bounds = { x: 20, y: 20, width: 20, height: 40 }) => {
  const maskedRgba = new Uint8Array(bounds.width * bounds.height * 4);
  for (let i = 3; i < maskedRgba.length; i += 4) maskedRgba[i] = alpha;
  return { id, bounds, maskedRgba };
};
const assignments = new Map([['back', 'hair'], ['front', 'ribbon'], ['front2', 'ribbon']]);

test('opaque unbound artwork blocks hidden components; transparent masks expose the correct component', () => {
  const back = layer('back', 255), face = layer('face', 255);
  assert.deepEqual(physicsComponentsAt([back, face], assignments, new Map(), [30, 40], [100, 100]), []);
  face.maskedRgba[(20 * 20 + 10) * 4 + 3] = 0;
  assert.deepEqual(physicsComponentsAt([back, face], assignments, new Map(), [30, 40], [100, 100]), ['hair']);
});

test('overlapping translucent components preserve draw order and do not duplicate shared layers', () => {
  assert.deepEqual(physicsComponentsAt([layer('back', 255), layer('front', 100), layer('front2', 50)], assignments, new Map(), [30, 40], [100, 100]), ['ribbon', 'hair']);
  assert.deepEqual(physicsComponentsAt([layer('back', 255), layer('front', 255)], assignments, new Map(), [30, 40], [100, 100]), ['ribbon']);
});

test('disabled components remain selectable in the transformed static artwork without enabling physics', () => {
  const l = layer('back', 255), size = [100, 100], pose = { x: 12, y: -8, angle: Math.PI / 2 };
  // Original (30,40) rotates around (50,50) to (60,30), then translates.
  assert.deepEqual(physicsComponentsAt([l], assignments, new Map(), [72, 22], size, pose), ['hair']);
  assert.deepEqual(physicsComponentsAt([l], assignments, new Map(), [30, 40], size, pose), []);
});

test('moving mesh selection samples original alpha through its actual deformed UVs', () => {
  const c = { id: 'hair', name: 'hair', kind: 'pendant', priority: 'primary', enabled: true, sourcePartIds: ['back'], layerRefs: [{ uuid: 'back', contentHash: 'a'.repeat(64) }], supports: [{ id: 'root', at: [20, 20] }], ...componentDefaults('pendant'), authoring: { freeLength: 40, transitionPixels: 5, fixedRegions: [], contour: [[20, 20], [40, 20], [40, 60], [20, 60]], pivot: [20, 20], subdivisions: 0 } };
  const scene = new ComponentScene({ kind: 'astra-component-physics', version: 1, solver: 'astra-component-physics-1', source: { canvas: { width: 100, height: 100 } }, components: [c] });
  const body = scene.bodies.get('hair'), l = layer('back', 120);
  for (let i = 0; i < body.positions.length; i += 2) body.positions[i] += 40;
  assert.equal(body.sampleAlpha(70, 40, [l]), 120);
  assert.deepEqual(physicsComponentsAt([l], assignments, scene.bodies, [70, 40], [100, 100]), ['hair']);
  assert.deepEqual(physicsComponentsAt([l], assignments, scene.bodies, [30, 40], [100, 100]), []);
});
