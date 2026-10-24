import { ComponentScene } from '../physics-core/component-physics-model.js';
import { airflowAt } from '../physics-core/physics-airflow.js';
import { applyTestInput } from './physics-test-input.js';

export function advancePhysicsJob(scene, job) {
  let { elapsed, replayStep, playback } = job;
  for (const command of job.commands || []) {
    if (command.type === 'impulse') scene.bodies.get(command.id)?.impulse(...command.args);
  }
  let paused = false;
  for (let k = 0; k < job.steps; k++) {
    elapsed += 1 / 120;
    if (playback) applyTestInput(scene, playback, ++replayStep);
    else scene.airflow = job.breeze ? airflowAt(elapsed, job.strength, job.direction) : { x: 0, y: 0 };
    scene.step();
    if (replayStep >= 960) {
      if (job.demo) { scene.reset(); replayStep = 0; }
      else { playback = ''; paused = true; }
    }
  }
  return { elapsed, replayStep, playback, paused };
}

const fields = ['p', 'pPose', 'pose', 'positions', 'velocity'];
export function physicsSnapshot(scene, buffer) {
  let length = 0;
  for (const body of scene.bodies.values()) for (const field of fields) length += body[field].length;
  const data = buffer?.byteLength === length * 8 ? new Float64Array(buffer) : new Float64Array(length);
  const components = []; let offset = 0;
  for (const [id, body] of scene.bodies) {
    const arrays = {};
    for (const field of fields) { arrays[field] = [offset, body[field].length]; data.set(body[field], offset); offset += body[field].length; }
    components.push({ id, arrays, stats: body.stats, impulses: body.impulses, angularVelocity: body.angularVelocity });
  }
  return { buffer: data.buffer, components, sourcePose: scene.sourcePose, clockStep: scene.stepNumber };
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  let scene;
  self.onmessage = ({ data: job }) => {
    try {
      if (job.type === 'init') { scene = new ComponentScene(job.config); self.postMessage({ type: 'ready' }); return; }
      if (job.type === 'reset') { scene.reset(); return; }
      const clock = advancePhysicsJob(scene, job), snapshot = physicsSnapshot(scene, job.buffer);
      self.postMessage({ type: 'frame', epoch: job.epoch, manual: job.manual, ...clock, ...snapshot }, [snapshot.buffer]);
    } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
  };
  // A top-level dependency can load asynchronously. Signal that the handler is
  // installed before the page sends the initial model.
  self.postMessage({ type: 'boot' });
}
