import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { configHash } from '../../shared/physics-evidence/store.ts';
import { createFrameRenderer } from '../render-cache.ts';

async function fixture(t: any) {
  const root = await mkdtemp(join(tmpdir(), 'astra-render-cache-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'), evidence = join(root, 'evidence');
  await Promise.all([mkdir(source), mkdir(evidence)]);
  const config = { source: { canvas: { width: 1, height: 1 } }, components: [{ id: 'hair', enabled: true }, { id: 'robe', enabled: true }] };
  const manifest = { configHash: configHash(config), simulationHash: 'solver', renderHash: 'pixels', renderDirectory: '../source',
    framePadding: 0, coverage: { render: 'completed' }, runs: [{ test: 'airflow', durationSteps: 960 }] };
  const frames: any[] = [], calls: any[] = [];
  const metadata = (step: number, mode = 'color', component?: string) => ({ test: 'airflow', step, mode,
    path: `airflow/${component ?? 'frames'}/${step}-${mode}.png`, configHash: manifest.configHash, renderHash: manifest.renderHash,
    ...(component ? { component, rect: { width: 1, height: 1 } } : {}) });
  async function image(step: number, mode = 'color', component?: string, width = 1) {
    const frame = metadata(step, mode, component), path = join(evidence, frame.path);
    await mkdir(join(path, '..'), { recursive: true });
    await sharp({ create: { width, height: 1, channels: 4, background: '#ffffff' } }).png().toFile(path);
    frames.push(frame); return frame;
  }
  async function save() {
    await writeFile(join(evidence, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(evidence, 'frames.json'), JSON.stringify(frames));
  }
  const dependencies = { fingerprint: async () => 'pixels', simulationHash: async () => 'solver', render: async (_c: any, _s: string, _e: string, requests: any[]) => {
    calls.push(requests);
    return requests.flatMap(request => request.steps.flatMap((step: number) => request.modes.flatMap((mode: string) => [metadata(step, mode),
      ...(request.components ?? []).map((id: string) => metadata(step, mode, id))])));
  } };
  return { source, evidence, config, manifest, frames, calls, metadata, image, save, dependencies };
}

test('current whole-frame requests reuse pictures without creating unrequested component crops', async t => {
  const f = await fixture(t); const frame = await f.image(180); await f.save();
  const before = await readFile(join(f.evidence, 'manifest.json'), 'utf8');
  const result = await createFrameRenderer(f.dependencies)(f.config, f.source, f.evidence, [{ test: 'airflow', steps: [180], modes: ['color'] }]);
  assert.deepEqual(result, [frame]); assert.equal(f.calls.length, 0);
  assert.equal(await readFile(join(f.evidence, 'manifest.json'), 'utf8'), before);
});

test('explicit required crops are retained, and only a missing component is captured', async t => {
  const f = await fixture(t); await f.image(180); await f.image(180, 'color', 'hair'); await f.save();
  const result = await createFrameRenderer(f.dependencies)(f.config, f.source, f.evidence,
    [{ test: 'airflow', steps: [180], modes: ['color'], cropSteps: [180] }]);
  assert.deepEqual(f.calls[0], [{ test: 'airflow', steps: [180], modes: ['color'], components: ['robe'] }]);
  assert.deepEqual(result.map(frame => frame.component ?? 'full'), ['full', 'hair', 'robe']);
});

test('truncated or missing pictures are regenerated while intact other steps remain cached', async t => {
  const f = await fixture(t); await f.image(0); const damaged = await f.image(180);
  f.frames.push(f.metadata(360)); await f.save(); await writeFile(join(f.evidence, damaged.path), Buffer.from('broken'));
  await createFrameRenderer(f.dependencies)(f.config, f.source, f.evidence, [{ test: 'airflow', steps: [0, 180, 360], modes: ['color'] }]);
  assert.deepEqual(f.calls[0], [{ test: 'airflow', steps: [180, 360], modes: ['color'], components: [] }]);
});

test('source pixel dimensions prevent accepting resized cached images', async t => {
  const f = await fixture(t); await f.image(180, 'color', undefined, 2); await f.save();
  await createFrameRenderer(f.dependencies)(f.config, f.source, f.evidence, [{ test: 'airflow', steps: [180], modes: ['color'] }]);
  assert.equal(f.calls.length, 1);
});

test('changed render, configuration or solver fingerprints never grant a cache hit', async t => {
  const f = await fixture(t); await f.image(180); await f.save();
  await createFrameRenderer({ ...f.dependencies, fingerprint: async () => 'new-pixels' })(f.config, f.source, f.evidence,
    [{ test: 'airflow', steps: [180], modes: ['color'] }]);
  assert.deepEqual(f.calls[0], [{ test: 'airflow', steps: [180], modes: ['color'], cropSteps: [] }]);
  await createFrameRenderer(f.dependencies)({ ...f.config, solver: 'changed' }, f.source, f.evidence,
    [{ test: 'airflow', steps: [180], modes: ['color'] }]);
  await createFrameRenderer({ ...f.dependencies, simulationHash: async () => 'new-solver' })(f.config, f.source, f.evidence,
    [{ test: 'airflow', steps: [180], modes: ['color'] }]);
  assert.equal(f.calls.length, 3);
});

test('partial evidence retains valid full-size frames and only renders missing crops without granting review', async t => {
  const f = await fixture(t);f.manifest.coverage.render='partial';
  const whole=await f.image(180),hair=await f.image(180,'color','hair');await f.save();
  await writeFile(join(f.evidence,'viewed.json'),'[]');
  const before=await readFile(join(f.evidence,'manifest.json'),'utf8'),pixels=await readFile(join(f.evidence,whole.path));
  const result=await createFrameRenderer(f.dependencies)(f.config,f.source,f.evidence,[{test:'airflow',steps:[180],modes:['color'],cropSteps:[180]}]);
  assert.deepEqual(f.calls[0],[{test:'airflow',steps:[180],modes:['color'],components:['robe']}]);assert.deepEqual(result.slice(0,2),[whole,hair]);
  assert.deepEqual(await readFile(join(f.evidence,whole.path)),pixels);assert.equal(await readFile(join(f.evidence,'manifest.json'),'utf8'),before);assert.equal(await readFile(join(f.evidence,'viewed.json'),'utf8'),'[]');
});

test('missing times are batched by mode and explicit component requests keep their local crops', async t => {
  const f = await fixture(t); await f.image(0); await f.save();
  await createFrameRenderer(f.dependencies)(f.config, f.source, f.evidence,
    [{ test: 'airflow', steps: [0, 180, 360], modes: ['color', 'lit'], components: ['hair'] }]);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].length, 2);
  assert(f.calls[0].every((request: any) => request.components.length === 1 && request.components[0] === 'hair'));
});
