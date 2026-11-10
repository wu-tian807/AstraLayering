import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { angleKey, angleParameter, angleScale, type AngleScale } from './angles.ts';
import { mirrorDocument, type Built } from './head.ts';
import { nodes, validateHeadNineAxis, checkWarpGeometry, evaluatePoints, type HeadNineAxis } from '../shared/nine-axis-model.js';

export type PitchStage = 'up' | 'down';
export type Stage = PitchStage | 'xy' | 'jaw';
export type AuthoredHead = HeadNineAxis & { axis: number; authoring: { stage: Stage; upstreamSha256: string } };
export const authorFile = (stage: Stage) => ({ up: 'face-up.json', down: 'face-down.json', xy: 'face-xy.json', jaw: 'jaw.json' })[stage];
export const pitchKeys = (stage: PitchStage, scale: AngleScale) => [stage === 'up' ? scale.y[1] : scale.y[0]];
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function readUpstream(directory: string) {
  const text = await readFile(join(directory, 'deformers.json'), 'utf8');
  const doc = validateHeadNineAxis(JSON.parse(text)) as HeadNineAxis & { axis: number };
  return { doc, hash: sha256(text) };
}
// The entire author document retains hierarchy and clipping. The edit tool
// creates it from the current upstream; artists need not expand coordinates.
export function startContinuation(upstream: HeadNineAxis & { axis: number }, hash: string, stage: Stage, scale: AngleScale = angleScale()): AuthoredHead {
  const doc = structuredClone(upstream) as AuthoredHead;
  doc.authoring = { stage, upstreamSha256: hash };
  if (stage === 'up' || stage === 'down') {
    const keys = pitchKeys(stage, scale);
    const existingUp = upstream.parameters?.find(p => p.id === 'ParamAngleY')?.keys?.includes(scale.y[1]);
    const range: [number, number] = stage === 'up' ? [0, scale.y[1]] : [scale.y[0], existingUp ? scale.y[1] : 0];
    doc.parameters = doc.parameters!.map(p => p.id === 'ParamAngleY' ? { ...angleParameter('ParamAngleY', '角度 Y', range), keys: [...new Set([range[0], 0, range[1]])] } : p);
    for (const n of nodes(doc)) {
      n.keyformsY ??= {};
      for (const y of keys) n.keyformsY[angleKey(y)] ??= structuredClone(n.keyforms['0']);
    }
  }
  if (stage === 'xy') for (const n of nodes(doc)) {
    n.keyformsXY = {};
    for (const x of scale.x) for (const y of scale.y) n.keyformsXY[`${angleKey(x)},${angleKey(y)}`] =
      n.keyforms['0'].map(([rx, ry], i) => [n.keyforms[angleKey(x)][i][0] + n.keyformsY![angleKey(y)][i][0] - rx,
        n.keyforms[angleKey(x)][i][1] + n.keyformsY![angleKey(y)][i][1] - ry]);
  }
  return doc;
}

export function checkContinuation(value: unknown, upstream: HeadNineAxis & { axis: number }, hash: string, stage: Stage, scale: AngleScale = angleScale()): AuthoredHead {
  const doc = validateHeadNineAxis(value) as AuthoredHead;
  if (doc.authoring?.stage !== stage || doc.authoring?.upstreamSha256 !== hash) throw Error(`${authorFile(stage)}：上游已变化或来源记录不匹配，请从当前上游重新制作`);
  if (doc.axis !== upstream.axis || JSON.stringify(doc.canvas) !== JSON.stringify(upstream.canvas) || JSON.stringify(doc.source) !== JSON.stringify((upstream as any).source)) throw Error('不能替换上游画布、中轴或角色来源');
  if (JSON.stringify(doc.axisSources) !== JSON.stringify(upstream.axisSources)) throw Error('不能替换已完成单轴的形变来源；本阶段只编辑当前方向');
  const ids = new Map(nodes(doc).map(n => [n.id, n]));
  for (const n of upstream.parts) if (!ids.has(n.id)) throw Error(`${authorFile(stage)}：缺少上游节点 ${n.id}`);
  // Existing poses stay in canvas space even if an artist adds or reparents a
  // local warp. A later phase must not silently overwrite an earlier axis.
  if (stage !== 'jaw') for (const n of upstream.parts) {
    const target = ids.get(n.id)!;
    const sampleKeys=(keys:string[])=>{const k=keys.map(Number).sort((a,b)=>a-b);return [...k,...k.slice(1).map((v,i)=>(v+k[i])/2)];};
    const poses = [...sampleKeys(Object.keys(n.keyforms)).map(x => [x, 0]), ...(stage === 'down' || stage === 'xy' ? sampleKeys(['0',...Object.keys(n.keyformsY ?? {})]).map(y => [0, y]) : [])];
    for (const [x,y] of poses) {
      const a = evaluatePoints(upstream, n, x, y, 2), b = evaluatePoints(doc, target, x, y, 2);
      if (a.length !== b.length || a.some((v, i) => Math.abs(v - b[i]) > .02)) throw Error(`${n.id}：本阶段不能改动已制作的轴 ${x},${y}`);
    }
  }
  const fields: [string, string[]][] = [['keyforms', ['0', ...scale.x.map(angleKey)]]];
  fields.push(['keyformsY', (stage === 'up' || stage === 'down' ? pitchKeys(stage, scale) : scale.y).map(angleKey)]);
  if (stage === 'xy' || stage === 'jaw') fields.push(['keyformsXY', scale.x.flatMap(x => scale.y.map(y => `${angleKey(x)},${angleKey(y)}`))]);
  for (const n of nodes(doc)) {
    for (const [field, keys] of fields) for (const key of keys) if (!(n as any)[field]?.[key]) throw Error(`${n.id}：缺少 ${field} 关键形 ${key}`);
    if ('opacity' in n) throw Error(`${n.id}：使用覆盖与裁切，不用透明度隐藏部件`);
    checkWarpGeometry(n);
  }
  return doc;
}

export async function compileContinuation(directory: string, upstreamDirectory: string, value: AuthoredHead, stage: Stage, scale: AngleScale = angleScale()): Promise<Built> {
  const upstream = await readUpstream(upstreamDirectory);
  const checked = checkContinuation(value, upstream.doc, upstream.hash, stage, scale);
  const mirrored = stage === 'up' || stage === 'down' ? structuredClone(checked) : mirrorDocument(checked, checked.axis, 'keyformsXY');
  const doc = stage === 'jaw' ? mirrorDocument(mirrored, checked.axis, 'keyforms') : mirrored;
  validateHeadNineAxis(doc); for (const n of nodes(doc)) checkWarpGeometry(n);
  const textures = new Map<string,string>();
  for (const p of doc.parts) {
    const own = join(directory, p.texture), inherited = join(upstreamDirectory, p.texture);
    const source = await access(own).then(() => own, async () => {
      await access(inherited).catch(() => { throw Error(`${p.id}：缺少贴图 ${p.texture}`); }); return inherited;
    });
    textures.set(p.texture, source);
  }
  return { doc: doc as unknown as Built['doc'], textures };
}
export async function buildContinuation(directory: string, upstreamDirectory: string, stage: Stage, scale: AngleScale = angleScale()): Promise<Built> {
  const path = join(directory, authorFile(stage)); let raw: AuthoredHead;
  try { raw = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { throw Error(`agent 未交付可读的 ${authorFile(stage)}`, { cause: error }); }
  const built = await compileContinuation(directory, upstreamDirectory, raw, stage, scale);
  if (stage === 'jaw' && !built.doc.parts.some(p => p.role === 'mask')) throw Error('jaw.json：没有蒙版部件');
  return built;
}
