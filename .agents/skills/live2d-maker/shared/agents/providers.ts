import type { Harness } from './models.ts';

export type HarnessProvider = {
  connection: 'unified' | 'legacy' | 'inherited';
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  protocol?: 'responses' | 'anthropic' | 'genai' | 'openai';
  sources: Partial<Record<'apiKey' | 'baseUrl' | 'models' | 'protocol', string>>;
};
export type HarnessProviders = Record<Harness, HarnessProvider>;

const agvProtocols = ['genai', 'openai'] as const;
const aliases = {
  codex: { api_key: ['provider_api_key'], base_url: ['provider_base_url'], models: [], protocol: [] },
  claude: { api_key: ['ANTHROPIC_API_KEY'], base_url: ['ANTHROPIC_BASE_URL'], models: [], protocol: [] },
  agv: { api_key: ['AGY_LLM_GATEWAY_API_KEY'], base_url: ['AGY_LLM_GATEWAY_URL'],
    models: ['AGY_LLM_GATEWAY_MODELS'], protocol: ['AGY_LLM_GATEWAY_WIRE_PROTOCOL'] },
} as const;

export function validateApiUrl(value: string, name: string): void {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} 必须为完整的 HTTP(S) API 地址。`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new Error(`${name} 必须为不含凭据、查询参数或片段的 HTTP(S) API 地址。`);
  }
}

export function parseProviderModels(value: string, name: string): string[] {
  const models = value.split(',').map(model => model.trim());
  if (models.some(model => !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(model))) {
    throw new Error(`${name} 须为逗号分隔的模型 ID，例如 gpt-6.1-sol,gpt-6-astra；不使用 JSON 或空项目。`);
  }
  return [...new Set(models)];
}

// Shell settings win even when they use an old spelling. Within one source,
// unified keys win over aliases. An empty shell value disables that file key.
export function resolveHarnessProviders(file: NodeJS.ProcessEnv, shell: NodeJS.ProcessEnv,
  effective: Record<string, string>, legacyCodex: boolean): HarnessProviders {
  const remainingFile = Object.fromEntries(Object.entries(file).filter(([key]) => shell[key] === undefined));
  const read = (name: string, old: readonly string[]) => {
    for (const source of [shell, remainingFile]) for (const key of [name, ...old]) {
      const value = source[key]?.trim();
      if (value) return { value, key };
    }
    return undefined;
  };
  const providers = {} as HarnessProviders;
  for (const harness of ['codex', 'claude', 'agv'] as const) {
    const prefix = `${harness}_`;
    const unifiedConnection = !!effective[`${prefix}api_key`]?.trim() || !!effective[`${prefix}base_url`]?.trim();
    const old = harness === 'codex' && !legacyCodex && !unifiedConnection
      ? { api_key: [], base_url: [], models: [], protocol: [] } : aliases[harness];
    const key = read(`${prefix}api_key`, old.api_key), url = read(`${prefix}base_url`, old.base_url);
    const models = read(`${prefix}models`, old.models);
    const protocol = harness === 'agv' ? read('agv_protocol', aliases.agv.protocol) : undefined;
    if (url) validateApiUrl(url.value, url.key);
    if (protocol && !(agvProtocols as readonly string[]).includes(protocol.value)) {
      throw new Error(`agv_protocol 仅支持 ${agvProtocols.join(' / ')}；该 CLI 不支持所选协议。`);
    }
    // Inherited native login variables retain their existing behavior. Explicit
    // unified gateway connections must be usable before any model is started.
    if (unifiedConnection || (harness === 'codex' && legacyCodex)) {
      if (!key || (harness === 'agv' && !url) || (harness === 'codex' && legacyCodex && !unifiedConnection && !url)) {
        throw new Error(harness === 'codex' && legacyCodex && !unifiedConnection
          ? '启用自定义 provider 需要填写 provider_base_url 和 provider_api_key。'
          : `${harness} 自定义网关缺少鉴权或地址；请填写 ${prefix}api_key${harness === 'agv' ? ` 和 ${prefix}base_url` : ''}，或清空统一连接配置以复用已有登录。`);
      }
    }
    const baseUrl = url?.value ?? (unifiedConnection && key
      ? harness === 'codex' ? 'https://api.openai.com/v1' : harness === 'claude' ? 'https://api.anthropic.com' : undefined : undefined);
    const selectedProtocol = protocol?.value ?? (harness === 'codex' ? 'responses'
      : unifiedConnection ? harness === 'claude' ? 'anthropic' : 'genai' : undefined);
    const provider: HarnessProvider = {
      connection: unifiedConnection ? 'unified' : harness === 'codex' && legacyCodex ? 'legacy' : 'inherited',
      ...(key ? { apiKey: key.value } : {}), ...(baseUrl ? { baseUrl } : {}),
      ...(models ? { models: parseProviderModels(models.value, models.key) } : {}),
      ...(selectedProtocol ? { protocol: selectedProtocol as HarnessProvider['protocol'] } : {}),
      sources: { ...(key ? { apiKey: key.key } : {}), ...(url ? { baseUrl: url.key } : {}),
        ...(models ? { models: models.key } : {}), ...(protocol ? { protocol: protocol.key } : {}) },
    };
    providers[harness] = provider;
    if (harness === 'codex') {
      if (key) effective.codex_api_key = key.value;
    } else {
      const nativeKey = harness === 'claude' ? 'ANTHROPIC_API_KEY' : 'AGY_LLM_GATEWAY_API_KEY';
      const nativeUrl = harness === 'claude' ? 'ANTHROPIC_BASE_URL' : 'AGY_LLM_GATEWAY_URL';
      if (key) effective[nativeKey] = key.value;
      if (baseUrl) effective[nativeUrl] = baseUrl;
      if (harness === 'claude' && unifiedConnection && key) delete effective.ANTHROPIC_AUTH_TOKEN;
      if (harness === 'agv') {
        if (provider.models) effective.AGY_LLM_GATEWAY_MODELS = provider.models.join(',');
        if (provider.protocol) effective.AGY_LLM_GATEWAY_WIRE_PROTOCOL = provider.protocol;
      }
    }
  }
  return providers;
}

export function validateProviderModel(providers: HarnessProviders | undefined,
  model: { model: string; harness: Harness }, step?: string): void {
  const allowed = providers?.[model.harness].models;
  if (allowed && !allowed.includes(model.model)) {
    throw new Error(`${step ? `${step}：` : ''}模型 ${model.model} 不在 ${model.harness}_models 的可用列表中；请调整该步骤模型或模型列表。`);
  }
}

export function claudeProviderSettings(provider?: HarnessProvider) {
  return provider?.models ? { modelPicker: {
    options: provider.models.map(model => ({ model, label: model })), replaceBuiltInOptions: true,
  } } : {};
}
