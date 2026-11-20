import { dirname, join } from 'node:path';
import { AgentDispatcher, type AgentOptions } from '../agents/dispatcher.ts';
import { nodeKind, walkGroups } from './groups.ts';
import { runLayering, validateLayeringDepth } from './layering.ts';
import { createLayeringSteps } from './layering-steps.ts';
import { groupStages, type GroupInput, type GroupNode, type LayeringResult, type LayeringSteps, type SvgMerger } from './layering-types.ts';
import type { PreparationInput, PreparationReferences } from './preparation-types.ts';
import type { PartProfile } from './profile.ts';
import { sectionDirectory, resolveRunsDirectory, taskDirectory } from '../paths.ts';
import { requireCurrentLayout } from '../../workflow/layout.ts';
import { toolCatalog } from '../codex/tool-config.ts';
import { sectionAgentSteps, preflightAgentSteps } from '../agents/preflight.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import type { ImageProcessingOptions } from '../image-processing.ts';
import { agentWorkflowStep } from '../agent-knowledge.ts';
import { partSteps, stepName, stepNumber } from '../step-paths.js';
import { includesStep, resolveStepRange, type StepRange, type StepSelection } from '../step-range.ts';
import type { SectionStep } from '../step-section.ts';
export type PartSection = {
  profile: PartProfile;
  getPreparationDirectory(name: string, root?: string): string;
  loadPreparedReferences(name: string, root?: string, standard?: boolean): Promise<PreparationReferences>;
  preparationRoute(input: PreparationInput): readonly SectionStep[] | Promise<readonly SectionStep[]>;
  prepare(input: PreparationInput, agents: Pick<AgentDispatcher, 'run'>, progress?: (message: string) => void,
    normalization?: ImageProcessingOptions, range?: StepRange, signal?: AbortSignal): Promise<PreparationReferences>;
};
export type PartInput = { reference: PreparationInput; groups: GroupInput | GroupInput[] | null; maxDepth?: number; selection?: StepSelection };
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
  const firstLayering = stepNumber(partSteps.initial)!;
  const range = input.selection && resolveStepRange([
    ...(await section.preparationRoute(input.reference)).map(step => stepName(step.number, step.note)),
    ...Object.values(partSteps).filter(step => stepNumber(step)! >= firstLayering),
  ], input.selection);
  const savedReferences = input.groups !== null || (range?.from ?? 0) >= firstLayering
    ? await section.loadPreparedReferences(input.reference.runName, input.reference.dir, input.reference.standard) : undefined;
  toolCatalog(section.profile.toolsDirectory);
  const environment = agentOptions.environment ?? loadWorkflowEnvironment(agentOptions.env);
  const normalization = { ...agentOptions.imageNormalization, runsRoot: input.reference.dir ?? agentOptions.imageNormalization?.runsRoot, progress: agentOptions.progress, env: agentOptions.imageNormalization?.env ?? environment.codex.env };
  if (!adapters.steps) {
    await preflightAgentSteps(environment, sectionAgentSteps(section.profile.id, input.reference.standard)
      .filter(step => includesStep(range, agentWorkflowStep(step))), normalization);
  }
  const agents = new AgentDispatcher({
    ...agentOptions, environment, imageNormalization: normalization, cwd: dirname(directory), logDirectory: agentOptions.logDirectory ?? join(dirname(directory), 'agents'),
  });
  const references = savedReferences ?? await section.prepare(input.reference, agents, agentOptions.progress, normalization, range, agentOptions.signal);
  if ((range?.to ?? Infinity) < firstLayering) return { references };
  adapters.prepared?.();
  const layering = await runLayering({
    profile: section.profile, directory: dirname(directory), references, groups: input.groups,
    steps: adapters.steps ?? createLayeringSteps(agents), mergeSvg: adapters.mergeSvg,
    maxDepth: input.maxDepth, range, maxRecursiveCounts: input.selection?.maxRecursiveCounts, progress: agentOptions.progress, signal: agentOptions.signal,
  });
  return { references, layering };
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
