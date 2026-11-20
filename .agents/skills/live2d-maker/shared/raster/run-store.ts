import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { StepDefinition } from './steps.ts';
import type { StepStatus } from '../step-chain.ts';
import { inspectSection, type SectionPlan, type SectionStep } from '../step-section.ts';
import { stepNumber, stepPattern } from '../step-paths.js';
import { fromTaskPath, toTaskPathReal } from '../task-paths.ts';

export type { StepStatus };
export type RunPlan = SectionPlan;

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

// Task path of a file that may sit behind a symlinked runs root on either side.
export async function taskPath(root: string, path: string): Promise<string> {
  return isAbsolute(path) ? toTaskPathReal(await canonicalPath(root), await canonicalPath(path)) : toTaskPathReal(root, path);
}
// Absolute path shown to an agent, spelled under root when inside the task.
export async function agentPath(root: string, path: string): Promise<string> {
  return fromTaskPath(root, await taskPath(root, path));
}
// Deep taskPath of the absolute strings in a record.
export const taskPaths = <T>(root: string, value: T): Promise<T> => mapPaths(value, path => taskPath(root, path));
// Deep agentPath of the absolute strings in a tool result.
export const agentPaths = <T>(root: string, value: T): Promise<T> => mapPaths(value, path => agentPath(root, path));
async function mapPaths<T>(value: T, at: (path: string) => Promise<string>): Promise<T> {
  if (typeof value === 'string') return (isAbsolute(value) ? await at(value) : value) as T;
  if (Array.isArray(value)) return await Promise.all(value.map(item => mapPaths(item, at))) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await mapPaths(item, at)]))) as T;
  }
  return value;
}

// Raster steps form one linear section, numbered from step01.
export function rasterSteps(steps: readonly StepDefinition[]): SectionStep[] {
  return steps.map((step, index) => {
    if (stepNumber(step.id) !== index + 1) throw new Error('已定义步骤必须从 step01 开始连续排列。');
    const note = stepPattern.exec(step.id)![2];
    return { number: index + 1, ...(note ? { note } : {}), requiredFiles: step.requiredFiles };
  });
}

export const inspectRun = (directory: string, steps: readonly StepDefinition[]): Promise<SectionPlan> =>
  inspectSection(directory, rasterSteps(steps));
