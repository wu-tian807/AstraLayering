import { stepNumber } from './step-paths.js';

export type StepSelection = { fromStep?: string; toStep?: string; maxRecursiveCounts?: number };
export type StepRange = { from: number; to: number };

export function resolveStepRange(ids: readonly string[], selection?: StepSelection): StepRange | undefined {
  if (!selection || (selection.fromStep === undefined && selection.toStep === undefined)) return;
  function endpoint(option: string, name: string): number {
    const id = ids.find(step => step === name || step.slice(0, 6) === name);
    if (!id) throw new Error(`${option} 不在本次步骤路线中：${name}。可选：${ids.join('、')}`);
    return stepNumber(id)!;
  }
  const from = selection.fromStep === undefined ? stepNumber(ids[0])! : endpoint('--from-step', selection.fromStep);
  const to = selection.toStep === undefined ? from : endpoint('--to-step', selection.toStep);
  if (from > to) throw new Error('--from-step 必须不晚于 --to-step');
  return { from, to };
}

export function includesStep(range: StepRange | undefined, id: string): boolean {
  if (!range) return true;
  const number = stepNumber(id.split('/')[0]);
  return number !== undefined && number >= range.from && number <= range.to;
}

// A loop names its backward edge. Every branch entering the same iteration
// shares its position in the budget, regardless of when it is dispatched.
export function createStepLoop(from: string, after: string, range?: StepRange, limit?: number) {
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
    throw new Error('--max-recursive-counts 必须是非负整数');
  }
  const allowed = includesStep(range, from) && includesStep(range, after);
  const count = limit ?? (range && range.to <= stepNumber(after)! ? 0 : Infinity);
  let start: number | undefined;
  return {
    enter(iteration: number) {
      start ??= iteration;
      return { canLoop: allowed && iteration - start < count };
    },
  };
}
