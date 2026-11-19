import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// One progress rule for every section. A step owns a directory with a .running
// or .completed marker; nothing else decides whether it runs:
//   absent    -> run it
//   running   -> continue it (its session and drafts are still there)
//   completed -> keep it
//   unmarked  -> leftover of a step that never started; delete and run it
// Markers are empty files. Older JSON markers read the same way.
// Session identity (threadId) belongs to the step's own records, so deleting a
// step always drops its session.
export type ChainStep = { id: string; directory: string };
export type StepStatus = 'absent' | 'unmarked' | 'running' | 'completed';
export type StepAction = 'keep' | 'continue' | 'run';

async function info(path: string) {
  try { return await lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
}

export async function readStep(directory: string): Promise<{ status: StepStatus }> {
  const folder = await info(directory);
  if (!folder) return { status: 'absent' };
  if (!folder.isDirectory() || folder.isSymbolicLink()) throw new Error(`步骤路径必须是普通目录：${directory}`);
  for (const marker of ['completed', 'running'] as const) {
    const file = await info(join(directory, `.${marker}`));
    if (!file) continue;
    if (!file.isFile() || file.isSymbolicLink()) throw new Error(`步骤标记必须是普通文件：${directory}/.${marker}`);
    return { status: marker };
  }
  return { status: 'unmarked' };
}

export const stepAction = (status: StepStatus): StepAction =>
  status === 'completed' ? 'keep' : status === 'running' ? 'continue' : 'run';

export async function checkStep(directory: string): Promise<{ action: StepAction; status: StepStatus }> {
  const { status } = await readStep(directory);
  return { action: stepAction(status), status };
}

// Marks a step running. A fresh run starts from an empty directory.
export async function beginStep(directory: string, status: StepStatus): Promise<void> {
  if (status === 'running') return;
  if (status === 'completed') throw new Error(`步骤已完成，不能重新开始：${directory}`);
  if (status === 'unmarked') await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, '.running'), '', { flag: 'wx' });
}

export async function completeStep(directory: string): Promise<void> {
  await rename(join(directory, '.running'), join(directory, '.completed'));
}

// A false result keeps the step open with its saved progress.
export async function runStep(directory: string, status: StepStatus,
  work: () => Promise<void | boolean>): Promise<'running' | 'completed'> {
  await beginStep(directory, status);
  if (await work() === false) return 'running';
  await completeStep(directory);
  return 'completed';
}
