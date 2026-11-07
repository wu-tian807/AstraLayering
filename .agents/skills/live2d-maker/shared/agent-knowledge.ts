import { stepKnowledge, type KnowledgeRole } from './knowledge.ts';
import type { AgentStep } from './agents/models.ts';

// Identity only: capabilities live in the selected knowledge's agent.json.
const part = (section: string) => ({
  initial_groups: { section, step: 'step08_initial' },
  outline: { section, step: 'step09_outline' },
  outline_review: { section, step: 'step09_outline', role: 'review' as const },
  outline_repair: { section, step: 'step09_outline', role: 'repair' as const },
  reduce: { section, step: 'step10_reduce' },
  completion: { section, step: 'step11_completion' },
  children: { section, step: 'step12_children' },
  occlusion: { section, step: 'step14_occlusion' },
});
const raster = (section: string) => ({
  step01: { section, step: 'step01' },
  step01_review: { section, step: 'step01', role: 'review' as const },
  step01_repair: { section, step: 'step01', role: 'repair' as const },
  step02: { section, step: 'step02' },
});
const prefixed = <P extends string, T extends object>(prefix: P, entries: T) =>
  Object.fromEntries(Object.entries(entries).map(([key, value]) => [prefix + key, value])) as
    { [K in keyof T as `${P}${K & string}`]: T[K] };
const agents: Record<AgentStep, { section: string; step: string; role?: KnowledgeRole }> = {
  ...prefixed('part_', part('part-layering')),
  ...prefixed('clothing_', part('clothing-part-layering')),
  ...prefixed('raster_', raster('raster-layering')),
  ...prefixed('clothing_raster_', raster('clothing-raster-layering')),
  part_pose_judgment: { section: 'part-layering', step: 'step03_pose' },
  part_standardize: { section: 'part-layering', step: 'step04_standard' },
  part_simplify: { section: 'part-layering', step: 'step05_simplified' },
  part_base_subject: { section: 'part-layering', step: 'step06_base' },
  clothing_preparation: { section: 'clothing-part-layering', step: 'step01_preparation' },
  raster_step03: { section: 'raster-layering', step: 'step03' },
  assembly: { section: 'character-assembly', step: 'step01' },
  shadow_mask: { section: 'shadow', step: 'step01_mask' },
  shadow_maps: { section: 'shadow', step: 'step01_normal-depth' },
  nine_axis_outline: { section: 'nine-axis', step: 'step02_outline' },
  nine_axis_head: { section: 'nine-axis', step: 'step02_angles' },
  nine_axis_head_y: { section: 'nine-axis', step: 'step02_angles' },
  nine_axis_head_down: { section: 'nine-axis', step: 'step02_angles' },
  nine_axis_head_xy: { section: 'nine-axis', step: 'step03_angle-xy' },
  nine_axis_head_jaw: { section: 'nine-axis', step: 'step04_jaw-line' },
};

export function agentImageGeneration(step: AgentStep): boolean {
  const agent = agents[step];
  if (!agent) throw new Error(`未登记 agent 的先验知识：${step}`);
  return stepKnowledge(agent.section, agent.step).imageGeneration(agent.role ?? 'main');
}
