import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { angleKey, angleScale, type AngleScale } from './angles.ts';
import { checkFaceY, cornersPending, type FaceY } from './angle-y.ts';
import { mirrorKeyform, pairId, sign, writeBuilt, type Built, type Part } from './head.ts';

// step06_angle-xy: the diagonal (corner) keyforms on both angles. The program
// writes the linear start — rest + the X offset + the Y offset — for the left
// corners (linear.json); the agent shears them by hand into face-xy.json, and
// takes its own corner reference frames from step01's left-up/left-down videos. The right
// corners are the mirror images, and the workbench blends the 3×3 grid of keyforms.

type Point = [number, number];
type YPart = Part & { keyformsY: Record<string, Point[]> };
type YDocument = { axis: number; parts: YPart[]; parameters: { id: string }[]; notes?: string };

// Corner keyform keys: both parameter values, X first ("-30,25").
export const cornerKey = (x: number, y: number) => `${angleKey(x)},${angleKey(y)}`;
export const corners = ['left-up', 'left-down'] as const;
export type Corner = typeof corners[number];
const cornerValues = ({ x, y }: AngleScale) => ({ 'left-up': [x[0], y[1]], 'left-down': [x[0], y[0]] }) as Record<Corner, [number, number]>;
export const cornerAngleValues = (scale: AngleScale = angleScale()) => {
  const v = cornerValues(scale);
  return { left_up: cornerKey(...v['left-up']), left_down: cornerKey(...v['left-down']) };
};

async function atomic(path: string, text: string | Buffer) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, text); await rename(tmp, path);
}
const round = (value: number) => Math.round(value * 100) / 100;

// The start the agent shears from: X and Y offsets from the rest form added up.
export function linearCorner(part: YPart, x: number, y: number): Point[] {
  const rest = part.keyforms['0'], X = part.keyforms[angleKey(x)], Y = part.keyformsY[angleKey(y)];
  return rest.map(([rx, ry], i) => [round(X[i][0] + Y[i][0] - rx), round(X[i][1] + Y[i][1] - ry)]);
}
export async function writeLinearCorners(directory: string, angleY: string, scale: AngleScale = angleScale()) {
  const doc = JSON.parse(await readFile(join(angleY, 'deformers.json'), 'utf8')) as YDocument, v = cornerValues(scale);
  await atomic(join(directory, 'linear.json'), JSON.stringify({ notes: 'X 与 Y 的线性叠加', parts: doc.parts.map(p => ({ id: p.id,
    keyforms: Object.fromEntries(corners.map(c => [cornerKey(...v[c]), linearCorner(p, ...v[c])])) })) }) + '\n');
}

// After the agent: check face-xy.json against step05 and mirror the right corners.
export async function buildAngleXY(directory: string, angleY: string, scale: AngleScale = angleScale()): Promise<Built> {
  const doc = JSON.parse(await readFile(join(angleY, 'deformers.json'), 'utf8')) as YDocument, v = cornerValues(scale);
  let raw: unknown;
  try { raw = JSON.parse(await readFile(join(directory, 'face-xy.json'), 'utf8')); }
  catch (error) { throw new Error('agent 未交付可读的 face-xy.json', { cause: error }); }
  const keys = corners.map(c => cornerKey(...v[c]));
  const byId = new Map(checkFaceY(raw, doc, keys, 'face-xy.json', 'step05').parts.map(p => [p.id, p.keyforms]));
  const parts = doc.parts.map(p => {
    const own = byId.get(p.id)!, pair = doc.parts.find(q => q.id === pairId(p.id)) ?? p, forms = byId.get(pair.id)!;
    const right = (c: Corner) => {
      const [x, y] = v[c], key = cornerKey(x, y);
      return [cornerKey(-x, y), mirrorKeyform(p, { ...pair, keyforms: { ...pair.keyforms, [key]: forms[key] } }, doc.axis, key)] as const;
    };
    return { ...p, keyformsXY: { ...Object.fromEntries(keys.map(k => [k, own[k]])), ...Object.fromEntries(corners.map(right)) } };
  });
  const [lx] = v['left-up'];
  const notes = [doc.notes?.replace(cornersPending, '').trim(), (raw as FaceY).notes?.trim(),
    `斜向：${sign(lx)}° 的左上、左下手动斜切，${sign(-lx)}° 的右上、右下为左右成对镜像；四角之间双线性插值。`].filter(Boolean).join(' ');
  return { doc: { ...doc, notes, parts }, textures: new Map(doc.parts.map(p => [p.texture, join(angleY, p.texture)])) };
}
// Write the deformers.json the workbench reads.
export async function finishAngleXY(directory: string, angleY: string, scale: AngleScale = angleScale()): Promise<number> {
  const built = await buildAngleXY(directory, angleY, scale);
  await writeBuilt(directory, built);
  return built.doc.parts.length;
}
