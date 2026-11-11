import type { StepStatus } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
export type ExecutionStatus = 'pending' | 'running' | 'throttled' | 'done' | 'failed' | 'interrupted' | 'skipped';
export function executionStatus(marker: StepStatus, observation?: { active?: boolean; failed?: boolean; waiting?: boolean }): ExecutionStatus;
export function aggregateStatus(values: (ExecutionStatus | undefined)[]): ExecutionStatus;
