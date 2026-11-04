import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { artifactPath, readJson } from '../../shared/part/artifact-facts.ts';
import { GroupStore, writeAtomic } from '../../shared/part/groups.ts';
import { runLayering } from '../../shared/part/layering.ts';
import type { OcclusionContext } from '../../shared/part/layering-types.ts';
import { planPartOcclusion } from '../../shared/part/occlusion-agent.ts';
import { occlusionPath, occlusionSourceHash, restoreOcclusionPlan, validateOcclusionPlan } from '../../shared/part/occlusion-plan.ts';
import { fixture, workingMerger, workingSteps } from './layering-fixture.ts';

const signal = new AbortController().signal;
async function prepared(t: Parameters<typeof fixture>[0]) {
  const f = await fixture(t), events: string[] = [];
  const steps = workingSteps(events, [{ id: 'head' }, { id: 'neck' }], { head: [{ id: 'head/face', kind: 'part' }, { id: 'head/eye', kind: 'part' }] });
  await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
  const document = (await GroupStore.open(f.directory)).snapshot();
  const context: OcclusionContext = { ...f, groups: document.groups, preview: document.merge.output! };
  return { ...f, steps, events, context };
}

test('独立深度表覆盖全部终止节点，拒绝重复、非法深度、漏检、旧版本和局部规则', async t => {
  const f = await prepared(t), plan = (await restoreOcclusionPlan(f.context))!;
  assert.deepEqual(plan.layers.map(row => row.id), ['head/face', 'head/eye', 'neck']);
  const hash = await occlusionSourceHash(f.context);
  for (const change of [
    (p: typeof plan) => p.layers.pop(),
    (p: typeof plan) => { p.layers[1].id = p.layers[0].id; },
    (p: typeof plan) => { p.layers[0].id = 'head'; },
    (p: typeof plan) => { p.layers[0].level = 2; },
    (p: typeof plan) => { p.layers[0].check.note = ''; },
    (p: typeof plan) => { Object.assign(p, { version: 1 }); },
    (p: typeof plan) => { Object.assign(p.layers[0], { localOcclusions: [] }); },
    (p: typeof plan) => { Object.assign(p.layers[0], { occludedBy: [] }); },
    (p: typeof plan) => { Object.assign(p.layers[0], { visibility: 'visible' }); },
  ]) {
    const bad = structuredClone(plan); change(bad);
    assert.throws(() => validateOcclusionPlan(bad, f.context, hash));
  }
  const tree = await readJson(join(f.directory, 'groups.json'));
  assert.equal(tree.occlusion, undefined);
  assert.equal(tree.layers, undefined);
});

test('最后一步在 preview 后执行；完成后沿用，交付缺失时拒绝，删除完成标记只重跑层级，不重做上游', async t => {
  const f = await prepared(t), previewBefore = await readFile(f.context.preview.path), treePath = join(f.directory, 'groups.json');
  const treeBefore = await readFile(treePath);
  let calls = 0;
  const steps = { ...f.steps, async planOcclusion(context: OcclusionContext) {
    calls++;
    assert.deepEqual(await readFile(context.preview.path), previewBefore);
    return f.steps.planOcclusion!(context);
  } };
  f.events.length = 0;
  await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(f.events) });
  assert.equal(calls, 0);
  await rm(occlusionPath(f.directory));
  await assert.rejects(runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(f.events) }), /交付缺失/);
  await rm(join(f.directory, 'step14_occlusion/.completed'));
  assert.equal((await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(f.events) })).status, 'completed');
  assert.equal(calls, 1);
  assert.deepEqual(f.events, []);
  assert.deepEqual(await readFile(treePath), treeBefore);
});

test('已合并而最后一步待办、失败或中断时不冒充完成，恢复只执行最后一步', async t => {
  const f = await prepared(t);
  await rm(join(f.directory, 'step14_occlusion/.completed')); f.events.length = 0;
  const pending = await runLayering({ ...f, groups: null, steps: { ...f.steps,
    async planOcclusion() { return { status: 'pending', message: 'head/face 深度待确认' }; } } });
  assert.equal(pending.status, 'pending');
  assert.equal(pending.output, f.context.preview.path);
  assert.equal(pending.occlusionPath, undefined);
  await assert.rejects(runLayering({ ...f, groups: null, steps: { ...f.steps,
    async planOcclusion() { throw new Error('interrupted'); } } }), /interrupted/);
  assert.equal(await readJson(occlusionPath(f.directory)), undefined);
  const done = await runLayering({ ...f, groups: null, steps: f.steps });
  assert.equal(done.status, 'completed');
  assert.equal(done.occlusionPath, occlusionPath(f.directory));
  assert.deepEqual(f.events, []);
});

test('真实适配器强制候选后逐件独显/叠加检查，修订清空检查，保留跨 group 层序', async t => {
  const f = await prepared(t), ids = ['neck', 'head/face', 'head/eye'];
  const sourceBefore = await readFile(artifactPath(f.directory, ids[1], 'completion'));
  const result = await planPartOcclusion(f.context, { async run(task) {
    const tool = (name: string) => task.tools!.find(tool => tool.name === name)!;
    const preview = tool('preview_svg'), propose = tool('propose_occlusion'), check = tool('check_occlusion_part'), submit = tool('submit_occlusion');
    const layers = ids.map((id, level) => ({ id, level, note: '依原图确认整件固定深度' }));
    await assert.rejects(propose.execute({ layers }, signal), /须查看/);
    await preview.execute({ path: f.context.preview.path, mode: 'blend' }, signal);
    await propose.execute({ layers }, signal);
    await assert.rejects(submit.execute({}, signal), /未检查/);
    await assert.rejects(check.execute({ id: ids[0], note: 'checked' }, signal), /须先查看/);
    const candidate = join(f.directory, 'step14_occlusion/workspace/candidate.svg');
    await preview.execute({ path: candidate, mode: 'blend' }, signal);
    for (const id of ids) {
      await preview.execute({ path: artifactPath(f.directory, id, 'completion'), mode: 'svg' }, signal);
      await preview.execute({ path: artifactPath(f.directory, id, 'completion'), mode: 'blend' }, signal);
      await preview.execute({ path: artifactPath(f.directory, id, 'reduction'), mode: 'blend' }, signal);
      await check.execute({ id, note: `${id} 的整体固定深度已核对` }, signal);
    }
    await propose.execute({ layers }, signal);
    await assert.rejects(submit.execute({}, signal), /未检查/);
    await preview.execute({ path: candidate, mode: 'blend' }, signal);
    for (const id of ids) {
      for (const mode of ['svg', 'blend']) await preview.execute({ path: artifactPath(f.directory, id, 'completion'), mode }, signal);
      await preview.execute({ path: artifactPath(f.directory, id, 'reduction'), mode: 'blend' }, signal);
      await check.execute({ id, note: '重新核对' }, signal);
    }
    await submit.execute({}, signal);
    return { text: 'done', images: [] };
  } });
  assert.equal(result.status, 'completed');
  if (result.status === 'completed') assert.deepEqual(result.output.layers.map(row => row.id), ids);
  assert.deepEqual(await readFile(artifactPath(f.directory, ids[1], 'completion')), sourceBefore);
});

test('真实适配器无法确认整件深度时交接依据并保留待办', async t => {
  const f = await prepared(t);
  const result = await planPartOcclusion(f.context, { async run(task) {
    await task.tools!.find(tool => tool.name === 'report_occlusion_problem')!.execute({ message: '当前参考无法辨认 head/face 与 neck 的前后关系，需核实对应部件' }, signal);
    return { text: 'pending', images: [] };
  } });
  assert.equal(result.status, 'pending');
});

test('多深度保留逻辑 part；必须检查全部区域，完成后可恢复而不重画 SVG', async t => {
  const f = await prepared(t), ids = ['head/face', 'head/eye', 'neck'];
  const before = await readFile(join(f.directory, 'groups.json'));
  const result = await planPartOcclusion(f.context, { async run(task) {
    const tool = (name: string) => task.tools!.find(tool => tool.name === name)!;
    const preview = tool('preview_svg'), propose = tool('propose_occlusion'), check = tool('check_occlusion_part');
    await preview.execute({ path: f.context.preview.path, mode: 'blend' }, signal);
    const proposal = await propose.execute({ layers: [
      { id: ids[0], note: '同一运动部件，局部穿插', levels: [{ level: 0, region: '后方区域' }, { level: 2, region: '前方区域，与后方连续' }] },
      { id: ids[1], note: '中间部件', level: 1 }, { id: ids[2], note: '最前方部件', level: 3 },
    ] }, signal);
    assert.match(JSON.stringify(proposal), /未按文本切片/);
    await preview.execute({ path: join(f.directory, 'step14_occlusion/workspace/candidate.svg'), mode: 'blend' }, signal);
    for (const id of ids) await preview.execute({ path: artifactPath(f.directory, id, 'completion'), mode: 'blend' }, signal);
    await assert.rejects(check.execute({ id: ids[0], note: '只看整件' }, signal), /全部深度区域/);
    await assert.rejects(check.execute({ id: ids[0], note: '漏检', regions: [{ level: 0, note: '已看后方' }] }, signal), /全部深度区域/);
    await check.execute({ id: ids[0], note: '各区域连续，穿插有依据', regions: [
      { level: 0, note: '该区域在中间部件后' }, { level: 2, note: '该区域在中间部件前' },
    ] }, signal);
    for (const id of ids.slice(1)) await check.execute({ id, note: '已对照原图确认深度' }, signal);
    await tool('submit_occlusion').execute({}, signal);
    return { text: 'done', images: [] };
  } });
  assert.equal(result.status, 'completed');
  if (result.status !== 'completed') assert.fail('must complete');
  assert.equal(result.output.version, 3);
  assert.equal(result.output.layers.length, 3);
  assert.equal(result.output.layers[0].level, undefined);
  assert.equal(result.output.layers[0].levels!.length, 2);
  await writeAtomic(occlusionPath(f.directory), JSON.stringify(result.output));
  assert.deepEqual(await restoreOcclusionPlan(f.context), result.output);
  assert.deepEqual(await readFile(join(f.directory, 'groups.json')), before);
});
