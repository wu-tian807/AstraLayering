import { profile } from '../profile.ts';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import type { AgentResult, AgentSession, AgentTask } from '../../shared/codex/agents.ts';
import { artifactPath, publishSvg } from '../../shared/part/artifact-facts.ts';
import { completeGroupOcclusion, checkGroupCompletion } from '../../shared/part/completion-agent.ts';
import { assertCompletionPreserves, composeCompletion } from '../../shared/part/completion-svg.ts';
import { normalizeGroups, GroupStore, walkGroups, writeAtomic } from '../../shared/part/groups.ts';
import { partKnowledge } from '../../shared/part/group-prompts.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { groupStepId } from '../../shared/part/part-steps.ts';
import { fixture, linkedFixture, publishGroups, shape, workingSteps } from './layering-fixture.ts';
import { promptInput } from '../../shared/tests/prompt-input.ts';

const signal = new AbortController().signal;
const paths = [{ d: 'M 5 40 H 20 V 60 H 5 Z' }];
function tool(task: AgentTask, name: string) { return task.tools!.find(tool => tool.name === name)!; }
async function submit(task: AgentTask, path: string) {
  await tool(task, 'preview_svg').execute({ path, mode: 'blend' }, signal);
  await tool(task, 'preview_svg').execute({ path, mode: 'svg' }, signal);
  await tool(task, 'submit_completion').execute({ note: '正面被相邻组遮挡，沿原轮廓保守连接。' }, signal);
}
// Completion runs in a reusable session; these fixtures answer every turn with the same function.
function sessioned(run: (task: AgentTask) => Promise<AgentResult>) {
  return { run, createSession: (): AgentSession => ({ run, async close() {} }) };
}

test('完全遮挡节点可提交空可见轮廓，经独立 review 后补出形体，续跑保留原稿与事实', async t => {
  const f = await fixture(t), calls: string[] = [];
  const run = async (task: AgentTask) => {
    calls.push(task.name);
    const input = promptInput(task.prompt);
    if (task.name.startsWith('组轮廓绘制')) {
      assert.equal(task.imageGeneration, false);
      await tool(task, 'write_outline_svg').execute({ svg: shape('face', 10, 90, true) }, signal);
      await tool(task, 'preview_svg').execute({ path: input.outputSvg, mode: 'blend' }, signal);
    } else if (task.name.startsWith('组轮廓review')) {
      assert.equal(task.imageGeneration, false);
      await tool(task, 'preview_svg').execute({ path: input.candidate, mode: 'edge' }, signal);
      await tool(task, 'submit_review').execute({ verdict: 'pass', feedback: '本测试参考中该节点完全遮挡，没有可见轮廓；隐藏形体留给补全。' }, signal);
    } else {
      assert.ok(task.name.startsWith('正面遮挡补全'));
      assert.equal(task.imageGeneration, true);
      // face 使用专用正文，通用规则修改不能遗漏它。
      assert.doesNotMatch(task.prompt, /露出双耳的结构参考并查看|本次参考只露耳缘/);
      assert.match(task.prompt, /部件完全被遮挡.*必须先.*结构辅助图并查看/);
      assert.doesNotMatch(task.prompt, /\{runtime_context\}|\{fixed_rules\}/);
      await tool(task, 'set_completion_paths').execute({ paths }, signal);
      await submit(task, input.outputDraft);
    }
    return { text: 'fixture done', images: [], threadId: 'empty-outline-thread' };
  };
  const adapter = createLayeringSteps(sessioned(run));
  const steps = { ...workingSteps([], [{ id: 'face', note: '参考中被完全遮挡的真实脸部节点' }]),
    drawOutline: adapter.drawOutline, reviewOutline: adapter.reviewOutline,
    completeOcclusion: adapter.completeOcclusion, checkCompletion: adapter.checkCompletion };
  await runLayering({ ...f, groups: null, steps });
  assert.deepEqual(calls, ['组轮廓绘制-face', '组轮廓review-face', '正面遮挡补全-face']);
  const before = await readFile(artifactPath(f.directory, 'face', 'reduction'), 'utf8');
  const after = await readFile(artifactPath(f.directory, 'face', 'completion'), 'utf8');
  assert.doesNotMatch(before, /<path/);
  assert.equal(assertCompletionPreserves(before, after), 1);
  const restored = (await GroupStore.open(f.directory)).snapshot().groups[0];
  assert.equal(restored.steps.outline.status, 'completed');
  assert.equal(restored.steps.review.output?.reviewOutcome, 'pass');
  assert.equal(restored.steps.completionCheck.status, 'completed');
  await runLayering({ ...f, groups: null, steps });
  assert.equal(calls.length, 3);
});

test('补全原 SVG 正文原样保留，禁止删改属性、重排或注入任意节点', () => {
  const source = shape('head');
  const complete = composeCompletion(source, paths);
  assert.equal(assertCompletionPreserves(source, complete), 1);
  assert.equal(assertCompletionPreserves(source, source), 0);
  assert.equal(complete.replace(/<g data-completion-additions[^>]*>[\s\S]*?<\/g>/, ''), source);
  for (const candidate of [complete.replace('M10 10', 'M12 10'), complete.replace('fill="#55b9ad"', 'fill="#000000"'),
    complete.replace('<path d=', '<path style="opacity:0" d='), shape('head', 5, 95)]) {
    assert.throws(() => assertCompletionPreserves(source, candidate), /改变|未授权/);
  }
  for (const bad of [[{ d: 'M0 0L5 5' }], [{ d: 'M0 0 Z"/><style>path{display:none}</style>' }],
    [{ d: 'M0 0Z', transform: 'scale(2)' }], [{ d: 'M0 0Z', fillRule: 'bad' }]]) {
    assert.throws(() => composeCompletion(source, bad), /只接受/);
  }
});

test('补全默认适配器用只读 agent 和新增工具，提交后正式发布；完成后沿用', async t => {
  const f = await fixture(t), events: string[] = [];
  let calls = 0;
  const adapter = createLayeringSteps(sessioned(async task => {
    calls++;
    assert.equal(task.imageGeneration, true);
    assert.ok(task.tools!.some(tool => tool.name === 'view_bitmap'));
    assert.match(task.prompt, /部件完全被遮挡.*必须先.*结构辅助图并查看/);
    assert.match(task.prompt, /不画成侧面视角的形状/);
    assert.match(task.prompt, /以侧面参考露出被遮挡的一面/);
    const rules = (await readFile(partKnowledge(profile, 'completion').files('main')[1], 'utf8'));
    assert.ok(task.prompt.includes(`【固定范围与操作约定】\n${rules}`));
    assert.doesNotMatch(task.prompt, /提示词来源：/);
    const input = promptInput(task.prompt);
    await tool(task, 'preview_svg').execute({ path: input.sourceSvg, mode: 'blend' }, signal);
    await tool(task, 'set_completion_paths').execute({ paths }, signal);
    await submit(task, input.outputDraft);
    return { text: 'done', images: [] };
  }));
  const steps = { ...workingSteps(events), completeOcclusion: adapter.completeOcclusion, checkCompletion: adapter.checkCompletion };
  await runLayering({ ...f, groups: null, steps });
  assert.equal(calls, 1);
  const source = await readFile(artifactPath(f.directory, 'head', 'reduction'), 'utf8');
  const after = await readFile(artifactPath(f.directory, 'head', 'completion'), 'utf8');
  assert.equal(assertCompletionPreserves(source, after), 1);
  assert.equal((await GroupStore.open(f.directory)).snapshot().groups[0].steps.completionCheck.status, 'completed');
  await runLayering({ ...f, groups: null, steps });
  assert.equal(calls, 1);
});

test('任务根经软链接打开时，预览记录的真实路径仍认作当前补全草稿', async t => {
  const f = await linkedFixture(t, await fixture(t)), events: string[] = [];
  const adapter = createLayeringSteps(sessioned(async task => {
    const input = promptInput(task.prompt);
    await tool(task, 'set_completion_paths').execute({ paths }, signal);
    await submit(task, input.outputDraft);
    return { text: 'done', images: [] };
  }));
  await runLayering({ ...f, groups: null, steps: { ...workingSteps(events), completeOcclusion: adapter.completeOcclusion, checkCompletion: adapter.checkCompletion } });
  assert.equal((await GroupStore.open(f.directory)).snapshot().groups[0].steps.completion.status, 'completed');
});

test('自定义补全实现也受调度器保留原形约束，不发布重画候选', async t => {
  const f = await fixture(t), steps = workingSteps([]);
  await assert.rejects(runLayering({ ...f, groups: null, steps: { ...steps, async completeOcclusion(context) {
    await writeFile(context.outputPath, shape('head', 5, 95));
    return { status: 'completed', output: { path: context.outputPath } };
  } } }), /只允许程序生成的新增层/);
  await assert.rejects(readFile(artifactPath(f.directory, 'head', 'completion')), { code: 'ENOENT' });
});

test('face 特化按完整 ID 独立读取，未特化的子组沿用通用正文', async t => {
  const completion = partKnowledge(profile, 'completion');
  const face = completion.render('main', {}, { taskRoot: '/task', group: 'face' });
  assert.match(face, /不要扩成整个头型/);
  assert.match(face, /不设计侧脸、背面/);
  assert.ok(completion.files('main', 'face/eye')[0].endsWith('step11_completion/prompts/9-正面遮挡补全.md'));
});

test('正式调度中左右十指附加实际掌片与完整指体图片，part 不再分析子组', async t => {
  const f = await fixture(t), events: string[] = [], fingers = ['thumb', 'index_finger', 'middle_finger', 'ring_finger', 'little_finger'];
  const children = Object.fromEntries([
    ['arms', ['arm_left', 'arm_right'].map(name => ({ id: `arms/${name}` }))],
    ...['arm_left', 'arm_right'].flatMap(side => [
      [`arms/${side}`, [{ id: `arms/${side}/hand` }]],
      [`arms/${side}/hand`, ['palm', ...fingers].map(name => ({ id: `arms/${side}/hand/${name}`, kind: 'part' as const }))],
    ]),
  ]);
  const steps = workingSteps(events, [{ id: 'arms' }], children), calls: string[] = [];
  const adapter = createLayeringSteps(sessioned(async task => {
    const input = promptInput(task.prompt);
    const id = input.group.id;
    calls.push(id);
    // The finger override replaces the default completion text.
    assert.ok(task.prompt.includes('为当前整根手指补齐正面遮挡下的隐藏指身、指根及与手掌连接所需的局部胶水余量'));
    assert.match(task.prompt, /仅延伸到邻指下面不等于接到了手掌/);
    assert.match(task.prompt, /拇指按其自身根部与鱼际附近/);
    const palm = `${id.slice(0, id.lastIndexOf('/'))}/palm`;
    assert.match(task.prompt, /Milly 与樱桃的完整指体图例/);
    assert.match(task.prompt, /整指连通或指根碰到掌片，不代表中间指身已经补足/);
    assert.match(task.prompt, /按两边合起来组成一个圆来想/);
    const palmSvg = artifactPath(f.directory, palm, 'reduction');
    assert.ok(task.prompt.includes(`- ${palmSvg}：`));
    assert.match(task.prompt, /step11_completion\/references\/fingers\/complete-fingers\.png：[^\n]*不照搬姿势、宽度、肤色/);
    const ref = { sourceSvg: palmSvg };
    const result = await tool(task, 'read_svg').execute({ path: ref.sourceSvg }, signal);
    assert.ok(JSON.stringify(result).includes(palm));
    const otherPalm = ref.sourceSvg.replace(id.includes('/arm_left/') ? '/arm_left/' : '/arm_right/', id.includes('/arm_left/') ? '/arm_right/' : '/arm_left/');
    assert.equal((await tool(task, 'read_svg').execute({ path: otherPalm }, signal)).success, true);
    await submit(task, input.outputDraft);
    return { text: 'done', images: [] };
  }));
  await runLayering({ ...f, groups: null, steps: { ...steps, completeOcclusion: context =>
    fingers.includes(context.group.id.split('/').at(-1)!) ? adapter.completeOcclusion(context) : steps.completeOcclusion(context),
    checkCompletion: adapter.checkCompletion } });
  const expected = ['arm_left', 'arm_right'].flatMap(side => fingers.map(name => `arms/${side}/hand/${name}`));
  assert.deepEqual(calls.sort(), expected.sort());
  for (const { group } of walkGroups((await GroupStore.open(f.directory)).snapshot().groups).filter(({ group }) => expected.includes(group.id))) {
    assert.equal(group.steps.completionCheck.status, 'completed');
    assert.deepEqual(group.groups, []);
    assert.ok(!events.includes(`${group.id}:children`));
  }
  for (const id of ['arms/arm_left/hand', 'arms/arm_left/hand/palm', 'arms/arm_right/hand', 'arms/arm_right/hand/palm']) {
    assert.ok(partKnowledge(profile, 'completion').files('main', id)[0].endsWith('step11_completion/prompts/9-正面遮挡补全.md'));
  }
});

test('新增路径修正后必须重看当前候选；没有工具提交不能交付', async t => {
  const f = await fixture(t), group = normalizeGroups([{ id: 'face' }])[0];
  await publishGroups(f.directory, [{ id: 'face' }]);
  const source = join(f.directory, 'source.svg'), outputPath = join(f.directory, 'face.draft.svg');
  await writeFile(source, shape('face'));
  const context = { ...f, group, reviewed: { path: source }, outputPath };
  await assert.rejects(completeGroupOcclusion(context, { async run(task) {
    await tool(task, 'preview_svg').execute({ path: outputPath, mode: 'blend' }, signal);
    await tool(task, 'preview_svg').execute({ path: outputPath, mode: 'svg' }, signal);
    await tool(task, 'set_completion_paths').execute({ paths }, signal);
    await assert.rejects(tool(task, 'submit_completion').execute({ note: 'done' }, signal), /须预览当前/);
    return { text: 'done', images: [] };
  } }), /未通过 submit_completion/);
  const result = await completeGroupOcclusion(context, { async run(task) {
    await submit(task, outputPath); // 无需新增，程序允许正式复制。
    return { text: 'done', images: [] };
  } });
  assert.equal(result.path, outputPath);
  const final = outputPath.replace('.draft.svg', '.svg');
  await publishSvg(outputPath, final);
  assert.equal((await checkGroupCompletion({ ...f, group, before: { path: source }, after: { path: final } })).passed, true);
});

test('补全子组必须在父完成范围内，即使原形保留也不能越界', async t => {
  const f = await fixture(t), group = normalizeGroups([{ id: 'head/child' }])[0];
  const parentPath = join(f.directory, 'parent.svg'), source = join(f.directory, 'source.svg');
  await writeFile(parentPath, shape('head', 10, 90));
  await writeFile(source, shape('head/child', 20, 80));
  const parent = normalizeGroups([{ id: 'head', steps: { completion: { status: 'completed', output: { path: parentPath } } } }])[0];
  await assert.rejects(completeGroupOcclusion({ ...f, group, parent, reviewed: { path: source }, outputPath: join(f.directory, 'child.draft.svg') }, {
    async run(task) {
      await tool(task, 'set_completion_paths').execute({ paths }, signal);
      return { text: '', images: [] };
    },
  }), /超出父轮廓/);
});

test('补全 threadId 记在 agents/steps：中断后续跑恢复同一会话', async t => {
  const f = await fixture(t), resumed: (string | undefined)[] = [];
  const session = join(f.directory, 'agents/steps', groupStepId('head', 'completion'), 'session.json');
  let fail = true;
  const agents = { async run(): Promise<AgentResult> { assert.fail('补全必须走可复用会话'); },
    createSession(id?: string, callbacks?: { onSessionStarted?: (id: string, harness: 'agv') => Promise<void> }): AgentSession {
      resumed.push(id);
      const threadId = id || `completion-thread-${resumed.length}`;
      return { async close() {}, async run(task) {
        await callbacks?.onSessionStarted?.(threadId, 'agv');
        if (fail) { fail = false; throw new Error('补全中断'); }
        const input = promptInput(task.prompt);
        await tool(task, 'set_completion_paths').execute({ paths }, signal);
        await submit(task, input.outputDraft);
        return { text: 'done', images: [], threadId, harness: 'agv' };
      } };
    } };
  const adapter = createLayeringSteps(agents);
  const steps = { ...workingSteps([]), completeOcclusion: adapter.completeOcclusion, checkCompletion: adapter.checkCompletion };
  await assert.rejects(runLayering({ ...f, groups: null, steps }), /补全中断/);
  assert.deepEqual(JSON.parse(await readFile(session, 'utf8')), { threadId: 'completion-thread-1', harness: 'agv' });
  await runLayering({ ...f, groups: null, steps });
  assert.deepEqual(resumed, [undefined, 'completion-thread-1']);
});

test('续跑补全沿用保留原形的草稿，提示词只给固定的先读草稿规则；原形已变的草稿或非续跑从原形开始', async t => {
  const f = await fixture(t), group = normalizeGroups([{ id: 'face' }])[0];
  await publishGroups(f.directory, [{ id: 'face' }]);
  const source = join(f.directory, 'source.svg'), outputPath = join(f.directory, 'face.draft.svg');
  await writeFile(source, shape('face'));
  const drawn = composeCompletion(shape('face'), paths);
  const seen = async (resumeDraft: boolean) => {
    let state: string | undefined;
    await completeGroupOcclusion({ ...f, group, reviewed: { path: source }, outputPath, resumeDraft }, { async run(task) {
      const input = promptInput(task.prompt);
      assert.equal('resumedDraft' in input, false);
      assert.match(task.prompt, /outputDraft 已含 sourceSvg 之外、上次中断前补上的形状时/);
      state = await readFile(outputPath, 'utf8');
      await submit(task, outputPath);
      return { text: 'done', images: [] };
    } });
    return state!;
  };
  await writeFile(outputPath, drawn);
  assert.equal(await seen(true), drawn);
  await writeFile(outputPath, drawn);
  assert.equal(await seen(false), shape('face'));
  await writeFile(outputPath, shape('face', 20, 80));
  assert.equal(await seen(true), shape('face'));
});

test('不可见部件直接绘制非空 SVG，完成原图 blend 和独显即可提交；生成图怎样对照由提示词决定', async t => {
  const f = await fixture(t), group = normalizeGroups([{ id: 'face/eye_left/iris', kind: 'part',
    allowOutsideParent: true, hiddenInReference: true }])[0];
  await publishGroups(f.directory, [{ id: group.id, kind: 'part', allowOutsideParent: true, hiddenInReference: true }]);
  const source = join(f.directory, 'source.svg'), outputPath = join(f.directory, 'iris.draft.svg');
  const generated = join(f.directory, 'generated.png');
  await writeFile(source, shape(group.id, 10, 90, true));
  await sharp({ create: { width: 40, height: 20, channels: 4, background: 'blue' } }).png().toFile(generated);
  const result = await completeGroupOcclusion({ ...f, group, reviewed: { path: source }, outputPath }, { async run(task) {
    assert.equal(task.imageGeneration, true);
    assert.match(task.prompt, /referenceRegion.*框选生成图/);
    const input = promptInput(task.prompt);
    assert.equal(input.group.hiddenInReference, true);
    assert.equal(input.group.allowOutsideParent, true);
    await assert.rejects(tool(task, 'set_completion_paths').execute({ paths: [] }, signal), /没有可见/);
    await tool(task, 'set_completion_paths').execute({ paths }, signal);
    const preview = tool(task, 'preview_svg');
    const compare = { path: outputPath, reference: generated, referenceRegion: [0, 0, 40, 20] };
    await preview.execute({ ...compare, mode: 'blend' }, signal);
    await preview.execute({ path: outputPath, mode: 'svg' }, signal);
    await assert.rejects(tool(task, 'submit_completion').execute({ note: 'test' }, signal), /默认 blend/);
    await preview.execute({ path: outputPath, mode: 'blend' }, signal);
    await preview.execute({ ...compare, mode: 'edge', referenceOffset: [0, 1] }, signal);
    // 重新绘制会清除当前草稿的全部旧检查。
    await tool(task, 'set_completion_paths').execute({ paths }, signal);
    await assert.rejects(tool(task, 'submit_completion').execute({ note: 'test' }, signal), /默认 blend/);
    await preview.execute({ ...compare, mode: 'edge' }, signal);
    await submit(task, outputPath);
    return { text: 'done', images: [{ savedPath: generated }] };
  } });
  assert.equal(assertCompletionPreserves(await readFile(source, 'utf8'), await readFile(outputPath, 'utf8')), 1);
  assert.ok(result.dependencies?.some(dep => dep.path === 'part-layering/generated.png'));
  assert.equal((await checkGroupCompletion({ ...f, group, before: { path: source }, after: result })).passed, true);
});

test('对照过的生成图在检查后变化须重新查看，更新的观察可正常提交', async t => {
  const f = await fixture(t), group = normalizeGroups([{ id: 'face', hiddenInReference: true }])[0];
  const source = join(f.directory, 'source.svg'), outputPath = join(f.directory, 'face.draft.svg'), generated = join(f.directory, 'generated.png');
  await writeFile(source, shape('face', 10, 90, true));
  const image = (background: string) => sharp({ create: { width: 40, height: 20, channels: 4, background } }).png().toFile(generated);
  await image('blue');
  await completeGroupOcclusion({ ...f, group, reviewed: { path: source }, outputPath }, { async run(task) {
    await tool(task, 'set_completion_paths').execute({ paths }, signal);
    const compare = { path: outputPath, mode: 'edge', reference: generated };
    await tool(task, 'preview_svg').execute(compare, signal);
    await tool(task, 'preview_svg').execute({ path: outputPath, mode: 'blend' }, signal);
    await tool(task, 'preview_svg').execute({ path: outputPath, mode: 'svg' }, signal);
    await image('green');
    await assert.rejects(tool(task, 'submit_completion').execute({ note: 'test' }, signal), /预览后被修改/);
    await tool(task, 'preview_svg').execute(compare, signal);
    await tool(task, 'submit_completion').execute({ note: '已重新核对生成图边缘与人物位置' }, signal);
    return { text: 'done', images: [] };
  } });
});
