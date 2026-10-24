import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { studioPhysicsWorkflow, studioPhysicsArtifact } from '../studio-physics-workflow.ts';
import { configHash, simulationHash, evidenceVersion } from '../../.agents/skills/live2d-maker/shared/physics-evidence/store.ts';
import { renderFingerprint } from '../../.agents/skills/live2d-maker/shared/character-render/render-frames.ts';
import { createWorkbench } from '../server.ts';

async function fixture(t: any) {
  const root = await mkdtemp(join(tmpdir(), 'astra-workflow-ui-'));
  const put = async (path: string, value: any) => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = { kind: 'astra-component-physics', version: 1, solver: 'astra-component-physics-1',
    source: { canvas: { width: 100, height: 100 } }, components: [], review: { status: 'accepted' } };
  const digest = configHash(config);
  await put('physics/physics.json', config);
  await put('physics/source/catalog.json', { layers: [] });
  const renderHash = await renderFingerprint(join(root, 'physics/source'));
  const manifest = { version: evidenceVersion, configHash: digest, simulationHash: await simulationHash(),
    renderHash, renderDirectory: '../../source', renderSource: 'assembled', coverage: { render: 'completed' },
    runs: [{ test: 'breeze', plot: 'breeze/curves.svg', curves: [{ id: 'cloth', points: [[0, 0], [1, 5]] }] }] };
  await put('physics/step03/evidence/manifest.json', manifest);
  await put('physics/step03/evidence/frames.json', [{ path: 'breeze/frames/0000-color.png', configHash: digest, renderHash, step: 0 }]);
  await put('physics/step03/evidence/breeze/frames/0000-color.png', 'pixels');
  await put('physics/step03/evidence/breeze/curves.svg', '<svg/>');
  await put('physics/step03/findings.json', { configHash: digest, components: [{ id: 'cloth', criteria: {
    shape: { verdict: 'supported', images: ['breeze/frames/0000-color.png', '../../private.png'] } } }] });
  await put('physics/step03/.completed', '');
  return { root, put, config, digest, manifest };
}

test('current review exposes only indexed artifacts and measured curves', async t => {
  const f = await fixture(t);
  const data = await studioPhysicsWorkflow(f.root, 'project', '/runs');
  assert.equal(data?.provenance.workflowAccepted, true);
  assert.equal(data?.stages[2].status, 'accepted');
  assert.deepEqual(data?.evidence.runs[0].curves[0].points, [[0, 0], [1, 5]]);
  const images = data?.findings.components[0].criteria.shape.images;
  assert.match(images[0].url, /studio-physics-artifact/);
  assert.equal(images[1].url, undefined);
  assert.equal(await studioPhysicsArtifact(f.root, undefined, 'breeze/curves.svg', f.digest), join(f.root, 'physics/step03/evidence/breeze/curves.svg'));
  await assert.rejects(studioPhysicsArtifact(f.root, undefined, '../private.png', f.digest));
  await assert.rejects(studioPhysicsArtifact(f.root, undefined, 'breeze/frames/private.png', f.digest), /未登记/);
  await rm(join(f.root, 'physics/step03/evidence/breeze/curves.svg'));
  await symlink(join(f.root, 'physics/physics.json'), join(f.root, 'physics/step03/evidence/breeze/curves.svg'));
  await assert.rejects(studioPhysicsArtifact(f.root, undefined, 'breeze/curves.svg', f.digest), /符号链接/);
});

test('manual approval never masquerades as workflow acceptance and parameter edits stale evidence', async t => {
  const f = await fixture(t);
  await f.put('physics/manual-review.json', { status: 'approved', configHash: f.digest });
  let data = await studioPhysicsWorkflow(f.root, 'project', '/runs');
  assert.equal(data?.source, 'manual');
  assert.equal(data?.provenance.workflowAccepted, false);
  await f.put('physics/step02/.completed', '');
  data = await studioPhysicsWorkflow(f.root, 'project', '/runs');
  assert.equal(data?.stages[1].status, 'pending', 'an old completion marker is not a calibration record');
  await f.put('physics/physics.draft.json', { ...f.config, profile: 'all' });
  data = await studioPhysicsWorkflow(f.root, 'project', '/runs', 'physics/physics.draft.json');
  assert.equal(data?.stages[2].status, 'stale');
  assert.equal(data?.evidence.runs[0].plotUrl, undefined);
  assert.equal(data?.evidence.frames.length, 0);
  await assert.rejects(studioPhysicsArtifact(f.root, 'physics/physics.draft.json', 'breeze/curves.svg', f.digest), /过期/);
  await f.put('physics/step03/evidence/manifest.json', { ...f.manifest, simulationHash: 'old-solver' });
  data = await studioPhysicsWorkflow(f.root, 'project', '/runs');
  assert.equal(data?.provenance.configMatches, true);
  assert.equal(data?.provenance.solverMatches, false);
  assert.equal(data?.stages[2].status, 'stale');
});

test('the project panel keeps current candidate curves without transferring archived generations', async t => {
  const f = await fixture(t);
  const round = { round: 1, selectedCandidate: 'baseline', candidates: [{ id: 'baseline', metrics: {
    airflow: { cloth: { samples: [{ time: 0, tip: [0, 0] }, { time: 1, tip: [4, 0] }] } }
  } }] };
  const tuning = { configHash: f.digest, solverHash: await simulationHash(), status: 'calibrated',
    groups: [{ assemblyId: 'cloth', componentIds: ['cloth'], rounds: [round], history: [{
      generation: 'old-solver', rounds: Array.from({ length: 100 }, () => round)
    }] }] };
  await f.put('physics/step02/tuning.json', tuning);
  const data = await studioPhysicsWorkflow(f.root, 'project', '/runs');
  assert.deepEqual(data?.tuning.groups[0].rounds, [round]);
  assert.equal(data?.tuning.groups[0].history, undefined);
  assert(JSON.stringify(data?.tuning).length < JSON.stringify(tuning).length / 10);
  assert.equal(JSON.parse(await (await import('node:fs/promises')).readFile(join(f.root, 'physics/step02/tuning.json'), 'utf8')).groups[0].history.length, 1);
});

test('browser and Worker load the skill-owned modules through the workbench', async t => {
  const root = await mkdtemp(join(tmpdir(), 'astra-shared-route-'));
  const server = await createWorkbench({ defaultDir: join(root, 'runs'), settingsPath: join(root, 'settings.json') });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + (server.address() as any).port;
  for (const path of ['/shared/physics-core/component-physics-model.js', '/shared/physics-evidence/component-physics-worker.js',
    '/shared/character-render/renderer.js', '/shared/physics-core/vendor/psd2live/xpbd.js', '/shared/vendor/three.module.js']) {
    const response = await fetch(base + path); assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type')!, /javascript/);
    assert((await response.text()).length > 20);
  }
  for (const [oldPath, newPath] of [['/studio/renderer.js', '/shared/character-render/renderer.js'],
    ['/studio/vendor/psd2live/xpbd.js', '/shared/physics-core/vendor/psd2live/xpbd.js']]) {
    const response = await fetch(base + oldPath);
    assert.equal(response.status, 200); assert.equal(new URL(response.url).pathname, newPath);
  }
  assert.notEqual((await fetch(base + '/shared/physics-evidence/store.ts')).status, 200);
});

test('selected candidates cannot hide a failed author delivery or imply C ran', async t => {
  const f = await fixture(t);
  await rm(join(f.root, 'physics/step03'), { recursive: true });
  await f.put('physics/step02/tuning.json', { configHash: f.digest, solverHash: await simulationHash(), status: 'calibrated', groups: [] });
  await f.put('physics/step02/result.json', { status: 'blocked', summary: 'Persistent retreat after three rounds.' });
  let data = await studioPhysicsWorkflow(f.root, 'project', '/runs');
  assert.equal(data?.stages[1].status, 'failed');
  assert.equal(data?.stages[2].status, 'not-started');
  assert.match(data!.stages[2].reason!, /未通过/);
  assert.equal(data?.provenance.workflowAccepted, false);
  await f.put('physics/physics.draft.json', { ...f.config, profile: 'all' });
  data = await studioPhysicsWorkflow(f.root, 'project', '/runs', 'physics/physics.draft.json');
  assert.equal(data?.stages[1].status, 'stale', 'old failures do not describe edited configurations');
  await f.put('physics/step02/.completed', '');
  data = await studioPhysicsWorkflow(f.root, 'project', '/runs');
  assert.equal(data?.stages[1].status, 'completed', 'a later successful delivery supersedes the blocked outcome');
});
