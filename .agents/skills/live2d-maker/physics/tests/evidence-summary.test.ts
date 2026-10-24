import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEvidence } from '../evidence-summary.ts';

test('complete trajectories stay out of model context while failures and provenance remain visible', () => {
  const manifest = { configHash: 'current-config', simulationHash: 'current-solver', renderHash: 'current-render',
    coverage: { numerical: 'all-steps-all-meshes', aiVisual: 'unreviewed' },
    runs: Array.from({ length: 9 }, (_, n) => ({ test: 'input-' + n, durationSteps: 3360,
      frameSteps: [0, 60, 96, 180, 360, 960, 3348, 3360], events: [{ type: 'fallback', component: 'hair', step: 60 }],
      metrics: { invalidSteps: 1, fallbackSteps: 3, maxRoot: .1, motionReview: {
        components: { hair: { issues: ['continuous-fallback'], maxFallbackStreak: 3, recovery: { passed: false } } } } },
      curves: Array.from({ length: 46 }, (_, i) => ({ id: 'part-' + i, points: Array.from({ length: 841 }, (_, step) => [step / 30, Math.sin(step)]) })),
      trace: 'input-' + n + '/trace.jsonl.gz', plot: 'input-' + n + '/curves.svg' })) };
  const original = JSON.stringify(manifest), result = summarizeEvidence(manifest), encoded = JSON.stringify(result);
  assert(encoded.length < 10_000, 'A nine-input response must not transfer millions of curve coordinates');
  assert(original.length > encoded.length * 100);
  assert.equal(JSON.stringify(manifest), original, 'The complete producer evidence remains unchanged');
  assert.equal(result.configHash, manifest.configHash); assert.equal(result.simulationHash, manifest.simulationHash);
  assert.equal(result.renderHash, manifest.renderHash); assert.equal(result.coverage.aiVisual, 'unreviewed');
  assert.equal(result.runs.length, 9);
  for (const run of result.runs) {
    assert.equal(run.curves, undefined); assert.equal(run.events, undefined); assert.equal(run.frameSteps, undefined);
    assert.equal(run.curveCount, 46); assert.equal(run.frameCount, 8); assert.equal(run.eventCount, 1);
    assert.equal(run.metrics.invalidSteps, 1); assert.equal(run.metrics.fallbackSteps, 3);
    assert.deepEqual(run.metrics.motionReview.components.hair.issues, ['continuous-fallback']);
    assert.equal(run.metrics.motionReview.components.hair.recovery.passed, false);
    assert.match(run.trace, /trace\.jsonl\.gz$/); assert.match(run.plot, /curves\.svg$/);
  }
});

test('a focused index keeps actual first fallback and peak windows without expanding curves', () => {
  const run = { test: 'airflow', metrics: { fallbackSteps: 1 }, frameSteps: [0, 60, 180], curves: [],
    events: [{ type: 'fallback', component: 'skirt', step: 60 }, { type: 'fallback', component: 'skirt', step: 72 },
      { type: 'peak', component: 'skirt', step: 83, travel: 42 }, { type: 'peak', component: 'hair', step: 180, travel: 17 }] };
  const summary = summarizeEvidence({ runs: [run, { ...run, test: 'neutral' }] }, 'airflow');
  assert.equal(summary.runs.length, 1);
  assert.deepEqual(summary.runs[0].windows, [
    { component: 'skirt', firstFallback: 60, peak: 83, peakTravel: 42 },
    { component: 'hair', firstFallback: undefined, peak: 180, peakTravel: 17 },
  ]);
  assert.equal(summary.runs[0].metrics.fallbackSteps, 1);
});
