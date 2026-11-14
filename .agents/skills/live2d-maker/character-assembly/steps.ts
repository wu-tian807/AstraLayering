import { stepKnowledge } from '../shared/knowledge.ts';
import { dirname } from 'node:path';
import type { StepDefinition } from '../shared/raster/steps.ts';
import type { AssemblyInput } from './input.ts';
import { taskRootOf } from '../shared/task-paths.ts';

export const steps = [{
  id: 'step01', title: '人物与衣服 KRA 组装', modelStep: 'assembly',
  knowledge: { section: 'character-assembly', step: 'step01' },
  requiredFiles: ['character-assembled.kra', 'character-assembled.png', 'report.md'],
  previewFiles: ['final-overall-comparison.jpg'],
}] as const satisfies readonly StepDefinition[];

export async function buildPrompt(step: StepDefinition, input: AssemblyInput, output: string): Promise<string> {
  if (!input.clothingKra) throw new Error('没有衣服 KRA 时组装直接复制人物结果，不需要提示词。');
  // The step's own knowledge names its fixed paths under the task root.
  return stepKnowledge(step.knowledge.section, step.knowledge.step).render('main', {}, { taskRoot: taskRootOf(dirname(output)) });
}
