import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { agentOutcomeError, formatAgentError } from '../shared/codex/diagnostics.ts';
import { acquireTaskLock } from '../workflow/state.ts';
import { taskDirectory, resolveInput, resolveRunsDirectory } from '../shared/paths.ts';
import { selectKnowledge, stepKnowledge } from '../shared/knowledge.ts';
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
import { buildAngleXY, cornerAngleValues, finishAngleXY, writeLinearCorners } from './angle-xy.ts';
import { buildJawLine, finishJawLine } from './jaw-line.ts';
import { createNineAxisViewTool } from './view-tool.ts';
import { createHeadEditTool } from './edit-tool.ts';
import { createNineAxisFitTool } from './fit-tool.ts';
import { createContinuationEditTool } from './continuation-edit-tool.ts';
import type { PitchStage } from './continuation.ts';
import { angleScale, angleValues } from './angles.ts';

export const help = `nine-axis — 头部九轴
pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <可执行文件> [--dir <绝对运行根目录>] [--step step02_angle-x] [--dry-run]
--step 只运行指定步骤，沿用已存在的上游输入。
step01_video：裁切正面头部，生成 5 秒 0→90° left 视频并取 left 参考帧。
step02_angle-x：agent 导出原 KRA 图层，复用 Part 的 preview_svg 描边，补全隐藏脸型，以 fit_nine_axis 自动求 Warp，再批量调整五官；镜像出 right。
step03_video-y：复用 step01 的正面与裁框，生成 5 秒 0→90° up/down 绕轴视频，并在本步取 up/down 参考帧。
step04_angle-up：独立描边、补全与拟合抬头，保护 X。
step05_angle-down：独立描边、补全与拟合低头，保护 X 与 up。
step06_angle-xy：以 up/down 参考帧生成 left-up/left-down 参考视频，再制作四角。
step07_jaw-line：下颌与颈部接触收尾。
视频接口使用 video_base_url / video_api_key、nine_axis_view_video_model 和 ffmpeg。
取帧角度只记在 knowledge/nine-axis/step01_video/references/angles.json（默认 left 30°，up/down 25°），ParamAngleX/Y 使用度数。
脸部制作共用 nine_axis_head 模型槽，各步骤独立 agent 会话。Warp 分组与父子关系由 agent 自定，部件保留局部编辑。
脖子从开始参加参考，所有关键形固定，不随头倾斜或拉长；不含头发。交付完整 version 2 作者源、原贴图与来源哈希。
视频可见区域是拟合目标，教程与分类脸型图片只补隐藏结构。用户确认视觉效果后才算通过。
总入口：pnpm start --name <任务名> --from nine-axis --to nine-axis。
`;

// The turns use the step file; up and down replace it through their groups.
export const videoPrompt = (view?: ViewY) => stepKnowledge('nine-axis', view ? 'step03_video-y' : 'step01_video').render('main', {}, view ? { group: view } : {}).trim();
export const videoPrompts = (): VideoPrompts => ({ turn: videoPrompt(), ...Object.fromEntries(viewsY.map(view => [view, videoPrompt(view)])) as Record<ViewY, string> });
// Checked before any step starts, so a run without the video service fails at once.
export function requireVideoApi(environment: Pick<WorkflowEnvironment, 'videoApi'>): VideoApi {
  if (!environment.videoApi) throw new Error('头部九轴转头视频需要生视频接口：请在 live2d-maker/.env 填写 video_base_url 与 video_api_key（不使用生图接口）。未配置时 step01_video 无法运行。');
  return environment.videoApi;
}

const outputSchema = { type: 'object', properties: { error: { type: ['string', 'null'] } }, required: ['error'], additionalProperties: false };

export function headPrompt(input: HeadInput, taskRoot: string): string {
  return stepKnowledge('nine-axis', 'step02_angle-x').render('main', { document: input.document, color: input.color, ...angleValues() }, { taskRoot }).trim();
}
export const angleYPrompt = (taskRoot: string, stage: PitchStage) => stepKnowledge('nine-axis', stage === 'up' ? 'step04_angle-up' : 'step05_angle-down').render('main', angleValues(), { taskRoot }).trim();
export const angleXYPrompt = (taskRoot: string) => stepKnowledge('nine-axis', 'step06_angle-xy').render('main', { ...angleValues(), ...cornerAngleValues() }, { taskRoot }).trim();
export const jawLinePrompt = (input: HeadInput, taskRoot: string) => stepKnowledge('nine-axis', 'step07_jaw-line')
  .render('main', { document: input.document, color: input.color, ...angleValues(), ...cornerAngleValues() }, { taskRoot }).trim();

// The face agents write their own fitting scripts in the section workspace,
// which the face steps share; the step's knowledge picks their tools (Krita
// to export the face layers, the bitmap viewer to look at them).
export type FitHead = (directory: string, prompt: string) => Promise<void>;
export function createFitHead(agents: Pick<CodexAgents, 'run'>, tools: (step: string) => Promise<FunctionTool[]>, step: string, name: string): FitHead {
  return async (directory, prompt) => {
    const nine = join(directory, '..'), paths = await prepareWorkspace({ cwd: nine, outputDirectory: directory }, nine);
    const identity = { 'step02_angle-x': 'nine_axis_head', 'step04_angle-up': 'nine_axis_head_y', 'step05_angle-down': 'nine_axis_head_down', 'step06_angle-xy': 'nine_axis_head_xy', 'step07_jaw-line': 'nine_axis_head_jaw' } as const;
    const agentStep = identity[step as keyof typeof identity];
    if (!agentStep) throw new Error(`未知头部九轴步骤：${step}`);
    const result = await agents.run({ step: agentStep, name, cwd: nine, outputDirectory: directory, outputSchema,
      tools: stepKnowledge('nine-axis', step).tools('main', await tools(step)), prompt: workspacePrompt(prompt, paths) });
    let error: unknown;
    try { error = (JSON.parse(result.text) as { error?: unknown }).error; } catch { throw agentOutcomeError(`${name}没有返回结果`, result); }
    if (typeof error === 'string' && error) throw agentOutcomeError(`${name}：${error}`, result);
  };
}

export type NineAxisOptions = { name: string; dir?: string; krita?: string; step?: string; dryRun?: boolean; signal?: AbortSignal; progress?: (message: string) => void };
export type NineAxisDependencies = { environment?: WorkflowEnvironment; generate?: GenerateVideo; ffmpeg?: string; fitHead?: FitHead; fitUp?: FitHead; fitDown?: FitHead; fitAngleXY?: FitHead; fitJawLine?: FitHead;
  resolveInput?: (name: string, root: string) => Promise<TurnInput> };
export async function runWorkflow(options: NineAxisOptions, dependencies: NineAxisDependencies = {}): Promise<string> {
  const allSteps = [{ number: 1, note: 'video' }, { number: 2, note: 'angle-x' }, { number: 3, note: 'video-y' }, { number: 4, note: 'angle-up' }, { number: 5, note: 'angle-down' }, { number: 6, note: 'angle-xy' }, { number: 7, note: 'jaw-line' }];
  const steps = options.step ? allSteps.filter(step => stepName(step.number, step.note) === options.step) : allSteps;
  if (!steps.length) throw new Error('--step 须为已定义的九轴步骤，例如 step02_angle-x。');
  const root = resolveRunsDirectory(options.dir), progress = options.progress ?? (() => {});
  const task = taskDirectory(options.name, root), directory = join(task, 'nine-axis');
  const environment = dependencies.environment ?? loadWorkflowEnvironment();
  const scale = angleScale();
  const input = await (dependencies.resolveInput ?? resolveTurnInput)(options.name, root);
  const headLabel = `${environment.stepModels.nine_axis_head.model}-${environment.stepModels.nine_axis_head.effort}`;
  let summary = 'nine-axis 已完成（沿用已有结果）', sectionKrita: SectionKrita | undefined;
  const video = () => {
    const api = dependencies.generate ? undefined : requireVideoApi(environment);
    return { model: api?.model ?? 'injected', generate: dependencies.generate ?? ((prompt, image, o) => generateVideo(api!, prompt, image, o)) as GenerateVideo };
  };
  const ffmpeg = async () => dependencies.ffmpeg ?? await ffmpegPath(environment.codex.env);
  const videos = join(directory, 'step01_video'), angleY = { up: scale.y[1], down: -scale.y[0] };
  // Each face step's agent views its delivery as the workbench draws it, built the way the step will build it.
  const builds: Record<string, () => Promise<Built>> = {};
  // Krita is only needed by the left and jaw agents, so only a run that reaches them asks for one.
  const faceTools = async (stepId: string): Promise<FunctionTool[]> => {
    const stepDirectory = join(directory, stepId), observations = join(stepDirectory, 'observations');
    const bitmap = createBitmapTool(directory, observations), view = createNineAxisViewTool(directory, observations, () => builds[stepId]());
    const pitch: PitchStage | undefined = stepId === 'step04_angle-up' ? 'up' : stepId === 'step05_angle-down' ? 'down' : undefined;
    const upstream = join(directory, pitch === 'up' ? 'step02_angle-x' : pitch === 'down' ? 'step04_angle-up' : stepId === 'step06_angle-xy' ? 'step05_angle-down' : 'step06_angle-xy');
    const continuation = createContinuationEditTool(stepDirectory, upstream, pitch ?? (stepId === 'step06_angle-xy' ? 'xy' : 'jaw'), scale);
    if (pitch) {
      const head = await resolveHeadInput(input), box = JSON.parse(await readFile(join(videos, 'crop.json'), 'utf8')).box as Box;
      return [bitmap, view, continuation, createNineAxisFitTool(stepDirectory, head, box, scale, { stage: pitch, upstreamDirectory: upstream }),
        createSvgPreviewTool({ directory: stepDirectory, reference: join(directory, `step03_video-y/${pitch}.png`), canvas: { width: box.size, height: box.size }, observationDirectory: observations, referenceAlignment: 'canvas' })];
    }
    if (stepId === 'step06_angle-xy') return [bitmap, view, continuation];
    if (!sectionKrita) {
      if (!options.krita?.trim()) throw new Error(`${stepId} 需要 --krita <已安装的 Krita 可执行文件路径>。`);
      const krita = await checkKrita(resolveInput(options.name, options.krita, root), environment.codex.env);
      sectionKrita = new SectionKrita({ section: directory, krita: krita.executable, env: environment.codex.env, record: join(directory, kritaRecordFile) });
    }
    await sectionKrita.reserve(options.signal, waiting => progress(`${stepId}：${waiting}`));
    if (stepId === 'step07_jaw-line') return [createKritaTool(sectionKrita, task), bitmap, view, continuation];
    const head = await resolveHeadInput(input), box = JSON.parse(await readFile(join(videos, 'crop.json'), 'utf8')).box as Box;
    return [createKritaTool(sectionKrita, task), bitmap, view, createHeadEditTool(stepDirectory, head, box, scale), createNineAxisFitTool(stepDirectory, head, box, scale),
      createSvgPreviewTool({ directory: stepDirectory, reference: join(directory, 'step01_video/left.png'), canvas: { width: box.size, height: box.size }, observationDirectory: observations, referenceAlignment: 'canvas' })];
  };
  const agents = () => new CodexAgents({ environment, cwd: directory, logDirectory: join(directory, 'agents'), progress });
  const preflight = () => preflightAgentSteps(environment, ['nine_axis_head', 'nine_axis_head_y', 'nine_axis_head_down', 'nine_axis_head_xy', 'nine_axis_head_jaw'], { runsRoot: root, progress, env: environment.codex.env });
  const preview = (text: string) => { progress(`预览：${text}`); summary = '预览完成，未调用模型'; };
  try { await runSection({ directory,
    steps,
    dryRun: options.dryRun, signal: options.signal, progress,
    async step(step, status) {
      if (status === 'completed') return undefined;
      if (step.id === 'step01_video') return async () => {
        const { model, generate } = video(), prompt = videoPrompt();
        if (options.dryRun) return preview(`从 ${input.color} 裁切头部，生成 left 视频并取 ${scale.x[1]}° 帧。\n提示词：\n${prompt}`);
        const box = await produceLeftVideo(step.directory, input, generate, prompt, { signal: options.signal, progress, ffmpeg: await ffmpeg(), model, angle: scale.x[1] });
        summary = `nine-axis/step01_video 已完成：${box.size}×${box.size} 左转视频与参考帧`;
      };
      if (step.id === 'step03_video-y') return async () => {
        const { model, generate } = video(), prompts = videoPrompts();
        if (options.dryRun) return preview(`沿用 step01_video 正面裁框，生成 up/down 视频并取 ${angleY.up}°/${angleY.down}° 帧。\n${viewsY.map(v => `${v} 提示词：\n${prompts[v]}`).join('\n\n')}`);
        await producePitchVideos(step.directory, videos, generate, prompts, { signal: options.signal, progress, ffmpeg: await ffmpeg(), model, angles: angleY });
        summary = 'nine-axis/step03_video-y 已完成：上下视频与参考帧';
      };
      if (step.id === 'step02_angle-x') return async () => {
        const head = await resolveHeadInput(input);
        if (options.dryRun) return preview(`用 ${headLabel} 摆出脸部向左转向，镜像出向右。\n提示词：\n${headPrompt(head, task)}`);
        const box = JSON.parse(await readFile(join(videos, 'crop.json'), 'utf8')).box as Box;
        builds[step.id] = () => buildHead(step.directory, head, box, scale);
        const fit = dependencies.fitHead ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '脸部与双耳转向'));
        await fit(step.directory, headPrompt(head, task));
        summary = `nine-axis/step02_angle-x 已完成：${await finishHead(step.directory, head, box, scale)} 个脸部图层的 ${scale.x[0]}° / +${scale.x[1]}° 转向`;
      };
      if (step.id === 'step04_angle-up' || step.id === 'step05_angle-down') return async () => {
        const stage: PitchStage = step.id === 'step04_angle-up' ? 'up' : 'down', label = stage === 'up' ? '抬头' : '低头';
        const upstream = join(directory, stage === 'up' ? 'step02_angle-x' : 'step04_angle-up');
        if (options.dryRun) return preview(`用 ${headLabel} 描边、补全并自动拟合脸部${label}。\n提示词：\n${angleYPrompt(task, stage)}`);
        builds[step.id] = () => buildAngleY(step.directory, upstream, stage, scale);
        const fit = (stage === 'up' ? dependencies.fitUp : dependencies.fitDown) ?? (await preflight(), createFitHead(agents(), faceTools, step.id, `脸部与双耳${label}`));
        await fit(step.directory, angleYPrompt(task, stage));
        summary = `nine-axis/${step.id} 已完成：${await finishAngleY(step.directory, upstream, stage, scale)} 个脸部图层的${label}`;
      };
      if (step.id === 'step06_angle-xy') return async () => {
        if (options.dryRun) return preview(`用 ${headLabel} 从线性叠加起手斜切脸部四角。\n提示词：\n${angleXYPrompt(task)}`);
        const { model, generate } = video();
        await produceCornerVideos(step.directory, join(directory, 'step03_video-y'), generate, videoPrompt(), { signal: options.signal, progress, model });
        const angleYDirectory = join(directory, 'step05_angle-down');
        await writeLinearCorners(step.directory, angleYDirectory, scale);
        builds[step.id] = () => buildAngleXY(step.directory, angleYDirectory, scale);
        const fit = dependencies.fitAngleXY ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '脸部与双耳斜向'));
        await fit(step.directory, angleXYPrompt(task));
        summary = `nine-axis/step06_angle-xy 已完成：${await finishAngleXY(step.directory, angleYDirectory, scale)} 个脸部图层的斜向四角`;
      };
      return async () => {
        const head = await resolveHeadInput(input);
        if (options.dryRun) return preview(`用 ${headLabel} 做下颌线、脸部蒙版与脖子。\n提示词：\n${jawLinePrompt(head, task)}`);
        builds[step.id] = () => buildJawLine(step.directory, join(directory, 'step06_angle-xy'), scale);
        const fit = dependencies.fitJawLine ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '下颌线与脖子'));
        await fit(step.directory, jawLinePrompt(head, task));
        summary = `nine-axis/step07_jaw-line 已完成：${await finishJawLine(step.directory, join(directory, 'step06_angle-xy'), scale)} 个部件的下颌线与脖子`;
      };
    } }); } finally { await sectionKrita?.release(); }
  return summary;
}

export function parseRunArguments(args: string[]) {
  const { values } = parseArgs({ args, options: { name: { type: 'string' }, dir: { type: 'string' }, knowledge: { type: 'string' },
    krita: { type: 'string' }, step: { type: 'string' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }, allowPositionals: false });
  if (!values.help && !values.name?.trim()) throw new Error('必须提供 --name <任务名>。');
  if (!values.help && !values.knowledge?.trim()) throw new Error('必须提供 --knowledge <先验知识目录>；独立 section 不保存配置，每次启动（含续跑）都须指定。');
  if (values.dir !== undefined) resolveRunsDirectory(values.dir);
  return values;
}
if (import.meta.main) {
  (async () => {
    const args = parseRunArguments(process.argv.slice(2));
    if (args.help) { console.log(help); return; }
    selectKnowledge(resolveInput(args.name!, args.knowledge!, args.dir));
    const controller = new AbortController(), stop = () => controller.abort(new Error('头部九轴已中断；续跑会重新生成未完成的步骤。'));
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    const release = args['dry-run'] ? undefined : await acquireTaskLock(taskDirectory(args.name!, args.dir));
    try { console.log(await runWorkflow({ name: args.name!, dir: args.dir, krita: args.krita, step: args.step, dryRun: args['dry-run'], signal: controller.signal, progress: console.log })); }
    finally { await release?.(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
  })().catch(error => { console.error(formatAgentError(error)); process.exitCode = 1; });
}
