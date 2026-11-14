import type { StepDefinition } from '../shared/raster/steps.ts';
export type { StepDefinition } from '../shared/raster/steps.ts';
export { buildPrompt } from '../shared/raster/steps.ts';

export const steps = [{
  id: 'step01', title: '衣服分件、补全与 Krita 拼装', modelStep: 'clothing_raster_step01',
  knowledge: { section: 'clothing-raster-layering', step: 'step01' },
  requiredFiles: ['clothing-depth.kra', 'report.md'],
  review: {
    modelStep: 'clothing_raster_step01_review', repairModelStep: 'clothing_raster_step01_repair',
  },
}, {
  id: 'step02', title: '衣服边缘与衔接修画', modelStep: 'clothing_raster_step02',
  knowledge: { section: 'clothing-raster-layering', step: 'step02' },
  inputFiles: ['step01/clothing-depth.kra', 'step01/report.md'],
  requiredFiles: ['clothing-soft-edges.kra', 'report.md'],
}] as const satisfies readonly StepDefinition[];
