import { shadowMode, type ShadowMode } from '../shared/shadow.ts';
import { stepPattern } from '../shared/step-paths.js';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import { sectionIds, resolveInput, resolveRunsDirectory, taskDirectory, type SectionId } from '../shared/paths.ts';
import { defaultAgentConcurrency } from '../shared/codex/agent-runtime.ts';
import { readTaskLog } from './log.ts';
import { requireCurrentLayout } from './layout.ts';
import { currentSession, readStepSession } from '../shared/agents/step-session.ts';
import { readStep } from '../shared/step-chain.ts';
import { nineAxisProgressSteps, previousNineAxisSteps, previousNineAxisGroupSteps } from '../shared/nine-axis.ts';
import { installedVersion } from '../shared/version.ts';
import { copyAsPng, pngBytes } from '../shared/png.ts';

export type TaskOptions = {
  name: string; dir?: string; image?: string; krita?: string; ffmpeg?: string; knowledge?: string;
  from?: SectionId; to?: SectionId; jobs?: number; standard?: boolean; shadowMode?: ShadowMode; live?: boolean;
};
export type SectionProgress = {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'interrupted';
  updatedAt: string; summary?: string;
  // Completed without running: the base subject has no dress-up, so there is no clothing to make.
  skipped?: true;
};
export type TaskRun = {
  archive?: true;
  version: 1; from: SectionId; to: SectionId;
  krita?: string; ffmpeg?: string; jobs: number; standard?: boolean; shadowMode?: ShadowMode; live?: boolean;
  // The knowledge directory given with --knowledge; absent, the skill's own knowledge/.
  knowledge?: string;
  status: 'ready' | 'running' | 'completed' | 'failed' | 'interrupted';
  createdAt: string; updatedAt: string;
  // Release labels (shared/version.ts) of the version that created the task and that last configured a run.
  createdWith?: string; lastRunWith?: string;
  // Sections running now; after a failed or stopped run, the ones that ended it.
  activeSections?: SectionId[];
  // childPids: the worker process of each running section.
  runner?: { id: string; pid: number; childPids?: Partial<Record<SectionId, number>>; startedAt: string; finishedAt?: string };
  sections: Partial<Record<SectionId, SectionProgress>>;
  error?: string; output?: string;
};

export const now = () => new Date().toISOString();
export function sectionId(value: string): SectionId {
  if (!(sectionIds as readonly string[]).includes(value)) throw new Error('未知管线：' + value + '；可选：' + sectionIds.join(', '));
  return value as SectionId;
}
export function selectedSections(from: SectionId, to: SectionId): SectionId[] {
  const start = sectionIds.indexOf(from), end = sectionIds.indexOf(to);
  if (start < 0 || end < start) throw new Error('--from 必须位于 --to 之前或与其相同。');
  return sectionIds.slice(start, end + 1);
}
export function directoryFor(options: Pick<TaskOptions, 'name' | 'dir'>): string {
  // A total run may reach raster even when it starts with part.
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,127}$/u.test(options.name)) throw new Error('--name 必须以字母或数字开头，只含字母、数字、点、下划线和短横线，最多 128 字符。');
  return taskDirectory(options.name, resolveRunsDirectory(options.dir));
}
export async function readRun(directory: string): Promise<TaskRun | undefined> {
  await requireCurrentLayout(directory);
  let contents: string;
  try { contents = await readFile(join(directory, 'run.json'), 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const run = JSON.parse(contents) as TaskRun;
  if (run.version !== 1 || !run.sections || typeof run.sections !== 'object'
    || !Number.isSafeInteger(run.jobs) || run.jobs < 1 || (run.standard !== undefined && typeof run.standard !== 'boolean')
    || (run.knowledge !== undefined && typeof run.knowledge !== 'string')
    || (run.ffmpeg !== undefined && typeof run.ffmpeg !== 'string')
    || (run.live !== undefined && typeof run.live !== 'boolean')
    || !['ready', 'running', 'completed', 'failed', 'interrupted'].includes(run.status)) {
    throw new Error('无效的总控记录：' + join(directory, 'run.json'));
  }
  selectedSections(sectionId(run.from), sectionId(run.to));
  if (run.shadowMode !== undefined) shadowMode(run.shadowMode);
  return run;
}
export async function saveRun(directory: string, run: TaskRun, replace = rename): Promise<void> {
  run.updatedAt = now();
  const temporary = join(directory, '.run-' + randomUUID() + '.tmp');
  try {
    await writeFile(temporary, JSON.stringify(run, null, 2) + '\n', { mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      try { await replace(temporary, join(directory, 'run.json')); break; }
      catch (error) {
        // Readers/antivirus can briefly hold the destination on Windows.
        if (!['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '') || attempt >= 4) throw error;
        await delay(20 * 2 ** attempt);
      }
    }
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
export async function acquireTaskLock(directory: string): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true });
  try {
    return await lockfile.lock(directory, {
      lockfilePath: join(directory, '.runner.lock'), stale: 30_000, update: 10_000, retries: 0,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOCKED') {
      throw new Error('该任务已有总调度或恢复操作，不能重复启动。先用 --status 查看；意外退出的锁最多约 30 秒后过期。', { cause: error });
    }
    throw error;
  }
}
export function processAlive(pid: number | undefined): boolean {
  if (!pid || !Number.isSafeInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
}
// The task's original image, input/original.<ext>; undefined before one is given.
export async function taskOriginal(directory: string): Promise<string | undefined> {
  const folder = join(directory, 'input');
  const names = await readdir(folder).catch(error => {
    if (error.code === 'ENOENT') return [] as string[];
    throw error;
  });
  const originals = names.filter(name => /^original\.[^.]+$/.test(name));
  if (originals.length > 1) throw new Error('原图不唯一：' + folder);
  return originals[0] && join(folder, originals[0]);
}
// Keeps the given image as the task's original.
async function keepOriginal(directory: string, input?: string): Promise<void> {
  if (!input) return;
  if (!(await stat(input)).isFile()) throw new Error('输入图像不是文件：' + input);
  const retained = await taskOriginal(directory);
  if (retained) {
    if (!(await pngBytes(input)).equals(await pngBytes(retained))) {
      throw new Error('任务已有不同的原图：' + retained + '。制作另一张图请使用新的 --name。');
    }
  } else {
    await mkdir(join(directory, 'input'), { recursive: true });
    await copyAsPng(input, join(directory, 'input', 'original.png'));
  }
}
export const usesKrita = (selected: SectionId[]) => selected.some(id => id.includes('raster') || id === 'character-assembly' || id === 'shadow' || id === 'nine-axis');
// The route is shared by startup and preflight. Explicit ranges still select
// their own endpoint; --live changes the default shadow endpoint, including
// that of an existing whole run. Narrow saved ranges remain narrow.
export function taskRoute(options: Pick<TaskOptions, 'from' | 'to' | 'live'>, saved?: Pick<TaskRun, 'from' | 'to' | 'live'>) {
  const live = options.live ?? saved?.live ?? false;
  const from = options.from ?? saved?.from ?? 'part-layering';
  const savedEnd = saved?.to;
  const changeEnd = options.live !== undefined && (savedEnd === undefined || savedEnd === 'shadow' || savedEnd === 'nine-axis' && from !== savedEnd);
  const to = options.to ?? (changeEnd ? live ? 'nine-axis' : 'shadow' : savedEnd ?? (live ? 'nine-axis' : 'shadow'));
  selectedSections(from, to);
  return { from, to, live };
}
// The Krita executable for this run: the one given now, else the one the task recorded.
export function taskKrita(options: Pick<TaskOptions, 'name' | 'dir' | 'krita'>, saved: Pick<TaskRun, 'krita'> | undefined): string | undefined {
  return options.krita ? resolveInput(options.name, options.krita, options.dir) : saved?.krita;
}
// The coordinator may retain startup options; independent sections receive the
// path anew on every invocation and never recover it from their own outputs.
export function taskFFmpeg(options: Pick<TaskOptions, 'name' | 'dir' | 'ffmpeg'>, saved: Pick<TaskRun, 'ffmpeg'> | undefined): string | undefined {
  const path = options.ffmpeg || saved?.ffmpeg || process.env.ASTRA_STUDIO_FFMPEG;
  return path ? resolveInput(options.name, path, options.dir) : undefined;
}
export async function configureRun(options: TaskOptions, directory: string): Promise<TaskRun> {
  const saved = await readRun(directory);
  if (saved?.archive) throw new Error('这是导出的成果归档；请在原运行目录继续制作。');
  const { from, to, live } = taskRoute(options, saved);
  const selected = selectedSections(from, to);
  if (options.standard !== undefined && !selected.includes('part-layering')) {
    throw new Error('--standard / --no-standard 需要本次路线包含 part-layering；请用 --from part-layering 运行人物 preparation。');
  }
  const standard = options.standard ?? saved?.standard ?? false;
  const jobs = options.jobs ?? saved?.jobs ?? defaultAgentConcurrency;
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('--jobs 必须为正整数。');
  await keepOriginal(directory, options.image && resolveInput(options.name, options.image, options.dir));
  const run: TaskRun = saved ?? {
    version: 1, from, to, jobs, status: 'ready', createdAt: now(), updatedAt: now(), sections: {},
  };
  Object.assign(run, { from, to, live, jobs, standard, shadowMode: shadowMode(options.shadowMode ?? saved?.shadowMode) });
  const { label } = await installedVersion();
  if (!saved) run.createdWith = label;
  run.lastRunWith = label;
  run.krita = taskKrita(options, run);
  run.ffmpeg = taskFFmpeg(options, run);
  if (options.knowledge) run.knowledge = resolveInput(options.name, options.knowledge, options.dir);
  for (const id of selected) run.sections[id] ??= { status: 'pending', updatedAt: now() };
  return run;
}
export async function taskStatus(options: Pick<TaskOptions, 'name' | 'dir'>) {
  const directory = directoryFor(options);
  const run = await readRun(directory);
  if (!run) throw new Error('缺少总控记录：' + join(directory, 'run.json') + '。先用总入口启动；已有上游产物可指定 --from。');
  const runnerAlive = !run.runner?.finishedAt && processAlive(run.runner?.pid);
  const lockHeld = await lockfile.check(directory, { lockfilePath: join(directory, '.runner.lock'), stale: 30_000 });
  const sections = await Promise.all(selectedSections(run.from, run.to).map(async id => {
    const path = join(directory, id);
    let threadId: string | null | undefined, steps: { name: string; status: string; threadId?: string }[] = [];
    try {
      if (id === 'nine-axis') {
        // Fixed public paths include steps, branches and independent sessions.
        // Read them here rather than importing step-actions back into state.
        const names = [...nineAxisProgressSteps, ...previousNineAxisSteps, ...previousNineAxisGroupSteps];
        for (const name of names) {
          const { status } = await readStep(join(path, name));
          if (status === 'absent') continue;
          const session = await readStepSession(path, name);
          steps.push({ name, status, ...(session?.threadId ? { threadId: session.threadId } : {}) });
        }
        threadId = steps.find(step => step.status === 'running' && step.threadId)?.threadId
          ?? [...steps].reverse().find(step => step.threadId)?.threadId ?? null;
      } else {
        const entries = await readdir(path);
        steps = await Promise.all(entries.filter(name => stepPattern.test(name)).sort().map(async name => ({
          name, status: await stat(join(path, name, '.completed')).then(() => 'completed', () =>
            stat(join(path, name, '.running')).then(() => 'running', () => 'unmarked')),
        })));
        // The thread of the running step, else of the last step that kept one.
        threadId = (await currentSession(path, steps.map(step => ({ id: step.name, status: step.status }))))?.threadId ?? null;
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const saved = run.sections[id];
    return { id, ...(id === 'shadow' ? { mode: shadowMode(run.shadowMode) } : {}), ...saved,
      ...(saved?.status === 'running' && (!runnerAlive || !lockHeld) ? { status: 'interrupted' as const } : {}),
      directory: path, ...(threadId === undefined ? {} : { threadId }), steps };
  }));
  const log = await readTaskLog(directory);
  return {
    ...run, status: run.status === 'running' && (!runnerAlive || !lockHeld) ? 'interrupted' : run.status,
    directory, runnerAlive: !!runnerAlive, lockHeld, sections,
    lastMessage: log.message, log: log.path, logUpdatedAt: log.updatedAt,
    monitor: join(directory, 'monitor.md'),
  };
}
