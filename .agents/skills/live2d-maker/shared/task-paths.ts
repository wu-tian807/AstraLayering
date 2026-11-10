import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { sectionIds } from './paths.ts';

// One base for every task path: the task root <runs>/<name> (after export,
// demos/<name>). Persisted paths inside the task are relative to that root in
// POSIX form; agents are shown absolute paths spelled under the root, and
// things outside the task, such as the Krita executable, stay absolute.
//
// Reading is lenient: absolute paths are accepted as is, and a relative path
// always means the task root.

const sections = new Set<string>([...sectionIds, 'nine-axis']);
const inside = (root: string, path: string) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);

// The task root of a section directory. Every section directory is created
// directly in the task root, so the
// root comes from the structure rather than from searching ancestors by name: a
// part group may be named after a section. Deeper directories must be given
// their root explicitly. A directory outside the layout (tests, ad hoc tools) is
// its own root.
export function taskRootOf(directory: string): string {
  const start = resolve(directory), parent = dirname(start);
  if (sections.has(basename(start))) return parent;
  return start;
}

// Writes a path for persistence: task-relative POSIX inside the
// task root, absolute outside it. A relative input is already task-relative.
export function toTaskPath(root: string, path: string): string {
  if (!isAbsolute(path)) return posix.normalize(path.split(sep).join('/'));
  root = resolve(root); path = resolve(path);
  if (!inside(root, path)) return path;
  return relative(root, path).split(sep).join('/') || '.';
}

// Same as toTaskPath, also matching a root reached through symlinks.
export async function toTaskPathReal(root: string, path: string): Promise<string> {
  if (!isAbsolute(path) || inside(resolve(root), resolve(path))) return toTaskPath(root, path);
  const real = await realpath(root).catch(() => resolve(root));
  return toTaskPath(inside(real, resolve(path)) ? real : root, path);
}

// Resolves a persisted or agent-supplied path. Relative paths use the task root
// and may not climb out of it; absolute paths are accepted unchanged.
export function fromTaskPath(root: string, path: string): string {
  if (isAbsolute(path)) return resolve(path);
  const resolved = resolve(root, path);
  if (!inside(resolve(root), resolved)) throw new Error(`相对路径须以任务根目录为基准且不能越出任务根：${path}`);
  return resolved;
}

// Shows a path to an agent: absolute, under the given root when inside the task
// (also through symlinks), so it reads the same as the task root in the prompt.
export async function toAgentPath(root: string, path: string): Promise<string> {
  return fromTaskPath(root, await toTaskPathReal(root, path));
}

// Rewrites every absolute string inside the task root to its task path.
export function toTaskPaths<T>(root: string, value: T): T {
  if (typeof value === 'string') return (isAbsolute(value) ? toTaskPath(root, value) : value) as T;
  if (Array.isArray(value)) return value.map(item => toTaskPaths(root, item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toTaskPaths(root, item)])) as T;
  }
  return value;
}

// Image paths follow Codex native imagegen: inputs and saved results are
// absolute, so they are never resolved against a guessed base.
export function imagePath(path: string, label: string): string {
  if (!isAbsolute(path)) throw new Error(`${label} 必须是绝对路径：${path}`);
  return resolve(path);
}
