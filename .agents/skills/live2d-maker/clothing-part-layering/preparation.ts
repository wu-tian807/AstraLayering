import { normalizeGeneratedReference } from '../shared/part/reference-normalization.ts';
import type { ImageProcessingOptions } from '../shared/image-processing.ts';
import { validateAgentOutcome } from '../shared/codex/diagnostics.ts';
import { pipelineDirectory, resolveInput } from '../shared/paths.ts';
import { simplifiedCharacter } from '../shared/upstream.ts';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import type { CodexAgents } from '../shared/codex/agents.ts';
import { clearPreparedParts, preparationHash as hash } from '../shared/part/preparation-cache.ts';
import type { PreparationInput, PreparationReferences } from '../shared/part/preparation-types.ts';

export type { PreparationInput, PreparationReferences };
export type PreparationSteps = { extract(image: string, output: string, prompt: string): Promise<void> };

export function getPreparationDirectory(runName: string, root?: string): string {
  return join(pipelineDirectory(runName, 'clothing-part-layering', root), 'references');
}
async function exists(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
function references(directory: string, originalImage: string): PreparationReferences {
  return { directory, originalImage, judgment: join(directory, 'preparation.json'),
    simplifiedSubject: join(directory, 'clothing.png'), baseSubject: join(directory, 'clothing.png') };
}
async function checkImage(image: string, input: string): Promise<void> {
  const [output, source] = await Promise.all([sharp(image).metadata(), sharp(input).metadata()]);
  if (output.format !== 'png' || output.width !== source.autoOrient.width || output.height !== source.autoOrient.height
    || !output.hasAlpha || (await sharp(image).stats()).isOpaque) {
    throw new Error('纯衣服生图须为原画布尺寸、含实际透明区域的 PNG；没有用原图替代生成结果。');
  }
}

export function createPreparationSteps(agents: Pick<CodexAgents, 'run'>): PreparationSteps {
  return { async extract(image, output, prompt) {
    const result = await agents.run({
      step: 'clothing_preparation', name: '纯衣服参考准备', imageGeneration: true,
      images: [{ path: image, description: '图 1：简化后的穿衣角色原稿。保留衣服与穿着形态，去除人物和非衣装饰品。' }],
      prompt: `【绘制提示词】\n${prompt.trim()}\n\n【执行规则】\n将以上绘制提示词原样传给本步骤配置的生图工具（image_generation 是生图工具的概念总称，不要求工具字面同名；按当前配置使用实际生图工具，例如 Codex 内置 image_gen.imagegen。仅允许调用生图工具，禁止调用任何生图以外的工具；不得调用工具搜索、shell、文件操作、浏览器或其他辅助工具。不得切换到未配置的生图服务或直接 API），不增补绘制要求。传入图 1，要求透明背景 PNG。只调用一次；完成后直接返回实际生成文件的 savedPath，不检查、不返修、不重试。工具不可用或调用失败时返回 error；不配置 provider、不调用未配置的生图工具或直接 API、不用脚本或原图替代生图。成功时 error 为 null；失败时 savedPath 为 null。`,
      outputSchema: { type: 'object', additionalProperties: false, required: ['savedPath', 'error'],
        properties: { savedPath: { type: ['string', 'null'] }, error: { type: ['string', 'null'] } } },
    });
    await validateAgentOutcome(result, async () => {
    const imageResult = result.images.at(-1);
    if (!imageResult) throw new Error('内置 image_generation 未返回生成图片。');
    await sharp(imageResult.savedPath).metadata();
    await copyFile(imageResult.savedPath, output);
    });
  } };
}

// Explicit groups only read an already prepared input; never invoke a model or mutate it.
export async function loadPreparedReferences(runName: string, root?: string): Promise<PreparationReferences> {
  const directory = getPreparationDirectory(runName, root), image = await simplifiedCharacter(runName, root);
  const refs = references(directory, image);
  if (!await exists(refs.judgment) || !await exists(refs.baseSubject)) throw new Error('纯衣服参考尚未完成，请先不带 --groups 运行 preparation。');
  const record = JSON.parse(await readFile(refs.judgment, 'utf8'));
  if (record.version !== 1 || record.inputHash !== hash(await readFile(image)) || record.clothingHash !== hash(await readFile(refs.baseSubject))) {
    throw new Error('preparation 参考已变化；请使用新的 --name，或删除 references/clothing.png 后重做 preparation 和拆分。');
  }
  const standard = join(pipelineDirectory(runName, 'part-layering', root), 'references/standard.png');
  if (record.standardHash && record.standardHash !== hash(await readFile(standard))) throw new Error('standard 参考已变化，请重做衣服 preparation。');
  await checkImage(refs.baseSubject, record.standardHash ? standard : image);
  return refs;
}

export async function prepareReferences(input: PreparationInput, steps: PreparationSteps,
  progress?: (message: string) => void, options: ImageProcessingOptions = {}): Promise<PreparationReferences> {
  const normalization = { ...options, runsRoot: input.dir ?? options.runsRoot, progress: progress ?? options.progress, krita: options.krita ?? (input.krita && resolveInput(input.runName, input.krita, input.dir)) };
  const directory = getPreparationDirectory(input.runName, input.dir);
  if (input.image !== undefined) throw new Error('clothing-part-layering 按 --name 读取上游简化角色，不接受 --image；请将图片放到同名 part-layering/references/simplified-subject.png。');
  if (input.standard !== undefined) throw new Error('--standard / --no-standard 只适用于人物 part 的 preparation；衣服按 --name 读取上游简化角色。');
  const image = await simplifiedCharacter(input.runName, input.dir);
  await mkdir(directory, { recursive: true });
  const refs = references(directory, image);
  if (await exists(refs.baseSubject) && await exists(refs.judgment)) {
    const ready = await loadPreparedReferences(input.runName, input.dir);
    progress?.('preparation：沿用已保存的纯衣服参考。');
    return ready;
  }
  // A regenerated clothing reference cannot reuse decomposition of the previous image.
  const standard = join(pipelineDirectory(input.runName, 'part-layering', input.dir), 'references/standard.png');
  if (!await exists(standard)) throw new Error(`纯衣服参考后处理缺少上游：${standard}。请先执行同名 part-layering，或手动放置上游 standard.png 到该路径。`);
  const standardHash = hash(await readFile(standard));
  const meta = await sharp(standard).metadata();
  const prompt = (await readFile(new URL('prompts/preparation.md', import.meta.url), 'utf8'))
    .replaceAll('{width}', String(meta.autoOrient.width)).replaceAll('{height}', String(meta.autoOrient.height));
  await writeFile(join(directory, 'preparation-prompt.md'), prompt);
  progress?.('preparation：使用已配置生图工具生成纯衣服参考。');
  const temporary = `${refs.baseSubject}.${randomUUID()}.tmp`;
  try {
    await steps.extract(image, temporary, prompt);
    await normalizeGeneratedReference(temporary, standard, directory, 'clothing', normalization);
    await checkImage(temporary, standard);
    const record = { version: 1, inputHash: hash(await readFile(image)), clothingHash: hash(await readFile(temporary)),
      standardHash, tool: 'image_generation', promptHash: hash(Buffer.from(prompt)) };
    await clearPreparedParts(dirname(directory));
    await rename(temporary, refs.baseSubject);
    await writeFile(`${refs.judgment}.tmp`, JSON.stringify(record, null, 2) + '\n');
    await rename(`${refs.judgment}.tmp`, refs.judgment);
  } finally { await rm(temporary, { force: true }); }
  return refs;
}
