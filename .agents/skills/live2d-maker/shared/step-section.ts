import { rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readStep, runStep, type ChainStep, type StepStatus } from './step-chain.ts';
import { stepName, stepNumber } from './step-paths.js';
import { includesStep, resolveStepRange, type StepRange, type StepSelection } from './step-range.ts';

// A section is one part of the pipeline: a directory of steps stepNN or
// stepNN_<note> (step-paths.js), each run by its own marker (step-chain.ts).
// Numbers are fixed per step, so a step that a run does not use leaves a gap,
// and steps sharing a number are alternatives a run picks one of.
export { stepName };
export type SectionStep = { number: number; note?: string; requiredFiles?: readonly string[] };
type PlannedStep = ChainStep & Pick<SectionStep, 'requiredFiles'>;
export type SectionPlan = { statuses: Map<string, StepStatus>; chain: PlannedStep[]; defined: Set<string> };
export type SectionRunPlan = SectionPlan & { selected: PlannedStep[] };

export function sectionChain(directory: string, steps: readonly SectionStep[]): PlannedStep[] {
  let previous = 0;
  for (const step of steps) {
    if (!Number.isInteger(step.number) || step.number < 1 || step.number > 99 || step.number <= previous) {
      throw new Error('步骤编号须为 step01–step99，从小到大且不重复。');
    }
    previous = step.number;
  }
  return steps.map(({ number, note, requiredFiles }) => {
    const id = stepName(number, note);
    return { id, directory: join(directory, id), ...(requiredFiles ? { requiredFiles } : {}) };
  });
}

export async function inspectSection(directory: string, steps: readonly SectionStep[], through = Infinity): Promise<SectionPlan> {
  const chain = sectionChain(directory, steps), statuses = new Map<string, StepStatus>();
  for (const step of chain) {
    if (stepNumber(step.id)! > through) break;
    statuses.set(step.id, (await readStep(step.directory)).status);
  }
  return { statuses, chain, defined: new Set(chain.map(step => step.id)) };
}

export type SectionRun = {
  directory: string;
  steps: readonly SectionStep[];
  selection?: StepSelection;
  // A runner with multiple phases can resolve the entire section route once.
  range?: StepRange;
  dryRun?: boolean;
  signal?: AbortSignal;
  progress?: (message: string) => void;
  // Read-only checks for the plan and for kept deliveries.
  check?(plan: SectionRunPlan): Promise<void>;
  keep?(step: ChainStep, plan: SectionRunPlan): Promise<void>;
  // Upgrade old step records only for selected steps, after checking the prefix.
  migrate?(step: ChainStep): Promise<boolean | void>;
  // Right before steps run; not in a dry run.
  prepare?(plan: SectionRunPlan): Promise<void>;
  // The work a step still needs, or nothing for a completed step that is kept.
  // A dry run calls the work without touching markers, so it only previews.
  step(step: ChainStep, status: StepStatus, plan: SectionRunPlan): Promise<(() => Promise<void>) | undefined>;
  // A round or targeted child may return while the step still waits for more
  // work. Keep its running marker and stop before any dependent next step.
  finished?(step: ChainStep): Promise<boolean>;
};

async function requireDeliveries(step: PlannedStep, kept: boolean): Promise<void> {
  for (const file of step.requiredFiles ?? []) {
    const path = resolve(step.directory, file);
    const info = await stat(path).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    });
    if (!info?.isFile() || info.size === 0) {
      const state = kept ? '已标记完成但交付缺失' : '缺少有效交付';
      throw new Error(`${step.id} ${state}：${path}。请恢复文件，或重试该步骤。`);
    }
  }
}

// The one run loop: keep completed steps, continue running ones, start the rest.
export async function runSection(run: SectionRun): Promise<SectionRunPlan> {
  const range = run.range ?? resolveStepRange(run.steps.map(step => stepName(step.number, step.note)), run.selection);
  const inspected = await inspectSection(run.directory, run.steps, range?.to);
  const plan = { ...inspected, selected: inspected.chain.filter(step => includesStep(range, step.id)) };
  const prefix = range ? plan.chain.filter(step => stepNumber(step.id)! < range.from) : [];
  for (const step of prefix) {
    if (plan.statuses.get(step.id) !== 'completed') {
      throw new Error(`前置步骤 ${step.id} 尚未完成：${step.directory}`);
    }
  }
  await run.check?.(plan);
  for (const step of prefix) await keep(step);
  if (!run.dryRun && run.migrate) {
    for (const step of plan.selected) {
      run.signal?.throwIfAborted();
      if (await run.migrate(step)) plan.statuses.set(step.id, (await readStep(step.directory)).status);
    }
  }
  for (const step of plan.selected) if (plan.statuses.get(step.id) === 'completed') await keep(step);
  async function keep(step: PlannedStep) {
    await requireDeliveries(step, true);
    await run.keep?.(step, plan);
  }
  if (!run.dryRun) {
    run.signal?.throwIfAborted();
    await run.prepare?.(plan);
  }
  for (const step of plan.selected) {
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
    const outcome = await runStep(step.directory, status, async () => {
      await work();
      run.signal?.throwIfAborted();
      if (await run.finished?.(step) === false) return false;
      await requireDeliveries(step, false);
    });
    plan.statuses.set(step.id, outcome);
    if (outcome === 'running') break;
  }
  return plan;
}

export function rangeSummary(plan: SectionRunPlan): string {
  const last = plan.selected.at(-1);
  if (!last) return '本次没有需调度的步骤';
  const pending = plan.selected.find(step => plan.statuses.get(step.id) !== 'completed');
  return pending ? `本次范围尚未完成：${pending.id}` : `本次范围已完成，停在 ${last.id}`;
}
