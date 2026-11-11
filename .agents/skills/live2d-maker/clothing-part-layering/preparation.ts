import { stepKnowledge } from '../shared/knowledge.ts';
import { normalizeGeneratedReference } from '../shared/part/reference-normalization.ts';
import type { ImageProcessingOptions } from '../shared/image-processing.ts';
import { asCheck, checkedTurn } from '../shared/codex/checked-turn.ts';
import { sectionDirectory, taskDirectory } from '../shared/paths.ts';
import { inspectSection, runSection } from '../shared/step-section.ts';
import { readStep } from '../shared/step-chain.ts';
import { clothingPreparationStep, partSteps, stepNumber } from '../shared/step-paths.js';
import { requireUpstream, simplifiedCharacter } from '../shared/upstream.ts';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { copyAsPng } from '../shared/png.ts';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import type { CodexAgents } from '../shared/codex/agents.ts';
import type { PreparationInput, PreparationReferences as ImageReferences } from '../shared/part/preparation-types.ts';

export type { PreparationInput };
export type PreparationReferences = ImageReferences;
export type PreparationSteps = { extract(image: string, baseImage: string, output: string, prompt: string): Promise<void> };

export function getPreparationDirectory(runName: string, root?: string): string {
  return join(sectionDirectory(runName, 'clothing-part-layering', root), 'references');
}
function references(directory: string, originalImage: string): PreparationReferences {
  return { directory, originalImage,
    simplifiedSubject: join(directory, 'clothing.png'), baseSubject: join(directory, 'clothing.png') };
}
async function characterBase(runName: string, root?: string): Promise<string> {
  const directory = await requireUpstream(runName, 'part-layering', [{ path: 'references/base-subject.png' }], root);
  return join(directory, 'references/base-subject.png');
}
async function checkImage(image: string, input: string): Promise<void> {
  const [output, source] = await Promise.all([sharp(image).metadata(), sharp(input).metadata()]);
  if (output.format !== 'png' || output.width !== source.autoOrient.width || output.height !== source.autoOrient.height
    || !output.hasAlpha || (await sharp(image).stats()).isOpaque) {
    throw new Error('纯衣服生图须为原画布尺寸、含实际透明区域的 PNG；没有用原图替代生成结果。');
  }
}

export function createPreparationSteps(agents: Pick<CodexAgents, 'run'>): PreparationSteps {
  return { async extract(image, baseImage, output, prompt) {
    const imagePath = await checkedTurn({ agents, task: {
      step: 'clothing_preparation', name: '纯衣服参考准备',
      prompt,
      outputSchema: { type: 'object', additionalProperties: false, required: ['error'], properties: { error: { type: ['string', 'null'] } } },
    }, check: result => asCheck('invalid-output', async () => {
      const imageResult = result.images.at(-1);
      if (!imageResult) throw new Error('imagegen 未返回生成图片。');
      await sharp(imageResult.savedPath).metadata();
      return imageResult.savedPath;
    }) });
    await copyAsPng(imagePath, output);
  } };
}

// The section's one preparation step, built on the person part references it
// reads, which must be completed first.
const sectionOf = (references: string) => dirname(references);
const personSteps = [partSteps.standard, partSteps.simplified, partSteps.base];
const step = { number: stepNumber(clothingPreparationStep)!, note: 'preparation' };
async function requireUpstreamSteps(runName: string, root?: string): Promise<void> {
  const person = sectionDirectory(runName, 'part-layering', root);
  for (const id of personSteps) {
    const directory = join(person, id);
    if ((await readStep(directory)).status !== 'completed') {
      throw new Error(`上游步骤 part-layering/${id} 尚未完成（${directory}），请先执行同名 part-layering。`);
    }
  }
}

async function requireDelivery(refs: PreparationReferences): Promise<void> {
  if (!await lstat(refs.baseSubject).then(info => info.isFile(), () => false)) {
    throw new Error(`${clothingPreparationStep} 已标记完成但交付缺失：${refs.baseSubject}；请恢复文件，或重试该步骤（网页「重试」或 --retry）。`);
  }
}

// Explicit groups only read an already prepared input; never invoke a model or mutate it.
export async function loadPreparedReferences(runName: string, root?: string): Promise<PreparationReferences> {
  const directory = getPreparationDirectory(runName, root), image = await simplifiedCharacter(runName, root);
  const refs = references(directory, image);
  await requireUpstreamSteps(runName, root);
  const plan = await inspectSection(sectionOf(directory), [step]);
  if (plan.statuses.get(clothingPreparationStep) !== 'completed') {
    throw new Error('纯衣服参考尚未完成，请先不带 --groups 运行 preparation。');
  }
  await requireDelivery(refs);
  await checkImage(refs.baseSubject, join(sectionDirectory(runName, 'part-layering', root), 'references/standard.png'));
  return refs;
}

export async function prepareReferences(input: PreparationInput, steps: PreparationSteps,
  progress?: (message: string) => void, options: ImageProcessingOptions = {}): Promise<PreparationReferences> {
  const normalization = { ...options, runsRoot: input.dir ?? options.runsRoot, progress: progress ?? options.progress };
  const directory = getPreparationDirectory(input.runName, input.dir);
  if (input.image !== undefined) throw new Error('clothing-part-layering 按 --name 读取上游简化角色，不接受 --image；请将图片放到同名 part-layering/references/simplified-subject.png。');
  if (input.standard !== undefined) throw new Error('--standard / --no-standard 只适用于人物 part 的 preparation；衣服按 --name 读取上游简化角色。');
  const image = await simplifiedCharacter(input.runName, input.dir);
  await mkdir(directory, { recursive: true });
  const refs = references(directory, image);
  const standard = join(sectionDirectory(input.runName, 'part-layering', input.dir), 'references/standard.png');
  await requireUpstreamSteps(input.runName, input.dir);
  await runSection({
    directory: sectionOf(directory), steps: [step], progress,
    keep: () => requireDelivery(refs),
    async step(_step, status) {
      if (status === 'completed') { progress?.('preparation：沿用已保存的纯衣服参考。'); return; }
      return async () => {
        const baseImage = await characterBase(input.runName, input.dir);
        const meta = await sharp(standard).metadata();
        const prompt = stepKnowledge('clothing-part-layering', 'step01_preparation')
          .render('main', { width: String(meta.autoOrient.width), height: String(meta.autoOrient.height) }, { taskRoot: taskDirectory(input.runName, input.dir) });
        progress?.('preparation：使用已配置生图工具生成纯衣服参考。');
        const temporary = `${refs.baseSubject}.${randomUUID()}.tmp`;
        try {
          await steps.extract(image, baseImage, temporary, prompt);
          await normalizeGeneratedReference(temporary, standard, join(sectionOf(directory), clothingPreparationStep), 'clothing', normalization);
          await checkImage(temporary, standard);
          await rename(temporary, refs.baseSubject);
        } finally { await rm(temporary, { force: true }); }
      };
    },
  });
  await checkImage(refs.baseSubject, standard);
  return refs;
}
