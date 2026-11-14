import type { StepDefinition } from '../shared/raster/steps.ts';
export type { StepDefinition } from '../shared/raster/steps.ts';
export { buildPrompt } from '../shared/raster/steps.ts';

export const steps = [{
  id: 'step01',
  title: '分层、补全与 Krita 交付',
  modelStep: 'raster_step01',
  knowledge: { section: 'raster-layering', step: 'step01' },
  requiredFiles: ['character-depth.kra', 'report.md'],
  review: {
    modelStep: 'raster_step01_review', repairModelStep: 'raster_step01_repair',
  },
}, {
  id: 'step02',
  title: '边缘柔化与去锯齿',
  modelStep: 'raster_step02',
  knowledge: { section: 'raster-layering', step: 'step02' },
  inputFiles: ['step01/character-depth.kra', 'step01/report.md'],
  requiredFiles: ['character-soft-edges.kra', 'character-soft-edges.png', 'report.md'],
}, {
  id: 'step03',
  title: '去除连体服与补全身体底层',
  modelStep: 'raster_step03',
  knowledge: { section: 'raster-layering', step: 'step03' },
  inputFiles: ['step02/character-soft-edges.kra', 'step02/report.md'],
  requiredFiles: ['character-dressup-base.kra', 'character-dressup-base.png', 'report.md'],
}] as const satisfies readonly StepDefinition[];
