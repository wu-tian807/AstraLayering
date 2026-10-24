export const modelHarnesses = {
  'gpt-6.1-sol': 'codex',
  'gpt-6-astra': 'codex',
  'claude-sonnet-5-5': 'claude',
  'claude-opus-5-5': 'claude',
  'claude-haiku-5-5': 'claude',
  'gemini-4-argon': 'agv',
} as const;
export type Harness = typeof modelHarnesses[keyof typeof modelHarnesses];
export type ModelId = keyof typeof modelHarnesses;
export const reasoningEfforts = ['low', 'medium', 'high', 'xhigh'] as const;
export type ReasoningEffort = typeof reasoningEfforts[number];
export type AgentModel = { model: ModelId; effort: ReasoningEffort; harness: Harness };

const medium = 'gpt-6.1-sol-medium', high = 'gpt-6.1-sol-high', xhigh = 'gpt-6.1-sol-xhigh';
// User-facing model settings describe roles shared by character and clothing pipelines.
export const modelSlotDefaults = {
  preparation: 'gpt-6.1-sol-low',
  part_draw: medium, part_review: medium, part_reduce: high, part_completion: high,
  part_groups: high, part_depth: high,
  raster_step01: xhigh, raster_step02: medium, raster_step01_review: xhigh,
  raster_step03: medium,
  assembly: xhigh, shadow: medium, physics_analysis: high, physics_authoring: xhigh, physics_review: xhigh,
} as const;
export type ModelSlot = keyof typeof modelSlotDefaults;

// Keep task identities for prompts, preflight, logs and session recovery.
export const stepModelSlots = {
  part_pose_judgment: 'preparation', part_standardize: 'preparation',
  part_reference_judgment: 'preparation', part_simplify: 'preparation', part_base_subject: 'preparation',
  part_initial_groups: 'part_groups', part_outline: 'part_draw', part_outline_review: 'part_review',
  part_outline_repair: 'part_draw', part_reduce: 'part_reduce', part_completion: 'part_completion',
  part_children: 'part_groups', part_occlusion: 'part_depth',
  clothing_preparation: 'preparation', clothing_initial_groups: 'part_groups',
  clothing_outline: 'part_draw', clothing_outline_review: 'part_review', clothing_outline_repair: 'part_draw',
  clothing_reduce: 'part_reduce', clothing_completion: 'part_completion', clothing_children: 'part_groups', clothing_occlusion: 'part_depth',
  raster_step01: 'raster_step01', raster_step02: 'raster_step02', raster_step01_review: 'raster_step01_review', raster_step01_repair: 'raster_step01',
  raster_step03: 'raster_step03',
  clothing_raster_step01: 'raster_step01', clothing_raster_step02: 'raster_step02',
  clothing_raster_step01_review: 'raster_step01_review', clothing_raster_step01_repair: 'raster_step01',
  assembly: 'assembly', shadow_mask: 'shadow', shadow_maps: 'shadow', physics_analysis: 'physics_analysis', physics_authoring: 'physics_authoring', physics_review: 'physics_review',
} as const satisfies Record<string, ModelSlot>;
export type AgentStep = keyof typeof stepModelSlots;
export const stepDefaults = Object.fromEntries(Object.entries(stepModelSlots)
  .map(([step, slot]) => [step, modelSlotDefaults[slot]])) as Record<AgentStep, string>;
export const imageSteps: readonly AgentStep[] = [
  'part_standardize', 'part_simplify', 'part_base_subject', 'clothing_preparation',
  'part_completion', 'clothing_completion',
  'raster_step01', 'raster_step02', 'raster_step01_review', 'raster_step01_repair', 'raster_step03',
  'clothing_raster_step01', 'clothing_raster_step02', 'clothing_raster_step01_review', 'clothing_raster_step01_repair',
  'assembly', 'shadow_maps',
];
export function parseAgentModel(value: string, key: string): AgentModel {
  const match = value.trim().match(/^(.+)-(low|medium|high|xhigh)$/);
  if (!match || !Object.hasOwn(modelHarnesses, match[1])) {
    throw new Error(`${key} 必须为已支持的模型 ID 加思考力度后缀；模型：${Object.keys(modelHarnesses).join(', ')}；力度：${reasoningEfforts.join(', ')}。`);
  }
  const model = match[1] as ModelId;
  return { model, effort: match[2] as ReasoningEffort, harness: modelHarnesses[model] };
}
export function partStep(pipeline: 'part-layering' | 'clothing-part-layering', kind: string): AgentStep {
  const key = `${pipeline === 'part-layering' ? 'part' : 'clothing'}_${kind}`;
  if (!Object.hasOwn(stepDefaults, key)) throw new Error(`未知 agent 小步骤：${key}`);
  return key as AgentStep;
}

export const imageModelProviders = {
  'codex-native': 'codex',
  'gpt-image-2.5-sunburst': 'openai',
  'gpt-image-2.5-flare': 'openai',
  'gemini-nano-banana-2.1': 'google',
} as const;
export type ImageModel = keyof typeof imageModelProviders;
export type ImageApi = { baseUrl: string; apiKey: string; protocol: 'openai' | 'gemini' };
