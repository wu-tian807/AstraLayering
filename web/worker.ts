import { fork } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lastLog, runTask } from '../.agents/skills/live2d-maker/workflow/runner.ts';
import { retryLogOpen, taskLogName } from '../.agents/skills/live2d-maker/workflow/log.ts';
import { directoryFor, type TaskOptions } from '../.agents/skills/live2d-maker/workflow/state.ts';

// Only the process host is web-specific. Scheduling, locking, retries, markers and threads
// remain owned by the existing coordinator and section entrypoints.
export async function runWebTask(options: TaskOptions, dependencies: Parameters<typeof runTask>[1] = {}) {
  const controller = new AbortController();
  const interrupt = () => controller.abort(new Error('已请求停止；保留已有产物与 thread，稍后可续跑。'));
  process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt);
  let confirmed = false;
  try {
    // The task lock is already held when either callback runs. A Codex build
    // confirms the start early, so launch does not time out while it builds.
    const confirm = (run: Parameters<NonNullable<typeof dependencies.ready>>[0]) => {
      if (confirmed) return;
      confirmed = true; dependencies.ready?.(run); process.send?.({ type: 'ready' });
    };
    return await runTask(options, { ...dependencies, signal: controller.signal, preparing: confirm, ready: confirm });
  } finally {
    process.removeListener('SIGTERM', interrupt); process.removeListener('SIGINT', interrupt);
  }
}
export async function launch(options: TaskOptions): Promise<number> {
  const directory = directoryFor(options);
  await mkdir(directory, { recursive: true });
  const log = await retryLogOpen(() => open(join(directory, taskLogName), 'a', 0o600));
  try {
    return await new Promise((resolve, reject) => {
      const child = fork(fileURLToPath(new URL('./worker.ts', import.meta.url)), [JSON.stringify(options)], {
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
      child.once('exit', (code, signal) => {
        if (settled) return;
        if (failure) return finish(failure);
        void lastLog(directory).then(log => finish(new Error(`启动失败 (${code ?? signal})\n${log}`)), finish);
      });
    });
  } finally { await log.close(); }
}
if (import.meta.main) {
  runWebTask(JSON.parse(process.argv[2])).catch(error => {
    console.error(error);
    if (process.connected) process.send?.({ type: 'failure', message: (error as Error).message });
    process.exitCode = 1;
  }).finally(() => { if (process.connected) process.disconnect(); });
}
