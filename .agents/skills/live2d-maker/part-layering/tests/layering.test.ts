import assert from 'node:assert/strict';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { artifactPath, draftPath, readJson, reportPath, reviewedArtifact, svgHash } from '../../shared/part/artifact-facts.ts';
import { GroupStore, normalizeGroups, walkGroups, writeAtomic } from '../../shared/part/groups.ts';
import { GroupExecutionError, runLayering } from '../../shared/part/layering.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { groupStepId, layerStepId } from '../../shared/part/part-steps.ts';
import { readStep } from '../../shared/step-chain.ts';
import { fixture, shape, workingMerger, workingSteps } from './layering-fixture.ts';
import { profile } from '../profile.ts';

test('子组提前描边和 review；下一层去重等待所有父组拆分及所有轮廓齐备', { timeout: 5000 }, async t => {
  const f = await fixture(t), events: string[] = [];
  const steps = workingSteps(events, [{ id: 'fast' }, { id: 'slow' }], { fast: [{ id: 'fast/child' }], slow: [{ id: 'slow/child' }] });
  const slowReview = Promise.withResolvers<void>(), reviewing = Promise.withResolvers<void>();
  const slowSplit = Promise.withResolvers<void>(), splitting = Promise.withResolvers<void>();
  const fastReviewed = Promise.withResolvers<void>();
  const childReviewed = Promise.withResolvers<void>(), releaseChildReview = Promise.withResolvers<void>();
  const slowChildReviewed = Promise.withResolvers<void>();
  const run = runLayering({ ...f, groups: null, steps: { ...steps,
    async reviewOutline(context) { if (context.group.id === 'slow') { reviewing.resolve(); await slowReview.promise; }
      const result = await steps.reviewOutline(context);
      if (context.group.id === 'fast') fastReviewed.resolve();
      if (context.group.id === 'fast/child') { childReviewed.resolve(); await releaseChildReview.promise; }
      if (context.group.id === 'slow/child') slowChildReviewed.resolve();
      return result; },
    async reduceOutlines(context) {
      if (context.depth === 1) assert.deepEqual(context.entries.map(entry => entry.group.id).sort(), ['fast/child', 'slow/child']);
      return steps.reduceOutlines!(context);
    },
    async splitChildren(context) { if (context.group.id === 'slow') { splitting.resolve(); await slowSplit.promise; } return steps.splitChildren(context); },
  }, mergeSvg: workingMerger(events) });
  try {
    await Promise.all([reviewing.promise, fastReviewed.promise]);
    assert.ok(events.includes('fast:review'));
    assert.ok(!events.includes('layer-0:reduce'));
    assert.ok(!events.includes('fast:completion'));
    slowReview.resolve();
    await splitting.promise;
    assert.ok(events.includes('layer-0:reduce'));
    await childReviewed.promise;
    assert.ok(events.includes('fast/child:outline') && events.includes('fast/child:review'));
    assert.ok(!events.includes('slow:children'));
    assert.ok(!events.includes('layer-1:reduce') && !events.includes('fast/child:completion'));
    slowSplit.resolve();
    await slowChildReviewed.promise;
    assert.ok(!events.includes('layer-1:reduce'), 'fast child review is still in flight');
  } finally { slowReview.resolve(); slowSplit.resolve(); releaseChildReview.resolve(); await run; }
  const result = await run;
  assert.equal(result.status, 'completed');
  assert.ok(events.indexOf('fast/child:outline') < events.indexOf('slow:children'));
  assert.equal(events.filter(event => event === 'fast/child:outline').length, 1);
  assert.equal(events.filter(event => event === 'fast/child:review').length, 1);
  assert.equal(events.filter(event => event === 'layer-1:reduce').length, 1);
  assert.ok(events.indexOf('layer-1:reduce') > events.indexOf('slow/child:review'));
  assert.ok(events.indexOf('fast:completion') > events.indexOf('layer-0:reduce'));
});

test('全部完成后仅凭事实文件恢复；旧 progress.json 即使损坏也不读取或覆盖', async t => {
  const f = await fixture(t), events: string[] = [];
  const steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }], { a: [{ id: 'a/eye' }] });
  await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
  await assert.rejects(readFile(join(f.directory, 'progress.json')), { code: 'ENOENT' });
  await writeAtomic(join(f.directory, 'progress.json'), '{legacy broken progress');
  events.length = 0;
  const result = await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
  assert.equal(result.status, 'completed');
  assert.deepEqual(events, []);
  assert.equal(await readFile(join(f.directory, 'progress.json'), 'utf8'), '{legacy broken progress');
  const tree = await readJson(join(f.directory, 'groups.json'));
  assert.ok(!('steps' in tree.groups[0]) && !('merge' in tree));
});

test('去重修改组写到统一目录，未修改组字节一致；补形和自检都读取去重版', async t => {
  const f = await fixture(t), events: string[] = [];
  const steps = workingSteps(events, [{ id: 'hair' }, { id: 'accessories' }]);
  const reduced = shape('accessories', 20, 80);
  await runLayering({ ...f, groups: null, steps: { ...steps,
    async reduceOutlines(context) { const entry = context.entries.find(entry => entry.group.id === 'accessories')!;
      await writeAtomic(entry.outputPath, reduced); return { status: 'completed', output: { changed: [{ groupId: entry.group.id, path: entry.outputPath }] } }; },
    async completeOcclusion(context) { assert.match(context.reviewed.path, /step10_reduce\/depth01\//); return steps.completeOcclusion(context); },
    async checkCompletion(context) { assert.match(context.before.path, /step10_reduce\/depth01\//); return steps.checkCompletion(context); },
  } });
  assert.equal(await readFile(artifactPath(f.directory, 'accessories', 'outline'), 'utf8'), shape('accessories'));
  assert.equal(await readFile(artifactPath(f.directory, 'accessories', 'reduction'), 'utf8'), reduced);
  assert.deepEqual(await readFile(artifactPath(f.directory, 'hair', 'reduction')), await readFile(artifactPath(f.directory, 'hair', 'outline')));
});

test('只有 .draft.svg 不能跳过绘制；异常草稿不发布正式 SVG，重试仍能执行', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  await writeAtomic(draftPath(artifactPath(f.directory, 'head', 'outline')), shape('head', 30, 70));
  await assert.rejects(runLayering({ ...f, groups: null, steps: { ...steps, async drawOutline(context) {
    assert.ok(context.outputPath.endsWith('.draft.svg'));
    await writeAtomic(context.outputPath, shape('head')); throw new Error('interrupted');
  } } }), /interrupted/);
  await assert.rejects(readFile(artifactPath(f.directory, 'head', 'outline')), { code: 'ENOENT' });
  await runLayering({ ...f, groups: null, steps });
  assert.ok(events.includes('head:outline'));
});

test('绘制、补全、去重和合并可交付自选 SVG 路径，程序保存正式产物且保留原文件', async t => {
  const f = await fixture(t), external = await fixture(t), events: string[] = [];
  const steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
  const paths: string[] = [];
  const save = async (file: string, content: string | Buffer) => {
    const path = join(external.directory, file); await writeAtomic(path, content); paths.push(path); return path;
  };
  await runLayering({ ...f, groups: null, steps: { ...steps,
    async drawOutline(context) { return { status: 'completed', output: { path: await save(`${context.group.id}-outline.svg`, shape(context.group.id)) } }; },
    async reduceOutlines(context) { return { status: 'completed', output: { changed: [{ groupId: 'a', path: await save('a-reduced.svg', shape('a', 15, 85)) }] } }; },
    async completeOcclusion(context) { return { status: 'completed', output: { path: await save(`${context.group.id}-completed.svg`, await readFile(context.reviewed.path)) } }; },
  }, mergeSvg: async () => ({ status: 'completed', output: { path: await save('preview.svg', shape('character')) } }) });
  for (const path of paths) assert.ok((await readFile(path)).length);
  for (const id of ['a', 'b']) assert.ok((await readFile(artifactPath(f.directory, id, 'completion'))).length);
  assert.ok((await readFile(join(f.directory, 'preview.svg'))).length);
});

test('去重输出没有整批提交记录或只有部分输出时，不消费它们，不提前补形', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
  await runLayering({ ...f, groups: null, steps: { ...steps, async reduceOutlines() { return { status: 'pending', message: 'waiting' }; } } });
  await writeAtomic(artifactPath(f.directory, 'a', 'reduction'), shape('a'));
  events.length = 0;
  await runLayering({ ...f, groups: null, steps });
  assert.equal(events[0], 'layer-0:reduce');
  assert.ok(events.includes('a:completion'));
  await rm(artifactPath(f.directory, 'b', 'reduction'));
  const state = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(state.groups[0].steps.reduction.status, 'completed');
  assert.equal(state.groups[1].steps.reduction.status, 'pending');
});

test('补形中断只留下草稿；续跑从补形继续，不重做轮廓、review、去重', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  await assert.rejects(runLayering({ ...f, groups: null, steps: { ...steps, async completeOcclusion(context) {
    await writeAtomic(context.outputPath, shape(context.group.id)); throw new Error('completion interrupted');
  } } }), /completion interrupted/);
  await assert.rejects(readFile(artifactPath(f.directory, 'head', 'completion')), { code: 'ENOENT' });
  events.length = 0;
  await runLayering({ ...f, groups: null, steps });
  assert.deepEqual(events, ['head:completion', 'head:check', 'head:children']);
});

test('自检失败不分析子组；有效 SVG 不等于自检完成，续跑只重做自检及分析', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  await assert.rejects(runLayering({ ...f, groups: null, steps: { ...steps, async checkCompletion() {
    return { status: 'completed', output: { passed: false as true } };
  } } }), /completion check did not pass/);
  assert.ok(!events.includes('head:children'));
  assert.equal((await readStep(join(f.directory, groupStepId('head', 'completion')))).status, 'running');
  assert.ok(await readFile(artifactPath(f.directory, 'head', 'completion')));
  assert.equal((await GroupStore.open(f.directory)).snapshot().groups[0].steps.completionCheck.status, 'pending');
  events.length = 0;
  await runLayering({ ...f, groups: null, steps });
  assert.deepEqual(events, ['head:check', 'head:children']);
});

test('分析返回空子组有明确事实记录，重启不会重复分析；删除该步骤只重做分析', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  await runLayering({ ...f, groups: null, steps });
  const tree = await readJson(join(f.directory, 'groups.json'));
  assert.deepEqual(tree.groups[0].groups, []);
  assert.deepEqual(await readJson(reportPath(f.directory, 'head', 'children')), { groupId: 'head', groups: [] });
  events.length = 0;
  await runLayering({ ...f, groups: null, steps });
  assert.deepEqual(events, []);
  await rm(join(f.directory, groupStepId('head', 'children')), { recursive: true });
  await runLayering({ ...f, groups: null, steps });
  assert.deepEqual(events, ['head:children']);
});
test('分析提交后中断，子组记录已完成；续跑直接进入下一层', async t => {
  const f = await fixture(t), events: string[] = [];
  const steps = workingSteps(events, [{ id: 'head' }], { head: [{ id: 'head/eye', kind: 'part' }] });
  await assert.rejects(runLayering({ ...f, groups: null, steps, maxDepth: 1, progress(message) {
    if (message === '[head] 子组分析：完成') throw new Error('interrupt after atomic commit');
  } }), /interrupt after atomic commit/);
  assert.equal((await readJson(reportPath(f.directory, 'head', 'children'))).groups[0].id, 'head/eye');
  assert.equal((await readStep(join(f.directory, groupStepId('head', 'children')))).status, 'completed');
  events.length = 0;
  await runLayering({ ...f, groups: null, steps });
  assert.ok(!events.includes('head:children'));
  assert.ok(events.includes('head/eye:outline'));
  assert.ok(await readFile(artifactPath(f.directory, 'head/eye', 'outline')));
  assert.match(artifactPath(f.directory, 'head/eye', 'outline'), /step09_outline\/head\/children\/eye\/outline\.svg$/);
});
test('blocked 或 pending 阻止整层去重及下一层，其他已启动轮廓可收尾', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
  const result = await runLayering({ ...f, groups: null, steps: { ...steps, async reviewOutline(context) {
    return context.group.id === 'b' ? { status: 'pending', message: 'blocked' } : steps.reviewOutline(context);
  } } });
  assert.equal(result.status, 'pending');
  assert.ok(!events.includes('layer-0:reduce') && !events.some(event => event.includes(':completion')));
});

test('去重清空整个组时保留空 SVG，跳过该组补形和分析模型，仍可稳定续跑', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
  const reducer = async (context: Parameters<NonNullable<typeof steps.reduceOutlines>>[0]) => {
    const entry = context.entries.find(entry => entry.group.id === 'b')!;
    await writeAtomic(entry.outputPath, shape('b', 10, 90, true));
    return { status: 'completed' as const, output: { changed: [{ groupId: 'b', path: entry.outputPath }] } };
  };
  await runLayering({ ...f, groups: null, steps: { ...steps, reduceOutlines: reducer } });
  assert.ok(!events.some(event => /^b:(completion|check|children)$/.test(event)));
  const state = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(state.groups[1].steps.children.status, 'completed');
});

test('显式分支可复核同层去重，只补全选中或实际改变的部件', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
  await runLayering({ ...f, groups: null, steps: { ...steps, async completeOcclusion() { return { status: 'pending', message: 'not implemented' }; } } });
  events.length = 0;
  await runLayering({ ...f, groups: { id: 'a' }, steps });
  assert.deepEqual(events, ['a:completion', 'a:check', 'a:children']);
  await rm(join(f.directory, layerStepId(0), '.completed'));
  events.length = 0;
  await runLayering({ ...f, groups: { id: 'a' }, steps });
  // 重做本层得到相同字节，已完成的补全不受影响。
  assert.deepEqual(events, ['layer-0:reduce']);
});

test('指定子组仍需完整祖先；禁止未知组、空选择、错误父子关系及导入外部进度', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  await runLayering({ ...f, groups: null, steps: { ...steps, async completeOcclusion() { return { status: 'pending', message: 'waiting' }; } } });
  events.length = 0;
  for (const groups of [[], { id: 'unknown' }]) await assert.rejects(runLayering({ ...f, groups, steps }));
  await runLayering({ ...f, groups: { id: 'head', note: 'external', steps: { completion: { status: 'completed', output: { path: 'missing.svg' } } } }, steps });
  assert.ok(events.includes('head:completion'));
  assert.notEqual((await GroupStore.open(f.directory)).snapshot().groups[0].note, 'external');
});

test('旧树混入 steps 不代表完成；损坏的事实文件会拒绝续跑', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  await writeAtomic(join(f.directory, 'groups.json'), JSON.stringify({ groups: [{ id: 'head', steps: {
    outline: { status: 'completed', output: { path: '/old/machine/head.svg' } },
  } }], merge: { status: 'completed' } }));
  await runLayering({ ...f, groups: null, steps });
  assert.ok(events.includes('head:outline'));
  await writeAtomic(reportPath(f.directory, 'head', 'review'), '{broken');
  await assert.rejects(runLayering({ ...f, groups: null, steps }), /JSON/);
});

test('LF 审查哈希在 CRLF 签出中仍对应同一稿，返修记录无需依赖 .repairs 目录数量', () => {
  const text = shape('head').replace('><g', '>\n<g');
  const verified = reviewedArtifact(Buffer.from(text.replace(/\n/g, '\r\n')), 'outline.svg', { groupId: 'head', reviews: [
    { verdict: 'revise', feedback: 'first', candidateHash: 'old' },
    { verdict: 'revise', feedback: 'second', candidateHash: 'previous', repairedCandidateHash: svgHash(text) },
  ] } as never);
  assert.equal(verified?.reviewOutcome, 'repaired');
});
test('异常后当前批次已派发任务收尾，保留成功事实且不进入后续阶段', { timeout: 5000 }, async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const release = Promise.withResolvers<void>(), failed = Promise.withResolvers<void>();
  const run = runLayering({ ...f, groups: null, steps: { ...steps, async drawOutline(context) {
    if (context.group.id === 'a') { failed.resolve(); throw new Error('failed draw'); }
    await release.promise; return steps.drawOutline(context);
  } } });
  const rejection = assert.rejects(run, error => error instanceof GroupExecutionError && error.groupId === 'a');
  await failed.promise;
  release.resolve(); await rejection;
  assert.ok(!events.some(event => event.includes('reduce')));
  assert.ok(await readFile(artifactPath(f.directory, 'b', 'outline')));
  assert.ok(await readFile(artifactPath(f.directory, 'c', 'outline')));
});

test('jianma 成果归档恢复 115 节点的完整结构与复核事实', async t => {
  const directory = new URL('../../../../../demos/jianma/part-layering/', import.meta.url);
  try { await stat(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    t.skip('仅仓库验收：独立安装的 skill 不携带 demos/jianma 成果归档');
    return;
  }
  await stat(new URL('step08_initial/.completed', directory));
  const store = await GroupStore.open(fileURLToPath(directory));
  const groups = store.snapshot().groups;
  assert.equal(groups.length, 8);
  assert.ok(groups.every(group => group.steps.outline.status === 'completed' && group.steps.review.status === 'completed'));
  assert.ok(groups.every(group => Object.values(group.steps).every(step => step.status === 'completed')));
  assert.equal(groups.find(group => group.id === 'arms')!.steps.review.output!.reviewOutcome, 'repaired');
  const hair = walkGroups([groups.find(group => group.id === 'hair')!]);
  assert.equal(hair.length, 10);
  assert.equal(hair.filter(({ group }) => group.kind === 'part').length, 8);
  assert.ok(hair.every(({ group }) => Object.values(group.steps).every(step => step.status === 'completed')));
  const all = walkGroups(groups);
  assert.equal(all.length, 115);
  const complete = all.every(({ group }) => Object.values(group.steps).every(step => step.status === 'completed'));
  assert.equal(all.filter(({ depth }) => depth === 3).length, 29);
  assert.ok(all.filter(({ depth }) => depth === 3).every(({ group }) => group.kind === 'part' && group.groups.length === 0));
  if (complete) {
    assert.equal(store.snapshot().merge.status, 'completed');
    assert.equal(store.snapshot().merge.output!.path, join(fileURLToPath(directory), 'preview.svg'));
  } else assert.equal(store.snapshot().merge.status, 'pending');
});

test('显式选第二层也不能绕过第一层未完成的其他分支', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }], { a: [{ id: 'a/child' }] });
  await runLayering({ ...f, groups: null, steps: { ...steps, async completeOcclusion(context) {
    return context.group.id === 'b' ? { status: 'pending', message: 'waiting' } : steps.completeOcclusion(context);
  } } });
  events.length = 0;
  await assert.rejects(runLayering({ ...f, groups: { id: 'a/child' }, steps }), /前层尚未全部完成/);
  assert.deepEqual(events, []);
});

test('自定义去重适配器的错组草稿也会拒绝发布，不覆盖正式文件', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
  await assert.rejects(runLayering({ ...f, groups: null, steps: { ...steps, async reduceOutlines(context) {
    const entry = context.entries[0]; await writeAtomic(entry.outputPath, shape('wrong_group'));
    return { status: 'completed', output: { changed: [{ groupId: entry.group.id, path: entry.outputPath }] } };
  } } }), /绑定当前组/);
  await assert.rejects(readFile(artifactPath(f.directory, 'a', 'reduction')), { code: 'ENOENT' });
});
