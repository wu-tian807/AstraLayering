import { chmod, copyFile, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Harness } from './models.ts';
import { fromTaskPath } from '../task-paths.ts';

export type StoredSession = { harness: Harness; data: string; workspace: string; rollout?: string };

export async function readSessions(root: string): Promise<Record<string, StoredSession>> {
  try { return JSON.parse(await readFile(join(root, 'sessions.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}

// All adapters share one registry and write queue. Native histories stay in the
// original session directory when a later turn gets a new request-log directory.
const writes = new Map<string, Promise<void>>();
export async function rememberSession(root: string, id: string, session: StoredSession): Promise<void> {
  const next = (writes.get(root) || Promise.resolve()).catch(() => {}).then(async () => {
    const records = await readSessions(root); records[id] = session;
    const file = join(root, 'sessions.json'), temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2), { mode: 0o600 }); await rename(temporary, file);
  });
  writes.set(root, next);
  try { await next; } finally { if (writes.get(root) === next) writes.delete(root); }
}

function within(root: string, path: string, allowRoot = false) {
  const rel = relative(root, path);
  return (allowRoot || !!rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') && !isAbsolute(rel);
}

export async function resolveSession(root: string, taskRoot: string, session: StoredSession): Promise<StoredSession> {
  const data = fromTaskPath(taskRoot, session.data), workspace = fromTaskPath(taskRoot, session.workspace);
  if (!within(resolve(root), resolve(data))) throw Error('CLI 会话目录不在当前任务记录目录内');
  if (!within(resolve(taskRoot), resolve(workspace), true)) throw Error('CLI 工作目录不在当前任务目录内');
  if (!within(await realpath(root), await realpath(data))) throw Error('CLI 会话目录不在当前任务记录目录内');
  if (!within(await realpath(taskRoot), await realpath(workspace), true)) throw Error('CLI 工作目录不在当前任务目录内');
  let rollout: string | undefined;
  if (session.rollout) {
    rollout = fromTaskPath(taskRoot, session.rollout);
    if (!within(data, rollout) || !within(await realpath(data), await realpath(rollout)) || !(await stat(rollout)).isFile())
      throw Error('CLI 历史文件不在当前会话数据目录内');
    rollout = await realpath(rollout);
  }
  return { ...session, data, workspace, ...(rollout ? { rollout } : {}) };
}

// Copy only the explicitly named credential, never a user's whole profile.
export async function copyCredential(source: string, target: string) {
  try { await copyFile(source, target); await chmod(target, 0o600); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
