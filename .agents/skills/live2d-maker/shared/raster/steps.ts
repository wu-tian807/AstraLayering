import {renderPrompt, renderPromptFile} from '../prompts/render.ts';
import {kritaEnvironmentPrompt} from '../krita/environment.ts';
import type { ModelSelection, ModelTier } from '../codex/environment.ts';
import type { AgentStep } from '../agents/models.ts';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PartLayeringInput } from './input.ts';
import type { KritaInstallation } from './krita.ts';

export type StepDefinition = {
  id: string;
  title: string;
  freshSession?: boolean;
  // Tool-produced diagnostics may exist before the scheduler starts this step.
  // They do not establish running/completed state and still require validation.
  allowsEarlyArtifacts?: boolean;
  model: string;
  effort: ModelSelection['effort'];
  modelTier?: ModelTier;
  modelStep?: AgentStep;
  prompt: URL;
  inputFiles?: readonly string[]; // Relative to the named run root; previous deliveries are read-only.
  requiredFiles: readonly string[];
  review?: { prompt: URL; repairPrompt: URL; model: string; effort: ModelSelection['effort']; modelTier?: ModelTier; modelStep?: AgentStep; repairModelStep?: AgentStep };
};

export async function buildPrompt(step: StepDefinition, input: PartLayeringInput, output: string, krita: KritaInstallation, previous: readonly string[] = []): Promise<string> {
  // The final report also checkpoints the initial drawing before review begins.
  // Publish it only after the agent turn and all delivery checks have succeeded.
  const report = step.review ? 'report.md.tmp' : 'report.md';
  const responsibilities = step.id === 'step01' ? await readFile(new URL('./drawing-responsibilities.md', import.meta.url), 'utf8') : '';
  const body = await readFile(step.prompt, 'utf8');
  const requiredFiles = step.requiredFiles.map(file => file === 'report.md' ? report : file);
  return renderPrompt(body, {
    drawing_report_filename: report, drawing_responsibilities: responsibilities,
    krita_environment: await kritaEnvironmentPrompt(krita),
    runtime_context: renderPromptFile(new URL('../prompts/raster-runtime.md', import.meta.url), {
      pipeline_directory: JSON.stringify(dirname(output)),
      input_files: JSON.stringify((step.inputFiles ?? []).map(file => join(dirname(output), file))),
      upstream_directory: JSON.stringify(input.directory),
      parts_path: JSON.stringify(input.parts),
      references_directory: JSON.stringify(join(input.directory, 'references')),
      original_character_reference: input.originalCharacter ? renderPromptFile(new URL('../prompts/raster-original-reference.md',import.meta.url),{original_character_path:JSON.stringify(input.originalCharacter)}).trim() : '',
      output_directory: JSON.stringify(output),
      previous_steps: JSON.stringify(previous.map(directory => ({ directory, report: join(directory, 'report.md') }))),
      krita_executable: JSON.stringify(krita.executable),
      krita_version: krita.version,
      required_files: JSON.stringify(requiredFiles.map(file => join(output, file))),
      report_path: JSON.stringify(join(output, report)),
      report_publish_rule: step.review ? renderPromptFile(new URL('../prompts/raster-report-publish.md',import.meta.url)).trim() : ''
    })
  }, String(step.prompt), ['drawing_responsibilities','krita_environment','runtime_context',...(step.review?['drawing_report_filename']:[])]);
}
