import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { directoryFor, observeRun, readRun, type TaskOptions, type TaskRun } from './state.ts';

export const stopRequestPath = (directory: string) => join(directory, '.stop-request.json');
async function optionalJSON(path: string) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
async function writeJSON(path: string, value: unknown) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  try { await writeFile(temporary, JSON.stringify(value) + '\n', { mode: 0o600 }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}

// A live runner watches for a stop request naming it.
export const canStopTask = (runner: TaskRun['runner'], alive: boolean, locked: boolean) => alive && locked && !!runner?.id;

export async function requestTaskStop(options: Pick<TaskOptions, 'name' | 'dir'>) {
  const directory = directoryFor(options), run = await readRun(directory);
  if (!run) throw new Error('缺少总控记录：' + join(directory, 'run.json'));
  const { runnerAlive, lockHeld } = await observeRun(directory, run);
  if (!canStopTask(run.runner, runnerAlive, lockHeld)) throw new Error('当前没有可停止的运行任务');
  await writeJSON(stopRequestPath(directory), { runnerId: run.runner!.id });
}

export function watchTaskStop(directory: string, runnerId: string, controller: AbortController, onError: (error: unknown) => void) {
  let polling = false;
  const timer = setInterval(async () => {
    if (polling || controller.signal.aborted) return;
    polling = true;
    try {
      if ((await optionalJSON(stopRequestPath(directory)))?.runnerId === runnerId) {
        controller.abort(new Error('已请求停止；保留已有产物与 thread，稍后可续跑。'));
      }
    } catch (error) { onError(error); }
    finally { polling = false; }
  }, 1000);
  return () => clearInterval(timer);
}

export async function clearTaskStop(directory: string, runnerId: string) {
  if ((await optionalJSON(stopRequestPath(directory)))?.runnerId === runnerId) await rm(stopRequestPath(directory), { force: true });
}
