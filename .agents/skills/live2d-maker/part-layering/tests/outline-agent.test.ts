import {staticPromptPrefix} from '../../shared/tests/prompt-prefix.ts';
import { profile } from '../profile.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { artifactPath } from '../../shared/part/artifact-facts.ts';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import type { AgentResult, AgentSession, AgentTask } from '../../shared/codex/agents.ts';
import { GroupStore, normalizeGroups } from '../../shared/part/groups.ts';
import { createLayeringSteps as createDefaultLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { publishGroups, seedInitialGroups } from './layering-fixture.ts';
import { partKnowledge } from '../../shared/part/group-prompts.ts';
import { temporaryKnowledge } from '../../shared/tests/knowledge-fixture.ts';
import { drawGroupOutline } from '../../shared/part/outline-agent.ts';
import { fromTaskPath, taskRootOf } from '../../shared/task-paths.ts';
import { promptInput } from '../../shared/tests/prompt-input.ts';

const signal = new AbortController().signal;
// 本文件仅测试轮廓/review；后续补全由 completion-agent.test.ts 验证。
function createLayeringSteps(agents: Parameters<typeof createDefaultLayeringSteps>[0]) {
  return { ...createDefaultLayeringSteps(agents), completeOcclusion: async () =>
    ({ status: 'pending' as const, message: '轮廓测试结束，补全另行测试' }) };
}
type Runtime = { group: { id: string }; parentGroup: string | null; outputSvg?: string; candidate?: string;
  round?: string };
// A repair turn carries no input of its own: the drawing turn of the same thread gave it.
// The mock holds no thread, so it reads that input from the recovery text's drawing task.
function runtime(task: AgentTask): Runtime {
  const prompt = task.prompt.includes('【本次输入】') ? task.prompt : (task.resumeContext ?? task.recoveryPrompt);
  assert.ok(prompt?.includes('【本次输入】'));
  return promptInput(prompt!) as Runtime;
}
function svg(id: string, left = 10, right = 90) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g id="shape" data-group-path="${id}"><path fill="#ff0000" stroke="none" d="M${left} 10H${right}V90H${left}Z"/></g></svg>`;
}
async function fixture(t: TestContext) {
  // The task layout of a real run, so the prompt's task paths resolve.
  const root = await mkdtemp(join(tmpdir(), 'part-layering-outline-')), directory = join(root, 'part-layering');
  t.after(() => rm(root, { recursive: true, force: true }));
  const references = { directory: join(directory, 'references'), judgment: join(directory, 'references/judgment.json'),
    simplifiedSubject: join(directory, 'references/simplified-subject.png'), baseSubject: join(directory, 'references/base-subject.png') };
  await mkdir(references.directory, { recursive: true });
  await writeFile(references.judgment, JSON.stringify({ needsSimplification: false }));
  const bytes = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#ffffff' } }).png().toBuffer();
  await writeFile(references.simplifiedSubject, bytes);
  await writeFile(references.baseSubject, bytes);
  await seedInitialGroups(directory, [{ id: 'face', note: '脸部与耳朵，不画头顶或后脑' }]);
  return { profile, directory, references, store: await GroupStore.open(directory) };
}

function agents(verdicts: string[], options: {
  missingSelfCheck?: boolean; missingSubmission?: boolean; failRepair?: boolean; failDrawingTurn?: number;
  failAfterSubmission?: boolean;
} = {}) {
  const calls: { task: AgentTask; session: number }[] = [];
  const closed: number[] = [];
  let counter = 0, drawingTurns = 0, reviews = 0;
  async function execute(task: AgentTask, session: number) {
    calls.push({ task, session });
    const input = runtime(task);
    const preview = task.tools!.find(tool => tool.name === 'preview_svg')!;
    if (task.name.startsWith('组轮廓review')) {
      assert.equal(input.outputSvg, undefined);
      await preview.execute({ path: input.candidate, mode: 'edge', crop: [5, 5, 90, 90], scale: 2 }, signal);
      if (!options.missingSubmission) await task.tools!.find(tool => tool.name === 'submit_review')!
        .execute({ verdict: verdicts[Math.min(reviews++, verdicts.length - 1)],
          feedback: `对照左侧可见边界 x=10；主要结构和宽度的具体意见。第 ${reviews} 轮反馈。` }, signal);
      if (options.failAfterSubmission) throw new Error('审查提交后中断');
    } else {
      assert.ok(input.outputSvg);
      await writeFile(fromTaskPath(taskRootOf(task.cwd!), input.outputSvg), svg(input.group.id, 10 + drawingTurns++));
      if ((options.failRepair && drawingTurns > 1) || options.failDrawingTurn === drawingTurns) throw new Error('返修执行失败');
      if (!options.missingSelfCheck) await preview.execute({ path: input.outputSvg, mode: 'blend' }, signal);
    }
    return { text: '普通最终回复，不是 JSON。', images: [], threadId: `session-${session}` };
  }
  return {
    calls, closed,
    async run(task: AgentTask) { return execute(task, ++counter); },
    createSession(): AgentSession {
      const id = ++counter;
      return { run: task => execute(task, id), async close() { closed.push(id); } };
    },
  };
}

test('绘制 ID 在中断前落盘；重启调度后恢复同一会话，reviewer 仍独立', async t => {
  const f = await fixture(t), resumed: (string | undefined)[] = [];
  function persisted(mock: ReturnType<typeof agents>) {
    return { run: mock.run, createSession(id?: string, callbacks?: {
      onSessionStarted?: (id: string, harness: 'agv') => Promise<void>;
    }): AgentSession {
      resumed.push(id);
      const inner = mock.createSession(), threadId = id || 'persistent-drawing-thread';
      return { close: inner.close, async run(task, signal) {
        await callbacks?.onSessionStarted?.(threadId, 'agv');
        const result = await inner.run(task, signal);
        return { ...result, threadId, harness: 'agv' };
      } };
    } };
  }
  await assert.rejects(runLayering({ ...f, groups: null, steps: createLayeringSteps(persisted(agents(['pass'], { failDrawingTurn: 1 }))) }), /执行失败/);
  const path = join(f.directory, 'agents/steps/step09_outline/face/session.json');
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { threadId: 'persistent-drawing-thread', harness: 'agv' });
  const second = agents(['pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(persisted(second)) });
  assert.deepEqual(resumed, [undefined, 'persistent-drawing-thread', undefined]); // last: the independent reviewer session
  assert.notEqual(second.calls[0].session, second.calls[1].session);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).threadId, 'persistent-drawing-thread');
});

test('提示词按完整 group ID 和步骤独立替换；子组不继承父组特化', async t => {
  const directory = join(await temporaryKnowledge(t), 'part-layering', 'step09_outline', 'prompts');
  const outline = partKnowledge(profile, 'outline');
  await writeFile(join(directory, '5-组轮廓.md'), '通用绘制');
  await writeFile(join(directory, '6-轮廓review.md'), '通用审查');
  await mkdir(join(directory, 'groups', 'face'), { recursive: true });
  await writeFile(join(directory, 'groups', 'face', '5-组轮廓.md'), '只用于 face 的完整绘制正文');
  assert.equal(outline.render('main', {}, { group: 'face' }), '只用于 face 的完整绘制正文');
  assert.equal(outline.render('review', {}, { group: 'face' }), '通用审查');
  assert.equal(outline.render('main', {}, { group: 'face/eye' }), '通用绘制');
  await mkdir(join(directory, 'groups', 'face', 'eye'));
  await writeFile(join(directory, 'groups', 'face', 'eye', '6-轮廓review.md'), '眼睛审查');
  assert.equal(outline.render('review', {}, { group: 'face/eye' }), '眼睛审查');
  await writeFile(join(directory, 'groups', 'face', '5-组轮廓.md'), ' ');
  assert.throws(() => outline.render('main', {}, { group: 'face' }), /先验知识文件为空/);
  assert.throws(() => outline.render('main', {}, { group: '../face' }), /Invalid/);
});

test('轮廓写入工具在终端不可用时完成草稿，拒绝路径注入及错误归属且仍须预览', async t => {
  const f = await fixture(t), outputPath = join(f.directory, 'face.draft.svg');
  const group = normalizeGroups([{ id: 'face', note: '脸部与耳朵，不画头顶或后脑' }])[0];
  const result = await drawGroupOutline({ ...f, group, outputPath }, { async run(task) {
    const write = task.tools!.find(tool => tool.name === 'write_outline_svg')!;
    await assert.rejects(write.execute({ svg: svg('face'), path: join(f.directory, 'foreign.svg') }, signal), /路径由程序绑定/);
    await assert.rejects(readFile(join(f.directory, 'foreign.svg')), { code: 'ENOENT' });
    await assert.rejects(write.execute({ svg: svg('other') }, signal));
    await assert.rejects(readFile(join(f.directory, 'face.svg')), { code: 'ENOENT' });
    await write.execute({ svg: svg('face') }, signal);
    assert.equal(await readFile(outputPath, 'utf8'), svg('face'));
    await task.tools!.find(tool => tool.name === 'view_bitmap')!.execute({ path: f.references.baseSubject, crop: [10,10,20,20], scale: 2 }, signal);
    await task.tools!.find(tool => tool.name === 'preview_svg')!.execute({ path: outputPath, mode: 'blend' }, signal);
    return { text: 'done', images: [] };
  } });
  assert.equal(result.path, outputPath);
  await assert.rejects(readFile(join(f.directory, 'face.svg')), { code: 'ENOENT' });
});

test('真实默认适配器接入绘制、自检和独立 review，之后停在补形；续跑全部跳过', async t => {
  const f = await fixture(t);
  const mock = agents(['pass']);
  const result = await runLayering({ ...f, groups: null, steps: createLayeringSteps(mock) });
  assert.equal(result.status, 'pending');
  assert.equal(mock.calls.length, 2);
  assert.ok(mock.calls[0].task.prompt.startsWith(staticPromptPrefix(await readFile(partKnowledge(profile, 'outline').files('main')[0], 'utf8'))));
  assert.ok(mock.calls[1].task.prompt.startsWith(staticPromptPrefix(await readFile(partKnowledge(profile, 'outline').files('review')[0], 'utf8'))));
  assert.ok(mock.calls.every(call => call.task.cwd === f.directory));
  assert.notEqual(mock.calls[0].session, mock.calls[1].session);
  assert.deepEqual([...mock.closed].sort(), [mock.calls[0].session, mock.calls[1].session].sort()); // the drawing thread and the independent reviewer
  const state = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(state.groups[0].steps.outline.status, 'completed');
  assert.equal(state.groups[0].steps.review.status, 'completed');
  assert.equal(state.groups[0].steps.completion.status, 'pending');
  assert.equal(state.groups[0].steps.children.status, 'pending');
  assert.equal(state.groups[0].steps.review.output!.path, state.groups[0].steps.outline.output!.path);
  assert.deepEqual((await readdir(join(f.directory, 'step09_outline/face'))).filter(name => name.endsWith('.svg')), ['outline.svg']);
  const report = JSON.parse(await readFile(join(f.directory, 'step09_outline/face/review.json'), 'utf8'));
  assert.equal(report.reviews[0].verdict, 'pass');
  assert.equal(report.reviews[0].observations.length, 1);
  const [observation] = report.reviews[0].observations;
  for (const path of [observation.source, observation.savedPath]) assert.ok(!isAbsolute(path) && !path.startsWith('..'), path);
  await readFile(join(dirname(f.directory), observation.savedPath));
  await assert.rejects(readFile(join(f.directory, 'parts/face.svg')), { code: 'ENOENT' });
  await runLayering({ ...f, groups: null, steps: createLayeringSteps({ async run() { assert.fail('已完成的两步不能重复'); } }) });
});

test('revise 由原绘制会话返修，每次 review 新会话，报告保留各轮意见', async t => {
  const f = await fixture(t);
  const mock = agents(['revise', 'pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(mock) });
  assert.deepEqual(mock.calls.map(call => call.task.name.split('-')[0]), ['组轮廓绘制', '组轮廓review', '组轮廓返修', '组轮廓review']);
  assert.equal(mock.calls[0].session, mock.calls[2].session);
  assert.notEqual(mock.calls[1].session, mock.calls[3].session);
  // The repair names the review file and round; the feedback stays in review.json.
  assert.match(mock.calls[2].task.prompt, /step09_outline\/face\/review\.json 中 reviews 最后一条（第 1 轮 review）的 feedback/);
  assert.doesNotMatch(mock.calls[2].task.prompt, /左侧可见边界 x=10/);
  assert.equal(await readFile(join(f.directory, 'step09_outline/face/outline.repairs/1/round.txt'), 'utf8'), '1\n');
  assert.equal(await readFile(join(f.directory, 'step09_outline/face/outline.repairs/1/prompt.txt'), 'utf8'), mock.calls[2].task.prompt);
  assert.deepEqual(mock.calls[2].task.tools!.map(tool => tool.name), ['preview_svg', 'write_outline_svg', 'read_svg', 'view_bitmap', 'update_group_note']);
  const report = JSON.parse(await readFile(join(f.directory, 'step09_outline/face/review.json'), 'utf8'));
  assert.deepEqual(report.reviews.map((review: { verdict: string }) => review.verdict), ['revise', 'pass']);
  assert.notEqual(report.reviews[0].candidateHash, report.reviews[1].candidateHash);
  assert.equal(runtime(mock.calls[1].task).round, '第 1 轮 review');
  assert.equal(runtime(mock.calls[3].task).round, '第 2 轮 review');
  const state = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(state.groups[0].steps.review.output!.path, state.groups[0].steps.outline.output!.path);
  assert.equal(await readFile(state.groups[0].steps.review.output!.path, 'utf8'), svg('face', 11));
  assert.deepEqual((await readdir(join(f.directory, 'step09_outline/face'))).filter(name => name.endsWith('.svg')), ['outline.svg']);
});

test('第二轮缺少提交时拒绝旧报告，续跑只复核返修后的候选', async t => {
  const f = await fixture(t), first = agents(['revise']);
  let reviews = 0;
  const intercept = (run: (task: AgentTask) => Promise<AgentResult>) => async (task: AgentTask) => {
    if (task.name.startsWith('组轮廓review') && (++reviews === 2 || reviews === 3 || reviews === 4)) {
      return { text: 'review.json 已提交第一轮 revise，只做收尾。', images: [] }; // the second review and both repairs never submit
    }
    return run(task);
  };
  const interrupted = { ...first, run: intercept(task => first.run(task)), createSession: (id?: string) => {
    const session = (first.createSession as (id?: string) => AgentSession)(id);
    return { ...session, run: intercept(task => session.run(task)) };
  } };
  await assert.rejects(runLayering({ ...f, groups: null, steps: createLayeringSteps(interrupted) }), /未通过 submit_review/);
  const path = join(f.directory, 'step09_outline/face/review.json');
  const before = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(before.reviews.length, 1);
  assert.notEqual(before.reviews[0].candidateHash, before.reviews[0].repairedCandidateHash);
  const resumed = agents(['pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(resumed) });
  assert.deepEqual(resumed.calls.map(call => call.task.name), ['组轮廓review-face']);
  assert.equal(runtime(resumed.calls[0].task).round, '第 2 轮 review');
  const after = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(after.reviews.map((review: { verdict: string }) => review.verdict), ['revise', 'pass']);
  assert.equal(after.reviews[1].candidateHash, before.reviews[0].repairedCandidateHash);
  assert.equal((await GroupStore.open(f.directory)).snapshot().groups[0].steps.review.status, 'completed');
});

test('并发组各自保留绘制会话和独立审查记录，返修不会串到另一组', async t => {
  const f = await fixture(t);
  await seedInitialGroups(f.directory, [{ id: 'face' }, { id: 'hair' }]);
  const mock = agents(['revise', 'revise', 'pass']);
  await runLayering({ ...f, groups: null, steps: { ...createLayeringSteps(mock),
    async reduceOutlines() { return { status: 'completed', output: { changed: [] } }; },
  } });
  const drawingIds: number[] = [];
  for (const id of ['face', 'hair']) {
    const calls = mock.calls.filter(call => runtime(call.task).group.id === id);
    const draws = calls.filter(call => !call.task.name.startsWith('组轮廓review'));
    assert.equal(draws.length, 2);
    assert.equal(draws[0].session, draws[1].session);
    assert.equal(await readFile(join(f.directory, `step09_outline/${id}/outline.repairs/1/prompt.txt`), 'utf8'), draws[1].task.prompt);
    drawingIds.push(draws[0].session);
    assert.equal(mock.closed.filter(session => session === draws[0].session).length, 1);
    const report = JSON.parse(await readFile(join(f.directory, `step09_outline/${id}/review.json`), 'utf8'));
    assert.equal(report.groupId, id);
    assert.deepEqual(report.reviews.map((review: { verdict: string }) => review.verdict), ['revise', 'pass']);
  }
  assert.notEqual(drawingIds[0], drawingIds[1]);
  const reviews = mock.calls.filter(call => call.task.name.startsWith('组轮廓review'));
  assert.equal(new Set(reviews.map(call => call.session)).size, reviews.length);
});

test('两次 review 都 revise 时落实两次返修并进入下一步，不做第三次 review', async t => {
  const f = await fixture(t);
  const first = agents(['revise']);
  let completionCalls = 0;
  await runLayering({ ...f, groups: null, steps: { ...createLayeringSteps(first),
    async completeOcclusion(context) {
      completionCalls++;
      assert.equal(await readFile(context.reviewed.path, 'utf8'), svg('face', 12));
      return { status: 'pending', message: '直接遮挡补形：待接入' };
    },
  } });
  assert.equal(completionCalls, 1);
  assert.deepEqual(first.calls.map(call => call.task.name.split('-')[0]),
    ['组轮廓绘制', '组轮廓review', '组轮廓返修', '组轮廓review', '组轮廓返修']);
  const repairs = first.calls.filter(call => call.task.name.startsWith('组轮廓返修'));
  assert.equal(repairs.length, 2);
  const reviews = first.calls.filter(call => call.task.name.startsWith('组轮廓review'));
  assert.equal(reviews.length, 2);
  assert.ok(repairs.every(call => call.session === first.calls[0].session));
  assert.equal(new Set(reviews.map(call => call.session)).size, reviews.length);
  const repairDirectory = join(f.directory, 'step09_outline/face/outline.repairs');
  assert.deepEqual((await readdir(repairDirectory)).sort(), ['1', '2']);
  for (const [index, repair] of repairs.entries()) {
    const directory = join(repairDirectory, String(index + 1));
    const round = await readFile(join(directory, 'round.txt'), 'utf8');
    const prompt = await readFile(join(directory, 'prompt.txt'), 'utf8');
    assert.equal(round, `${index + 1}\n`);
    assert.equal(prompt, repair.task.prompt);
    assert.ok(prompt.includes(`第 ${index + 1} 轮 review`));
  }
  const state = (await GroupStore.open(f.directory)).snapshot();
  assert.equal(state.groups[0].steps.outline.status, 'completed');
  assert.equal(state.groups[0].steps.review.status, 'completed');
  assert.equal(state.groups[0].steps.review.output!.reviewOutcome, 'repaired');
  assert.match(state.groups[0].steps.review.output!.note!, /第 2 轮意见返修并自检，不再复审/);
  const report = JSON.parse(await readFile(join(f.directory, 'step09_outline/face/review.json'), 'utf8'));
  assert.deepEqual(report.reviews.map((review: { verdict: string }) => review.verdict),
    ['revise', 'revise']);
  assert.ok(report.reviews.every((review: { repairedCandidateHash?: string }) => review.repairedCandidateHash));
  assert.deepEqual((await readdir(join(f.directory, 'step09_outline/face'))).filter(name => name.endsWith('.svg')), ['outline.svg']);
  const resumed = agents(['pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(resumed) });
  assert.equal(resumed.calls.length, 0);
  assert.deepEqual((await readdir(repairDirectory)).sort(), ['1', '2']);
  assert.equal((await GroupStore.open(f.directory)).snapshot().groups[0].steps.review.status, 'completed');
});

test('第二轮返修失败后续跑只完成返修，不增加 review；进度丢失也复用已完成返修', async t => {
  const f = await fixture(t);
  const failed = agents(['revise'], { failDrawingTurn: 3 });
  await assert.rejects(runLayering({ ...f, groups: null, steps: createLayeringSteps(failed) }), /返修执行失败/);
  assert.equal(await readFile(join(f.directory, 'step09_outline/face/outline.svg'), 'utf8'), svg('face', 11));
  const resumed = agents(['pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(resumed) });
  assert.deepEqual(resumed.calls.map(call => call.task.name), ['组轮廓返修-face']);
  assert.match(resumed.calls[0].task.prompt, /第 2 轮 review/);
  const report = JSON.parse(await readFile(join(f.directory, 'step09_outline/face/review.json'), 'utf8'));
  assert.equal(report.reviews.length, 2);
  const store = await GroupStore.open(f.directory);
  assert.equal(store.snapshot().groups[0].steps.review.output!.reviewOutcome, 'repaired');
  await store.update(document => { document.groups[0].steps.review = { status: 'running' }; });
  const afterInterruption = agents(['pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(afterInterruption) });
  assert.equal(afterInterruption.calls.length, 0);
  assert.equal((await GroupStore.open(f.directory)).snapshot().groups[0].steps.review.status, 'completed');
});

test('pass 已落盘后中断，续跑复用同一候选的通过结论', async t => {
  const f = await fixture(t);
  const failed = agents(['pass'], { failAfterSubmission: true });
  await assert.rejects(runLayering({ ...f, groups: null, steps: createLayeringSteps(failed) }), /审查提交后中断/);
  const resumed = agents(['pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(resumed) });
  assert.equal(resumed.calls.length, 0);
  assert.equal((await GroupStore.open(f.directory)).snapshot().groups[0].steps.review.output!.reviewOutcome, 'pass');
});

test('blocked 不返修也不放行；只有最终回复没有提交工具时不能记为通过', async t => {
  for (const missingSubmission of [false, true]) {
    const f = await fixture(t);
    const mock = agents(['blocked'], { missingSubmission });
    const run = runLayering({ ...f, groups: null, steps: createLayeringSteps(mock) });
    if (missingSubmission) await assert.rejects(run, /submit_review/);
    else await run;
    assert.equal(mock.calls.length, missingSubmission ? 4 : 2); // a missing submission gets two repairs
    const state = (await GroupStore.open(f.directory)).snapshot();
    assert.equal(state.groups[0].steps.review.status, 'pending');
    assert.equal(state.groups[0].steps.completion.status, 'pending');
  }
});

test('缺少自检不能提交轮廓；返修回合失败保留此前已登记 SVG 并关闭会话', async t => {
  const f = await fixture(t);
  const failed = agents(['revise'], { failRepair: true });
  await assert.rejects(runLayering({ ...f, groups: null, steps: createLayeringSteps(failed) }), /返修执行失败/);
  assert.equal(await readFile(join(f.directory, 'step09_outline/face/outline.svg'), 'utf8'), svg('face', 10));
  assert.equal(failed.closed.length, 2); // review session and the failed repair session
  const repairDirectory = join(f.directory, 'step09_outline/face/outline.repairs');
  const failedPrompt = await readFile(join(repairDirectory, '1/prompt.txt'), 'utf8');
  assert.equal(failedPrompt, failed.calls[2].task.prompt);
  const resumed = agents(['pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(resumed) });
  assert.deepEqual((await readdir(repairDirectory)).sort(), ['1', '2']);
  assert.equal(await readFile(join(repairDirectory, '1/prompt.txt'), 'utf8'), failedPrompt);
  assert.equal(await readFile(join(repairDirectory, '2/prompt.txt'), 'utf8'), resumed.calls[0].task.prompt);
});

test('子组绘制收到父组完成 SVG；越界由写入工具当回合退回，不能进入 review，父组文件保持原样', async t => {
  const f = await fixture(t);
  const parent = join(f.directory, 'parts/face.svg');
  const before = svg('face', 20, 80);
  await mkdir(dirname(parent), { recursive: true });
  await writeFile(parent, before);
  const group = normalizeGroups([{ id: 'face/eye' }])[0];
  await publishGroups(f.directory, [{ id: 'face', groups: [{ id: 'face/eye' }] }]);
  const parentGroup = normalizeGroups([{ id: 'face', steps: { completion: { status: 'completed', output: { path: parent } } } }])[0];
  const calls: AgentTask[] = [];
  await assert.rejects(drawGroupOutline({ ...f, group, parent: parentGroup, outputPath: artifactPath(f.directory, 'face/eye', 'outline') }, { async run(task) {
    calls.push(task);
    if (calls.length > 1) return { text: '仍未修正', images: [] }; // a repair turn carries no inputs
    assert.equal(runtime(task).parentGroup, 'face');
    assert.ok(task.prompt.includes(`parentSvg：${join(f.directory, 'parts')}/<parentGroup>.svg`));
    await assert.rejects(task.tools!.find(tool => tool.name === 'write_outline_svg')!.execute({ svg: svg('face/eye', 10) }, signal), /超出父轮廓/);
    return { text: '完成', images: [], threadId: 'out-of-bounds' };
  } }));
  assert.equal(calls.length, 3); // the draft plus two repairs
  assert.equal(await readFile(parent, 'utf8'), before);
});

test('终端不可用时可读取父 SVG 复用共享曲线，', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parts/face.svg');
  const before = svg('face', 20.125, 80.375);
  await mkdir(dirname(parent), { recursive: true });
  await writeFile(parent, before);
  const group = normalizeGroups([{ id: 'face/eye' }])[0];
  await publishGroups(f.directory, [{ id: 'face', groups: [{ id: 'face/eye' }] }]);
  const parentGroup = normalizeGroups([{ id: 'face', steps: { completion: { status: 'completed', output: { path: parent } } } }])[0];
  let preview = false;
  const mock = { async run(task: AgentTask) {
    const input = runtime(task);
    const result = await task.tools!.find(tool => tool.name === 'read_svg')!.execute({ path: join(f.directory, 'parts', `${input.parentGroup}.svg`) }, signal);
    const item = result.contentItems[0]; assert.equal(item.type, 'inputText');
    const source = JSON.parse(item.text).svg as string;
    assert.equal(source, before);
    await task.tools!.find(tool => tool.name === 'write_outline_svg')!.execute({ svg: source.replace('data-group-path="face"', 'data-group-path="face/eye"') }, signal);
    if (preview) await task.tools!.find(tool => tool.name === 'preview_svg')!.execute({ path: input.outputSvg, mode: 'blend' }, signal);
    return { text: '完成', images: [], threadId: 'bound-source-reader' };
  } };
  const context = { ...f, group, parent: parentGroup, outputPath: artifactPath(f.directory, 'face/eye', 'outline') };
  preview = true;
  await drawGroupOutline(context, mock);
  assert.equal(await readFile(parent, 'utf8'), before);
});


test('连续 blocked 保留记录但不消耗正式审核轮次，恢复仍需两轮返修', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 2; i++) {
    await runLayering({ ...f, groups: null, steps: createLayeringSteps(agents(['blocked'])) });
  }
  const resumed = agents(['revise', 'revise']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(resumed) });
  assert.equal(resumed.calls.filter(call => call.task.name.startsWith('组轮廓review')).length, 2);
  assert.equal(resumed.calls.filter(call => call.task.name.startsWith('组轮廓返修')).length, 2);
  const report = JSON.parse(await readFile(join(f.directory, 'step09_outline/face/review.json'), 'utf8'));
  assert.deepEqual(report.reviews.map((entry: { verdict: string }) => entry.verdict), ['blocked', 'blocked', 'revise', 'revise']);
  const final = agents(['pass']);
  await runLayering({ ...f, groups: null, steps: createLayeringSteps(final) });
  assert.equal(final.calls.length, 0);
  const state = (await GroupStore.open(f.directory)).snapshot().groups[0];
  assert.equal(state.steps.review.output!.reviewOutcome, 'repaired');
  assert.match(state.steps.review.output!.note!, /第 2 轮/);
});

test('续跑轮廓沿用中断前的草稿，提示词只给固定的先读草稿规则；非续跑从空草稿开始', async t => {
  const f = await fixture(t), outputPath = join(f.directory, 'face.draft.svg');
  const group = normalizeGroups([{ id: 'face' }])[0];
  for (const resumeDraft of [true, false]) {
    await writeFile(outputPath, svg('face', 30, 70));
    await drawGroupOutline({ ...f, group, outputPath, resumeDraft }, { async run(task) {
      assert.equal('resumedDraft' in runtime(task), false);
      if (resumeDraft) {
        assert.equal(await readFile(outputPath, 'utf8'), svg('face', 30, 70));
      } else {
        await assert.rejects(readFile(outputPath), { code: 'ENOENT' });
        await task.tools!.find(tool => tool.name === 'write_outline_svg')!.execute({ svg: svg('face') }, signal);
      }
      await task.tools!.find(tool => tool.name === 'preview_svg')!.execute({ path: outputPath, mode: 'blend' }, signal);
      return { text: 'done', images: [] };
    } });
  }
});
