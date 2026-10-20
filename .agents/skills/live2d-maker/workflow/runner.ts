import { fork, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTaskLog, readTaskLog } from './log.ts';
import { formatAgentError } from '../shared/codex/diagnostics.ts';
import type { PipelineId } from '../shared/paths.ts';
import { checkKrita, type KritaInstallation } from '../shared/raster/krita.ts';
import type { PipelineResult } from './pipelines.ts';
import { acquireTaskLock, configureRun, directoryFor, now, saveRun, selectedPipelines, type TaskOptions, type TaskRun } from './state.ts';

export type PipelineExecution = (id: PipelineId, run: TaskRun, context: {
  signal: AbortSignal; progress(message: string): void; started(pid: number): Promise<void>;
}) => Promise<PipelineResult>;

function terminate(child: ChildProcess, force = false) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', ...(force ? ['/F'] : [])], { stdio: 'ignore' });
    killer.on('error', () => child.kill(force ? 'SIGKILL' : 'SIGTERM'));
  } else {
    try { process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
}
export const executeChild: PipelineExecution = async (id, run, context) => {
  context.signal.throwIfAborted();
  const directory = directoryFor(run);
  return new Promise<PipelineResult>((resolve, reject) => {
    const child = fork(fileURLToPath(new URL('./pipeline-worker.ts', import.meta.url)), [directory, run.name, id, run.runner!.id], {
      cwd: directory, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let result: PipelineResult | undefined, failure = '', output = '', killTimer: NodeJS.Timeout | undefined;
    const abort = () => { terminate(child); killTimer = setTimeout(() => terminate(child, true), 10_000); killTimer.unref(); };
    context.signal.addEventListener('abort', abort, { once: true });
    for (const stream of [child.stdout, child.stderr]) stream!.on('data', data => {
      const text = String(data); output = (output + text).slice(-64 * 1024); context.progress(text.trimEnd());
    });
    child.on('message', message => {
      const value = message as { type?: string; result?: PipelineResult; message?: string };
      if (value.type === 'result') result = value.result;
      if (value.type === 'failure') failure = value.message ?? '';
    });
    child.once('spawn', () => { void context.started(child.pid!).catch(error => { failure = formatAgentError(error); abort(); }); });
    child.once('error', error => { failure = formatAgentError(error); });
    child.once('close', (code, signal) => {
      context.signal.removeEventListener('abort', abort);
      if (killTimer) clearTimeout(killTimer);
      if (context.signal.aborted) reject(context.signal.reason);
      else if (code === 0 && result && !failure) resolve(result);
      else reject(new Error(failure || ('管线退出但未交付完成结果：' + id + ' (code=' + code + ', signal=' + signal + ')\n' + output)));
    });
    if (context.signal.aborted) abort();
  });
};

export async function runTask(options: TaskOptions, dependencies: {
  execute?: PipelineExecution; signal?: AbortSignal; progress?: (message: string) => void;
  ready?: (run: TaskRun) => void;
  preflight?: (path: string) => Promise<KritaInstallation>;
  save?: typeof saveRun;
} = {}): Promise<TaskRun> {
  const directory = directoryFor(options);
  const release = await acquireTaskLock(directory);
  const signal = dependencies.signal ?? new AbortController().signal;
  let run: TaskRun | undefined, pending = Promise.resolve();
  const log = createTaskLog(directory, dependencies.progress);
  const persist = () => {
    const snapshot = structuredClone(run!);
    const operation = pending.then(() => (dependencies.save ?? saveRun)(directory, snapshot));
    // A failed snapshot is reported to its caller, but cannot poison later saves.
    pending = operation.catch(() => {});
    return operation;
  };
  const progress = (message: string) => {
    if (!message) return;
    run!.lastMessage = message;
    log.write(message);
    void persist().catch(error => log.write('状态保存失败，将在后续更新重试：' + formatAgentError(error)));
  };
  try {
    run = await configureRun(options, directory);
    run.status = 'running'; delete run.error; delete run.output; delete run.activePipeline;
    run.runner = { id: randomUUID(), pid: process.pid, startedAt: now() };
    await persist();
    if (selectedPipelines(run.from, run.to).some(id => id.includes('raster') || id === 'character-assembly')) {
      if (!run.krita) throw new Error('本次路线包含 Krita 步骤，请用 --krita 指定已安装的可执行文件；不会自动下载或搜索。');
      await (dependencies.preflight ?? checkKrita)(run.krita);
    }
    signal.throwIfAborted();
    dependencies.ready?.(run);
    progress('总调度启动：' + directory + '；路线：' + selectedPipelines(run.from, run.to).join(' → '));
    for (const id of selectedPipelines(run.from, run.to)) {
      signal.throwIfAborted();
      run.activePipeline = id;
      run.pipelines[id] = { status: 'running', updatedAt: now() };
      await persist();
      progress('启动或恢复：' + id + '；由该管线校验已有产物和完成标记。');
      const result = await (dependencies.execute ?? executeChild)(id, run, {
        signal, progress, started: async pid => { run!.runner!.childPid = pid; await persist(); },
      });
      delete run.runner.childPid;
      run.pipelines[id] = { status: 'completed', updatedAt: now(), summary: result.summary };
      run.output = result.output;
      await persist();
      progress(id + '：已完成');
    }
    run.status = 'completed'; delete run.activePipeline;
    progress('所选路线已完成。交付：' + (run.output ?? directory));
    return run;
  } catch (error) {
    if (run) {
      run.status = signal.aborted ? 'interrupted' : 'failed';
      run.error = formatAgentError(error);
      if (run.activePipeline) run.pipelines[run.activePipeline] = { status: 'failed', updatedAt: now(), summary: run.error };
      progress(run.error);
    }
    throw error;
  } finally {
    try {
      if (run?.runner) { delete run.runner.childPid; run.runner.finishedAt = now(); await persist(); }
      await pending;
    } finally { try { await log.flush(); } finally { await release(); } }
  }
}

export async function lastLog(directory: string): Promise<string> {
  return (await readTaskLog(directory)).text;
}
