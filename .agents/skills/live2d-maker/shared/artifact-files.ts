import { lstat, mkdir, open, readdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export const inside = (root: string, path: string) => path === root || path.startsWith(root + sep);
export async function safePath(root: string, path = ''): Promise<string> {
  if (isAbsolute(path) || path.split(/[\\/]/).some(p => p === '..') || path.includes('\0')) throw new Error('无效的任务文件路径');
  const canonical = await realpath(root), target = resolve(canonical, path);
  if (!inside(canonical, target)) throw new Error('文件不在任务目录内');
  // Reject symlinks (including parents) rather than follow aliases into another task.
  let current = canonical;
  for (const segment of relative(canonical, target).split(sep).filter(Boolean)) {
    current = join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error('任务文件不能通过符号链接访问');
  }
  return target;
}
export async function jsonFile<T = any>(root: string, path: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(await safePath(root, path), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw new Error(path + '：' + (error as Error).message); }
}
export async function atomicJSON(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, path);
}
export const artifactExtensions = /\.(png|jpe?g|webp|svg|kra|psd|json|jsonl|jsonl.gz|md(?:\.tmp)?)$/i;
export async function inventory(root: string) {
  const files: string[] = [];
  const excluded = new Set(['node_modules', 'observations', 'supervision', 'sessions', 'archive', 'backups']);
  async function walk(path: string, depth: number) {
    if (depth > 40) throw new Error('任务目录嵌套超过 40 层');
    for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const child = path ? path + '/' + entry.name : entry.name;
      if (entry.isDirectory()) await walk(child, depth + 1);
      else if (entry.isFile() && artifactExtensions.test(entry.name)) files.push(child);
      if (files.length > 50_000) throw new Error('任务产物超过 50000 个文件，请将旧备份移到 backups 目录');
    }
  }
  await walk('', 0);
  return files.sort();
}
export async function tail(root: string, path: string, bytes = 24 * 1024): Promise<string> {
  let handle;
  try {
    handle = await open(await safePath(root, path), 'r');
    const info = await handle.stat();
    const start = Math.max(0, info.size - bytes), buffer = Buffer.alloc(Math.min(info.size, bytes));
    await handle.read(buffer, 0, buffer.length, start);
    return (start ? '…（仅显示末尾）\n' : '') + buffer.toString('utf8');
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''; throw error; }
  finally { await handle?.close(); }
}
