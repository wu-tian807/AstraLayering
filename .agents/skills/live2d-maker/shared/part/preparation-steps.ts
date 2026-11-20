import { join } from 'node:path';
import { readStep } from '../step-chain.ts';
import { partSteps, standardReferenceSteps, stepNumber, stepPattern } from '../step-paths.js';

// The preparation stages are the first steps of the part section.
export const preparationStages = ['original', 'options', 'pose', 'standard', 'cutout', 'passthrough', 'simplified', 'base', 'ready'] as const;
export type PreparationStage = typeof preparationStages[number];
export const stageStep = (stage: PreparationStage) => partSteps[stage];
export const stageNumber = (stage: PreparationStage) => stepNumber(partSteps[stage])!;
export const stageNote = (stage: PreparationStage) => stepPattern.exec(partSteps[stage])![2];
export const stepStage = (id: string) => preparationStages.find(stage => stageStep(stage) === id)!;

export async function recordedReferenceBranch(root: string) {
  for (const id of standardReferenceSteps) {
    const { status } = await readStep(join(root, id));
    if (status === 'running' || status === 'completed') return { id, status };
  }
}
