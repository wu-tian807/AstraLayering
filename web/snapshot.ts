import { lstat, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { shadowMode, shadowModes } from '../.agents/skills/live2d-maker/shared/shadow.ts';
import { stepsFor } from '../.agents/skills/live2d-maker/shadow/steps.ts';
import { shadowStep } from '../.agents/skills/live2d-maker/shared/step-paths.js';
import { sectionIds } from '../.agents/skills/live2d-maker/shared/paths.ts';
import { listSteps } from '../.agents/skills/live2d-maker/workflow/step-actions.ts';
import { currentSession } from '../.agents/skills/live2d-maker/shared/agents/step-session.ts';
import { readRun, taskStatus, type TaskRun } from '../.agents/skills/live2d-maker/workflow/state.ts';
import { LayoutError, layoutState } from '../.agents/skills/live2d-maker/workflow/layout.ts';
import { steps as personSteps } from '../.agents/skills/live2d-maker/raster-layering/steps.ts';
import { steps as clothingSteps } from '../.agents/skills/live2d-maker/clothing-raster-layering/steps.ts';
import { steps as assemblySteps } from '../.agents/skills/live2d-maker/character-assembly/steps.ts';
import { nextReviewTask } from '../.agents/skills/live2d-maker/shared/raster/review.ts';
import { agentRecord, inventory, jsonFile, safePath } from './files.ts';
import { partProgress, phases } from './part-progress.ts';
import { currentAgentCalls, throttled } from './agent-progress.ts';
import { readTaskLog } from '../.agents/skills/live2d-maker/workflow/log.ts';
import { projectDisplayName } from './project-metadata.ts';
import { reportPreview, type ReportPreview } from './report.ts';
import { canStopTask } from '../.agents/skills/live2d-maker/workflow/control.ts';
import { section as characterRaster } from '../.agents/skills/live2d-maker/raster-layering/run.ts';
import { section as clothingRaster } from '../.agents/skills/live2d-maker/clothing-raster-layering/run.ts';
import { section as assembly } from '../.agents/skills/live2d-maker/character-assembly/run.ts';
import { makeSection as shadowSection } from '../.agents/skills/live2d-maker/shadow/run.ts';
import type { KritaSection } from '../.agents/skills/live2d-maker/shared/raster/workflow.ts';
import { completeRun } from '../.agents/skills/live2d-maker/workflow/export.ts';
import { copiedInput, inputKras } from './kra-inputs.ts';
import { kritaRecordFile, kritaSlotsInUse, readKritaRecord } from '../.agents/skills/live2d-maker/shared/krita/section-krita.ts';
import { nineAxisProgress } from './nine-axis-progress.ts';
import { executionStatus, aggregateStatus, type ExecutionStatus } from './execution-state.js';

export { phases } from './part-progress.ts';
export const rasterDefinitions = { 'raster-layering': personSteps, 'clothing-raster-layering': clothingSteps, 'character-assembly': assemblySteps };
export type Status = ExecutionStatus;
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
  // A task in an old directory layout is shown with its conversion, not run.
  const layout = await layoutState(directory).catch(error => { if (error instanceof LayoutError) return error; throw error; });
  if (layout !== 'current') {
    const message = layout === 'previous' ? '任务使用旧版目录布局，需要先转换目录（转换前会完整备份原目录）。' : layout.message;
    return { name, displayName, status: 'layout', layout: layout === 'previous' ? layout : layout.layout, message, directory, run: undefined, runnerAlive: false, lockHeld: false };
  }
  const run = await readRun(directory);
  if (!run) return { name, displayName, status: 'untracked', directory, run: undefined, runnerAlive: false, lockHeld: false };
  const live = await taskStatus({ name, dir });
  return { name, displayName, status: live.status, directory, run, runnerAlive: live.runnerAlive, lockHeld: live.lockHeld };
}
export async function snapshot(directory: string, name: string, dir: string) {
  const errors: string[] = [];
  const record = await summary(directory, name, dir).catch(error => {
    errors.push(String(error)); return { name, status: 'failed', directory, run: undefined as TaskRun | undefined, runnerAlive: false, lockHeld: false };
  });
  const fileVersions: Record<string, string> = {};
  const files = await inventory(directory, fileVersions), fileSet = new Set(files);
  const optional = async (path: string) => jsonFile(directory, path).catch(error => { errors.push(String(error)); return undefined; });
  const exists = async (path: string) => {
    try { return (await lstat(await safePath(directory, path))).isFile(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(String(error)); return false; }
  };
  const sections = [];
  // Slots held machine-wide, read once a section of this task holds or awaits one.
  let kritaInUse: number | undefined;
  for (const id of sectionIds) {
    if (id === 'nine-axis') continue; // Parallel child observation is handled below.
    if (record.run?.archive && !record.run.sections[id]) continue;
    // The character and clothing lanes run side by side: several sections can be active at once.
    const current = !!record.run?.activeSections?.includes(id);
    const saved = record.run?.sections[id];
    // A lane that failed stays listed as the one that stopped the run, while the other lane may still be running.
    const active = record.runnerAlive && record.lockHeld && current && saved?.status !== 'failed';
    // Only the lane that failed marks its unfinished step failed; a step another lane
    // left marked .running was stopped or interrupted, and continues on the next run.
    const failed = saved?.status === 'failed';
    const mode = shadowMode(record.run?.shadowMode);
    // The section's inputs, resolved from its upstream as a run would; none while the upstream is unfinished.
    const section: { resolveInput(name: string, root: string): Promise<unknown> } | undefined = id === 'shadow' ? shadowSection(mode)
      : ({ 'raster-layering': characterRaster, 'clothing-raster-layering': clothingRaster, 'character-assembly': assembly } as Record<string, KritaSection<any>>)[id];
    const sourceInput = await section?.resolveInput(name, dir).catch(() => undefined);
    const states: Record<string, Status> = {};
    const messages: Record<string, string> = {};
    const products: Record<string, boolean> = {};
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
    const observed = (value?: string): Status => value === 'running' ? (active ? 'running' : failed ? 'failed' : 'interrupted') : statusOf(value);
    // Why the lane failed, for the step it left mid-way.
    const reason = !active && saved?.status === 'failed' && saved.summary ? saved.summary.split('\n')[0].slice(0, 400) : undefined;
    let groups: any[] = [];
    if (id === 'part-layering' || id === 'clothing-part-layering') {
      const document = await optional(id + '/groups.json');
      try { validateGroups(document?.groups ?? []); groups = document?.groups ?? []; }
      catch (error) { errors.push(id + ': ' + String(error)); }
      const all = flatten(groups);
      const failedSince = !active && failed && current ? record.run?.runner?.startedAt : undefined;
      const progress = await partProgress(directory, id, groups, fileSet, optional, errors, active ? record.run?.runner?.startedAt : undefined, failedSince, failed);
      Object.assign(states, progress.states); Object.assign(messages, progress.messages);
      for (const phase of phases) states[phase] = aggregateStatus(all.map(node => node.webPhases[phase]));
      states.layers = aggregateStatus(phases.map(phase => states[phase]));
    } else {
      for (const step of id === 'shadow' ? stepsFor(mode) : rasterDefinitions[id]) {
        const prefix = id + '/' + step.id;
        await loadReport(step.id, prefix + '/report.md');
        const previewInputs = [...inputKras(sourceInput, directory), ...files
          .filter(path => path.startsWith(prefix + '/') && !path.includes('/workspace/') && /\.kra$/i.test(path))
          .map(path => resolve(directory, path))];
        const candidates = await Promise.all(files.filter(path => /\.kra$/i.test(path) &&
          path.startsWith(prefix + '/')
          && !path.split('/').some(segment => segment.startsWith('.') || ['recovery', 'archive'].includes(segment))
          && !/-autosave\.kra$/i.test(path))
          .map(async path => ({ path, info: await lstat(await safePath(directory, path)),
            inputCopy: await copiedInput(await safePath(directory, path), previewInputs) })));
        for (let index = candidates.length - 1; index >= 0; index--) if (candidates[index].inputCopy) candidates.splice(index, 1);
        candidates.sort((a, b) => b.info.mtimeMs - a.info.mtimeMs || a.path.localeCompare(b.path));
        if (candidates[0]) previews[step.id] = { path: candidates[0].path, savedAt: candidates[0].info.mtime.toISOString() };
        const completed = await exists(prefix + '/.completed');
        const running = await exists(prefix + '/.running');
        const marker = completed ? 'completed' : running ? 'running' : 'unmarked';
        states[step.id] = executionStatus(marker, { active, failed: !active && failed });
        products[step.id] = running && !completed && step.requiredFiles.some(path => fileSet.has(prefix + '/' + path));
        if ('review' in step && step.review) {
          if (reports[step.id]) reports.draw = reports[step.id];
          states.draw = completed ? 'done' : running && fileSet.has(prefix + '/report.md') ? 'done' : states[step.id];
          const sequence = ['review-01', 'repair-01', 'review-02', 'repair-02'];
          let next: Awaited<ReturnType<typeof nextReviewTask>>;
          try { next = await nextReviewTask(await safePath(directory, prefix)); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              errors.push(prefix + ': ' + String(error));
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
            states[phase] = completed ? fileSet.has(report) ? 'done' : 'skipped' : !running ? 'pending' : fileSet.has(report) ? 'done'
              : next?.filename === phase + '.md' && states.draw === 'done' && running ? observed('running')
              : !next && fileSet.has(prefix + '/review-01.md') ? 'skipped' : !active ? states[step.id] : 'pending';
          }
        }
        if (reason && running && !completed) {
          const phase = states.draw === 'done' ? ['review-01', 'repair-01', 'review-02', 'repair-02'].find(key => states[key] === 'failed') : undefined;
          messages[phase ?? step.id] ??= reason;
        }
      }
    }
    if (id === 'shadow') {
      // The run's step01 is the chosen mode's; the other mode's step01 is shown as it was left.
      for (const variant of shadowModes) {
        const modeStates: Status[] = [];
        for (const step of stepsFor(variant)) {
          const prefix = id + '/' + step.id;
          const complete = await exists(prefix + '/.completed');
          const running = await exists(prefix + '/.running');
          const state = executionStatus(complete ? 'completed' : running ? 'running' : 'unmarked',
            { active: variant === mode && active, failed: variant === mode && !active && failed });
          products[variant] = running && !complete && step.requiredFiles.some(path => fileSet.has(prefix + '/' + path));
          modeStates.push(state);
          if (variant === 'normal-depth') states['normal-depth-maps'] = state;
        }
        states[variant] = aggregateStatus(modeStates);
      }
      // The workbench shows the chosen step01 under one step01 node.
      const chosen = shadowStep(mode);
      states.step01 = states[mode];
      delete states[chosen];
      for (const entries of [messages, previews, reports] as Record<string, unknown>[]) {
        if (chosen in entries) { entries.step01 = entries[chosen]; delete entries[chosen]; }
      }
    }
    // One agent runs a raster or shadow section at a time: while it waits out a 429, its running steps wait too.
    const waiting = active && id !== 'part-layering' && id !== 'clothing-part-layering'
      ? (await currentAgentCalls(directory, id, fileSet, errors, record.run?.runner?.startedAt)).find(call => throttled(call)) : undefined;
    if (waiting) for (const key of Object.keys(states)) if (states[key] === 'running') { states[key] = 'throttled'; messages[key] = waiting.retryError!; }
    const sectionSteps = id === 'shadow' ? [states.step01] : id in rasterDefinitions
      ? rasterDefinitions[id as keyof typeof rasterDefinitions].map(step => states[step.id])
      : ['preparation', 'initial', 'layers', 'merge', 'occlusion'].map(key => states[key]);
    const summary = aggregateStatus(sectionSteps);
    let status: Status = summary === 'done' ? 'done' : active ? summary === 'throttled' ? 'throttled' : 'running'
      : failed ? 'failed' : summary;
    // A clothing lane skipped for lack of a dress-up is complete with nothing to make.
    if (saved?.skipped && !active) {
      status = 'skipped';
      for (const key of Object.keys(states)) if (states[key] === 'pending') states[key] = 'skipped';
    }
    // Every marked step, for the continue / resume / retry actions.
    const steps = await listSteps(join(directory, id), id).catch(error => { errors.push(id + ': ' + String(error)); return []; });
    // The thread of the running step, else of the last step that kept one.
    const threadId = (await currentSession(join(directory, id), steps).catch(() => undefined))?.threadId ?? null;
    // The section's machine-wide Krita slot: queued for, held, or held with Krita running.
    sections.push({ id, ...(id === 'shadow' ? { mode } : {}), status, states, messages, products, previews, feedback, reports, groups, steps,
      threadId, summary: saved?.summary, ...(saved?.skipped ? { skipped: true } : {}) });
  }
  // Nine-axis currently also has a standalone runner. Show its artifacts and
  // markers without registering or starting another workflow here.
  const nineSaved = record.run?.sections['nine-axis'];
  if (!record.run?.archive || nineSaved) sections.push({ ...await nineAxisProgress(directory, fileSet, errors, {
    active: record.runnerAlive && record.lockHeld && record.run?.activeSections?.includes('nine-axis') && nineSaved?.status !== 'failed',
    failed: nineSaved?.status === 'failed', archive: !!record.run?.archive,
    since: record.run?.runner?.startedAt, reason: nineSaved?.summary,
  }), summary: nineSaved?.summary, ...(nineSaved?.skipped ? { skipped: true } : {}) });
  // Every section, including nine-axis, reads the existing machine-wide slot
  // record. Artifacts and runner history cannot establish a Krita reservation.
  const observedSections = await Promise.all(sections.map(async section => {
    const record = await readKritaRecord(join(directory, section.id, kritaRecordFile));
    const krita = !record ? null : { state: record.state, since: record.since, limit: record.limit,
      ...(record.state === 'running' ? { pid: record.pid, version: record.version, startedAt: record.startedAt } : {}) };
    return { ...section, krita };
  }));
  if (observedSections.some(section => section.krita)) kritaInUse = await kritaSlotsInUse();
  const log = await readTaskLog(directory);
  // Server-side readers above may use agent records; the page only gets readable artifacts.
  const servedFiles = files.filter(path => !agentRecord(path));
  const servedVersions = Object.fromEntries(servedFiles.flatMap(path => fileVersions[path] ? [[path, fileVersions[path]]] : []));
  return { ...record, files: servedFiles, ...(kritaInUse !== undefined ? { kritaInUse } : {}), fileVersions: servedVersions, sections: observedSections, errors, logs: log.text,
    archived: !!record.run?.archive,
    canExport: completeRun(record.run) && !record.runnerAlive && !record.lockHeld,
    logPath: log.path, logUpdatedAt: log.updatedAt, lastLogMessage: log.message,
    canStop: canStopTask(record.run?.runner, record.runnerAlive, record.lockHeld),
    original: files.find(path => /^input\/original\.(png|jpe?g|webp)$/i.test(path)),
    reference: files.find(path => /^part-layering\/references\/simplified-subject\.png$/i.test(path)),
  };
}
