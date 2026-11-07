import { randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import sharp from 'sharp';
import { fromTaskPath, toTaskPath } from '../shared/task-paths.ts';
import { angleKey, angleParameter, angleScale, type AngleScale } from './angles.ts';
import type { Box, TurnInput } from './turn.ts';
import { validateHeadNineAxis, keyformAt, parentPoint, nodes, checkWarpGeometry, warpPoint as sampleWarp, type WarpGrid, type HeadNineAxis, type HeadLevel } from '../shared/nine-axis-model.js';

// step02_angles: the agent fits the face to the left view and delivers the
// ParamAngleX left keyform (−30 by default, degrees, see angles.ts) as
// face-left.json + layers/. The right side is the mirror image: each part takes
// its left/right pair's left field reflected about the face axis. The program
// then writes deformers.json and source.json.
export const headOutputs = ['face-left.json', 'deformers.json', 'source.json'] as const;
export type HeadInput = TurnInput & { document: string };

// Each step that uses the KRA works on its own copy in its own directory.
export const stepDocument = (turn: TurnInput, directory: string): HeadInput =>
  ({ ...turn, document: join(directory, 'character-nine-axis.kra'), color: join(directory, 'character-nine-axis.png') });

// Copy the KRA and its composite from the step before (shadow for step02).
export async function copyDocument(from: { document: string; color: string }, to: HeadInput) {
  for (const file of [from.document, from.color]) await access(file).catch(error => { throw new Error(`缺少源文件：${file}`, { cause: error }); });
  await mkdir(dirname(to.document), { recursive: true });
  await copyFile(from.document, to.document);
  await copyFile(from.color, to.color);
}

type Point = [number, number];
export type Part = { level?: HeadLevel; mirror?: string; id: string; group: string; texture: string; textureBounds: number[]; bbox: number[];
  cols: number; rows: number; keyforms: Record<string, Point[]>; parent?: string; interpolation?: 'linear' | 'smooth'; parameterInterpolation?: { x?: 'linear' | 'ellipse' }; role?: 'mask'; clip?: { by: string[]; invert?: boolean } };
export type FaceLeft = { version: 2; axis: number; notes?: string; deformers: WarpGrid[]; parts: Part[] };

export function checkFaceLeft(value: unknown, canvas: [number, number], left: string): FaceLeft {
  const face = value as FaceLeft;
  if (face?.version !== 2 || !Array.isArray(face.deformers)) throw new Error('face-left.json：须为 version 2，含 artist 定义的 deformers 数组（可以为空）');
  if (!face || typeof face !== 'object' || !Number.isFinite(face.axis) || face.axis <= 0 || face.axis >= canvas[0]) throw new Error('face-left.json：axis 须为画布内的脸部中轴列');
  if (!Array.isArray(face.parts) || !face.parts.length) throw new Error('face-left.json：没有部件');
  const ids = new Set<string>();
  for (const p of face.parts) {
    if (typeof p?.id !== 'string' || !isHeadPartId(p.id) || ids.has(p.id)) throw new Error(`face-left.json：部件 id 须为不重复的 face/ 路径或脖子 neck：${p?.id}`);
    ids.add(p.id);
    if (typeof p.group !== 'string' || !p.group) throw new Error(`${p.id}：缺少 group`);
    if (typeof p.texture !== 'string' || !p.texture) throw new Error(`${p.id}：缺少 texture`);
    if (!Array.isArray(p.textureBounds) || p.textureBounds.length !== 4 || !p.textureBounds.every(Number.isFinite)) throw new Error(`${p.id}：textureBounds 无效`);
    if (!Array.isArray(p.bbox) || p.bbox.length !== 4 || !p.bbox.every(Number.isFinite) || !(p.bbox[2] > p.bbox[0] && p.bbox[3] > p.bbox[1])) throw new Error(`${p.id}：bbox 无效`);
    if (!Number.isInteger(p.cols) || !Number.isInteger(p.rows) || p.cols < 1 || p.rows < 1) throw new Error(`${p.id}：网格尺寸无效`);
    const count = (p.cols + 1) * (p.rows + 1);
    for (const key of ['0', left]) {
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
  validateHeadNineAxis({ version: 2, kind: 'head-nine-axis', levels: [faceLevel], deformers: face.deformers,
    parts: face.parts.map(p => ({ level: 'face', ...p })) });
  return face;
}

// Agents write task files as absolute paths (shared runtime prompt); a relative
// path means the task root, or the step directory when it starts with layers/.
// Either way the texture must be a PNG in this step's layers/, and deformers.json
// stores it relative to the step directory, which the workbench reads from.
export function stepTexture(directory: string, task: string, id: string, texture: string): string {
  const path = isAbsolute(texture) || !texture.startsWith('layers/') ? fromTaskPath(task, texture) : join(directory, texture);
  const local = relative(directory, path).split(sep).join('/');
  if (!/^layers\/[\w-]+\.png$/.test(local)) throw new Error(`${id}：texture 须为本步 layers/ 下的 PNG：${texture}`);
  return local;
}

// The first level is neck + face + features: the neck layer comes along by default.
export const isHeadPartId = (id: string) => /^(face\/|neck(\/|$))/.test(id);
export const faceLevel: HeadNineAxis['levels'][number] = { id: 'face', name: '脖子＋脸＋五官', includes: ['face'] };
const isEar = (id: string) => /(^|[/_])ear(?=$|[/_])/.test(id);

// The other side's layer: left and right swapped as whole words of the id.
export const pairId = (id: string) => id.replace(/(^|[/_.-])(left|right)(?=$|[/_.-])/g, (_, lead, side) => lead + (side === 'left' ? 'right' : 'left'));

// A part's keyform position of a canvas point: bilinear in its control lattice;
// outside the lattice the nearest edge's displacement carries on.
export function warpPoint(part: Part, key: string, x: number, y: number): Point {
  const node: WarpGrid = { level: 'face', ...part };
  return sampleWarp(node, part.keyforms[key]?.flat() ?? keyformAt(node, Number(key)), x, y);
}

// The right keyform of a part = its pair's left keyform, reflected about the face axis.
export function mirrorKeyform(part: Pick<Part, 'keyforms'>, pair: Part | WarpGrid, axis: number, left: string): Point[] {
  return part.keyforms['0'].map(([x, y]) => {
    const [mx, my] = sampleWarp(pair as WarpGrid, pair.keyforms[left]?.flat() ?? keyformAt(pair as WarpGrid, Number(left)), 2 * axis - x, y);
    return [round(2 * axis - mx), round(my)];
  });
}
const round = (value: number) => Math.round(value * 100) / 100;

// Mirror the composed left shape, then express it in the destination parent's
// right space. Artists may use different hierarchies on the two sides.
export function mirrorDocument<T extends HeadNineAxis>(document: T, axis: number, field: 'keyforms' | 'keyformsXY'): T {
  const source = document, target = structuredClone(document), byId = new Map(nodes(source).map(p => [p.id, p]));
  const done = new Set<string>(), ordered: WarpGrid[] = [];
  const visit = (p: WarpGrid) => {
    if (done.has(p.id)) return;
    if (p.parent) visit(target.deformers.find(q => q.id === p.parent)!);
    done.add(p.id); ordered.push(p);
  };
  for (const p of nodes(target)) visit(p);
  for (const p of ordered) {
    const pair = byId.get(p.mirror ?? pairId(p.id)) ?? byId.get(p.id)!;
    for (const key of Object.keys(p[field] ?? {})) {
      const [x, y = 0] = key.split(',').map(Number); if (!(x < 0)) continue;
      const left = keyformAt(pair, x, y), right = field === 'keyforms' ? angleKey(-x) : `${angleKey(-x)},${angleKey(y)}`;
      p[field]![right] = p.keyforms['0'].map(([px, py]) => {
        if (/^neck(?:\/|$)/.test(p.id)) return [px, py];
        let [mx, my] = sampleWarp(pair, left, 2 * axis - px, py);
        [mx, my] = parentPoint(source, pair, x, y, mx, my);
        const q = parentPoint(target, p, -x, y, 2 * axis - mx, my, true);
        return q.map(v => Math.round(v * 10000) / 10000) as Point;
      });
    }
  }
  return target;
}
export function mirrorHierarchy(face: FaceLeft): { deformers: WarpGrid[]; parts: (Part & { level: HeadLevel })[] } {
  const doc = mirrorDocument({ version: 2, kind: 'head-nine-axis', levels: [faceLevel], deformers: face.deformers,
    parts: face.parts.map(p => ({ level: 'face', ...p })) } as HeadNineAxis, face.axis, 'keyforms');
  return { deformers: doc.deformers, parts: doc.parts as (Part & { level: HeadLevel })[] };
}

async function atomic(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, text); await rename(tmp, path);
}

// A step's workbench document built from the delivery, and the file each texture
// comes from: view_nine_axis renders it as it is, finish writes it into the step.
export type Built = { doc: HeadNineAxis; textures: Map<string, string> };
export async function writeBuilt(directory: string, { doc, textures }: Built) {
  await mkdir(join(directory, 'layers'), { recursive: true });
  for (const [texture, source] of textures) if (source !== join(directory, texture)) await copyFile(source, join(directory, texture));
  await atomic(join(directory, 'deformers.json'), JSON.stringify(doc) + '\n');
}

// Check the agent's delivery and mirror it into the workbench document.
export async function buildHead(directory: string, input: HeadInput, box: Box, scale: AngleScale = angleScale(), taskRoot = dirname(dirname(directory))): Promise<Built & { source: Record<string, string> }> {
  let raw: unknown;
  try { raw = JSON.parse(await readFile(join(directory, 'face-left.json'), 'utf8')); }
  catch (error) { throw new Error('agent 未交付可读的 face-left.json', { cause: error }); }
  return compileHead(directory, input, box, raw as FaceLeft, scale, taskRoot);
}
export async function compileHead(directory: string, input: HeadInput, box: Box, value: FaceLeft, scale: AngleScale = angleScale(), taskRoot = dirname(dirname(directory))): Promise<Built & { source: Record<string, string> }> {
  const task = taskRoot, { width = 0, height = 0 } = await sharp(input.color).metadata(), left = angleKey(scale.x[0]);
  const local = structuredClone(value);
  for (const p of local.parts ?? []) p.texture = stepTexture(directory, task, p.id, p.texture);
  const face = checkFaceLeft(local, [width, height], left);
  for (const p of face.parts) await access(join(directory, p.texture)).catch(error => { throw new Error(`${p.id}：缺少贴图 ${p.texture}`, { cause: error }); });
  const mirrored = mirrorHierarchy(face);
  // face-left.json lists parts top to bottom (KRA order); deformers.json lists
  // them in drawing order, bottom first, as the workbench renders them.
  const parts = mirrored.parts.toReversed().map(p => ({ ...p, level: p.level ?? 'face' as HeadLevel }));
  const deformers = mirrored.deformers;
  const document = toTaskPath(task, input.document), color = toTaskPath(task, input.color);
  const keys = [...new Set([...deformers, ...parts].flatMap(p => Object.keys(p.keyforms).map(Number)))].sort((a, b) => a - b);
  const doc: HeadNineAxis & { axis: number } = { version: 2, kind: 'head-nine-axis', canvas: [width, height],
    source: { document }, view: { x: box.x, y: box.y, width: box.size, height: box.size }, axis: face.axis,
    parameters: [{ ...angleParameter('ParamAngleX', '角度 X', scale.x), keys }, { ...angleParameter('ParamAngleY', '角度 Y', scale.y), keys: [0], status: '未制作' }],
    levels: [faceLevel],
    notes: [face.notes?.trim(), `${sign(scale.x[0])}° 为向左视角，${sign(scale.x[1])}° 为左右成对镜像。`].filter(Boolean).join(' '), deformers, parts };
  validateHeadNineAxis(doc);
  for (const n of [...deformers, ...parts]) checkWarpGeometry(n);
  return { doc, textures: new Map(parts.map(p => [p.texture, join(directory, p.texture)])),
    source: { sourceDocument: document, sourceColor: color } };
}

// After the agent: write the workbench files.
export async function finishHead(directory: string, input: HeadInput, box: Box, scale: AngleScale = angleScale(), taskRoot = dirname(dirname(directory))): Promise<number> {
  const built = await buildHead(directory, input, box, scale, taskRoot);
  await writeBuilt(directory, built);
  await atomic(join(directory, 'source.json'), JSON.stringify({ version: 1, ...built.source, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  return built.doc.parts.length;
}

export const sign = (v: number) => (v > 0 ? '+' : '') + v;
