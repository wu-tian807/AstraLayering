import { shadowMode, type ShadowMode } from '../shared/shadow.ts';
import { randomUUID, createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { extname, join, relative } from 'node:path';
import lockfile from 'proper-lockfile';
import { pipelineIds, resolveInput, resolveRunsDirectory, taskDirectory, type PipelineId } from '../shared/paths.ts';
import { defaultAgentConcurrency } from '../shared/codex/agent-runtime.ts';
import { readPreparationOptions } from '../shared/part/preparation-cache.ts';
import { readTaskLog } from './log.ts';

export type TaskOptions = {
  name: string; dir?: string; image?: string; krita?: string;
  from?: PipelineId; to?: PipelineId; jobs?: number; standard?: boolean; shadowMode?: ShadowMode; physicsProfile?: 'primary' | 'all'; physicsEnabled?: boolean; physicsReference?:string;
};
export type PipelineProgress = {
  status: 'pending' | 'running' | 'completed' | 'failed';
  updatedAt: string; summary?: string;
};
export type TaskRun = {
  version: 1; name: string; dir: string; from: PipelineId; to: PipelineId;
  image?: string; krita?: string; jobs: number; standard?: boolean; shadowMode?: ShadowMode; physicsProfile?: 'primary' | 'all'; physicsEnabled?: boolean; physicsReference?:string;
  status: 'ready' | 'running' | 'completed' | 'failed' | 'interrupted';
  createdAt: string; updatedAt: string;
  activePipeline?: PipelineId;
  runner?: { id: string; pid: number; childPid?: number; startedAt: string; finishedAt?: string };
  pipelines: Partial<Record<PipelineId, PipelineProgress>>;
  lastMessage?: string; error?: string; output?: string;
};

export const now = () => new Date().toISOString();
export function pipelineId(value: string): PipelineId {
  if (!(pipelineIds as readonly string[]).includes(value)) throw new Error('未知管线：' + value + '；可选：' + pipelineIds.join(', '));
  return value as PipelineId;
}
export function selectedPipelines(from: PipelineId, to: PipelineId): PipelineId[] {
  const start = pipelineIds.indexOf(from), end = pipelineIds.indexOf(to);
  if (start < 0 || end < start) throw new Error('--from 必须位于 --to 之前或与其相同。');
  return pipelineIds.slice(start, end + 1);
}
export function directoryFor(options: Pick<TaskOptions, 'name' | 'dir'>): string {
  // A total run may reach raster even when it starts with part.
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,127}$/u.test(options.name)) throw new Error('--name 必须以字母或数字开头，只含字母、数字、点、下划线和短横线，最多 128 字符。');
  return taskDirectory(options.name, resolveRunsDirectory(options.dir));
}
export async function readRun(directory: string, name: string): Promise<TaskRun | undefined> {
  let contents: string;
  try { contents = await readFile(join(directory, 'run.json'), 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const run = JSON.parse(contents) as TaskRun;
  if (run.version !== 1 || run.name !== name || !run.pipelines || typeof run.pipelines !== 'object'
    || !Number.isSafeInteger(run.jobs) || run.jobs < 1 || (run.standard !== undefined && typeof run.standard !== 'boolean')
    || !['ready', 'running', 'completed', 'failed', 'interrupted'].includes(run.status)) {
    throw new Error('无效的总控记录：' + join(directory, 'run.json'));
  }
  selectedPipelines(pipelineId(run.from), pipelineId(run.to));
  if (run.shadowMode !== undefined) shadowMode(run.shadowMode);
  if (run.physicsProfile !== undefined && !['primary','all'].includes(run.physicsProfile)) throw Error('物理范围无效');
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
async function originalImage(directory: string, input?: string): Promise<string | undefined> {
  const folder = join(directory, 'input');
  const names = await readdir(folder).catch(error => {
    if (error.code === 'ENOENT') return [] as string[];
    throw error;
  });
  const originals = names.filter(name => /^original\.[^.]+$/.test(name));
  if (originals.length > 1) throw new Error('原图不唯一：' + folder);
  let retained = originals[0] && join(folder, originals[0]);
  if (input) {
    if (!(await stat(input)).isFile()) throw new Error('输入图像不是文件：' + input);
    if (retained) {
      const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
      if (hash(await readFile(input)) !== hash(await readFile(retained))) {
        throw new Error('任务已有不同的原图：' + retained + '。制作另一张图请使用新的 --name。');
      }
    } else {
      await mkdir(folder, { recursive: true });
      retained = join(folder, 'original' + (extname(input) || '.png'));
      await copyFile(input, retained);
    }
  }
  return retained ? relative(directory, retained) : undefined;
}
export async function configureRun(options: TaskOptions, directory: string): Promise<TaskRun> {
  const saved = await readRun(directory, options.name);
  const from = options.from ?? saved?.from ?? 'part-layering';
  const to = options.to ?? (options.physicsEnabled === true ? 'physics' : options.physicsEnabled === false && saved?.to === 'physics' && from !== 'physics' ? 'shadow' : saved?.to ?? 'shadow');
  const selected = selectedPipelines(from, to);
  if (options.standard !== undefined && !selected.includes('part-layering')) {
    throw new Error('--standard / --no-standard 需要本次路线包含 part-layering；请用 --from part-layering 运行人物 preparation。');
  }
  const standard = options.standard ?? saved?.standard
    ?? await readPreparationOptions(join(directory, 'part-layering/references')) ?? false;
  const jobs = options.jobs ?? saved?.jobs ?? defaultAgentConcurrency;
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('--jobs 必须为正整数。');
  const image = await originalImage(directory, options.image && resolveInput(options.name, options.image, options.dir));
  const run: TaskRun = saved ?? {
    version: 1, name: options.name, dir: resolveRunsDirectory(options.dir), from, to, jobs,
    status: 'ready', createdAt: now(), updatedAt: now(), pipelines: {},
  };
  Object.assign(run, { dir: resolveRunsDirectory(options.dir), from, to, jobs, standard,
    physicsProfile: options.physicsProfile ?? saved?.physicsProfile ?? 'primary', physicsEnabled: to === 'physics',
    shadowMode: shadowMode(options.shadowMode ?? saved?.shadowMode) });
  run.image = image ?? saved?.image;
  if(options.physicsReference)run.physicsReference=resolveInput(options.name,options.physicsReference,options.dir);
  if (options.krita) run.krita = resolveInput(options.name, options.krita, options.dir);
  if (!run.krita && selected.some(id => id.includes('raster') || id === 'character-assembly' || id === 'shadow' || id === 'physics')) {
    for (const id of ['raster-layering', 'clothing-raster-layering', 'character-assembly', 'shadow/mask', 'shadow/normal-depth', 'physics']) {
      try {
        const config = JSON.parse(await readFile(join(directory, id, 'run.json'), 'utf8'));
        if (typeof config.krita?.executable === 'string') { run.krita = config.krita.executable; break; }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  for (const id of selected) run.pipelines[id] ??= { status: 'pending', updatedAt: now() };
  return run;
}
export async function taskStatus(options: Pick<TaskOptions, 'name' | 'dir'>) {
  const directory = directoryFor(options);
  const run = await readRun(directory, options.name);
  if (!run) throw new Error('缺少总控记录：' + join(directory, 'run.json') + '。先用总入口启动；已有上游产物可指定 --from。');
  const runnerAlive = !run.runner?.finishedAt && processAlive(run.runner?.pid);
  const lockHeld = await lockfile.check(directory, { lockfilePath: join(directory, '.runner.lock'), stale: 30_000 });
  const pipelines = await Promise.all(selectedPipelines(run.from, run.to).map(async id => {
    const path = join(directory, id, id === 'shadow' ? shadowMode(run.shadowMode) : '');
    let threadId: string | null | undefined, steps: { name: string; status: string }[] = [];
    try {
      const config = JSON.parse(await readFile(join(path, 'run.json'), 'utf8'));
      threadId = config.threadId;
      const entries = await readdir(path);
      steps = await Promise.all(entries.filter(name => /^step\d{2}$/.test(name)).sort().map(async name => ({
        name, status: await stat(join(path, name, '.completed')).then(() => 'completed', () =>
          stat(join(path, name, '.running')).then(() => 'running', () => 'unmarked')),
      })));
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return { id, ...(id === 'shadow' ? { mode: shadowMode(run.shadowMode) } : {}), ...run.pipelines[id], directory: path, ...(threadId === undefined ? {} : { threadId }), steps };
  }));
  const log = await readTaskLog(directory);
  return {
    ...run, status: run.status === 'running' && !runnerAlive ? 'interrupted' : run.status,
    directory, runnerAlive: !!runnerAlive, lockHeld, pipelines,
    lastMessage: log.message ?? run.lastMessage, log: log.path, logUpdatedAt: log.updatedAt,
    monitor: join(directory, 'monitor.md'),
  };
}
