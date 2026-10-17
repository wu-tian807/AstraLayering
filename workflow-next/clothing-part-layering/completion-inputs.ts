import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GroupNode } from './layering-types.ts';

export type InputDependency = { path: string; hash: string; groupId?: string; stage?: 'reduction' | 'completion' };
export const completionInputsPath = (directory: string, id: string) => join(directory, 'stages/completion-inputs', `${id}.json`);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export async function completionReferenceGroups(directory: string, id: string, parentId?: string): Promise<string[]> {
  try {
    const value = JSON.parse(await readFile(completionInputsPath(directory, id), 'utf8'));
    return (value.dependencies ?? []).flatMap((dependency: InputDependency) => dependency.groupId ? [dependency.groupId] : []);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  try {
    const config = JSON.parse(await readFile(fileURLToPath(new URL(`prompts/groups/${id}/completion.references.json`, import.meta.url)), 'utf8'));
    return parentId && Array.isArray(config) ? config.flatMap(entry => typeof entry?.sibling === 'string' ? [`${parentId}/${entry.sibling}`] : []) : [];
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

export async function fileDependency(directory: string, path: string,
  source: Pick<InputDependency, 'groupId' | 'stage'> = {}): Promise<InputDependency> {
  const rel = relative(directory, path);
  return { path: rel.startsWith('..') || isAbsolute(rel) ? path : rel, hash: hash(await readFile(path)), ...source };
}

export async function dependenciesMatch(directory: string, dependencies: InputDependency[], groups?: Map<string, GroupNode>): Promise<boolean> {
  for (const dependency of dependencies) {
    if (groups && dependency.groupId && (!dependency.stage || groups.get(dependency.groupId)?.steps[dependency.stage].status !== 'completed')) return false;
    try { if (hash(await readFile(resolve(directory, dependency.path))) !== dependency.hash) return false; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  return true;
}

export async function completionInputsMatch(directory: string, id: string, beforeHash: string, afterHash: string,
  groups: Map<string, GroupNode>, required = false): Promise<boolean> {
  let value;
  try { value = JSON.parse(await readFile(completionInputsPath(directory, id), 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (required) return false;
    // 旧稿没有引用版本证据时，只兼容未配置额外参考的补全；有真实引用的稿重新建立证据。
    try {
      const config = JSON.parse(await readFile(fileURLToPath(new URL(`prompts/groups/${id}/completion.references.json`, import.meta.url)), 'utf8'));
      return Array.isArray(config) && config.length === 0;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; throw error; }
  }
  if (value.version !== 1 || value.groupId !== id || !Array.isArray(value.dependencies) || value.dependencies.some((d: InputDependency) =>
    !d || typeof d.path !== 'string' || !/^[a-f0-9]{64}$/.test(d.hash) ||
    (d.groupId !== undefined && (typeof d.groupId !== 'string' || !['reduction', 'completion'].includes(d.stage ?? ''))))) {
    throw new Error(`补全输入记录损坏：${id}`);
  }
  return value.beforeHash === beforeHash && value.afterHash === afterHash && dependenciesMatch(directory, value.dependencies, groups);
}
