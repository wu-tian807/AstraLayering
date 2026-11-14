import { lstat, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { readStep } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
import { stepDeliveries } from '../.agents/skills/live2d-maker/shared/step-deliveries.ts';
import { readStepSession } from '../.agents/skills/live2d-maker/shared/agents/step-session.ts';
import { nineAxisSteps, nineAxisProgressSteps, nineAxisGroupSteps, previousNineAxisSteps, previousNineAxisGroupSteps } from '../.agents/skills/live2d-maker/shared/nine-axis.ts';
import { safePath } from './files.ts';
import { currentAgentCalls, throttled } from './agent-progress.ts';
import { reportPreview, type ReportPreview } from './report.ts';
import type { Status } from './snapshot.ts';
import { executionStatus, aggregateStatus } from './execution-state.js';
import { modelDocument } from '../.agents/skills/live2d-maker/nine-axis/source.ts';
import { isStudioPath } from './studio-project.ts';
import { hairRounds, hairRoundLabel, readHairProgress, type HairProgress, type HairRound } from '../.agents/skills/live2d-maker/nine-axis/hair-progress.ts';
import { toTaskPathReal } from '../.agents/skills/live2d-maker/shared/task-paths.ts';

type Observation = { active?: boolean; failed?: boolean; archive?: boolean; since?: string; reason?: string };

// Project the existing step/group facts. Only a current agent call is running;
// saved partial products remain available without implying completion.
export async function nineAxisProgress(directory: string, files: Set<string>, errors: string[], observation: Observation = {}) {
  const root = join(directory, 'nine-axis'), states: Record<string, Status> = {}, messages: Record<string, string> = {};
  const previous = [...files].some(path => previousNineAxisSteps.some(id => path.startsWith(`nine-axis/${id}/`)));
  const staged = !previous || [...files].some(path => /^nine-axis\/(?:step01_preparation|step04_angles)\//.test(path)) || (await readStep(join(root, 'step01_preparation'))).status !== 'absent';
  const mainSteps = staged ? nineAxisSteps : previousNineAxisSteps;
  const ids = staged ? nineAxisProgressSteps : previousNineAxisSteps.flatMap(id => id === 'step02_angles' ? [id, ...previousNineAxisGroupSteps] : [id]);
  const groups = staged ? nineAxisGroupSteps : previousNineAxisGroupSteps;
  const model = staged ? 'step04_angles/model' : 'step02_angles';
  const calls = await currentAgentCalls(directory, 'nine-axis', files, errors, observation.since, true);
  const steps = [], products: Record<string, boolean> = {}, previews: Record<string, { path: string; savedAt: string }> = {}, reports: Record<string, ReportPreview> = {};
  for (const id of ids) {
    const prefix = `nine-axis/${id}`;
    let status: Awaited<ReturnType<typeof readStep>>['status'] = 'absent';
    try { status = (await readStep(await safePath(directory, prefix))).status; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(prefix + ': ' + String(error)); }
    const deliveries = await stepDeliveries(root, 'nine-axis', id);
    const hasProducts = deliveries.some(path => files.has('nine-axis/' + relative(root, path).replaceAll('\\', '/')))
      || [...files].some(path => path.startsWith(prefix + '/') && !path.includes('/agents/'));
    products[id] = status === 'running' && hasProducts;
    const ownCalls = calls.filter(call => call.outputDirectory === prefix || call.outputDirectory?.startsWith(prefix + '/'));
    const call = ownCalls.filter(call => !call.finished).at(-1) ?? ownCalls.at(-1);
    states[id] = status === 'completed' ? 'done' : call?.failed ? 'failed' : observation.active && call && !call.finished
      ? throttled(call) ? 'throttled' : 'running'
      : status === 'running' && observation.active ? hasProducts ? 'available' : 'pending'
        : executionStatus(status, { failed: !observation.active && observation.failed });
    if (states[id] === 'throttled') messages[id] = call!.retryError!;
    else if (['failed', 'interrupted'].includes(states[id]) && observation.reason) messages[id] = observation.reason;
    if (status !== 'absent') {
      const session = await readStepSession(root, id).catch(error => { errors.push(prefix + ': ' + String(error)); return undefined; });
      steps.push({ id, status, session: !!session?.threadId, ...(session?.threadId ? { threadId: session.threadId } : {}) });
    }
    for (const name of ['notes.md', 'report.md']) {
      const path = prefix + '/' + name;
      if (files.has(path)) reports[id] = await reportPreview(directory, path, await readFile(await safePath(directory, path), 'utf8'), files);
    }
    const image = ['original-full-face.png', 'character-nine-axis.png'].map(name => prefix + '/' + name).find(path => files.has(path));
    if (image) previews[id] = { path: image, savedAt: (await lstat(await safePath(directory, image))).mtime.toISOString() };
    const model = prefix + '/deformers.json';
    if (files.has(model)) {
      try {
        const path = await safePath(directory, model), doc = JSON.parse(await readFile(path, 'utf8'));
        const document = await modelDocument(directory, dirname(path), doc);
        const source = document && await toTaskPathReal(directory, document);
        if (source && isStudioPath(source) && files.has(source) && source.endsWith('.kra')) previews[id] = {
          path: source, savedAt: (await lstat(await safePath(directory,source))).mtime.toISOString(),
        };
      } catch (error) { if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(model + ': ' + String(error)); }
    }
  }
  const parents = staged ? [[model, groups], ['step04_angles', [model, 'step04_angles/video']]] as const : [[model, groups]] as const;
  for (const [parent, children] of parents) if (states[parent] !== 'done') {
    // Children may explain an in-progress parent, but cannot complete its merge.
    const status = aggregateStatus(children.map(id => states[id]));
    if (status !== 'pending' && status !== 'done') states[parent] = status;
  }
  const mergeComplete = states[model] === 'done';
  let hair: { rounds: Record<HairRound, Status>; next: HairProgress['next']; awaitingContinue: boolean } | undefined;
  const hairFile = 'nine-axis/step08_hair/hair-progress.json';
  if (staged && (files.has(hairFile) || ['running', 'throttled', 'failed', 'interrupted'].includes(states.step08_hair))) {
    try {
      // Snapshot reads never migrate progress or change completion markers.
      const progress: Pick<HairProgress, 'completed' | 'next'> = files.has(hairFile)
        ? await readHairProgress(dirname(await safePath(directory, hairFile))) : { completed: [], next: hairRounds[0] };
      const ownCalls = calls.filter(call => call.outputDirectory === 'nine-axis/step08_hair');
      const call = ownCalls.filter(call => !call.finished).at(-1) ?? ownCalls.at(-1);
      const currentCall = progress.next !== 'done' && call?.name === `${hairRoundLabel(progress.next)}左右制作`;
      const rounds = Object.fromEntries(hairRounds.map(round => [round, progress.completed.includes(round) ? 'done'
        : round === progress.next && currentCall && states.step08_hair !== 'done' ? states.step08_hair : 'pending'])) as Record<HairRound, Status>;
      hair = { rounds, next: progress.next, awaitingContinue: progress.next !== 'done' && progress.completed.length > 0
        && ['interrupted', 'done'].includes(states.step08_hair) && rounds[progress.next] === 'pending' };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(hairFile + ': ' + String(error)); }
  }
  const summary = aggregateStatus(mainSteps.map(id => states[id]));
  const status: Status = summary === 'done' ? 'done' : observation.active ? summary === 'throttled' ? 'throttled' : 'running'
    : observation.failed ? 'failed' : summary;
  return { id: 'nine-axis', layout: staged ? 'staged' : 'nested', status, states, messages, products, steps, groups: [], previews,
    feedback: {} as Record<string, string>, reports, hair, threadId: [...steps].reverse().find(step => step.threadId)?.threadId ?? null, mergeComplete };
}
