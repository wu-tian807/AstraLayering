import type { ProgressStep } from './progress.js';
export function nineAxisStepCard(step: ProgressStep, context: {
  esc(value: unknown): string;
  icon(name: string): string;
  statusMark(status: string): string;
  statusLabel(status: string): string;
  content(step: ProgressStep): string;
  collapsed: Set<string>;
  selected?: string | null;
}): string;
