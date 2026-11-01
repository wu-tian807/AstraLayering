import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { toTaskPath } from '../shared/task-paths.ts';
import { angleParameter, angleScale, type AngleScale } from './angles.ts';
import { fileHash, type Box, type TurnInput } from './turn.ts';

// step02_angle-x: the agent fits the face to the left view and delivers the
// ParamAngleX −30 warps (face-left.json + layers/). The +30 side is the mirror
// image: each part takes its left/right pair's −30 field reflected about the
// face axis. The program then writes deformers.json (keys in degrees, see
// angles.ts) and source.json.
export const headOutputs = ['face-left.json', 'deformers.json', 'source.json'] as const;
export type HeadInput = TurnInput & { document: string };

export async function resolveHeadInput(turn: TurnInput): Promise<HeadInput> {
  const document = turn.color.replace(/\.png$/, '.kra');
  if (!await access(document).then(() => true, () => false)) throw new Error(`缺少源 KRA：${document}`);
  return { ...turn, document };
}

type Point = [number, number];
export type Part = { id: string; group: string; texture: string; textureBounds: number[]; bbox: number[];
  cols: number; rows: number; keyforms: Record<string, Point[]> };
export type FaceLeft = { axis: number; notes?: string; parts: Part[] };

export function checkFaceLeft(value: unknown, canvas: [number, number]): FaceLeft {
  const face = value as FaceLeft;
  if (!face || typeof face !== 'object' || !Number.isFinite(face.axis) || face.axis <= 0 || face.axis >= canvas[0]) throw new Error('face-left.json：axis 须为画布内的脸部中轴列');
  if (!Array.isArray(face.parts) || !face.parts.length) throw new Error('face-left.json：没有部件');
  const ids = new Set<string>();
  for (const p of face.parts) {
    if (typeof p?.id !== 'string' || !p.id.startsWith('face/') || ids.has(p.id)) throw new Error(`face-left.json：部件 id 须为不重复的 face/ 路径：${p?.id}`);
    ids.add(p.id);
    if (typeof p.group !== 'string' || !p.group) throw new Error(`${p.id}：缺少 group`);
    if (typeof p.texture !== 'string' || !/^layers\/[\w-]+\.png$/.test(p.texture)) throw new Error(`${p.id}：texture 须为 layers/NNN.png`);
    if (!Array.isArray(p.textureBounds) || p.textureBounds.length !== 4 || !p.textureBounds.every(Number.isFinite)) throw new Error(`${p.id}：textureBounds 无效`);
    if (!Array.isArray(p.bbox) || p.bbox.length !== 4 || !p.bbox.every(Number.isFinite) || !(p.bbox[2] > p.bbox[0] && p.bbox[3] > p.bbox[1])) throw new Error(`${p.id}：bbox 无效`);
    if (!Number.isInteger(p.cols) || !Number.isInteger(p.rows) || p.cols < 1 || p.rows < 1) throw new Error(`${p.id}：网格尺寸无效`);
    const count = (p.cols + 1) * (p.rows + 1);
    for (const key of ['0', '-30']) {
      const points = p.keyforms?.[key];
      if (!Array.isArray(points) || points.length !== count || points.some(q => !Array.isArray(q) || q.length !== 2 || !q.every(Number.isFinite))) {
        throw new Error(`${p.id}：关键形 ${key} 需要 ${count} 个控制点`);
      }
    }
    // Nothing is hidden by fading: the far ear moves behind the head and the face covers it.
    if ('opacity' in p) throw new Error(`${p.id}：不用不透明度隐藏部件；远侧耳移到脑后，由脸遮挡`);
  }
  if (!ids.has('face/face_base')) throw new Error('face-left.json：缺少 face/face_base');
  // parts run top to bottom in draw order; ears sit under the face so it can cover them.
  const base = face.parts.findIndex(p => p.id === 'face/face_base');
  const above = face.parts.slice(0, base).find(p => isEar(p.id));
  if (above) throw new Error(`${above.id}：耳朵须排在 face/face_base 之下，才能被脸遮挡`);
  return face;
}

const isEar = (id: string) => /(^|[/_])ear(?=$|[/_])/.test(id);

// The other side's layer: left and right swapped as whole words of the id.
export const pairId = (id: string) => id.replace(/(^|[/_])(left|right)(?=$|[/_])/g, (_, lead, side) => lead + (side === 'left' ? 'right' : 'left'));

// A part's −30 position of a canvas point: bilinear in its control lattice;
// outside the lattice the nearest edge's displacement carries on.
export function warpPoint(part: Part, key: string, x: number, y: number): Point {
  const [x0, y0, x1, y1] = part.bbox, { cols, rows } = part, points = part.keyforms[key];
  const u = Math.min(cols, Math.max(0, (x - x0) / (x1 - x0) * cols)), v = Math.min(rows, Math.max(0, (y - y0) / (y1 - y0) * rows));
  const i = Math.min(cols - 1, Math.floor(u)), j = Math.min(rows - 1, Math.floor(v)), s = u - i, t = v - j;
  const a = points[j * (cols + 1) + i], b = points[j * (cols + 1) + i + 1], c = points[(j + 1) * (cols + 1) + i], d = points[(j + 1) * (cols + 1) + i + 1];
  const at = (k: 0 | 1) => (a[k] * (1 - s) + b[k] * s) * (1 - t) + (c[k] * (1 - s) + d[k] * s) * t;
  const restX = x0 + (x1 - x0) * u / cols, restY = y0 + (y1 - y0) * v / rows;
  return [at(0) + x - restX, at(1) + y - restY];
}

// +30 of a part = its pair's −30, reflected about the face axis.
export function mirrorKeyform(part: Part, pair: Part, axis: number): Point[] {
  return part.keyforms['0'].map(([x, y]) => {
    const [mx, my] = warpPoint(pair, '-30', 2 * axis - x, y);
    return [round(2 * axis - mx), round(my)];
  });
}
const round = (value: number) => Math.round(value * 100) / 100;

async function atomic(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, text); await rename(tmp, path);
}

// After the agent: check its delivery, mirror, and write the workbench files.
export async function finishHead(directory: string, input: HeadInput, box: Box, scale: AngleScale = angleScale()): Promise<number> {
  const task = dirname(dirname(directory)), { width = 0, height = 0 } = await sharp(input.color).metadata();
  let raw: unknown;
  try { raw = JSON.parse(await readFile(join(directory, 'face-left.json'), 'utf8')); }
  catch (error) { throw new Error('agent 未交付可读的 face-left.json', { cause: error }); }
  const face = checkFaceLeft(raw, [width, height]);
  for (const p of face.parts) await access(join(directory, p.texture)).catch(error => { throw new Error(`${p.id}：缺少贴图 ${p.texture}`, { cause: error }); });
  const byId = new Map(face.parts.map(p => [p.id, p])), pair = (p: Part) => byId.get(pairId(p.id)) ?? p;
  const parts = face.parts.map(p => ({ id: p.id, level: 'face', group: p.group, texture: p.texture, textureBounds: p.textureBounds, bbox: p.bbox,
    cols: p.cols, rows: p.rows, keyforms: { [scale.x[0]]: p.keyforms['-30'], '0': p.keyforms['0'], [scale.x[1]]: mirrorKeyform(p, pair(p), face.axis) } }));
  const [kraHash, colorHash] = await Promise.all([fileHash(input.document), fileHash(input.color)]);
  const document = toTaskPath(task, input.document), color = toTaskPath(task, input.color);
  await atomic(join(directory, 'deformers.json'), JSON.stringify({ version: 1, kind: 'head-nine-axis', canvas: [width, height],
    source: { document, sha256: kraHash }, view: { x: box.x, y: box.y, width: box.size, height: box.size }, axis: face.axis,
    parameters: [angleParameter('ParamAngleX', '角度 X', scale.x), { ...angleParameter('ParamAngleY', '角度 Y', scale.y), keys: [0], status: '未制作' }],
    levels: [{ id: 'face', name: '脸＋五官', includes: ['face'] }],
    notes: [face.notes?.trim(), `${sign(scale.x[0])}° 为向左视角，${sign(scale.x[1])}° 为左右成对镜像。`].filter(Boolean).join(' '), parts }) + '\n');
  await atomic(join(directory, 'source.json'), JSON.stringify({ version: 1, sourceDocument: document, sourceColor: color,
    sourceKraHash: kraHash, sourceColorHash: colorHash, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  return parts.length;
}

export const sign = (v: number) => (v > 0 ? '+' : '') + v;
