import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// step03_angle-y: the agent fits the same face warps to the up and down views
// and delivers ParamAngleY +30 (up) and −30 (down) per step02 part
// (face-y.json). Up and down are not mirror images, so both are fitted. The
// program copies step02's deformers and textures and adds the Y keyforms, so
// the workbench reads one document with both angles.

type Point = [number, number];
type XPart = { id: string; texture: string; cols: number; rows: number; keyforms: Record<string, Point[]> };
type XDocument = { parts: XPart[]; parameters: { id: string }[]; notes?: string };
export type FaceY = { notes?: string; parts: { id: string; keyforms: Record<'30' | '-30', Point[]> }[] };

export function checkFaceY(value: unknown, x: XDocument): FaceY {
  const face = value as FaceY;
  if (!face || typeof face !== 'object' || !Array.isArray(face.parts)) throw new Error('face-y.json：没有部件');
  const expected = new Map(x.parts.map(p => [p.id, p])), seen = new Set<string>();
  for (const p of face.parts) {
    const part = expected.get(p?.id);
    if (!part || seen.has(p.id)) throw new Error(`face-y.json：部件 ${p?.id} 不在 step02 中或重复`);
    seen.add(p.id);
    const count = (part.cols + 1) * (part.rows + 1);
    for (const key of ['30', '-30'] as const) {
      const points = p.keyforms?.[key];
      if (!Array.isArray(points) || points.length !== count || points.some(q => !Array.isArray(q) || q.length !== 2 || !q.every(Number.isFinite))) {
        throw new Error(`${p.id}：关键形 ${key} 需要 ${count} 个控制点（沿用 step02 的网格）`);
      }
    }
    if ('opacity' in p) throw new Error(`${p.id}：不用不透明度隐藏部件`);
  }
  const missing = x.parts.find(p => !seen.has(p.id));
  if (missing) throw new Error(`face-y.json：缺少部件 ${missing.id}`);
  return face;
}

async function atomic(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, text); await rename(tmp, path);
}

// After the agent: check its delivery against step02 and write the combined deformers.json.
export async function finishAngleY(directory: string, angleX: string): Promise<number> {
  const x = JSON.parse(await readFile(join(angleX, 'deformers.json'), 'utf8')) as XDocument;
  let raw: unknown;
  try { raw = JSON.parse(await readFile(join(directory, 'face-y.json'), 'utf8')); }
  catch (error) { throw new Error('agent 未交付可读的 face-y.json', { cause: error }); }
  const byId = new Map(checkFaceY(raw, x).parts.map(p => [p.id, p.keyforms]));
  await mkdir(join(directory, 'layers'), { recursive: true });
  for (const p of x.parts) await copyFile(join(angleX, p.texture), join(directory, p.texture));
  const parts = x.parts.map(p => ({ ...p, keyformsY: { '-30': byId.get(p.id)!['-30'], '30': byId.get(p.id)!['30'] } }));
  const parameters = x.parameters.map(q => q.id === 'ParamAngleY' ? { id: 'ParamAngleY', name: '角度 Y', min: -30, max: 30, default: 0, keys: [-30, 0, 30] } : q);
  const notes = [x.notes, (raw as FaceY).notes?.trim(), 'Y：+30 抬头、−30 低头，与 X 叠加预览；斜向（四角）未制作。'].filter(Boolean).join(' ');
  await atomic(join(directory, 'deformers.json'), JSON.stringify({ ...x, parameters, notes, parts }) + '\n');
  return parts.length;
}

