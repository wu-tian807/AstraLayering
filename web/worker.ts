import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTask } from '../.agents/skills/live2d-maker/workflow/runner.ts';
import { taskLogName } from '../.agents/skills/live2d-maker/workflow/log.ts';
import { directoryFor, type TaskOptions } from '../.agents/skills/live2d-maker/workflow/state.ts';
import { atomicJSON, jsonFile, tail } from './files.ts';

// Only the process host is web-specific. Scheduling, locking, retries, markers and threads
// remain owned by the existing coordinator and five pipeline entrypoints.
export async function runWebTask(options: TaskOptions, token: string, dependencies: Parameters<typeof runTask>[1] = {}) {
  const directory = directoryFor(options), controller = new AbortController();
  const interrupt = () => controller.abort(new Error('已请求停止；保留已有产物与 thread，稍后可续跑。'));
  process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt);
  let polling = false, readyWrite = Promise.resolve();
  const timer = setInterval(async () => {
    if (polling) return; polling = true;
    try { if ((await jsonFile(directory, '.web-cancel.json'))?.token === token) interrupt(); }
    catch (error) { console.error(error); }
    finally { polling = false; }
  }, 1000);
  try {
    return await runTask(options, { ...dependencies, signal: controller.signal,
      ready: run => {
        // The task lock is already held when this callback runs.
        readyWrite = atomicJSON(join(directory, '.web-worker.json'), { token, pid: process.pid, runnerId: run.runner!.id })
          .then(() => { dependencies.ready?.(run); process.send?.({ type: 'ready' }); })
          .catch(error => { controller.abort(error); process.send?.({ type: 'failure', message: String(error) }); });
      },
    });
  } finally {
    clearInterval(timer);
    await readyWrite;
    process.removeListener('SIGTERM', interrupt); process.removeListener('SIGINT', interrupt);
    if ((await jsonFile(directory, '.web-worker.json'))?.token === token) {
      await rm(join(directory, '.web-worker.json'), { force: true });
      await rm(join(directory, '.web-cancel.json'), { force: true });
    }
  }
}
export async function launch(options: TaskOptions): Promise<number> {
  const directory = directoryFor(options);
  await mkdir(directory, { recursive: true });
  const log = await open(join(directory, taskLogName), 'a', 0o600);
  try {
    return await new Promise((resolve, reject) => {
      const child = fork(fileURLToPath(new URL('./worker.ts', import.meta.url)), [JSON.stringify(options), randomUUID()], {
        cwd: directory, detached: true, stdio: ['ignore', log.fd, log.fd, 'ipc'],
      });
      let settled = false, failure: Error | undefined;
      const finish = (error?: Error) => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (child.connected) child.disconnect(); child.unref();
        if (error) reject(error); else resolve(child.pid!);
      };
      const timer = setTimeout(() => { child.kill('SIGTERM'); finish(new Error('启动确认超时，请检查 workflow.log 后再续跑')); }, 30_000);
      child.on('message', (message: any) => {
        if (message.type === 'ready') finish();
        if (message.type === 'failure') failure = new Error(message.message);
      });
      child.once('error', finish);
      child.once('exit', (code, signal) => { if (!settled) void tail(directory, taskLogName).then(log => finish(failure ?? new Error(`启动失败 (${code ?? signal})\n${log}`))); });
    });
  } finally { await log.close(); }
}
if (import.meta.main) {
  runWebTask(JSON.parse(process.argv[2]), process.argv[3]).catch(error => {
    console.error(error);
    if (process.connected) process.send?.({ type: 'failure', message: (error as Error).message });
    process.exitCode = 1;
  }).finally(() => { if (process.connected) process.disconnect(); });
}
