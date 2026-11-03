import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { angleKey, angleParameter, angleScale, type AngleScale } from './angles.ts';
import { sign } from './head.ts';

// step05_angle-y: the agent fits the same face warps to step04's up and down views
// and delivers the ParamAngleY up and down keyforms (+25 / −25 by default,
// degrees, see angles.ts) per step03 part (face-y.json). Up and down are not
// mirror images, so both are fitted. The program copies step03's deformers and
// textures and adds the Y keyforms, so the workbench reads one document with both angles.

type Point = [number, number];
type XPart = { id: string; texture: string; cols: number; rows: number; keyforms: Record<string, Point[]> };
type XDocument = { parts: XPart[]; parameters: { id: string }[]; notes?: string };
export type FaceY = { notes?: string; parts: { id: string; keyforms: Record<string, Point[]> }[] };

export function checkFaceY(value: unknown, x: XDocument, keys: string[], file = 'face-y.json', upstream = 'step03'): FaceY {
  const face = value as FaceY;
  if (!face || typeof face !== 'object' || !Array.isArray(face.parts)) throw new Error(`${file}：没有部件`);
  const expected = new Map(x.parts.map(p => [p.id, p])), seen = new Set<string>();
  for (const p of face.parts) {
    const part = expected.get(p?.id);
    if (!part || seen.has(p.id)) throw new Error(`${file}：部件 ${p?.id} 不在 ${upstream} 中或重复`);
    seen.add(p.id);
    const count = (part.cols + 1) * (part.rows + 1);
    for (const key of keys) {
      const points = p.keyforms?.[key];
      if (!Array.isArray(points) || points.length !== count || points.some(q => !Array.isArray(q) || q.length !== 2 || !q.every(Number.isFinite))) {
        throw new Error(`${p.id}：关键形 ${key} 需要 ${count} 个控制点（沿用 ${upstream} 的网格）`);
      }
    }
    if ('opacity' in p) throw new Error(`${p.id}：不用不透明度隐藏部件`);
  }
  const missing = x.parts.find(p => !seen.has(p.id));
  if (missing) throw new Error(`${file}：缺少部件 ${missing.id}`);
  return face;
}

export const cornersPending = '斜向（四角）未制作。';

async function atomic(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, text); await rename(tmp, path);
}

// After the agent: check its delivery against step03 and write the combined deformers.json.
export async function finishAngleY(directory: string, angleX: string, scale: AngleScale = angleScale()): Promise<number> {
  const x = JSON.parse(await readFile(join(angleX, 'deformers.json'), 'utf8')) as XDocument;
  let raw: unknown;
  try { raw = JSON.parse(await readFile(join(directory, 'face-y.json'), 'utf8')); }
  catch (error) { throw new Error('agent 未交付可读的 face-y.json', { cause: error }); }
  const [down, up] = scale.y, keys = [angleKey(up), angleKey(down)];
  const byId = new Map(checkFaceY(raw, x, keys).parts.map(p => [p.id, p.keyforms]));
  await mkdir(join(directory, 'layers'), { recursive: true });
  for (const p of x.parts) await copyFile(join(angleX, p.texture), join(directory, p.texture));
  const parts = x.parts.map(p => ({ ...p, keyformsY: { [keys[1]]: byId.get(p.id)![keys[1]], [keys[0]]: byId.get(p.id)![keys[0]] } }));
  const parameters = x.parameters.map(q => q.id === 'ParamAngleY' ? angleParameter('ParamAngleY', '角度 Y', scale.y) : q);
  const notes = [x.notes, (raw as FaceY).notes?.trim(), `Y：${sign(up)}° 抬头、${sign(down)}° 低头，与 X 叠加预览；${cornersPending}`].filter(Boolean).join(' ');
  await atomic(join(directory, 'deformers.json'), JSON.stringify({ ...x, parameters, notes, parts }) + '\n');
  return parts.length;
}

