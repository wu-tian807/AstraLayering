import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayStatus, groupArtifacts, groupPhases, groupPreviewArtifacts, groupSummary, statusNames, stepArtifacts } from '../progress.js';

test('normal progress labels, with 限流等待 apart from running; a partly finished group remains available', () => {
  assert.deepEqual(Object.values(statusNames), ['待执行', '进行中', '限流等待', '已有产物', '已完成', '执行失败', '已中断', '待续跑']);
  const group = { webPhases: Object.fromEntries(groupPhases.map(([id]) => [id, 'pending'])) };
  assert.equal(groupSummary(group).text, '待执行');
  group.webPhases.outline = 'done'; assert.equal(groupSummary(group).text, '已有产物');
  group.webPhases.review = 'throttled'; assert.equal(groupSummary(group).text, '限流等待');
  group.webPhases.completion = 'running'; assert.equal(groupSummary(group).text, '进行中');
  group.webPhases = Object.fromEntries(groupPhases.map(([id]) => [id, 'done']));
  assert.equal(groupSummary(group).text, '已完成');
  // A failure shows once nothing in the group runs or waits any more.
  group.webPhases.outline = 'failed'; group.webPhases.review = 'running'; assert.equal(groupSummary(group).text, '进行中');
  group.webPhases.review = 'throttled'; assert.equal(groupSummary(group).text, '限流等待');
  group.webPhases.review = 'done'; assert.equal(groupSummary(group).text, '执行失败');
});

test('failure is explicit, while interrupted execution keeps its intermediate artifacts', () => {
  assert.equal(displayStatus('failed', true), 'failed');
  assert.equal(displayStatus('failed', false), 'failed');
  assert.equal(statusNames.failed, '执行失败');
  assert.equal(groupSummary({ webPhases: { outline: 'failed', completion: 'available' } }).status, 'failed');
  for (const state of ['interrupted', 'unconfirmed']) {
    assert.equal(displayStatus(state, true), state);
    assert.equal(displayStatus(state, false), state);
  }
});

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: compact previews prefer the current draft over an older final image`, () => {
  const group = { id: 'body', webPhases: { completion: 'running' } };
  const artifacts = groupArtifacts(section, group, 0);
  const draft = section + '/parts/body.draft.svg', final = section + '/parts/body.svg';
  const files = new Set([draft, final, section + '/step09_outline/body/outline.svg']);
  const versions = { [draft]: '300:1', [final]: '200:1' };
  assert.equal(groupPreviewArtifacts(group, artifacts, files, versions)[0].path, draft);
  group.webPhases.completion = 'pending';
  assert.equal(groupPreviewArtifacts(group, artifacts, files, versions)[0].path, draft);
  files.delete(draft); assert.equal(groupPreviewArtifacts(group, artifacts, files, versions)[0].path, final);
});

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: compact preview follows saved progress even while an earlier phase is running`, () => {
  const group = { id: 'body/bow', webPhases: { outline: 'running' } };
  const artifacts = groupArtifacts(section, group, 1), files = new Set<string>(), versions: Record<string, string> = {};
  const preview = () => groupPreviewArtifacts(group, artifacts, files, versions)[0]?.path;
  const save = (path: string, time: number) => { files.add(path); versions[path] = `${time}:1`; };
  assert.equal(preview(), undefined);
  const outline = `${section}/step09_outline/body/children/bow/outline.svg`, reduced = `${section}/step10_reduce/depth02/body/bow.svg`;
  const draft = `${section}/parts/body/bow.draft.svg`, final = `${section}/parts/body/bow.svg`;
  save(outline, 10); assert.equal(preview(), outline);
  save(reduced, 20); assert.equal(preview(), reduced);
  save(draft, 30); assert.equal(preview(), draft);
  save(final, 40); assert.equal(preview(), final);
  save(`${section}/step09_outline/body/children/bow/review.json`, 100);
  assert.equal(preview(), final, 'a newer report is not an artwork preview');
  save(outline, 50); assert.equal(preview(), outline, 'a rewritten image is new progress too');
  save(final, 60); assert.equal(preview(), final);
  files.delete(final); assert.equal(preview(), outline, 'deleted artwork cannot remain selected');
});

test('both part sections expose the formal depth preview outside workspace', () => {
  for (const index of [0, 2]) assert.ok(stepArtifacts[index].occlusion.some(item => item.path.endsWith('/step14_occlusion/preview.svg') && item.kind === 'image'));
});
