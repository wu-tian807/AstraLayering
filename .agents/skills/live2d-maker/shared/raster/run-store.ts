import type { Harness } from '../agents/models.ts';
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isPartLayeringInput, type PartLayeringInput } from './input.ts';
import type { KritaInstallation } from './krita.ts';
import type { StepDefinition } from './steps.ts';
import type { StepStatus } from '../step-chain.ts';
import { inspectSection, stepId, type SectionPlan, type SectionStep } from '../step-section.ts';

export type ThreadHandoff = {
  id: string;
  previousThreadId: string;
  notes: string;
  reason: string;
  createdAt: string;
  replacementThreadId?: string;
};
export type RunConfig<Input = PartLayeringInput> = {
  version: 2;
  name: string;
  sourceInput: Input;
  inputFingerprint?: string;
  krita: KritaInstallation;
  threadId: string | null;
  threadHarness?: Harness;
  threadStep?: string;
  threadHandoff?: ThreadHandoff;
};
export type { StepStatus };
export type RunPlan = SectionPlan;

export { stepId };
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

export async function loadConfig<Input = PartLayeringInput>(directory: string, name: string,
  validateInput: (value: unknown) => boolean = isPartLayeringInput): Promise<RunConfig<Input> | undefined> {
  const info = await fileInfo(directory);
  if (!info) return;
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`任务目录必须是普通目录：${directory}`);
  const file = join(directory, 'run.json');
  if (!await fileInfo(file)) throw new Error(`任务目录已存在但缺少 run.json：${directory}。请使用新的 --name，保留原文件。`);
  const config = JSON.parse(await readFile(file, 'utf8')) as RunConfig<Input> & { models?: unknown };
  if (config?.version !== 2 || config.name !== name
    || !validateInput(config.sourceInput)
    || typeof config.krita?.executable !== 'string' || !config.krita.executable.trim() || typeof config.krita.version !== 'string'
    || !(config.threadId === undefined || config.threadId === null || (typeof config.threadId === 'string' && !!config.threadId.trim()))
    || (config.threadHandoff !== undefined && !validHandoff(config.threadHandoff))) {
    throw new Error(`无效的任务配置：${file}`);
  }
  // Old snapshots are ignored and removed on the next save. Model selection
  // belongs to the current environment; session identity stays in this file.
  delete config.models;
  config.threadId ??= null;
  return config;
}

function validHandoff(value: ThreadHandoff): boolean {
  return !!value && ['id', 'previousThreadId', 'notes', 'reason', 'createdAt'].every(key =>
    typeof value[key as keyof ThreadHandoff] === 'string' && !!value[key as keyof ThreadHandoff]?.trim())
    && (value.replacementThreadId === undefined || (typeof value.replacementThreadId === 'string' && !!value.replacementThreadId.trim()));
}

export function newConfig<Input>(name: string, input: Input, krita: KritaInstallation): RunConfig<Input> {
  return { version: 2, name, sourceInput: input, krita, threadId: null };
}

export async function saveConfig(directory: string, config: RunConfig<unknown>): Promise<void> {
  const file = join(directory, 'run.json');
  await writeFile(`${file}.tmp`, JSON.stringify(config, null, 2) + '\n');
  await rename(`${file}.tmp`, file);
}

export async function initializeRun(directory: string, config: RunConfig<unknown>): Promise<void> {
  await mkdir(dirname(directory), { recursive: true });
  const staging = await mkdtemp(join(dirname(directory), '.init-'));
  try {
    await saveConfig(staging, config);
    // Upstream artifacts remain in their owning pipeline; initialize configuration only.
    await rename(staging, directory);
  } finally { await rm(staging, { recursive: true, force: true }); }
}

// Raster steps form one linear section. Each records the hashes of its
// artwork (the .kra/.png deliveries), so edits made while a run was stopped are
// refused instead of silently built upon.
// step01 also depends on the upstream pipeline's final step, so redoing the
// parts reruns the artwork built on them.
export function rasterSteps(steps: readonly StepDefinition[], upstream: readonly string[] = []): SectionStep[] {
  return steps.map((step, index) => {
    if (step.id !== stepId(index + 1)) throw new Error('已定义步骤必须从 step01 开始连续排列。');
    const outputs = step.requiredFiles.filter(file => /\.(kra|png)$/i.test(file));
    return { number: index + 1, ...(index === 0 && upstream.length ? { upstream } : {}), ...(outputs.length ? { outputs } : {}),
      ...(step.allowsEarlyArtifacts ? { allowsEarlyArtifacts: true } : {}) };
  });
}

export const inspectRun = (directory: string, steps: readonly StepDefinition[]): Promise<SectionPlan> =>
  inspectSection(directory, rasterSteps(steps));
