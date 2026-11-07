import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { agentOutcomeError, formatAgentError } from '../shared/codex/diagnostics.ts';
import { acquireTaskLock } from '../workflow/state.ts';
import { taskDirectory, resolveInput, resolveRunsDirectory } from '../shared/paths.ts';
import { selectKnowledge, stepKnowledge, type KnowledgeRole } from '../shared/knowledge.ts';
import { runSection, stepName } from '../shared/step-section.ts';
import { loadWorkflowEnvironment, type VideoApi, type WorkflowEnvironment } from '../shared/codex/environment.ts';
import { CodexAgents } from '../shared/codex/agents.ts';
import { preflightAgentSteps } from '../shared/agents/preflight.ts';
import { prepareWorkspace, workspacePrompt } from '../shared/agents/workspace.ts';
import { checkKrita } from '../shared/raster/krita.ts';
import { SectionKrita, kritaRecordFile } from '../shared/krita/section-krita.ts';
import { createKritaTool } from '../shared/krita/tool.ts';
import { createBitmapTool } from '../shared/part/bitmap-tool.ts';
import { createSvgPreviewTool } from '../shared/part/svg-tools.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { ffmpegPath, generateVideo, produceLeftVideo, producePitchVideos, produceCornerVideos, resolveTurnInput, viewsY, type ViewY, type Box, type GenerateVideo, type TurnInput, type VideoPrompts } from './turn.ts';
import { buildHead, finishHead, resolveHeadInput, type Built, type HeadInput } from './head.ts';
import { buildAngleY, finishAngleY } from './angle-y.ts';
import { buildAngleXY, checkCornerReferences, cornerAngleValues, finishAngleXY, writeLinearCorners } from './angle-xy.ts';
import { buildJawLine, finishJawLine } from './jaw-line.ts';
import { createNineAxisViewTool } from './view-tool.ts';
import { createHeadEditTool } from './edit-tool.ts';
import { createNineAxisFitTool } from './fit-tool.ts';
import { createContinuationEditTool } from './continuation-edit-tool.ts';
import type { PitchStage } from './continuation.ts';
import { angleScale, angleValues } from './angles.ts';
import { beginStep, completeStep, readStep } from '../shared/step-chain.ts';
import { writeBuilt } from './head.ts';
import { prepareNeutral } from './neutral.ts';
import { mergeAxes } from './axis-merge.ts';
import { axisGroups, checkAxisSource, runAxisGroups, seedAxis, type AxisGroup } from './axis-groups.ts';
import { readStepSession, writeStepSession } from '../shared/agents/step-session.ts';
import type { AgentStep, Harness } from '../shared/agents/models.ts';
import { runOutline } from './outline.ts';
import { applyStepAction, applyTaskAction } from '../workflow/step-actions.ts';

export const help = `nine-axis — 头部九轴
pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <可执行文件> [--dir <绝对运行根目录>] [--step step02_angles[/left|up|down]] [--dry-run]
step01_video：同一步生成 left/up/down 视频并取参考帧，正面裁框只确定一次。
step02_angles：原 KRA 只导出一次，共享 neutral，left/up/down 三个独立 agent 并行描边、补全、自动拟合 Warp、调整五官与检查实际覆盖；完成后组合单轴工程。
step03_angle-xy：依赖三个单轴，以 up/down 原帧生成斜向视频，由 agent 自选 left-up/left-down 帧并分别制作，镜像右侧。
step04_jaw-line：照五个视频做九个角度的下颌线、固定脖子顶部与随头移动的脖子阴影。
三个单轴共用一份 agent.json，prompts/groups/<方向>/<同名文件> 优先替换，其余提示词和工具共用。会话、workspace、作者文件与完成标记分别保存。
Warp 分组与父子关系由 agent 自定，部件保留局部编辑。脖子保持固定，不随头倾斜或拉长。
视频可见区域是拟合目标，教程和分类脸型图片只补隐藏结构。用户确认视觉效果后才算通过。
取帧角度配置：knowledge/nine-axis/step01_video/references/angles.json，参数以度数表示。
`;

// The turns use the step file; up and down replace it through their groups.
export const videoPrompt = (view?: ViewY) => stepKnowledge('nine-axis', 'step01_video').render('main', {}, view ? { group: view } : {}).trim();
export const videoPrompts = (): VideoPrompts => ({ turn: videoPrompt(), ...Object.fromEntries(viewsY.map(view => [view, videoPrompt(view)])) as Record<ViewY, string> });
// Checked before any step starts, so a run without the video service fails at once.
export function requireVideoApi(environment: Pick<WorkflowEnvironment, 'videoApi'>): VideoApi {
  if (!environment.videoApi) throw new Error('头部九轴转头视频需要生视频接口：请在 live2d-maker/.env 填写 video_base_url 与 video_api_key（不使用生图接口）。未配置时 step01_video 无法运行。');
  return environment.videoApi;
}

const outputSchema = { type: 'object', properties: { error: { type: ['string', 'null'] } }, required: ['error'], additionalProperties: false };

// The visible outline is drawn by its own agent; only left has it so far.
export const outlineGroups: readonly AxisGroup[] = ['left'];
function axisValues(input: HeadInput, taskRoot: string, group: AxisGroup) {
  const nine = join(taskRoot, 'nine-axis'), output = join(nine, 'step02_angles', group), scale = angleScale();
  return {
    ...angleValues(), group, document: input.document, color: input.color, output, neutral: join(nine, 'step02_angles/neutral'),
    reference_frame: join(nine, 'step01_video', `${group}.png`), source_frame: join(nine, 'step01_video/upper-body.png'),
    target_x: String(group === 'left' ? scale.x[0] : 0), target_y: String(group === 'up' ? scale.y[1] : group === 'down' ? scale.y[0] : 0),
    reference_video: join(nine, 'step01_video', `${group}.mp4`), reference_frames: '', continuity_reference: '',
    author_file: join(output, `face-${group}.json`), outline: join(output, 'outline'),
  };
}
export function axisPrompt(input: HeadInput, taskRoot: string, group: AxisGroup): string {
  return stepKnowledge('nine-axis', 'step02_angles').render('main', axisValues(input, taskRoot, group), { taskRoot, group }).trim();
}
export const outlinePrompt = (input: HeadInput, taskRoot: string, group: AxisGroup) =>
  stepKnowledge('nine-axis', 'step02_outline').render('main', axisValues(input, taskRoot, group), { taskRoot, group }).trim();
export const headPrompt = (input: HeadInput, taskRoot: string) => axisPrompt(input, taskRoot, 'left');
export const angleYPrompt = (taskRoot: string, stage: PitchStage) => axisPrompt({ document: '', color: '' } as HeadInput, taskRoot, stage);
export const angleXYPrompt = (taskRoot: string) => stepKnowledge('nine-axis', 'step03_angle-xy').render('main', { ...angleValues(), ...cornerAngleValues() }, { taskRoot }).trim();
export const jawLinePrompt = (input: HeadInput, taskRoot: string) => stepKnowledge('nine-axis', 'step04_jaw-line')
  .render('main', { document: input.document, color: input.color, ...angleValues(), ...cornerAngleValues() }, { taskRoot }).trim();

type Agents = Pick<CodexAgents, 'run'> & Partial<Pick<CodexAgents, 'createSession'>>;
// One agent turn. With `session` the turn continues that step's saved thread;
// without it the turn is a fresh session that is never saved (a reviewer).
// `recoveryPrompt` replaces the prompt when the saved thread is gone.
type AgentTurn = { step: AgentStep; knowledge: string; role: KnowledgeRole; session?: string; name: string;
  tools: FunctionTool[]; prompt: string; recoveryPrompt?: string };
async function runAgentTurn(agents: Agents, nine: string, directory: string, turn: AgentTurn, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const paths = await prepareWorkspace({ cwd: nine, outputDirectory: directory }, nine);
  let saved = turn.session ? await readStepSession(nine, turn.session) ?? {} : {};
  const persist = async (threadId: string | null, harness?: Harness) => {
    if (!turn.session) return;
    const next = { threadId: threadId || undefined, harness: harness ?? saved.harness };
    if (next.threadId !== saved.threadId || next.harness !== saved.harness) await writeStepSession(nine, turn.session, next);
    saved = next;
  };
  const session = turn.session ? agents.createSession?.(saved.threadId, { resumeHarness: saved.harness, onSessionStarted: persist, onThreadReplacement: async () => persist(null) }) : undefined;
  const prompt = turn.recoveryPrompt && !saved.threadId ? turn.recoveryPrompt : turn.prompt;
  let result;
  try {
    result = await (session ?? agents).run({ step: turn.step, name: turn.name, cwd: nine, outputDirectory: directory, outputSchema,
      tools: stepKnowledge('nine-axis', turn.knowledge).tools(turn.role, turn.tools), prompt: workspacePrompt(prompt, paths),
      ...(turn.recoveryPrompt ? { recoveryPrompt: workspacePrompt(turn.recoveryPrompt, paths) } : {}) }, signal);
    if (result.threadId) await persist(result.threadId, result.harness);
  } catch (error) {
    if (error && typeof error === 'object' && 'threadId' in error && typeof error.threadId === 'string') await persist(error.threadId);
    throw error;
  } finally { await session?.close(); }
  let error: unknown;
  try { error = (JSON.parse(result.text) as { error?: unknown }).error; } catch { throw agentOutcomeError(`${turn.name}没有返回结果`, result); }
  if (typeof error === 'string' && error) throw agentOutcomeError(`${turn.name}：${error}`, result);
}

export type FitHead = (directory: string, prompt: string) => Promise<void>;
export function createFitHead(agents: Agents, tools: (step: string) => Promise<FunctionTool[]>, step: string, name: string, signal?: AbortSignal, sectionDirectory?: string): FitHead {
  return async (directory, prompt) => {
    const group = step.split('/')[1];
    const agentStep = group || step === 'step02_angles' ? 'nine_axis_head' : step === 'step03_angle-xy' ? 'nine_axis_head_xy' : 'nine_axis_head_jaw';
    await runAgentTurn(agents, sectionDirectory ?? join(directory, '..'), directory, { step: agentStep, knowledge: group ? 'step02_angles' : step,
      role: 'main', session: step, name, tools: await tools(step), prompt }, signal);
  };
}

// The outline has its own thread (agents/steps/<child>/outline, so a retry of the child drops it).
export type OutlineHead = (directory: string, prompt: string) => Promise<void>;
export function createOutlineHead(agents: Agents, tools: (directory: string) => Promise<FunctionTool[]>, step: string, signal?: AbortSignal, sectionDirectory?: string): OutlineHead {
  return async (directory, prompt) => runOutline(directory, async () => { await runAgentTurn(agents, sectionDirectory ?? join(directory, '../..'), directory, {
    step: 'nine_axis_outline', knowledge: 'step02_outline', role: 'main', session: `${step}/outline`,
    name: `描边 ${step.split('/')[1]}`, prompt, tools: await tools(directory) }, signal); });
}

export type NineAxisOptions = { name: string; dir?: string; krita?: string; step?: string; dryRun?: boolean; signal?: AbortSignal; progress?: (message: string) => void };
export type NineAxisDependencies = { environment?: WorkflowEnvironment; generate?: GenerateVideo; ffmpeg?: string; fitHead?: FitHead; outlineHead?: OutlineHead; fitUp?: FitHead; fitDown?: FitHead; fitAngleXY?: FitHead; fitJawLine?: FitHead;
  prepareNeutral?: (directory: string, input: HeadInput, box: Box, taskRoot: string) => Promise<void>;
  resolveInput?: (name: string, root: string) => Promise<TurnInput> };
export async function runWorkflow(options: NineAxisOptions, dependencies: NineAxisDependencies = {}): Promise<string> {
  const allSteps = [{ number: 1, note: 'video' }, { number: 2, note: 'angles' }, { number: 3, note: 'angle-xy' }, { number: 4, note: 'jaw-line' }];
  const [requested, requestedGroup] = options.step?.split('/') ?? [];
  if (requestedGroup && (requested !== 'step02_angles' || !axisGroups.includes(requestedGroup as AxisGroup))) throw Error('--step 子组只支持 step02_angles/left、up 或 down');
  const steps = requested ? allSteps.filter(step => stepName(step.number, step.note) === requested) : allSteps;
  if (!steps.length) throw new Error('--step 须为已定义的九轴步骤，例如 step02_angles 或 step02_angles/left。');
  const root = resolveRunsDirectory(options.dir), progress = options.progress ?? (() => {});
  const task = taskDirectory(options.name, root), directory = join(task, 'nine-axis'), videos = join(directory, 'step01_video'), axes = join(directory, 'step02_angles'), neutral = join(axes, 'neutral');
  const environment = dependencies.environment ?? loadWorkflowEnvironment(), scale = angleScale();
  const input = await (dependencies.resolveInput ?? resolveTurnInput)(options.name, root);
  const head = await resolveHeadInput(input);
  let summary = 'nine-axis 已完成（沿用已有结果）', sectionKrita: SectionKrita | undefined, agentPool: CodexAgents | undefined;
  const agents = () => agentPool ??= new CodexAgents({ environment, cwd: directory, logDirectory: join(directory, 'agents'), progress, agentConcurrency: 3 });
  let preflightPromise: Promise<unknown> | undefined;
  const preflight = () => preflightPromise ??= preflightAgentSteps(environment, ['nine_axis_outline', 'nine_axis_head', 'nine_axis_head_xy', 'nine_axis_head_jaw'], { runsRoot: root, progress, env: environment.codex.env });
  const video = () => {
    const api = dependencies.generate ? undefined : requireVideoApi(environment);
    return { model: api?.model ?? 'injected', generate: dependencies.generate ?? ((prompt, image, o) => generateVideo(api!, prompt, image, o)) as GenerateVideo };
  };
  const ffmpeg = async () => dependencies.ffmpeg ?? await ffmpegPath(environment.codex.env);
  const crop = async () => JSON.parse(await readFile(join(videos, 'crop.json'), 'utf8')).box as Box;
  const krita = async () => {
    if (!sectionKrita) {
      if (!options.krita?.trim()) throw Error('从原 KRA 导出需要 --krita <Krita 可执行文件路径>');
      const checked = await checkKrita(resolveInput(options.name, options.krita, root), environment.codex.env);
      sectionKrita = new SectionKrita({ section: directory, krita: checked.executable, env: environment.codex.env, record: join(directory, kritaRecordFile) });
    }
    await sectionKrita.reserve(options.signal, progress); return sectionKrita;
  };
  const builds: Record<string, () => Promise<Built>> = {};
  const faceTools = async (stepId: string): Promise<FunctionTool[]> => {
    const output = join(directory, stepId), observations = join(output, 'observations'), box = await crop();
    const bitmap = createBitmapTool(directory, observations), view = createNineAxisViewTool(directory, observations, () => builds[stepId]());
    const group = stepId.split('/')[1] as AxisGroup | undefined;
    const stage = group === 'up' || group === 'down' ? group : undefined;
    const upstream = group ? neutral : stepId === 'step03_angle-xy' ? axes : join(directory, 'step03_angle-xy');
    if (stepId === 'step04_jaw-line') return [createKritaTool(await krita(), task), bitmap, view, createContinuationEditTool(output, upstream, 'jaw', scale, task)];
    const continuation = stage ? { stage, upstreamDirectory: neutral } : group ? undefined : { stage: 'xy' as const, upstreamDirectory: upstream };
    const edit = group === 'left' ? createHeadEditTool(output, head, box, scale, task, neutral) : createContinuationEditTool(output, upstream, stage ?? 'xy', scale, task);
    const svg = createSvgPreviewTool({ directory: output, reference: group ? join(videos, `${group}.png`) : join(output, 'left-up.png'), canvas: { width: box.size, height: box.size }, observationDirectory: observations, referenceAlignment: 'canvas' });
    return [bitmap, view, edit, createNineAxisFitTool(output, head, box, scale, continuation, { taskRoot: task, referenceDirectory: videos }), group ? svg : { ...svg, async execute(value, signal, context) {
      const args = value as { mode?: string; reference?: string };
      if ((args?.mode === 'blend' || args?.mode === 'edge') && !args.reference) throw Error('斜向 blend/edge 必须指定所选 corner 参考帧');
      return svg.execute(value, signal, context);
    } }];
  };
  const outlineTools = async (output: string): Promise<FunctionTool[]> => {
    const observations = join(output, 'observations', 'outline'), box = await crop(), group = output.split('/').at(-2) as AxisGroup;
    return [createBitmapTool(directory, observations), createSvgPreviewTool({ directory: output, reference: join(videos, `${group}.png`),
      canvas: { width: box.size, height: box.size }, observationDirectory: observations, referenceAlignment: 'canvas' })];
  };
  const preview = (text: string) => { progress(`预览：${text}`); summary = '预览完成，未调用模型'; };
  try { await runSection({ directory, steps, dryRun: options.dryRun, signal: options.signal, progress,
    async finished(step) { return step.id !== 'step02_angles' || (await Promise.all(axisGroups.map(async group => (await readStep(join(axes, group))).status === 'completed'))).every(Boolean); },
    async step(step, status) {
      if (status === 'completed') return undefined;
      if (step.id === 'step01_video') return async () => {
        const prompts = videoPrompts();
        if (options.dryRun) return preview(`在同一步生成 left/up/down 视频并取参考帧。\n${prompts.turn}\n${prompts.up}\n${prompts.down}`);
        const { model, generate } = video(), executable = await ffmpeg();
        await produceLeftVideo(step.directory, input, generate, prompts.turn, { signal: options.signal, progress, ffmpeg: executable, model, angle: scale.x[1] });
        await producePitchVideos(step.directory, step.directory, generate, prompts, { signal: options.signal, progress, ffmpeg: executable, model, angles: { up: scale.y[1], down: -scale.y[0] } });
        summary = 'nine-axis/step01_video 已完成：left/up/down 原片与参考帧';
      };
      if (step.id === 'step02_angles') return async () => {
        if (options.dryRun) return preview((requestedGroup ? [requestedGroup as AxisGroup] : axisGroups).flatMap(group => [
          ...outlineGroups.includes(group) ? [outlinePrompt(head, task, group)] : [], axisPrompt(head, task, group)]).join('\n\n'));
        const box = await crop();
        const finished = await runAxisGroups(step.directory, {
          async prepare() {
            const current = await readStep(neutral);
            if (current.status === 'completed') return;
            await beginStep(neutral, current.status);
            if (dependencies.prepareNeutral) await dependencies.prepareNeutral(neutral, head, box, task);
            else {
              const instance = await krita();
              await prepareNeutral(neutral, head, instance, box, scale, options.signal, task);
              await instance.release(); sectionKrita = undefined;
            }
            options.signal?.throwIfAborted(); await completeStep(neutral);
          },
          seed: (group, output) => seedAxis(output, neutral, group, scale),
          async run(group, output) {
            const id = `step02_angles/${group}`;
            builds[id] = () => group === 'left' ? buildHead(output, head, box, scale, task) : buildAngleY(output, neutral, group, scale);
            const injected = group === 'left' ? dependencies.fitHead : group === 'up' ? dependencies.fitUp : dependencies.fitDown;
            // An injected fit stands for the whole child, outline included, unless an outline is injected too.
            const outline = !outlineGroups.includes(group) ? undefined : dependencies.outlineHead
              ?? (injected ? undefined : (await preflight(), createOutlineHead(agents(), outlineTools, id, options.signal, directory)));
            if (outline) {
              const outlineDirectory = join(output, 'outline');
              await mkdir(outlineDirectory, { recursive: true });
              await outline(outlineDirectory, outlinePrompt(head, task, group));
            }
            const fit = injected ?? (await preflight(), createFitHead(agents(), faceTools, id, `单轴 ${group}`, options.signal, directory));
            await fit(output, axisPrompt(head, task, group));
            const built = await builds[id]();
            await checkAxisSource(neutral, built);
            if (group === 'left') await finishHead(output, head, box, scale, task); else await finishAngleY(output, neutral, group, scale);
            progress(`${id} 已完成，其他单轴独立继续`);
          },
        }, { group: requestedGroup as AxisGroup | undefined, signal: options.signal });
        if (finished) {
          const mergedDirectory = join(step.directory, 'merged');
          await rm(mergedDirectory, { recursive: true, force: true });
          const merged = await mergeAxes(mergedDirectory, neutral, Object.fromEntries(axisGroups.map(group => [group, join(step.directory, group)])) as Record<AxisGroup, string>, scale, task);
          await writeBuilt(step.directory, merged);
          await copyFile(join(mergedDirectory, 'axis-sources.json'), join(step.directory, 'axis-sources.json'));
          await copyFile(join(neutral, 'source.json'), join(step.directory, 'source.json'));
          summary = 'nine-axis/step02_angles 已完成：三路独立单轴与联合工程';
        } else summary = `nine-axis/step02_angles/${requestedGroup} 已完成，联合工程等待其余单轴`;
      };
      if (step.id === 'step03_angle-xy') return async () => {
        if (options.dryRun) return preview(angleXYPrompt(task));
        // The parent marker is only complete after all three axes and merge.
        if ((await readStep(axes)).status !== 'completed') throw Error('斜角需要 left/up/down 全部完成后的联合工程');
        const { model, generate } = video();
        await produceCornerVideos(step.directory, videos, generate, videoPrompt(), { signal: options.signal, progress, model });
        await writeLinearCorners(step.directory, axes, scale);
        builds[step.id] = () => buildAngleXY(step.directory, axes, scale);
        const fit = dependencies.fitAngleXY ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '脸部与双耳斜向', options.signal, directory));
        await fit(step.directory, angleXYPrompt(task));
        const box = await crop();
        await checkCornerReferences(step.directory, box.size);
        summary = `nine-axis/step03_angle-xy 已完成：${await finishAngleXY(step.directory, axes, scale)} 个原图层的斜向四角`;
      };
      return async () => {
        if (options.dryRun) return preview(jawLinePrompt(head, task));
        builds[step.id] = () => buildJawLine(step.directory, join(directory, 'step03_angle-xy'), scale);
        const fit = dependencies.fitJawLine ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '下颌线与脖子', options.signal, directory));
        await fit(step.directory, jawLinePrompt(head, task));
        summary = `nine-axis/step04_jaw-line 已完成：${await finishJawLine(step.directory, join(directory, 'step03_angle-xy'), scale)} 个部件的下颌线与脖子`;
      };
    },
  }); } finally { await sectionKrita?.release(); }
  return summary;
}

export function parseRunArguments(args: string[]) {
  const { values } = parseArgs({ args, options: { name: { type: 'string' }, dir: { type: 'string' }, knowledge: { type: 'string' },
    krita: { type: 'string' }, step: { type: 'string' }, 'dry-run': { type: 'boolean' },
    continue: { type: 'boolean' }, resume: { type: 'boolean' }, retry: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }, allowPositionals: false });
  if (!values.help && !values.name?.trim()) throw new Error('必须提供 --name <任务名>。');
  if (!values.help && !values.knowledge?.trim()) throw new Error('必须提供 --knowledge <先验知识目录>；独立 section 不保存配置，每次启动（含续跑）都须指定。');
  if (values.dir !== undefined) resolveRunsDirectory(values.dir);
  const actions = ['continue', 'resume', 'retry'].filter(action => values[action as 'continue' | 'resume' | 'retry']);
  if (actions.length > 1) throw Error('--continue、--resume、--retry 只能选一个');
  if (actions.length && values['dry-run']) throw Error('恢复操作不能与 --dry-run 一起使用');
  return values;
}
if (import.meta.main) {
  (async () => {
    const args = parseRunArguments(process.argv.slice(2));
    if (args.help) { console.log(help); return; }
    selectKnowledge(resolveInput(args.name!, args.knowledge!, args.dir));
    const action = args.retry ? 'retry' : args.resume ? 'resume' : args.continue ? 'continue' : undefined;
    if (action) {
      if (args.krita) await checkKrita(resolveInput(args.name!, args.krita, args.dir), loadWorkflowEnvironment().codex.env);
      console.log(await (args.step ? applyStepAction({ name: args.name!, dir: args.dir, section: 'nine-axis', step: args.step, action })
        : applyTaskAction({ name: args.name!, dir: args.dir, section: 'nine-axis', action })));
    }
    const controller = new AbortController(), stop = () => controller.abort(new Error('头部九轴已中断；续跑会重新生成未完成的步骤。'));
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    const release = args['dry-run'] ? undefined : await acquireTaskLock(taskDirectory(args.name!, args.dir));
    try { console.log(await runWorkflow({ name: args.name!, dir: args.dir, krita: args.krita, step: args.step, dryRun: args['dry-run'], signal: controller.signal, progress: console.log })); }
    finally { await release?.(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
  })().catch(error => { console.error(formatAgentError(error)); process.exitCode = 1; });
}
