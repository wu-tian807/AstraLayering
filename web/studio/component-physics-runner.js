// The Worker owns the fixed-step state. The page keeps an exact mesh snapshot
// for rendering, picking and attachment lookup, with one job in flight.
export class ComponentPhysicsRunner {
  constructor(panel) {
    this.panel = panel; this.epoch = 0; this.commands = []; this.ready = false; this.busy = false;
    this.worker = new Worker(new URL('../shared/physics-evidence/component-physics-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      if (data.type === 'boot') { this.worker.postMessage({ type: 'init', config: panel.config }); return; }
      if (data.type === 'ready') { this.ready = true; return; }
      if (data.type === 'error') { this.fail(data.message); return; }
      if (data.epoch !== this.epoch) return;
      this.busy = false; this.buffer = data.buffer;
      if (!panel.enabled || panel.paused && !data.manual) this.deferred = data;
      else this.apply(data);
    };
    this.worker.onerror = event => { event.preventDefault(); this.fail(event.message); };
    this.resetScene = panel.scene.reset.bind(panel.scene);
    panel.scene.reset = () => { this.resetScene(); this.reset(); };
    for (const [id, body] of panel.bodies) body.impulse = (...args) => this.commands.push({ type: 'impulse', id, args });
  }
  apply(data) {
    const panel = this.panel, values = new Float64Array(data.buffer);
    for (const item of data.components) {
      const body = panel.bodies.get(item.id);
      for (const [field, [offset, length]] of Object.entries(item.arrays)) body[field].set(values.subarray(offset, offset + length));
      body.stats = item.stats; body.impulses = item.impulses; body.angularVelocity = item.angularVelocity;
    }
    panel.scene.sourcePose = data.sourcePose; panel.scene.stepNumber = data.clockStep;
    panel.elapsed = data.elapsed; panel.replayStep = data.replayStep; panel.playback = data.playback;
    if (data.paused) { panel.paused = true; document.querySelector('#component-test').value = ''; panel.sync(); }
    this.present(data.manual);
  }
  present() { this.panel.render(); }
  advance(steps, manual) {
    if (!this.ready || this.busy) return false;
    if (this.deferred) { this.apply(this.deferred); this.deferred = null; }
    const p = this.panel, job = { type: 'advance', epoch: this.epoch, steps, manual, elapsed: p.elapsed, replayStep: p.replayStep, playback: p.playback, breeze: p.breeze, strength: p.breezeStrength, direction: p.breezeDirection, demo: p.demo, commands: this.commands, buffer: this.buffer };
    this.commands = []; this.buffer = null; this.busy = true;
    this.worker.postMessage(job, job.buffer ? [job.buffer] : []);
    return true;
  }
  reset() { this.epoch++; this.busy = false; this.deferred = null; this.commands = []; if(this.ready)this.worker.postMessage({ type: 'reset' }); }
  fail(message) { this.ready = false; this.worker.terminate(); this.panel.enabled = false; this.panel.pointer = null; this.panel.error('物理线程运行失败：' + message); this.panel.sync(); this.panel.changed(); }
  dispose() { this.epoch++; this.worker.terminate(); }
}
