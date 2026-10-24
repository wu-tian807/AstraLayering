import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRecordedFrame } from '../../shared/physics-evidence/physics-recorded-frame.js';

function fixture() {
  const body = () => ({ positions: new Float64Array(4), pose: new Float64Array(4), velocity: new Float64Array(2), stats: {} });
  const scene = { bodies: new Map([['hair', body()], ['cloth', body()]]), stepNumber: 0, sourcePose: { x: 0, y: 0, angle: 0 }, airflow: { x: 0, y: 0 } };
  const row = () => ({ positions: [1, 2, 3, 4], pose: [2, 3, 4, 5], velocity: [6, 7], stats: { valid: true, fallback: false, limited: false, travel: 1 } });
  const frame = { step: 228, time: 1.9, sourcePose: { x: 9.6, y: 0, angle: .005 }, airflow: { x: 2, y: 3 }, components: { hair: row(), cloth: row() } };
  return { scene, frame };
}
test('recorded display meshes and parent pose are installed exactly, without integrating or retaining mutable frame data', () => {
  const { scene, frame } = fixture(); applyRecordedFrame(scene, frame);
  for (const body of scene.bodies.values()) {
    assert.deepEqual(Array.from(body.positions), [1, 2, 3, 4]);
    assert.deepEqual(Array.from(body.pose), [2, 3, 4, 5]);
    assert.deepEqual(Array.from(body.velocity), [6, 7]);
  }
  assert.equal(scene.stepNumber, 228); assert.deepEqual(scene.sourcePose, frame.sourcePose); assert.deepEqual(scene.airflow, frame.airflow);
  frame.sourcePose.x = 123; frame.components.cloth.positions[0] = 123; frame.components.cloth.stats.travel = 123;
  assert.equal(scene.sourcePose.x, 9.6); assert.equal(scene.bodies.get('cloth')!.positions[0], 1); assert.equal((scene.bodies.get('cloth')!.stats as any).travel, 1);
});
test('malformed, missing or nonfinite recorded states are rejected atomically', () => {
  const mutations = [
    (f: any) => { f.step = 1.5; }, (f: any) => { f.time = 2; },
    (f: any) => { f.sourcePose.angle = NaN; }, (f: any) => { f.airflow = null; },
    (f: any) => { delete f.components.cloth; }, (f: any) => { f.components.extra = f.components.hair; },
    (f: any) => { f.components.cloth.positions.pop(); }, (f: any) => { f.components.cloth.positions[2] = Infinity; },
    (f: any) => { f.components.cloth.pose = null; }, (f: any) => { f.components.cloth.velocity[1] = NaN; },
    (f: any) => { f.components.cloth.stats.valid = undefined; }, (f: any) => { f.components.cloth.stats.travel = Infinity; },
  ];
  for (const mutate of mutations) {
    const { scene, frame } = fixture(); mutate(frame); assert.throws(() => applyRecordedFrame(scene, frame));
    assert.equal(scene.stepNumber, 0); assert.deepEqual(scene.sourcePose, { x: 0, y: 0, angle: 0 });
    for (const body of scene.bodies.values()) assert.deepEqual(Array.from(body.positions), [0, 0, 0, 0]);
  }
});
