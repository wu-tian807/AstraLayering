import { access } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { textResult, type FunctionTool } from '../../codex/function-tools.ts';
import { toolDefinition } from '../../codex/tool-config.ts';
import { artifactPath, readJson } from '../../part/artifact-facts.ts';
import { normalizeGroups, walkGroups, writeAtomic } from '../../part/groups.ts';
import { renderSvgAlpha, renderSvgCropAlpha, type Canvas } from '../../part/svg-tools.ts';
import type { PartLayeringInput } from '../../raster/input.ts';
import { imagePath } from '../../task-paths.ts';

const referenceEdge = 1024;
const targetOccupancy = 0.85;
const visibleColor = [255, 0, 0];
const completionColor = [255, 255, 0];
const outsideColor = Buffer.from([0, 255, 0]);
const neutralGray = 128;

function partCrop(mask: Buffer, { width, height }: Canvas, id: string) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) continue;
    const x = i % width, y = Math.floor(i / width);
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error(`${id} 的补全轮廓为空`);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function scaleToLongEdge({ width, height }: Canvas, longEdge: number): Canvas {
  const scale = longEdge / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function visibleOutline(directory: string, id: string) {
  const reduced = artifactPath(directory, id, 'reduction');
  try { await access(reduced); return reduced; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return artifactPath(directory, id, 'outline');
}

export function createPartReferenceTool(input: PartLayeringInput, sourceImage: string): FunctionTool {
  return {
    ...toolDefinition('prepare_part_reference'),
    async execute(value, signal) {
      signal.throwIfAborted();
      const args = value as { part_id?: unknown; output_dir?: unknown };
      if (!args || typeof args !== 'object' || Array.isArray(args) || typeof args.part_id !== 'string'
          || Object.keys(args).some(key => !['part_id', 'output_dir'].includes(key))
          || typeof args.output_dir !== 'string') {
        throw new Error('请提供完整部件 ID part_id 和绝对目录 output_dir');
      }
      const id = args.part_id;
      const output = imagePath(args.output_dir, 'output_dir');
      const groups = normalizeGroups((await readJson(join(input.directory, 'groups.json')))?.groups);
      const part = walkGroups(groups).find(({ group }) => group.id === id)?.group;
      if (!part || part.groups.length) throw new Error(`未知的终止部件：${id}`);

      const source = sharp(sourceImage);
      const { autoOrient: canvas } = await source.metadata();
      const completed = join(input.parts, `${id}.svg`);
      const crop = partCrop(await renderSvgAlpha(completed, canvas), canvas, id);
      const sample = scaleToLongEdge(crop, referenceEdge * targetOccupancy);
      const { width, height } = sample;
      const outline = part.hiddenInReference ? undefined : await visibleOutline(input.directory, id);
      const [full, visible, pixels] = await Promise.all([
        renderSvgCropAlpha(completed, canvas, crop, sample),
        outline && renderSvgCropAlpha(outline, canvas, crop, sample),
        outline && source.autoOrient().extract(crop).toColourspace('srgb').ensureAlpha()
          .resize(width, height, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer(),
      ]);
      signal.throwIfAborted();

      // Use the enlarged SVG bounds so a subpixel edge in a tiny part does not
      // count as a whole source pixel of content when laying out the 1K image.
      const bounds = partCrop(full, sample, id);
      const scaleX = crop.width / width, scaleY = crop.height / height;
      const onSource = { left: crop.left + bounds.left * scaleX, top: crop.top + bounds.top * scaleY,
        width: bounds.width * scaleX, height: bounds.height * scaleY };
      const referenceCanvas = scaleToLongEdge(onSource, referenceEdge);
      const placement = scaleToLongEdge(onSource, referenceEdge * targetOccupancy);
      const left = Math.floor((referenceCanvas.width - placement.width) / 2);
      const top = Math.floor((referenceCanvas.height - placement.height) / 2);
      const shape = Buffer.alloc(width * height * 3, outsideColor);
      const reference = Buffer.alloc(shape.length, neutralGray);
      for (let pos = 0; pos < full.length; pos++) {
        if (full[pos] === 0) continue;
        const target = pos * 3;
        const pixel = pos * 4;
        const alpha = pixels && visible && visible[pos] >= 128 ? pixels[pixel + 3] / 255 : 0;
        shape.set(alpha > 0 ? visibleColor : completionColor, target);
        if (alpha > 0 && pixels) {
          for (let c = 0; c < 3; c++) reference[target + c] = Math.round(pixels[pixel + c] * alpha + neutralGray * (1 - alpha));
        }
      }

      const raw = { width, height, channels: 3 as const };
      const border = { left, top, right: referenceCanvas.width - left - placement.width,
        bottom: referenceCanvas.height - top - placement.height };
      const frame = (pixels: Buffer, background: string) => sharp(pixels, { raw }).extract(bounds)
        .resize(placement.width, placement.height, { fit: 'fill', kernel: 'nearest' })
        .extend({ ...border, background }).png().toBuffer();
      const [referencePng, controlPng] = await Promise.all([
        frame(reference, '#808080'), frame(shape, '#00ff00'),
      ]);
      signal.throwIfAborted();
      const referencePath = join(output, 'reference.png'), controlPath = join(output, 'control.png');
      await Promise.all([writeAtomic(referencePath, referencePng), writeAtomic(controlPath, controlPng)]);
      return textResult({ part_id: id, referencePath, controlPath,
        canvas: [referenceCanvas.width, referenceCanvas.height],
        crop: [onSource.left, onSource.top, onSource.width, onSource.height],
        placement: [left, top, placement.width, placement.height] });
    },
  };
}
