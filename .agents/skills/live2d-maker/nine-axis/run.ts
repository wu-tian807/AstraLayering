import { join } from 'node:path';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { agentOutcomeError } from '../shared/codex/diagnostics.ts';
import { taskDirectory, resolveInput, resolveRunsDirectory } from '../shared/paths.ts';
import { stepKnowledge, type KnowledgeRole } from '../shared/knowledge.ts';
import { rangeSummary, runSection, stepName } from '../shared/step-section.ts';
import { includesStep, resolveStepRange, type StepSelection } from '../shared/step-range.ts';
import { agentWorkflowStep } from '../shared/agent-knowledge.ts';
import { runContinuation } from '../shared/step-continuation.ts';
import { loadWorkflowEnvironment, type WorkflowEnvironment } from '../shared/codex/environment.ts';
import { AgentDispatcher, type AgentResult, type AgentTask } from '../shared/agents/dispatcher.ts';
import { CheckFailure, asCheck, checkedTurn } from '../shared/codex/checked-turn.ts';
import { preflightAgentSteps } from '../shared/agents/preflight.ts';
import { prepareWorkspace, workspacePrompt } from '../shared/agents/workspace.ts';
import { checkKrita } from '../shared/raster/krita.ts';
import { SectionKrita, kritaRecordFile } from '../shared/krita/section-krita.ts';
import { createKritaTool } from '../shared/krita/tool.ts';
import { createBitmapTool } from '../shared/part/bitmap-tool.ts';
import { createSvgPreviewTool } from '../shared/part/svg-tools.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { finishViews, generateVideo, produceLeftVideo, producePitchVideos, produceCornerVideos, resolveTurnInput, runFrameSelection, checkSelectedFrames, turnViews, viewsY, type ViewY, type Box, type GenerateVideo, type TurnInput, type VideoPrompts } from './turn.ts';
import { buildHead, finishHead, stepDocument, type Built, type HeadInput } from './head.ts';
import { buildAngleY, finishAngleY } from './angle-y.ts';
import { buildAngleXY, checkCornerReferences, corners, finishAngleXY, writeLinearCorners, type Corner } from './angle-xy.ts';
import { buildJawLine, finishJawLine } from './jaw-line.ts';
import { prepareHair, buildHair, finishHair, hairPreviewScope, hairRoundLabel, readHairProgress, completeHairRound, upgradeHairProgress, checkHairRound, type HairRound } from './hair.ts';
import { hairRounds, isHairPromptPlan, readHairState, saveHairPlan, type HairPromptRound } from './hair-progress.ts';
import { prepareAccessories, buildAccessories, finishAccessories, checkAccessories, checkAccessoryShadows, accessoryPreviewScope } from './accessories.ts';
import { headPitchDirections, headPitchStage, headPitchScope, headPitchPreviewScope, seedHeadPitch, buildHeadPitch, mergeHeadPitch, checkHeadPitchDelivery, type HeadPitchDirection } from './head-pitch.ts';
import { finishHeadRoll } from './head-roll.ts';
import { HEAD_ROLL_LIMIT } from '../shared/nine-axis-model.js';
import { headCornerScope, seedHeadCorners, buildHeadCorners, finishHeadCorners } from './head-corners.ts';
import { createNineAxisViewTool } from './view-tool.ts';
import { createHeadEditTool } from './edit-tool.ts';
import { createNineAxisFitTool } from './fit-tool.ts';
import { createContinuationEditTool } from './continuation-edit-tool.ts';
import { readUpstream } from './continuation.ts';
import { angleScale } from './angles.ts';
import { beginStep, completeStep, readStep } from '../shared/step-chain.ts';
import { writeBuilt } from './head.ts';
import { prepareNeutral } from './neutral.ts';
import { kraContents } from '../shadow/delivery.ts';
import { KraMaterials, nativeMaterialExport, type MaterialLoader } from './kra-materials.ts';
import { modelDocument } from './source.ts';
import { fromTaskPath } from '../shared/task-paths.ts';
import { mergeAxes } from './axis-merge.ts';
import { axisGroups, checkAxisSource, runAxisGroups, seedAxis, type AxisGroup } from './axis-groups.ts';
import { readStepSession, writeStepSession } from '../shared/agents/step-session.ts';
import type { AgentStep, Harness } from '../shared/agents/models.ts';
import { checkOutlineFiles, runOutline } from './outline.ts';
import sharp from 'sharp';
import { createStepDispatcher, runStepBatch } from '../shared/step-dispatch.ts';
import { headRollStep, nineAxisSteps, nineAxisBranches } from '../shared/nine-axis.ts';
import { upperBodyBox } from './turn.ts';
import { ffmpegEnvironment, type FFmpegCheck } from '../shared/ffmpeg.ts';
import { requireFFmpeg } from '../workflow/ffmpeg.ts';
import { createFrameTool } from './frame-tool.ts';
import { missingDeliveries } from '../shared/step-deliveries.ts';
import { requireVideoApi } from '../shared/video.ts';
export { requireVideoApi } from '../shared/video.ts';

export const help = `nine-axis — 头部九轴
pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <可执行文件> --ffmpeg <可执行文件> [--dir <绝对运行根目录>] [--dry-run]
用 --from-step 选择单步，用 --step step04_angles/model/up 等路径选择步内分支或恢复目标。
独立 section 启动无状态；每次启动及续跑显式传入软件路径与先验知识目录，不从步骤产物恢复配置。
step01_preparation：从上游工程一次整理完整头部素材与独立投影，保留头发和头饰供后续制作。
step02_video：生成 left/up/down 视频。
step03_frames：从视频提取并选择单轴参考帧。
step04_angles：并发制作独立单轴模型和斜角视频；单轴的描边、补全、拟合与五官指引沿用。
step05_frames：从 step04 的视频提取并选择斜角参考帧。
step06_angle-xy：基于 step04 单轴模型与 step05 参考帧制作斜角。
step07_jaw-line：完成下颌与固定脖子连接，交付脸部＋五官九轴的中间成果。
step08_hair：left/right，Y=0；同一 KRA、同一会话，每次操作派发一轮：前发、侧发、后发、其余头发与整体协调。
step09_head-accessories：基于已完成脸发制作 head_accessories 的 left/right，Y=0，连同关联投影检查最终遮挡。
step10_head-pitch：从完整左右结果并发制作整个头部的 up/down；两个独立上下文，完成后由程序合并。可用 --step step10_head-pitch/up 或 down 选择分支。
step11_head-angle-xy：在已有完整左右、上下的基础上，一个持续会话统一调整整个头部四角。
step12_head-roll：从完整头部四角生成 ±${HEAD_ROLL_LIMIT}° 的 Z 轴倾斜。
部件与 Warp 组织方式由实际工程决定，角度配置见 knowledge/head-nine-axis/step02_video/references/angles.json。
`;

// The turns use the step file; up and down replace it through their groups.
export const videoPrompt = (view?: ViewY) => stepKnowledge('nine-axis', 'step02_video').render('main', {}, view ? { group: view } : {}).trim();
export const videoPrompts = (): VideoPrompts => ({ turn: videoPrompt(), ...Object.fromEntries(viewsY.map(view => [view, videoPrompt(view)])) as Record<ViewY, string> });
const outputSchema = { type: 'object', properties: { error: { type: ['string', 'null'] } }, required: ['error'], additionalProperties: false };

const stepPrompt = (step: string, taskRoot: string, group?: string) =>
  stepKnowledge('nine-axis', step).render('main', group === undefined ? {} : { group_id: group }, { taskRoot, group }).trim();

export const axisPrompt = (taskRoot: string, group: AxisGroup) => stepPrompt('step04_angles', taskRoot, group);
export const outlinePrompt = (taskRoot: string, group: AxisGroup | Corner) => stepPrompt('step04_outline', taskRoot, group);
export const viewFramesPrompt = (taskRoot: string) => stepPrompt('step03_frames', taskRoot);
export const cornerFramesPrompt = (taskRoot: string) => stepPrompt('step05_frames', taskRoot);
export const angleXYPrompt = (taskRoot: string) => stepPrompt('step06_angle-xy', taskRoot);
export const jawLinePrompt = (taskRoot: string) => stepPrompt('step07_jaw-line', taskRoot);
export const accessoriesPrompt = (taskRoot: string) => stepPrompt('step09_head-accessories', taskRoot);
export const headPitchPrompt = (taskRoot: string, group: HeadPitchDirection) => stepPrompt('step10_head-pitch', taskRoot, group);
export const headCornersPrompt = (taskRoot: string) => stepPrompt('step11_head-angle-xy', taskRoot);

function hairPromptPlan(legacy = false): HairPromptRound[] {
  const [initial, ...then] = stepKnowledge('nine-axis', 'step08_hair').rounds('main');
  const remaining = legacy ? hairRounds.slice(1).map(id => ({ id, prompts: [`prompts/${hairRoundLabel(id)}制作.md`] })) : then;
  const plan = [{ ...initial, id: 'front' }, ...remaining];
  if (!isHairPromptPlan(plan)) throw Error('头发轮次必须使用已有的制作和检查规则');
  return plan;
}

export const hairPrompt = (taskRoot: string, round: HairRound = 'front', plan: readonly HairPromptRound[] = hairPromptPlan()) => {
  const prompt = plan.find(item => item.id === round);
  if (!prompt) throw Error(`头发接续中没有轮次：${round}`);
  const knowledge = stepKnowledge('nine-axis', 'step08_hair');
  return knowledge.render('main', {}, { taskRoot, round: prompt }).trim();
};

type Agents = Pick<AgentDispatcher, 'run'> & Partial<Pick<AgentDispatcher, 'createSession'>>;
// One agent turn. With `session` the turn continues that step's saved thread;
// without it the turn is a fresh session that is never saved (a reviewer).
// `recoveryPrompt` replaces the prompt when the saved thread is gone.
type AgentTurn = { step: AgentStep; knowledge: string; role: KnowledgeRole; session?: string; name: string;
  tools: FunctionTool[]; prompt: string; recoveryPrompt?: string;
  // Program check of the delivered files; a failure goes back to the same thread as a repair turn.
  verify?: () => Promise<unknown> };
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
  const task = { step: turn.step, name: turn.name, cwd: nine, outputDirectory: directory, outputSchema,
    tools: stepKnowledge('nine-axis', turn.knowledge).tools(turn.role, turn.tools), prompt: workspacePrompt(prompt, paths),
    ...(turn.recoveryPrompt ? { recoveryPrompt: workspacePrompt(turn.recoveryPrompt, paths) } : {}) };
  const checkResult = (result: AgentResult) => {
    let value: unknown;
    try { value = JSON.parse(result.text); } catch { throw new CheckFailure('bad-result', `${turn.name}没有返回结果`, { detail: '没有返回结果' }); }
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !('error' in value)
      || (value.error !== null && typeof value.error !== 'string'))
      throw new CheckFailure('bad-result', `${turn.name}结果须为 {"error":null} 或 {"error":"原因"}`, { detail: '结果须为 {"error":null} 或 {"error":"原因"}' });
    if (typeof value.error === 'string') throw agentOutcomeError(`${turn.name}：${value.error || '返回了空错误原因'}`, result);
  };
  const check = async (result: AgentResult) => { checkResult(result); if (turn.verify) await asCheck('invalid-output', turn.verify); };
  try {
    await checkedTurn({ agents: session ? { async run(next: AgentTask, abort?: AbortSignal) {
      const result = await session.run(next, abort);
      if (result.threadId) await persist(result.threadId, result.harness);
      return result;
    } } : agents, task, check, records: join(directory, 'checks'), signal });
  } catch (error) {
    if (error && typeof error === 'object' && 'threadId' in error && typeof error.threadId === 'string') await persist(error.threadId);
    throw error;
  } finally { await session?.close(); }
}

export type FitHead = (directory: string, prompt: string, verify?: () => Promise<unknown>) => Promise<void>;
export function createFitHead(agents: Agents, tools: (step: string) => Promise<FunctionTool[]>, step: string, name: string, signal?: AbortSignal, sectionDirectory?: string): FitHead {
  return async (directory, prompt, verify) => {
    const group = step.split('/').length > 2 ? step.split('/').at(-1) : undefined;
    const pitch=step.startsWith('step10_head-pitch/');
    const agentStep = pitch?'nine_axis_head_pitch':step==='step11_head-angle-xy'?'nine_axis_head_corners':group || step === 'step04_angles' ? 'nine_axis_head' : step === 'step06_angle-xy' ? 'nine_axis_head_xy' : step==='step09_head-accessories'?'nine_axis_head_accessories':'nine_axis_head_jaw';
    await runAgentTurn(agents, sectionDirectory ?? join(directory, '..'), directory, { step: agentStep, knowledge: pitch?'step10_head-pitch':group ? 'step04_angles' : step,
      role: 'main', session: step, name, tools: await tools(step), prompt, verify }, signal);
  };
}

// One dispatch is one hair round. All later prompts resume the same step key;
// the scheduler, not a single overall prompt, advances the production order.
export function createHairHead(agents: Agents, tools: (step: string) => Promise<FunctionTool[]>, signal?: AbortSignal, sectionDirectory?: string): FitHead {
  return async (directory,prompt,verify) => {
    const {next}=await readHairProgress(directory);
    if(next==='done')throw Error('头发轮次已全部完成');
    return runAgentTurn(agents,sectionDirectory ?? join(directory,'..'),directory,{
      step:'nine_axis_head_hair',knowledge:'step08_hair',role:'main',session:'step08_hair',name:`${hairRoundLabel(next)}左右制作`,tools:await tools('step08_hair'),prompt,verify,
    },signal);
  };
}

// The outline has its own thread under the step it feeds (agents/steps/<step>/outline[/<corner>]), so a retry of that step drops it.
export type OutlineHead = (directory: string, prompt: string) => Promise<void>;
export function createOutlineHead(agents: Agents, tools: (directory: string) => Promise<FunctionTool[]>, session: string, name: string, signal?: AbortSignal, sectionDirectory?: string): OutlineHead {
  return async (directory, prompt) => runOutline(directory, async () => { await runAgentTurn(agents, sectionDirectory ?? join(directory, '../..'), directory, {
    step: 'nine_axis_outline', knowledge: 'step04_outline', role: 'main', session, name, prompt, tools: await tools(directory),
    verify: () => checkOutlineFiles(directory) }, signal); });
}
// Reference frames are chosen from the videos by their own agent, so the outline and fit start from them.
export type FramesHead = (directory: string, prompt: string) => Promise<void>;
const frameAgents = { step03_frames: { agent: 'nine_axis_view_frames', knowledge: 'step03_frames', name: '单轴选帧', names: turnViews },
  'step05_frames': { agent: 'nine_axis_frames', knowledge: 'step05_frames', name: '斜向选帧', names: corners } } as const;
export function createFramesHead(agents: Agents, tools: (directory: string) => Promise<FunctionTool[]>, step: keyof typeof frameAgents, signal?: AbortSignal, sectionDirectory?: string): FramesHead {
  const { agent, knowledge, name, names } = frameAgents[step];
  const videoDirectory = (directory: string) => join(sectionDirectory ?? join(directory, '..'), step === 'step03_frames' ? 'step02_video' : 'step04_angles/video');
  return async (directory, prompt) => { const video = videoDirectory(directory); return runFrameSelection(directory, names, async () => { await runAgentTurn(agents, sectionDirectory ?? join(directory, '..'), directory, {
    step: agent, knowledge, role: 'main', session: step, name, prompt, tools: await tools(directory),
    verify: () => checkSelectedFrames(directory, names, undefined, video) }, signal); }, video); };
}

export type NineAxisOptions = { name: string; dir?: string; krita?: string; ffmpeg?: string; step?: string; selection?: StepSelection;
  dryRun?: boolean; signal?: AbortSignal; progress?: (message: string) => void };
export type NineAxisDependencies = { environment?: WorkflowEnvironment; ffmpegCheck?: FFmpegCheck; generate?: GenerateVideo; fitHead?: FitHead; outlineHead?: OutlineHead; viewFramesHead?: FramesHead; framesHead?: FramesHead; fitUp?: FitHead; fitDown?: FitHead; fitAngleXY?: FitHead; fitJawLine?: FitHead;
  materialize?: MaterialLoader;
  prepareNeutral?: (directory: string, input: HeadInput, box: Box, taskRoot: string) => Promise<void>;
  prepareHair?: typeof prepareHair; fitHair?: FitHead;
  prepareAccessories?:typeof prepareAccessories;fitAccessories?:FitHead;
  fitHeadPitch?:Partial<Record<HeadPitchDirection,FitHead>>;
  fitHeadCorners?: FitHead;
  resolveInput?: (name: string, root: string) => Promise<TurnInput> };
export const isArtworkOnly = (step?: string) => ['step08_hair', 'step09_head-accessories', 'step10_head-pitch', 'step11_head-angle-xy', headRollStep].includes(step ?? '');

export async function runWorkflow(options: NineAxisOptions, dependencies: NineAxisDependencies = {}): Promise<string> {
  if (options.step && options.step.split('/').length > 3) throw Error('--step 须为已定义的九轴步骤或分支');
  const [target, branch, part] = options.step?.split('/') ?? [];
  const group = part as AxisGroup | undefined;
  const range = resolveStepRange(nineAxisSteps, options.selection);
  const selectedIds = nineAxisSteps.filter(id => target ? id === target : includesStep(range, id));
  const requested = selectedIds.length === 1 ? selectedIds[0] : undefined;
  if (branch && !(requested==='step10_head-pitch'&&!group&&(headPitchDirections as readonly string[]).includes(branch))
    && (requested !== 'step04_angles' || !nineAxisBranches.includes(branch as 'model' | 'video') || group && (branch !== 'model' || !axisGroups.includes(group))))
    throw Error('--step 子项支持 step04_angles/model、video、model/left|up|down，或 step10_head-pitch/up|down');
  const steps = nineAxisSteps.map((id, i) => ({ number: i + 1, note: id.slice(7) })).filter(step => !target || stepName(step.number, step.note) === target);
  if (!steps.length) throw Error('--step 须为已定义的九轴步骤');
  const root = resolveRunsDirectory(options.dir), progress = options.progress ?? (() => {}), task = taskDirectory(options.name, root), directory = join(task, 'nine-axis');
  const preparation = join(directory, 'step01_preparation'), videos = join(directory, 'step02_video'), frames = join(directory, 'step03_frames');
  const angles = join(directory, 'step04_angles'), modelDirectory = join(angles, 'model'), cornerVideos = join(angles, 'video');
  const cornerFrames = join(directory, 'step05_frames'), xyDirectory = join(directory, 'step06_angle-xy');
  const baseEnvironment = dependencies.environment ?? loadWorkflowEnvironment(), scale = angleScale();
  const artworkOnly = selectedIds.every(isArtworkOnly);
  if (!options.dryRun && !dependencies.generate && !artworkOnly) requireVideoApi(baseEnvironment);
  const requestedFFmpeg = options.ffmpeg || baseEnvironment.codex.env?.ASTRA_STUDIO_FFMPEG;
  const ffmpeg = options.dryRun || artworkOnly ? undefined : await requireFFmpeg({ from: 'nine-axis', to: 'nine-axis',
    ffmpeg: requestedFFmpeg ? resolveInput(options.name, requestedFFmpeg, root) : undefined }, dependencies.ffmpegCheck);
  const environment = ffmpeg ? { ...baseEnvironment, codex: { ...baseEnvironment.codex,
    env: ffmpegEnvironment(ffmpeg.executable, baseEnvironment.codex.env) } } : baseEnvironment;
  let turnInput: Promise<{ input: TurnInput; head: HeadInput }> | undefined;
  const getTurnInput = () => turnInput ??= (async () => {
    const input = await (dependencies.resolveInput ?? resolveTurnInput)(options.name, root);
    const head: HeadInput = { ...input, document: input.document ?? input.color.replace(/\.png$/, '.kra') };
    // Resume the neutral's declared source, including legacy tasks that already
    // own a preparation copy. A retried child must keep its siblings' provenance.
    const neutralPath = join(preparation, 'deformers.json');
    if (await exists(neutralPath)) {
      const neutral = JSON.parse(await readFile(neutralPath, 'utf8'));
      if (neutral.source?.document) head.document = fromTaskPath(task, neutral.source.document);
    }
    if (input.document && await exists(join(preparation, 'source-composite.png'))) head.color = join(preparation, 'source-composite.png');
    return { input, head };
  })();
  if (requested !== headRollStep) await getTurnInput();
  let summary = 'nine-axis 已完成（沿用已有结果）', sectionKrita: SectionKrita | undefined, agentPool: AgentDispatcher | undefined;
  const agents = (): Agents => {
    const pool = agentPool ??= new AgentDispatcher({ environment, cwd: directory, logDirectory: join(directory, 'agents'), progress, agentConcurrency: 3 });
    return { run: pool.run.bind(pool), createSession: pool.createSession.bind(pool) };
  };
  let preflightPromise: Promise<unknown> | undefined;
  const modelSteps = ['nine_axis_view_frames', 'nine_axis_outline', 'nine_axis_head', 'nine_axis_frames', 'nine_axis_head_xy',
    'nine_axis_head_jaw', 'nine_axis_head_hair', 'nine_axis_head_accessories', 'nine_axis_head_pitch', 'nine_axis_head_corners'] as const;
  const preflight = () => preflightPromise ??= preflightAgentSteps(environment,
    modelSteps.filter(step => includesStep(range, agentWorkflowStep(step))), { runsRoot: root, progress, env: environment.codex.env });
  const video = () => {
    const api = dependencies.generate ? undefined : requireVideoApi(environment);
    return { model: api?.model ?? 'injected', generate: dependencies.generate ?? ((prompt, image, o) => generateVideo(api!, prompt, image, o)) as GenerateVideo };
  };
  const crop = async () => JSON.parse(await readFile(join(preparation, 'crop.json'), 'utf8')).box as Box;
  const krita = async () => {
    if (!sectionKrita) {
      if (!options.krita?.trim()) throw Error('从原 KRA 导出需要 --krita <Krita 可执行文件路径>');
      const checked = await checkKrita(resolveInput(options.name, options.krita, root), environment.codex.env);
      sectionKrita = new SectionKrita({ section: directory, krita: checked.executable, env: environment.codex.env, record: join(directory, kritaRecordFile) });
    }
    await sectionKrita.reserve(options.signal, progress); return sectionKrita;
  };
  const builds: Record<string, () => Promise<Built>> = {};
  const materials = new KraMaterials(nativeMaterialExport(krita));
  const materialize: MaterialLoader = dependencies.materialize ?? ((output, built, signal, context = true) => materials.resolve(task, output, built, signal ?? options.signal, context));
  const faceTools = async (stepId: string): Promise<FunctionTool[]> => {
    const output = join(directory, stepId), observations = join(output, 'observations');
    const hairRound=stepId==='step08_hair'?(await readHairProgress(output)).next:undefined;
    if(hairRound==='done')throw Error('头发轮次已全部完成');
    const pitch=stepId.startsWith('step10_head-pitch/')?stepId.split('/')[1] as HeadPitchDirection:undefined;
    const bitmap = createBitmapTool(directory, observations), view = createNineAxisViewTool(directory, observations,
      async () => materialize(output, await builds[stepId](), options.signal), undefined, stepId==='step11_head-angle-xy'?{includes:headCornerScope.includes!,label:headCornerScope.label}:pitch?headPitchPreviewScope(pitch):hairRound ? hairPreviewScope(hairRound) : stepId==='step09_head-accessories'?accessoryPreviewScope:undefined);
    if(pitch)return [bitmap,view,createContinuationEditTool(output,join(directory,'step09_head-accessories'),headPitchStage(pitch),scale,task,materialize,headPitchScope)];
    if (stepId === 'step11_head-angle-xy') {
      const box = await crop();
      const svg = createSvgPreviewTool({ directory: output, reference: join(cornerFrames, 'left-up.png'),
        canvas: { width: box.size, height: box.size }, observationDirectory: observations, referenceAlignment: 'canvas', comparisonModes: ['edge'] });
      return [bitmap, view, createContinuationEditTool(output, join(directory, 'step10_head-pitch'), 'head-xy', scale, task, materialize, headCornerScope),
        { ...svg, async execute(value, signal, context) {
          const args = value as { mode?: string; reference?: string };
          if (args?.mode === 'edge' && !args.reference) throw Error('斜角 edge 比较须指定实际参考帧');
          return svg.execute(value, signal, context);
        } }];
    }
    const axis = stepId.startsWith('step04_angles/model/') ? stepId.split('/').at(-1) as AxisGroup : undefined;
    const stage = axis === 'up' || axis === 'down' ? axis : undefined;
    const upstream = axis ? preparation : stepId === 'step06_angle-xy' ? modelDirectory : xyDirectory;
    if (stepId === 'step08_hair') return [createKritaTool(await krita(),task),bitmap,view,
      createContinuationEditTool(output,join(directory,'step07_jaw-line'),'hair',scale,task,materialize,hairPreviewScope(hairRound!))];
    if(stepId==='step09_head-accessories') {
      const upstream=join(directory,'step08_hair');
      return [createKritaTool(await krita(),task),bitmap,view,
        createContinuationEditTool(output,upstream,'accessories',scale,task,materialize,accessoryPreviewScope)];
    }
    if (stepId === 'step07_jaw-line') return [createKritaTool(await krita(), task), bitmap, view, createContinuationEditTool(output, upstream, 'jaw', scale, task, materialize)];
    const { head } = await getTurnInput();
    const box=await crop();
    const continuation = stage ? { stage, upstreamDirectory: preparation } : axis ? undefined : { stage: 'xy' as const, upstreamDirectory: upstream };
    const edit = axis === 'left' ? createHeadEditTool(output, head, box, scale, task, preparation) : createContinuationEditTool(output, upstream, stage ?? 'xy', scale, task, materialize);
    const referenceDirectory = axis ? frames : cornerFrames;
    const svg = createSvgPreviewTool({ directory: output, reference: join(referenceDirectory, axis ? `${axis}.png` : 'left-up.png'), canvas: { width: box.size, height: box.size }, observationDirectory: observations, referenceAlignment: 'canvas', comparisonModes: ['edge'] });
    return [bitmap, view, edit, createNineAxisFitTool(output, head, box, scale, continuation, { taskRoot: task, referenceDirectory }), axis ? svg : { ...svg, async execute(value, signal, context) {
      const args = value as { mode?: string; reference?: string };
      if (args?.mode === 'edge' && !args.reference) throw Error('斜向 edge 必须指定所选 corner 参考帧');
      return svg.execute(value, signal, context);
    } }];
  };
  const outlineTools = (reference: string) => async (output: string): Promise<FunctionTool[]> => {
    const observations = join(output, 'observations', 'outline'), box = await crop();
    const neutralView=createNineAxisViewTool(directory,observations,async()=>materialize(preparation,{doc:(await readUpstream(preparation)).doc,textures:new Map()}));
    return [createBitmapTool(directory, observations),neutralView, createSvgPreviewTool({ directory: output, reference, canvas: { width: box.size, height: box.size }, observationDirectory: observations, referenceAlignment: 'canvas', comparisonModes: ['edge'] })];
  };
  const framesTools = async (output: string): Promise<FunctionTool[]> => [
    createBitmapTool(directory, join(output, 'observations', 'frames')),
    createFrameTool({ ffmpeg: ffmpeg!.executable, taskRoot: task, directory: output,
      videos: output === frames ? videos : cornerVideos, names: output === frames ? turnViews : corners, size: (await crop()).size }),
  ];
  const preview = (text: string) => { progress(`预览：${text}`); summary = '预览完成，未调用模型'; };
  const checkDelivery = async (id: string) => {
    const missing = await missingDeliveries(directory, 'nine-axis', id);
    if (missing.length) throw new Error(`九轴步骤 ${id} 缺少非空交付文件：${missing.join('、')}。请恢复文件，或对该步骤重试。`);
  };
  const accessoriesUpstreamReady=async()=>{
    const hair=join(directory,'step08_hair');
    if((await readStep(hair)).status!=='completed'||(await readHairProgress(hair)).next!=='done')throw Error('请先完成头发全部轮次，再制作头部饰品');
    await checkDelivery('step08_hair');
  };
  const headPitchUpstreamReady=async()=>{
    await accessoriesUpstreamReady();
    if((await readStep(join(directory,'step09_head-accessories'))).status!=='completed')throw Error('请先完成头部饰品左右，再制作头部上下');
    await checkDelivery('step09_head-accessories');
  };
  const headCornersUpstreamReady = async () => {
    if ((await readStep(join(directory, 'step10_head-pitch'))).status !== 'completed') throw Error('请先完成完整头部上下，再制作斜角');
    await checkDelivery('step10_head-pitch');
  };
  const rollUpstream = 'step11_head-angle-xy';
  const headRollUpstreamReady = async () => {
    if ((await readStep(join(directory, rollUpstream))).status !== 'completed') throw Error('请先完成完整头部四角，再生成头部 Z 轴');
    await checkDelivery(rollUpstream);
  };
  try {
    const plan = await runSection({ directory, steps, range, dryRun: options.dryRun, signal: options.signal, progress,
      async check() {
        if (options.dryRun) return;
        if (requested === 'step09_head-accessories') await accessoriesUpstreamReady();
        if (requested === 'step10_head-pitch') await headPitchUpstreamReady();
        if (requested === 'step11_head-angle-xy') await headCornersUpstreamReady();
        if (requested === headRollStep) await headRollUpstreamReady();
      },
      async keep(step) {
        await checkDelivery(step.id);
        if(step.id==='step08_hair'&&(await readHairProgress(step.directory)).next!=='done')throw Error('头发轮次尚未全部完成，不能沿用整个步骤的完成标记');
      },
      async migrate(step) {
        if (step.id !== 'step08_hair') return;
        await upgradeHairProgress(step.directory);
        return true;
      },
      async finished(step) {
        if(step.id==='step08_hair'&&(await readHairProgress(step.directory)).next!=='done') return false;
        if (step.id === 'step04_angles' && !(await Promise.all(nineAxisBranches.map(async b => (await readStep(join(angles, b))).status === 'completed'))).every(Boolean)) return false;
        if(step.id==='step10_head-pitch'&&!(await Promise.all(headPitchDirections.map(async d=>(await readStep(join(step.directory,d))).status==='completed'))).every(Boolean))return false;
        await checkDelivery(step.id); return true;
      },
      async step(step, status) {
        if (status === 'completed') return;
        if (step.id === headRollStep) return async () => {
          if (options.dryRun) return preview(`从完整头部四角生成 ±${HEAD_ROLL_LIMIT}° 的 Z 轴倾斜`);
          await headRollUpstreamReady();
          await finishHeadRoll(step.directory, join(directory, rollUpstream), task);
          summary = `nine-axis/${headRollStep}：头部 Z 轴已完成（±${HEAD_ROLL_LIMIT}°）`;
        };
        if (step.id === 'step11_head-angle-xy') return async () => {
          const upstream = join(directory, 'step10_head-pitch');
          if (options.dryRun) return preview(headCornersPrompt(task));
          await headCornersUpstreamReady();
          await seedHeadCorners(step.directory, upstream, task, scale);
          builds[step.id] = () => buildHeadCorners(step.directory, upstream, scale, materialize);
          const fit = dependencies.fitHeadCorners ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '完整头部四角', options.signal, directory));
          const verify = async () => {
            await finishHeadCorners(step.directory, upstream, scale, materialize);
            await checkDelivery(step.id);
          };
          await fit(step.directory, headCornersPrompt(task), verify);
          await verify();
          summary = 'nine-axis/step11_head-angle-xy：完整头部四角已完成';
        };
        if(step.id==='step10_head-pitch')return async()=>{
          const upstream=join(directory,'step09_head-accessories');
          if(options.dryRun)return preview(headPitchDirections.filter(d=>!branch||d===branch).map(d=>headPitchPrompt(task, d)).join('\n\n'));
          await headPitchUpstreamReady();
          const { doc } = await readUpstream(upstream);
          if (!await modelDocument(task, upstream, doc)) throw Error('头部上下缺少最新 KRA 来源');
          const finished=await runAxisGroups(step.directory,{
            seed:(g,folder)=>seedHeadPitch(folder,upstream,task,g as HeadPitchDirection,scale),
            async keep(g,folder){
              await checkDelivery(`${step.id}/${g}`);
              checkHeadPitchDelivery((await buildHeadPitch(folder,upstream,g as HeadPitchDirection,scale)).doc,g as HeadPitchDirection,scale);
            },
            async run(g,folder){
              const direction=g as HeadPitchDirection,id=`${step.id}/${direction}`;
              builds[id]=()=>buildHeadPitch(folder,upstream,direction,scale,materialize);
              const fit=dependencies.fitHeadPitch?.[direction]??(await preflight(),createFitHead(agents(),faceTools,id,`完整头部${direction==='up'?'抬头':'低头'}`,options.signal,directory));
              let verified=false;
              const verify=async()=>{
                const built=await builds[id]();checkHeadPitchDelivery(built.doc,direction,scale);
                await writeBuilt(folder,built);await checkDelivery(id);verified=true;
              };
              await fit(folder,headPitchPrompt(task, direction),verify);
              if(!verified)await verify();
              progress(`${id} 已完成，另一方向独立继续`);
            },
            async merge() { await mergeHeadPitch(step.directory, upstream, scale); },
          },{groups:headPitchDirections,group:branch as HeadPitchDirection|undefined,signal:options.signal});
          summary=finished?'nine-axis/step10_head-pitch：完整头部上下已完成并合并':`nine-axis/step10_head-pitch/${branch} 已完成，等待另一方向`;
        };
        if (step.id === 'step01_preparation') return async () => {
          const { input, head } = await getTurnInput();
          if (options.dryRun) return preview('从上游原工程整理头部素材与投影关系，导出统一 neutral。');
          // Preparation only reads artwork. Keep the upstream KRA reference;
          // the saved projection is a derived snapshot, never a second master.
          if (input.document) {
            head.color = join(preparation, 'source-composite.png');
            await mkdir(preparation, { recursive: true });
            await writeFile(head.color, kraContents(await readFile(head.document)).merged);
          }
          const { width = 0, height = 0 } = await sharp(head.color).metadata(), box = await upperBodyBox(head, width, height);
          await writeFile(join(preparation, 'crop.json'), JSON.stringify({ canvas: [width, height], box }) + '\n');
          if (dependencies.prepareNeutral) await dependencies.prepareNeutral(preparation, head, box, task);
          else { const instance = await krita(); await prepareNeutral(preparation, head, instance, box, scale, options.signal, task); await instance.release(); sectionKrita = undefined; }
          summary = 'nine-axis/step01_preparation 已完成：完整头部共享素材';
        };
        if (step.id === 'step02_video') return async () => {
          const prompts = videoPrompts();
          if (options.dryRun) return preview([prompts.turn, prompts.up, prompts.down].join('\n\n'));
          const { input, head } = await getTurnInput();
          const { model, generate } = video();
          // Read the saved KRA composite even when resuming after preparation.
          if (input.document) {
            head.color = join(preparation, 'source-composite.png');
            await mkdir(preparation, { recursive: true });
            await writeFile(head.color, kraContents(await readFile(head.document)).merged);
          }
          await produceLeftVideo(videos, head, generate, prompts.turn, { signal: options.signal, progress, model });
          await producePitchVideos(videos, videos, generate, prompts, { signal: options.signal, progress, model });
          summary = 'nine-axis/step02_video 已完成：三向视频';
        };
        if (step.id === 'step03_frames') return async () => {
          if (options.dryRun) return preview(viewFramesPrompt(task));
          const select = dependencies.viewFramesHead ?? (await preflight(), createFramesHead(agents(), framesTools, 'step03_frames', options.signal, directory));
          await select(frames, viewFramesPrompt(task));
          await finishViews(frames, { left: scale.x[1], up: scale.y[1], down: -scale.y[0] }, videos);
          summary = 'nine-axis/step03_frames 已完成：单轴参考帧';
        };
        if (step.id === 'step04_angles') return async () => {
          const { head } = await getTurnInput();
          if (options.dryRun) return preview([...(group ? [group] : axisGroups).flatMap(g => [outlinePrompt(task, g), axisPrompt(task, g)]), videoPrompt()].join('\n\n'));
          const selected = branch ? [branch as 'model' | 'video'] : [...nineAxisBranches];
          async function runBranch(b: (typeof selected)[number]) {
            const output = join(angles, b), { status } = await readStep(output);
            await beginStep(output, status);
            if (b === 'video') {
              const { model, generate } = video();
              await produceCornerVideos(output, frames, generate, videoPrompt(), { signal: options.signal, progress, model });
            } else {
              const box = await crop();
              const finished = await runAxisGroups(output, {
                seed: (g, folder) => seedAxis(folder, preparation, g, scale),
                keep: (g) => checkDelivery(`step04_angles/model/${g}`),
                async run(g, folder) {
                  const id = `step04_angles/model/${g}`;
                  builds[id] = () => g === 'left' ? buildHead(folder, head, box, scale, task) : buildAngleY(folder, preparation, g, scale);
                  const injected = g === 'left' ? dependencies.fitHead : g === 'up' ? dependencies.fitUp : dependencies.fitDown;
                  const outline = dependencies.outlineHead ?? (injected ? undefined : (await preflight(), createOutlineHead(agents(), outlineTools(join(frames, `${g}.png`)), `${id}/outline`, `描边 ${g}`, options.signal, directory)));
                  if (outline) { const o = join(folder, 'outline'); await mkdir(o, { recursive: true }); await outline(o, outlinePrompt(task, g)); }
                  const fit = injected ?? (await preflight(), createFitHead(agents(), faceTools, id, `单轴 ${g}`, options.signal, directory));
                  await fit(folder, axisPrompt(task, g), async () => checkAxisSource(preparation, await builds[id]()));
                  if (g === 'left') await finishHead(folder, head, box, scale, task); else await finishAngleY(folder, preparation, g, scale);
                  await checkDelivery(id); progress(`${id} 已完成，其他分支独立继续`);
                },
                async merge() {
                  const mergedDirectory = join(output, 'merged');
                  await rm(mergedDirectory, { recursive: true, force: true });
                  const sources = Object.fromEntries(axisGroups.map(g => [g, join(output, g)])) as Record<AxisGroup, string>;
                  const merged = await mergeAxes(mergedDirectory, preparation, sources, scale, task);
                  await writeBuilt(output, merged);
                  await copyFile(join(mergedDirectory, 'axis-sources.json'), join(output, 'axis-sources.json'));
                  await copyFile(join(preparation, 'source.json'), join(output, 'source.json'));
                },
              }, { group, signal: options.signal });
              if (!finished) return;
            }
            options.signal?.throwIfAborted();
            await checkDelivery(`step04_angles/${b}`);
            await completeStep(output);
          }
          await createStepDispatcher().run(async () => {
            const ready = await Promise.all(selected.map(async b => {
              if ((await readStep(join(angles, b))).status === 'completed') {
                await checkDelivery(`step04_angles/${b}`);
                return;
              }
              return { id: b, run: () => runBranch(b) };
            }));
            return ready.filter((item): item is NonNullable<typeof item> => !!item);
          });
          summary = group ? `nine-axis/step04_angles/model/${group} 已完成` : 'nine-axis/step04_angles 已完成：单轴模型与斜角视频';
        };
        if (step.id === 'step05_frames') return async () => {
          if (options.dryRun) return preview(cornerFramesPrompt(task));
          const select = dependencies.framesHead ?? (await preflight(), createFramesHead(agents(), framesTools, 'step05_frames', options.signal, directory));
          await select(cornerFrames, cornerFramesPrompt(task));
          await checkSelectedFrames(cornerFrames, corners, (await crop()).size, cornerVideos);
          summary = 'nine-axis/step05_frames 已完成：斜角参考帧';
        };
        if (step.id === 'step06_angle-xy') return async () => {
          if (options.dryRun) return preview([...corners.map(c => outlinePrompt(task, c)), angleXYPrompt(task)].join('\n\n'));
          await writeLinearCorners(xyDirectory, modelDirectory, scale); builds[step.id] = () => buildAngleXY(xyDirectory, modelDirectory, scale);
          const injected = Boolean(dependencies.fitAngleXY);
          await runStepBatch(corners.map(c => {
            const id = `${step.id}/outline/${c}`;
            return {
              id,
              async run() {
                const outline = dependencies.outlineHead ?? (injected ? undefined : (await preflight(), createOutlineHead(agents(), outlineTools(join(cornerFrames, `${c}.png`)), id, `描边 ${c}`, options.signal, directory)));
                if (!outline) return;
                const output = join(xyDirectory, 'outline', c);
                await mkdir(output, { recursive: true });
                await outline(output, outlinePrompt(task, c));
              },
            };
          }));
          const fit = dependencies.fitAngleXY ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '脸部与双耳斜向', options.signal, directory));
          await fit(xyDirectory, angleXYPrompt(task), async () => { await checkCornerReferences(xyDirectory, (await crop()).size, cornerFrames, cornerVideos); await builds[step.id](); });
          summary = `nine-axis/step06_angle-xy 已完成：${await finishAngleXY(xyDirectory, modelDirectory, scale, cornerFrames, cornerVideos)} 个原图层的斜向四角`;
        };
        if (step.id === 'step08_hair') return async () => {
          const { input } = await getTurnInput();
          const hair=stepDocument(input,step.directory), upstream=join(directory,'step07_jaw-line');
          const saved = await readHairState(step.directory);
          const completed = saved?.progress.completed ?? [];
          const plan = saved?.plan ?? hairPromptPlan(!!saved);
          const round = plan.at(completed.length)?.id ?? 'done';
          if(round!=='front')await checkDelivery(step.id);
          if(round==='done') { summary='nine-axis/step08_hair：全部头发左右制作已完成'; return; }
          if(options.dryRun) return preview(hairPrompt(task, round, plan));
          if (!saved?.plan) await saveHairPlan(step.directory, plan, completed);
          await (dependencies.prepareHair ?? prepareHair)(step.directory,upstream,task,materialize,scale,options.signal);
          builds[step.id]=()=>buildHair(step.directory,upstream,scale,materialize);
          const before=await materialize(step.directory,await builds[step.id](),options.signal);
          const fit=dependencies.fitHair ?? (await preflight(),createHairHead(agents(),faceTools,options.signal,directory));
          let verified=false;
          const verify=async()=>{
            await checkHairRound(before,await materialize(step.directory,await builds[step.id](),options.signal),round);
            await writeFile(hair.color,kraContents(await readFile(hair.document)).merged);
            await finishHair(step.directory,upstream,scale,materialize);
            await checkDelivery(step.id);
            verified=true;
          };
          // Deliveries belong to the checked turn: a missing or empty product
          // gets the same two repair rounds before progress can advance.
          await runContinuation({
            rounds: plan, completed, oneRound: true,
            async run() {
              await fit(step.directory, hairPrompt(task, round, plan), verify);
              if (!verified) await verify();
            },
            commit: () => completeHairRound(step.directory, round),
          });
          const next=(await readHairProgress(step.directory)).next;
          summary=next==='done'?`nine-axis/step08_hair：${hairRoundLabel(round)}轮次已完成并保存，头发步骤完成`:`nine-axis/step08_hair：${hairRoundLabel(round)}轮次已完成并保存，等待同一会话的${hairRoundLabel(next)}提示词`;
        };
        if(step.id==='step09_head-accessories')return async()=>{
          const { input } = await getTurnInput();
          const accessories=stepDocument(input,step.directory),upstream=join(directory,'step08_hair');
          if(options.dryRun)return preview(accessoriesPrompt(task));
          await accessoriesUpstreamReady();
          await (dependencies.prepareAccessories??prepareAccessories)(step.directory,upstream,task,materialize,scale,options.signal);
          builds[step.id]=()=>buildAccessories(step.directory,upstream,scale,materialize);
          const before=await materialize(step.directory,await builds[step.id](),options.signal);
          const fit=dependencies.fitAccessories??(await preflight(),createFitHead(agents(),faceTools,step.id,'头部饰品左右制作',options.signal,directory));
          let verified=false;
          const verify=async()=>{
            const after=await materialize(step.directory,await builds[step.id](),options.signal);
            await checkAccessories(before,after);await checkAccessoryShadows(task,after.doc);
            await writeFile(accessories.color,kraContents(await readFile(accessories.document)).merged);
            await finishAccessories(step.directory,upstream,scale,materialize);await checkDelivery(step.id);verified=true;
          };
          await fit(step.directory,accessoriesPrompt(task),verify);if(!verified)await verify();
          summary='nine-axis/step09_head-accessories：头部饰品左右形变与组合检查已完成';
        };
        return async () => {
          const { input, head } = await getTurnInput();
          const jaw = stepDocument(input, step.directory);
          if (options.dryRun) return preview(jawLinePrompt(task));
          if (!await exists(jaw.document)) {
            const upstream = JSON.parse(await readFile(join(xyDirectory, 'deformers.json'), 'utf8'));
            const document = await modelDocument(task, xyDirectory, upstream) ?? head.document;
            await copyFile(document, jaw.document);
          }
          builds[step.id] = () => buildJawLine(step.directory, xyDirectory, scale, materialize);
          const fit = dependencies.fitJawLine ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '下颌线与脖子', options.signal, directory));
          await fit(step.directory, jawLinePrompt(task), async () => { await builds[step.id](); });
          await writeFile(jaw.color, kraContents(await readFile(jaw.document)).merged);
          summary = `nine-axis/step07_jaw-line 已完成：${await finishJawLine(step.directory, xyDirectory, scale, materialize)} 个部件的下颌线与脖子`;
        };
      },
    });
    return range && !options.dryRun ? `${summary}\n${rangeSummary(plan)}` : summary;
  } finally { await sectionKrita?.release(); }
}

const exists = (path: string) => access(path).then(() => true, () => false);

if (import.meta.main) void import('../workflow/section-cli.ts').then(cli => cli.launchSection('nine-axis'));
