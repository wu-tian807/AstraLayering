import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import type { FunctionTool } from './function-tools.ts';

export function createBitmapTool(directory: string, observationDirectory: string, references: string[] = []): FunctionTool {
  const normalize = (path: string) => process.platform === 'win32' ? path.toLowerCase() : path;
  // Callers bind already-resolved reference files, never an entire outside folder.
  const allowedReferences = new Set(references.map(path => normalize(resolve(directory, path))));
  return {
    name: 'view_bitmap',
    description: '查看运行目录内的位图或本次明确配置的参考图片，并直接返回图片。可选 crop=[x,y,width,height]，使用 EXIF 正向后的原图像素坐标，宽高须大于零；scale 默认 1，可取 1 至 8，先裁剪再缩放。预览会保存，原图不变。按需要选择全图或局部。',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['path'],
      properties: {
        path: { type: 'string' },
        crop: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'integer', minimum: 0 } },
        scale: { type: 'number', minimum: 1, maximum: 8 },
      },
    },
    async execute(value, signal) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('位图参数须为对象');
      const args = value as { path?: unknown; crop?: unknown; scale?: unknown };
      if (typeof args.path !== 'string' || !args.path.trim()) throw new Error('path 须为图片路径');
      const scale = args.scale ?? 1;
      if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 1 || scale > 8) throw new Error('scale 须为 1 至 8');
      const root = await realpath(directory);
      const source = await realpath(resolve(root, args.path));
      const rel = relative(root, source);
      const outside = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
      if (outside && !allowedReferences.has(normalize(source))) throw new Error('图片必须位于本次运行目录内或属于本次明确配置的参考');
      const meta = await sharp(source, { limitInputPixels: 100_000_000 }).metadata();
      const width = meta.autoOrient.width, height = meta.autoOrient.height;
      const crop = args.crop ?? [0, 0, width, height];
      if (!Array.isArray(crop) || crop.length !== 4 || crop.some(v => !Number.isSafeInteger(v) || v < 0) || !crop[2] || !crop[3]) {
        throw new Error('crop 须为 [x,y,width,height] 整数选框，宽高大于零');
      }
      const [left, top, cropWidth, cropHeight] = crop as number[];
      if (left + cropWidth > width || top + cropHeight > height) throw new Error('裁剪选框超出原图范围');
      const outputWidth = Math.round(cropWidth * scale), outputHeight = Math.round(cropHeight * scale);
      if (outputWidth * outputHeight > 16_000_000) throw new Error('预览过大，请缩小选框或 scale');
      signal.throwIfAborted();
      const normalized = await sharp(source, { limitInputPixels: 100_000_000 }).autoOrient().png().toBuffer();
      const data = await sharp(normalized).extract({ left, top, width: cropWidth, height: cropHeight })
        .resize(outputWidth, outputHeight, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
      if (data.length > 10 * 1024 * 1024) throw new Error('预览文件过大，请缩小选框或 scale');
      signal.throwIfAborted();
      await mkdir(observationDirectory, { recursive: true });
      const savedPath = join(observationDirectory, `${randomUUID()}.png`);
      await writeFile(savedPath, data);
      return { success: true, contentItems: [
        { type: 'inputText', text: JSON.stringify({ path: outside ? source : rel, source: { width, height }, crop, scale,
          width: outputWidth, height: outputHeight, savedPath }) },
        { type: 'inputImage', imageUrl: `data:image/png;base64,${data.toString('base64')}` },
      ] };
    },
  };
}
