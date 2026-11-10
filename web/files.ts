import { lstat, mkdir, open, readdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

// Task-relative keys exchanged with the browser always use '/', independent of
// the native paths used by filesystem and workflow helpers.
export const webFilePath = (path: string): string => path.replaceAll('\\', '/');

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
export const artifactExtensions = /\.(png|jpe?g|webp|svg|mp4|kra|psd|ora|json|md(?:\.tmp)?|py|[cm]?js|ts|txt)$/i;
// agents/ keeps requests, logs and CLI sessions/credentials; the server reads them,
// the browser never does. Only a legacy agents/<request>/workspace is process output.
export function agentRecord(path: string): boolean {
  const parts = path.split('/'), index = parts.indexOf('agents'), workspace = parts.indexOf('workspace');
  return index >= 0 && (workspace < 0 || workspace > index) && parts[index + 2] !== 'workspace';
}
export async function inventory(root: string, versions?: Record<string, string>) {
  const files: string[] = [];
  const excluded = new Set(['node_modules']);
  const directories = [{ path: '', depth: 0 }];
  async function walk(path: string, depth: number) {
    if (depth > 40) throw new Error('任务目录嵌套超过 40 层');
    const entries = await readdir(join(root, path), { withFileTypes: true });
    // Krita's bundled brushes/patterns are software resources, not generated art.
    if (entries.some(entry => /^Krita_.*_Default_Resources\.bundle$/.test(entry.name))) return;
    for (const entry of entries) {
      if (entry.name.startsWith('.') || excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      if (path.split('/').includes('agents') && !path.split('/').includes('workspace') && entry.name === 'cli-data') continue;
      if (path.includes('agents/') && !path.split('/').includes('workspace') && ['tmp', 'bridge-results'].includes(entry.name)) continue;
      if (path.includes('agents/') && ['auth-settings.json', 'mcp.json', 'sessions.json', 'tool-log-forwarder.json'].includes(entry.name)) continue;
      const child = path ? path + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        try { await lstat(join(root, child, 'pyvenv.cfg')); continue; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        directories.push({ path: child, depth: depth + 1 });
      }
      else if (entry.isFile() && artifactExtensions.test(entry.name)) {
        if (versions) {
          try { const info = await lstat(join(root, child)); versions[child] = `${info.mtimeMs}:${info.size}`; }
          catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
        }
        files.push(child);
      }
    }
  }
  // Keep the same inventory rules, but read independent directories in bounded
  // batches instead of waiting for every nested directory in sequence.
  while (directories.length) {
    await Promise.all(directories.splice(0, 16).map(({ path, depth }) => walk(path, depth)));
  }
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

// One directory of the server's filesystem for the settings picker: names only,
// directories first. The browser's own picker cannot see a remote host.
export async function browse(path: string | null, kind: 'dir' | 'file') {
  let target = path?.trim() ? path.trim() : homedir(), selected: string | undefined;
  if (!isAbsolute(target)) throw new Error('路径必须是绝对路径');
  target = resolve(target);
  const info = await stat(target).catch(() => undefined);
  if (info?.isFile()) { selected = basename(target); target = dirname(target); }
  else if (!info) throw new Error('路径不存在：' + target);
  const entries: { name: string; dir: boolean }[] = [];
  for (const entry of await readdir(target, { withFileTypes: true })) {
    let dir = entry.isDirectory();
    if (entry.isSymbolicLink()) dir = await stat(join(target, entry.name)).then(link => link.isDirectory(), () => false);
    if (dir || kind === 'file') entries.push({ name: entry.name, dir });
  }
  entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
  const roots = process.platform === 'win32'
    ? (await Promise.all('CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(async letter => (await stat(letter + ':\\').then(() => true, () => false)) ? letter + ':\\' : ''))).filter(Boolean)
    : ['/'];
  const parent = dirname(target);
  return { path: target, parent: parent === target ? null : parent, separator: sep, roots, home: homedir(), entries, ...(selected ? { selected } : {}) };
}
