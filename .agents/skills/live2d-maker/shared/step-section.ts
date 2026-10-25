import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { completeStep, inspectChain, modifiedError, resetChain, startStep, type ChainPlan, type ChainStep, type StepStatus } from './step-chain.ts';

// A section is one part of a pipeline: a directory of numbered steps step01,
// step02, ... driven by the shared step chain. Numbers are fixed per step, so a
// step that a run does not use leaves a gap. Step directories left on disk that
// the run does not define (from an earlier, longer definition) join the chain
// after the step before them, so retrying upstream clears them too.
export const stepId = (number: number) => `step${String(number).padStart(2, '0')}`;
// dependsOn defaults to the step before it; dependencies the run does not define are dropped.
// upstream names completed steps of another pipeline (see SectionRun.upstream) that this step was built on.
export type SectionStep = { number: number; dependsOn?: readonly number[]; upstream?: readonly string[]; outputs?: readonly string[]; allowsEarlyArtifacts?: boolean };
export type SectionPlan = ChainPlan & { chain: ChainStep[]; defined: Set<string>; resetFrom?: number };

export async function sectionChain(directory: string, steps: readonly SectionStep[], scan = true, upstream: readonly ChainStep[] = []): Promise<ChainStep[]> {
  const defined = new Map<number, SectionStep>();
  for (const step of steps) {
    if (!Number.isInteger(step.number) || step.number < 1 || step.number > 99 || defined.has(step.number)
      || [...defined.keys()].some(number => number > step.number)) throw new Error('步骤编号须为 step01–step99，从小到大且不重复。');
    if (step.dependsOn?.some(number => number >= step.number)) throw new Error(`${stepId(step.number)} 只能依赖排在它之前的步骤`);
    defined.set(step.number, step);
  }
  const numbers = new Set(defined.keys());
  if (scan) {
    let entries: string[] = [];
    try { entries = await readdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    for (const name of entries) if (/^step\d{2}$/.test(name) && name !== 'step00') numbers.add(Number(name.slice(4)));
  }
  // Upstream steps lead the chain so their stamps are recorded and checked, but
  // the section never runs or resets them; only completed ones may be passed in.
  const chain: ChainStep[] = [...upstream], external = new Set(upstream.map(step => step.id));
  for (const number of [...numbers].sort((a, b) => a - b)) {
    const step = defined.get(number), previous = chain.length > upstream.length ? chain.at(-1) : undefined;
    const local = step?.dependsOn ? step.dependsOn.filter(dependency => defined.has(dependency)).map(stepId) : previous ? [previous.id] : [];
    chain.push({ id: stepId(number), directory: join(directory, stepId(number)),
      dependsOn: [...(step?.upstream ?? []).filter(id => external.has(id)), ...local],
      ...(step?.outputs ? { outputs: step.outputs } : {}),
      ...(step?.allowsEarlyArtifacts ? { allowsEarlyArtifacts: true } : {}) });
  }
  return chain;
}

export async function inspectSection(directory: string, steps: readonly SectionStep[], scan = true, upstream: readonly ChainStep[] = []): Promise<SectionPlan> {
  const chain = await sectionChain(directory, steps, scan, upstream);
  const plan = { ...await inspectChain(chain), chain, defined: new Set(steps.map(step => stepId(step.number))) };
  if (!plan.reset.length) return plan;
  // Report the break from the first missing step before it, as the gap caused it.
  let index = chain.findIndex(step => step.id === plan.reset[0]);
  while (index > upstream.length && plan.statuses.get(chain[index - 1].id) === 'absent') index--;
  return { ...plan, resetFrom: Number(chain[index].id.slice(4)) };
}

export type SectionRun = {
  directory: string;
  steps: readonly SectionStep[];
  dryRun?: boolean;
  signal?: AbortSignal;
  progress?: (message: string) => void;
  // The section starts over: whatever is on disk is set aside by `prepare`.
  fresh?: boolean;
  resetNote?: string;
  // Completed steps of the pipeline this section reads (see SectionStep.upstream).
  upstream?: readonly ChainStep[];
  // Both run after inspection and before anything changes, so they can refuse safely.
  check?(plan: SectionPlan): Promise<void>;
  keep?(step: ChainStep, plan: SectionPlan): Promise<void>;
  // Right before resets and steps run; not in a dry run.
  prepare?(plan: SectionPlan): Promise<void>;
  // The work a step still needs, or nothing for a completed step that is kept.
  // A dry run calls the work without touching markers, so it only previews.
  step(step: ChainStep, status: StepStatus, plan: SectionPlan): Promise<(() => Promise<void>) | undefined>;
};

// The one run loop: refuse modified outputs, retry what broke, then run each
// unfinished step under a .running marker and complete it with its record.
export async function runSection(run: SectionRun): Promise<SectionPlan> {
  const plan = await inspectSection(run.directory, run.steps, !run.fresh, run.upstream);
  const modified = modifiedError(plan, plan.chain);
  if (modified) throw modified;
  await run.check?.(plan);
  if (plan.resetFrom !== undefined) run.progress?.(`${run.dryRun ? '预览：将' : '将'}重置 ${stepId(plan.resetFrom)} 及依赖它的后续步骤${run.resetNote ?? ''}。`);
  for (const step of plan.chain) {
    if (plan.defined.has(step.id) && plan.statuses.get(step.id) === 'completed' && !plan.reset.includes(step.id)) await run.keep?.(step, plan);
  }
  if (!run.dryRun) {
    run.signal?.throwIfAborted();
    await run.prepare?.(plan);
    await resetChain(plan.chain, plan);
  }
  for (const id of plan.reset) plan.statuses.set(id, 'absent');
  for (const step of plan.chain) {
    if (!plan.defined.has(step.id)) continue;
    run.signal?.throwIfAborted();
    const status = plan.statuses.get(step.id)!;
    const work = await run.step(step, status, plan);
    if (!work) {
      if (status !== 'completed') throw new Error(`${step.id} 尚未完成，不能跳过`);
      continue;
    }
    if (run.dryRun) { await work(); continue; }
    await mkdir(step.directory, { recursive: true });
    await startStep(step.directory, status);
    await work();
    run.signal?.throwIfAborted();
    await completeStep(step, plan.chain);
    plan.statuses.set(step.id, 'completed');
  }
  return plan;
}
