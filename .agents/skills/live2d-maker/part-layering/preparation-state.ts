import { lstat, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { type SectionStep } from '../shared/step-section.ts';
import { preparationOptionsPath } from '../shared/part/preparation-cache.ts';
import type { PreparationReferences } from '../shared/part/preparation-types.ts';
import { recordedReferenceBranch, stageNote, stageNumber, stageStep, stepStage, type PreparationStage } from '../shared/part/preparation-steps.ts';
export { preparationStages, stageNumber, stageStep, stepStage, type PreparationStage } from '../shared/part/preparation-steps.ts';

export type StandardJudgment = { needsAdjustment: boolean; reason?: string };

export function checkStandardJudgment(value: unknown): asserts value is StandardJudgment {
  if (!value || typeof value !== 'object' || typeof (value as StandardJudgment).needsAdjustment !== 'boolean'
    || ((value as StandardJudgment).reason !== undefined && typeof (value as StandardJudgment).reason !== 'string')) {
    throw new Error('姿态判断须包含 boolean needsAdjustment，reason 须为字符串');
  }
}
export async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
export async function exists(path: string): Promise<boolean> {
  try { return (await lstat(path)).isFile(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
export async function findImage(directory: string, name: string): Promise<string | undefined> {
  let names: string[];
  try { names = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const matches: string[] = [];
  for (const file of names) {
    if (file.startsWith(`${name}.`) && !file.endsWith('.tmp') && await exists(join(directory, file))) matches.push(join(directory, file));
  }
  if (matches.length > 1) throw new Error(`Multiple ${name} images found in ${directory}`);
  return matches[0];
}

// Writes go to a temporary file first, so an interrupted step never leaves a partial output.
export async function produce(output: string, generate: (temporary: string) => Promise<void>): Promise<void> {
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await generate(temporary);
    if (!await exists(temporary)) throw new Error(`Preparation output was not produced: ${output}`);
    await rename(temporary, output);
  } finally { await rm(temporary, { force: true }); }
}
export const writeJson = (output: string, value: unknown) => produce(output, temporary =>
  writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8'));

// Preparation is the first stage of the part section, with fixed step
// numbers; pose keeps its number when a run does not standardize.
export const sectionOf = (references: string) => dirname(references);
export const poseJudgmentPath = (references: string) => join(sectionOf(references), stageStep('pose'), 'judgment.json');

export async function hasTransparentBackground(path: string): Promise<boolean> {
  const metadata = await sharp(path).metadata();
  if (metadata.format !== 'png' || !metadata.hasAlpha) return false;
  const { data, info: { width, height } } = await sharp(path).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  return data.some((alpha, pixel) => alpha <= 8 && (pixel < width || pixel >= (height - 1) * width
    || pixel % width === 0 || pixel % width === width - 1)) && data.some(alpha => alpha > 8);
}

// Each step's output stays at its existing reference path; the options and
// the pose judgment live in their own step directories. The input original and
// the standard image take part when the task has them; older tasks made before
// the original was kept go on from their references alone. `ready` marks that
// the references are prepared for splitting.
export type PreparationStep = SectionStep & { output?: string };
export async function preparationSteps(refs: PreparationReferences, standard: boolean, inputDirectory: string, source?: string,
  branch?: PreparationStage): Promise<PreparationStep[]> {
  const root = sectionOf(refs.directory);
  const original = refs.originalImage ?? (source || await present(join(root, stageStep('original')))
    ? join(inputDirectory, 'original.png') : undefined);
  const recorded = branch ? undefined : await recordedReferenceBranch(root);
  const selected = branch ?? (recorded && stepStage(recorded.id));
  const steps: [PreparationStage, string?][] = [];
  if (original) steps.push(['original', original]);
  steps.push(['options', preparationOptionsPath(refs.directory)]);
  if (standard && original) steps.push(['pose', poseJudgmentPath(refs.directory)]);
  if (selected || original || refs.standardImage) steps.push([selected ?? 'standard', join(refs.directory, 'standard.png')]);
  steps.push(['simplified', refs.simplifiedSubject], ['base', refs.baseSubject], ['ready']);
  return steps.map(([stage, output]) => ({ number: stageNumber(stage), note: stageNote(stage), ...(output ? { output } : {}) }));
}
