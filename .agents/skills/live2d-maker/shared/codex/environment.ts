import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import type { CodexOptions, ThreadOptions } from '@openai/codex-sdk';
import { workflowsDirectory } from '../paths.ts';
import { readDefaultConfiguration, requiredDefault } from '../default-configuration.ts';
import { kritaLimit, kritaLimitKey } from '../krita/section-krita.ts';
import { withNodePath } from '../process-environment.ts';
import { imageBudget, type ImageBudget } from '../../patches/shared/visual-context.ts';
import { withLegacyKeys } from '../legacy-keys.ts';
import { resolveModelDefaults, modelSlotKey, legacyModelSlotKey, defaultImageModelKey, legacyDefaultImageModelKey, imageModelKey, legacyImageModelKey, resolveImageDefaults, stepModelSlots, imageSteps, imageModelProviders, parseAgentModel, type ModelSlot, type AgentModel, type AgentStep, type Harness, type ImageModel, type ImageApi } from '../agents/models.ts';
import { resolveHarnessProviders, validateApiUrl, type HarnessProviders } from '../agents/providers.ts';
import { videoModel } from '../video.ts';
export { validateApiUrl } from '../agents/providers.ts';

export type ModelTier = 'medium' | 'high';
export type ModelSelection = { model: string; effort: NonNullable<ThreadOptions['modelReasoningEffort']> };
function tierDefaults(roles: ReturnType<typeof resolveModelDefaults>): Record<ModelTier, ModelSelection> {
  const selection = (value: string): ModelSelection => {
    const { model, effort } = parseAgentModel(value, 'example.env');
    return { model, effort };
  };
  return { medium: selection(roles.part_draw), high: selection(roles.raster_step01) };
}
export const defaultModels = tierDefaults(resolveModelDefaults(readDefaultConfiguration()));

// Legacy tier overrides retain their historical roles when the default model changes.
const legacyHighModelSlots: readonly ModelSlot[] = ['raster_step01', 'raster_step02', 'raster_step01_review'];

export type WorkflowEnvironment = {
  models: Record<ModelTier, ModelSelection>;
  stepModels: Record<AgentStep, AgentModel>;
  stepImages: Partial<Record<AgentStep, ImageModel>>;
  imageApis: Partial<Record<'openai' | 'google', ImageApi>>;
  // The video API of the nine-axis turn; without it that step cannot run.
  videoApi?: VideoApi;
  cliPaths: Partial<Record<Harness, string>>;
  codex: CodexOptions;
  imageCompactThreshold?: number;
  imageBudgets?: Record<Harness, ImageBudget>;
  providers?: HarnessProviders;
};

export type VideoApi = { baseUrl: string; apiKey: string; model: string };

export function parseModel(value: string | undefined, fallback: ModelSelection, name: string): ModelSelection {
  if (!value?.trim()) return { ...fallback };
  const match = value.trim().match(/^(.+)-(none|minimal|low|medium|high|xhigh)$/);
  if (!match || /\s/.test(match[1])) throw new Error(`${name} 必须为 <模型 ID>-<思考力度>，例如 gpt-6.1-sol-medium。`);
  return { model: match[1], effort: match[2] as ModelSelection['effort'] };
}

// Never change process.env or ~/.codex. The captured environment belongs to this invocation.
// Shell variables override .env; relative configuration paths are based on live2d-maker.
export function loadWorkflowEnvironment(env: NodeJS.ProcessEnv = process.env, directory = workflowsDirectory): WorkflowEnvironment {
  let source = '';
  try { source = readFileSync(join(directory, '.env'), 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('无法读取 live2d-maker/.env', { cause: error }); }
  return parseWorkflowEnvironment(source, env, directory);
}

// The workbench validates drafts with exactly the same resolver as new workers.
export function parseWorkflowEnvironment(source: string, shell: NodeJS.ProcessEnv = process.env,
  directory = workflowsDirectory): WorkflowEnvironment {
  const env = withLegacyKeys(shell);
  const defaults = readDefaultConfiguration(directory);
  const roleDefaults = resolveModelDefaults(defaults), imageDefaults = resolveImageDefaults(defaults);
  const tiers = tierDefaults(roleDefaults);
  const file = withLegacyKeys(parseEnv(source));
  const effective = Object.fromEntries(Object.entries({ ...file, ...env }).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const get = (name: string) => effective[name]?.trim();
  const flag = get('custom_provider');
  if (flag && !['true', 'false', '1', '0'].includes(flag)) throw new Error('custom_provider 只能为 true 或 false。');
  if (get('agv_patch')) throw new Error('agv_patch 已改名为 agv_unlimited_response_header_timeout，请在 .env 中改用新名称。');
  const agvPatch = get('agv_unlimited_response_header_timeout');
  if (agvPatch && !['true', 'false'].includes(agvPatch)) throw new Error('agv_unlimited_response_header_timeout 只能为 true 或 false。');
  if (agvPatch) effective.agv_unlimited_response_header_timeout = agvPatch;
  // Normalized here so a bad value fails before any section starts.
  effective[kritaLimitKey] = String(kritaLimit(effective, defaults));
  const config: NonNullable<CodexOptions['config']> = {};
  const providers = resolveHarnessProviders(file, env, effective, flag === 'true' || flag === '1');
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
  const executable = get('codex_path');
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
    let selection: string | undefined = get(key) || get(legacyModelSlotKey(slot));
    if (!selection) {
      // An old per-step file can be reused when its values agree for this role.
      // Never silently choose between differing character/clothing or draw/repair settings.
      const previous = Object.entries(stepModelSlots).filter(([, role]) => role === slot)
        .map(([step]) => `layering_${step}_model`).filter(name => get(name));
      const values = new Set(previous.map(name => {
        const parsed = parseAgentModel(get(name)!, name);
        return `${parsed.model}-${parsed.effort}`;
      }));
      if (values.size > 1) throw new Error(`旧模型配置 ${previous.join('、')} 不一致；请设置统一的 ${key}。原 .env 不会自动改写。`);
      selection = values.values().next().value;
    }
    const tier = get(legacyHighModelSlots.includes(slot) ? 'high_model' : 'medium_model');
    slotModels[slot] = parseAgentModel(selection || tier || fallback, key);
  }
  const stepModels = Object.fromEntries(Object.entries(stepModelSlots)
    .map(([step, slot]) => [step, { ...slotModels[slot] }])) as WorkflowEnvironment['stepModels'];
  const imageApis: WorkflowEnvironment['imageApis'] = {};
  for (const provider of ['openai', 'google'] as const) {
    const baseUrl = get(`${provider}_image_base_url`) || (provider === 'openai' ? imageUrl : undefined);
    const apiKey = get(`${provider}_image_api_key`) || (provider === 'openai' ? imageKey : undefined);
    const protocol = provider === 'google' ? get('google_image_protocol') || defaults.google_image_protocol : 'openai';
    if (!['openai', 'gemini'].includes(protocol)) throw new Error('google_image_protocol 无效。');
    if (baseUrl || apiKey) {
      if (!baseUrl || !apiKey) throw new Error(`${provider} 生图需要同时填写 ${provider}_image_base_url 和 ${provider}_image_api_key。`);
      validateApiUrl(baseUrl, `${provider}_image_base_url`);
      imageApis[provider] = { baseUrl, apiKey, protocol: protocol as ImageApi['protocol'] };
    }
  }
  // The video service has its own keys; the image services are never used for it.
  const videoUrl = get('video_base_url'), videoKey = get('video_api_key');
  let videoApi: VideoApi | undefined;
  if (videoUrl || videoKey) {
    if (!videoUrl || !videoKey) throw new Error('生视频需要同时填写 video_base_url 和 video_api_key。');
    validateApiUrl(videoUrl, 'video_base_url');
    videoApi = { baseUrl: videoUrl, apiKey: videoKey, model: videoModel(get('nine_axis_view_video_model') || requiredDefault(defaults, 'nine_axis_view_video_model')) };
  }
  const stepImages: WorkflowEnvironment['stepImages'] = {};
  const defaultImage = get(defaultImageModelKey) || get(legacyDefaultImageModelKey);
  const fallbackImage = defaultImage || (imageUrl ? imageModel : imageDefaults.model);
  for (const step of imageSteps()) {
    const key = imageModelKey(step), legacy = legacyImageModelKey(step);
    // Explicit blank means inherit the chosen global model. Missing keys may
    // inherit a step-specific template default, while legacy image routes stay intact.
    const value = get(key) || get(legacy) || (Object.hasOwn(effective, key) || Object.hasOwn(effective, legacy) || defaultImage || imageUrl
      ? fallbackImage : imageDefaults.steps[step]);
    if (!Object.hasOwn(imageModelProviders, value)) throw new Error(`${key} 必须为 ${Object.keys(imageModelProviders).join(', ')}。`);
    stepImages[step] = value as ImageModel;
  }
  const cliPaths: WorkflowEnvironment['cliPaths'] = {};
  for (const harness of ['claude', 'agv'] as const) {
    const value = get(`${harness}_path`);
    if (value) cliPaths[harness] = path(value);
  }
  if (executable) cliPaths.codex = path(executable);
  return {
    stepModels, stepImages, imageApis, cliPaths, imageBudgets, providers, ...(videoApi ? { videoApi } : {}),
    models: {
      medium: parseModel(get('medium_model'), tiers.medium, 'medium_model'),
      high: parseModel(get('high_model'), tiers.high, 'high_model'),
    },
    codex: { env: effective, config, ...(executable ? { codexPathOverride: path(executable) } : {}) },
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
  const instruction = 'codex_path 显式指定的入口必须具备对应能力；清空此项即自动构建补丁版 Codex。';
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
      } catch { throw new Error(`配置的 Codex 未通过 Layering 补丁能力检查。${instruction}`); }
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
