import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotInput, type PartLayeringInput } from './input.ts';
import type { KritaInstallation } from './krita.ts';
import { stepModels, type StepDefinition } from './steps.ts';

export const runsDirectory = fileURLToPath(new URL('.run/', import.meta.url));
export type ModelConfig = { model: string; effort: 'xhigh' };
export type RunConfig = {
  version: 2;
  name: string;
  sourceInput: PartLayeringInput;
  krita: KritaInstallation;
  models: Record<string, ModelConfig>;
  threadId: string | null;
};
export type StepStatus = 'absent' | 'unmarked' | 'running' | 'completed';
export type RunPlan = { statuses: Map<string, StepStatus>; resetFrom?: number };

export function runDirectory(name: string, root = runsDirectory): string {
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,127}$/u.test(name)) {
    throw new Error('--name 必须是单个任务名，以字母或数字开头，只含字母、数字、点、下划线或短横线（最多 128 字符）。');
  }
  return resolve(root, name);
}

export const stepId = (number: number) => `step${String(number).padStart(2, '0')}`;
export function within(parent: string, path: string): boolean {
  const name = relative(parent, path);
  return name === '' || (!name.startsWith(`..${sep}`) && name !== '..' && !isAbsolute(name));
}

export async function fileInfo(path: string) {
  try { return await lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
}

// Resolve existing ancestors too, including a symlinked .run parent on first use.
export async function canonicalPath(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await canonicalPath(parent), relative(parent, path));
  }
}

export async function loadConfig(directory: string, name: string): Promise<RunConfig | undefined> {
  const info = await fileInfo(directory);
  if (!info) return;
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`任务目录必须是普通目录：${directory}`);
  const file = join(directory, 'run.json');
  if (!await fileInfo(file)) throw new Error(`任务目录已存在但缺少 run.json：${directory}。请使用新的 --name，保留原文件。`);
  const config = JSON.parse(await readFile(file, 'utf8')) as RunConfig;
  if (config?.version !== 2 || config.name !== name
    || typeof config.sourceInput?.directory !== 'string' || typeof config.sourceInput?.parts !== 'string'
    || typeof config.krita?.executable !== 'string' || !config.krita.executable.trim() || typeof config.krita.version !== 'string'
    || !config.models || typeof config.models !== 'object' || Array.isArray(config.models)
    || Object.values(config.models).some(model => !model || typeof model.model !== 'string' || !model.model.trim() || model.effort !== 'xhigh')
    || !(config.threadId === null || (typeof config.threadId === 'string' && !!config.threadId.trim()))) {
    throw new Error(`无效的任务配置：${file}`);
  }
  return config;
}

export function newConfig(name: string, input: PartLayeringInput, krita: KritaInstallation, steps: readonly StepDefinition[]): RunConfig {
  const models: Record<string, ModelConfig> = Object.fromEntries(Object.entries(stepModels).map(([number, model]) => [stepId(Number(number)), model]));
  for (const step of steps) models[step.id] = { model: step.model, effort: step.effort };
  return { version: 2, name, sourceInput: input, krita, models, threadId: null };
}

export async function saveConfig(directory: string, config: RunConfig): Promise<void> {
  const file = join(directory, 'run.json');
  await writeFile(`${file}.tmp`, JSON.stringify(config, null, 2) + '\n');
  await rename(`${file}.tmp`, file);
}

export async function initializeRun(directory: string, config: RunConfig): Promise<void> {
  await mkdir(dirname(directory), { recursive: true });
  const staging = await mkdtemp(join(dirname(directory), '.init-'));
  try {
    await snapshotInput(config.sourceInput, join(staging, 'input'));
    await saveConfig(staging, config);
    // Publish input + configuration together; interrupted copies never look resumable.
    await rename(staging, directory);
  } finally { await rm(staging, { recursive: true, force: true }); }
}

async function readStatus(directory: string): Promise<StepStatus> {
  const info = await fileInfo(directory);
  if (!info) return 'absent';
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`步骤路径必须是普通目录：${directory}`);
  for (const marker of ['completed', 'running'] as const) {
    const info = await fileInfo(join(directory, `.${marker}`));
    if (!info) continue;
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`步骤标记必须是普通文件：${directory}/.${marker}`);
    return marker;
  }
  return 'unmarked';
}

export async function inspectRun(directory: string, steps: readonly StepDefinition[]): Promise<RunPlan> {
  for (const [index, step] of steps.entries()) {
    if (step.id !== stepId(index + 1)) throw new Error('已定义步骤必须从 step01 开始连续排列。');
  }
  let entries: string[] = [];
  try { entries = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const numbers = entries.filter(name => /^step\d{2}$/.test(name) && name !== 'step00').map(name => Number(name.slice(4)));
  const lastExisting = Math.max(0, ...numbers);
  const statuses = new Map<string, StepStatus>();
  let resetFrom: number | undefined;
  for (let number = 1; number <= Math.max(lastExisting, steps.length); number++) {
    const id = stepId(number), status = await readStatus(join(directory, id));
    statuses.set(id, status);
    if (resetFrom === undefined && (status === 'unmarked' || (status === 'absent' && number < lastExisting))) resetFrom = number;
  }
  return { statuses, resetFrom };
}

export async function resetSteps(directory: string, config: RunConfig, plan: RunPlan): Promise<void> {
  if (plan.resetFrom === undefined) return;
  config.threadId = null;
  await saveConfig(directory, config);
  // Remove descendants first. The unmarked triggering directory survives until last,
  // so a crash during deletion still signals the reset on the next launch.
  for (const [id, status] of [...plan.statuses].reverse()) {
    if (Number(id.slice(4)) >= plan.resetFrom && status !== 'absent') {
      await rm(join(directory, id), { recursive: true, force: true });
    }
  }
}
