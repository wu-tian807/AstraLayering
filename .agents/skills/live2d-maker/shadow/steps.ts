import { stepKnowledge } from '../shared/knowledge.ts';
import { dirname } from 'node:path';
import type { StepDefinition } from '../shared/raster/steps.ts';
import type { ShadowMode } from '../shared/shadow.ts';
import type { ShadowInput } from './input.ts';
import { taskRootOf } from '../shared/task-paths.ts';

export const maskSteps = [{ id: 'step01_mask', title: '投影分析、阴影补全与原生裁切',
  modelStep: 'shadow_mask', knowledge: { section: 'shadow', step: 'step01_mask' },
  requiredFiles: ['character-shadowed.kra', 'character-shadowed.png', 'shadows.json', 'face-review.png', 'report.md'],
  previewFiles: ['inspection/overview.png', 'inspection/relation-*-review.png'],
}] as const satisfies readonly StepDefinition[];
export const mapSteps = [{ id: 'step01_normal-depth', title: '生成配准的整图法线与深度',
  modelStep: 'shadow_maps', knowledge: { section: 'shadow', step: 'step01_normal-depth' },
  requiredFiles: ['normal.png', 'depth.png', 'report.md'], krita: false,
}] as const satisfies readonly StepDefinition[];
export const stepsFor = (mode: ShadowMode): readonly StepDefinition[] => mode === 'mask' ? maskSteps : mapSteps;
export async function buildPrompt(step: StepDefinition, _input: ShadowInput, output: string): Promise<string> {
  // The step's own knowledge names its fixed paths under the task root.
  return stepKnowledge(step.knowledge.section, step.knowledge.step).render('main', {}, { taskRoot: taskRootOf(dirname(output)) });
}
