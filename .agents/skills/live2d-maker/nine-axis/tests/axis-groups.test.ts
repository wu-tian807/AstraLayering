import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { axisGroups, runAxisGroups, seedAxis, type AxisGroup } from '../axis-groups.ts';
import { beginStep, completeStep, readStep } from '../../shared/step-chain.ts';
import { runSection } from '../../shared/step-section.ts';
import { evaluatePoints } from '../../shared/nine-axis-model.js';
import { editNineAxis } from '../../shared/nine-axis-edit.js';
import { mirrorDocument } from '../head.ts';
import { partWarpId } from '../ownership.ts';
import { baseline, grid, pts, scale } from './axis-fixtures.ts';

type Hooks = Parameters<typeof runAxisGroups>[1];

test('split brows keep their draw positions and share the same mirrored and pitch motion', async t => {
  const { section } = await fixture(t);
  const neutral = join(section, 'neutral');
  await beginStep(neutral, 'pending');
  const doc = baseline();
  const paint = (name: string, partId: string, bbox: number[]) => {
    const node = grid('face/' + name, bbox);
    node.keyforms['-30'] = pts(node);
    return { ...node, group: 'face', uuid: name, partId: 'character:face/' + partId, textureBounds: [bbox[0], bbox[1], 10, 10] };
  };
  const fragments = [
    paint('brow_left::a', 'brow_left', [20, 20, 30, 30]),
    paint('brow_right::b', 'brow_right', [70, 20, 80, 30]),
    paint('brow_right::c', 'brow_right', [72, 21, 82, 31]),
    paint('brow_left::d', 'brow_left', [23, 21, 33, 31]),
  ];
  doc.parts = [doc.parts[0], ...fragments.slice(0, 2), doc.parts[1], ...fragments.slice(2)];
  doc.parts[0].uuid = 'base';
  doc.parts[3].uuid = 'separator';
  await writeFile(join(neutral, 'deformers.json'), JSON.stringify(doc));
  await writeFile(join(neutral, 'source.json'), '{}');
  const left = partWarpId('character:face/brow_left'), right = partWarpId('character:face/brow_right');
  for (const axis of axisGroups) {
    const directory = join(section, axis);
    await seedAxis(directory, neutral, axis, scale);
    const value = JSON.parse(await readFile(join(directory, `face-${axis}.json`), 'utf8'));
    const seeded = { ...doc, deformers: value.deformers, parts: axis === 'left' ? value.parts.toReversed() : value.parts };
    assert.deepEqual(seeded.parts.map(p => p.id), doc.parts.map(p => p.id));
    assert.equal(seeded.deformers.length, 2);
    for (const p of seeded.parts.filter(p => p.partId)) assert.equal(p.parent, partWarpId(p.partId));
    const y = axis === 'up' ? scale.y[1] : scale.y[0];
    const edited = editNineAxis(seeded, [{ action: 'transform', id: left, x: axis === 'left' ? -30 : 0,
      y: axis === 'left' ? 0 : y, translate: [4, 0] }]);
    const posed = axis === 'left' ? mirrorDocument(edited, doc.axis!, 'keyforms') : edited;
    for (const p of posed.parts.filter(p => p.parent === (axis === 'left' ? right : left))) {
      const rest = evaluatePoints(posed, p, 0, 0);
      const moved = evaluatePoints(posed, p, axis === 'left' ? 30 : 0, axis === 'left' ? 0 : y);
      const shift = axis === 'left' ? -4 : 4;
      assert.ok(moved.every((v, i) => Math.abs(v - rest[i] - (i % 2 ? 0 : shift)) < 0.001),
        `${axis}/${p.id}: ${Array.from(moved, (v, i) => v - rest[i])}`);
    }
  }
});

async function fixture(t: TestContext) {
  const section = await mkdtemp(join(tmpdir(), 'astra-axis-groups-'));
  t.after(() => rm(section, { recursive: true, force: true }));
  const directory = join(section, 'step04_angles');
  const preparations: string[] = [], seeded: AxisGroup[] = [];
  const prepare = async () => {
    const neutral = join(directory, 'neutral'), { status } = await readStep(neutral);
    if (status === 'completed') return;
    await beginStep(neutral, status);
    preparations.push('neutral');
    await writeFile(join(neutral, 'original-layers.json'), '{"fixture":"scheduler input"}\n');
    await completeStep(neutral);
  };
  const seed = async (group: AxisGroup, output: string) => {
    assert.equal((await readStep(join(directory, 'neutral'))).status, 'completed');
    assert.equal(output, join(directory, group));
    seeded.push(group);
    await writeFile(join(output, `face-${group}.json`), JSON.stringify({ fixture: 'seeded author', group }));
    await writeFile(join(output, 'session.json'), JSON.stringify({ threadId: `original-${group}` }));
  };
  return { section, directory, prepare, seed, preparations, seeded };
}

// Exercise the real section markers around the scheduler. merge is an injected
// scheduling hook; these tests neither fit artwork nor claim visual acceptance.
async function runParent(section: string, hooks: Hooks, options: Parameters<typeof runAxisGroups>[2] = {}) {
  return runSection({ directory: section, steps: [{ number: 4, note: 'angles' }],
    async step(step, status) {
      if (status === 'completed') return;
      return async () => { await runAxisGroups(step.directory, hooks, options); };
    },
    async finished(step) {
      return (await Promise.all(axisGroups.map(async group => (await readStep(join(step.directory, group))).status === 'completed'))).every(Boolean);
    },
  });
}

function barrier3() {
  const entered = new Set<AxisGroup>(), ready = Promise.withResolvers<void>();
  return { entered, async enter(group: AxisGroup) {
    assert.ok(!entered.has(group), `${group} must start once`);
    entered.add(group);
    if (entered.size === 3) ready.resolve();
    await ready.promise;
  } };
}

test('all three ready axes run concurrently; parent completes only after all children and merge', { timeout: 5_000 }, async t => {
  const f = await fixture(t), barrier = barrier3();
  const allRunning = Promise.withResolvers<void>(), releaseChildren = Promise.withResolvers<void>();
  const merging = Promise.withResolvers<void>(), releaseMerge = Promise.withResolvers<void>();
  t.after(() => { releaseChildren.resolve(); releaseMerge.resolve(); });
  const workflow = runParent(f.section, { prepare: f.prepare, seed: f.seed,
    async run(group, output) {
      await barrier.enter(group);
      assert.equal(barrier.entered.size, 3);
      allRunning.resolve();
      await releaseChildren.promise;
      await writeFile(join(output, 'result.json'), JSON.stringify({ group }));
    },
    async merge() { merging.resolve(); await releaseMerge.promise; },
  });
  await allRunning.promise;
  assert.deepEqual([...barrier.entered].sort(), ['down', 'left', 'up']);
  assert.deepEqual(f.preparations, ['neutral']);
  assert.deepEqual(f.seeded.toSorted(), ['down', 'left', 'up']);
  assert.equal((await readStep(f.directory)).status, 'running');
  for (const group of axisGroups) assert.equal((await readStep(join(f.directory, group))).status, 'running');
  releaseChildren.resolve();
  await merging.promise;
  for (const group of axisGroups) assert.equal((await readStep(join(f.directory, group))).status, 'completed');
  assert.equal((await readStep(f.directory)).status, 'running', 'completed children still wait for merge');
  await assert.rejects(access(join(f.directory, '.completed')), { code: 'ENOENT' });
  releaseMerge.resolve();
  await workflow;
  assert.equal((await readStep(f.directory)).status, 'completed');
  await assert.rejects(access(join(f.directory, '.running')), { code: 'ENOENT' });
});

test('left failure waits for its active siblings and preserves their completed results', { timeout: 5_000 }, async t => {
  const f = await fixture(t), barrier = barrier3();
  const leftFailed = Promise.withResolvers<void>(), releaseSiblings = Promise.withResolvers<void>();
  t.after(() => releaseSiblings.resolve());
  let settled = false, merges = 0;
  const workflow = runParent(f.section, { prepare: f.prepare, seed: f.seed,
    async run(group, output) {
      await barrier.enter(group);
      if (group === 'left') {
        await writeFile(join(output, 'draft.json'), '{"unfinished":"left"}');
        leftFailed.resolve();
        throw Error('left fitting failed');
      }
      await releaseSiblings.promise;
      await writeFile(join(output, 'result.json'), JSON.stringify({ completed: group }));
    },
    async merge() { merges++; },
  });
  // Attach the rejection assertion before opening the sibling gate.
  const rejected = assert.rejects(workflow, /left fitting failed/).then(() => { settled = true; });
  await leftFailed.promise;
  assert.equal(settled, false, 'the failure must not abandon active siblings');
  for (const group of axisGroups) assert.equal((await readStep(join(f.directory, group))).status, 'running');
  releaseSiblings.resolve();
  await rejected;
  assert.equal(merges, 0);
  assert.equal((await readStep(f.directory)).status, 'running');
  assert.equal((await readStep(join(f.directory, 'left'))).status, 'running');
  for (const group of ['up', 'down'] as const) {
    const output = join(f.directory, group);
    assert.equal((await readStep(output)).status, 'completed');
    assert.deepEqual(JSON.parse(await readFile(join(output, 'result.json'), 'utf8')), { completed: group });
    assert.equal(JSON.parse(await readFile(join(output, 'session.json'), 'utf8')).threadId, `original-${group}`);
  }
});

test('resume runs only failed left, retaining its draft/session and completed siblings byte for byte', { timeout: 5_000 }, async t => {
  const f = await fixture(t), barrier = barrier3(), firstRuns: AxisGroup[] = [];
  await assert.rejects(runParent(f.section, { prepare: f.prepare, seed: f.seed,
    async run(group, output) {
      firstRuns.push(group);
      await barrier.enter(group);
      await writeFile(join(output, 'draft.json'), JSON.stringify({ authored: group }));
      if (group === 'left') throw Error('retry left');
      await writeFile(join(output, 'result.json'), JSON.stringify({ done: group }));
    },
    async merge() { assert.fail('merge cannot run after a child failure'); },
  }), /retry left/);
  assert.deepEqual(firstRuns.toSorted(), ['down', 'left', 'up']);
  const original = new Map<string, Buffer>();
  for (const group of ['up', 'down'] as const) for (const name of ['.completed', `face-${group}.json`, 'session.json', 'draft.json', 'result.json']) {
    const path = join(f.directory, group, name);
    original.set(path, await readFile(path));
  }
  const left = join(f.directory, 'left');
  const leftDraft = await readFile(join(left, 'draft.json')), leftSession = await readFile(join(left, 'session.json'));
  const resumed: AxisGroup[] = [], kept = new Set<AxisGroup>();
  let merges = 0;
  await runParent(f.section, { prepare: f.prepare, seed: f.seed,
    async keep(group) {
      // ready rescans after the resumed child finishes, so left can be kept
      // then too. It must have run once before entering that completed state.
      if (group === 'left') {
        assert.deepEqual(resumed, ['left']);
        assert.equal((await readStep(left)).status, 'completed');
      } else kept.add(group);
    },
    async run(group, output) {
      resumed.push(group);
      assert.equal(group, 'left');
      assert.deepEqual(await readFile(join(output, 'draft.json')), leftDraft);
      assert.deepEqual(await readFile(join(output, 'session.json')), leftSession);
      await writeFile(join(output, 'result.json'), '{"done":"left"}');
    },
    async merge() {
      merges++;
      for (const group of axisGroups) assert.equal((await readStep(join(f.directory, group))).status, 'completed');
    },
  });
  assert.deepEqual(resumed, ['left']);
  assert.deepEqual([...kept].sort(), ['down', 'up']);
  assert.deepEqual(f.preparations, ['neutral']);
  assert.deepEqual(f.seeded.toSorted(), ['down', 'left', 'up'], 'running left must not be reseeded');
  for (const [path, bytes] of original) assert.deepEqual(await readFile(path), bytes, path);
  assert.equal(merges, 1);
  assert.equal((await readStep(f.directory)).status, 'completed');
});

test('targeted children keep the parent running until the last sibling and merge finish', async t => {
  const f = await fixture(t), runs: AxisGroup[] = [];
  let merges = 0;
  const hooks: Hooks = { prepare: f.prepare, seed: f.seed,
    async run(group) { runs.push(group); }, async merge() { merges++; },
  };
  await runParent(f.section, hooks, { group: 'left' });
  assert.equal((await readStep(f.directory)).status, 'running');
  assert.equal((await readStep(join(f.directory, 'left'))).status, 'completed');
  for (const group of ['up', 'down']) assert.equal((await readStep(join(f.directory, group))).status, 'absent');
  assert.equal(merges, 0);
  await runParent(f.section, hooks, { group: 'left' });
  assert.deepEqual(runs, ['left'], 'a completed targeted child is kept');
  assert.equal((await readStep(f.directory)).status, 'running');
  await runParent(f.section, hooks, { group: 'up' });
  assert.equal((await readStep(f.directory)).status, 'running');
  assert.equal(merges, 0);
  await runParent(f.section, hooks, { group: 'down' });
  assert.deepEqual(runs, ['left', 'up', 'down']);
  assert.equal(merges, 1);
  assert.equal((await readStep(f.directory)).status, 'completed');
  assert.deepEqual(f.preparations, ['neutral']);
});
