import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipelineIds } from '../.agents/skills/live2d-maker/shared/paths.ts';
import { readRun, taskStatus, type TaskRun } from '../.agents/skills/live2d-maker/workflow/state.ts';
import { steps as personSteps } from '../.agents/skills/live2d-maker/raster-layering/steps.ts';
import { steps as clothingSteps } from '../.agents/skills/live2d-maker/clothing-raster-layering/steps.ts';
import { steps as assemblySteps } from '../.agents/skills/live2d-maker/character-assembly/steps.ts';
import { nextReviewTask } from '../.agents/skills/live2d-maker/shared/raster/review.ts';
import { inventory, jsonFile, safePath } from './files.ts';
import { partProgress, phases } from './part-progress.ts';
import { readTaskLog } from '../.agents/skills/live2d-maker/workflow/log.ts';

export { phases } from './part-progress.ts';
export const rasterDefinitions = { 'raster-layering': personSteps, 'clothing-raster-layering': clothingSteps, 'character-assembly': assemblySteps };
export type Status = 'done' | 'running' | 'pending' | 'failed' | 'interrupted' | 'available' | 'skipped' | 'unconfirmed';
export const statusOf = (value?: string): Status => value === 'completed' ? 'done' : value === 'ready' ? 'pending' : ['running', 'failed', 'interrupted'].includes(value ?? '') ? value as Status : 'pending';
const flatten = (nodes: any[]): any[] => nodes.flatMap(node => [node, ...flatten(node.groups ?? [])]);
function validateGroups(nodes: any[], depth = 0) {
  if (depth > 40 || !Array.isArray(nodes)) throw new Error('groups 层级无效');
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || node.id.startsWith('/') || /[\\\0]/.test(node.id)
      || node.id.split('/').some((segment: string) => !segment || segment === '.' || segment === '..')) throw new Error('group id 无效');
    if (node.groups !== undefined) validateGroups(node.groups, depth + 1);
  }
}
export async function summary(directory: string, name: string, dir: string) {
  const run = await readRun(directory, name);
  if (!run) return { name, status: 'untracked', directory, run: undefined, runnerAlive: false, lockHeld: false };
  const live = await taskStatus({ name, dir });
  return { name, status: live.status, directory, run, runnerAlive: live.runnerAlive, lockHeld: live.lockHeld };
}
export async function snapshot(directory: string, name: string, dir: string) {
  const errors: string[] = [];
  const record = await summary(directory, name, dir).catch(error => {
    errors.push(String(error)); return { name, status: 'failed', directory, run: undefined as TaskRun | undefined, runnerAlive: false, lockHeld: false };
  });
  const files = await inventory(directory), fileSet = new Set(files);
  const optional = async (path: string) => jsonFile(directory, path).catch(error => { errors.push(String(error)); return undefined; });
  const exists = async (path: string) => {
    try { return (await lstat(await safePath(directory, path))).isFile(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(String(error)); return false; }
  };
  const pipelines = [];
  for (const id of pipelineIds) {
    const active = record.runnerAlive && record.lockHeld && record.run?.activePipeline === id;
    const saved = record.run?.pipelines[id];
    const config = await optional(id + '/run.json');
    const states: Record<string, Status> = {};
    const messages: Record<string, string> = {};
    const observed = (value?: string): Status => value === 'running' ? (active ? 'running' : record.status === 'failed' ? 'failed' : 'unconfirmed') : statusOf(value);
    const artifactStatus = (paths: string[]) => paths.some(path => fileSet.has(id + '/' + path)) ? 'available' as const : 'pending' as const;
    let groups: any[] = [];
    if (id === 'part-layering' || id === 'clothing-part-layering') {
      const document = await optional(id + '/groups.json');
      try { validateGroups(document?.groups ?? []); groups = document?.groups ?? []; }
      catch (error) { errors.push(id + ': ' + String(error)); }
      const all = flatten(groups);
      await partProgress(directory, id, groups, fileSet, optional, errors, active ? record.run?.runner?.startedAt : undefined);
      states.initial = all.length ? 'available' : 'pending';
      const prep = await optional(id + '/references/preparation.json');
      states.preparation = prep ? 'available' : 'pending';
      states.standard = artifactStatus(['references/standard.png']);
      states.simplified = artifactStatus(['references/simplified-subject.png', 'references/simplified-subject.jpg', 'references/simplified-subject.webp']);
      states.base = artifactStatus(['references/base-subject.png', 'references/base-subject.jpg', 'references/base-subject.webp']);
      states.clothing = artifactStatus(['references/clothing.png']);
      for (const phase of phases) {
        const values = all.map(node => node.webPhases[phase]);
        states[phase] = values.includes('failed') ? 'failed' : values.includes('running') ? 'running'
          : values.includes('unconfirmed') ? 'unconfirmed' : values.length && values.every(v => v === 'done') ? 'done'
            : values.some(v => v === 'available' || v === 'done') ? 'available' : 'pending';
      }
      const values = phases.map(phase => states[phase]);
      states.layers = values.includes('failed') ? 'failed' : values.includes('running') ? 'running' : values.includes('unconfirmed') ? 'unconfirmed'
        : values.every(v => v === 'done') ? 'done' : all.length ? 'available' : 'pending';
      states.merge = document?.merge?.status ? observed(document.merge.status) : artifactStatus(['preview.svg']);
      states.occlusion = artifactStatus(['occlusion.json']);
      // Preparatory substeps have no execution markers; their files prove availability only.
      if (saved?.status === 'completed') {
        for (const key of ['initial', 'preparation', 'standard', 'simplified', 'base', 'clothing', 'occlusion']) {
          if (states[key] === 'available') states[key] = 'done';
        }
      }
    } else {
      for (const step of rasterDefinitions[id]) {
        const prefix = id + '/' + step.id;
        const completed = await exists(prefix + '/.completed'), running = await exists(prefix + '/.running');
        const missing = [];
        for (const path of step.requiredFiles) {
          if (!await exists(prefix + '/' + path)) missing.push(path);
        }
        states[step.id] = completed ? (missing.length ? 'failed' : 'done') : running ? observed('running')
          : files.some(path => path.startsWith(prefix + '/')) ? 'available' : 'pending';
        if (completed && missing.length) messages[step.id] = '.completed 存在但缺少交付：' + missing.join('、');
        if ('review' in step && step.review) {
          states.draw = fileSet.has(prefix + '/report.md') ? 'done' : states[step.id];
          const sequence = ['review-01', 'repair-01', 'review-02', 'repair-02'];
          let next: Awaited<ReturnType<typeof nextReviewTask>>;
          try { next = await nextReviewTask(await safePath(directory, prefix)); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              messages[step.id] = String(error); states[step.id] = 'failed';
            }
          }
          for (const phase of sequence) {
            states[phase] = fileSet.has(prefix + '/' + phase + '.md') ? 'done'
              : next?.filename === phase + '.md' && states.draw === 'done' && running ? observed('running')
                : !next && fileSet.has(prefix + '/review-01.md') && states[step.id] !== 'failed' ? 'skipped' : 'pending';
          }
          if (completed && next) {
            states[step.id] = 'failed'; messages[step.id] = '.completed 存在但 review / repair 尚未结束：' + next.filename;
          }
        }
      }
    }
    let status: Status = active ? 'running' : observed(saved?.status);
    if (!saved) status = Object.values(states).includes('failed') ? 'failed' : Object.values(states).includes('unconfirmed') ? 'unconfirmed'
      : files.some(path => path.startsWith(id + '/')) ? 'available' : 'pending';
    if (Object.values(states).includes('failed') && !active) status = 'failed';
    if (id in rasterDefinitions && status === 'done' && Object.entries(states).some(([key, value]) => key.startsWith('step') && value !== 'done')) {
      status = 'interrupted'; // Root coordinator history must not hide a removed step marker.
    }
    pipelines.push({ id, status, states, messages, groups, threadId: config?.threadId ?? null, summary: saved?.summary });
  }
  const log = await readTaskLog(directory);
  const worker = await optional('.web-worker.json');
  // The URL version changes when an existing draft is rewritten, even if no log or filename changes.
  const fileVersions: Record<string, string> = {};
  const previewFiles = files.filter(path => /\.(svg|png|jpe?g|webp|md|json)$/i.test(path) && !path.includes('/agents/'));
  for (let index = 0; index < previewFiles.length; index += 16) {
    await Promise.all(previewFiles.slice(index, index + 16).map(async path => {
      try { const info = await lstat(await safePath(directory, path)); fileVersions[path] = `${info.mtimeMs}:${info.size}`; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(path + ': ' + String(error)); }
    }));
  }
  return { ...record, files, fileVersions, pipelines, errors, logs: log.text,
    logPath: log.path, logUpdatedAt: log.updatedAt, lastLogMessage: log.message,
    canStop: !!(record.runnerAlive && record.lockHeld && worker?.runnerId === record.run?.runner?.id),
    original: files.find(path => /^input\/original\.(png|jpe?g|webp)$/i.test(path)),
    reference: files.find(path => /^part-layering\/references\/simplified-subject\.(png|jpe?g|webp)$/i.test(path)),
  };
}
