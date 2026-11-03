import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { agentOutcomeError, formatAgentError } from '../shared/codex/diagnostics.ts';
import { acquireTaskLock } from '../workflow/state.ts';
import { taskDirectory, resolveInput, resolveRunsDirectory } from '../shared/paths.ts';
import { selectKnowledge, stepKnowledge } from '../shared/knowledge.ts';
import { runSection } from '../shared/step-section.ts';
import { loadWorkflowEnvironment, type VideoApi, type WorkflowEnvironment } from '../shared/codex/environment.ts';
import { CodexAgents } from '../shared/codex/agents.ts';
import { preflightAgentSteps } from '../shared/agents/preflight.ts';
import { prepareWorkspace, workspacePrompt } from '../shared/agents/workspace.ts';
import { checkKrita } from '../shared/raster/krita.ts';
import { SectionKrita, kritaRecordFile } from '../shared/krita/section-krita.ts';
import { createKritaTool } from '../shared/krita/tool.ts';
import { createBitmapTool } from '../shared/part/bitmap-tool.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { ffmpegPath, generateVideo, produceVideos, produceViews, resolveTurnInput, viewsY, type ViewY, type Box, type GenerateVideo, type TurnInput, type VideoPrompts } from './turn.ts';
import { buildHead, finishHead, resolveHeadInput, type Built, type HeadInput } from './head.ts';
import { buildAngleY, finishAngleY } from './angle-y.ts';
import { buildAngleXY, cornerAngleValues, finishAngleXY, writeLinearCorners } from './angle-xy.ts';
import { buildJawLine, finishJawLine } from './jaw-line.ts';
import { createNineAxisViewTool } from './view-tool.ts';
import { angleScale, angleValues } from './angles.ts';

export const help = `nine-axis — 头部九轴
pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <可执行文件> [--dir <绝对运行根目录>] [--dry-run]
step01_video：生成本管线的全部视频。从工作台当前的角色图（阴影蒙版交付后为 shadow/step01_mask/character-shadowed.png，否则为组装图）
按脸、头发、头饰形状截取头顶到肩线的方形正面头部特写 upper-body.png，以它为首帧同时生成三段 5 秒视频：left 身体与镜头不动、只有头匀速向左转到侧面（90°）；
up 人物不动、镜头匀速降到下巴正下方仰视（脸看起来抬起）；down 镜头匀速升到头顶正上方俯视（脸看起来低下），都在最后一帧到 90°。
随后取 up、down 转到 angles.json 度数的一帧（first/up.png、first/down.png）作首帧，用同一转头提示词生成 left-up、left-down 两段向左转头视频，供斜向参考。
需要 .env 的 video_base_url / video_api_key（不使用生图接口，缺少时报错）、nine_axis_view_video_model 和 ffmpeg。
step02_views：程序按帧序从 left.mp4 取出转到 angles.json left 度数（默认 30°）的一帧 left.png。
step03_angle-x：left 方向的脸部＋双耳透视形变。agent 在 workspace 里按 pink-doll 的拟合方法自己写脚本，用 krita 工具
导出脸部图层，拟合出向左（ParamAngleX −30，即 left 视角）的父级＋子级（眉眼、嘴、鼻）warp，耳朵随父级，交付 face-left.json 与 layers/；程序按左右配对镜像出 +30，写出工作台读取的 deformers.json
与记录源 KRA/PNG 哈希的 source.json。
step04_views-y：程序从 up.mp4、down.mp4 取出 angles.json up、down 度数（默认都是 25°）的一帧，写为 up.png、down.png。
ParamAngleX / ParamAngleY 处处以度数为值：各视角的度数只记在 knowledge/nine-axis/step01_video/references/angles.json（默认 left 30、up 25、down 25），
由程序填进各步提示词，agent 交付与 deformers.json 的关键形键都是这些度数；换成 Cubism ±30 等范围留给导出。只做脸与双耳，不含头发；不补绘。使用 nine_axis_head_agent_model。
step05_angle-y：上下方向的脸部＋双耳形变。agent 沿用 step03 的图层与网格（脸底 32×32，其余 16×16），分别拟合 step04 的 up 视角（ParamAngleY +25）与
down 视角（−25），交付 face-y.json；程序把 Y 关键形并入 step03 的变形器，写出工作台读取的 deformers.json。
只做形变：轮廓线的出现与消失留给后续步骤。使用 nine_axis_head_agent_model。
step06_angle-xy：斜向（四角）的脸部＋双耳形变。程序把 step03 的向左与 step05 的抬头、低头线性叠加，写成左上（X −30, Y +25）、左下（X −30, Y −25）的起始形 linear.json；
agent 照提示词里的教程要点手动斜切，交付 face-xy.json；斜向参考由 agent 自己用 ffmpeg 从 step01 的 left-up.mp4、left-down.mp4 取帧。
程序按左右配对镜像出右上、右下，写出工作台读取的 deformers.json；工作台在 3×3 关键形之间双线性插值。
step07_jaw-line：下颌线与脖子。agent 用 krita 工具从源 KRA 取脖子，判断原图有无下颌线（有则从脸底分离并补底色，无则补画），
照 Cubism 教程做下颌线蒙版（反向裁切下颌线）、脸部蒙版与被它裁切的脸色扩展，脖子顶部加高插到脸下、底部不动，交付 jaw.json、layers/ 与按裁切方式写好的
character-nine-axis.kra；程序沿用 step06 未替换的部件，镜像右侧关键形，写出工作台读取的 deformers.json（部件可带 role "mask" 与 clip {by, invert}）。
第一层为「脖子＋脸＋五官」。
提示词：<knowledge>/nine-axis/step01_video/（left、left-up、left-down 用 prompts/视频.md，up、down 用 prompts/groups/<up|down>/视频.md）、step03_angle-x/、step05_angle-y/、step06_angle-xy/、step07_jaw-line/。
上游产物重做后其后的步骤随之重做。总入口：pnpm start --name <任务名> --from nine-axis --to nine-axis。
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

export function headPrompt(input: HeadInput, taskRoot: string): string {
  return stepKnowledge('nine-axis', 'step03_angle-x').render('main', { document: input.document, color: input.color, ...angleValues() }, { taskRoot }).trim();
}
export const angleYPrompt = (taskRoot: string) => stepKnowledge('nine-axis', 'step05_angle-y').render('main', angleValues(), { taskRoot }).trim();
export const angleXYPrompt = (taskRoot: string) => stepKnowledge('nine-axis', 'step06_angle-xy').render('main', { ...angleValues(), ...cornerAngleValues() }, { taskRoot }).trim();
export const jawLinePrompt = (input: HeadInput, taskRoot: string) => stepKnowledge('nine-axis', 'step07_jaw-line')
  .render('main', { document: input.document, color: input.color, ...angleValues(), ...cornerAngleValues() }, { taskRoot }).trim();

// The face agents write their own fitting scripts in the section workspace,
// which step03 to step07 share; the step's knowledge picks their tools (Krita
// to export the face layers, the bitmap viewer to look at them).
export type FitHead = (directory: string, prompt: string) => Promise<void>;
export function createFitHead(agents: Pick<CodexAgents, 'run'>, tools: (step: string) => Promise<FunctionTool[]>, step: string, name: string): FitHead {
  return async (directory, prompt) => {
    const nine = join(directory, '..'), paths = await prepareWorkspace({ cwd: nine, outputDirectory: directory }, nine);
    const result = await agents.run({ step: 'nine_axis_head', name, cwd: nine, outputDirectory: directory, outputSchema,
      tools: stepKnowledge('nine-axis', step).tools('main', await tools(step)), prompt: workspacePrompt(prompt, paths) });
    let error: unknown;
    try { error = (JSON.parse(result.text) as { error?: unknown }).error; } catch { throw agentOutcomeError(`${name}没有返回结果`, result); }
    if (typeof error === 'string' && error) throw agentOutcomeError(`${name}：${error}`, result);
  };
}

export type NineAxisOptions = { name: string; dir?: string; krita?: string; dryRun?: boolean; signal?: AbortSignal; progress?: (message: string) => void };
export type NineAxisDependencies = { environment?: WorkflowEnvironment; generate?: GenerateVideo; ffmpeg?: string; fitHead?: FitHead; fitAngleY?: FitHead; fitAngleXY?: FitHead; fitJawLine?: FitHead;
  resolveInput?: (name: string, root: string) => Promise<TurnInput> };
export async function runWorkflow(options: NineAxisOptions, dependencies: NineAxisDependencies = {}): Promise<string> {
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
  // Krita is only needed by step03's and step07's agents, so only a run that reaches them asks for one.
  const faceTools = async (stepId: string): Promise<FunctionTool[]> => {
    const observations = join(directory, stepId, 'observations');
    const bitmap = createBitmapTool(directory, observations), view = createNineAxisViewTool(directory, observations, () => builds[stepId]());
    if (stepId !== 'step03_angle-x' && stepId !== 'step07_jaw-line') return [bitmap, view];
    if (!sectionKrita) {
      if (!options.krita?.trim()) throw new Error(`${stepId} 需要 --krita <已安装的 Krita 可执行文件路径>。`);
      const krita = await checkKrita(resolveInput(options.name, options.krita, root), environment.codex.env);
      sectionKrita = new SectionKrita({ section: directory, krita: krita.executable, env: environment.codex.env, record: join(directory, kritaRecordFile) });
    }
    await sectionKrita.reserve(options.signal, waiting => progress(`${stepId}：${waiting}`));
    return [createKritaTool(sectionKrita, task), bitmap, view];
  };
  const agents = () => new CodexAgents({ environment, cwd: directory, logDirectory: join(directory, 'agents'), progress });
  const preflight = () => preflightAgentSteps(environment, ['nine_axis_head'], { runsRoot: root, progress, env: environment.codex.env });
  const preview = (text: string) => { progress(`预览：${text}`); summary = '预览完成，未调用模型'; };
  try { await runSection({ directory,
    steps: [{ number: 1, note: 'video' }, { number: 2, note: 'views' }, { number: 3, note: 'angle-x' }, { number: 4, note: 'views-y' }, { number: 5, note: 'angle-y' }, { number: 6, note: 'angle-xy' }, { number: 7, note: 'jaw-line' }],
    dryRun: options.dryRun, signal: options.signal, progress,
    async step(step, status) {
      if (status === 'completed') return undefined;
      if (step.id === 'step01_video') return async () => {
        const { model, generate } = video(), prompts = videoPrompts();
        if (options.dryRun) return preview(`从 ${input.color} 截取上半身，用 ${model} 生成 left、up、down 视频，再以 up、down 的 ${angleY.up}°、${angleY.down}° 帧为首帧生成 left-up、left-down 转头视频。\n转头提示词：\n${prompts.turn}\n\n${viewsY.map(v => `${v} 提示词：\n${prompts[v]}`).join('\n\n')}`);
        const box = await produceVideos(step.directory, input, generate, prompts, { signal: options.signal, progress, ffmpeg: await ffmpeg(), model, angles: angleY });
        summary = `nine-axis/step01_video 已完成：${box.size}×${box.size} 上半身的 5 段视频`;
      };
      if (step.id === 'step02_views' || step.id === 'step04_views-y') return async () => {
        const views = step.id === 'step02_views' ? [{ view: 'left', angle: scale.x[1] }] : viewsY.map(view => ({ view, angle: angleY[view] }));
        if (options.dryRun) return preview(`从 step01_video 取 ${views.map(v => `${v.view}（${v.angle}°）`).join('、')} 帧。`);
        await produceViews(step.directory, videos, views, { signal: options.signal, progress, ffmpeg: await ffmpeg() });
        summary = `nine-axis/${step.id} 已完成：${views.map(v => `${v.view} ${v.angle}°`).join('、')} 视角`;
      };
      if (step.id === 'step03_angle-x') return async () => {
        const head = await resolveHeadInput(input);
        if (options.dryRun) return preview(`用 ${headLabel} 拟合脸部向左转向，镜像出向右。\n提示词：\n${headPrompt(head, task)}`);
        const box = JSON.parse(await readFile(join(videos, 'crop.json'), 'utf8')).box as Box;
        builds[step.id] = () => buildHead(step.directory, head, box, scale);
        const fit = dependencies.fitHead ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '脸部与双耳转向'));
        await fit(step.directory, headPrompt(head, task));
        summary = `nine-axis/step03_angle-x 已完成：${await finishHead(step.directory, head, box, scale)} 个脸部图层的 ${scale.x[0]}° / +${scale.x[1]}° 转向`;
      };
      if (step.id === 'step05_angle-y') return async () => {
        if (options.dryRun) return preview(`用 ${headLabel} 拟合脸部抬头与低头。\n提示词：\n${angleYPrompt(task)}`);
        builds[step.id] = () => buildAngleY(step.directory, join(directory, 'step03_angle-x'), scale);
        const fit = dependencies.fitAngleY ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '脸部与双耳上下'));
        await fit(step.directory, angleYPrompt(task));
        summary = `nine-axis/step05_angle-y 已完成：${await finishAngleY(step.directory, join(directory, 'step03_angle-x'), scale)} 个脸部图层的抬头与低头`;
      };
      if (step.id === 'step06_angle-xy') return async () => {
        if (options.dryRun) return preview(`用 ${headLabel} 从线性叠加起手斜切脸部四角。\n提示词：\n${angleXYPrompt(task)}`);
        const angleYDirectory = join(directory, 'step05_angle-y');
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
    krita: { type: 'string' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }, allowPositionals: false });
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
    try { console.log(await runWorkflow({ name: args.name!, dir: args.dir, krita: args.krita, dryRun: args['dry-run'], signal: controller.signal, progress: console.log })); }
    finally { await release?.(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
  })().catch(error => { console.error(formatAgentError(error)); process.exitCode = 1; });
}
