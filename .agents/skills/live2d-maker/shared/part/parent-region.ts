import { randomInt } from 'node:crypto';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { fromTaskPath, toAgentPath, taskRootOf } from '../task-paths.ts';
import { editXmlAttributes, svgBody, svgSource, updateSvgRoot, type XmlSourceElement } from '../xml.ts';
import type { ParentMask, ParentRegion } from './layering-types.ts';
import type { Canvas } from './svg-tools.ts';
import { writeAtomic } from './groups.ts';
import { clearCopyDecision, saveCopyDecision, type CopyGeometryDecision } from './parent-copy-decision.ts';

// A child whose boundary against its parent is clear takes its outline straight
// from the parent's completed SVG: an agent-drawn mask SVG on the same canvas
// whose closed shapes are the selected region. The parent's artwork is clipped
// to it (clipPath), so the cut may run through a connected shape along a line.
const shapes = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line']);
const containers = new Set(['svg', 'g', 'title', 'desc', 'defs', 'clipPath']);
const alphaThreshold = 128;
// Keep a path's subpaths together: they may describe holes or overlapping fills.
type Piece = { element: XmlSourceElement };

function pieces(text: string) {
  const parsed = svgSource(text), found: Piece[] = [];
  for (const entry of parsed.elements) {
    const name = entry.element.localName ?? '';
    if (!shapes.has(name) && !containers.has(name)) throw new Error(`父组完成稿含 <${name}>，不能按遮罩复制，请正常描边`);
    if (!shapes.has(name)) continue;
    let parent = entry.element.parentNode;
    while (parent && !['defs', 'clipPath'].includes(parent.nodeName.split(':').pop() ?? '')) parent = parent.parentNode;
    if (!parent) found.push({ element: entry }); // definitions are not painted artwork
  }
  return { parsed, found };
}

// Keeps the given pieces; every other shape is removed. Edits run from the end
// so earlier source ranges stay valid.
function keep(text: string, all: Piece[], kept: Set<number>): string {
  let out = text;
  for (let index = all.length - 1; index >= 0; index--) {
    const { element } = all[index];
    if (!kept.has(index)) out = out.slice(0, element.start) + out.slice(element.end);
  }
  return out;
}

async function mask(text: string, canvas: Canvas, scale = 1): Promise<Buffer> {
  const { data, info } = await sharp(Buffer.from(text), { limitInputPixels: 100_000_000, density: 72 * scale })
    .ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== canvas.width * scale || info.height !== canvas.height * scale) throw new Error('父组完成稿画布尺寸不符');
  return data;
}

export type ParentRegionCopy = CopyGeometryDecision & { svg: string; pieces: number[]; total: number };

// Inspect the rendered union, rather than path names: connected geometry can
// span several elements, and a single path can contain independent islands.
// Use every nonzero alpha sample at 2x resolution and eight-way connectivity.
// Only an exactly retained component is safe to bypass completion. A loss
// confined to antialiased edges or a tiny selected sliver remains uncertain.
async function completionDecision(parent: string, clipped: string, canvas: Canvas): Promise<CopyGeometryDecision> {
  if (canvas.width * canvas.height * 4 > 25_000_000) return { needsCompletion: true, reason: 'uncertain-geometry' };
  const [whole, selected] = await Promise.all([mask(parent, canvas, 2), mask(clipped, canvas, 2)]);
  const width = canvas.width * 2, height = canvas.height * 2;
  const visited = new Uint8Array(whole.length), queue = new Uint32Array(whole.length);
  let uncertain = false;
  for (let start = 0; start < whole.length; start++) {
    if (!whole[start] || visited[start]) continue;
    let head = 0, tail = 1, kept = false, keptSolid = false, lost = false, lostSolid = false;
    queue[0] = start; visited[start] = 1;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      if (selected[index]) kept = true;
      if (selected[index] >= alphaThreshold) keptSolid = true;
      if (selected[index] < whole[index]) lost = true;
      if (whole[index] >= alphaThreshold && selected[index] === 0) lostSolid = true;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          const next = ny * width + nx;
          if (whole[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
        }
      }
    }
    if (keptSolid && lostSolid) return { needsCompletion: true, reason: 'mask-cuts-parent' };
    if (kept && (lost || !keptSolid)) uncertain = true;
  }
  return uncertain ? { needsCompletion: true, reason: 'uncertain-geometry' }
    : { needsCompletion: false, reason: 'whole-independent-geometry' };
}

// ---- mask selection -------------------------------------------------------
const maskContainers = new Set(['svg', 'g', 'title', 'desc']);
const maskShapes = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon']);
const number = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const maskAttributes: Record<string, readonly string[]> = {
  path: ['d'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'], polygon: ['points'],
};
const attribute = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Reads an agent-drawn mask SVG into a canonical SVG holding only closed shapes
// (path, rect, circle, ellipse, polygon), geometry attributes and transforms.
export function checkParentMask(text: string, canvas: Canvas, label = 'maskSvg'): ParentMask {
  if (text.length > 500_000) throw new Error(`${label} 过大`);
  const parsed = svgSource(text), root = parsed.root.element;
  const size = (name: string) => (root.getAttribute(name) ?? '').replace(/px$/, '');
  if (Number(size('width')) !== canvas.width || Number(size('height')) !== canvas.height ||
      (root.hasAttribute('viewBox') && root.getAttribute('viewBox')!.trim().split(/[\s,]+/).join(' ') !== `0 0 ${canvas.width} ${canvas.height}`)) {
    throw new Error(`${label} 画布须为 ${canvas.width}×${canvas.height}，viewBox 为 0 0 ${canvas.width} ${canvas.height}`);
  }
  const shapes: string[] = [];
  for (const { element } of parsed.elements) {
    const name = element.localName ?? '';
    if (name === 'svg' || name === 'title' || name === 'desc') continue;
    if (name === 'g') {
      if (element.hasAttribute('transform')) throw new Error(`${label} 的 <g> 不能带 transform，请把变换写在形状上`);
      continue;
    }
    if (!maskShapes.has(name)) throw new Error(`${label} 只接受封闭形状 path、rect、circle、ellipse、polygon，不含 <${name}>`);
    const attributes: string[] = [];
    for (const key of maskAttributes[name]) {
      const value = element.getAttribute(key);
      if (value === null) continue;
      const ok = name === 'path' ? /^[MmLlHhVvCcSsQqTtAaZz\d\s.,+eE-]+$/.test(value)
        : name === 'polygon' ? /^[\d\s.,+eE-]+$/.test(value) : number.test(value);
      if (!ok) throw new Error(`${label} 的 <${name}> ${key} 取值无效`);
      attributes.push(` ${key}="${attribute(value)}"`);
    }
    if (name === 'path') {
      const d = element.getAttribute('d') ?? '';
      if (!/^\s*[Mm]/.test(d) || d.split(/(?=[Mm])/).some(part => part.trim() && !/[Zz]\s*$/.test(part))) throw new Error(`${label} 的 path 每个子路径须以 Z 闭合`);
    }
    const transform = element.getAttribute('transform');
    if (transform !== null) {
      if (!/^[a-zA-Z\d\s.,()+eE-]+$/.test(transform)) throw new Error(`${label} 的 transform 无效`);
      attributes.push(` transform="${attribute(transform)}"`);
    }
    const rule = element.getAttribute('fill-rule') ?? element.getAttribute('clip-rule');
    if (rule === 'evenodd') attributes.push(' fill-rule="evenodd" clip-rule="evenodd"');
    shapes.push(`<${name}${attributes.join('')}/>`);
  }
  if (!shapes.length) throw new Error(`${label} 没有封闭形状`);
  return { mask: `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">${shapes.join('')}</svg>` };
}

// Clips the whole body of an SVG to the mask. A wrapper group carries the clip, so
// every shape (including a parent's completion layer) is cut the same way.
function clipTo(svg: string, mask: ParentMask, clipId: string): string {
  const { root } = svgSource(svg);
  if (root.selfClosing) throw new Error('无效 SVG');
  const shapes = svgBody(mask.mask);
  return svg.slice(0, root.openEnd) + `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${shapes}</clipPath></defs><g clip-path="url(#${clipId})">`
    + svg.slice(root.openEnd, root.closeStart) + '</g>' + svg.slice(root.closeStart);
}

// A parent's completion layer marker must not travel into the child's outline; the
// child's own completion adds its own layer.
function withoutCompletionMarker(svg: string): string {
  for (const entry of [...svgSource(svg).elements].reverse()) {
    if (entry.element.hasAttribute('data-completion-additions')) svg = editXmlAttributes(svg, entry, { 'data-completion-additions': null });
  }
  return svg;
}

function rebind(svg: string, id: string): string {
  const name = id.split('/').pop()!.replaceAll('_', '-');
  for (const entry of [...svgSource(svg).elements].reverse()) {
    if (!entry.element.hasAttribute('data-group-path')) continue;
    const container = entry.element.localName === 'g' && entry.element.hasAttribute('id');
    svg = editXmlAttributes(svg, entry, { 'data-group-path': id, ...(container ? { id: `${name}-outline` } : {}) });
  }
  return svg;
}

const countAlpha = (alpha: Buffer) => { let n = 0; for (let i = 0; i < alpha.length; i++) if (alpha[i] >= alphaThreshold) n++; return n; };

async function copyParentMask(source: Buffer, id: string, region: ParentMask, canvas: Canvas): Promise<ParentRegionCopy> {
  const text = source.toString('utf8'), { found } = pieces(text);
  if (!found.length) throw new Error('父组完成稿没有可复制的形状');
  const baseId = id.replaceAll(/[^a-zA-Z0-9]+/g, '-') + '-region';
  const ids = new Set(svgSource(text).elements.map(({ element }) => element.getAttribute('id')));
  let clipId = baseId;
  for (let suffix = 2; ids.has(clipId); suffix++) clipId = `${baseId}-${suffix}`;
  region = checkParentMask(region.mask, canvas);
  const whole = countAlpha(await mask(text, canvas));
  const kept: number[] = [];
  for (let index = 0; index < found.length; index++) {
    if (countAlpha(await mask(clipTo(keep(text, found, new Set([index])), region, clipId), canvas))) kept.push(index);
  }
  if (!kept.length) throw new Error('遮罩内没有父组形状');
  const clipped = clipTo(keep(text, found, new Set(kept)), region, clipId);
  const remaining = countAlpha(await mask(clipped, canvas));
  if (remaining === whole) throw new Error('遮罩没有裁掉父组任何部分；子节点须是父组中的一部分');
  // The parent's own copy attributes (e.g. data-parent-region from its copy) must not carry over.
  const svg = rebind(withoutCompletionMarker(withoutCopyAttributes(clipped)), id);
  return { svg, pieces: kept, total: found.length,
    ...await completionDecision(text, clipped, canvas) };
}

export async function copyParentRegion(parentPath: string, id: string, region: ParentRegion, canvas: Canvas): Promise<ParentRegionCopy> {
  return copyParentMask(await readFile(parentPath), id, region, canvas);
}

// Renders the mask against the parent for the agent to check before cropping:
// the part the mask keeps is red, the rest of the parent blue, the mask's own
// border green, all over the reference.
export async function previewParentMask(parentPath: string, region: ParentRegion, canvas: Canvas, reference: string,
  view: { crop?: unknown; scale?: unknown } = {}): Promise<{ png: Buffer; crop: number[]; scale: number; kept: number; parent: number }> {
  const text = await readFile(parentPath, 'utf8');
  checkParentMask(region.mask, canvas);
  const whole = await mask(text, canvas);
  let crop = view.crop as number[] | undefined;
  if (crop === undefined) {
    let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
    for (let i = 0; i < whole.length; i++) {
      if (whole[i] < alphaThreshold) continue;
      const x = i % canvas.width, y = Math.floor(i / canvas.width);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) throw new Error('父组完成稿没有可预览的形状');
    const pad = 24, left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
    crop = [left, top, Math.min(canvas.width, x1 + 1 + pad) - left, Math.min(canvas.height, y1 + 1 + pad) - top];
  }
  if (!Array.isArray(crop) || crop.length !== 4 || crop.some(n => !Number.isSafeInteger(n) || n < 0) || !crop[2] || !crop[3] ||
      crop[0] + crop[2] > canvas.width || crop[1] + crop[3] > canvas.height) throw new Error('crop 须为画布内的 [x,y,width,height] 整数窗口');
  const [left, top, width, height] = crop;
  const scale = view.scale === undefined ? Math.min(4, Math.max(1, Math.floor(1100 / Math.max(width, height)))) : view.scale as number;
  if (!Number.isSafeInteger(scale) || scale < 1 || scale > 8) throw new Error('scale 须为 1–8 的整数');
  const outWidth = width * scale, outHeight = height * scale;
  if (outWidth * outHeight > 16_000_000) throw new Error('预览过大，请缩小 crop 或 scale');
  const render = async (svg: string) => (await sharp(Buffer.from(updateSvgRoot(svg, { width: String(outWidth), height: String(outHeight), viewBox: crop!.join(' ') })),
    { limitInputPixels: 100_000_000 }).ensureAlpha().raw().toBuffer());
  const { found } = pieces(text);
  const clipped = clipTo(text, region, 'preview-region');
  const parent = await render(text), kept = await render(clipped), shape = await render(region.mask);
  const overlay = Buffer.alloc(outWidth * outHeight * 4);
  const inside = (buffer: Buffer, x: number, y: number) => x >= 0 && y >= 0 && x < outWidth && y < outHeight && buffer[(y * outWidth + x) * 4 + 3] >= alphaThreshold;
  let keptCount = 0, parentCount = 0;
  for (let y = 0; y < outHeight; y++) for (let x = 0; x < outWidth; x++) {
    const i = (y * outWidth + x) * 4;
    const set = (r: number, g: number, b: number, a: number) => { overlay[i] = r; overlay[i + 1] = g; overlay[i + 2] = b; overlay[i + 3] = a; };
    if (inside(parent, x, y)) parentCount++;
    if (inside(kept, x, y)) { keptCount++; set(235, 35, 55, 150); } else if (inside(parent, x, y)) set(40, 110, 235, 110);
    if (inside(shape, x, y) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => inside(shape, x + dx, y + dy))) set(20, 200, 90, 255);
  }
  if (!found.length) throw new Error('父组完成稿没有可预览的形状');
  const base = await sharp(reference).autoOrient().extract({ left, top, width, height }).resize(outWidth, outHeight).png().toBuffer();
  const png = await sharp(base).composite([{ input: overlay, raw: { width: outWidth, height: outHeight, channels: 4 } }]).flatten({ background: 'white' }).png().toBuffer();
  return { png, crop, scale, kept: keptCount, parent: parentCount };
}

// Strip legacy control metadata from every element; it is never copy evidence.
export const copyAttributes = ['data-source-sha256', 'data-parent-mask', 'data-parent-region'] as const;
export function withoutCopyAttributes(svg: string): string {
  for (const entry of [...svgSource(svg).elements].reverse()) {
    if (copyAttributes.some(key => entry.element.hasAttribute(key))) {
      svg = editXmlAttributes(svg, entry, Object.fromEntries(copyAttributes.map(key => [key, null])));
    }
  }
  return svg;
}

// Gives every filled shape of a copy one random color, so the copied block reads as its own piece.
function recolor(svg: string): string {
  const color = '#' + randomInt(0x1000000).toString(16).padStart(6, '0');
  for (const entry of [...svgSource(svg).elements].reverse()) {
    const fill = entry.element.getAttribute('fill');
    if (fill !== null && fill !== 'none') svg = editXmlAttributes(svg, entry, { fill: color });
  }
  return svg;
}

// The outline tool: previews the mask against the parent's completion, or crops the
// parent's completion with it and writes the result as the group's outline draft.
export function createParentRegionTool(options: { directory: string; parentPath: string; reference: string; canvas: Canvas; groupId: string;
  draft: string; overrides?: string }): FunctionTool {
  return {
    ...toolDefinition('copy_parent_region', options.overrides),
    async execute(value, signal, context) {
      signal.throwIfAborted();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('参数须为对象');
      const { maskSvg, mode = 'preview', crop, scale, ...rest } = value as Record<string, unknown>;
      if (Object.keys(rest).length) throw new Error(`不支持的参数：${Object.keys(rest).join('、')}`);
      if (mode !== 'preview' && mode !== 'crop') throw new Error('mode 须为 preview 或 crop');
      if (typeof maskSvg !== 'string' || !maskSvg.trim()) throw new Error('maskSvg 须为遮罩 SVG 路径');
      if (mode === 'crop' && (crop !== undefined || scale !== undefined)) throw new Error('crop、scale 仅用于 preview');
      const root = context?.root ?? taskRootOf(options.directory);
      const region = checkParentMask(await readFile(await realpath(fromTaskPath(root, maskSvg)), 'utf8'), options.canvas);
      if (mode === 'preview') {
        const shown = await previewParentMask(options.parentPath, region, options.canvas, options.reference, { crop, scale });
        signal.throwIfAborted();
        return { success: true, contentItems: [
          { type: 'inputText', text: JSON.stringify({ mode, maskSvg, crop: shown.crop, scale: shown.scale, parentPixels: shown.parent, keptPixels: shown.kept,
            note: '红色是遮罩选中的父稿部分，蓝色是被排除的父稿部分，绿线是遮罩边界；确认分界后用 mode=crop 裁剪，否则修改遮罩 SVG 再预览。未写入草稿' }) },
          { type: 'inputImage', imageUrl: `data:image/png;base64,${shown.png.toString('base64')}` },
        ] };
      }
      const copy = await copyParentRegion(options.parentPath, options.groupId, region, options.canvas);
      signal.throwIfAborted();
      await mkdir(dirname(options.draft), { recursive: true });
      const svg = recolor(copy.svg);
      await clearCopyDecision(options.directory, options.groupId);
      await writeAtomic(options.draft, svg);
      const decision = await saveCopyDecision(options.directory, options.groupId, copy);
      return textResult({ mode, maskSvg, path: await toAgentPath(root, options.draft), parentShapes: copy.total,
        needsCompletion: decision.needsCompletion, reason: decision.reason,
        note: `复制结果已写入轮廓草稿；保持不改跳过轮廓 review。${decision.needsCompletion ? '工具检测到切穿连续形体或几何不确定，后续进行补全与检查' : '工具确认完整取出独立形体，后续直接发布，跳过补全与检查'}。请用 preview_svg 的 edge 模式核对范围` });
    },
  };
}
