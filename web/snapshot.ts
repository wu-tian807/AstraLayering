import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { shadowMode, shadowModes } from '../.agents/skills/live2d-maker/shared/shadow.ts';
import { stepsFor } from '../.agents/skills/live2d-maker/shadow/steps.ts';
import { pipelineIds } from '../.agents/skills/live2d-maker/shared/paths.ts';
import { readRun, taskStatus, type TaskRun } from '../.agents/skills/live2d-maker/workflow/state.ts';
import { steps as personSteps } from '../.agents/skills/live2d-maker/raster-layering/steps.ts';
import { steps as clothingSteps } from '../.agents/skills/live2d-maker/clothing-raster-layering/steps.ts';
import { steps as physicsSteps } from '../.agents/skills/live2d-maker/physics/steps.ts';
import { steps as assemblySteps } from '../.agents/skills/live2d-maker/character-assembly/steps.ts';
import { nextReviewTask } from '../.agents/skills/live2d-maker/shared/raster/review.ts';
import { inventory, jsonFile, safePath } from './files.ts';
import { partProgress, phases } from './part-progress.ts';
import { readTaskLog } from '../.agents/skills/live2d-maker/workflow/log.ts';
import { projectDisplayName } from './project-metadata.ts';
import { reportPreview, type ReportPreview } from './report.ts';

export { phases } from './part-progress.ts';
export const rasterDefinitions = { 'raster-layering': personSteps, 'clothing-raster-layering': clothingSteps, 'character-assembly': assemblySteps, physics: physicsSteps };
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
  const displayName = await projectDisplayName(directory, name);
  const run = await readRun(directory, name);
  if (!run) return { name, displayName, status: 'untracked', directory, run: undefined, runnerAlive: false, lockHeld: false };
  const live = await taskStatus({ name, dir });
  return { name, displayName, status: live.status, directory, run, runnerAlive: live.runnerAlive, lockHeld: live.lockHeld };
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
    const mode = shadowMode(record.run?.shadowMode);
    const branch = id === 'shadow' ? id + '/' + mode : id;
    const config = await optional(branch + '/run.json');
    const states: Record<string, Status> = {};
    const messages: Record<string, string> = {};
    const previews: Record<string, { path: string; savedAt: string }> = {};
    const feedback: Record<string, string> = {};
    const reports: Record<string, ReportPreview> = {};
    const loadReport = async (key: string, path: string) => {
      const source = fileSet.has(path) ? path : fileSet.has(path + '.tmp') ? path + '.tmp' : undefined;
      if (!source) return;
      try {
        const text = await readFile(await safePath(directory, source), 'utf8');
        reports[key] = await reportPreview(directory, source, text, fileSet);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(source + ': ' + String(error)); }
    };
    const observed = (value?: string): Status => value === 'running' ? (active ? 'running' : record.status === 'failed' ? 'failed' : 'unconfirmed') : statusOf(value);
    let groups: any[] = [];
    if (id === 'part-layering' || id === 'clothing-part-layering') {
      const document = await optional(id + '/groups.json');
      try { validateGroups(document?.groups ?? []); groups = document?.groups ?? []; }
      catch (error) { errors.push(id + ': ' + String(error)); }
      const all = flatten(groups);
      const failedSince = !active && record.status === 'failed' && record.run?.activePipeline === id ? record.run.runner?.startedAt : undefined;
      const progress = await partProgress(directory, id, groups, fileSet, optional, errors, active ? record.run?.runner?.startedAt : undefined, failedSince);
      Object.assign(states, progress.states); Object.assign(messages, progress.messages);
      for (const phase of phases) {
        const values = all.map(node => node.webPhases[phase]);
        states[phase] = values.includes('failed') ? 'failed' : values.includes('running') ? 'running'
          : values.includes('unconfirmed') ? 'unconfirmed' : values.length && values.every(v => v === 'done') ? 'done'
            : values.some(v => v === 'available' || v === 'done') ? 'available' : 'pending';
      }
      const values = phases.map(phase => states[phase]);
      states.layers = values.includes('failed') ? 'failed' : values.includes('running') ? 'running' : values.includes('unconfirmed') ? 'unconfirmed'
        : values.every(v => v === 'done') ? 'done' : all.length ? 'available' : 'pending';
      // Legacy completed pipelines can lack individual reference fingerprints.
      if (saved?.status === 'completed') {
        for (const key of ['initial', 'preparation', 'standard', 'simplified', 'base', 'clothing']) {
          if (states[key] === 'available') states[key] = 'done';
        }
      }
    } else {
      for (const step of id === 'shadow' ? stepsFor(mode) : rasterDefinitions[id]) {
        const prefix = branch + '/' + step.id;
        await loadReport(step.id, prefix + '/report.md');
        const candidates = await Promise.all(files.filter(path => path.startsWith(prefix + '/') && /\.kra$/i.test(path)
          && !path.split('/').some(segment => segment.startsWith('.') || ['agents', 'recovery', 'archive'].includes(segment)))
          .map(async path => ({ path, info: await lstat(await safePath(directory, path)) })));
        candidates.sort((a, b) => b.info.mtimeMs - a.info.mtimeMs || a.path.localeCompare(b.path));
        if (candidates[0]) previews[step.id] = { path: candidates[0].path, savedAt: candidates[0].info.mtime.toISOString() };
        const completed = await exists(prefix + '/.completed'), running = await exists(prefix + '/.running');
        const missing = [];
        for (const path of step.requiredFiles) {
          if (!await exists(prefix + '/' + path)) missing.push(path);
        }
        states[step.id] = completed ? (missing.length ? 'failed' : 'done') : running ? observed('running')
          : files.some(path => path.startsWith(prefix + '/')) ? 'available' : 'pending';
        if (completed && missing.length) messages[step.id] = '.completed 存在但缺少交付：' + missing.join('、');
        if ('review' in step && step.review) {
          if (reports[step.id]) reports.draw = reports[step.id];
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
            const report = prefix + '/' + phase + '.md';
            await loadReport(phase, report);
            const draft = !fileSet.has(report) && fileSet.has(report + '.tmp');
            if (fileSet.has(report) || draft) {
              feedback[phase] = (draft ? '草稿（尚未完成）\n' : '')
                + (await readFile(await safePath(directory, report + (draft ? '.tmp' : '')), 'utf8')).trim().slice(0, 600);
            }
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
    if (id === 'shadow') {
      for (const variant of shadowModes) {
        const branchStates: Status[] = [];
        for (const step of stepsFor(variant)) {
          const prefix = id + '/' + variant + '/' + step.id;
          const complete = await exists(prefix + '/.completed');
          const delivered = await Promise.all(step.requiredFiles.map(path => exists(prefix + '/' + path)));
          const state: Status = complete ? delivered.every(Boolean) ? 'done' : 'failed'
            : await exists(prefix + '/.running') ? variant === mode ? observed('running') : 'unconfirmed'
              : files.some(path => path.startsWith(prefix + '/')) ? 'available' : 'pending';
          branchStates.push(state);
          if (variant === 'normal-depth') states['normal-depth-maps'] = state;
        }
        states[variant] = branchStates.includes('failed') ? 'failed' : branchStates.includes('running') ? 'running'
          : branchStates.includes('unconfirmed') ? 'unconfirmed' : branchStates.every(v => v === 'done') ? 'done'
            : branchStates.some(v => v === 'available' || v === 'done') ? 'available' : 'pending';
      }
      states.step01 = states[mode];
    }
    let status: Status = active ? 'running' : observed(saved?.status);
    if (!saved) status = Object.values(states).includes('failed') ? 'failed' : Object.values(states).includes('unconfirmed') ? 'unconfirmed'
      : files.some(path => path.startsWith(id + '/')) ? 'available' : 'pending';
    if ((id === 'shadow' ? states.step01 === 'failed' : Object.values(states).includes('failed')) && !active) status = 'failed';
    if ((id in rasterDefinitions || id === 'shadow') && status === 'done' && Object.entries(states).some(([key, value]) => key.startsWith('step') && value !== 'done')) {
      status = 'interrupted'; // Root coordinator history must not hide a removed step marker.
    }
    pipelines.push({ id, ...(id === 'shadow' ? { mode } : {}), status, states, messages, previews, feedback, reports, groups, threadId: config?.threadId ?? null, summary: saved?.summary });
  }
  const log = await readTaskLog(directory);
  const worker = await optional('.web-worker.json');
  // The URL version changes when an existing draft is rewritten, even if no log or filename changes.
  const fileVersions: Record<string, string> = {};
  const previewFiles = files.filter(path => /\.(kra|svg|png|jpe?g|webp|md(?:\.tmp)?|json)$/i.test(path) && !path.includes('/agents/'));
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
