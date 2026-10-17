import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { CodexAgents } from './agents.ts';

export type PreparationInput = { image?: string; runName: string };
export type PreparationReferences = {
  directory: string; originalImage?: string; judgment: string; simplifiedSubject: string; baseSubject: string;
};
export type PreparationSteps = { extract(image: string, output: string, prompt: string): Promise<void> };
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export function getPreparationDirectory(runName: string): string {
  if (!runName || runName === '.' || runName === '..' || /[\\/:]/.test(runName)) throw new Error('runName must be a single directory name');
  return join(fileURLToPath(new URL('.run/', import.meta.url)), runName, 'references');
}
async function exists(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function savedInput(directory: string): Promise<string | undefined> {
  let names: string[];
  try { names = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const matches = names.filter(name => /^simplified-character\.(png|jpe?g|webp)$/i.test(name));
  if (matches.length > 1) throw new Error('存在多份简化穿衣角色输入，请保留唯一输入。');
  return matches[0] ? join(directory, matches[0]) : undefined;
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
      name: '纯衣服参考准备', imageGeneration: true,
      images: [{ path: image, description: '图 1：简化后的穿衣角色原稿。保留衣服与穿着形态，去除人物和非衣装饰品。' }],
      prompt: `【绘制提示词】\n${prompt.trim()}\n\n【执行规则】\n将以上绘制提示词原样传给 Codex 内置 image_generation，传入图 1，要求透明背景 PNG。只调用一次，返回实际生成文件的 savedPath。工具不可用或调用失败时返回 error；不配置 provider、不调用其他生图工具或直接 API、不用脚本或原图替代生图。成功时 error 为 null；失败时 savedPath 为 null。`,
      outputSchema: { type: 'object', additionalProperties: false, required: ['savedPath', 'error'],
        properties: { savedPath: { type: ['string', 'null'] }, error: { type: ['string', 'null'] } } },
    });
    const imageResult = result.images.at(-1);
    if (!imageResult) throw new Error('内置 image_generation 未返回生成图片。');
    await checkImage(imageResult.savedPath, image);
    await copyFile(imageResult.savedPath, output);
  } };
}

// Explicit groups only read an already prepared input; never invoke a model or mutate it.
export async function loadPreparedReferences(runName: string): Promise<PreparationReferences> {
  const directory = getPreparationDirectory(runName), image = await savedInput(directory);
  if (!image) throw new Error('简化穿衣角色输入副本缺失，请先完成 preparation。');
  const refs = references(directory, image);
  if (!await exists(refs.judgment) || !await exists(refs.baseSubject)) throw new Error('纯衣服参考尚未完成，请先不带 --groups 运行 preparation。');
  const record = JSON.parse(await readFile(refs.judgment, 'utf8'));
  if (record.version !== 1 || record.inputHash !== hash(await readFile(image)) || record.clothingHash !== hash(await readFile(refs.baseSubject))) {
    throw new Error('preparation 参考已变化；请使用新的 --name，或删除 references/clothing.png 后重做 preparation 和拆分。');
  }
  await checkImage(refs.baseSubject, image);
  return refs;
}

export async function prepareReferences(input: PreparationInput, steps: PreparationSteps,
  progress?: (message: string) => void): Promise<PreparationReferences> {
  const directory = getPreparationDirectory(input.runName);
  let image = await savedInput(directory);
  if (!image) {
    if (!input.image) throw new Error('首次运行需要 --image <简化穿衣角色图片路径>。');
    const source = resolve(input.image), extension = extname(source).toLowerCase();
    if (!/\.(png|jpe?g|webp)$/.test(extension) || !await exists(source)) throw new Error('输入须为简化穿衣角色的 PNG、JPEG 或 WebP 图片。');
    await sharp(source).metadata();
    await mkdir(directory, { recursive: true });
    image = join(directory, `simplified-character${extension}`);
    const temporary = `${image}.${randomUUID()}.tmp`;
    try { await copyFile(source, temporary); await rename(temporary, image); }
    finally { await rm(temporary, { force: true }); }
  }
  const refs = references(directory, image);
  if (await exists(refs.baseSubject) && await exists(refs.judgment)) {
    const ready = await loadPreparedReferences(input.runName);
    progress?.('preparation：沿用已保存的纯衣服参考。');
    return ready;
  }
  // A regenerated clothing reference cannot reuse decomposition of the previous image.
  for (const entry of ['groups.json', 'parts', 'stages', 'observations', 'preview.svg', 'occlusion.json']) {
    await rm(join(dirname(directory), entry), { recursive: true, force: true });
  }
  const meta = await sharp(image).metadata();
  const prompt = (await readFile(new URL('prompts/preparation.md', import.meta.url), 'utf8'))
    .replaceAll('{width}', String(meta.autoOrient.width)).replaceAll('{height}', String(meta.autoOrient.height));
  await writeFile(join(directory, 'preparation-prompt.md'), prompt);
  progress?.('preparation：使用 Codex 内置 image_generation 生成纯衣服参考。');
  const temporary = `${refs.baseSubject}.${randomUUID()}.tmp`;
  try {
    await steps.extract(image, temporary, prompt);
    await checkImage(temporary, image);
    const record = { version: 1, inputHash: hash(await readFile(image)), clothingHash: hash(await readFile(temporary)),
      tool: 'image_generation', promptHash: hash(Buffer.from(prompt)) };
    await rename(temporary, refs.baseSubject);
    await writeFile(`${refs.judgment}.tmp`, JSON.stringify(record, null, 2) + '\n');
    await rename(`${refs.judgment}.tmp`, refs.judgment);
  } finally { await rm(temporary, { force: true }); }
  return refs;
}
