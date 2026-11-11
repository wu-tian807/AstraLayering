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

// Observe published files and existing receipts. This function never restores or writes scheduler state.
export async function partStages(section: string, calls: AgentCall[], active: boolean,
  step: (id: string) => Promise<StepStatus> = async () => 'absent', failed = false) {
  const states: Record<string, Status> = {}, messages: Record<string, string> = {};
  const stage = async (id: string) => executionStatus(await step(id), { active, failed });
  states.initial = await stage(partSteps.initial);
  if (section === 'part-layering') {
    for (const phase of ['standard', 'simplified', 'base'] as const) states[phase] = await stage(partSteps[phase]);
    states.preparation = aggregateStatus(['standard', 'simplified', 'base'].map(phase => states[phase]));
  } else {
    states.clothing = await stage(clothingPreparationStep);
    states.preparation = states.clothing;
  }
  states.merge = await stage(partSteps.merge);
  states.occlusion = await stage(partSteps.occlusion);
  const latest = new Map<string, AgentCall>();
  for (const call of calls) {
    const phase = stepPhases[call.step] ?? namePhases[call.name];
    if (phase) latest.set(phase, call);
  }
  for (const [phase, call] of latest) {
    if (states[phase] === 'done' || states[phase] === 'pending') continue;
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
