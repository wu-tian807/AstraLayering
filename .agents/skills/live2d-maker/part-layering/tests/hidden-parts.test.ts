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
import { parentBoundsSource, validateGroupSvg } from '../../shared/part/svg-tools.ts';
import { groupStep } from '../../shared/part/part-steps.ts';
import { beginStep, readStep } from '../../shared/step-chain.ts';
import { fixture, seedInitialGroups, shape, workingSteps } from './layering-fixture.ts';

test('两个标签独立且可选，省略保持旧格式，true/false 原样保留，错误类型返回具体字段', () => {
  const ordinary = nodeSeed(normalizeGroups([{ id: 'face' }])[0]);
  assert.equal('hiddenInReference' in ordinary, false);
  assert.equal('allowOutsideParent' in ordinary, false);
  const result = decodeChildren('face', { children: [
    { name: 'iris', kind: 'part', note: '闭眼内侧，配合眼睑开口蒙版', hiddenInReference: true, allowOutsideParent: true },
    { name: 'eyelid', kind: 'part', note: '可见闭合眼睑', hiddenInReference: false },
  ], note: '按显隐职责拆分' });
  assert.deepEqual(result.groups.map(({ hiddenInReference, allowOutsideParent }) => [hiddenInReference, allowOutsideParent]), [[true, true], [false, undefined]]);
  for (const field of ['hiddenInReference', 'allowOutsideParent']) {
    for (const value of ['true', 1, null]) {
      assert.throws(() => decodeChildren('face', { children: [
        { name: 'iris', kind: 'part', note: 'test', [field]: value },
        { name: 'eyelid', kind: 'part', note: 'test' },
      ], note: 'test' }), new RegExp(`group.${field} must be a boolean`));
    }
  }
});

test('越出父轮廓标签仅豁免父包含检查，格式、画布、归属和非空检查继续执行', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parent.svg'), child = join(f.directory, 'child.svg');
  const canvas = { width: 100, height: 100 }, ordinary = { id: 'face/iris' }, allowed = { ...ordinary, allowOutsideParent: true };
  await writeAtomic(parent, shape('face', 40, 60));
  await writeAtomic(child, shape(ordinary.id));
  await assert.rejects(validateGroupSvg(child, ordinary.id, canvas, parentBoundsSource(ordinary, parent)), /超出父轮廓/);
  await validateGroupSvg(child, ordinary.id, canvas, parentBoundsSource(allowed, parent));
  for (const [content, error] of [
    [shape('other'), /仅绑定当前组/], [shape(ordinary.id, 10, 90, true), /没有可见/],
    [shape(ordinary.id).replace('0 0 100 100', '0 0 50 50'), /viewBox/],
    [shape(ordinary.id).replace('</g>', '<image href="reference.png"/></g>'), /可编辑矢量/],
  ] as const) {
    await writeAtomic(child, content);
    await assert.rejects(validateGroupSvg(child, ordinary.id, canvas, parentBoundsSource(allowed, parent)), error);
  }
});

test('不可见子部件跳过描边、review 和同层去重，仍补出非空 SVG；结构及续跑事实保持完整', async t => {
  const f = await fixture(t), events: string[] = [];
  const iris = 'face/iris', mouth = 'face/mouth_inside';
  const steps = workingSteps(events, [{ id: 'face' }], { face: [
    { id: 'face/eyelid', kind: 'part' },
    { id: iris, kind: 'part', hiddenInReference: true, allowOutsideParent: true },
    { id: mouth, kind: 'part', hiddenInReference: true, allowOutsideParent: true },
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
  assert.equal(hidden.allowOutsideParent, true);
  assert.equal(hidden.steps.completionCheck.status, 'completed');
  assert.equal(hidden.steps.review.output?.reviewOutcome, undefined);
  assert.match(hidden.steps.review.output?.note ?? '', /跳过/);
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
  await assert.rejects(runLayering(input), /test interruption/);
  const prepared = await readFile(join(groupStep(f.directory, id, 'outline').directory, '.completed'));
  const restored = (await GroupStore.open(f.directory)).snapshot().groups[0];
  assert.equal(restored.steps.outline.status, 'completed');
  assert.equal(restored.steps.review.status, 'completed');
  assert.match(restored.steps.review.output?.note ?? '', /跳过/);
  assert.equal(restored.steps.completionCheck.status, 'pending');
  await runLayering(input);
  assert.equal(draws, checkpoint === 'draft' ? 2 : 1);
  assert.ok(!events.some(event => /:(outline|review)$/.test(event)));
  assert.deepEqual(await readFile(join(groupStep(f.directory, id, 'outline').directory, '.completed')), prepared, '已跳过步骤的完成记录保持不变');
  assert.equal((await readStep(groupStep(f.directory, id, 'completion').directory)).status, 'completed');
  await assert.rejects(readFile(reportPath(f.directory, id, 'review')), { code: 'ENOENT' });
});
