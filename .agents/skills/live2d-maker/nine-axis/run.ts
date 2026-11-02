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
import { ffmpegPath, generateVideo, produceTurn, produceViewsY, resolveTurnInput, viewsY, type ViewY, type Box, type GenerateVideo, type TurnInput } from './turn.ts';
import { finishHead, resolveHeadInput, type HeadInput } from './head.ts';
import { finishAngleY } from './angle-y.ts';
import { angleScale, angleValues } from './angles.ts';

export const help = `nine-axis — 头部九轴
pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <可执行文件> [--dir <绝对运行根目录>] [--dry-run]
step01_views：从工作台当前的角色图（阴影蒙版交付后为 shadow/step01_mask/character-shadowed.png，否则为组装图）
按脸、头发、头饰形状截取头顶到肩线的方形正面头部特写 upper-body.png，作为首帧分别交给生视频模型：身体与镜头不动，
只有头匀速向左转到侧面（90°）；程序按帧序取出转到 angles.json left 度数（默认 30°）的一帧 left.png。只做向左，不生成向右与 up、down。
需要 .env 的 layering_video_base_url / layering_video_api_key（留空时用 layering_openai_image_*）、nine_axis_view_video_model 和 ffmpeg。
step02_angle-x：left 方向的脸部＋双耳透视形变。agent 在 workspace 里按 pink-doll 的拟合方法自己写脚本，用 krita 工具
导出脸部图层，拟合出向左（ParamAngleX −30，即 left 视角）的父级＋子级（眉眼、嘴、鼻）warp，耳朵随父级，交付 face-left.json 与 layers/；程序按左右配对镜像出 +30，写出工作台读取的 deformers.json
与记录源 KRA/PNG 哈希的 source.json。
step03_views-y：以 step01 的 upper-body.png 为首帧生成两段 5 秒视频，人物不动、只有镜头移动：up 镜头匀速降到下巴正下方仰视（脸看起来抬起），
down 镜头匀速升到头顶正上方俯视（脸看起来低下），都在最后一帧到 90°；程序取出 angles.json up、down 度数（默认都是 25°）的一帧，写为 up.png、down.png。
用的生视频接口与 step01 相同。
ParamAngleX / ParamAngleY 处处以度数为值：各视角的度数只记在 knowledge/nine-axis/step01_views/references/angles.json（默认 left 30、up 25、down 25），
由程序填进各步提示词，agent 交付与 deformers.json 的关键形键都是这些度数；换成 Cubism ±30 等范围留给导出。只做脸与双耳，不含头发；不补绘。使用 nine_axis_head_agent_model。
step04_angle-y（暂停，不运行）：上下方向的脸部＋双耳形变。agent 沿用 step02 的图层与网格（脸底 32×32，其余 16×16），分别拟合 step03 的 up 视角（ParamAngleY +25）与
down 视角（−25），交付 face-y.json；程序把 Y 关键形并入 step02 的变形器，写出工作台读取的 deformers.json。
只做形变：轮廓线的出现与消失留给后续步骤。使用 nine_axis_head_agent_model。
提示词：<knowledge>/nine-axis/step01_views/、step02_angle-x/、step03_views-y/（up 用 prompts/视角视频.md，down 用 prompts/groups/down/视角视频.md）、step04_angle-y/。上游产物重做后其后的步骤随之重做。
总入口：pnpm start --name <任务名> --from nine-axis --to nine-axis。
`;

export const turnPrompt = () => stepKnowledge('nine-axis', 'step01_views').render('main').trim();
// Checked before any step starts, so a run without the video service fails at once.
export function requireVideoApi(environment: Pick<WorkflowEnvironment, 'videoApi'>): VideoApi {
  if (!environment.videoApi) throw new Error('头部九轴转头视频需要生视频接口：请在 live2d-maker/.env 填写 layering_video_base_url 与 layering_video_api_key（或 layering_openai_image_base_url / api_key）。未配置时 step01 无法运行。');
  return environment.videoApi;
}

const outputSchema = { type: 'object', properties: { error: { type: ['string', 'null'] } }, required: ['error'], additionalProperties: false };

export function headPrompt(input: HeadInput, taskRoot: string): string {
  return stepKnowledge('nine-axis', 'step02_angle-x').render('main', { document: input.document, color: input.color, ...angleValues() }, { taskRoot }).trim();
}
// up uses the step file; down replaces it through its group.
export const viewYPrompt = (view: ViewY) => stepKnowledge('nine-axis', 'step03_views-y').render('main', {}, view === 'up' ? {} : { group: view }).trim();
export const angleYPrompt = (taskRoot: string) => stepKnowledge('nine-axis', 'step04_angle-y').render('main', angleValues(), { taskRoot }).trim();

// The face agents write their own fitting scripts in the section workspace,
// which step02 and step04 share; the step's knowledge picks their tools (Krita
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
export type NineAxisDependencies = { environment?: WorkflowEnvironment; generate?: GenerateVideo; ffmpeg?: string; fitHead?: FitHead; fitAngleY?: FitHead;
  resolveInput?: (name: string, root: string) => Promise<TurnInput> };
export async function runWorkflow(options: NineAxisOptions, dependencies: NineAxisDependencies = {}): Promise<string> {
  const root = resolveRunsDirectory(options.dir), progress = options.progress ?? (() => {});
  const task = taskDirectory(options.name, root), directory = join(task, 'nine-axis');
  const environment = dependencies.environment ?? loadWorkflowEnvironment();
  const prompt = turnPrompt();
  const scale = angleScale();
  const input = await (dependencies.resolveInput ?? resolveTurnInput)(options.name, root);
  const headLabel = `${environment.stepModels.nine_axis_head.model}-${environment.stepModels.nine_axis_head.effort}`;
  let summary = 'nine-axis 已完成（沿用已有结果）', sectionKrita: SectionKrita | undefined;
  // Krita is only needed by step02's agent, so only a run that reaches it asks for one.
  const faceTools = async (stepId: string): Promise<FunctionTool[]> => {
    const bitmap = createBitmapTool(directory, join(directory, stepId, 'observations'));
    if (stepId !== 'step02_angle-x') return [bitmap];
    if (!sectionKrita) {
      if (!options.krita?.trim()) throw new Error('step02_angle-x 需要 --krita <已安装的 Krita 可执行文件路径>。');
      const krita = await checkKrita(resolveInput(options.name, options.krita, root), environment.codex.env);
      sectionKrita = new SectionKrita({ section: directory, krita: krita.executable, env: environment.codex.env, record: join(directory, kritaRecordFile) });
    }
    await sectionKrita.reserve(options.signal, waiting => progress(`step02_angle-x：${waiting}`));
    return [createKritaTool(sectionKrita, task), bitmap];
  };
  const agents = () => new CodexAgents({ environment, cwd: directory, logDirectory: join(directory, 'agents'), progress });
  const preflight = () => preflightAgentSteps(environment, ['nine_axis_head'], { runsRoot: root, progress, env: environment.codex.env });
  try { await runSection({ directory,
    // step04_angle-y is shelved for now.
    steps: [{ number: 1, note: 'views' }, { number: 2, note: 'angle-x' }, { number: 3, note: 'views-y' }],
    dryRun: options.dryRun, signal: options.signal, progress,
    async step(step, status) {
      if (status === 'completed') return undefined;
      // Both video steps use the same video service.
      const video = () => {
        const api = dependencies.generate ? undefined : requireVideoApi(environment);
        return { model: api?.model ?? 'injected', generate: dependencies.generate ?? ((prompt, image, o) => generateVideo(api!, prompt, image, o)) as GenerateVideo };
      };
      if (step.id === 'step03_views-y') return async () => {
        const { model, generate } = video();
        const views = viewsY.map(view => ({ view, prompt: viewYPrompt(view), angle: view === 'up' ? scale.y[1] : -scale.y[0] }));
        if (options.dryRun) { progress(`预览：从 step01 的上半身用 ${model} 生成 ${views.map(v => `${v.view}（取 ${v.angle}° 帧）`).join('、')} 镜头视频。\n${views.map(v => `${v.view} 提示词：\n${v.prompt}`).join('\n\n')}`); summary = '预览完成，未调用模型'; return; }
        const ffmpeg = dependencies.ffmpeg ?? await ffmpegPath(environment.codex.env);
        await produceViewsY(step.directory, join(directory, 'step01_views', 'upper-body.png'), generate, views, { signal: options.signal, progress, ffmpeg, model });
        summary = `nine-axis/step03_views-y 已完成：抬头 ${scale.y[1]}°、低头 ${-scale.y[0]}° 视角`;
      };
      if (step.id === 'step04_angle-y') return async () => {
        if (options.dryRun) { progress(`预览：用 ${headLabel} 拟合脸部抬头与低头。\n提示词：\n${angleYPrompt(task)}`); summary = '预览完成，未调用模型'; return; }
        const fit = dependencies.fitAngleY ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '脸部与双耳上下'));
        await fit(step.directory, angleYPrompt(task));
        summary = `nine-axis/step04_angle-y 已完成：${await finishAngleY(step.directory, join(directory, 'step02_angle-x'), scale)} 个脸部图层的抬头与低头`;
      };
      if (step.id === 'step02_angle-x') return async () => {
        const head = await resolveHeadInput(input);
        if (options.dryRun) { progress(`预览：用 ${headLabel} 拟合脸部向左转向，镜像出向右。\n提示词：\n${headPrompt(head, task)}`); summary = '预览完成，未调用模型'; return; }
        const box = JSON.parse(await readFile(join(directory, 'step01_views', 'crop.json'), 'utf8')).box as Box;
        const fit = dependencies.fitHead ?? (await preflight(), createFitHead(agents(), faceTools, step.id, '脸部与双耳转向'));
        await fit(step.directory, headPrompt(head, task));
        summary = `nine-axis/step02_angle-x 已完成：${await finishHead(step.directory, head, box, scale)} 个脸部图层的 ${scale.x[0]}° / +${scale.x[1]}° 转向`;
      };
      return async () => {
        const { model, generate } = video();
        if (options.dryRun) { progress(`预览：从 ${input.color} 截取上半身，用 ${model} 生成向左转头视频并取 ${scale.x[1]}° 帧。\n提示词：\n${prompt}`); summary = '预览完成，未调用模型'; return; }
        const ffmpeg = dependencies.ffmpeg ?? await ffmpegPath(environment.codex.env);
        const box = await produceTurn(step.directory, input, generate, prompt, { signal: options.signal, progress, ffmpeg, model, angle: scale.x[1] });
        summary = `nine-axis/step01_views 已完成：${box.size}×${box.size} 上半身的向左 ${scale.x[1]}° 视角`;
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
