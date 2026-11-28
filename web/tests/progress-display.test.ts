import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayStatus, groupArtifacts, groupPhases, groupPreviewArtifacts, groupSummary, replacementGroupDraft, stepArtifacts } from '../progress.js';

test('normal progress labels keep existing artifacts distinct from running and completion', () => {
  const group = { webPhases: Object.fromEntries(groupPhases.map(([id]) => [id, 'pending'])) };
  assert.equal(groupSummary(group).status, 'pending');
  group.webPhases.outline = 'done'; assert.equal(groupSummary(group).status, 'available');
  group.webPhases.review = 'throttled'; assert.equal(groupSummary(group).status, 'throttled');
  group.webPhases.completion = 'running'; assert.equal(groupSummary(group).status, 'throttled');
  group.webPhases = Object.fromEntries(groupPhases.map(([id]) => [id, 'done']));
  assert.equal(groupSummary(group).status, 'done');
  // A failure shows once nothing in the group runs or waits any more.
  group.webPhases.outline = 'failed'; group.webPhases.review = 'running'; assert.equal(groupSummary(group).status, 'running');
  group.webPhases.review = 'throttled'; assert.equal(groupSummary(group).status, 'throttled');
  group.webPhases.review = 'done'; assert.equal(groupSummary(group).status, 'failed');
});

test('failure is explicit, while interrupted execution keeps its intermediate artifacts', () => {
  assert.equal(displayStatus('failed', true), 'failed');
  assert.equal(displayStatus('failed', false), 'failed');
  assert.equal(groupSummary({ webPhases: { outline: 'failed', completion: 'available' } }).status, 'failed');
  for (const state of ['interrupted', 'unconfirmed']) {
    assert.equal(displayStatus(state, true), state);
    assert.equal(displayStatus(state, false), state);
  }
  assert.equal(displayStatus('unknown', true), 'available');
  assert.equal(displayStatus('unknown', false), 'pending');
});

test('collapsed group shows active descendants before saved parent progress', () => {
  const child = { webPhases: { outline: 'available', review: 'running' } };
  const group = { webPhases: Object.fromEntries(groupPhases.map(([id]) => [id, 'done'])),
    groups: [{ webPhases: { outline: 'available' }, groups: [child] }] };
  assert.equal(groupSummary(group).status, 'running');
  child.webPhases.review = 'throttled';
  assert.equal(groupSummary(group).status, 'throttled');
  child.webPhases.review = 'failed';
  assert.equal(groupSummary(group).status, 'failed');
  child.webPhases.review = 'pending';
  assert.equal(groupSummary(group).status, 'done');
  group.webPhases.children = 'pending';
  assert.equal(groupSummary(group).status, 'available');
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

for (const section of ['part-layering', 'clothing-part-layering']) test(`${section}: a selected nested draft follows its published drawing or the previous stage`, () => {
  const group = { id: 'body/arm', groups: [] }, groups = [{ id: 'body', groups: [group] }];
  const artifacts = groupArtifacts(section, group, 1);
  const draft = `${section}/step11_completion/body/children/arm/workspace/completion.draft.svg`;
  const final = `${section}/parts/body/arm.svg`, reduced = `${section}/step10_reduce/depth02/body/arm.svg`;
  const outline = `${section}/step09_outline/body/children/arm/outline.svg`;
  const files = new Set([outline, reduced, final]);
  assert.ok(artifacts.completion.some(item => item.path === draft));
  assert.equal(replacementGroupDraft(draft, section, groups, files)?.path, final);
  files.delete(final); assert.equal(replacementGroupDraft(draft, section, groups, files)?.path, reduced);
  files.delete(reduced); assert.equal(replacementGroupDraft(draft, section, groups, files)?.path, outline);
  files.delete(outline); assert.equal(replacementGroupDraft(draft, section, groups, files), null);
  assert.equal(replacementGroupDraft('other.draft.svg', section, groups, files), undefined);
});
