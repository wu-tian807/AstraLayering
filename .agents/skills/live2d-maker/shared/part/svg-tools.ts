import { toolDefinition } from '../codex/tool-config.ts';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import { svgSource, updateSvgRoot } from '../xml.ts';
import type { GroupSeed } from './layering-types.ts';
import { fromTaskPath, taskRootOf, toAgentPath, toTaskPathReal } from '../task-paths.ts';

export type Canvas = { width: number; height: number };
export type SvgObservation = { source: string; mode: 'svg' | 'blend' | 'edge'; savedPath: string; reference?: string; referenceHash?: string };
// review.json and tool results record observation paths task-relative.
// Task-relative for records; tool results pass toAgentPath to show absolute paths.
export async function taskObservation<T extends SvgObservation>(root: string, entry: T, at = toTaskPathReal): Promise<T> {
  return { ...entry, source: await at(root, entry.source), savedPath: await at(root, entry.savedPath),
    ...(entry.reference === undefined ? {} : { reference: await at(root, entry.reference) }) };
}
// Observation sources are realpaths; compare other paths through this so a symlinked task root still matches.
// A file not written yet resolves through its directory.
export async function observedPath(path: string): Promise<string> {
  const absolute = resolve(path);
  try { return await realpath(absolute); }
  catch { return join(await realpath(dirname(absolute)).catch(() => dirname(absolute)), basename(absolute)); }
}
export const parentBoundsSource = (group: GroupSeed, parent?: string): string | undefined => group.allowOutsideParent ? undefined : parent;
const boundsScale = 4;
const alphaThreshold = 128;

export function createSvgReadTool(directory: string): FunctionTool {
  return {
    ...toolDefinition('read_svg'),
    async execute(value, signal, context) {
      signal.throwIfAborted();
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['path', 'offset', 'limit'].includes(key)) ||
          typeof (value as { path?: unknown }).path !== 'string') throw new Error('提交 SVG 的 path、offset 和 limit');
      const args = value as { path: string; offset?: number; limit?: number };
      const offset = args.offset ?? 0, limit = args.limit ?? 16000;
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 65536) throw new Error('无效源码分页 offset 或 limit');
      const root = context?.root ?? taskRootOf(directory);
      const source = await realpath(fromTaskPath(root, args.path));
      const bytes = await readFile(source);
      const text = bytes.toString('utf8');
      if (offset > text.length) throw new Error('offset 超出 SVG 源码长度');
      const end = Math.min(offset + limit, text.length);
      signal.throwIfAborted();
      return textResult({ source: await toAgentPath(root, source), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        offset, totalCharacters: text.length, nextOffset: end < text.length ? end : null,
        complete: offset === 0 && end === text.length, svg: text.slice(offset, end) });
    },
  };
}

async function svgDocument(path: string, canvas: Canvas) {
  const bytes = await readFile(path);
  const text = bytes.toString('utf8');
  const parsed = svgSource(text), root = parsed.root;
  const viewBox = root.element.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!root || !viewBox || viewBox.length !== 4 ||
      viewBox.some((value, i) => value !== [0, 0, canvas.width, canvas.height][i])) {
    throw new Error(`SVG 必须沿用画布 viewBox="0 0 ${canvas.width} ${canvas.height}"：${path}`);
  }
  const metadata = await sharp(bytes, { limitInputPixels: 100_000_000 }).metadata();
  if (metadata.width !== canvas.width || metadata.height !== canvas.height) throw new Error(`SVG 画布尺寸不符：${path}`);
  return { bytes, text, root, elements: parsed.elements };
}

async function alpha(path: string, canvas: Canvas, scale = 1): Promise<Buffer> {
  const document = await svgDocument(path, canvas);
  const width = canvas.width * scale, height = canvas.height * scale;
  const bytes = scale === 1 ? document.bytes : Buffer.from(updateSvgRoot(document.text, { width: String(width), height: String(height) }));
  const { data, info } = await sharp(bytes, { limitInputPixels: 100_000_000 })
    .ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height) throw new Error(`范围检查渲染尺寸不符：${path}`);
  return data;
}

// 同一四倍网格上先比较覆盖差，再二值化，避免共用曲线的抗锯齿差异被独立阈值放大。
// 不扩张父范围、不按越界数量放行；任一个未覆盖采样达到阈值即失败。
export async function checkParentBounds(path: string, parent: string, canvas: Canvas) {
  const [childMask, parentMask] = await Promise.all([
    alpha(path, canvas, boundsScale), alpha(parent, canvas, boundsScale),
  ]);
  const width = canvas.width * boundsScale, height = canvas.height * boundsScale;
  let outsideSamples = 0, left = width, top = height, right = -1, bottom = -1;
  for (let i = 0; i < childMask.length; i++) {
    if (childMask[i] - parentMask[i] < alphaThreshold) continue;
    outsideSamples++;
    const x = i % width, y = Math.floor(i / width);
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return { status: outsideSamples ? 'fail' : 'pass', parent, scale: boundsScale, alphaThreshold,
    outsideSamples, outsidePixels: outsideSamples / (boundsScale * boundsScale),
    outsideBox: outsideSamples ? [left / boundsScale, top / boundsScale,
      (right - left + 1) / boundsScale, (bottom - top + 1) / boundsScale] : null };
}

export async function validateGroupSvg(path: string, id: string, canvas: Canvas, parent?: string, allowEmpty = false): Promise<Buffer> {
  const document = await svgDocument(path, canvas);
  if (document.elements.some(({ element }) => ['image', 'script', 'foreignObject'].includes(element.localName ?? ''))) throw new Error('组 SVG 必须是可编辑矢量，不嵌入位图或脚本');
  const bindings = document.elements.filter(({ element }) => element.hasAttribute('data-group-path'))
    .map(({ element }) => element.getAttribute('data-group-path'));
  if (!bindings.length || bindings.some(value => value !== id) ||
      !document.elements.some(({ element }) => element.localName === 'g' && element.hasAttribute('id') &&
        element.getAttribute('data-group-path') === id)) {
    throw new Error(`SVG 必须仅绑定当前组 data-group-path="${id}"，容器须有 id`);
  }
  const mask = await alpha(path, canvas);
  if (!allowEmpty && !mask.some(value => value >= 128)) throw new Error('组 SVG 没有可见填色区域');
  if (parent) {
    const bounds = await checkParentBounds(path, parent, canvas);
    if (bounds.status !== 'pass') throw new Error(`子组超出父轮廓：${JSON.stringify(bounds)}`);
  }
  return document.bytes;
}

export function createSvgPreviewTool(options: {
  directory: string; reference: string; canvas: Canvas; observationDirectory: string; parent?: string;
  allowGeneratedReference?: boolean;
  referenceAlignment?: 'content' | 'canvas';
  observed?: (observation: SvgObservation) => void;
}): FunctionTool {
  let count = 0;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fixedReference = options.referenceAlignment === 'canvas';
  const omitParameters = fixedReference ? ['referenceRegion', 'referenceOffset']
    : options.allowGeneratedReference ? [] : ['reference', 'referenceRegion', 'referenceOffset'];
  const definition = toolDefinition('preview_svg', undefined, omitParameters);
  if (fixedReference) (definition.inputSchema.properties as Record<string, { description: string }>).reference.description =
    '可选同画布参考 PNG/JPEG/WebP；保持像素坐标，不缩放或居中对齐。尺寸必须与 SVG 画布一致。';
  return {
    ...definition,
    omitParameters,
    async execute(value, signal, context) {
      signal.throwIfAborted();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SVG 预览参数须为对象');
      if (Object.keys(value).some(key => !(key in (definition.inputSchema.properties as object)))) throw new Error('仅使用本工具 schema 中列出的参数');
      const args = value as { path?: unknown; mode?: unknown; crop?: unknown; scale?: unknown; reference?: unknown; referenceRegion?: unknown; referenceOffset?: unknown };
      if (typeof args.path !== 'string' || !args.path.trim()) throw new Error('path 须为 SVG 路径');
      const root = context?.root ?? taskRootOf(options.directory);
      const source = await realpath(fromTaskPath(root, args.path));
      const mode = args.mode ?? 'svg', scale = args.scale ?? 1;
      if (typeof mode !== 'string' || !['svg', 'blend', 'edge'].includes(mode) || typeof scale !== 'number' || !Number.isFinite(scale) || scale < 1 || scale > 8) {
        throw new Error('无效 mode 或 scale');
      }
      if ((args.referenceRegion !== undefined || args.referenceOffset !== undefined) && args.reference === undefined) {
        throw new Error('referenceRegion 和 referenceOffset 须配合 reference 使用');
      }
      let referencePath = options.reference, referenceRegion: number[] | undefined, referenceBytes: Buffer | undefined;
      let alignment: { svgBounds: number[]; scale: number; offset: number[]; translation: number[] } | undefined;
      let defaultCrop = [0, 0, options.canvas.width, options.canvas.height];
      if (args.reference !== undefined) {
        if (typeof args.reference !== 'string' || !args.reference.trim() || mode === 'svg') throw new Error('reference 须为 blend/edge 对照的图片路径');
        referencePath = await realpath(fromTaskPath(root, args.reference));
        referenceBytes = await readFile(referencePath);
        const meta = await sharp(referenceBytes, { limitInputPixels: 100_000_000 }).metadata();
        if (!['png', 'jpeg', 'webp'].includes(meta.format ?? '')) throw new Error('对照图片须为 PNG、JPEG 或 WebP');
        if (fixedReference) {
          if (meta.autoOrient.width !== options.canvas.width || meta.autoOrient.height !== options.canvas.height) {
            throw new Error(`同坐标参考尺寸须为 ${options.canvas.width}×${options.canvas.height}，不能自动对齐`);
          }
        } else {
          referenceRegion = (args.referenceRegion ?? [0, 0, meta.autoOrient.width, meta.autoOrient.height]) as number[];
          if (!Array.isArray(referenceRegion) || referenceRegion.length !== 4 || referenceRegion.some(n => !Number.isSafeInteger(n) || n < 0) ||
            !referenceRegion[2] || !referenceRegion[3] || referenceRegion[0] + referenceRegion[2] > meta.autoOrient.width ||
            referenceRegion[1] + referenceRegion[3] > meta.autoOrient.height) throw new Error('referenceRegion 须为生成图内有效的 [x,y,width,height] 整数选框');
          const mask = await alpha(source, options.canvas);
          let x0 = options.canvas.width, y0 = options.canvas.height, x1 = -1, y1 = -1;
          for (let i = 0; i < mask.length; i++) {
            if (mask[i] < alphaThreshold) continue;
            const x = i % options.canvas.width, y = Math.floor(i / options.canvas.width);
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
          }
          if (x1 < x0) throw new Error('SVG 没有可见部件，须先绘制再与生成图对齐');
          const w = x1 - x0 + 1, h = y1 - y0 + 1;
          const offset = (args.referenceOffset ?? [0, 0]) as number[];
          if (!Array.isArray(offset) || offset.length !== 2 || offset.some(n => typeof n !== 'number' || !Number.isFinite(n)) ||
            Math.abs(offset[0]) > w * .1 || Math.abs(offset[1]) > h * .1) {
            throw new Error(`referenceOffset 使用原图像素，须在部件宽高的 10% 内：dx ±${w * .1}，dy ±${h * .1}`);
          }
          const fitScale = Math.min(w / referenceRegion[2], h / referenceRegion[3]);
          alignment = { svgBounds: [x0, y0, w, h], scale: fitScale, offset,
            translation: [x0 + (w - referenceRegion[2] * fitScale) / 2 + offset[0],
              y0 + (h - referenceRegion[3] * fitScale) / 2 + offset[1]] };
          // 生成图对照默认聚焦部件；显式 crop 只改变观察窗口，不参与对齐计算。
          const padX = Math.max(4, Math.ceil(w * .2)), padY = Math.max(4, Math.ceil(h * .2));
          const left = Math.max(0, x0 - padX), top = Math.max(0, y0 - padY);
          defaultCrop = [left, top, Math.min(options.canvas.width, x1 + 1 + padX) - left,
            Math.min(options.canvas.height, y1 + 1 + padY) - top];
        }
      }
      const crop = args.crop ?? defaultCrop;
      if (!Array.isArray(crop) || crop.length !== 4 || crop.some(n => !Number.isSafeInteger(n) || n < 0) || !crop[2] || !crop[3]) {
        throw new Error('crop 须为原图坐标的 [x,y,width,height] 整数查看窗口，宽高大于零');
      }
      const [left, top, width, height] = crop as number[];
      const outWidth = Math.round(width * scale), outHeight = Math.round(height * scale);
      if (left + width > options.canvas.width || top + height > options.canvas.height) throw new Error('crop 超出画布');
      if (outWidth * outHeight > 16_000_000) throw new Error('预览过大，请缩小选框或 scale');
      signal.throwIfAborted();
      const document = await svgDocument(source, options.canvas);
      // 修改临时渲染的视口，在裁剪区域内直接放大矢量，不修改输入文件。
      const vector = await sharp(Buffer.from(updateSvgRoot(document.text, {
        width: String(outWidth), height: String(outHeight), viewBox: crop.join(' '),
      }))).ensureAlpha().raw().toBuffer();
      let data: Buffer;
      if (mode === 'svg') {
        data = await sharp(vector, { raw: { width: outWidth, height: outHeight, channels: 4 } }).flatten({ background: 'white' }).png().toBuffer();
      } else {
        const overlay = Buffer.from(vector);
        for (let i = 0; i < overlay.length; i += 4) {
          if (mode === 'blend') { overlay[i + 3] = Math.round(overlay[i + 3] * 0.5); continue; }
          const pixel = i / 4, x = pixel % outWidth, y = Math.floor(pixel / outWidth);
          const edge = vector[i + 3] >= 128 && (x === 0 || x === outWidth - 1 || y === 0 || y === outHeight - 1 ||
            vector[i - 1] < 128 || vector[i + 7] < 128 || vector[i - outWidth * 4 + 3] < 128 || vector[i + outWidth * 4 + 3] < 128);
          overlay[i] = 235; overlay[i + 1] = 35; overlay[i + 2] = 55; overlay[i + 3] = edge ? 255 : 0;
        }
        let reference: Buffer;
        if (alignment && referenceRegion) {
          const [rx, ry, rw, rh] = referenceRegion;
          const region = await sharp(referenceBytes).autoOrient().extract({ left: rx, top: ry, width: rw, height: rh }).png().toBuffer();
          const [x, y] = alignment.translation;
          // 在临时预览内移动生成图；两个方向使用同一倍率，SVG 文件保持原样。
          reference = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="${crop.join(' ')}"><image x="${x}" y="${y}" width="${rw * alignment.scale}" height="${rh * alignment.scale}" href="data:image/png;base64,${region.toString('base64')}"/></svg>`))
            .flatten({ background: 'white' }).png().toBuffer();
        } else {
          reference = await sharp(referenceBytes ?? referencePath).autoOrient().extract({ left, top, width, height })
            .resize(outWidth, outHeight).png().toBuffer();
        }
        data = await sharp(reference).composite([{ input: overlay, raw: { width: outWidth, height: outHeight, channels: 4 } }])
          .flatten({ background: 'white' }).png().toBuffer();
      }
      if (data.length > 10 * 1024 * 1024) throw new Error('预览文件过大，请缩小选框或 scale');
      const bounds = options.parent && source !== await observedPath(options.parent)
        ? await checkParentBounds(source, options.parent, options.canvas) : undefined;
      signal.throwIfAborted();
      const destination = context ? join(context.workspace, 'previews') : options.observationDirectory;
      await mkdir(destination, { recursive: true });
      const savedPath = join(destination, `${stamp}-${++count}.png`);
      await writeFile(savedPath, data);
      const comparison = args.reference === undefined ? {} : { reference: referencePath,
        referenceHash: createHash('sha256').update(referenceBytes!).digest('hex') };
      const observation = { source, mode: mode as SvgObservation['mode'], savedPath, ...comparison };
      options.observed?.(observation);
      const shown = await taskObservation(root, observation, toAgentPath);
      const shownBounds = bounds && { ...bounds, parent: await toAgentPath(root, bounds.parent) };
      return { success: true, contentItems: [
        { type: 'inputText', text: JSON.stringify({ source: shown.source, mode, crop, scale, width: outWidth, height: outHeight, savedPath: shown.savedPath, bounds: shownBounds,
          ...(fixedReference ? { referenceAlignment: 'canvas' } : {}),
          ...(args.reference === undefined ? {} : { reference: shown.reference, referenceHash: shown.referenceHash, referenceRegion, alignment }) }) },
        { type: 'inputImage', imageUrl: `data:image/png;base64,${data.toString('base64')}` },
      ] };
    },
  };
}
