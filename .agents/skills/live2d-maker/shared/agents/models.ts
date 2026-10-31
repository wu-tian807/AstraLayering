import { readDefaultConfiguration, requiredDefault, type DefaultConfiguration } from '../default-configuration.ts';

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

// Roles and model capabilities are structural; values come from the skill template.
export const modelSlots = [
  'preparation', 'part_draw', 'part_review', 'part_reduce', 'part_completion',
  'part_groups', 'part_depth', 'raster_step01', 'raster_step02', 'raster_step01_review',
  'raster_step03', 'assembly', 'shadow',
] as const;
export type ModelSlot = typeof modelSlots[number];
export function resolveModelDefaults(configuration: DefaultConfiguration): Readonly<Record<ModelSlot, string>> {
  return Object.freeze(Object.fromEntries(modelSlots.map(slot => {
    const key = `layering_agent_${slot}_model`, value = requiredDefault(configuration, key);
    parseAgentModel(value, `example.env:${key}`);
    return [slot, value];
  })) as Record<ModelSlot, string>);
}
export const modelSlotDefaults = resolveModelDefaults(readDefaultConfiguration());

// Keep task identities for prompts, preflight, logs and session recovery.
export const stepModelSlots = {
  part_pose_judgment: 'preparation', part_standardize: 'preparation',
  part_simplify: 'preparation', part_base_subject: 'preparation',
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
  assembly: 'assembly', shadow_mask: 'shadow', shadow_maps: 'shadow', nine_axis_view: 'preparation',
} as const satisfies Record<string, ModelSlot>;
export type AgentStep = keyof typeof stepModelSlots;
export const stepDefaults = Object.fromEntries(Object.entries(stepModelSlots)
  .map(([step, slot]) => [step, modelSlotDefaults[slot]])) as Record<AgentStep, string>;
export const imageSteps: readonly AgentStep[] = [
  'part_standardize', 'part_simplify', 'part_base_subject', 'clothing_preparation',
  'part_completion', 'clothing_completion',
  'raster_step01', 'raster_step02', 'raster_step01_review', 'raster_step01_repair', 'raster_step03',
  'clothing_raster_step01', 'clothing_raster_step02', 'clothing_raster_step01_review', 'clothing_raster_step01_repair',
  'assembly', 'shadow_maps', 'nine_axis_view',
];
export function parseAgentModel(value: string, key: string): AgentModel {
  const match = value.trim().match(/^(.+)-(low|medium|high|xhigh)$/);
  if (!match || !Object.hasOwn(modelHarnesses, match[1])) {
    throw new Error(`${key} 必须为已支持的模型 ID 加思考力度后缀；模型：${Object.keys(modelHarnesses).join(', ')}；力度：${reasoningEfforts.join(', ')}。`);
  }
  const model = match[1] as ModelId;
  return { model, effort: match[2] as ReasoningEffort, harness: modelHarnesses[model] };
}
export function partStep(section: 'part-layering' | 'clothing-part-layering', kind: string): AgentStep {
  const key = `${section === 'part-layering' ? 'part' : 'clothing'}_${kind}`;
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

export function resolveImageDefaults(configuration: DefaultConfiguration) {
  const parse = (value: string, key: string): ImageModel => {
    if (!Object.hasOwn(imageModelProviders, value)) throw new Error(`example.env:${key} 需要选择支持的生图模型`);
    return value as ImageModel;
  };
  const model = parse(requiredDefault(configuration, 'layering_default_image_model'), 'layering_default_image_model');
  const legacy = parse(requiredDefault(configuration, 'layering_image_model'), 'layering_image_model');
  const steps = Object.fromEntries(imageSteps.map(step => {
    const key = `layering_${step}_image_model`, value = configuration[key]?.trim();
    return [step, value ? parse(value, key) : model];
  })) as Record<AgentStep, ImageModel>;
  return { model, legacy, steps };
}
