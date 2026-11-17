import { toolDefinition } from '../codex/tool-config.ts';
import { mkdir, realpath, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import type { FunctionTool } from '../codex/function-tools.ts';
import { fromTaskPath, taskRootOf, toAgentPath } from '../task-paths.ts';

export function createBitmapTool(directory: string, observationDirectory: string): FunctionTool {
  return {
    ...toolDefinition('view_bitmap'),
    async execute(value, signal, context) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('位图参数须为对象');
      const args = value as { path?: unknown; crop?: unknown; scale?: unknown };
      if (typeof args.path !== 'string' || !args.path.trim()) throw new Error('path 须为图片路径');
      const scale = args.scale ?? 1;
      if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 1 || scale > 8) throw new Error('scale 须为 1 至 8');
      const root = context?.root ?? taskRootOf(directory);
      const source = await realpath(fromTaskPath(root, args.path));
      const bytes = await readFile(source);
      const meta = await sharp(bytes, { limitInputPixels: 100_000_000 }).metadata();
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
      const normalized = await sharp(bytes, { limitInputPixels: 100_000_000 }).autoOrient().png().toBuffer();
      const data = await sharp(normalized).extract({ left, top, width: cropWidth, height: cropHeight })
        .resize(outputWidth, outputHeight, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
      if (data.length > 10 * 1024 * 1024) throw new Error('预览文件过大，请缩小选框或 scale');
      signal.throwIfAborted();
      const destination = context ? join(context.workspace, 'bitmaps') : observationDirectory;
      await mkdir(destination, { recursive: true });
      const savedPath = join(destination, `${randomUUID()}.png`);
      await writeFile(savedPath, data);
      return { success: true, contentItems: [
        { type: 'inputText', text: JSON.stringify({ path: await toAgentPath(root, source), source: { width, height }, crop, scale,
          width: outputWidth, height: outputHeight, savedPath: await toAgentPath(root, savedPath) }) },
        { type: 'inputImage', imageUrl: `data:image/png;base64,${data.toString('base64')}` },
      ] };
    },
  };
}
