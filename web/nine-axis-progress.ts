import { join, relative } from 'node:path';
import { readStep } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
import { missingDeliveries } from '../.agents/skills/live2d-maker/shared/step-deliveries.ts';
import { readStepSession } from '../.agents/skills/live2d-maker/shared/agents/step-session.ts';
import { nineAxisSteps, nineAxisGroupSteps, nineAxisGroups, nineAxisCornerSteps } from '../.agents/skills/live2d-maker/shared/nine-axis.ts';
import { safePath } from './files.ts';
import { currentAgentCalls, throttled } from './agent-progress.ts';
import type { Status } from './snapshot.ts';
import type { ReportPreview } from './report.ts';

const requirements: Record<string, string[]> = {
  step01_video: [...nineAxisGroups.flatMap(group => [`${group}.mp4`, `${group}.png`]), 'views.json'],
  'step02_angles': ['deformers.json'],
  'step03_angle-xy': ['deformers.json'],
  'step04_jaw-line': ['deformers.json'],
  ...Object.fromEntries([...nineAxisGroupSteps, ...nineAxisCornerSteps].map(id => [id, ['deformers.json']])),
};
type Observation = { active?: boolean; failed?: boolean; archive?: boolean; since?: string; reason?: string };

// Read-only: a parent can remain running after one child finishes. Each child
// owns its marker and its agent call; a sibling's wait/failure never leaks over.
export async function nineAxisProgress(directory: string, files: Set<string>, errors: string[], observation: Observation = {}) {
  const root = join(directory, 'nine-axis'), states: Record<string, Status> = {}, messages: Record<string, string> = {};
  const calls = await currentAgentCalls(directory, 'nine-axis', files, errors, observation.since, true);
  const steps = [];
  for (const id of nineAxisSteps.flatMap(id => id === 'step02_angles' ? [id, ...nineAxisGroupSteps] : id === 'step03_angle-xy' ? [id, ...nineAxisCornerSteps] : [id])) {
    const prefix = `nine-axis/${id}`;
    let status: Awaited<ReturnType<typeof readStep>>['status'] = 'absent';
    try { status = (await readStep(await safePath(directory, prefix))).status; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(prefix + ': ' + String(error)); }
    const missing = status === 'completed' ? (await missingDeliveries(root, 'nine-axis', id)).map(path => relative(root, path).replaceAll('\\', '/'))
      : requirements[id].filter(path => !files.has(prefix + '/' + path)).map(path => id + '/' + path);
    const call = calls.filter(call => call.outputDirectory === prefix || call.step === id).at(-1);
    const running: Status = observation.active ? call?.failed ? 'failed' : call && throttled(call) ? 'throttled' : 'running'
      : observation.failed ? 'failed' : 'unconfirmed';
    states[id] = status === 'completed' ? missing.length ? 'failed' : 'done' : status === 'running' ? running
      : observation.archive && !missing.length ? 'available' : 'pending';
    if (status === 'completed' && missing.length) messages[id] = '.completed 存在但缺少交付：' + missing.join('、');
    if (states[id] === 'throttled') messages[id] = call!.retryError!;
    if (states[id] === 'failed' && !messages[id] && observation.reason) messages[id] = observation.reason;
    if (status === 'unmarked' && !observation.archive) messages[id] = '残留目录（无完成或进行中标记）：下次运行会删除后重做';
    if (status !== 'absent') {
      const session = await readStepSession(root, id).catch(error => { errors.push(prefix + ': ' + String(error)); return undefined; });
      steps.push({ id, status, session: !!session?.threadId, ...(session?.threadId ? { threadId: session.threadId } : {}),
        ...(status === 'completed' && missing.length ? { missing } : {}) });
    }
  }
  // A parent shows its children's activity until it has merged them all.
  const aggregate = (parent: string, ids: string[], names: string) => {
    const children = ids.map(id => states[id]), childrenDone = children.every(status => status === 'done');
    if (states[parent] === 'done' && !childrenDone) {
      states[parent] = 'failed'; messages[parent] = `父合并已标记完成，但 ${names} 尚未全部完成`;
    } else if (states[parent] !== 'done') {
      if (children.includes('running')) states[parent] = 'running';
      else if (children.includes('throttled')) states[parent] = 'throttled';
      else if (children.includes('failed')) states[parent] = 'failed';
    }
    return childrenDone && states[parent] === 'done';
  };
  const parent = 'step02_angles', mergeComplete = aggregate(parent, nineAxisGroupSteps, 'left/up/down');
  aggregate('step03_angle-xy', nineAxisCornerSteps, 'left-up/left-down');
  // Existing XY/jaw files remain readable. Their completion is invalid while
  // the new source merge is pending; a retry never means a sibling was redone.
  if (!mergeComplete) {
    for (const id of ['step03_angle-xy', 'step04_jaw-line']) {
      if (states[id] === 'done') states[id] = 'available';
      messages[id] = '等待 left/up/down 与父合并全部完成';
    }
  }
  const values = Object.values(states), status: Status = values.includes('running') ? 'running' : values.includes('throttled') ? 'throttled'
    : values.includes('failed') ? 'failed' : values.includes('unconfirmed') ? 'unconfirmed' : nineAxisSteps.every(id => states[id] === 'done') ? 'done'
      : values.some(value => value === 'done' || value === 'available') ? 'available' : 'pending';
  return { id: 'nine-axis', status, states, messages, steps, groups: [], previews: {} as Record<string, { path: string; savedAt: string }>,
    feedback: {} as Record<string, string>, reports: {} as Record<string, ReportPreview>, threadId: null, krita: null, mergeComplete };
}
