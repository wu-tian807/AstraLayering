import { stepKnowledge } from '../knowledge.ts';
import type { ModelSelection, ModelTier } from '../codex/environment.ts';
import type { AgentStep } from '../agents/models.ts';
import { dirname } from 'node:path';
import type { PartLayeringInput } from './input.ts';
import { taskRootOf } from '../task-paths.ts';

export type StepDefinition = {
  id: string;
  title: string;
  model?: string;
  effort?: ModelSelection['effort'];
  modelTier?: ModelTier;
  modelStep?: AgentStep;
  knowledge: { section: string; step: string }; // knowledge/<section>/<step>/agent.json
  inputFiles?: readonly string[]; // Relative to this section directory; previous deliveries are read-only.
  requiredFiles: readonly string[];
  previewFiles?: readonly string[]; // Published optional previews; * matches within this step.
  krita?: false; // The step does not operate Krita: it takes no Krita slot and its agents get no krita tool.
  review?: { model?: string; effort?: ModelSelection['effort']; modelTier?: ModelTier; modelStep?: AgentStep; repairModelStep?: AgentStep };
};

export async function buildPrompt(step: StepDefinition, _input: PartLayeringInput, output: string, _previous: readonly string[] = []): Promise<string> {
  // The step's own knowledge names its fixed paths under the task root.
  return stepKnowledge(step.knowledge.section, step.knowledge.step).render('main', {}, { taskRoot: taskRootOf(dirname(output)) });
}
