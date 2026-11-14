import { chmod, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
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

async function credentialBytes(source: string): Promise<Buffer | undefined> {
  try { return await readFile(source); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

export async function credentialRevision(source: string): Promise<string | null> {
  const bytes = await credentialBytes(source);
  return bytes ? createHash('sha256').update(bytes).digest('hex') : null;
}

// Track only the explicitly named source, so a CLI's own token refresh survives
// subsequent turns until the user's original login actually changes.
export async function syncCredential(data: string, source: string, target: string): Promise<void> {
  const file = join(data, 'credential-sources.json'), key = relative(data, target), sourcePath = resolve(source);
  let records: Record<string, { source: string; revision: string | null }>;
  try { records = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; records = {}; }
  const bytes = await credentialBytes(sourcePath);
  const revision = bytes ? createHash('sha256').update(bytes).digest('hex') : null;
  const previous = records[key];
  let targetExists = true;
  try { await stat(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; targetExists = false; }
  if (bytes && (!targetExists || !previous || previous.source !== sourcePath || previous.revision !== revision)) {
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, bytes, { mode: 0o600 }); await rename(temporary, target); await chmod(target, 0o600);
  } else if (!bytes && (!previous || previous.revision)) {
    // On upgrade establish the native source as authoritative; later, a known
    // source disappearing is a logout. If it was absent throughout, retain a
    // credential created by the private CLI itself.
    await rm(target, { force: true });
  }
  if (!previous || previous.source !== sourcePath || previous.revision !== revision) {
    records[key] = { source: sourcePath, revision };
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(records), { mode: 0o600 }); await rename(temporary, file);
  }
}
