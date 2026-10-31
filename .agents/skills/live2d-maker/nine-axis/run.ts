import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { agentOutcomeError, formatAgentError, validateAgentOutcome } from '../shared/codex/diagnostics.ts';
import { acquireTaskLock } from '../workflow/state.ts';
import { taskDirectory, resolveInput, resolveRunsDirectory } from '../shared/paths.ts';
import { selectKnowledge, stepKnowledge } from '../shared/knowledge.ts';
import { runSection } from '../shared/step-section.ts';
import { loadWorkflowEnvironment, type WorkflowEnvironment } from '../shared/codex/environment.ts';
import { CodexAgents } from '../shared/codex/agents.ts';
import { preflightAgentSteps } from '../shared/agents/preflight.ts';
import { prepareWorkspace, workspacePrompt } from '../shared/agents/workspace.ts';
import { checkKrita } from '../shared/raster/krita.ts';
import { SectionKrita, kritaRecordFile } from '../shared/krita/section-krita.ts';
import { createKritaTool } from '../shared/krita/tool.ts';
import { createBitmapTool } from '../shared/part/bitmap-tool.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { produceTurn, resolveTurnInput, turnViews, type Box, type DrawView, type TurnInput, type TurnView } from './turn.ts';
import { finishHead, resolveHeadInput, type HeadInput } from './head.ts';

export const help = `nine-axis — 头部九轴
pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <可执行文件> [--dir <绝对运行根目录>] [--dry-run]
step01_turn：从工作台当前的角色图（阴影蒙版交付后为 shadow/step01_mask/character-shadowed.png，否则为组装图）
按脸、头发、头饰形状截取头顶到肩线的方形头部特写 upper-body.png，再由生图 agent 参照模板角色的正面→姿态，
画出 ${turnViews.join('、')} 五个视角（右侧由后续步骤镜像脸部形变得到）。
使用 layering_agent_preparation_model 与 layering_nine_axis_view_image_model（留空继承默认生图模型）。
step02_head：left 方向的脸部＋双耳透视形变。agent 在 workspace 里按 pink-doll 的拟合方法自己写脚本，用 krita 工具
导出脸部图层，拟合出向左（ParamAngleX −30，对应约 45° 的 left 视角）的父级＋子级（眉眼、嘴、鼻）warp，耳朵随父级，交付 face-left.json 与 layers/；程序按左右配对镜像出 +30，写出工作台读取的 deformers.json
与记录源 KRA/PNG 哈希的 source.json。只做脸与双耳，不含头发；不补绘。使用 layering_agent_nine_axis_head_model。
提示词：<knowledge>/nine-axis/step01_turn/、step02_head/。上游产物重做后其后的步骤随之重做。
总入口：pnpm start --name <任务名> --from nine-axis --to nine-axis。
`;

// The view's motion is a knowledge file of its own, filled into the shared prompt.
export function viewPrompt(view: TurnView, taskRoot: string): string {
  const knowledge = stepKnowledge('nine-axis', 'step01_turn'), path = join(knowledge.directory, 'prompts/views', `${view}.md`);
  if (!existsSync(path)) throw new Error(`先验知识缺少视角说明：${path}`);
  const motion = readFileSync(path, 'utf8').trim();
  if (!motion) throw new Error(`视角说明为空：${path}`);
  return knowledge.render('main', { view, motion }, { taskRoot }).trim();
}

const outputSchema = { type: 'object', properties: { error: { type: ['string', 'null'] } }, required: ['error'], additionalProperties: false };
export function createDrawView(agents: Pick<CodexAgents, 'run'>, taskRoot: string): DrawView {
  return async (view, output) => {
    const result = await agents.run({ step: 'nine_axis_view', name: `视角参考 ${view}`, imageGeneration: true, outputSchema,
      prompt: viewPrompt(view, taskRoot) });
    await validateAgentOutcome(result, async () => {
      const image = result.images.at(-1);
      if (!image) throw new Error('imagegen did not produce an image');
      await copyFile(image.savedPath, output);
    });
  };
}

export function headPrompt(input: HeadInput, taskRoot: string): string {
  return stepKnowledge('nine-axis', 'step02_head').render('main', { document: input.document, color: input.color }, { taskRoot }).trim();
}

// The face agent writes its own fitting scripts in the step workspace; it is
// given Krita to export the face layers and the bitmap viewer to look at them.
export type FitHead = (directory: string, input: HeadInput, prompt: string) => Promise<void>;
export function createFitHead(agents: Pick<CodexAgents, 'run'>, tools: () => Promise<FunctionTool[]>): FitHead {
  return async (directory, input, prompt) => {
    const nine = join(directory, '..'), paths = await prepareWorkspace({ cwd: nine, outputDirectory: directory }, nine);
    const result = await agents.run({ step: 'nine_axis_head', name: '脸部与双耳转向', cwd: nine, outputDirectory: directory, outputSchema,
      tools: stepKnowledge('nine-axis', 'step02_head').tools('main', await tools()), prompt: workspacePrompt(prompt, paths) });
    let error: unknown;
    try { error = (JSON.parse(result.text) as { error?: unknown }).error; } catch { throw agentOutcomeError('脸部与双耳转向没有返回结果', result); }
    if (typeof error === 'string' && error) throw agentOutcomeError(`脸部与双耳转向：${error}`, result);
  };
}

export type NineAxisOptions = { name: string; dir?: string; krita?: string; dryRun?: boolean; signal?: AbortSignal; progress?: (message: string) => void };
export type NineAxisDependencies = { environment?: WorkflowEnvironment; draw?: DrawView; fitHead?: FitHead;
  resolveInput?: (name: string, root: string) => Promise<TurnInput> };
export async function runWorkflow(options: NineAxisOptions, dependencies: NineAxisDependencies = {}): Promise<string> {
  const root = resolveRunsDirectory(options.dir), progress = options.progress ?? (() => {});
  const task = taskDirectory(options.name, root), directory = join(task, 'nine-axis');
  const environment = dependencies.environment ?? loadWorkflowEnvironment();
  const model = environment.stepModels.nine_axis_view, image = environment.stepImages.nine_axis_view ?? 'codex-native';
  const label = `${model.model}-${model.effort} / ${image}`;
  for (const view of turnViews) viewPrompt(view, task);
  const input = await (dependencies.resolveInput ?? resolveTurnInput)(options.name, root);
  const headLabel = `${environment.stepModels.nine_axis_head.model}-${environment.stepModels.nine_axis_head.effort}`;
  let summary = 'nine-axis 已完成（沿用已有结果）', sectionKrita: SectionKrita | undefined;
  // Krita is only needed by step02's agent, so only a run that reaches it asks for one.
  const kritaTools = async (): Promise<FunctionTool[]> => {
    if (!sectionKrita) {
      if (!options.krita?.trim()) throw new Error('step02_head 需要 --krita <已安装的 Krita 可执行文件路径>。');
      const krita = await checkKrita(resolveInput(options.name, options.krita, root), environment.codex.env);
      sectionKrita = new SectionKrita({ section: directory, krita: krita.executable, env: environment.codex.env, record: join(directory, kritaRecordFile) });
    }
    await sectionKrita.reserve(options.signal, waiting => progress(`step02_head：${waiting}`));
    const step = join(directory, 'step02_head');
    return [createKritaTool(sectionKrita, task), createBitmapTool(directory, join(step, 'observations'))];
  };
  try { await runSection({ directory,
    steps: [{ number: 1, note: 'turn' }, { number: 2, note: 'head' }],
    dryRun: options.dryRun, signal: options.signal, progress,
    async step(step, status) {
      if (status === 'completed') return undefined;
      if (step.id === 'step02_head') return async () => {
        const head = await resolveHeadInput(input);
        if (options.dryRun) { progress(`预览：用 ${headLabel} 拟合脸部向左转向，镜像出向右。\n提示词：\n${headPrompt(head, task)}`); summary = '预览完成，未调用模型'; return; }
        const box = JSON.parse(await readFile(join(directory, 'step01_turn', 'crop.json'), 'utf8')).box as Box;
        const fit = dependencies.fitHead ?? (await preflightAgentSteps(environment, ['nine_axis_head'], { runsRoot: root, progress, env: environment.codex.env }),
          createFitHead(new CodexAgents({ environment, cwd: directory, logDirectory: join(directory, 'agents'), progress }), kritaTools));
        await fit(step.directory, head, headPrompt(head, task));
        summary = `nine-axis/step02_head 已完成：${await finishHead(step.directory, head, box)} 个脸部图层的 ±30 转向`;
      };
      return async () => {
        if (options.dryRun) { progress(`预览：从 ${input.color} 截取上半身，用 ${label} 生成 ${turnViews.join('、')} 视角。\n提示词（left）：\n${viewPrompt('left', task)}`); summary = '预览完成，未调用模型'; return; }
        let draw = dependencies.draw;
        if (!draw) {
          const normalization = { runsRoot: root, progress, env: environment.codex.env };
          await preflightAgentSteps(environment, ['nine_axis_view'], normalization);
          draw = createDrawView(new CodexAgents({ environment, imageNormalization: normalization, cwd: directory,
            logDirectory: join(directory, 'agents'), progress }), task);
        }
        const box = await produceTurn(step.directory, input, draw, { progress, model: label });
        summary = `nine-axis/step01_turn 已完成：${box.size}×${box.size} 上半身的 ${turnViews.length} 个视角`;
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
