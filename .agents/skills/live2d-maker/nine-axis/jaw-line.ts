import { randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { angleKey, angleScale, type AngleScale } from './angles.ts';
import { cornerKey } from './angle-xy.ts';
import { faceLevel, isHeadPartId, mirrorKeyform, pairId, stepTexture, type Part } from './head.ts';

// step07_jaw-line: the jaw line, the neck under the face, and the masks that
// clip them, as in the Cubism tutorial. The original may or may not have a jaw
// line: the agent splits a baked line off the face base (and fills the base
// under it) or paints one, adds a mask part that sits just below the line at rest
// and moves onto it when the head turns or tilts (the line is clipped by it,
// inverted), and fits the neck with its top extended under the face. Masks are
// parts with role "mask": never drawn, only clipping others (clip {by, invert}).
// The agent delivers jaw.json + layers/; the program keeps every step06 part it
// does not replace, mirrors the right keyforms and writes deformers.json.

type Point = [number, number];
type Forms = Record<string, Point[]>;
export type HeadPart = Part & { level: string; keyformsY: Forms; keyformsXY: Forms; role?: 'mask'; clip?: { by: string[]; invert?: boolean } };
type HeadDocument = { axis: number; levels: unknown[]; parts: HeadPart[]; notes?: string };
// A delivered part: only id keeps the step06 part; texture + textureBounds alone
// repaint it on the same grid; a grid (bbox, cols, rows, keyforms…) makes it anew.
type JawPart = Partial<Omit<HeadPart, 'keyformsY' | 'keyformsXY'>> & { id: string; keyformsY?: Forms; keyformsXY?: Forms };
export type Jaw = { notes?: string; parts: JawPart[] };

const points = (value: unknown, count: number) => Array.isArray(value) && value.length === count
  && value.every(q => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite));

export function checkJaw(value: unknown, upstream: HeadDocument, scale: AngleScale = angleScale()): Jaw {
  const jaw = value as Jaw;
  if (!jaw || typeof jaw !== 'object' || !Array.isArray(jaw.parts) || !jaw.parts.length) throw new Error('jaw.json：没有部件');
  const old = new Map(upstream.parts.map(p => [p.id, p])), ids = new Set<string>();
  const keys = { keyforms: ['0', angleKey(scale.x[0])], keyformsY: [angleKey(scale.y[1]), angleKey(scale.y[0])],
    keyformsXY: [cornerKey(scale.x[0], scale.y[1]), cornerKey(scale.x[0], scale.y[0])] } as const;
  for (const p of jaw.parts) {
    if (typeof p?.id !== 'string' || !isHeadPartId(p.id) || ids.has(p.id)) throw new Error(`jaw.json：部件 id 须为不重复的 face/ 路径或脖子 neck：${p?.id}`);
    ids.add(p.id);
    if ('opacity' in p) throw new Error(`${p.id}：不用不透明度隐藏部件，用蒙版裁切`);
    if (p.role !== undefined && p.role !== 'mask') throw new Error(`${p.id}：role 只能是 "mask"`);
    const grid = ['bbox', 'cols', 'rows', 'keyforms', 'keyformsY', 'keyformsXY'].filter(k => k in p);
    if (!old.has(p.id) && grid.length < 6) throw new Error(`${p.id}：新部件须给出 bbox、cols、rows 与 keyforms、keyformsY、keyformsXY`);
    if (grid.length && grid.length < 6) throw new Error(`${p.id}：换网格时 bbox、cols、rows 与三组关键形须一起给出`);
    if (!old.has(p.id) || 'texture' in p || 'textureBounds' in p) {
      if (typeof p.texture !== 'string' || !p.texture) throw new Error(`${p.id}：缺少 texture`);
      if (!Array.isArray(p.textureBounds) || p.textureBounds.length !== 4 || !p.textureBounds.every(Number.isFinite)) throw new Error(`${p.id}：textureBounds 无效`);
    }
    if (!old.has(p.id) && (typeof p.group !== 'string' || !p.group)) throw new Error(`${p.id}：缺少 group`);
    if (!grid.length) continue;
    if (!Array.isArray(p.bbox) || p.bbox.length !== 4 || !p.bbox.every(Number.isFinite) || !(p.bbox[2] > p.bbox[0] && p.bbox[3] > p.bbox[1])) throw new Error(`${p.id}：bbox 无效`);
    if (!Number.isInteger(p.cols) || !Number.isInteger(p.rows) || p.cols! < 1 || p.rows! < 1) throw new Error(`${p.id}：网格尺寸无效`);
    const count = (p.cols! + 1) * (p.rows! + 1);
    for (const [field, list] of Object.entries(keys)) for (const key of list) {
      if (!points((p as Record<string, Forms | undefined>)[field]?.[key], count)) throw new Error(`${p.id}：${field} 关键形 ${key} 需要 ${count} 个控制点`);
    }
  }
  const missing = upstream.parts.find(p => !ids.has(p.id));
  if (missing) throw new Error(`jaw.json：缺少 step06 部件 ${missing.id}（不改的部件只写 id）`);
  for (const p of jaw.parts) {
    const clip = p.clip ?? old.get(p.id)?.clip;
    if (clip === undefined) continue;
    if (!Array.isArray(clip.by) || !clip.by.length || clip.by.some(id => !ids.has(id) || id === p.id)) throw new Error(`${p.id}：clip.by 须为本文件中其他部件的 id`);
    if (clip.invert !== undefined && typeof clip.invert !== 'boolean') throw new Error(`${p.id}：clip.invert 须为布尔值`);
  }
  if (!jaw.parts.some(p => (p.role ?? old.get(p.id)?.role) === 'mask')) throw new Error('jaw.json：没有蒙版部件（role "mask"）');
  return jaw;
}

async function atomic(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, text); await rename(tmp, path);
}

// After the agent: check jaw.json against step06, keep or replace each part,
// mirror the right keyforms and corners, and write the workbench document.
export async function finishJawLine(directory: string, angleXY: string, scale: AngleScale = angleScale()): Promise<number> {
  const doc = JSON.parse(await readFile(join(angleXY, 'deformers.json'), 'utf8')) as HeadDocument;
  let raw: unknown;
  try { raw = JSON.parse(await readFile(join(directory, 'jaw.json'), 'utf8')); }
  catch (error) { throw new Error('agent 未交付可读的 jaw.json', { cause: error }); }
  const jaw = checkJaw(raw, doc, scale), task = dirname(dirname(directory)), old = new Map(doc.parts.map(p => [p.id, p]));
  // jaw.json lists parts top to bottom, like the KRA; deformers.json draws bottom first.
  const merged = jaw.parts.toReversed().map(p => {
    const base = old.get(p.id), part = { level: 'face', ...base, ...p } as HeadPart & { fresh: boolean };
    part.fresh = !base || 'texture' in p;
    return part;
  });
  for (const p of merged) if (p.fresh) {
    p.texture = stepTexture(directory, task, p.id, p.texture);
    await access(join(directory, p.texture)).catch(error => { throw new Error(`${p.id}：缺少贴图 ${p.texture}`, { cause: error }); });
  }
  const own = new Set(merged.filter(p => p.fresh).map(p => p.texture)), kept = merged.filter(p => !p.fresh);
  const clash = kept.find(p => own.has(p.texture));
  if (clash) throw new Error(`${clash.texture}：与沿用的 step06 部件 ${clash.id} 的贴图同名，新贴图换一个文件名`);
  await mkdir(join(directory, 'layers'), { recursive: true });
  for (const p of kept) await copyFile(join(angleXY, p.texture), join(directory, p.texture));
  const byId = new Map(merged.map(p => [p.id, p])), [left, right] = scale.x.map(angleKey), corners = [scale.y[1], scale.y[0]];
  const parts = merged.map(({ fresh, ...p }) => {
    if (!(jaw.parts.find(q => q.id === p.id)!.keyforms)) return p;
    const pair = byId.get(pairId(p.id)) ?? p;
    const keyformsXY = { ...p.keyformsXY };
    for (const y of corners) {
      const key = cornerKey(scale.x[0], y);
      keyformsXY[cornerKey(scale.x[1], y)] = mirrorKeyform(p, { ...pair, keyforms: { ...pair.keyforms, [key]: pair.keyformsXY[key] } }, doc.axis, key);
    }
    return { ...p, keyforms: { [left]: p.keyforms[left], '0': p.keyforms['0'], [right]: mirrorKeyform(p, pair, doc.axis, left) }, keyformsXY };
  });
  const notes = [doc.notes?.trim(), jaw.notes?.trim(), '下颌线：线、脸色扩展与脖子由蒙版裁切（Cubism 剪贴蒙版；反转即只画蒙版以外），向右与右侧两角为左右成对镜像。'].filter(Boolean).join(' ');
  await atomic(join(directory, 'deformers.json'), JSON.stringify({ ...doc, levels: [faceLevel], notes, parts }) + '\n');
  return parts.length;
}
