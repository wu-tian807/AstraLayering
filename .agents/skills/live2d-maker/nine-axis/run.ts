import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatAgentError, validateAgentOutcome } from '../shared/codex/diagnostics.ts';
import { acquireTaskLock } from '../workflow/state.ts';
import { taskDirectory, resolveInput, resolveRunsDirectory } from '../shared/paths.ts';
import { selectKnowledge, stepKnowledge } from '../shared/knowledge.ts';
import { runSection } from '../shared/step-section.ts';
import { loadWorkflowEnvironment, type WorkflowEnvironment } from '../shared/codex/environment.ts';
import { CodexAgents } from '../shared/codex/agents.ts';
import { preflightAgentSteps } from '../shared/agents/preflight.ts';
import { produceTurn, resolveTurnInput, turnViews, type DrawView, type TurnInput, type TurnView } from './turn.ts';

export const help = `nine-axis — 头部九轴
pnpm nine-axis --name <任务名> --knowledge <先验知识目录> [--dir <绝对运行根目录>] [--dry-run]
step01_turn：从工作台当前的角色图（阴影蒙版交付后为 shadow/step01_mask/character-shadowed.png，否则为组装图）
按脸、头发、头饰形状截取头顶到肩线的方形头部特写 upper-body.png，再由生图 agent 参照模板角色的正面→姿态，
画出 ${turnViews.join('、')} 五个视角（右侧由后续步骤镜像脸部形变得到）。
使用 layering_agent_preparation_model 与 layering_nine_axis_view_image_model（留空继承默认生图模型）。
提示词：<knowledge>/nine-axis/step01_turn/。上游产物重做后 step01 随之重做。
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

export type NineAxisOptions = { name: string; dir?: string; dryRun?: boolean; signal?: AbortSignal; progress?: (message: string) => void };
export type NineAxisDependencies = { environment?: WorkflowEnvironment; draw?: DrawView;
  resolveInput?: (name: string, root: string) => Promise<TurnInput> };
export async function runWorkflow(options: NineAxisOptions, dependencies: NineAxisDependencies = {}): Promise<string> {
  const root = resolveRunsDirectory(options.dir), progress = options.progress ?? (() => {});
  const task = taskDirectory(options.name, root), directory = join(task, 'nine-axis');
  const environment = dependencies.environment ?? loadWorkflowEnvironment();
  const model = environment.stepModels.nine_axis_view, image = environment.stepImages.nine_axis_view ?? 'codex-native';
  const label = `${model.model}-${model.effort} / ${image}`;
  for (const view of turnViews) viewPrompt(view, task);
  const input = await (dependencies.resolveInput ?? resolveTurnInput)(options.name, root);
  let summary = 'nine-axis/step01_turn 已完成（沿用已有结果）';
  await runSection({ directory,
    steps: [{ number: 1, note: 'turn' }],
    dryRun: options.dryRun, signal: options.signal, progress,
    async step(step, status) {
      if (status === 'completed') return undefined;
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
    } });
  return summary;
}

export function parseRunArguments(args: string[]) {
  const { values } = parseArgs({ args, options: { name: { type: 'string' }, dir: { type: 'string' }, knowledge: { type: 'string' },
    'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }, allowPositionals: false });
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
    try { console.log(await runWorkflow({ name: args.name!, dir: args.dir, dryRun: args['dry-run'], signal: controller.signal, progress: console.log })); }
    finally { await release?.(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
  })().catch(error => { console.error(formatAgentError(error)); process.exitCode = 1; });
}
