import { lstat, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { type SectionStep } from '../shared/step-section.ts';
import { copyAsPng } from '../shared/png.ts';
import { preparationOptionsPath } from '../shared/part/preparation-cache.ts';
import type { ReferenceProcessingOptions } from '../shared/part/reference-normalization.ts';
import { sectionSizePixels } from '../shared/section-size.ts';
import { upscaleReferenceImage } from '../shared/upscale-image.ts';
import type { PreparationReferences } from '../shared/part/preparation-types.ts';
import { recordedReferenceBranch, stageNote, stageNumber, stageStep, stepStage, type PreparationStage } from '../shared/part/preparation-steps.ts';
export { preparationStages, stageNumber, stageStep, stepStage, type PreparationStage } from '../shared/part/preparation-steps.ts';

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

export const sectionOf = (references: string) => dirname(references);

export async function hasTransparentBackground(path: string): Promise<boolean> {
  const metadata = await sharp(path).metadata();
  if (metadata.format !== 'png' || !metadata.hasAlpha) return false;
  const { data, info: { width, height } } = await sharp(path).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  const bottom = (height - 1) * width;
  for (let x = 0; x < width; x++) {
    if (data[x] > 8 || data[bottom + x] > 8) return false;
  }
  for (let y = 1; y < height - 1; y++) {
    if (data[y * width] > 8 || data[(y + 1) * width - 1] > 8) return false;
  }
  return data.some(alpha => alpha > 8);
}

export async function reuseReference(input: string, output: string, requireTransparent: boolean, signal?: AbortSignal): Promise<boolean> {
  if (requireTransparent && !await hasTransparentBackground(input)) return false;
  signal?.throwIfAborted();
  await produce(output, temporary => copyAsPng(input, temporary));
  signal?.throwIfAborted();
  return true;
}

const canvasGrid = 16;

export async function publishStandardCanvas(input: string, output: string, options: ReferenceProcessingOptions = {}): Promise<boolean> {
  if (!await exists(input)) return false;
  const source = await readFile(input);
  let bytes: Buffer = source;
  let metadata = await sharp(bytes).metadata().catch(() => undefined);
  if (metadata?.format !== 'png') return false;

  if (options.size) {
    const nominal = sectionSizePixels(options.size);
    // The largest aligned size before the next tier starts.
    const ceiling = nominal + 1024 - canvasGrid;
    let bound = ceiling;
    if (options.size !== '1K' && Math.max(metadata.width, metadata.height) < nominal) {
      bytes = await (options.upscale ?? upscaleReferenceImage)(bytes, options);
      metadata = await sharp(bytes).metadata();
      bound = nominal;
    }
    if (Math.max(metadata.width, metadata.height) > bound) {
      const resized = sharp(bytes).resize(bound, bound, { fit: 'inside' });
      if (metadata.depth === 'ushort') resized.toColourspace('rgb16');
      bytes = await resized.keepIccProfile().png().toBuffer();
      metadata = await sharp(bytes).metadata();
    }
  }

  const right = (canvasGrid - metadata.width % canvasGrid) % canvasGrid;
  const bottom = (canvasGrid - metadata.height % canvasGrid) % canvasGrid;
  if (!right && !bottom && input === output && bytes === source) return true;

  // Extend away from the origin to leave the existing pixel coordinates intact.
  const image = sharp(bytes);
  if (metadata.depth === 'ushort') image.toColourspace('rgb16');
  const delivered = right || bottom
    ? await image.extend({ right, bottom, background: '#00000000' }).keepIccProfile().png().toBuffer()
    : bytes;
  options.signal?.throwIfAborted();
  await produce(output, temporary => writeFile(temporary, delivered));
  return true;
}

// Existing step04 markers still identify the reference in tasks that used separate branches.
export type PreparationStep = SectionStep & { output?: string };
export async function preparationSteps(refs: PreparationReferences, inputDirectory: string, source?: string): Promise<PreparationStep[]> {
  const root = sectionOf(refs.directory);
  const original = refs.originalImage ?? (source || await present(join(root, stageStep('original')))
    ? join(inputDirectory, 'original.png') : undefined);
  const recorded = await recordedReferenceBranch(root);
  const selected = recorded && stepStage(recorded.id);
  const steps: [PreparationStage, string?][] = [];
  if (original) steps.push(['original', original]);
  steps.push(['options', preparationOptionsPath(refs.directory)]);
  if (selected || original || refs.standardImage) steps.push([selected ?? 'standard', join(refs.directory, 'standard.png')]);
  steps.push(['simplified', refs.simplifiedSubject], ['base', refs.baseSubject], ['ready']);
  return steps.map(([stage, output]) => ({
    number: stageNumber(stage), note: stageNote(stage), ...(output ? { output, requiredFiles: [output] } : {}),
  }));
}
