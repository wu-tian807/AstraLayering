import { normalizeGeneratedReference } from '../shared/part/reference-normalization.ts';
import type { ImageProcessingOptions } from '../shared/image-processing.ts';
import { pipelineDirectory, resolveInput, taskDirectory } from '../shared/paths.ts';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { clearPreparedParts, fileHash, readPreparationOptions } from '../shared/part/preparation-cache.ts';
import { modifiedError, type ChainPlan, type ChainStep } from '../shared/step-chain.ts';
import { inspectSection, runSection } from '../shared/step-section.ts';
import type { PreparationInput, PreparationReferences } from '../shared/part/preparation-types.ts';
import { checkJudgment, checkStandardJudgment, copyAsPng, exists, findImage, poseJudgmentPath, preparationSteps, present, produce,
  sectionDirectory, stageStep, stepStage, writeJson, type PreparationStage, type ReferenceJudgment, type StandardJudgment } from './preparation-state.ts';
import { migratePreparation, migrateStepLayout } from './preparation-migration.ts';

export type { PreparationInput, PreparationReferences, ReferenceJudgment, StandardJudgment };
export type PreparationSteps = {
  judgeStandard(image: string, prompt: string): Promise<StandardJudgment>;
  standardize(inputImage: string, outputImage: string, prompt: string): Promise<void>;
  judge(image: string, prompt: string): Promise<ReferenceJudgment>;
  simplify(inputImage: string, outputImage: string, prompt: string): Promise<void>;
  baseSubject(inputImage: string, outputImage: string, prompt: string): Promise<void>;
};

function readPrompt(name: string): Promise<string> {
  return readFile(new URL(`prompts/${name}`, import.meta.url), 'utf8');
}
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
export function getPreparationDirectory(runName: string, root?: string): string {
  return join(pipelineDirectory(runName, 'part-layering', root), 'references');
}
const inputDirectory = (runName: string, root?: string) => join(taskDirectory(runName, root), 'input');
async function references(runName: string, root?: string): Promise<PreparationReferences> {
  const directory = getPreparationDirectory(runName, root);
  const standard = join(directory, 'standard.png');
  return { directory, originalImage: await findImage(inputDirectory(runName, root), 'original'),
    ...(await exists(standard) ? { standardImage: standard } : {}), judgment: join(directory, 'judgment.json'),
    simplifiedSubject: await findImage(directory, 'simplified-subject') ?? join(directory, 'simplified-subject.png'),
    baseSubject: join(directory, 'base-subject.png') };
}
const output = (step: ChainStep) => resolve(step.directory, step.outputs![0]);
const unfinished = (plan: ChainPlan, id: string) => plan.reset.includes(id) || plan.statuses.get(id) !== 'completed';

function modeError(directory: string, saved: boolean): Error {
  return new Error(`preparation 已按 --${saved ? '' : 'no-'}standard 制作，不能直接切换。需要切换时请对 options 步骤执行重试：删除 ${join(sectionDirectory(directory), stageStep('options'), '.completed')} 后带新选项重跑，之后的参考会随之重做；或使用新的 --name。已有文件已保留。`);
}

// Explicit groups only read prepared inputs; no conversion, model call, copying or cache reset.
export async function loadPreparedReferences(runName: string, root?: string, standard?: boolean): Promise<PreparationReferences> {
  const refs = await references(runName, root), directory = refs.directory;
  if (!await present(sectionDirectory(directory))) {
    if (await present(join(directory, '.steps')) || await present(join(directory, 'preparation.json'))) {
      throw new Error('preparation 记录尚未转换为步骤记录；请先不带 --groups 运行一次默认流程。');
    }
    // Bare references of tasks older than any record are read as they are.
    const missing = [];
    for (const path of [refs.judgment, refs.simplifiedSubject, refs.baseSubject]) if (!await exists(path)) missing.push(path);
    if (standard && !missing.length) throw modeError(directory, false);
    if (missing.length) throw new Error(`显式 groups 的前置参考未完成：\n${missing.join('\n')}\n请先使用默认流程完成参考准备。`);
    return refs;
  }
  const saved = await readPreparationOptions(directory);
  if (standard !== undefined && saved !== undefined && standard !== saved) throw modeError(directory, saved);
  const plan = await inspectSection(sectionDirectory(directory), await preparationSteps(refs, saved ?? standard ?? false, inputDirectory(runName, root)));
  const modified = modifiedError(plan, plan.chain);
  if (modified) throw modified;
  const missing = plan.chain.filter(step => plan.defined.has(step.id) && unfinished(plan, step.id))
    .map(step => `${step.id}：${step.outputs ? output(step) : step.directory}`);
  if (missing.length) throw new Error(`显式 groups 的前置参考未完成：\n${missing.join('\n')}\n请先使用默认流程完成参考准备。`);
  return refs;
}

// Each preparation step is one link of the shared step chain: a step whose
// output or marker is gone reruns with everything built on it, and outputs
// replaced while the run was interrupted stop the run until that step is retried.
export async function prepareReferences(input: PreparationInput, steps: PreparationSteps,
  progress?: (message: string) => void, options: ImageProcessingOptions = {}): Promise<PreparationReferences> {
  const normalization = { ...options, runsRoot: input.dir ?? options.runsRoot, progress: progress ?? options.progress, krita: options.krita ?? (input.krita && resolveInput(input.runName, input.krita, input.dir)) };
  const directory = getPreparationDirectory(input.runName, input.dir), inputs = inputDirectory(input.runName, input.dir);
  const source = input.image === undefined ? undefined : resolveInput(input.runName, input.image, input.dir);
  if (source) {
    if (!await exists(source)) throw new Error(`Input image is missing: ${source}`);
    const original = await findImage(inputs, 'original');
    if (original && await fileHash(source) !== await fileHash(original)) {
      throw new Error(`任务已有不同的原图：${original}。制作另一张图请使用新的 --name。`);
    }
  }
  await mkdir(directory, { recursive: true });
  await migrateStepLayout(directory);
  await migratePreparation(await references(input.runName, input.dir), inputs, progress);
  const standard = input.standard ?? await readPreparationOptions(directory) ?? false;
  const initial = await references(input.runName, input.dir);
  let partsBuilt = false;
  await runSection({
    directory: sectionDirectory(directory), steps: await preparationSteps(initial, standard, inputs, source), progress,
    async check(plan) {
      const saved = await readPreparationOptions(directory);
      if (saved !== undefined && saved !== standard && !unfinished(plan, stageStep('options'))) throw modeError(directory, saved);
      // Refuse before deleting anything when the step cannot be redone.
      const pending = plan.chain.find(step => plan.defined.has(step.id) && unfinished(plan, step.id));
      const stage = pending && stepStage(pending.id), has = (stage: PreparationStage) => plan.defined.has(stageStep(stage));
      if ((stage === 'original' && !source && (plan.reset.includes(pending!.id) || !initial.originalImage))
        || ((stage === 'pose' || stage === 'standard') && !has('original'))
        || ((stage === 'judgment' || stage === 'simplified' || stage === 'base') && !has('standard'))) {
        throw new Error('首次启动或原图缺失时，需要 --image <角色图片路径>');
      }
      partsBuilt = plan.reset.includes(stageStep('ready'));
    },
    async step(step, status) {
      const refs = await references(input.runName, input.dir), stage = stepStage(step.id);
      if (status === 'completed') { await reuse(stage, refs); return; }
      return () => run(stage, step, refs);
    },
  });
  return references(input.runName, input.dir);

  async function reuse(id: PreparationStage, refs: PreparationReferences) {
    if (id === 'standard') progress?.('标准参考：沿用已有 standard.png');
    if (id === 'judgment') { progress?.('参考判断：沿用已有 judgment.json'); await reportJudgment(refs); }
    if (id === 'simplified') progress?.('简化图片：沿用已有参考');
    if (id === 'base') progress?.('素体换装：沿用已有参考');
  }
  async function reportJudgment(refs: PreparationReferences) {
    const decision = await readJson(refs.judgment);
    checkJudgment(decision);
    progress?.(`参考判断：${decision.needsSimplification ? '需要转换 Live2D 画风' : '沿用原图画风'}${decision.reason ? `；${decision.reason}` : ''}`);
    return decision;
  }
  async function normalized(stage: 'simplified' | 'base', target: string, refs: PreparationReferences, generate: (output: string) => Promise<void>) {
    await produce(target, async temporary => {
      await generate(temporary);
      if (!await exists(temporary)) throw new Error(`Preparation output was not produced: ${target}`);
      if (!refs.standardImage) throw new Error('参考后处理缺少 standard.png');
      // Raw generation is retained outside the final reference filenames for diagnosis.
      await normalizeGeneratedReference(temporary, refs.standardImage, refs.directory, stage, normalization);
    });
  }
  async function run(id: PreparationStage, step: ChainStep, refs: PreparationReferences) {
    switch (id) {
      case 'original':
        await mkdir(inputs, { recursive: true });
        if (!await exists(output(step))) await produce(output(step), temporary => copyFile(source!, temporary));
        return;
      case 'options': return writeJson(output(step), { standard });
      case 'pose': {
        const decision = await steps.judgeStandard(refs.originalImage!, await readPrompt('0-姿态判断.md'));
        checkStandardJudgment(decision);
        return writeJson(output(step), decision);
      }
      case 'standard': {
        let adjust = false;
        if (standard) {
          const decision = await readJson(poseJudgmentPath(directory));
          checkStandardJudgment(decision);
          adjust = decision.needsAdjustment;
          progress?.(`姿态判断：${adjust ? '需要调整' : '已经标准，复制原图'}${decision.reason ? `；${decision.reason}` : ''}`);
        }
        const original = refs.originalImage!;
        await produce(output(step), async temporary => {
          if (adjust) await steps.standardize(original, temporary, await readPrompt('0-标准姿态.md'));
          else await copyAsPng(original, temporary);
          if ((await sharp(temporary).metadata()).format !== 'png') throw new Error('标准姿态输出必须为 PNG');
        });
        if (!standard) progress?.('标准参考：未启用姿态调整，复制原图为 standard.png');
        return;
      }
      case 'judgment': {
        const decision = await steps.judge(refs.standardImage!, await readPrompt('1-参考判断.md'));
        checkJudgment(decision);
        await writeJson(output(step), decision);
        await reportJudgment(refs);
        return;
      }
      case 'simplified': {
        const decision = await readJson(refs.judgment);
        checkJudgment(decision);
        const image = refs.standardImage!, simplify = decision.needsSimplification;
        return normalized('simplified', output(step), refs, async temporary => {
          if (simplify) await steps.simplify(image, temporary, await readPrompt('2-简化图片.md'));
          else { await copyFile(image, temporary); progress?.('简化图片：无需转换，复制 standard.png'); }
        });
      }
      case 'base':
        return normalized('base', output(step), refs, async temporary =>
          steps.baseSubject(refs.simplifiedSubject, temporary, await readPrompt('3-素体参考.md')));
      case 'ready':
        await clearPreparedParts(dirname(directory));
        if (partsBuilt) progress?.('preparation：参考内容已重新生成，已重置本人物 part 的拆分缓存。');
    }
  }
}
