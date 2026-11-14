import { clothingPreparationStep, partSteps } from '../.agents/skills/live2d-maker/shared/step-paths.js';
import type { StepStatus } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
import { executionStatus, aggregateStatus, type ExecutionStatus } from './execution-state.js';
import { throttled, type AgentCall } from './agent-progress.ts';

type Status = ExecutionStatus;
const stepPhases: Record<string, string> = {
  part_pose_judgment: 'standard', part_standardize: 'standard', part_reference_judgment: 'simplified',
  part_simplify: 'simplified', part_base_subject: 'base', clothing_preparation: 'clothing',
  part_initial_groups: 'initial', clothing_initial_groups: 'initial',
  part_occlusion: 'occlusion', clothing_occlusion: 'occlusion',
};
const namePhases: Record<string, string> = {
  '姿态判断': 'standard', '标准姿态': 'standard', '参考判断': 'simplified', '参考判断与简化': 'simplified', '简化图片': 'simplified',
  '素体换装': 'base', '纯衣服参考准备': 'clothing', '首次分组识别': 'initial', '最终遮挡层级规划': 'occlusion',
};

// Observe published files and current calls. This function never restores or writes scheduler state.
export async function partStages(section: string, calls: AgentCall[], active: boolean,
  step: (id: string) => Promise<StepStatus> = async () => 'absent', failed = false,
  files: Set<string> = new Set(), groups: any[] = []) {
  const states: Record<string, Status> = {}, messages: Record<string, string> = {};
  const present = (path: string) => files.has(`${section}/${path}`);
  const latest = new Map<string, AgentCall>();
  for (const call of calls) {
    const phase = stepPhases[call.step] ?? namePhases[call.name];
    if (phase) latest.set(phase, call);
  }
  const stage = async (phase: string, id: string, hasProducts: boolean) => {
    const marker = await step(id);
    if (marker === 'completed') return 'done' as const;
    if (marker !== 'running') return executionStatus(marker, { failed });
    if (!active) return executionStatus(marker, { failed });
    const call = latest.get(phase);
    if (call?.failed) return 'failed' as const;
    if (call && !call.finished) return throttled(call) ? 'throttled' as const : 'running' as const;
    return hasProducts ? 'available' as const : 'pending' as const;
  };
  states.initial = await stage('initial', partSteps.initial, groups.length > 0);
  if (section === 'part-layering') {
    states.standard = await stage('standard', partSteps.standard, present('references/standard.png'));
    states.simplified = await stage('simplified', partSteps.simplified, present('references/simplified-subject.png'));
    states.base = await stage('base', partSteps.base, present('references/base-subject.png'));
    states.preparation = aggregateStatus(['standard', 'simplified', 'base'].map(phase => states[phase]));
  } else {
    states.clothing = await stage('clothing', clothingPreparationStep, present('references/clothing.png'));
    states.preparation = states.clothing;
  }
  states.merge = await stage('merge', partSteps.merge, present('preview.svg') || present('preview.draft.svg'));
  states.occlusion = await stage('occlusion', partSteps.occlusion, present('occlusion.json')
    || present(`${partSteps.occlusion}/preview.svg`) || present(`${partSteps.occlusion}/workspace/candidate.svg`));
  for (const [phase, call] of latest) {
    if (states[phase] === 'done') continue;
    if (call.failed) {
      states[phase] = 'failed'; messages[phase] = '调用失败，请查看运行记录：' + call.name;
      if (['standard', 'simplified', 'base', 'clothing'].includes(phase)) states.preparation = 'failed';
      continue;
    }
    if (!active) continue;
    if (call.finished) continue;
    const status = throttled(call) ? 'throttled' : 'running';
    const message = status === 'throttled' ? call.retryError! : call.name;
    states[phase] = status; messages[phase] = message;
    if (['standard', 'simplified', 'base', 'clothing'].includes(phase)) {
      states.preparation = status; messages.preparation = message;
    }
  }
  states.preparation = section === 'part-layering'
    ? aggregateStatus(['standard', 'simplified', 'base'].map(phase => states[phase])) : states.clothing;
  return { states, messages };
}
