import assert from 'node:assert/strict';
import { readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { artifactPath, readJson, reductionReportPath, reportPath } from '../artifact-facts.ts';
import { GroupStore, walkGroups, writeAtomic } from '../groups.ts';
import { runLayering } from '../layering.ts';
import { fixture, shape, workingMerger, workingSteps } from './layering-fixture.ts';
import { completionInputsPath, fileDependency } from '../completion-inputs.ts';

async function missing(paths: string[]) {
  for (const path of paths) await assert.rejects(readFile(path), { code: 'ENOENT' }, path);
}

for (const checkpoint of ['[a] 组轮廓与自检：完成', '第 0 层轮廓去重：完成']) {
  test(`删 outline 后先清下游；原样重建并在 ${checkpoint} 中断，恢复仍须新补全`, async t => {
    const f = await fixture(t), events: string[] = [];
    const steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
    await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
    const originalOutline = await readFile(artifactPath(f.directory, 'a', 'outline'));
    const stableB = await readFile(artifactPath(f.directory, 'b', 'outline'));
    const downstream = [artifactPath(f.directory, 'a', 'completion'), reportPath(f.directory, 'a', 'completion-check')];
    const otherPart = [artifactPath(f.directory, 'b', 'reduction'), artifactPath(f.directory, 'b', 'completion'),
      reportPath(f.directory, 'b', 'completion-check'), completionInputsPath(f.directory, 'b')];
    const otherBytes = await Promise.all(otherPart.map(path => readFile(path)));
    const otherTimes = await Promise.all(otherPart.map(async path => (await stat(path, { bigint: true })).mtimeNs));
    downstream.push(join(f.directory, 'preview.svg'), join(f.directory, 'occlusion.json'));
    await rm(artifactPath(f.directory, 'a', 'outline'));
    events.length = 0;
    await assert.rejects(runLayering({ ...f, groups: null, steps: { ...steps, async drawOutline(context) {
      // 清理发生在 worker 开始之前，不依赖新旧 SVG 的内容是否不同。
      await missing([...downstream, reportPath(f.directory, 'a', 'review')]);
      assert.deepEqual(await Promise.all(otherPart.map(path => readFile(path))), otherBytes);
      return steps.drawOutline(context);
    } }, progress(message) { if (message === checkpoint) throw new Error('interrupt before new part'); } }), /interrupt before new part/);
    assert.deepEqual(await readFile(artifactPath(f.directory, 'a', 'outline')), originalOutline);
    assert.deepEqual(await readFile(artifactPath(f.directory, 'b', 'outline')), stableB);
    await missing(downstream);
    const interrupted = (await GroupStore.open(f.directory)).snapshot();
    assert.equal(interrupted.groups[0].steps.completion.status, 'pending');
    assert.equal(interrupted.groups[1].steps.completion.status, 'completed');
    events.length = 0;
    const result = await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
    assert.equal(result.status, 'completed');
    assert.ok(!events.some(event => event.endsWith(':outline')));
    assert.ok(events.includes('a:completion') && events.includes('a:check'));
    assert.ok(!events.some(event => event.startsWith('b:')));
    assert.deepEqual(await Promise.all(otherPart.map(path => readFile(path))), otherBytes);
    assert.deepEqual(await Promise.all(otherPart.map(async path => (await stat(path, { bigint: true })).mtimeNs)), otherTimes);
    assert.ok(events.includes('merge'));
    events.length = 0;
    await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
    assert.deepEqual(events, []);
  });
}

test('清理只完成一部分后退出，下一次仍清完旧 part 才开始重画', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  await runLayering({ ...f, groups: null, steps });
  // 模拟清理中断：上游及批次记录已撤下，但旧 part、自检仍残留。
  for (const path of [artifactPath(f.directory, 'head', 'outline'), reportPath(f.directory, 'head', 'review'), reductionReportPath(f.directory, 0)]) {
    await rm(path);
  }
  assert.ok(await readFile(artifactPath(f.directory, 'head', 'completion')));
  await runLayering({ ...f, groups: null, steps: { ...steps, async drawOutline(context) {
    await missing([artifactPath(f.directory, 'head', 'completion'), reportPath(f.directory, 'head', 'completion-check')]);
    return steps.drawOutline(context);
  } } });
});

test('父 outline 缺失时不读取残留父稿放行后代；重画前撤下后代文件及过期分析', async t => {
  const f = await fixture(t), events: string[] = [];
  const steps = workingSteps(events, [{ id: 'head' }], { head: [{ id: 'head/eye', kind: 'part' }] });
  await runLayering({ ...f, groups: null, steps });
  await rm(artifactPath(f.directory, 'head', 'outline'));
  const restored = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(restored.groups[0].groups[0].steps.outline.status, 'pending');
  const oldChild = ['outline', 'reduction', 'completion'].map(stage => artifactPath(f.directory, 'head/eye', stage as 'outline' | 'reduction' | 'completion'));
  oldChild.push(reportPath(f.directory, 'head/eye', 'review'), reportPath(f.directory, 'head/eye', 'completion-check'));
  await assert.rejects(runLayering({ ...f, groups: null, steps: { ...steps, async drawOutline(context) {
    await missing(oldChild);
    const tree = await readJson(join(f.directory, 'groups.json'));
    assert.deepEqual(tree.groups[0].groups, []);
    assert.equal(tree.groups[0].childrenAnalysis, undefined);
    return steps.drawOutline(context);
  } }, progress(message) { if (message === '[head] 组轮廓与自检：完成') throw new Error('interrupted'); } }), /interrupted/);
  events.length = 0;
  await runLayering({ ...f, groups: null, steps });
  assert.ok(events.includes('head:children') && events.includes('head/eye:outline') && events.includes('head/eye:completion'));
  assert.ok(walkGroups((await GroupStore.open(f.directory)).snapshot().groups).every(({ group }) => group.steps.children.status === 'completed'));
});

test('只删除某件补全时保留整层去重和其他部件，重建该件后再合并', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
  await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
  const preserved = [artifactPath(f.directory, 'b', 'completion'), reportPath(f.directory, 'b', 'completion-check'), reductionReportPath(f.directory, 0)];
  const bytes = await Promise.all(preserved.map(path => readFile(path)));
  await rm(artifactPath(f.directory, 'a', 'completion'));
  events.length = 0;
  await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
  assert.deepEqual(events, ['a:completion', 'a:check', 'a:children', 'merge']);
  assert.deepEqual(await Promise.all(preserved.map(path => readFile(path))), bytes);
});

test('同一轮 outline 尚未完成的 review 记录保留，不因下游清理重置返修次数', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  await runLayering({ ...f, groups: null, steps });
  const path = reportPath(f.directory, 'head', 'review'), report = await readJson(path);
  report.reviews[0].verdict = 'revise';
  await writeAtomic(path, JSON.stringify(report));
  await runLayering({ ...f, groups: null, steps: { ...steps, async reviewOutline(context) {
    assert.deepEqual(await readJson(context.reportPath), report);
    return steps.reviewOutline(context);
  } } });
});

test('重画一根手指只重做该件；同层掌片及其他部件的去重、补全、自检原样保留', async t => {
  const f = await fixture(t), events: string[] = [];
  const base = workingSteps(events, [{ id: 'hand' }], { hand: ['palm', 'finger', 'ornament'].map(name => ({ id: `hand/${name}`, kind: 'part' })) });
  const steps = { ...base, async completeOcclusion(context: Parameters<typeof base.completeOcclusion>[0]) {
    const result = await base.completeOcclusion(context);
    return context.group.id === 'hand/finger' && result.status === 'completed'
      ? { ...result, output: { ...result.output, dependencies: [await fileDependency(f.directory, artifactPath(f.directory, 'hand/palm', 'reduction'),
        { groupId: 'hand/palm', stage: 'reduction' })] } } : result;
  } };
  await runLayering({ ...f, groups: null, steps });
  const others = ['hand/palm', 'hand/ornament'].flatMap(id => [artifactPath(f.directory, id, 'reduction'), artifactPath(f.directory, id, 'completion'), reportPath(f.directory, id, 'completion-check')]);
  const bytes = await Promise.all(others.map(path => readFile(path)));
  await rm(artifactPath(f.directory, 'hand/finger', 'outline'));
  events.length = 0;
  await runLayering({ ...f, groups: { id: 'hand/finger' }, steps });
  assert.ok(events.includes('hand/finger:outline') && events.includes('hand/finger:completion'));
  assert.ok(!events.some(event => /hand\/(palm|ornament):/.test(event)));
  assert.deepEqual(await Promise.all(others.map(path => readFile(path))), bytes);
});

test('实际掌片引用失效只传递给引用它的补全，不重画引用者 outline 或无关部件', async t => {
  const f = await fixture(t), events: string[] = [];
  const base = workingSteps(events, [{ id: 'hand' }], { hand: ['palm', 'finger', 'ornament'].map(name => ({ id: `hand/${name}`, kind: 'part' })) });
  const steps = { ...base, async completeOcclusion(context: Parameters<typeof base.completeOcclusion>[0]) {
    const result = await base.completeOcclusion(context);
    return context.group.id === 'hand/finger' && result.status === 'completed'
      ? { ...result, output: { ...result.output, dependencies: [await fileDependency(f.directory, artifactPath(f.directory, 'hand/palm', 'reduction'),
        { groupId: 'hand/palm', stage: 'reduction' })] } } : result;
  } };
  await runLayering({ ...f, groups: null, steps });
  await rm(artifactPath(f.directory, 'hand/palm', 'outline'));
  const state = walkGroups((await GroupStore.open(f.directory)).snapshot().groups);
  assert.equal(state.find(({ group }) => group.id === 'hand/finger')!.group.steps.completion.status, 'pending');
  assert.equal(state.find(({ group }) => group.id === 'hand/ornament')!.group.steps.completion.status, 'completed');
  events.length = 0;
  const result = await runLayering({ ...f, groups: { id: 'hand/palm' }, steps });
  assert.equal(result.status, 'completed');
  assert.ok(events.includes('hand/palm:completion') && events.includes('hand/finger:completion'));
  assert.ok(!events.includes('hand/finger:outline') && !events.some(event => event.startsWith('hand/ornament:')));
});

test('新补全缺失输入版本记录时不能沿用；额外参考文件变化只撤销实际使用者', async t => {
  const f = await fixture(t), events: string[] = [], base = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
  const reference = join(f.directory, 'prior.png');
  await writeAtomic(reference, 'reference v1');
  const steps = { ...base, async completeOcclusion(context: Parameters<typeof base.completeOcclusion>[0]) {
    const result = await base.completeOcclusion(context);
    return context.group.id === 'a' && result.status === 'completed'
      ? { ...result, output: { ...result.output, dependencies: [await fileDependency(f.directory, reference)] } } : result;
  } };
  await runLayering({ ...f, groups: null, steps });
  await writeAtomic(reference, 'reference v2');
  let state = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(state.groups[0].steps.completion.status, 'pending');
  assert.equal(state.groups[1].steps.completion.status, 'completed');
  events.length = 0;
  await runLayering({ ...f, groups: null, steps });
  assert.deepEqual(events, ['a:completion', 'a:check', 'a:children']);
  await rm(completionInputsPath(f.directory, 'a'));
  state = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(state.groups[0].steps.completion.status, 'pending');
  assert.equal(state.groups[1].steps.completion.status, 'completed');
});

test('去重实际改变别件时只失效该件及真实引用者；未改变的旧去重结果保持，提交后中断也安全', async t => {
  const f = await fixture(t), events: string[] = [], base = workingSteps(events, ['a', 'b', 'c', 'd'].map(id => ({ id })));
  const steps = { ...base, async completeOcclusion(context: Parameters<typeof base.completeOcclusion>[0]) {
    const result = await base.completeOcclusion(context);
    return context.group.id === 'c' && result.status === 'completed'
      ? { ...result, output: { ...result.output, dependencies: [await fileDependency(f.directory, artifactPath(f.directory, 'b', 'reduction'),
        { groupId: 'b', stage: 'reduction' })] } } : result;
  } };
  await runLayering({ ...f, groups: null, steps: { ...steps, async reduceOutlines(context) {
    const entry = context.entries.find(entry => entry.group.id === 'd')!;
    await writeAtomic(entry.outputPath, shape('d', 20, 80));
    return { status: 'completed', output: { changed: [{ groupId: 'd', path: entry.outputPath }] } };
  } } });
  const preserved = [artifactPath(f.directory, 'd', 'reduction'), artifactPath(f.directory, 'd', 'completion'), reportPath(f.directory, 'd', 'completion-check')];
  const bytes = await Promise.all(preserved.map(path => readFile(path)));
  await rm(artifactPath(f.directory, 'a', 'outline'));
  await assert.rejects(runLayering({ ...f, groups: { id: 'a' }, steps: { ...steps, async reduceOutlines(context) {
    assert.equal(context.entries.find(entry => entry.group.id === 'd')!.current?.path, preserved[0]);
    const entry = context.entries.find(entry => entry.group.id === 'b')!;
    await writeAtomic(entry.outputPath, shape('b', 20, 80));
    return { status: 'completed', output: { changed: [{ groupId: 'b', path: entry.outputPath }] } };
  } }, progress(message) { if (message === '第 0 层轮廓去重：完成') throw new Error('interrupt after changed reduction'); } }), /interrupt after changed reduction/);
  await missing(['a', 'b', 'c'].map(id => artifactPath(f.directory, id, 'completion')));
  assert.deepEqual(await Promise.all(preserved.map(path => readFile(path))), bytes);
  events.length = 0;
  await runLayering({ ...f, groups: null, steps });
  for (const id of ['a', 'b', 'c']) assert.ok(events.includes(`${id}:completion`));
  assert.ok(!events.some(event => event.startsWith('d:') || event.endsWith(':outline')));
  assert.deepEqual(await Promise.all(preserved.map(path => readFile(path))), bytes);
  await rm(artifactPath(f.directory, 'a', 'outline'));
  events.length = 0;
  const selected = await runLayering({ ...f, groups: { id: 'a' }, steps: { ...steps, async reduceOutlines(context) {
    const entry = context.entries.find(entry => entry.group.id === 'b')!;
    await writeAtomic(entry.outputPath, shape('b', 25, 75));
    return { status: 'completed', output: { changed: [{ groupId: 'b', path: entry.outputPath }] } };
  } } });
  assert.equal(selected.status, 'completed');
  assert.ok(events.includes('b:completion') && events.includes('c:completion'));
  assert.ok(!events.some(event => event.startsWith('d:')));
});
