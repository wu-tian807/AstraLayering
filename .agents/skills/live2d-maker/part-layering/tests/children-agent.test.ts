import assert from 'node:assert/strict';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AgentTask } from '../../shared/codex/agents.ts';
import { artifactPath, readJson, reportPath } from '../../shared/part/artifact-facts.ts';
import { analyzeChildren, decodeChildren } from '../../shared/part/children-agent.ts';
import { GroupStore, nodeKind, normalizeGroups, walkGroups, writeAtomic } from '../../shared/part/groups.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { groupStepId } from '../../shared/part/part-steps.ts';
import { parseRunArguments } from '../run.ts';
import { fixture, publishGroups, shape, workingMerger, workingSteps } from './layering-fixture.ts';
import { defaultKnowledgeDirectory } from '../../shared/knowledge.ts';
import { promptInput } from '../../shared/tests/prompt-input.ts';

const signal = new AbortController().signal;
const child = (name: string, kind = 'part') => ({ name, kind, note: `${name} 的完整形体及独立控制范围` });
async function observe(task: AgentTask, path: string) {
  const preview = task.tools!.find(tool => tool.name === 'preview_svg')!;
  await preview.execute({ path, mode: 'svg' }, signal);
  await preview.execute({ path, mode: 'blend' }, signal);
}

test('直属拆分严格校验类型、命名、重复、单 part 包装与嵌套注入', () => {
  const result = decodeChildren('face', { children: [child('base'), child('eye', 'group')], note: '完整覆盖' });
  assert.deepEqual(result.groups.map(node => [node.id, node.kind]), [['face/base', 'part'], ['face/eye', 'group']]);
  assert.deepEqual(decodeChildren('neck', { children: [], note: '整体终止' }).groups, []);
  for (const children of [[child('same'), child('same')], [child('../escape')], [child('leaf', 'unknown')],
    [child('single')], [{ ...child('nested', 'group'), children: [] }], [{ ...child('node'), id: 'outside' }]]) {
    assert.throws(() => decodeChildren('face', { children, note: 'test' }));
  }
  assert.throws(() => normalizeGroups([{ id: 'part', kind: 'part', groups: [{ id: 'part/child' }] }]), /part 不能/);
});

test('真实拆分适配器读取特化及操作约定，通过预览和工具交付，类型事实可恢复', async t => {
  const f = await fixture(t), events: string[] = [];
  let calls = 0;
  const adapter = createLayeringSteps({ async run(task) {
    calls++;
    assert.match(task.prompt, /face_base/);
    const input = promptInput(task.prompt);
    const submit = task.tools!.find(tool => tool.name === 'submit_children')!;
    await assert.rejects(submit.execute({ children: [child('base'), child('eye', 'group')], note: '依据' }, signal), /须查看/);
    await observe(task, input.sourceSvg);
    await submit.execute({ children: [child('base'), child('eye', 'group')], note: '脸底与独立眼睛' }, signal);
    return { text: 'done', images: [] };
  } });
  const steps = { ...workingSteps(events, [{ id: 'face' }]), splitChildren: adapter.splitChildren };
  await runLayering({ ...f, groups: null, steps, maxDepth: 1 });
  assert.equal(calls, 1);
  const record = await readJson(reportPath(f.directory, 'face', 'children'));
  assert.deepEqual(record.groups.map((node: { id: string; kind: string }) => [node.id, node.kind]), [['face/base', 'part'], ['face/eye', 'group']]);
  assert.equal(record.note, '脸底与独立眼睛');
  const tree = await readJson(join(f.directory, 'groups.json'));
  assert.equal(tree.groups[0].groups[0].kind, 'part');
  assert.equal(tree.groups[0].childrenAnalysis, undefined);
  const restored = (await GroupStore.open(f.directory)).snapshot();
  assert.deepEqual(restored.groups[0].groups.map(node => node.kind), ['part', 'group']);
  await runLayering({ ...f, groups: null, steps, maxDepth: 1 });
  assert.equal(calls, 1);
  // 类型以 step03/children.json 为准；groups.json 只保留可编辑的名称与 note。
  const changed = await readJson(join(f.directory, 'groups.json'));
  changed.groups[0].groups[0].kind = 'group';
  await writeAtomic(join(f.directory, 'groups.json'), JSON.stringify(changed));
  assert.equal((await GroupStore.open(f.directory)).snapshot().groups[0].groups[0].kind, 'part');
});

test('拆分在正文里写出可选参考图的路径与用途，按需调用 view_bitmap 查看，原图保持只读', async t => {
  const f = await fixture(t);
  await publishGroups(f.directory, [{ id: 'hair' }]);
  const source = artifactPath(f.directory, 'hair', 'completion');
  await writeAtomic(source, shape('hair'));
  const boards = join(defaultKnowledgeDirectory, 'part-layering/step12_children/references/hair');
  const sourceBefore = await readFile(source), refBefore = await readFile(join(boards, '02-长发主束与细束的粒度对照-莉尔.png'));
  const result = await analyzeChildren({ ...f, group: normalizeGroups([{ id: 'hair' }])[0], completed: { path: source } }, {
    async run(task) {
      const input = promptInput(task.prompt);
      assert.equal(input.sourceSvg, source);
      assert.deepEqual(input.additionalReferences.map((item: { path: string }) => item.path),
        (await readdir(boards)).filter(name => name.endsWith('.png')).sort().map(name => join(boards, name)));
      assert.match(input.additionalReferences[1].description, /^长发主束与细束的粒度对照（莉尔）/);
      const view = task.tools!.find(tool => tool.name === 'view_bitmap')!;
      const observed = await view.execute({ path: input.additionalReferences[1].path, crop: [0, 0, 30, 30], scale: 2 }, signal);
      assert.equal(observed.contentItems[1].type, 'inputImage');
      assert.equal((await view.execute({ path: input.reference }, signal)).success, true);
      await observe(task, source);
      await task.tools!.find(tool => tool.name === 'submit_children')!.execute({
        children: [child('main'), child('side')], note: '参考完整发片，按当前独立控制需求拆分',
      }, signal);
      return { text: 'done', images: [] };
    },
  });
  assert.deepEqual(result.groups.map(g => g.id), ['hair/main', 'hair/side']);
  assert.deepEqual(await readFile(source), sourceBefore);
  assert.deepEqual(await readFile(join(boards, '02-长发主束与细束的粒度对照-莉尔.png')), refBefore);
});

test('part 仍完成绘制到补全检查但不分析，混合层 BFS、深度边界和叶子合并均成立', async t => {
  const f = await fixture(t), events: string[] = [];
  const steps = workingSteps(events, [{ id: 'body' }], {
    body: [{ id: 'body/torso', kind: 'part' }, { id: 'body/arm', kind: 'group' }],
    'body/arm': [{ id: 'body/arm/upper', kind: 'part' }, { id: 'body/arm/lower', kind: 'part' }],
  });
  await runLayering({ ...f, groups: null, steps, maxDepth: 1 });
  assert.ok(!events.some(event => event.startsWith('body/torso:')));
  events.length = 0;
  await runLayering({ ...f, groups: null, steps, maxDepth: 2 });
  assert.ok(events.includes('body/torso:outline') && events.includes('body/torso:check'));
  assert.ok(!events.includes('body/torso:children'));
  assert.ok(!events.includes('body/arm/upper:outline'));
  assert.deepEqual(await readJson(reportPath(f.directory, 'body/torso', 'children')), { groupId: 'body/torso', groups: [] });
  const state = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(state.groups[0].groups[0].steps.children.status, 'completed');
  assert.equal(nodeKind(state.groups[0].groups[0]), 'part');
  events.length = 0;
  await runLayering({ ...f, groups: null, steps, maxDepth: 3, mergeSvg: async context => {
    assert.deepEqual(context.parts.map(part => part.groupId), ['body/torso', 'body/arm/upper', 'body/arm/lower']);
    return workingMerger(events)(context);
  } });
  assert.ok(events.includes('body/arm/upper:check') && !events.some(event => event.endsWith(':children')));
  events.length = 0;
  await runLayering({ ...f, groups: null, steps, mergeSvg: workingMerger(events) });
  assert.deepEqual(events, []);
  assert.ok(walkGroups((await GroupStore.open(f.directory)).snapshot().groups).every(({ group }) => group.steps.children.status === 'completed'));
});

test('分析期间或提交后修改父 SVG 会失败，未提交的最终文本不是分析事实', async t => {
  const f = await fixture(t), path = join(f.directory, 'source.svg');
  const group = normalizeGroups([{ id: 'neck' }])[0];
  await writeAtomic(path, shape('neck'));
  const context = { ...f, group, completed: { path } };
  await assert.rejects(analyzeChildren(context, { async run() { return { text: '{"children":[]}', images: [] }; } }), /未通过 submit_children/);
  await assert.rejects(analyzeChildren(context, { async run(task) {
    await observe(task, path);
    await task.tools!.find(tool => tool.name === 'submit_children')!.execute({ children: [], note: '颈部终止' }, signal);
    await writeAtomic(path, shape('neck', 20, 80));
    return { text: 'done', images: [] };
  } }), /修改了父组/);
});

test('父完成稿改变后旧分析不能放行下一层，CLI 深度输入有边界', async t => {
  const f = await fixture(t), steps = workingSteps([], [{ id: 'a' }], { a: [{ id: 'a/child', kind: 'part' }] });
  await runLayering({ ...f, groups: null, steps, maxDepth: 1 });
  await rm(join(f.directory, groupStepId('a', 'completion'), '.completed'));
  await assert.rejects(runLayering({ ...f, groups: { id: 'a/child' }, steps }), /前层尚未全部完成/);
  assert.equal(parseRunArguments(['--max-depth', '2']).maxDepth, 2);
  for (const value of ['0', '-1', '1.5', 'NaN', '9007199254740992']) assert.throws(() => parseRunArguments([`--max-depth=${value}`]), /正整数/);
  assert.ok(await readFile(artifactPath(f.directory, 'a', 'completion')));
});
