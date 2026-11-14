import { renderPromptFile } from '../prompts/render.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { ImageProcessingOptions } from '../image-processing.ts';
import { imageProvider, type ImageProvider, type ImageModel } from './models.ts';
import type { ImageArguments } from './images.ts';
import { recommendBackground, type BackgroundRecommendation } from './background-selection.ts';
import { counterpartBackground, recoverDualBackground } from './dual-background.ts';

export function needsSolidBackground(model: ImageModel, args: ImageArguments, provider?: ImageProvider): boolean {
  return (provider ?? imageProvider(model)) === 'google' && (args.background ?? 'transparent') === 'transparent';
}

// Keep the caller's task verbatim; only the provider's output-background contract changes.
export async function providerImageArguments(model: ImageModel, args: ImageArguments, selection?: BackgroundRecommendation, provider?: ImageProvider): Promise<ImageArguments> {
  if (!needsSolidBackground(model, args, provider)) return args;
  const background = selection ?? await recommendBackground([]);
  return { ...args, prompt: renderPromptFile(new URL('../prompts/image-request.md', import.meta.url), { drawing_prompt: args.prompt,
    background_instructions: renderPromptFile(new URL('../prompts/nano-solid-background.md', import.meta.url), { background_hex: background.hex }).trim() }).trimEnd(), background: 'opaque' };
}

export async function transparentGeneratedImage(png: Buffer, model: ImageModel, original: ImageArguments,
  request: ImageArguments, options: ImageProcessingOptions & { directory: string }, signal: AbortSignal,
  selection: BackgroundRecommendation, replaceBackground: (request: ImageArguments, input: Buffer) => Promise<Buffer>): Promise<Buffer> {
  const directory = options.directory;
  await mkdir(directory, { recursive: true });
  const source = join(directory, 'original.png'), output = join(directory, 'transparent.png');
  await writeFile(source, png, { mode: 0o600 });
  const record = { model, originalPrompt: original.prompt, providerPrompt: request.prompt,
    requestedBackground: original.background ?? 'transparent', generatedBackground: request.background, selection };
  try {
    signal.throwIfAborted();
    // A real alpha channel, if returned, is authoritative; never key it a second time.
    if (!(await sharp(png).stats()).isOpaque) {
      await writeFile(join(directory, 'normalization.json'), JSON.stringify({ ...record, nativeAlphaPreserved: true }, null, 2) + '\n', { mode: 0o600 });
      return png;
    }
    const { width, height } = await sharp(png).metadata();
    const backgroundHex = await counterpartBackground(png);
    const replacement: ImageArguments = { background: 'opaque', ...(original.quality ? { quality: original.quality } : {}),
      prompt: renderPromptFile(new URL('../prompts/nano-background-replacement.md', import.meta.url),
        { background_hex: backgroundHex, width: String(width), height: String(height) }).trimEnd() };
    await writeFile(join(directory, 'counterpart-request.json'), JSON.stringify(replacement, null, 2) + '\n', { mode: 0o600 });
    options.progress?.('Nano 透明后处理：以原始生图为参考，仅替换背景。');
    const counterpart = await replaceBackground(replacement, png);
    await writeFile(join(directory, 'counterpart.png'), counterpart, { mode: 0o600 });
    // A genuinely transparent edit can be observed on the requested solid colour.
    let observation = await sharp(counterpart).flatten({ background: backgroundHex }).png().toBuffer();
    const secondSize = await sharp(observation).metadata();
    let alignment: { from: number[]; to: number[]; fit: string } | undefined;
    if (width !== secondSize.width || height !== secondSize.height) {
      if (!width || !height || !secondSize.width || !secondSize.height
        || Math.abs((secondSize.width / secondSize.height) / (width / height) - 1) > 0.02) {
        throw new Error('第二次换背景的画布尺寸与比例明显不同，不能可靠差分。');
      }
      // Match only the observation canvas. Keep the first image/output dimensions
      // unchanged and never stretch either subject or infer alpha from one image.
      observation = await sharp(observation).resize(width, height, { fit: 'contain', background: backgroundHex }).png().toBuffer();
      alignment = { from: [secondSize.width, secondSize.height], to: [width, height], fit: 'contain' };
      await writeFile(join(directory, 'counterpart-aligned.png'), observation, { mode: 0o600 });
    }
    options.progress?.('Nano 透明后处理：双背景差分恢复前景颜色与透明度。');
    const recovered = await recoverDualBackground(png, observation, signal);
    if (!recovered.report.transparentPixels) throw new Error('双背景差分后没有实际透明区域。');
    await writeFile(output, recovered.png, { mode: 0o600 });
    await writeFile(output + '.alpha.png', recovered.alpha, { mode: 0o600 });
    await writeFile(join(directory, 'normalization.json'), JSON.stringify({ ...record,
      counterpartBackground: backgroundHex, counterpartAlignment: alignment,
      normalization: recovered.report }, null, 2) + '\n', { mode: 0o600 });
    return recovered.png;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(join(directory, 'error.json'), JSON.stringify({ ...record, error: message }, null, 2) + '\n', { mode: 0o600 });
    throw new Error(`Nano 透明背景处理失败：${message} 原始生图保留在 ${source}。`, { cause: error });
  }
}
