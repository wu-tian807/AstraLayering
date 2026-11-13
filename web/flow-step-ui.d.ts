import type { ProgressStep } from './progress.js';
export type FlowStepUI = {
  index: number;
  esc(value: unknown): string;
  icon(name: string): string;
  statusMark(status: string): string;
  statusLabel(status: string): string;
};
export function flowStepHeading(step: ProgressStep, context: FlowStepUI & {
  status?: string;
  closed: boolean;
}): string;
export function flowStepList(steps: ProgressStep[], context: FlowStepUI): string;
