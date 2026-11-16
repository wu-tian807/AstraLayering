import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { promisify } from 'node:util';
import type { CodexOptions } from '@openai/codex-sdk';
import { codexAuthenticationSource, codexSessionEnvironment, productionCodexConfig } from './session-data.ts';

export const sharedCatalogVariable = 'ASTRA_LAYERING_RUN_CATALOG';
export type SharedCatalog = { path: string; signature: string };
type Executable = { command: string; args: string[] };

export function flattenConfig(value: Record<string, unknown>, prefix = '', result: Record<string, unknown> = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length) flattenConfig(child as Record<string, unknown>, path, result);
    else if (child !== undefined) result[path] = child;
  }
  return result;
}
export function catalogConfigArgs(options: CodexOptions): string[] {
  const connection = Object.entries(flattenConfig(options.config ?? {}))
    .filter(([key]) => key === 'model_provider' || key === 'openai_base_url' || key.startsWith('model_providers.'))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  return ['features.code_mode=false', 'features.code_mode_only=false', ...options.configOverrides ?? [], ...connection,
    ...Object.entries(productionCodexConfig).map(([key, value]) => `${key}=${JSON.stringify(value)}`)].flatMap(config => ['-c', config]);
}
export async function catalogSignature(executable: Executable, options: CodexOptions): Promise<{ signature: string; dynamic: boolean }> {
  const auth = await codexAuthenticationSource(options.env ?? process.env);
  const source = options.env ?? process.env;
  // Providers can use arbitrary env_key names. Hash the source environment rather than
  // guessing a key list; omit only per-worker IPC and per-agent image routing values.
  const inputs = Object.entries(source).filter(([key]) => ![sharedCatalogVariable, 'ASTRA_AGENT_SLOTS', 'NODE_CHANNEL_FD', 'NODE_CHANNEL_SERIALIZATION_MODE'].includes(key) && !key.startsWith('LAYERING_IMAGE_')).sort(([a], [b]) => a.localeCompare(b));
  const value = JSON.stringify([executable, catalogConfigArgs(options), auth.revision, options.apiKey ?? null, inputs]);
  return { signature: createHash('sha256').update(value).digest('hex'), dynamic: auth.dynamic };
}
export async function writeDirectCatalog(executable: Executable, configArgs: string[], env: NodeJS.ProcessEnv, directory: string): Promise<string> {
  const { stdout } = await promisify(execFile)(executable.command, [...executable.args.slice(0, -1), 'debug', 'models', ...configArgs],
    { env, timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
  const catalog = JSON.parse(stdout);
  if (!Array.isArray(catalog?.models)) throw new Error('Codex debug models 未返回模型目录');
  for (const model of catalog.models) model.tool_mode = null;
  const file = join(directory, 'model-catalog.json');
  await writeFile(file, JSON.stringify(catalog), { flag: 'wx' });
  return file;
}
// Called once by the task supervisor after preflight; the file lives for the whole run.
export async function prepareRunCatalog(executable: Executable, options: CodexOptions, taskDirectory: string): Promise<SharedCatalog | undefined> {
  const identity = await catalogSignature(executable, options);
  // Dynamic auth commands can change providers without a file revision. Keep their existing per-call behavior.
  if (identity.dynamic) return undefined;
  const base = join(taskDirectory, 'agents', 'runtime');
  await mkdir(base, { recursive: true });
  const runtime = await mkdtemp(join(base, 'catalog-'));
  const scratch = join(runtime, 'profile'); await mkdir(scratch);
  try {
    const env = await codexSessionEnvironment(scratch, options.env ?? process.env);
    if (options.apiKey) env.CODEX_API_KEY = options.apiKey;
    const path = await writeDirectCatalog(executable, catalogConfigArgs(options), env, runtime);
    // If login or provider changed during discovery, do not publish a mismatched snapshot.
    const after = await catalogSignature(executable, options);
    return after.dynamic || after.signature !== identity.signature ? undefined : { path, signature: identity.signature };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
const processCatalogs = new Map<string, Promise<string>>();
export async function resolveCatalog(executable: Executable, options: CodexOptions, env: NodeJS.ProcessEnv, taskRoot: string, logDirectory: string): Promise<string> {
  const identity = await catalogSignature(executable, options);
  let shared: SharedCatalog | undefined;
  try { shared = JSON.parse(process.env[sharedCatalogVariable] ?? 'null') ?? undefined; } catch { /* no trusted descriptor */ }
  if (!identity.dynamic && shared && shared.signature === identity.signature && typeof shared.path === 'string' && isAbsolute(shared.path)) {
    try {
      const inside = relative(await realpath(taskRoot), await realpath(shared.path));
      if (inside && inside !== '..' && !inside.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(inside)) return shared.path;
    } catch { /* prepare locally */ }
  }
  // Standalone sections share the first successful catalog in the worker process.
  const key = JSON.stringify([taskRoot, identity.signature]);
  if (identity.dynamic) return writeDirectCatalog(executable, catalogConfigArgs(options), env, logDirectory);
  let promise = processCatalogs.get(key);
  if (promise) {
    const path = await promise;
    try { await access(path); return path; } catch { processCatalogs.delete(key); }
  }
  promise = writeDirectCatalog(executable, catalogConfigArgs(options), env, logDirectory);
  processCatalogs.set(key, promise);
  try { return await promise; } catch (error) { if (processCatalogs.get(key) === promise) processCatalogs.delete(key); throw error; }
}
