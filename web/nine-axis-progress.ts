import { lstat, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { readStep } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
import { missingDeliveries, stepDeliveries } from '../.agents/skills/live2d-maker/shared/step-deliveries.ts';
import { readStepSession } from '../.agents/skills/live2d-maker/shared/agents/step-session.ts';
import { nineAxisSteps, nineAxisProgressSteps, nineAxisGroupSteps, previousNineAxisSteps, previousNineAxisGroupSteps } from '../.agents/skills/live2d-maker/shared/nine-axis.ts';
import { safePath } from './files.ts';
import { currentAgentCalls, throttled } from './agent-progress.ts';
import { reportPreview, type ReportPreview } from './report.ts';
import type { Status } from './snapshot.ts';

type Observation = { active?: boolean; failed?: boolean; archive?: boolean; since?: string; reason?: string };

// Project the existing step/group facts. Partial products are available without
// announcing completion; siblings keep their own activity and failure evidence.
export async function nineAxisProgress(directory: string, files: Set<string>, errors: string[], observation: Observation = {}) {
  const root = join(directory, 'nine-axis'), states: Record<string, Status> = {}, messages: Record<string, string> = {};
  const previous = [...files].some(path => previousNineAxisSteps.some(id => path.startsWith(`nine-axis/${id}/`)));
  const staged = !previous || [...files].some(path => /^nine-axis\/(?:step01_preparation|step04_angles)\//.test(path)) || (await readStep(join(root, 'step01_preparation'))).status !== 'absent';
  const mainSteps = staged ? nineAxisSteps : previousNineAxisSteps;
  const ids = staged ? nineAxisProgressSteps : previousNineAxisSteps.flatMap(id => id === 'step02_angles' ? [id, ...previousNineAxisGroupSteps] : [id]);
  const groups = staged ? nineAxisGroupSteps : previousNineAxisGroupSteps;
  const model = staged ? 'step04_angles/model' : 'step02_angles';
  const calls = await currentAgentCalls(directory, 'nine-axis', files, errors, observation.since, true);
  const steps = [], previews: Record<string, { path: string; savedAt: string }> = {}, reports: Record<string, ReportPreview> = {};
  for (const id of ids) {
    const prefix = `nine-axis/${id}`;
    let status: Awaited<ReturnType<typeof readStep>>['status'] = 'absent';
    try { status = (await readStep(await safePath(directory, prefix))).status; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(prefix + ': ' + String(error)); }
    const deliveries = await stepDeliveries(root, 'nine-axis', id);
    const present = deliveries.some(path => files.has('nine-axis/' + relative(root, path).replaceAll('\\', '/'))) || [...files].some(path => path.startsWith(prefix + '/') && !path.includes('/agents/'));
    const missing = status === 'completed' ? (await missingDeliveries(root, 'nine-axis', id)).map(path => relative(root, path).replaceAll('\\', '/')) : [];
    const ownCalls = calls.filter(call => call.outputDirectory === prefix || call.outputDirectory?.startsWith(prefix + '/'));
    const call = ownCalls.filter(call => !call.finished).at(-1) ?? ownCalls.at(-1);
    states[id] = status === 'completed' ? missing.length ? 'failed' : 'done'
      : status === 'running' ? observation.active ? call?.failed ? 'failed' : call && throttled(call) ? 'throttled' : 'running'
        : observation.failed ? 'failed' : 'interrupted'
      : observation.active && call && !call.finished ? throttled(call) ? 'throttled' : 'running' : present ? 'available' : 'pending';
    if (missing.length) messages[id] = '.completed 存在但缺少交付：' + missing.join('、');
    else if (states[id] === 'throttled') messages[id] = call!.retryError!;
    else if (['failed', 'interrupted'].includes(states[id]) && observation.reason) messages[id] = observation.reason;
    if (status !== 'absent') {
      const session = await readStepSession(root, id).catch(error => { errors.push(prefix + ': ' + String(error)); return undefined; });
      steps.push({ id, status, session: !!session?.threadId, ...(session?.threadId ? { threadId: session.threadId } : {}), ...(missing.length ? { missing } : {}) });
    }
    for (const name of ['notes.md', 'report.md']) {
      const path = prefix + '/' + name;
      if (files.has(path)) reports[id] = await reportPreview(directory, path, await readFile(await safePath(directory, path), 'utf8'), files);
    }
    const image = ['original-full-face.png', 'character-nine-axis.png'].map(name => prefix + '/' + name).find(path => files.has(path));
    if (image) previews[id] = { path: image, savedAt: (await lstat(await safePath(directory, image))).mtime.toISOString() };
  }
  const childrenDone = groups.every(id => states[id] === 'done');
  if (states[model] === 'done' && !childrenDone) { states[model] = 'failed'; messages[model] = '单轴合并已完成，但方向制作尚未全部完成'; }
  const parents = staged ? [[model, groups], ['step04_angles', [model, 'step04_angles/video']]] as const : [[model, groups]] as const;
  for (const [parent, children] of parents) if (states[parent] !== 'done') {
    const values = children.map(id => states[id]);
    if (values.includes('running')) states[parent] = 'running';
    else if (values.includes('throttled')) states[parent] = 'throttled';
    else if (values.includes('failed')) states[parent] = 'failed';
    else if (values.includes('interrupted')) states[parent] = 'interrupted';
  }
  const mergeComplete = childrenDone && states[model] === 'done';
  if (!mergeComplete) for (const id of staged ? ['step06_angle-xy', 'step07_jaw-line'] : ['step03_angle-xy', 'step04_jaw-line']) {
    if (states[id] === 'done') states[id] = 'available';
    if (states[id] !== 'pending') messages[id] = '等待单轴模型完成，已有成果可查看';
  }
  const values = Object.values(states), status: Status = values.includes('running') ? 'running' : values.includes('throttled') ? 'throttled'
    : observation.active ? 'running' : values.includes('failed') || observation.failed ? 'failed' : values.includes('interrupted') ? 'interrupted' : mainSteps.every(id => states[id] === 'done') ? 'done'
      : values.some(value => value === 'done' || value === 'available') ? 'available' : 'pending';
  return { id: 'nine-axis', layout: staged ? 'staged' : 'nested', status, states, messages, steps, groups: [], previews,
    feedback: {} as Record<string, string>, reports, threadId: [...steps].reverse().find(step => step.threadId)?.threadId ?? null, mergeComplete };
}
