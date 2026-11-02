import assert from 'node:assert/strict';
import { test } from 'node:test';
import { partReviewRounds, partReviewSkip } from '../part-review.ts';
import { groupArtifacts, groupReviewSteps, groupStagePreviewArtifacts, reviewReportText } from '../progress.js';
import { svgHash, type Review, type ReviewReport } from '../../.agents/skills/live2d-maker/shared/part/artifact-facts.ts';
import type { AgentCall } from '../agent-progress.ts';

const initial = Buffer.from('<svg>initial</svg>'), repaired1 = Buffer.from('<svg>repair1</svg>'), repaired2 = Buffer.from('<svg>repair2</svg>');
const review = (candidate: Buffer, verdict: Review['verdict'], time: number, repaired?: Buffer): Review => ({
  candidateHash: svgHash(candidate), verdict, feedback: `意见 ${time}`, observations: [], updatedAt: new Date(time).toISOString(),
  ...(repaired ? { repairedCandidateHash: svgHash(repaired) } : {}),
});
const call = (mode: 'review' | 'repair', time: number, finished = false, failed = false): AgentCall => ({
  name: `组轮廓${mode === 'review' ? 'review' : '返修'}-face`, step: '', request: `agents/${time}/request.json`, mtime: time, finished, failed,
});
const observe = (reviews: Review[], outline = initial, calls: AgentCall[] = [], active = false) =>
  partReviewRounds('face', { groupId: 'face', reviews }, outline, calls, active);
const states = (rounds: ReturnType<typeof observe>) => rounds.flatMap(round => [round.review.status, round.repair.status]);

test('one skip decision covers different reasons and requires a completed outline', () => {
  assert.deepEqual(partReviewSkip({}, 'completed', true), { skip: false, reason: '' });
  for (const [group, reason] of [[{ hiddenInReference: true }, /原图不可见/],
    [{ outlineFromParent: { x: 0, y: 0, width: 10, height: 10 } }, /父组.*复制/]] as const) {
    for (const status of ['absent', 'unmarked', 'running']) assert.equal(partReviewSkip(group, status, true).skip, false);
    assert.equal(partReviewSkip(group, 'completed', false).skip, false);
    const decision = partReviewSkip(group, 'completed', true);
    assert.equal(decision.skip, true);
    assert.match(decision.reason, reason);
    const rounds = partReviewRounds('face', undefined, initial,
      [call('review', 10, true, true), call('repair', 20)], true, decision);
    assert.deepEqual(states(rounds), ['skipped', 'skipped', 'skipped', 'skipped']);
    assert.ok(rounds.every(round => round.review.detail === decision.reason));
    assert.ok(rounds.every(round => round.review.reportIndex === undefined && round.repair.reportIndex === undefined));
  }
});

test('a saved review does not hide its active agent; repair and second review follow their own calls', () => {
  assert.deepEqual(states(observe([], initial, [call('review', 10)], true)), ['running', 'pending', 'pending', 'pending']);
  const first = review(initial, 'revise', 20);
  assert.deepEqual(states(observe([first], initial, [call('review', 10)], true)), ['running', 'pending', 'pending', 'pending']);
  assert.deepEqual(states(observe([first], initial, [call('review', 10, true), call('repair', 30)], true)), ['done', 'running', 'pending', 'pending']);
  first.repairedCandidateHash = svgHash(repaired1);
  assert.deepEqual(states(observe([first], repaired1, [call('repair', 30)], true)), ['done', 'running', 'pending', 'pending']);
  assert.deepEqual(states(observe([first], repaired1, [call('repair', 30, true), call('review', 40)], true)), ['done', 'done', 'running', 'pending']);
});

test('both quality rounds and repairs are confirmed through the artifact hash chain', () => {
  const reviews = [review(initial, 'revise', 20, repaired1), review(repaired1, 'revise', 50, repaired2)];
  assert.deepEqual(states(observe(reviews, repaired2)), ['done', 'done', 'done', 'done']);
  assert.deepEqual(states(observe(reviews, repaired2, [call('repair', 60)], true)), ['done', 'done', 'done', 'running']);
  assert.deepEqual(states(observe(reviews, repaired2, [call('repair', 60, true)], true)), ['done', 'done', 'done', 'done']);
});

test('first pass skips the remaining work; a second pass skips only its repair', () => {
  assert.deepEqual(states(observe([review(initial, 'pass', 20)])), ['done', 'skipped', 'skipped', 'skipped']);
  assert.deepEqual(states(observe([review(initial, 'revise', 20, repaired1), review(repaired1, 'pass', 50)], repaired1)), ['done', 'done', 'done', 'skipped']);
});

test('blocked inspections do not consume either quality round or hide their feedback', () => {
  let reviews = [review(initial, 'blocked', 20)];
  let rounds = observe(reviews);
  assert.equal(rounds[0].review.status, 'available');
  assert.match(rounds[0].review.detail, /不消耗/);
  assert.deepEqual(states(observe(reviews, initial, [call('review', 30)], true)), ['running', 'pending', 'pending', 'pending']);
  reviews.push(review(initial, 'revise', 40, repaired1), review(repaired1, 'blocked', 60));
  rounds = observe(reviews, repaired1, [call('review', 70)], true);
  assert.deepEqual(states(rounds), ['done', 'done', 'running', 'pending']);
  reviews.push(review(repaired1, 'pass', 80));
  rounds = observe(reviews, repaired1);
  assert.equal(rounds.length, 2);
  assert.deepEqual(states(rounds), ['done', 'done', 'done', 'skipped']);
  assert.equal(rounds[1].review.reportIndex, 3);
});

test('stale or mismatched reports cannot mark current artwork complete or skip work', () => {
  assert.deepEqual(states(observe([review(initial, 'pass', 20)], repaired2)), ['available', 'pending', 'pending', 'pending']);
  const reviews = [review(initial, 'revise', 20, repaired1), review(repaired1, 'revise', 50, repaired2)];
  assert.deepEqual(states(observe(reviews, Buffer.from('<svg>unrelated</svg>'))), ['available', 'available', 'available', 'available']);
  assert.deepEqual(states(partReviewRounds('face', { groupId: 'other', reviews }, repaired2, [], false)), ['pending', 'pending', 'pending', 'pending']);
});

test('retries stay within their round; current failures and replacement calls affect the correct card', () => {
  const reviews = [review(initial, 'revise', 20, repaired1), review(repaired1, 'revise', 50)];
  const calls = [call('repair', 25, true), call('repair', 30, true), call('repair', 35, true), call('repair', 60, true, true)];
  assert.deepEqual(states(observe(reviews, repaired1, calls)), ['done', 'done', 'done', 'failed']);
  calls.push(call('repair', 70));
  assert.deepEqual(states(observe(reviews, repaired1, calls, true)), ['done', 'done', 'done', 'running']);
  assert.deepEqual(states(observe(reviews, repaired1, calls, false)), ['done', 'done', 'done', 'pending'], 'stopped requests do not stay running');
  assert.equal(observe(reviews, repaired1, calls, true).length, 2);
});

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: expanded cards expose separate round reports and stage previews follow drafts`, () => {
  const rounds = observe([review(initial, 'revise', 20, repaired1), review(repaired1, 'pass', 50)], repaired1);
  const steps = groupReviewSteps({ webReviewRounds: rounds }, section, 'face');
  assert.deepEqual(steps.map(step => step.id), ['review-1', 'repair-1', 'review-2', 'repair-2']);
  assert.deepEqual(steps.slice(0, 3).map(step => step.artifacts[0].reviewIndex), [0, 0, 1]);
  assert.equal(steps[3].status, 'skipped');
  const report: ReviewReport = { groupId: 'face', reviews: [review(initial, 'revise', 20, repaired1), review(repaired1, 'pass', 50)] };
  assert.match(reviewReportText(JSON.stringify(report), steps[0].artifacts[0]), /意见 20/);
  assert.doesNotMatch(reviewReportText(JSON.stringify(report), steps[0].artifacts[0]), /意见 50/);
  assert.match(reviewReportText(JSON.stringify(report), steps[2].artifacts[0]), /意见 50/);
  const artifacts = groupArtifacts(section, { id: 'face' }, 0);
  const outline = `${section}/step09_outline/face/outline.svg`, draft = `${section}/parts/face.draft.svg`, final = `${section}/parts/face.svg`;
  const files = new Set([outline, draft, final]);
  const versions = { [outline]: '10:1', [draft]: '30:1', [final]: '20:1' };
  assert.equal(groupStagePreviewArtifacts('outline', artifacts, files, versions)[0].path, outline);
  assert.equal(groupStagePreviewArtifacts('completion', artifacts, files, versions)[0].path, draft);
  files.delete(draft);
  assert.equal(groupStagePreviewArtifacts('completion', artifacts, files, versions)[0].path, final);
  // A reduction rewritten after the part does not replace it in the completion panel.
  const reduced = `${section}/step10_reduce/depth01/face.svg`;
  files.add(reduced); Object.assign(versions, { [reduced]: '40:1' });
  assert.equal(groupStagePreviewArtifacts('completion', artifacts, files, versions)[0].path, final);
  files.delete(final);
  assert.equal(groupStagePreviewArtifacts('completion', artifacts, files, versions)[0].path, reduced);
  files.delete(reduced);
  assert.equal(groupStagePreviewArtifacts('completion', artifacts, files, versions)[0].path, outline);
});
