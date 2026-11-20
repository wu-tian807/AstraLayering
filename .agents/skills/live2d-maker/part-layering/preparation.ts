import { normalizeGeneratedReference } from '../shared/part/reference-normalization.ts';
import type { ImageProcessingOptions } from '../shared/image-processing.ts';
import { sectionDirectory, resolveInput, taskDirectory } from '../shared/paths.ts';
import { mkdir, rm } from 'node:fs/promises';
import { copyAsPng, pngBytes } from '../shared/png.ts';
import { dirname, join, resolve } from 'node:path';
import { readPreparationOptions } from '../shared/part/preparation-cache.ts';
import { standardReferenceSteps } from '../shared/step-paths.js';
import { inspectSection, runSection, stepName, type SectionPlan } from '../shared/step-section.ts';
import type { PreparationInput, PreparationReferences } from '../shared/part/preparation-types.ts';
import { exists, findImage, preparationSteps, produce, publishStandardCanvas, reuseReference,
  sectionOf, stageNumber, stageStep, stepStage, writeJson, type PreparationStage, type PreparationStep } from './preparation-state.ts';
import { stepKnowledge } from '../shared/knowledge.ts';
import { taskRootOf } from '../shared/task-paths.ts';
import type { StepRange } from '../shared/step-range.ts';
import type { DressupDecision } from '../shared/part/dressup.ts';

export type { PreparationInput, PreparationReferences };
export type ProcessGenerated = (image: string) => Promise<void>;
// A reference step either generated its image or copied its input.
export type ReferenceChoice = { generated: boolean; reason: string };
export type PreparationSteps = {
  generateStandardReference(mode: 'standard' | 'cutout', inputImage: string, outputImage: string, prompt: string, outputDirectory: string): Promise<void>;
  simplify(inputImage: string, outputImage: string, prompt: string, processGenerated?: ProcessGenerated): Promise<void>;
  // Returns whether a dress-up base body was drawn (false: the reference was copied).
  baseSubject(inputImage: string, outputImage: string, prompt: string, processGenerated?: ProcessGenerated): Promise<ReferenceChoice | void>;
};

// {input} is the user's original image, whose extension varies; the prepared
// references sit at fixed task paths.
const readPrompt = (step: string, refs: PreparationReferences): string => stepKnowledge('part-layering', step)
  .render('main', { ...(refs.originalImage ? { input: resolve(refs.originalImage) } : {}) },
    { taskRoot: taskRootOf(dirname(refs.directory)) });
export function getPreparationDirectory(runName: string, root?: string): string {
  return join(sectionDirectory(runName, 'part-layering', root), 'references');
}
const inputDirectory = (runName: string, root?: string) => join(taskDirectory(runName, root), 'input');
async function references(runName: string, root?: string): Promise<PreparationReferences> {
  const directory = getPreparationDirectory(runName, root);
  const standard = join(directory, 'standard.png');
  return { directory, originalImage: await findImage(inputDirectory(runName, root), 'original'),
    ...(await exists(standard) ? { standardImage: standard } : {}),
    simplifiedSubject: join(directory, 'simplified-subject.png'),
    baseSubject: join(directory, 'base-subject.png') };
}
const outputs = (steps: readonly PreparationStep[]) =>
  new Map(steps.flatMap(step => step.output ? [[stepName(step.number, step.note), step.output] as const] : []));
const unfinished = (plan: SectionPlan, id: string) => plan.statuses.get(id) !== 'completed';

function modeError(directory: string, saved: boolean): Error {
  return new Error(`preparation 已按 --${saved ? '' : 'no-'}standard 制作（${join(sectionOf(directory), stageStep('options'))}），不能直接切换；请使用新的 --name。已有文件已保留。`);
}

// Explicit groups only read prepared inputs; no conversion, model call, copying or cache reset.
export async function loadPreparedReferences(runName: string, root?: string, standard?: boolean): Promise<PreparationReferences> {
  const refs = await references(runName, root), directory = refs.directory;
  const saved = await readPreparationOptions(directory);
  if (standard !== undefined && saved !== undefined && standard !== saved) throw modeError(directory, saved);
  const steps = await preparationSteps(refs, inputDirectory(runName, root)), paths = outputs(steps);
  const plan = await inspectSection(sectionOf(directory), steps);
  const missing: string[] = [];
  for (const step of plan.chain) {
    const path = paths.get(step.id);
    if (unfinished(plan, step.id) || (path && !await exists(path))) missing.push(`${step.id}：${path ?? step.directory}`);
  }
  if (missing.length) throw new Error(`前置参考未完成：\n${missing.join('\n')}\n请先完成参考准备。`);
  return refs;
}

export async function preparationRoute(input: PreparationInput): Promise<PreparationStep[]> {
  const refs = await references(input.runName, input.dir);
  const source = input.image === undefined ? undefined : resolveInput(input.runName, input.image, input.dir);
  return preparationSteps(refs, inputDirectory(input.runName, input.dir), source);
}

// Each preparation step runs by its own marker (shared/step-chain.ts).
export async function prepareReferences(input: PreparationInput, steps: PreparationSteps,
  progress?: (message: string) => void, options: ImageProcessingOptions = {}, range?: StepRange, signal?: AbortSignal): Promise<PreparationReferences> {
  const normalization = { ...options, runsRoot: input.dir ?? options.runsRoot, progress: progress ?? options.progress };
  const directory = getPreparationDirectory(input.runName, input.dir), inputs = inputDirectory(input.runName, input.dir);
  const source = input.image === undefined ? undefined : resolveInput(input.runName, input.image, input.dir);
  if (source) {
    if (!await exists(source)) throw new Error(`Input image is missing: ${source}`);
    const original = await findImage(inputs, 'original');
    if (original && !(await pngBytes(source)).equals(await pngBytes(original))) {
      throw new Error(`任务已有不同的原图：${original}。制作另一张图请使用新的 --name。`);
    }
  }
  const standard = input.standard ?? await readPreparationOptions(directory) ?? false;
  const initial = await references(input.runName, input.dir);
  const defined = await preparationSteps(initial, inputs, source), paths = outputs(defined);
  const branchNumber = stageNumber('standard');
  const needsOriginal = () => new Error('首次启动或原图缺失时，需要 --image <角色图片路径>');
  await runSection({ directory: sectionOf(directory), steps: defined, progress, range, signal,
    async prepare() { await mkdir(directory, { recursive: true }); },
    async check(plan) {
      const saved = await readPreparationOptions(directory);
      if (saved !== undefined && saved !== standard && !unfinished(plan, stageStep('options'))) throw modeError(directory, saved);
      if (source || initial.originalImage) return;
      const pending = plan.selected.find(step => unfinished(plan, step.id));
      const pendingStandard = standardReferenceSteps.some(id => plan.defined.has(id) && unfinished(plan, id));
      if (pending?.id === stageStep('original') || (pending && !initial.standardImage && !pendingStandard)) {
        throw needsOriginal();
      }
    },
    async step(step, status) {
      const stage = stepStage(step.id);
      if (status === 'completed') { reuse(stage); return; }
      const refs = await references(input.runName, input.dir);
      return () => run(stage, paths.get(step.id)!, refs);
    },
  });
  return references(input.runName, input.dir);

  function reuse(id: PreparationStage) {
    if (stageNumber(id) === branchNumber) progress?.('标准参考：沿用已有 standard.png');
    if (id === 'simplified') progress?.('简化图片：沿用已有参考');
    if (id === 'base') progress?.('素体换装：沿用已有参考');
  }
  async function prepared(stage: 'simplified' | 'base', target: string, refs: PreparationReferences,
    generate: (output: string, processGenerated: ProcessGenerated) => Promise<void>) {
    await produce(target, temporary => generate(temporary, async image => {
      if (!refs.standardImage) throw new Error('参考后处理缺少 standard.png');
      // Raw generation is retained outside the final reference filenames for diagnosis.
      await normalizeGeneratedReference(image, refs.standardImage, join(sectionOf(directory), stageStep(stage)), stage, normalization);
    }));
  }
  async function run(id: PreparationStage, output: string, refs: PreparationReferences) {
    switch (id) {
      case 'original':
        await mkdir(inputs, { recursive: true });
        if (!await exists(output)) await produce(output, temporary => copyAsPng(source!, temporary));
        return;
      case 'options': return writeJson(output, { standard });
      case 'standard':
      case 'cutout':
      case 'passthrough': {
        const pending = join(sectionOf(directory), stageStep(id), 'standard-input.png');
        if (await publishStandardCanvas(output, output) || await publishStandardCanvas(pending, output)) {
          await rm(pending, { force: true });
          reuse(id);
          return;
        }
        const original = refs.originalImage;
        if (!original) throw needsOriginal();
        const mode = standard && id === 'standard' ? 'standard' : 'cutout';
        const reused = mode === 'cutout' && await reuseReference(original, pending, true);
        if (!reused) {
          await steps.generateStandardReference(mode, original, pending, readPrompt(stageStep(mode), refs), stageStep(id));
        }
        if (!await publishStandardCanvas(pending, output)) throw new Error('标准参考须交付 PNG。');
        await rm(pending, { force: true });
        return;
      }
      case 'simplified':
        return prepared('simplified', output, refs, async (temporary, processGenerated) =>
          steps.simplify(refs.standardImage!, temporary, readPrompt('step05_simplified', refs), processGenerated));
      case 'base': {
        let choice: ReferenceChoice | undefined;
        await prepared('base', output, refs, async (temporary, processGenerated) => {
          choice = await steps.baseSubject(refs.simplifiedSubject, temporary, readPrompt('step06_base', refs), processGenerated) || undefined;
        });
        // Read by the scheduler to decide whether the clothing lane runs.
        const records = join(sectionOf(directory), stageStep('base'));
        const made = choice as ReferenceChoice | undefined;
        if (made) await mkdir(records, { recursive: true }).then(() => writeJson(join(records, 'decision.json'),
          { version: 1, dressed: made.generated, reason: made.reason } satisfies DressupDecision));
        return;
      }
      case 'ready':
    }
  }
}
