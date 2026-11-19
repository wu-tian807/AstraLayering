import { formatAgentError } from '../codex/diagnostics.ts';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AgentDispatcher, type AgentOptions } from '../agents/dispatcher.ts';
import { defaultAgentConcurrency } from '../agents/runtime.ts';
import { nodeKind, normalizeGroups, walkGroups } from './groups.ts';
import { GroupExecutionError, runLayering, validateLayeringDepth } from './layering.ts';
import { createLayeringSteps } from './layering-steps.ts';
import { groupStages, type GroupInput, type GroupNode, type LayeringResult, type LayeringSteps, type SvgMerger } from './layering-types.ts';
import type { PreparationInput, PreparationReferences } from './preparation-types.ts';
import type { PartProfile } from './profile.ts';
import { selectKnowledge } from '../knowledge.ts';
import { sectionDirectory, resolveInput, resolveRunsDirectory, taskDirectory } from '../paths.ts';
import { requireCurrentLayout } from '../../workflow/layout.ts';
import { toolCatalog } from '../codex/tool-config.ts';
import { sectionAgentSteps, preflightAgentSteps } from '../agents/preflight.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import type { ImageProcessingOptions } from '../image-processing.ts';
import { includesStep, resolveStepRange, type StepRange } from '../step-range.ts';
import { clothingPreparationStep, partSteps, stepNumber } from '../step-paths.js';
import { readPreparationOptions } from './preparation-cache.ts';
import { agentWorkflowStep } from '../agent-knowledge.ts';
export type PartSection = {
  profile: PartProfile; imageHelp: string; preparationHelp: string;
  getPreparationDirectory(name: string, root?: string): string;
  loadPreparedReferences(name: string, root?: string, standard?: boolean): Promise<PreparationReferences>;
  prepare(input: PreparationInput, agents: Pick<AgentDispatcher, 'run'>, progress?: (message: string) => void, normalization?: ImageProcessingOptions, range?: StepRange): Promise<PreparationReferences>;
};
export type PartInput = { reference: PreparationInput; groups: GroupInput | GroupInput[] | null; maxDepth?: number; range?: StepRange; maxRecursiveCounts?: number };
// prepared() is called once the references are ready, before layering starts.
export type PartAdapters = { steps?: LayeringSteps; mergeSvg?: SvgMerger; prepared?(): void };

export async function runPartSection(
  section: PartSection, input: PartInput, adapters: PartAdapters = {},
  agentOptions: AgentOptions = {},
): Promise<{ references: PreparationReferences; layering?: LayeringResult }> {
  validateLayeringDepth(input.maxDepth);
  if (section.profile.id === 'clothing-part-layering' && input.reference.image !== undefined) {
    throw new Error(`衣服 part 按 --name 读取上游，不接受 --image。请将简化穿衣角色图放到 ${join(sectionDirectory(input.reference.runName, 'part-layering', input.reference.dir), 'references/simplified-subject.png')}，或先执行同名 part-layering。`);
  }
  if (section.profile.id === 'clothing-part-layering' && input.reference.standard !== undefined) {
    throw new Error('--standard / --no-standard 只适用于人物 part 的 preparation；衣服按 --name 读取上游简化角色。');
  }
  await requireCurrentLayout(taskDirectory(input.reference.runName, resolveRunsDirectory(input.reference.dir)));
  const directory = section.getPreparationDirectory(input.reference.runName, input.reference.dir);
  const standard = section.profile.id === 'part-layering' ? input.reference.standard ?? await readPreparationOptions(directory) : undefined;
  const prepareEndsAt = stepNumber(section.profile.id === 'part-layering' ? partSteps.ready : clothingPreparationStep)!;
  const savedReferences = input.groups !== null || (input.range?.from ?? 1) > prepareEndsAt
    ? await section.loadPreparedReferences(input.reference.runName, input.reference.dir, standard) : undefined;
  toolCatalog(section.profile.toolsDirectory);
  const environment = agentOptions.environment ?? loadWorkflowEnvironment(agentOptions.env);
  const normalization = { ...agentOptions.imageNormalization, runsRoot: input.reference.dir ?? agentOptions.imageNormalization?.runsRoot, progress: agentOptions.progress, env: agentOptions.imageNormalization?.env ?? environment.codex.env };
  if (!adapters.steps) {
    const agents = sectionAgentSteps(section.profile.id, standard)
      .filter(step => includesStep(input.range, agentWorkflowStep(step)));
    await preflightAgentSteps(environment, agents, normalization);
  }
  const agents = new AgentDispatcher({
    ...agentOptions, environment, imageNormalization: normalization, cwd: dirname(directory), logDirectory: agentOptions.logDirectory ?? join(dirname(directory), 'agents'),
  });
  const references = savedReferences ?? await section.prepare({ ...input.reference, standard }, agents, agentOptions.progress, normalization, input.range);
  if ((input.range?.to ?? Infinity) < stepNumber(partSteps.initial)!) return { references };
  adapters.prepared?.();
  const layering = await runLayering({
    profile: section.profile, directory: dirname(directory), references, groups: input.groups,
    steps: adapters.steps ?? createLayeringSteps(agents), mergeSvg: adapters.mergeSvg,
    maxDepth: input.maxDepth, range: input.range, maxRecursiveCounts: input.maxRecursiveCounts, progress: agentOptions.progress,
  });
  return { references, layering };
}

export async function readGroupInput(path: string): Promise<GroupInput | GroupInput[]> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (Array.isArray(value)) return normalizeGroups(value);
  if (!value || typeof value !== 'object') throw new Error('分组输入必须是组、组数组或 groups 文档');
  const object = value as Record<string, unknown>;
  if (typeof object.id === 'string') return normalizeGroups([object])[0];
  if (object.version !== undefined && object.version !== 1) throw new Error('Unsupported groups document version');
  return normalizeGroups(object.groups);
}

export function parseRunArguments(args: string[] = process.argv.slice(2), section: PartProfile['id'] = 'part-layering') {
  const { values } = parseArgs({ args, options: {
    image: { type: 'string' }, name: { type: 'string' }, dir: { type: 'string' }, knowledge: { type: 'string' }, help: { type: 'boolean' },
    'from-step': { type: 'string' },
    'to-step': { type: 'string' },
    standard: { type: 'boolean' }, 'no-standard': { type: 'boolean' },
    jobs: { type: 'string', short: 'j' },
    agents: { type: 'string', short: 'a' },
    'max-recursive-counts': { type: 'string' },
  } });
  for (const [name, value] of [['--jobs / -j', values.jobs], ['--agents / -a', values.agents]] as const) {
    if (value !== undefined && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) {
      throw new Error(`${name} 必须是正整数`);
    }
  }
  if (values.jobs !== undefined && values.agents !== undefined && Number(values.jobs) !== Number(values.agents)) {
    throw new Error('--jobs 和 --agents 是同一 agent 并发上限的别名，不能指定不同值');
  }
  const agentConcurrency = Number(values.jobs ?? values.agents ?? defaultAgentConcurrency);
  const limit = values['max-recursive-counts'];
  const maxRecursiveCounts = limit === undefined ? undefined : Number(limit);
  if (limit !== undefined && (!/^\d+$/.test(limit) || !Number.isSafeInteger(maxRecursiveCounts))) {
    throw new Error('--max-recursive-counts 必须是非负整数');
  }
  const from = values['from-step'], to = values['to-step'];
  const steps = Object.values(partSteps);
  const range = from !== undefined || to !== undefined
    ? resolveStepRange(section === 'part-layering' ? steps
      : [clothingPreparationStep, ...steps.filter(step => stepNumber(step)! >= stepNumber(partSteps.initial)!)], from, to)
    : undefined;
  if (values.dir !== undefined) resolveRunsDirectory(values.dir);
  if (values.standard && values['no-standard']) throw new Error('--standard 与 --no-standard 不能同时使用。');
  return { ...values, standard: values['no-standard'] ? false : values.standard, agentConcurrency, maxRecursiveCounts, range };
}

export function formatLayeringSummary(groups: GroupNode[]): string[] {
  const labels = { outline: '轮廓绘制', review: '轮廓 review', reduction: '同层轮廓去重', completion: '直接遮挡补形',
    completionCheck: '补形自检', children: '子组分析' };
  return walkGroups(groups).map(({ group }) => {
    const review = group.steps.review;
    const stage = groupStages.find(stage => group.steps[stage].status === 'failed')
      ?? groupStages.find(stage => group.steps[stage].status !== 'completed');
    const repaired = review.output?.reviewOutcome === 'repaired';
    if (!stage) return `[${group.id}] 本组流程已完成（${nodeKind(group)}）${repaired ? `；轮廓：${review.output!.note ?? '两轮返修及自检完成，不再复审'}` : ''}`;
    const step = group.steps[stage];
    const reviewLabel = review.status === 'completed'
      ? repaired ? `轮廓：${review.output!.note ?? '两轮返修及自检完成，不再复审'}` : '轮廓 review 已通过'
      : '轮廓 review 尚未通过';
    const detail = step.status === 'failed' ? `失败：${step.message}`
      : step.message?.includes('：待接入') ? '待接入'
      : stage === 'review' && step.message?.startsWith('轮廓 review blocked') ? '无法核对（blocked），保留待办'
      : stage === 'review' && step.message?.startsWith('轮廓 review revise') ? '需要返修（revise）'
      : '等待执行';
    return `[${group.id}] ${reviewLabel}；${labels[stage]}：${detail}`;
  });
}

export async function runCli(section: PartSection, args = process.argv.slice(2)): Promise<void> {
  try {
    const values = parseRunArguments(args, section.profile.id);
    if (values.help) {
      console.log(`pnpm ${section.profile.id} --name <运行名> ${section.profile.id === 'part-layering' ? `[--image <${section.imageHelp}>] [--standard | --no-standard] ` : ''} --knowledge <先验知识目录> [--dir <运行根目录绝对路径>] [--from-step <步骤>] [--to-step <步骤>] [--max-recursive-counts <回环次数>] [--jobs <agent并发数>]`);
      console.log(section.preparationHelp);
      console.log('Python 模块首次实际使用时自动安装到运行根目录 .runtime 并复用。');
      console.log('各小步骤的模型、CLI 与生图配置见 skill 根目录 example.env。默认任务目录在外部 .run/<name>/；--dir 指定运行根目录，输入相对路径以该根目录下的 <name>/ 为基准。');
      console.log('--knowledge 每次启动（含续跑）都须指定：独立 section 不保存配置；该目录完整替换 skill 自带的 knowledge/，启动前检查全部文件。');
      console.log('--from-step 与 --to-step 指定含端点的范围；只给 --from-step 时只跑该步。范围之前的步骤必须已完成且交付存在。两项都省略时运行整条 Part 管线。');
      console.log(`--jobs / -j 设置所有步骤共享的 agent 调用并发上限，默认 ${defaultAgentConcurrency}；组任务不另设数量限制，按树的层级依赖进入队列。`);
      console.log('--max-recursive-counts 限制本次从 step12 回到 step09 的次数；0 只处理当前待制作层。停点在 step09 到 step12 时，默认不回环。');
      console.log('--agents / -a 为 --jobs / -j 的兼容别名，控制同一上限。临时服务错误等待后沿用会话恢复，次数不设上限，过程写入 agent 日志。');
    } else {
      if (!values.name) throw new Error('需要 --name <运行名>');
      if (!values.knowledge?.trim()) throw new Error('必须提供 --knowledge <先验知识目录>；独立 section 不保存配置，每次启动（含续跑）都须指定。');
      selectKnowledge(resolveInput(values.name, values.knowledge, values.dir));
      const { references, layering } = await runPartSection(section, {
        reference: { image: values.image, runName: values.name, dir: values.dir, standard: values.standard },
        groups: null, range: values.range, maxRecursiveCounts: values.maxRecursiveCounts,
      }, {}, { progress: console.log, agentConcurrency: values.agentConcurrency });
      console.log(`参考输出：${references.directory}`);
      if (!layering) return;
      console.log(`分组：${layering.groupsPath}`);
      console.log(`事实产物目录：${layering.statePath}`);
      if (layering.occlusionPath) console.log(`遮挡层级表：${layering.occlusionPath}`);
      for (const line of formatLayeringSummary(layering.groups)) console.log(line);
      console.log(layering.status === 'completed' ? `Layering 已完成：${layering.output}` : 'Layering 未完成，正式产物与检查记录已保存；各组状态见上方。');
    }
  } catch (error) {
    console.error(formatAgentError(error));
    if (error instanceof GroupExecutionError) {
      console.error('Layering 未完成：停止派发新待办，已启动的组已结束；其余未启动的待办未执行。');
      for (const line of formatLayeringSummary(error.groups)) console.error(line);
      console.error(`事实产物目录：${error.statePath}`);
    }
    process.exitCode = 1;
  }
}
