import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { beginStep, completeStep, readStep, type ChainStep, type StepStatus } from './step-chain.ts';
import { stepName } from './step-paths.js';

// A section is one part of the pipeline: a directory of steps stepNN or
// stepNN_<note> (step-paths.js), each run by its own marker (step-chain.ts).
// Numbers are fixed per step, so a step that a run does not use leaves a gap,
// and steps sharing a number are alternatives a run picks one of.
export { stepName };
export type SectionStep = { number: number; note?: string };
export type SectionPlan = { statuses: Map<string, StepStatus>; chain: ChainStep[]; defined: Set<string> };

export function sectionChain(directory: string, steps: readonly SectionStep[]): ChainStep[] {
  let previous = 0;
  for (const step of steps) {
    if (!Number.isInteger(step.number) || step.number < 1 || step.number > 99 || step.number <= previous) {
      throw new Error('步骤编号须为 step01–step99，从小到大且不重复。');
    }
    previous = step.number;
  }
  return steps.map(step => { const id = stepName(step.number, step.note); return { id, directory: join(directory, id) }; });
}

export async function inspectSection(directory: string, steps: readonly SectionStep[]): Promise<SectionPlan> {
  const chain = sectionChain(directory, steps), statuses = new Map<string, StepStatus>();
  for (const step of chain) statuses.set(step.id, (await readStep(step.directory)).status);
  return { statuses, chain, defined: new Set(chain.map(step => step.id)) };
}

export type SectionRun = {
  directory: string;
  steps: readonly SectionStep[];
  dryRun?: boolean;
  signal?: AbortSignal;
  progress?: (message: string) => void;
  // Both run after inspection and before anything changes, so they can refuse safely.
  check?(plan: SectionPlan): Promise<void>;
  keep?(step: ChainStep, plan: SectionPlan): Promise<void>;
  // Right before steps run; not in a dry run.
  prepare?(plan: SectionPlan): Promise<void>;
  // The work a step still needs, or nothing for a completed step that is kept.
  // A dry run calls the work without touching markers, so it only previews.
  step(step: ChainStep, status: StepStatus, plan: SectionPlan): Promise<(() => Promise<void>) | undefined>;
  // A round or targeted child may return while the step still waits for more
  // work. Keep its running marker and stop before any dependent next step.
  finished?(step: ChainStep): Promise<boolean>;
};

// The one run loop: keep completed steps, continue running ones, start the rest.
export async function runSection(run: SectionRun): Promise<SectionPlan> {
  const plan = await inspectSection(run.directory, run.steps);
  await run.check?.(plan);
  for (const step of plan.chain) if (plan.statuses.get(step.id) === 'completed') await run.keep?.(step, plan);
  if (!run.dryRun) {
    run.signal?.throwIfAborted();
    await run.prepare?.(plan);
  }
  for (const step of plan.chain) {
    run.signal?.throwIfAborted();
    let status = plan.statuses.get(step.id)!;
    // An unmarked directory never started properly: remove it, then run the step afresh.
    if (status === 'unmarked' && !run.dryRun) {
      await rm(step.directory, { recursive: true, force: true });
      plan.statuses.set(step.id, status = 'absent');
    }
    const work = await run.step(step, status, plan);
    if (!work) {
      if (status !== 'completed') throw new Error(`${step.id} 尚未完成，不能跳过`);
      continue;
    }
    if (status === 'completed') throw new Error(`${step.id} 已完成，不能重跑`);
    if (run.dryRun) { await work(); continue; }
    await beginStep(step.directory, status);
    await work();
    run.signal?.throwIfAborted();
    if (run.finished && !await run.finished(step)) {
      plan.statuses.set(step.id, 'running');
      break;
    }
    await completeStep(step.directory);
    plan.statuses.set(step.id, 'completed');
  }
  return plan;
}
