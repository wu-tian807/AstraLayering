import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { decodeChildren } from '../../shared/part/children-agent.ts';
import { composeCompletion } from '../../shared/part/completion-svg.ts';
import { checkGroupCompletion } from '../../shared/part/completion-agent.ts';
import { artifactPath, reportPath } from '../../shared/part/artifact-facts.ts';
import { GroupStore, nodeSeed, normalizeGroups, walkGroups, writeAtomic } from '../../shared/part/groups.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { validateGroupSvg } from '../../shared/part/svg-tools.ts';
import { groupStep } from '../../shared/part/part-steps.ts';
import { beginStep, readStep } from '../../shared/step-chain.ts';
import { fixture, seedInitialGroups, shape, workingSteps } from './layering-fixture.ts';

test('hidden 标签可选，类型验证保留；历史未知字段不参与语义', () => {
  const ordinary = nodeSeed(normalizeGroups([{ id: 'face' }])[0]);
  assert.equal('hiddenInReference' in ordinary, false);
  const result = decodeChildren('face', { children: [
    { name: 'iris', kind: 'part', note: '闭眼内侧', hiddenInReference: true },
    { name: 'eyelid', kind: 'part', note: '可见闭合眼睑', hiddenInReference: false },
  ], note: '按显隐职责拆分' });
  assert.deepEqual(result.groups.map(g => g.hiddenInReference), [true, false]);
  for (const value of ['true', 1, null]) assert.throws(() => decodeChildren('face', { children: [
    { name: 'iris', kind: 'part', note: 'test', hiddenInReference: value },
    { name: 'eyelid', kind: 'part', note: 'test' },
  ], note: 'test' }), Error);
  const legacy = { id: 'face/iris', allowOutsideParent: 'obsolete unvalidated metadata' };
  const saved = normalizeGroups([legacy])[0];
  assert.equal((saved as unknown as Record<string, unknown>).allowOutsideParent, legacy.allowOutsideParent);
  assert.equal('allowOutsideParent' in nodeSeed(saved), false);
});

test('历史字段在续跑和保存中原样保留，但不进入 agent 输入', async t => {
  const f = await fixture(t);
  await seedInitialGroups(f.directory, [{ id: 'face', kind: 'part' }]);
  await writeAtomic(join(f.directory, 'groups.json'), JSON.stringify({ groups: [{ id: 'face', kind: 'part',
    allowOutsideParent: 'legacy value', customHistorical: { kept: true } }] }));
  const store = await GroupStore.open(f.directory);
  const node = store.snapshot().groups[0];
  assert.equal((node as unknown as Record<string, unknown>).allowOutsideParent, 'legacy value');
  assert.equal('allowOutsideParent' in nodeSeed(node), false);
  assert.equal('customHistorical' in nodeSeed(node), false);
  await store.update(document => { document.groups[0].note = 'edited'; });
  const saved = JSON.parse(await readFile(join(f.directory, 'groups.json'), 'utf8')).groups[0];
  assert.equal(saved.allowOutsideParent, 'legacy value');
  assert.deepEqual(saved.customHistorical, { kept: true });
  assert.equal(saved.note, 'edited');
});

test('描边父边界始终生效，格式、画布、归属和非空检查保留', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parent.svg'), child = join(f.directory, 'child.svg');
  const canvas = { width: 100, height: 100 }, id = 'face/iris';
  await writeAtomic(parent, shape('face', 40, 60)); await writeAtomic(child, shape(id));
  await assert.rejects(validateGroupSvg(child, id, canvas, parent), Error);
  for (const [content, error] of [
    [shape('other'), /仅绑定当前组/], [shape(id, 10, 90, true), /没有可见/],
    [shape(id).replace('0 0 100 100', '0 0 50 50'), /viewBox/],
    [shape(id).replace('</g>', '<image href="reference.png"/></g>'), /可编辑矢量/],
  ] as const) { await writeAtomic(child, content); await assert.rejects(validateGroupSvg(child, id, canvas, parent), error); }
});

test('不可见子部件跳过描边、review 和同层去重，仍补出非空 SVG；结构及续跑事实保持完整', async t => {
  const f = await fixture(t), events: string[] = [];
  const iris = 'face/iris', mouth = 'face/mouth_inside';
  const steps = workingSteps(events, [{ id: 'face' }], { face: [
    { id: 'face/eyelid', kind: 'part' },
    { id: iris, kind: 'part', hiddenInReference: true },
    { id: mouth, kind: 'part', hiddenInReference: true },
    { id: 'face/nose', kind: 'part' },
  ] });
  const reduced: string[][] = [];
  const input = { ...f, groups: null, steps: { ...steps,
    async reduceOutlines(context: Parameters<NonNullable<typeof steps.reduceOutlines>>[0]) {
      reduced.push(context.entries.map(entry => entry.group.id));
      return steps.reduceOutlines!(context);
    },
    async completeOcclusion(context: Parameters<typeof steps.completeOcclusion>[0]) {
      if (!context.group.hiddenInReference) return steps.completeOcclusion(context);
      events.push(`${context.group.id}:hidden-completion`);
      const source = await readFile(context.reviewed.path, 'utf8');
      assert.match(source, /data-hidden-in-reference="true"/);
      assert.doesNotMatch(source, /<path/);
      await writeAtomic(context.outputPath, composeCompletion(source, [{ d: 'M5 40H20V60H5Z' }]));
      return { status: 'completed' as const, output: { path: context.outputPath } };
    },
    async checkCompletion(context: Parameters<typeof steps.checkCompletion>[0]) {
      return { status: 'completed' as const, output: await checkGroupCompletion(context) };
    },
  } };
  await runLayering(input);
  assert.deepEqual(reduced, [['face/eyelid', 'face/nose']]);
  for (const id of [iris, mouth]) {
    assert.ok(events.includes(`${id}:hidden-completion`));
    assert.ok(!events.includes(`${id}:outline`) && !events.includes(`${id}:review`));
    await assert.rejects(readFile(reportPath(f.directory, id, 'review')), { code: 'ENOENT' });
    assert.match(await readFile(artifactPath(f.directory, id, 'completion'), 'utf8'), /<path/);
  }
  assert.ok(events.includes('face/eyelid:outline') && events.includes('face/nose:review'));
  const restored = walkGroups((await GroupStore.open(f.directory)).snapshot().groups);
  const hidden = restored.find(entry => entry.group.id === iris)!.group;
  assert.equal(hidden.hiddenInReference, true);
  assert.equal(hidden.steps.completionCheck.status, 'completed');
  assert.equal(hidden.steps.review.output?.reviewOutcome, undefined);
  events.length = 0;
  await runLayering(input);
  assert.deepEqual(events, []);
});

for (const sourceWritten of [false, true]) test(`隐藏步骤在${sourceWritten ? '空底稿写入后' : '空底稿写入前'}中断，续跑完成跳过并进入补全`, async t => {
  const f = await fixture(t), events: string[] = [], id = 'iris';
  await seedInitialGroups(f.directory, [{ id, kind: 'part', hiddenInReference: true }]);
  const step = groupStep(f.directory, id, 'outline');
  await beginStep(step.directory, 'absent');
  if (sourceWritten) await writeAtomic(artifactPath(f.directory, id, 'outline'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" data-hidden-in-reference="true"><g id="source" data-group-path="iris"/></svg>\n');
  const steps = workingSteps(events);
  await runLayering({ ...f, groups: null, steps: { ...steps,
    async completeOcclusion(context) {
      events.push('hidden-completion');
      assert.match(await readFile(context.reviewed.path, 'utf8'), /data-hidden-in-reference="true"/);
      await writeAtomic(context.outputPath, composeCompletion(await readFile(context.reviewed.path, 'utf8'), [{ d: 'M20 30H70V60H20Z' }]));
      return { status: 'completed' as const, output: { path: context.outputPath } };
    },
  } });
  assert.equal((await readStep(step.directory)).status, 'completed');
  assert.ok(events.includes('hidden-completion'));
  assert.ok(!events.some(event => /:(outline|review)$/.test(event)));
  await assert.rejects(readFile(reportPath(f.directory, id, 'review')), { code: 'ENOENT' });
  const restored = (await GroupStore.open(f.directory)).snapshot().groups[0];
  assert.equal(restored.steps.outline.status, 'completed');
  assert.equal(restored.steps.review.status, 'completed');
  assert.equal(restored.steps.completionCheck.status, 'completed');
});

for (const checkpoint of ['draft', 'published'] as const) test(`隐藏部件在补全${checkpoint === 'draft' ? '草稿' : '检查'}中断，恢复保留跳过事实并复用${checkpoint === 'draft' ? '草稿' : '正式稿'}`, async t => {
  const f = await fixture(t), events: string[] = [], id = 'iris';
  const steps = workingSteps(events, [{ id, kind: 'group', hiddenInReference: true }]);
  let interrupted = false, draws = 0;
  const input = { ...f, groups: null, steps: { ...steps,
    async completeOcclusion(context: Parameters<typeof steps.completeOcclusion>[0]) {
      draws++;
      if (draws === 2) {
        assert.equal(checkpoint, 'draft');
        assert.equal(context.resumeDraft, true);
        assert.match(await readFile(context.outputPath, 'utf8'), /M20 30H70V60H20Z/);
      }
      await writeAtomic(context.outputPath, composeCompletion(await readFile(context.reviewed.path, 'utf8'), [{ d: 'M20 30H70V60H20Z' }]));
      if (checkpoint === 'draft' && !interrupted) { interrupted = true; throw new Error('test interruption'); }
      return { status: 'completed' as const, output: { path: context.outputPath } };
    },
    async checkCompletion(context: Parameters<typeof steps.checkCompletion>[0]) {
      if (checkpoint === 'published' && !interrupted) { interrupted = true; throw new Error('test interruption'); }
      return steps.checkCompletion(context);
    },
  } };
  await assert.rejects(runLayering(input), Error);
  const prepared = await readFile(join(groupStep(f.directory, id, 'outline').directory, '.completed'));
  const restored = (await GroupStore.open(f.directory)).snapshot().groups[0];
  assert.equal(restored.steps.outline.status, 'completed');
  assert.equal(restored.steps.review.status, 'completed');
  assert.equal(restored.steps.completionCheck.status, 'pending');
  await runLayering(input);
  assert.equal(draws, checkpoint === 'draft' ? 2 : 1);
  assert.ok(!events.some(event => /:(outline|review)$/.test(event)));
  assert.deepEqual(await readFile(join(groupStep(f.directory, id, 'outline').directory, '.completed')), prepared, '已跳过步骤的完成记录保持不变');
  assert.equal((await readStep(groupStep(f.directory, id, 'completion').directory)).status, 'completed');
  await assert.rejects(readFile(reportPath(f.directory, id, 'review')), { code: 'ENOENT' });
});
