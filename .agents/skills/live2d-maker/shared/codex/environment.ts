import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import type { CodexOptions, ThreadOptions } from '@openai/codex-sdk';
import { workflowsDirectory } from '../paths.ts';
import { readDefaultConfiguration } from '../default-configuration.ts';
import { kritaLimit, kritaLimitKey } from '../krita/section-krita.ts';
import { withNodePath } from '../process-environment.ts';
import { imageBudget, type ImageBudget } from '../../patches/shared/visual-context.ts';
import { configurationSources } from '../configuration-sources.ts';
import { resolveModelDefaults, modelSlotKey, legacyModelSlotKey, defaultImageModelKey, legacyDefaultImageModelKey, imageModelKey, legacyImageModelKey, resolveImageDefaults, stepModelSlots, imageSteps, imageProvider, imageModelRules, type ImageModelRules, parseAgentModel, type ModelSlot, type AgentModel, type AgentStep, type Harness, type ImageModel, type ImageApi } from '../agents/models.ts';
import { resolveHarnessProviders, validateApiUrl, type HarnessProviders } from '../agents/providers.ts';
import { videoModel, videoProvider, type VideoApi } from '../video.ts';
export type { VideoApi } from '../video.ts';
export { validateApiUrl } from '../agents/providers.ts';

export type ModelTier = 'medium' | 'high';
export type ModelSelection = { model: string; effort: NonNullable<ThreadOptions['modelReasoningEffort']> };
function tierDefaults(roles: ReturnType<typeof resolveModelDefaults>): Record<ModelTier, ModelSelection> {
  const selection = (value: string): ModelSelection => {
    const index=value.lastIndexOf('-');
    return {model:value.slice(0,index),effort:value.slice(index+1) as ModelSelection['effort']};
  };
  return { medium: selection(roles.part_draw), high: selection(roles.raster_step01) };
}

// Legacy tier overrides retain their historical roles when the default model changes.
const legacyHighModelSlots: readonly ModelSlot[] = ['raster_step01', 'raster_step02', 'raster_step01_review'];

export type WorkflowEnvironment = {
  models: Record<ModelTier, ModelSelection>;
  stepModels: Record<AgentStep, AgentModel>;
  stepImages: Partial<Record<AgentStep, ImageModel>>;
  imageApis: Partial<Record<'openai' | 'google', ImageApi>>;
  imageRules?: ImageModelRules;
  // The video API of the nine-axis turn; without it that step cannot run.
  videoApi?: VideoApi;
  cliPaths: Partial<Record<Harness, string>>;
  codex: CodexOptions;
  imageCompactThreshold?: number;
  imageBudgets?: Record<Harness, ImageBudget>;
  providers?: HarnessProviders;
};


export function parseModel(value: string | undefined, fallback: ModelSelection, name: string): ModelSelection {
  if (!value?.trim()) return { ...fallback };
  const match = value.trim().match(/^(.+)-(none|minimal|low|medium|high|xhigh)$/);
  if (!match || /\s/.test(match[1])) throw new Error(`${name} 必须为 <模型 ID>-<思考力度>，例如 gpt-6.1-sol-medium。`);
  return { model: match[1], effort: match[2] as ModelSelection['effort'] };
}

// Never change process.env or ~/.codex. The captured environment belongs to this invocation.
// Nonempty .env values override the startup environment; relative paths are based on live2d-maker.
export function loadWorkflowEnvironment(env: NodeJS.ProcessEnv = process.env, directory = workflowsDirectory): WorkflowEnvironment {
  let source = '';
  try { source = readFileSync(join(directory, '.env'), 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('无法读取 live2d-maker/.env', { cause: error }); }
  return parseWorkflowEnvironment(source, env, directory);
}

// The workbench validates drafts with exactly the same resolver as new workers.
export function parseWorkflowEnvironment(source: string, shell: NodeJS.ProcessEnv = process.env,
  directory = workflowsDirectory): WorkflowEnvironment {
  const sources = configurationSources(parseEnv(source),shell),env=sources.environment;
  const defaults = readDefaultConfiguration(directory);
  const roleDefaults = resolveModelDefaults(defaults), imageDefaults = resolveImageDefaults(defaults);
  const tiers = tierDefaults(roleDefaults);
  const file = sources.file;
  const runtimeDefaults=Object.fromEntries(Object.entries(defaults).filter(([key])=>!key.endsWith('_agent_model')&&!key.endsWith('_image_model')&&key!=='image_model'));
  const effective = Object.fromEntries(Object.entries(configurationSources(file,env,runtimeDefaults).effective).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete effective.codex_path;
  delete effective.layering_codex_path;
  const get = (name: string) => effective[name]?.trim();
  const selected=(name:string)=>sources.effective[name]?.trim();
  const flag = get('custom_provider');
  if (flag && !['true', 'false', '1', '0'].includes(flag)) throw new Error('custom_provider 只能为 true 或 false。');
  if (get('agv_patch')) throw new Error('agv_patch 已改名为 agv_unlimited_response_header_timeout，请在 .env 中改用新名称。');
  const agvPatch = get('agv_unlimited_response_header_timeout');
  if (agvPatch && !['true', 'false'].includes(agvPatch)) throw new Error('agv_unlimited_response_header_timeout 只能为 true 或 false。');
  if (agvPatch) effective.agv_unlimited_response_header_timeout = agvPatch;
  // Normalized here so a bad value fails before any section starts.
  effective[kritaLimitKey] = String(kritaLimit(effective, defaults));
  const config: NonNullable<CodexOptions['config']> = {};
  const providers = resolveHarnessProviders(file, env, effective, flag === 'true' || flag === '1',runtimeDefaults);
  const unifiedCodex = providers.codex.connection === 'unified';
  if (unifiedCodex || flag === 'true' || flag === '1') {
    config.model_provider = 'custom';
    config.model_providers = { custom: {
      name: 'Custom provider', base_url: providers.codex.baseUrl!, env_key: unifiedCodex ? 'codex_api_key' : 'provider_api_key',
      wire_api: 'responses', requires_openai_auth: false,
    } };
  }
  const path = (value: string) => isAbsolute(value) ? value : resolve(directory, value);
  const home = get('codex_home');
  if (home) effective.CODEX_HOME = path(home);
  const imageUrl = get('image_base_url'), imageKey = get('image_api_key');
  const imageModel = get('image_model') || imageDefaults.legacy;
  if (imageUrl || imageKey) {
    if (!imageUrl || !imageKey) throw new Error('自定义生图需要同时填写 image_base_url 和 image_api_key。');
    validateApiUrl(imageUrl, 'image_base_url');
  }
  // The old image keys feed the same per-step API settings below. Only the
  // request's native route may set extension variables in a Codex child.
  for (const key of ['LAYERING_IMAGE_BASE_URL', 'LAYERING_IMAGE_API_KEY', 'LAYERING_IMAGE_MODEL', 'LAYERING_IMAGE_OUTPUT_DIR']) delete effective[key];
  const imageBudgets = Object.fromEntries((['codex', 'claude', 'agv'] as const).map(harness => [harness, imageBudget(effective, harness)])) as Record<Harness, ImageBudget>;
  const threshold = imageBudgets.codex.images;
  if (threshold !== undefined) effective.LAYERING_IMAGE_COMPACT_THRESHOLD = String(threshold);
  else delete effective.LAYERING_IMAGE_COMPACT_THRESHOLD;
  if (imageBudgets.codex.bytes) effective.LAYERING_REQUEST_COMPACT_BYTES = String(imageBudgets.codex.bytes);
  else delete effective.LAYERING_REQUEST_COMPACT_BYTES;
  const slotModels = {} as Record<ModelSlot, AgentModel>;
  for (const [slot, fallback] of Object.entries(roleDefaults) as [ModelSlot, string][]) {
    const key = modelSlotKey(slot);
    let selection: string | undefined = sources.select([key,legacyModelSlotKey(slot)])?.value;
    if (!selection) {
      // An old per-step file can be reused when its values agree for this role.
      // Never silently choose between differing character/clothing or draw/repair settings.
      const previous = Object.entries(stepModelSlots).filter(([, role]) => role === slot)
        .map(([step]) => `layering_${step}_model`).filter(name => selected(name));
      const values = new Set(previous.map(name => {
        const parsed = parseAgentModel(selected(name)!, name,providers);
        return `${parsed.model}-${parsed.effort}`;
      }));
      if (values.size > 1) throw new Error(`旧模型配置 ${previous.join('、')} 不一致；请设置统一的 ${key}。原 .env 不会自动改写。`);
      selection = values.values().next().value;
    }
    const tier = selected(legacyHighModelSlots.includes(slot) ? 'high_model' : 'medium_model');
    slotModels[slot] = parseAgentModel(selection || tier || fallback, key,providers);
  }
  const stepModels = Object.fromEntries(Object.entries(stepModelSlots)
    .map(([step, slot]) => [step, { ...slotModels[slot] }])) as WorkflowEnvironment['stepModels'];
  const imageRules=imageModelRules(defaults,sources.effective);
  const imageApis: WorkflowEnvironment['imageApis'] = {};
  for (const provider of ['openai', 'google'] as const) {
    const baseUrl = get(`${provider}_image_base_url`) || (provider === 'openai' ? imageUrl : undefined);
    const apiKey = get(`${provider}_image_api_key`) || (provider === 'openai' ? imageKey : undefined);
    const protocol = provider === 'google' ? get('google_image_protocol') || defaults.google_image_protocol : 'openai';
    if (!['openai', 'gemini'].includes(protocol)) throw new Error('google_image_protocol 无效。');
    if (baseUrl || apiKey) {
      if (!baseUrl || !apiKey) throw new Error(`${provider} 生图需要同时填写 ${provider}_image_base_url 和 ${provider}_image_api_key。`);
      validateApiUrl(baseUrl, `${provider}_image_base_url`);
      imageApis[provider] = { baseUrl, apiKey, provider, protocol: protocol as ImageApi['protocol'] };
    }
  }
  // The video service has its own keys; the image services are never used for it.
  const selectedVideoProvider=videoProvider(get('video_provider')!), selectedVideoModel=videoModel(get('nine_axis_view_video_model')!);
  const videoUrl = get('video_base_url'), videoKey = get('video_api_key');
  let videoApi: VideoApi | undefined;
  if (videoUrl || videoKey) {
    if (!videoUrl || !videoKey) throw new Error('生视频需要同时填写 video_base_url 和 video_api_key。');
    validateApiUrl(videoUrl, 'video_base_url');
    videoApi = { provider:selectedVideoProvider,baseUrl: videoUrl, apiKey: videoKey, model:selectedVideoModel };
  }
  const stepImages: WorkflowEnvironment['stepImages'] = {};
  const defaultImage = sources.select([defaultImageModelKey,legacyDefaultImageModelKey])?.value;
  const fallbackImage = defaultImage || (imageUrl ? imageModel : imageDefaults.model);
  for (const step of imageSteps()) {
    const key = imageModelKey(step), legacy = legacyImageModelKey(step);
    // Empty values allow fallback. A configured global model overrides template step defaults.
    const value = sources.select([key,legacy])?.value || (defaultImage || imageUrl
      ? fallbackImage : imageDefaults.steps[step]);
    imageProvider(value,imageRules);
    stepImages[step] = value as ImageModel;
  }
  const cliPaths: WorkflowEnvironment['cliPaths'] = {};
  for (const harness of ['claude', 'agv'] as const) {
    const value = get(`${harness}_path`);
    if (value) cliPaths[harness] = path(value);
  }
  return {
    stepModels, stepImages, imageApis, imageRules, cliPaths, imageBudgets, providers, ...(videoApi ? { videoApi } : {}),
    models: {
      medium: parseModel(get('medium_model'), tiers.medium, 'medium_model'),
      high: parseModel(get('high_model'), tiers.high, 'high_model'),
    },
    codex: { env: effective, config },
    ...(threshold === undefined ? {} : { imageCompactThreshold: threshold }),
  };
}

const checkedCapabilities = new Map<string, Promise<void>>();
export async function checkCodexCapabilities(settings: WorkflowEnvironment, options = settings.codex,
  needs: { image?: boolean; progress?: (message: string) => void; building?: () => void } = {},
  prepare = async () => (await import('../../patches/codex/build.ts')).ensurePatchedCodex({ env: options.env, progress: needs.progress, building: needs.building })): Promise<void> {
  const needsBytes = settings.imageBudgets?.codex.bytes !== undefined;
  // Every Codex run needs the patched build: it reads the failure detail LiteLLM
  // sends after an empty response.failed, so blocked input is reported, not retried.
  const executable = options.codexPathOverride ?? settings.codex.codexPathOverride ?? await prepare();
  const needsVisualCompaction = settings.imageCompactThreshold !== undefined || needsBytes;
  const cacheKey = `${executable}\0${needs.image ? 'image-provider-v2' : ''}\0${needsVisualCompaction ? 'visual-compaction-v2' : ''}\0${needsBytes ? 'request-compaction-v1' : ''}`;
  let check = checkedCapabilities.get(cacheKey);
  if (!check) {
    check = (async () => {
      try {
        const { stdout } = await promisify(execFile)(executable, ['debug', 'layering-capabilities'],
          { env: options.env, timeout: 10_000, maxBuffer: 64 * 1024 });
        const value = JSON.parse(stdout);
        if (value.version !== 1 || value.failed_error_event_version !== 1) throw new Error('unsupported');
        if (needs.image && (value.image_provider !== true || value.image_provider_version !== 2)) throw new Error('native image provider v2 required');
        if (needsVisualCompaction && (value.image_compaction !== true || value.image_compaction_version !== 2)) {
          throw new Error('visual compaction v2 required');
        }
        if (needsBytes && value.request_compaction_version !== 1) throw new Error('request compaction v1 required');
      } catch { throw new Error('管线 Codex 未通过 Layering 补丁能力检查，请检查补丁构建日志。'); }
    })();
    checkedCapabilities.set(cacheKey, check);
    void check.catch(() => checkedCapabilities.delete(cacheKey));
  }
  await check;
  options.codexPathOverride = executable;
  settings.codex.codexPathOverride = executable;
}

export function workflowCodexOptions(settings: WorkflowEnvironment, overrides: CodexOptions = {}): CodexOptions {
  return { ...settings.codex, ...overrides,
    env: withNodePath({ ...settings.codex.env, ...overrides.env }),
    config: { ...settings.codex.config, ...overrides.config },
  };
}
