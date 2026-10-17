import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { CodexAgents, type AgentOptions } from './agents.ts';
import { defaultAgentConcurrency } from './agent-runtime.ts';
import { nodeKind, normalizeGroups, walkGroups } from './groups.ts';
import { GroupExecutionError, runLayering } from './layering.ts';
import { createLayeringSteps } from './layering-steps.ts';
import { groupStages, type GroupInput, type GroupNode, type LayeringResult, type LayeringSteps, type SvgMerger } from './layering-types.ts';
import { getPreparationDirectory, loadPreparedReferences, prepareReferences, type PreparationInput, type PreparationReferences } from './preparation.ts';
import { validateWorkflowOptions } from './workflow.ts';
import { createPreparationSteps } from './preparation.ts';

export async function runClothingPartLayering(
  input: { reference: PreparationInput; groups: GroupInput | GroupInput[] | null; maxDepth?: number },
  adapters: { steps?: LayeringSteps; mergeSvg?: SvgMerger } = {},
  agentOptions: AgentOptions = {},
): Promise<{ references: PreparationReferences; layering: LayeringResult }> {
  validateWorkflowOptions({ maxDepth: input.maxDepth });
  const directory = getPreparationDirectory(input.reference.runName);
  const agents = new CodexAgents({
    ...agentOptions, logDirectory: agentOptions.logDirectory ?? join(dirname(directory), 'agents'),
  });
  const references = input.groups === null
    ? await prepareReferences(input.reference, createPreparationSteps(agents), agentOptions.progress)
    : await loadPreparedReferences(input.reference.runName);
  const layering = await runLayering({
    directory: dirname(directory), references, groups: input.groups,
    steps: adapters.steps ?? createLayeringSteps(agents), mergeSvg: adapters.mergeSvg,
    maxDepth: input.maxDepth, progress: agentOptions.progress,
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

export function parseRunArguments(args: string[] = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    image: { type: 'string' }, name: { type: 'string' }, help: { type: 'boolean' },
    groups: { type: 'string' },
    jobs: { type: 'string', short: 'j' },
    agents: { type: 'string', short: 'a' },
    'max-depth': { type: 'string' },
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
  const maxDepth = values['max-depth'] === undefined ? undefined : Number(values['max-depth']);
  if (values['max-depth'] !== undefined && (!/^[1-9]\d*$/.test(values['max-depth']) || !Number.isSafeInteger(maxDepth))) {
    throw new Error('--max-depth 必须是正整数');
  }
  return { ...values, agentConcurrency, maxDepth };
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

if (import.meta.main) {
  try {
    const values = parseRunArguments();
    if (values.help) {
      console.log('pnpm start --name <运行名> [--image <简化穿衣角色图片路径>] [--groups <分组JSON路径>] [--jobs <agent并发数>] [--max-depth <制作层数>]');
      console.log('--image 首次启动需要；续跑使用运行目录中的原图，并生成纯衣服参考；已完成 preparation 时沿用保存的参考。');
      console.log('本流程只拆衣服：provider、鉴权和内置 image_generation 工具由外部 Codex 配置，脚本不接管。');
      console.log('--groups 选择已有组及其子组；祖先须完成，可查看同层有效底稿复核去重，仅实际变化的部件及真实引用者扩入后续制作。省略时按层自动准备或续跑。');
      console.log(`--jobs / -j 设置所有步骤共享的 agent 调用并发上限，默认 ${defaultAgentConcurrency}；组任务不另设数量限制，按树的层级依赖进入队列。`);
      console.log('--max-depth 限制本次制作层数：1 完成第一层并登记第二层，2 制作到第二层并登记第三层，以此类推。省略时继续到终止部件。');
      console.log('--agents / -a 为 --jobs / -j 的兼容别名，控制同一上限。临时服务错误等待后沿用会话恢复，次数不设上限，过程写入 agent 日志。');
    } else {
      if (!values.name) throw new Error('需要 --name <运行名>');
      const { references, layering } = await runClothingPartLayering({
        reference: { image: values.image, runName: values.name },
        groups: values.groups ? await readGroupInput(values.groups) : null, maxDepth: values.maxDepth,
      }, {}, { progress: console.log, agentConcurrency: values.agentConcurrency });
      console.log(`参考输出：${references.directory}`);
      console.log(`分组：${layering.groupsPath}`);
      console.log(`事实产物目录：${layering.statePath}`);
      if (layering.occlusionPath) console.log(`遮挡层级表：${layering.occlusionPath}`);
      for (const line of formatLayeringSummary(layering.groups)) console.log(line);
      console.log(layering.status === 'completed' ? `Layering 已完成：${layering.output}` : 'Layering 未完成，正式产物与检查记录已保存；各组状态见上方。');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof GroupExecutionError) {
      console.error('Layering 未完成：停止派发新待办，已启动的组已结束；其余未启动的待办未执行。');
      for (const line of formatLayeringSummary(error.groups)) console.error(line);
      console.error(`事实产物目录：${error.statePath}`);
    }
    process.exitCode = 1;
  }
}
