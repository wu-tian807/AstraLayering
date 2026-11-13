import { createHash, randomInt } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { fromTaskPath, toAgentPath, taskRootOf } from '../task-paths.ts';
import { editXmlAttributes, svgBody, svgSource, updateSvgRoot, type XmlSourceElement } from '../xml.ts';
import type { ParentBox, ParentMask, ParentRegion } from './layering-types.ts';
import type { Canvas } from './svg-tools.ts';

// A child whose boundary against its parent is clear takes its outline straight
// from the parent's completed SVG, in one of two ways:
//  - box: the shapes wholly inside a box whose border runs through empty canvas;
//    the box may not cut a shape or a connection.
//  - mask: an agent-drawn SVG on the same canvas; its closed shapes are the
//    selected region and the parent's artwork is clipped to it (clipPath), so the
//    cut may run through a connected shape along a dividing line.
const shapes = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line']);
const unsupported = new Set(['defs', 'use', 'mask', 'clipPath', 'pattern', 'symbol', 'image', 'text', 'foreignObject', 'script']);
const alphaThreshold = 128;
// A piece is one element, or one absolute-M subpath of a path.
type Piece = { element: XmlSourceElement; d?: string };

export function checkParentRegion(value: unknown, canvas: Canvas, label = 'region'): ParentBox {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 须为 {x,y,width,height} 对象`);
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !['x', 'y', 'width', 'height'].includes(key)) ||
      [raw.x, raw.y].some(v => !Number.isSafeInteger(v) || (v as number) < 0) ||
      [raw.width, raw.height].some(v => !Number.isSafeInteger(v) || (v as number) < 1)) {
    throw new Error(`${label} 须为整数 x、y ≥ 0 与 width、height ≥ 1`);
  }
  const region = { x: raw.x, y: raw.y, width: raw.width, height: raw.height } as ParentBox;
  if (region.x + region.width > canvas.width || region.y + region.height > canvas.height) throw new Error(`${label} 超出画布`);
  return region;
}

function pieces(text: string) {
  const parsed = svgSource(text), found: Piece[] = [];
  for (const entry of parsed.elements) {
    const name = entry.element.localName ?? '';
    if (unsupported.has(name)) throw new Error(`父组完成稿含 <${name}>，不能按选框复制，请正常描边`);
    if (!shapes.has(name)) continue;
    const d = name === 'path' ? entry.element.getAttribute('d') ?? '' : undefined;
    const parts = d === undefined ? [] : d.split(/(?=M)/).map(part => part.trim()).filter(Boolean);
    if (parts.length > 1) for (const part of parts) found.push({ element: entry, d: part });
    else found.push({ element: entry });
  }
  return { parsed, found };
}

// Keeps the given pieces; every other shape is removed. Edits run from the end
// so earlier source ranges stay valid.
function keep(text: string, all: Piece[], kept: Set<number>): string {
  const byElement = new Map<XmlSourceElement, number[]>();
  all.forEach((piece, index) => byElement.set(piece.element, [...byElement.get(piece.element) ?? [], index]));
  let out = text;
  for (const [element, indices] of [...byElement].sort((a, b) => b[0].start - a[0].start)) {
    const chosen = indices.filter(index => kept.has(index));
    if (!chosen.length) out = out.slice(0, element.start) + out.slice(element.end);
    else if (chosen.length < indices.length) out = editXmlAttributes(out, element, { d: chosen.map(index => all[index].d).join(' ') });
  }
  return out;
}

async function mask(text: string, canvas: Canvas): Promise<Buffer> {
  const { data, info } = await sharp(Buffer.from(text), { limitInputPixels: 100_000_000 })
    .ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== canvas.width || info.height !== canvas.height) throw new Error('父组完成稿画布尺寸不符');
  return data;
}

export type ParentRegionCopy = { svg: string; pieces: number[]; total: number };

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
    if (rule === 'evenodd') attributes.push(' clip-rule="evenodd"');
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
  const clipId = id.replaceAll(/[^a-zA-Z0-9]+/g, '-') + '-region';
  checkParentMask(region.mask, canvas);
  const whole = countAlpha(await mask(text, canvas));
  const kept: number[] = [];
  for (let index = 0; index < found.length; index++) {
    if (countAlpha(await mask(clipTo(keep(text, found, new Set([index])), region, clipId), canvas))) kept.push(index);
  }
  if (!kept.length) throw new Error('遮罩内没有父组形状');
  const clipped = clipTo(keep(text, found, new Set(kept)), region, clipId);
  const remaining = countAlpha(await mask(clipped, canvas));
  if (remaining === whole) throw new Error('遮罩没有裁掉父组任何部分；子节点须是父组中的一部分');
  let svg = rebind(withoutCompletionMarker(clipped), id);
  svg = updateSvgRoot(svg, { 'data-source-sha256': createHash('sha256').update(source).digest('hex'),
    'data-parent-mask': createHash('sha256').update(region.mask).digest('hex').slice(0, 16) });
  return { svg, pieces: [], total: found.length };
}

export async function copyParentRegion(parentPath: string, id: string, region: ParentRegion, canvas: Canvas): Promise<ParentRegionCopy> {
  const source = await readFile(parentPath);
  if ('mask' in region) return copyParentMask(source, id, region, canvas);
  const text = source.toString('utf8');
  const { found } = pieces(text);
  if (!found.length) throw new Error('父组完成稿没有可复制的形状');
  const inside = (x: number, y: number) => x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height;
  const whole = await mask(text, canvas);
  for (let x = region.x; x < region.x + region.width; x++) for (const y of [region.y, region.y + region.height - 1]) {
    if (whole[y * canvas.width + x] >= alphaThreshold) throw new Error(`选框边线在 (${x},${y}) 切过父组形状；框线须落在空白处，相连的形状不能按选框复制`);
  }
  for (let y = region.y; y < region.y + region.height; y++) for (const x of [region.x, region.x + region.width - 1]) {
    if (whole[y * canvas.width + x] >= alphaThreshold) throw new Error(`选框边线在 (${x},${y}) 切过父组形状；框线须落在空白处，相连的形状不能按选框复制`);
  }
  const kept: number[] = [];
  for (let index = 0; index < found.length; index++) {
    const alpha = await mask(keep(text, found, new Set([index])), canvas);
    let within = 0, outside = 0;
    for (let i = 0; i < alpha.length; i++) {
      if (alpha[i] < alphaThreshold) continue;
      if (inside(i % canvas.width, Math.floor(i / canvas.width))) within++; else outside++;
    }
    if (within && outside) throw new Error(`选框切分了父组的第 ${index + 1} 个形状；只能复制整体位于框内的独立形状`);
    if (within) kept.push(index);
  }
  if (!kept.length) throw new Error('选框内没有父组形状');
  if (kept.length === found.length) throw new Error('选框包含父组全部形状；子节点须是父组中的独立一块');
  let svg = rebind(withoutCompletionMarker(keep(text, found, new Set(kept))), id);
  svg = updateSvgRoot(svg, { 'data-source-sha256': createHash('sha256').update(source).digest('hex'),
    'data-parent-region': `${region.x} ${region.y} ${region.width} ${region.height}` });
  return { svg, pieces: kept, total: found.length };
}

// Root attributes a copy carries; an outline the agent writes itself drops them.
export const copyAttributes = ['data-source-sha256', 'data-parent-region', 'data-parent-mask'] as const;
export const withoutCopyAttributes = (svg: string) => updateSvgRoot(svg, Object.fromEntries(copyAttributes.map(key => [key, null])));
// An outline is a copy when its root still names the parent's current completion.
export function isParentCopy(outline: Buffer | string, parent: Buffer): boolean {
  const root = svgSource(outline.toString()).root.element;
  return root.getAttribute('data-source-sha256') === createHash('sha256').update(parent).digest('hex') &&
    (root.hasAttribute('data-parent-region') || root.hasAttribute('data-parent-mask'));
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

// The outline tool: writes the copied part of the parent's completion as the group's outline draft.
export function createParentRegionTool(options: { directory: string; parentPath: string; canvas: Canvas; groupId: string; draft: string;
  overrides?: string }): FunctionTool {
  return {
    ...toolDefinition('copy_parent_region', options.overrides),
    async execute(value, signal, context) {
      signal.throwIfAborted();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('参数须为对象');
      const { region: raw, maskSvg, ...rest } = value as Record<string, unknown>;
      if (Object.keys(rest).length || (raw === undefined) === (maskSvg === undefined)) throw new Error('region 与 maskSvg 须二选一');
      const root = context?.root ?? taskRootOf(options.directory);
      let region: ParentRegion;
      if (maskSvg !== undefined) {
        if (typeof maskSvg !== 'string' || !maskSvg.trim()) throw new Error('maskSvg 须为遮罩 SVG 路径');
        region = checkParentMask(await readFile(await realpath(fromTaskPath(root, maskSvg)), 'utf8'), options.canvas);
      } else region = checkParentRegion(raw, options.canvas);
      const copy = await copyParentRegion(options.parentPath, options.groupId, region, options.canvas);
      await mkdir(dirname(options.draft), { recursive: true });
      await writeFile(options.draft, recolor(copy.svg));
      return textResult({ ...('mask' in region ? { maskSvg } : { region }), path: await toAgentPath(root, options.draft), shapes: copy.pieces.length || undefined, parentShapes: copy.total,
        note: '复制结果已写入轮廓草稿；保持不改即作为本组轮廓，跳过轮廓 review 与补全。请用 preview_svg 的 edge 模式核对范围' });
    },
  };
}
