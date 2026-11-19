import { stepNumber } from './step-paths.js';

export type StepRange = { from?: number; to?: number };

export function includesStep(range: StepRange | undefined, step: string): boolean {
  if (!range) return true;
  const number = stepNumber(step);
  return number !== undefined && number >= (range.from ?? 0) && number <= (range.to ?? Infinity);
}

export function resolveStepRange(steps: readonly string[], from?: string, to?: string): StepRange {
  function endpoint(name: string | undefined, option: string) {
    if (name === undefined) return;
    const step = steps.find(id => id === name || id.slice(0, 6) === name);
    if (!step) throw new Error(`${option} 没有对应的步骤：${name}`);
    return stepNumber(step)!;
  }
  const first = endpoint(from, '--from-step');
  const last = endpoint(to, '--to-step') ?? first;
  if (first !== undefined && last !== undefined && first > last) throw new Error('--from-step 必须不晚于 --to-step');
  return { from: first, to: last };
}
