import type { SectionId } from '../paths.ts';
import { isPartLayeringInput, resolvePartInput, type PartLayeringInput } from './input.ts';
import { buildPrompt, type StepDefinition } from './steps.ts';
import type { KritaSection } from './workflow.ts';
import { dirname, join } from 'node:path';
import { taskRootOf } from '../task-paths.ts';
import { createReviewAnnotationTool } from './review-annotation.ts';
import { createStructureTools, validateRasterStructure } from './structure-tools.ts';
import { readDressup } from '../part/dressup.ts';
import { copyDelivery } from './passthrough.ts';
import { partSteps } from '../step-paths.js';

type PartRasterDefinition = {
  id: Extract<SectionId, 'raster-layering' | 'clothing-raster-layering'>;
  inputSection: Extract<SectionId, 'part-layering' | 'clothing-part-layering'>;
  steps: readonly StepDefinition[];
};

// Keep part-specific prompts and occlusion editing out of downstream assembly.
export function partRasterSection<T extends PartRasterDefinition>(definition: T): T & KritaSection<PartLayeringInput> {
  return {
    ...definition,
    resolveInput: (name, root) => resolvePartInput(name, definition.inputSection, root),
    validateInput: isPartLayeringInput,
    inputDirectories: input => [input.directory],
    // occlusion is the last part step.
    upstreamStep: input => ({ id: `${definition.inputSection}/${partSteps.occlusion}`, directory: join(input.directory, partSteps.occlusion) }),
    tools: (output, input, step, phase) => step.id === 'step01' && phase.startsWith('review-')
      ? [createReviewAnnotationTool(dirname(output), dirname(dirname(output)), join(output, 'review-evidence'))]
      : step.id === 'step01' && (phase === 'draw' || phase.startsWith('repair-'))
        ? createStructureTools(input) : [],
    deliveryWarnings: async (input, step) => {
      if (step.id !== 'step01') return [];
      try { await validateRasterStructure(input); return []; }
      catch (error) { return [error instanceof Error ? error.message : String(error)]; }
    },
    // Without a dress-up base body there is no bodysuit to remove: step03
    // delivers the soft-edged character as it is.
    passthrough: async (output, input, step) => {
      if (definition.id !== 'raster-layering' || step.id !== 'step03' || await readDressup(taskRootOf(input.directory)) !== false) return;
      const previous = join(dirname(output), 'step02');
      return copyDelivery(output, '素体换装沿用了简化参考，没有连体服需要去除', [
        [join(previous, 'character-soft-edges.kra'), 'character-dressup-base.kra'],
        [join(previous, 'character-soft-edges.png'), 'character-dressup-base.png'],
      ]);
    },
    buildPrompt,
  };
}
