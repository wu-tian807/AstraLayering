import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { textResult, type FunctionTool } from './function-tools.ts';

export type Canvas = { width: number; height: number };
export type SvgObservation = { source: string; mode: 'svg' | 'blend' | 'edge'; savedPath: string };
const boundsScale = 4;
const alphaThreshold = 128;

export function createSvgReadTool(directory: string, paths: (string | undefined)[]): FunctionTool {
  const normalize = (path: string) => process.platform === 'win32' ? path.toLowerCase() : path;
  const allowed = new Set(paths.filter((path): path is string => !!path).map(path => normalize(resolve(directory, path))));
  return {
    name: 'read_svg',
    description: '只读本次明确提供的 SVG 或指定草稿源码，可复用父图共享曲线。offset 是字符偏移，默认 0；limit 默认 16000，最多 65536。返回 totalCharacters、sha256、nextOffset，nextOffset 非空时按它继续读取同版本后续页。源码分页不等于完整 SVG；读取不修改文件，也不代替 preview_svg 自检。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['path'], properties: {
      path: { type: 'string' }, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 65536 },
    } },
    async execute(value, signal) {
      signal.throwIfAborted();
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['path', 'offset', 'limit'].includes(key)) ||
          typeof (value as { path?: unknown }).path !== 'string') throw new Error('仅提交本次指定 SVG 的 path、offset 和 limit');
      const args = value as { path: string; offset?: number; limit?: number };
      const offset = args.offset ?? 0, limit = args.limit ?? 16000;
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 65536) throw new Error('无效源码分页 offset 或 limit');
      const requested = resolve(directory, args.path);
      if (!/\.svg$/i.test(requested) || !allowed.has(normalize(requested))) throw new Error('只能读取本次明确提供的 SVG 或指定草稿');
      const root = await realpath(directory), source = await realpath(requested), rel = relative(root, source);
      if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('SVG 必须位于本次运行目录内');
      if ((await stat(source)).size > 8 * 1024 * 1024) throw new Error('SVG 源码超过 8 MiB，未读取');
      const bytes = await readFile(source);
      if (bytes.length > 8 * 1024 * 1024) throw new Error('SVG 源码超过 8 MiB，未读取');
      const text = bytes.toString('utf8');
      if (offset > text.length) throw new Error('offset 超出 SVG 源码长度');
      const end = Math.min(offset + limit, text.length);
      signal.throwIfAborted();
      return textResult({ source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        offset, totalCharacters: text.length, nextOffset: end < text.length ? end : null,
        complete: offset === 0 && end === text.length, svg: text.slice(offset, end) });
    },
  };
}

async function svgDocument(path: string, canvas: Canvas) {
  const bytes = await readFile(path);
  const text = bytes.toString('utf8');
  const root = text.match(/<svg\b[^>]*>/)?.[0];
  const viewBox = root?.match(/\bviewBox\s*=\s*(['"])(.*?)\1/)?.[2].trim().split(/[\s,]+/).map(Number);
  if (!root || !viewBox || viewBox.length !== 4 ||
      viewBox.some((value, i) => value !== [0, 0, canvas.width, canvas.height][i])) {
    throw new Error(`SVG 必须沿用画布 viewBox="0 0 ${canvas.width} ${canvas.height}"：${path}`);
  }
  const metadata = await sharp(bytes, { limitInputPixels: 100_000_000 }).metadata();
  if (metadata.width !== canvas.width || metadata.height !== canvas.height) throw new Error(`SVG 画布尺寸不符：${path}`);
  return { bytes, text, root };
}

async function alpha(path: string, canvas: Canvas, scale = 1): Promise<Buffer> {
  const document = await svgDocument(path, canvas);
  const width = canvas.width * scale, height = canvas.height * scale;
  const root = document.root.replace(/\s(?:width|height)\s*=\s*(['"]).*?\1/g, '')
    .replace(/>$/, ` width="${width}" height="${height}">`);
  const bytes = scale === 1 ? document.bytes : Buffer.from(document.text.replace(document.root, root));
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
  if (/<(?:image|script|foreignObject)\b/.test(document.text)) throw new Error('组 SVG 必须是可编辑矢量，不嵌入位图或脚本');
  const bindings = [...document.text.matchAll(/\bdata-group-path\s*=\s*(['"])(.*?)\1/g)].map(match => match[2]);
  if (!bindings.length || bindings.some(value => value !== id) ||
      ![...document.text.matchAll(/<g\b[^>]*>/g)].some(match => /\sid\s*=/.test(match[0]) &&
        new RegExp(`\\bdata-group-path\\s*=\\s*(['"])${id}\\1`).test(match[0]))) {
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
  observed?: (observation: SvgObservation) => void;
}): FunctionTool {
  let count = 0;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    name: 'preview_svg',
    description: '渲染本次运行内的独立 SVG 并返回图片。mode=svg 为白底独显，blend 为与绑定参考图半透明混合，edge 为红色边缘叠加；crop=[x,y,width,height] 使用原图像素坐标，scale=1..8。子组同时返回与绑定父 SVG 的范围检查结果，检查固定使用四倍采样，越界坐标和面积折算到原图。输入不修改。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['path'], properties: {
      path: { type: 'string' }, mode: { type: 'string', enum: ['svg', 'blend', 'edge'] },
      crop: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'integer', minimum: 0 } },
      scale: { type: 'number', minimum: 1, maximum: 8 },
    } },
    async execute(value, signal) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SVG 预览参数须为对象');
      const args = value as { path?: unknown; mode?: unknown; crop?: unknown; scale?: unknown };
      if (typeof args.path !== 'string' || !args.path.trim()) throw new Error('path 须为 SVG 路径');
      const root = await realpath(options.directory);
      const source = await realpath(resolve(root, args.path));
      const rel = relative(root, source);
      if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('SVG 必须位于本次运行目录内');
      const mode = args.mode ?? 'svg', scale = args.scale ?? 1;
      if (!['svg', 'blend', 'edge'].includes(String(mode)) || typeof scale !== 'number' || !Number.isFinite(scale) || scale < 1 || scale > 8) {
        throw new Error('无效 mode 或 scale');
      }
      const crop = args.crop ?? [0, 0, options.canvas.width, options.canvas.height];
      if (!Array.isArray(crop) || crop.length !== 4 || crop.some(n => !Number.isSafeInteger(n) || n < 0) || !crop[2] || !crop[3]) {
        throw new Error('crop 须为 [x,y,width,height] 整数选框，宽高大于零');
      }
      const [left, top, width, height] = crop as number[];
      const outWidth = Math.round(width * scale), outHeight = Math.round(height * scale);
      if (left + width > options.canvas.width || top + height > options.canvas.height) throw new Error('crop 超出画布');
      if (outWidth * outHeight > 16_000_000) throw new Error('预览过大，请缩小选框或 scale');
      signal.throwIfAborted();
      const document = await svgDocument(source, options.canvas);
      // 修改临时渲染的视口，在裁剪区域内直接放大矢量，不修改输入文件。
      const tag = document.root.replace(/\s(?:width|height|viewBox)\s*=\s*(['"]).*?\1/g, '')
        .replace(/>$/, ` width="${outWidth}" height="${outHeight}" viewBox="${crop.join(' ')}">`);
      const vector = await sharp(Buffer.from(document.text.replace(document.root, tag))).ensureAlpha().raw().toBuffer();
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
        const reference = await sharp(options.reference).autoOrient().extract({ left, top, width, height })
          .resize(outWidth, outHeight).png().toBuffer();
        data = await sharp(reference).composite([{ input: overlay, raw: { width: outWidth, height: outHeight, channels: 4 } }])
          .flatten({ background: 'white' }).png().toBuffer();
      }
      if (data.length > 10 * 1024 * 1024) throw new Error('预览文件过大，请缩小选框或 scale');
      const bounds = options.parent && source !== resolve(options.parent)
        ? await checkParentBounds(source, options.parent, options.canvas) : undefined;
      signal.throwIfAborted();
      await mkdir(options.observationDirectory, { recursive: true });
      const savedPath = join(options.observationDirectory, `${stamp}-${++count}.png`);
      await writeFile(savedPath, data);
      options.observed?.({ source, mode: mode as SvgObservation['mode'], savedPath });
      return { success: true, contentItems: [
        { type: 'inputText', text: JSON.stringify({ source, mode, crop, scale, width: outWidth, height: outHeight, savedPath, bounds }) },
        { type: 'inputImage', imageUrl: `data:image/png;base64,${data.toString('base64')}` },
      ] };
    },
  };
}
