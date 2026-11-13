import { fork, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTaskLog, readTaskLog } from './log.ts';
import { formatAgentError } from '../shared/codex/diagnostics.ts';
import { fromTaskPath, toTaskPath } from '../shared/task-paths.ts';
import { sectionIds, type SectionId } from '../shared/paths.ts';
import { checkKrita, type KritaInstallation } from '../shared/raster/krita.ts';
import type { SectionResult } from './sections.ts';
import { acquireTaskLock, configureRun, directoryFor, now, saveRun, selectedSections, type TaskOptions, type TaskRun } from './state.ts';
import { loadWorkflowEnvironment, type WorkflowEnvironment } from '../shared/codex/environment.ts';
import { sectionAgentSteps, preflightAgentSteps } from '../shared/agents/preflight.ts';
import { clearTaskStop, watchTaskStop } from './control.ts';
import { requireKrita } from './krita.ts';
import { requireFFmpeg } from './ffmpeg.ts';
import { type FFmpegCheck } from '../shared/ffmpeg.ts';
import { defaultKnowledgeDirectory, selectKnowledge } from '../shared/knowledge.ts';
import { MissingDependencyError } from '../shared/missing-dependency.ts';
import { readDressup } from '../shared/part/dressup.ts';
import { AgentSlotPool, agentSlotsVariable } from './agent-slots.ts';
import { requireVideoApi } from '../shared/video.ts';

export type SectionExecution = (id: SectionId, run: TaskRun, context: {
  // The task directory, <runs root>/<task name>.
  directory: string;
  signal: AbortSignal; progress(message: string): void; started(pid: number): Promise<void>;
  // The task's agent slots, shared by every section worker it starts.
  slots?: AgentSlotPool;
  // part-layering has its references: the sections waiting for them may start.
  prepared?(): void;
}) => Promise<SectionResult>;

// What each section waits for. The clothing lane needs only the character's
// prepared references, so it runs beside the character lane from then on; both
// lanes meet again at the assembly. A section outside the route counts as done.
export const sectionDependencies: Record<SectionId, readonly { id: SectionId; prepared?: true }[]> = {
  'part-layering': [],
  'raster-layering': [{ id: 'part-layering' }],
  'clothing-part-layering': [{ id: 'part-layering', prepared: true }],
  'clothing-raster-layering': [{ id: 'clothing-part-layering' }],
  'character-assembly': [{ id: 'raster-layering' }, { id: 'clothing-raster-layering' }],
  'shadow': [{ id: 'character-assembly' }],
  'nine-axis': [{ id: 'shadow' }],
};

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
export const executeChild: SectionExecution = async (id, run, context) => {
  context.signal.throwIfAborted();
  const { directory } = context;
  return new Promise<SectionResult>((resolve, reject) => {
    const child = fork(fileURLToPath(new URL('./section-worker.ts', import.meta.url)), [directory, id, run.runner!.id], {
      cwd: directory, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: context.slots ? { ...process.env, [agentSlotsVariable]: 'ipc' } : process.env,
    });
    context.slots?.attach(child);
    let result: SectionResult | undefined, failure = '', output = '', killTimer: NodeJS.Timeout | undefined;
    const abort = () => { terminate(child); killTimer = setTimeout(() => terminate(child, true), 10_000); killTimer.unref(); };
    context.signal.addEventListener('abort', abort, { once: true });
    for (const stream of [child.stdout, child.stderr]) stream!.on('data', data => {
      const text = String(data); output = (output + text).slice(-64 * 1024); context.progress(text.trimEnd());
    });
    child.on('message', message => {
      const value = message as { type?: string; result?: SectionResult; message?: string };
      if (value.type === 'result') result = value.result;
      if (value.type === 'failure') failure = value.message ?? '';
      if (value.type === 'prepared') context.prepared?.();
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

// The route as lanes: the clothing lane runs beside the character lane.
function routeText(selected: SectionId[]) {
  const lanes = [['raster-layering'], ['clothing-part-layering', 'clothing-raster-layering']]
    .map(lane => lane.filter(id => selected.includes(id as SectionId))).filter(lane => lane.length);
  const before = selected.filter(id => id === 'part-layering'), after = selected.filter(id => sectionIds.indexOf(id) > sectionIds.indexOf('clothing-raster-layering'));
  const middle = lanes.length > 1 ? '[' + lanes.map(lane => lane.join(' → ')).join(' ∥ ') + ']' : lanes.flat().join(' → ');
  return [...before, middle, ...after].filter(Boolean).join(' → ');
}

const clothingSkipped = '素体换装沿用了简化参考，没有衣服需要拆分和绘制，跳过';

export async function runTask(options: TaskOptions, dependencies: {
  execute?: SectionExecution; signal?: AbortSignal; progress?: (message: string) => void;
  ready?: (run: TaskRun) => void;
  // Called instead of waiting for ready when the preflight has to build the
  // patched Codex: the task lock is held and the run is recorded as running, so
  // a launcher can confirm the start; the build and its outcome go to the log.
  preparing?: (run: TaskRun) => void;
  environment?: WorkflowEnvironment;
  preflight?: (path: string) => Promise<KritaInstallation>;
  ffmpegCheck?: FFmpegCheck;
  save?: typeof saveRun;
} = {}): Promise<TaskRun> {
  const directory = directoryFor(options);
  const release = await acquireTaskLock(directory);
  const stopController = new AbortController();
  const signal = dependencies.signal ? AbortSignal.any([dependencies.signal, stopController.signal]) : stopController.signal;
  let stopWatching: (() => void) | undefined;
  let run: TaskRun | undefined, pending = Promise.resolve();
  const log = createTaskLog(directory, dependencies.progress);
  const persist = () => {
    const snapshot = structuredClone(run!);
    const operation = pending.then(() => (dependencies.save ?? saveRun)(directory, snapshot));
    // A failed snapshot is reported to its caller, but cannot poison later saves.
    pending = operation.catch(() => {});
    return operation;
  };
  const progress = (message: string) => { if (message) log.write(message); };
  try {
    // Krita is checked before the run is recorded as running, and before the agent
    // preflight: it is quick, while that may build the patched Codex. A refusal
    // leaves run.json as it was.
    const configured = await configureRun(options, directory);
    // Like Krita, the knowledge directory is checked before the run is recorded as running;
    // the scheduler's own preflight then reads the same directory as its section workers.
    selectKnowledge(configured.knowledge ?? defaultKnowledgeDirectory);
    const environment = !dependencies.execute || dependencies.environment ? dependencies.environment ?? loadWorkflowEnvironment() : undefined;
    if (environment && selectedSections(configured.from, configured.to).includes('nine-axis')) requireVideoApi(environment);
    // A missing system dependency such as Xvfb is the exception: the run is recorded as failed with its install hint.
    const missing = await requireKrita(configured, !!options.krita, dependencies.preflight ?? (path => checkKrita(path, environment?.codex.env)))
      .then(() => undefined, error => { if (error instanceof MissingDependencyError) return error; throw error; });
    await requireFFmpeg(configured, dependencies.ffmpegCheck);
    run = configured;
    run.status = 'running'; delete run.error; delete run.output; delete run.activeSections;
    run.runner = { id: randomUUID(), pid: process.pid, startedAt: now() };
    const slots = new AgentSlotPool(run.jobs);
    await persist();
    if (missing) throw missing;
    stopWatching = watchTaskStop(directory, run.runner.id, stopController,
      error => log.write('停止请求读取失败：' + formatAgentError(error)));
    const selected = selectedSections(run.from, run.to);
    if (environment) {
      const standard = run.standard;
      await preflightAgentSteps(environment, selected.flatMap(id => id === 'nine-axis'
        ? ['nine_axis_view_frames', 'nine_axis_outline', 'nine_axis_head', 'nine_axis_frames', 'nine_axis_head_xy', 'nine_axis_head_jaw', 'nine_axis_head_hair', 'nine_axis_head_accessories'] as const
        : sectionAgentSteps(id, standard, run!.shadowMode)), { runsRoot: dirname(directory), progress,
        building: () => { progress('准备中：构建补丁版 Codex，完成后自动开始；构建期间的停止请求在构建结束后生效。'); dependencies.preparing?.(run!); } });
    }
    signal.throwIfAborted();
    dependencies.ready?.(run);
    progress('总调度启动：' + directory + '；路线：' + routeText(selected));
    const done = new Set<SectionId>(), prepared = new Set<SectionId>(), stopped = new Set<SectionId>(), unfinished = new Set<SectionId>();
    const errors: unknown[] = [];
    let delivered = -1;
    const reached = (dependency: { id: SectionId; prepared?: true }) => !selected.includes(dependency.id)
      || done.has(dependency.id) || (!!dependency.prepared && prepared.has(dependency.id));
    const active = () => { run!.activeSections = sectionIds.filter(id => run!.sections[id]?.status === 'running' || stopped.has(id)); };
    const lane = async (id: SectionId) => {
      signal.throwIfAborted();
      // Once drawing has started, its upstream structural corrections are authoritative.
      const downstream = id === 'part-layering' ? 'raster-layering'
        : id === 'clothing-part-layering' ? 'clothing-raster-layering' : undefined;
      if (downstream && selected.includes(downstream)
        && run!.sections[id]?.status === 'completed' && !run!.sections[id]!.skipped && run!.sections[downstream]
        && run!.sections[downstream]!.status !== 'pending') {
        progress('沿用已完成的分层产物及绘画阶段保存的结构修正：' + id);
        return;
      }
      // Without a dress-up nothing is worn to separate. A clothing lane that
      // had already completed is kept as it is.
      if ((id === 'clothing-part-layering' || id === 'clothing-raster-layering') && await readDressup(directory) === false
        && !(run!.sections[id]?.status === 'completed' && !run!.sections[id]!.skipped)) {
        run!.sections[id] = { status: 'completed', skipped: true, updatedAt: now(), summary: clothingSkipped };
        await persist();
        progress(id + '：' + clothingSkipped);
        return;
      }
      run!.sections[id] = { status: 'running', updatedAt: now() };
      active(); await persist();
      progress('启动或恢复：' + id + '；由该管线校验已有产物和完成标记。');
      try {
        const result = await (dependencies.execute ?? executeChild)(id, run!, {
          directory, signal, progress, slots,
          started: async pid => { (run!.runner!.childPids ??= {})[id] = pid; await persist(); },
          prepared: () => { if (!prepared.has(id)) { prepared.add(id); schedule(); } },
        });
        if(result.completed===false) {
          unfinished.add(id);
          run!.sections[id]={status:'interrupted',updatedAt:now(),summary:result.summary};
          progress(id+'：'+result.summary); return;
        }
        run!.sections[id] = { status: 'completed', updatedAt: now(), summary: result.summary };
        // The delivery is the one of the furthest section completed.
        if (sectionIds.indexOf(id) > delivered) { delivered = sectionIds.indexOf(id); run!.output = result.output && toTaskPath(directory, result.output); }
        progress(id + '：已完成');
      } catch (error) {
        stopped.add(id);
        run!.sections[id] = { status: signal.aborted ? 'interrupted' : 'failed', updatedAt: now(), summary: formatAgentError(error) };
        throw error;
      } finally {
        delete run!.runner!.childPids?.[id];
        active(); await persist();
      }
    };
    // Starts every section whose upstream is ready; a failed section blocks
    // what depends on it, while the other lane runs on to its own end.
    let schedule: () => void = () => {};
    await new Promise<void>(resolve => {
      const waiting = new Set(selected), blocked = new Set<SectionId>();
      let running = 0;
      schedule = () => {
        for (const id of selected) {
          if (!waiting.has(id)) continue;
          if (signal.aborted || sectionDependencies[id].some(dependency => blocked.has(dependency.id))) {
            waiting.delete(id); blocked.add(id); continue;
          }
          if (!sectionDependencies[id].every(reached)) continue;
          waiting.delete(id); running++;
          void lane(id).then(() => { if(!unfinished.has(id)) done.add(id); }, error => { blocked.add(id); errors.push(error); })
            .finally(() => { running--; schedule(); });
        }
        if (!running) resolve();
      };
      schedule();
    });
    if (errors.length) {
      // Report the lane's own failure rather than the stop it caused elsewhere.
      for (const error of errors.slice(1)) progress(formatAgentError(error));
      throw signal.aborted ? signal.reason : errors[0];
    }
    signal.throwIfAborted();
    if(unfinished.size) {
      run.status='interrupted'; delete run.activeSections;
      progress('当前轮次已保存，所选路线尚有后续制作任务。'); return run;
    }
    run.status = 'completed'; delete run.activeSections;
    progress('所选路线已完成。交付：' + (run.output ? fromTaskPath(directory, run.output) : directory));
    return run;
  } catch (error) {
    if (run) {
      run.status = signal.aborted ? 'interrupted' : 'failed';
      run.error = formatAgentError(error);
      progress(run.error);
    } else log.write(formatAgentError(error));
    throw error;
  } finally {
    stopWatching?.();
    try {
      if (run?.runner) { delete run.runner.childPids; run.runner.finishedAt = now(); await persist(); }
      await pending;
    } finally {
      try { if (run?.runner) await clearTaskStop(directory, run.runner.id); }
      finally { try { await log.flush(); } finally { await release(); } }
    }
  }
}

export async function lastLog(directory: string): Promise<string> {
  return (await readTaskLog(directory)).text;
}
