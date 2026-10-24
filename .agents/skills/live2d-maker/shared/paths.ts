import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workflowsDirectory = fileURLToPath(new URL('../', import.meta.url));
// The repository marker is specific to this application, not an arbitrary enclosing Git repo.
export function defaultRunsDirectory(skill: string): string {
  const repository = resolve(skill, '../../..');
  return existsSync(join(repository, 'web/server.ts')) && existsSync(join(repository, 'pnpm-workspace.yaml'))
    ? join(repository, '.run') : resolve(skill, '../.run');
}
export const runsDirectory = defaultRunsDirectory(workflowsDirectory);

export function resolveRunsDirectory(dir = runsDirectory): string {
  if (!isAbsolute(dir)) throw new Error('--dir 必须是运行根目录的绝对路径。');
  return resolve(dir);
}
export const pipelineIds = ['part-layering', 'raster-layering', 'clothing-part-layering', 'clothing-raster-layering', 'character-assembly', 'shadow', 'physics'] as const;
export type PipelineId = typeof pipelineIds[number];

export function taskDirectory(name: string, root = runsDirectory): string {
  if (!name || name === '.' || name === '..' || /[\\/:]/.test(name)) throw new Error('--name 必须是单个目录名。');
  if (name === '.runtime') throw new Error('--name 不能使用共享运行环境保留目录 .runtime。');
  const directory = resolve(resolveRunsDirectory(root), name);
  const skill = resolve(workflowsDirectory);
  if (directory === skill || directory.startsWith(skill + sep)) throw new Error('任务目录必须位于 live2d-maker skill 之外；请更换 --name 或 --dir。');
  return directory;
}

export function pipelineDirectory(name: string, pipeline: PipelineId, root = runsDirectory): string {
  // The part entrypoints historically accept any single directory name. Keep
  // raster's stricter startup rule local to those pipelines when sharing paths.
  if ((pipeline === 'raster-layering' || pipeline === 'clothing-raster-layering' || pipeline === 'character-assembly' || pipeline === 'shadow' || pipeline === 'physics')
    && !/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,127}$/u.test(name)) {
    throw new Error('--name 必须是单个任务名，以字母或数字开头，只含字母、数字、点、下划线或短横线（最多 128 字符）。');
  }
  return join(taskDirectory(name, root), pipeline);
}

// All user-supplied input paths use the named task as their base, regardless of cwd.
export function resolveInput(name: string, path: string, root = runsDirectory): string {
  return isAbsolute(path) ? resolve(path) : resolve(taskDirectory(name, root), path);
}
