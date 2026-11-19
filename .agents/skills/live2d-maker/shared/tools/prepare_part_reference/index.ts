import { access } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { textResult, type FunctionTool } from '../../codex/function-tools.ts';
import { toolDefinition } from '../../codex/tool-config.ts';
import { artifactPath, readJson } from '../../part/artifact-facts.ts';
import { normalizeGroups, walkGroups, writeAtomic } from '../../part/groups.ts';
import { renderSvgAlpha, type Canvas } from '../../part/svg-tools.ts';
import type { PartLayeringInput } from '../../raster/input.ts';
import { imagePath } from '../../task-paths.ts';

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
  const partWidth = right - left + 1, partHeight = bottom - top + 1;
  const padX = Math.round(partWidth * (1 / targetOccupancy - 1) / 2);
  const padY = Math.round(partHeight * (1 / targetOccupancy - 1) / 2);
  return { left: left - padX, top: top - padY, width: partWidth + 2 * padX, height: partHeight + 2 * padY };
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
      const full = await renderSvgAlpha(join(input.parts, `${id}.svg`), canvas);
      const crop = partCrop(full, canvas, id);
      const visible = part.hiddenInReference ? undefined
        : await renderSvgAlpha(await visibleOutline(input.directory, id), canvas);
      const left = Math.max(0, crop.left), top = Math.max(0, crop.top);
      const right = Math.min(canvas.width, crop.left + crop.width);
      const bottom = Math.min(canvas.height, crop.top + crop.height);
      const sourceWidth = right - left;
      const pixels = visible ? await source.autoOrient().extract({ left, top, width: sourceWidth, height: bottom - top })
        .toColourspace('srgb').ensureAlpha().raw().toBuffer() : undefined;
      signal.throwIfAborted();

      const shape = Buffer.alloc(crop.width * crop.height * 3, outsideColor);
      const reference = Buffer.alloc(shape.length, neutralGray);
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const pos = y * canvas.width + x;
          if (full[pos] === 0) continue;
          const target = ((y - crop.top) * crop.width + x - crop.left) * 3;
          const pixel = ((y - top) * sourceWidth + x - left) * 4;
          const alpha = pixels && visible && visible[pos] >= 128 ? pixels[pixel + 3] / 255 : 0;
          shape.set(alpha > 0 ? visibleColor : completionColor, target);
          if (alpha > 0 && pixels) {
            for (let c = 0; c < 3; c++) reference[target + c] = Math.round(pixels[pixel + c] * alpha + neutralGray * (1 - alpha));
          }
        }
      }

      const raw = { width: crop.width, height: crop.height, channels: 3 as const };
      const [referencePng, controlPng] = await Promise.all([
        sharp(reference, { raw }).png().toBuffer(), sharp(shape, { raw }).png().toBuffer(),
      ]);
      signal.throwIfAborted();
      const referencePath = join(output, 'reference.png'), controlPath = join(output, 'control.png');
      await Promise.all([writeAtomic(referencePath, referencePng), writeAtomic(controlPath, controlPng)]);
      return textResult({ part_id: id, referencePath, controlPath, crop: [crop.left, crop.top, crop.width, crop.height] });
    },
  };
}
