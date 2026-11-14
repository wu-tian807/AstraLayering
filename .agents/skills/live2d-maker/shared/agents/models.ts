import { requiredDefault, type DefaultConfiguration } from '../default-configuration.ts';
import { agentImageGeneration } from '../agent-knowledge.ts';
import { defaultKnowledgeDirectory } from '../knowledge.ts';
import { matchModelService, parseModelPatterns } from './model-patterns.ts';

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
export type AgentModel = { model: string; effort: ReasoningEffort; harness: Harness };
type ModelCatalog=Partial<Record<Harness,{models?:readonly string[]}>>;
export function modelHarness(model:string,catalog:ModelCatalog={},key='模型'):Harness {
  const selected=matchModelService<Harness>(model,Object.fromEntries(Object.entries(catalog).map(([h,provider])=>[h,provider?.models])),key);
  if(selected)return selected;
  if(Object.hasOwn(modelHarnesses,model))return modelHarnesses[model as ModelId];
  throw new Error(`${key} 的自定义模型 ${model} 需先加入对应的 codex_models、claude_models 或 agv_models。内置模型：${Object.keys(modelHarnesses).join('、')}。`);
}

// Roles and model capabilities are structural; values come from the skill template.
export const modelSlots = [
  'preparation', 'part_draw', 'part_review', 'part_reduce', 'part_completion',
  'part_groups', 'part_depth', 'raster_step01', 'raster_step02', 'raster_step01_review',
  'raster_step03', 'assembly', 'shadow', 'nine_axis_head',
] as const;
export type ModelSlot = typeof modelSlots[number];
export const modelSlotKey = (slot: ModelSlot) => `${slot}_agent_model`;
export const isModelSlotKey = (key: string) => modelSlots.some(slot => modelSlotKey(slot) === key);
export const defaultImageModelKey = 'default_image_model';
export const imageModelKey = (step: string) => `${step}_image_model`;
export function resolveModelDefaults(configuration: DefaultConfiguration): Readonly<Record<ModelSlot, string>> {
  const catalog=Object.fromEntries((['codex','claude','agv'] as const).map(h=>[h,{models:parseModelPatterns(configuration[`${h}_models`]||'',`example.env:${h}_models`)}]));
  return Object.freeze(Object.fromEntries(modelSlots.map(slot => {
    const key = modelSlotKey(slot), value = requiredDefault(configuration, key);
    parseAgentModel(value, `example.env:${key}`,catalog);
    return [slot, value];
  })) as Record<ModelSlot, string>);
}

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
  assembly: 'assembly', shadow_mask: 'shadow', shadow_maps: 'shadow', nine_axis_view_frames: 'nine_axis_head', nine_axis_outline: 'nine_axis_head',
  nine_axis_head: 'nine_axis_head', nine_axis_head_y: 'nine_axis_head', nine_axis_head_down: 'nine_axis_head', nine_axis_frames: 'nine_axis_head', nine_axis_head_xy: 'nine_axis_head', nine_axis_head_jaw: 'nine_axis_head',
  nine_axis_head_hair: 'nine_axis_head',
  nine_axis_head_accessories: 'nine_axis_head',
} as const satisfies Record<string, ModelSlot>;
export type AgentStep = keyof typeof stepModelSlots;
export const imageSteps = (): AgentStep[] => (Object.keys(stepModelSlots) as AgentStep[]).filter(step => agentImageGeneration(step));
export function parseAgentModel(value: string, key: string, catalog:ModelCatalog={}): AgentModel {
  const match = value.trim().match(/^(.+)-(low|medium|high|xhigh)$/);
  if (!match || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(match[1])) {
    throw new Error(`${key} 必须为已支持的模型 ID 加思考力度后缀；模型：${Object.keys(modelHarnesses).join(', ')}；力度：${reasoningEfforts.join(', ')}。`);
  }
  const model = match[1];
  return { model, effort: match[2] as ReasoningEffort, harness:modelHarness(model,catalog,key) };
}
export function partStep(section: 'part-layering' | 'clothing-part-layering', kind: string): AgentStep {
  const key = `${section === 'part-layering' ? 'part' : 'clothing'}_${kind}`;
  if (!Object.hasOwn(stepModelSlots, key)) throw new Error(`未知 agent 小步骤：${key}`);
  return key as AgentStep;
}

export const imageModelProviders = {
  'codex-native': 'codex',
  'gpt-image-2.5-sunburst': 'openai',
  'gpt-image-2.5-flare': 'openai',
  'gpt-image-2.6-sunburst': 'openai',
  'gpt-image-2.6-flare': 'openai',
  'gemini-nano-banana-2.1': 'google',
} as const;
export type ImageModel = string;
export type ImageProvider = typeof imageModelProviders[keyof typeof imageModelProviders];
export type ImageModelRules = Record<'openai'|'google',string[]>;
export function imageModelRules(defaults:Readonly<Record<string,string>>,configured:NodeJS.ProcessEnv={}):ImageModelRules {
  return Object.fromEntries(['openai','google'].map(provider=>{const key=`${provider}_image_models`;return [provider,[...new Set([...parseModelPatterns(defaults[key]||'',key),...parseModelPatterns(configured[key]||'',key)])]];})) as ImageModelRules;
}
export function imageProvider(model:string,rules?:ImageModelRules):ImageProvider {
  if(model==='codex-native')return 'codex';
  const selected=rules&&matchModelService<'openai'|'google'>(model,rules,'生图');
  if(selected)return selected;
  if(Object.hasOwn(imageModelProviders,model))return imageModelProviders[model as keyof typeof imageModelProviders];
  throw new Error(`自定义生图模型 ${model} 需匹配 GPT 或 Nano 服务的自定义模型列表（openai_image_models / google_image_models）。`);
}
export type ImageApi = { baseUrl: string; apiKey: string; protocol: 'openai' | 'gemini'; provider?:'openai'|'google' };

export function resolveImageDefaults(configuration: DefaultConfiguration) {
  const rules=imageModelRules(configuration);
  const parse = (value: string, key: string): ImageModel => {
    try { imageProvider(value,rules); } catch(error) { throw new Error(`example.env:${key} 需要选择支持的生图模型：${String(error)}`); }
    return value;
  };
  const model = parse(requiredDefault(configuration, defaultImageModelKey), defaultImageModelKey);
  const legacy = parse(requiredDefault(configuration, 'image_model'), 'image_model');
  for(const step of Object.keys(stepModelSlots) as AgentStep[]) {
    const key=imageModelKey(step);
    if(agentImageGeneration(step,defaultKnowledgeDirectory)&&!Object.hasOwn(configuration,key))throw new Error(`live2d-maker/example.env 缺少配置字段：${key}`);
  }
  const steps = Object.fromEntries(imageSteps().map(step => {
    const key = imageModelKey(step);
    const value = configuration[key]?.trim();
    return [step, value ? parse(value, key) : model];
  })) as Record<AgentStep, ImageModel>;
  return { model, legacy, steps };
}
