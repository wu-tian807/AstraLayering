import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizedStages, provenanceSummary, coverageRows, selectedAssemblies, tuningRounds, candidateMetrics, candidateMotionTarget, candidateResponseCurves, selectedFindings, selectedEvents, recordedCurve, curveGeometry, responseProbes, sampleResponse } from '../studio/physics-workflow-model.js';

test('current manual approval never becomes workflow acceptance through archived production records', () => {
  const data = { source: 'manual', stages: [{ id: 'review', status: 'accepted' }], provenance: { configHash: 'current', workflowAccepted: true, manualReview: { status: 'approved', configHash: 'current' } }, evidence: { configHash: 'older' } };
  assert.equal(provenanceSummary(data).workflowAccepted, false);
  assert.equal(provenanceSummary(data).evidenceCurrent, false);
  assert.match(provenanceSummary(data).title, /人工已认可/);
  assert.match(provenanceSummary(data).detail, /复现待验证/);
  data.provenance.manualReview.configHash = 'older';
  assert.match(provenanceSummary(data).title, /待确认/);
  assert.equal(provenanceSummary(data, true).evidenceCurrent, false);
});

test('workflow acceptance requires explicit acceptance and evidence for the current configuration', () => {
  const data = { source: 'workflow', provenance: { configHash: 'new', workflowAccepted: true }, evidence: { configHash: 'old' } };
  assert.equal(provenanceSummary(data).workflowAccepted, false);
  data.evidence.configHash = 'new';
  assert.equal(provenanceSummary(data).workflowAccepted, true);
  assert.equal(provenanceSummary(data, true).workflowAccepted, false);
  const changedSolver = { ...data, provenance: { ...data.provenance, evidenceMatchesCurrent: false } };
  assert.equal(provenanceSummary(changedSolver).evidenceCurrent, false);
  assert.equal(provenanceSummary(changedSolver).workflowAccepted, false);
});

test('missing stages and explicitly fixed parts stay distinct from completed bindings', () => {
  assert.deepEqual(normalizedStages().map(stage => stage.status), ['pending', 'pending', 'pending']);
  assert.deepEqual(normalizedStages({ stages: [{ id: 'analyze', status: 'running' }] }).map(stage => stage.status), ['running', 'pending', 'pending']);
  const rows = coverageRows({ regions: [{ family: 'hair', bound: [{ component: 'front' }], fixed: [{ part: 'crown', reason: '贴头固定' }], deferred: [{ part: 'tail', reason: '需确认根部' }] }] });
  assert.equal(rows[0].bound.length, 1);
  assert.equal(rows[0].fixed[0].part, 'crown');
  assert.equal(rows[0].deferred.length, 1);
  assert.deepEqual(coverageRows(), []);
});

test('selection filters connections, tuning rounds and evidence to the actual component IDs', () => {
  const groups = [{ id: 'hair', assemblyId: 'hair', componentIds: ['front', 'ribbon'], links: [{ parent: 'ribbon', child: 'front' }], rounds: [{ round: 1, candidates: [] }] }, { id: 'skirt', componentIds: ['hem'], rounds: [] }];
  assert.deepEqual(selectedAssemblies({ groups }, 'front').map(group => group.id), ['hair']);
  assert.equal(tuningRounds({ groups }, 'front')[0].assemblyId, 'hair');
  assert.equal(tuningRounds({ groups }, 'unknown').length, 0);
  assert.deepEqual(candidateMetrics({ metrics: { airflow: { front: { peak: 4, maxStep: .05, fallback: 1, limited: 2 }, hem: { peak: 40, maxStep: 10 } }, impulse: { front: { peak: 5, maxStep: .08, fallback: 0, limited: 3 } } } }, 'front'), { peak: 5, maxStep: .08, fallback: 1, limited: 5 });
  assert.equal(candidateMetrics({}, 'front'), null);
  assert.deepEqual(selectedFindings({ components: [{ id: 'front', criteria: { shape: { verdict: 'supported' } } }, { id: 'hem', criteria: { shape: { verdict: 'uncertain' } } }] }, 'front').map(row => row.verdict), ['supported']);
  assert.deepEqual(selectedEvents({ events: [{ component: 'front', step: 30 }, { component: 'hem', step: 2 }, { component: 'front', step: 10 }] }, 'front').map(event => event.step), [10, 30]);
});

test('curve rendering rejects nonfinite samples and keeps signed overshoot with stationary clocks', () => {
  const points = recordedCurve({ curves: { front: [[0, 3], [1, -2], [2, NaN], [Infinity, 4]] } }, 'front');
  assert.deepEqual(points, [[0, 3], [1, -2]]);
  const geometry = curveGeometry([{ id: 'tip', points }]);
  assert.equal(geometry.extent, 3);
  assert.match(geometry.series[0].path, /^M/);
  assert.doesNotMatch(geometry.series[0].path, /NaN|Infinity/);
  const stationary = curveGeometry([{ id: 'tip', points: [[0, 0], [0, 0]] }]);
  assert.doesNotMatch(stationary.series[0].path, /NaN|Infinity/);
});

test('tuning comparison uses the same component and standard input for every candidate', () => {
  const round = { selectedCandidate: 'soft', candidates: [{ id: 'base', metrics: { airflow: { front: { samples: [{ time: 0, tip: [0, 0] }, { time: 1, tip: [4, 2] }] }, hem: { samples: [{ time: 1, tip: [99, 0] }] } } } }, { id: 'soft', metrics: { airflow: { front: { samples: [{ time: 0, tip: [0, 0] }, { time: 1, tip: [-2, 1] }, { time: 2, tip: [NaN, 0] }] } } } }] };
  const curves = candidateResponseCurves(round, 'front', 'airflow');
  assert.deepEqual(curves.map(curve => curve.points), [[[0, 0], [1, 4]], [[0, 0], [1, -2]]]);
  assert.deepEqual(curves.map(curve => curve.selected), [false, true]);
  assert.deepEqual(candidateResponseCurves(round, undefined, 'airflow'), []);
  assert(curves.every(curve => !curve.points.some(point => point[1] === 99)));
});
test('movement target display follows the selected component and input, preserving failed activity ratios',()=>{
  const target={ratios:{peak:.3,activity:.25},freeLengthRatio:.45,issues:['reference-amplitude']};
  const candidate={metrics:{airflow:{front:{target},hem:{target:{ratios:{peak:1,activity:1}}}}}};
  assert.deepEqual(candidateMotionTarget(candidate,'front','airflow'),target);
  assert.equal(candidateMotionTarget(candidate,'front','light-brush'),null);
  assert.equal(candidateMotionTarget(candidate,undefined,'airflow'),null);
});

test('live responses remove current support motion while preserving local middle and tip deformation', () => {
  const body = { component: { supports: [{ at: [0, 0] }] }, rest: new Float64Array([0, 0, 0, 5, 0, 10]), weights: new Float64Array([0, .5, 1]), pose: new Float64Array([30, 40, 30, 45, 30, 50]), positions: new Float64Array([30, 40, 32, 45, 34, 50]), stats: { root: 0 } };
  const probes = responseProbes(body);
  assert.equal(probes?.tip, 2);
  assert.equal(probes?.mid, 1);
  assert.deepEqual(sampleResponse(body, probes), { root: 0, mid: 2, tip: 4 });
  body.positions.set(body.pose);
  assert.deepEqual(sampleResponse(body, probes), { root: 0, mid: 0, tip: 0 });
  body.positions[2] = NaN;
  assert.equal(sampleResponse(body, probes), null);
});
