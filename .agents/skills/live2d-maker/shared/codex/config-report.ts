import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { workflowsDirectory } from '../paths.ts';
import { stepModelSlots, type AgentStep } from '../agents/models.ts';
import { loadWorkflowEnvironment } from './environment.ts';

// Read the same configuration as a worker, but never start a model or expose credentials.
export function configurationReport(env: NodeJS.ProcessEnv = process.env, directory = workflowsDirectory) {
  const settings = loadWorkflowEnvironment(env, directory);
  let file: NodeJS.ProcessEnv = {};
  const path = join(directory, '.env');
  try { file = parseEnv(readFileSync(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return {
    verification: 'configuration-only',
    skill: directory,
    configuration: path,
    shellOverrides: Object.keys(file).filter(key => env[key] !== undefined).sort(),
    codex: {
      executable: settings.codex.codexPathOverride ?? 'SDK default',
      patchAutoBuild: !settings.codex.codexPathOverride,
      home: settings.codex.env?.CODEX_HOME ?? '~/.codex',
      provider: settings.codex.config?.model_provider ?? 'inherited',
      imageCompaction: {
        enabled: settings.imageCompactThreshold !== undefined,
        threshold: settings.imageCompactThreshold ?? null,
        childThreshold: settings.codex.env?.LAYERING_IMAGE_COMPACT_THRESHOLD ?? null,
      },
    },
    models: Object.fromEntries(Object.entries(stepModelSlots).map(([step, slot]) => [slot, settings.stepModels[step as AgentStep]])),
    imageModels: settings.stepImages,
    imageApis: Object.fromEntries(['openai', 'google'].map(provider => {
      const api = settings.imageApis[provider as 'openai' | 'google'];
      return [provider, { configured: !!api, protocol: api?.protocol ?? null }];
    })),
    cliPaths: settings.cliPaths,
    providers: Object.fromEntries(Object.entries(settings.providers ?? {}).map(([harness, provider]) => [harness, {
      connection: provider.connection, credentialsConfigured: !!provider.apiKey,
      baseUrl: provider.baseUrl ?? null, protocol: provider.protocol ?? null,
      models: provider.models ?? null, sources: provider.sources,
    }])),
    agvPatch: { enabled: settings.codex.env?.agv_unlimited_response_header_timeout === 'true' },
    imageBudgets: Object.fromEntries(Object.entries(settings.imageBudgets ?? {}).map(([harness, budget]) => [harness, {
      enabled: budget.images !== undefined || budget.bytes !== undefined || budget.deduplicate === true,
      images: budget.images ?? null, requestBytes: budget.bytes ?? null, deduplicate: budget.deduplicate === true,
      implementation: harness === 'codex' ? 'native-patch' : 'message-transport',
    }])),
  };
}
