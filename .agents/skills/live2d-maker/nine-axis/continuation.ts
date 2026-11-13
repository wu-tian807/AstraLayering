import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { angleKey, angleParameter, angleScale, type AngleScale } from './angles.ts';
import { mirrorDocument, type Built } from './head.ts';
import { nodes, validateHeadNineAxis, checkWarpGeometry, evaluatePoints, kraReferences, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { modelDocument, withDocument } from './source.ts';
import { taskRootOf } from '../shared/task-paths.ts';
import { dirname } from 'node:path';
import type { MaterialLoader } from './kra-materials.ts';
import sharp from 'sharp';

const geometryOnly=(value: any): any=>JSON.parse(JSON.stringify(value??null,(key,value)=>['texture','uuid','material'].includes(key)?undefined:value));

export type PitchStage = 'up' | 'down';
export type Stage = PitchStage | 'xy' | 'jaw' | 'hair' | 'accessories';
export type AuthoredHead = HeadNineAxis & { axis: number; authoring: { stage: Stage; upstreamSha256?: string } };
export const authorFile = (stage: Stage) => ({ up: 'face-up.json', down: 'face-down.json', xy: 'face-xy.json', jaw: 'jaw.json', hair: 'hair.json', accessories: 'accessories.json' })[stage];
export const isHairNode = (node: { id: string; level: string }) => node.level === 'hair' && /^hair(?:\/|$)/.test(node.id);
export const isAccessoryNode = (node: { id: string; level: string }) => node.level === 'accessory' && /^head_accessories(?:\/|::|$)/.test(node.id);
const horizontalStage = (stage:Stage) => stage==='hair'||stage==='accessories';
const horizontalNode = (stage:Stage,node:{id:string;level:string}) => stage==='hair'?isHairNode(node):isAccessoryNode(node);
export const pitchKeys = (stage: PitchStage, scale: AngleScale) => [stage === 'up' ? scale.y[1] : scale.y[0]];
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function readUpstream(directory: string) {
  const text = await readFile(join(directory, 'deformers.json'), 'utf8');
  const doc = validateHeadNineAxis(JSON.parse(text)) as HeadNineAxis & { axis: number };
  return { doc };
}
// The entire author document retains hierarchy and clipping. The edit tool
// creates it from the current upstream; artists need not expand coordinates.
export function startContinuation(upstream: HeadNineAxis & { axis: number }, stage: Stage, scale: AngleScale = angleScale()): AuthoredHead {
  const doc = structuredClone(upstream) as AuthoredHead;
  doc.authoring = { stage };
  if (horizontalStage(stage)) {
    // This step exposes horizontal authoring only. Inherited face geometry,
    // including its completed Y/XY forms, stays intact in the document.
    doc.parameters = doc.parameters!.map(p => p.id === 'ParamAngleY'
      ? { ...p, min: 0, max: 0, default: 0, keys: [0], status: '本步仅制作左右' } : p);
    if (!doc.levels.some(level => level.id === 'hair')) doc.levels.push({ id: 'hair', includes: ['face','hair'] });
    if(stage==='accessories'&&!doc.levels.some(level=>level.id==='accessory'))doc.levels.push({id:'accessory',includes:['face','hair','accessory']});
  }
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

export function checkContinuation(value: unknown, upstream: HeadNineAxis & { axis: number }, stage: Stage, scale: AngleScale = angleScale()): AuthoredHead {
  const doc = validateHeadNineAxis(value) as AuthoredHead;
  if (doc.authoring?.stage !== stage) throw Error(`${authorFile(stage)}：阶段记录不匹配，请使用本阶段的作者模型`);
  const sameSource = JSON.stringify(doc.source) === JSON.stringify(upstream.source);
  const inheritedGeometry = (stage === 'jaw' || horizontalStage(stage)) && doc.source?.geometryDocument === (upstream.source?.geometryDocument ?? upstream.source?.document);
  if (doc.axis !== upstream.axis || JSON.stringify(doc.canvas) !== JSON.stringify(upstream.canvas) || (!sameSource && !inheritedGeometry)) throw Error('不能替换上游画布、中轴或角色来源');
  if (JSON.stringify(geometryOnly(doc.axisSources)) !== JSON.stringify(geometryOnly(upstream.axisSources))) throw Error('不能替换已完成单轴的形变来源；本阶段只编辑当前方向');
  const ids = new Map(nodes(doc).map(n => [n.id, n]));
  for (const n of upstream.parts) if (!ids.has(n.id)) throw Error(`${authorFile(stage)}：缺少上游节点 ${n.id}`);
  if (stage !== 'jaw' && !horizontalStage(stage)) for (const part of upstream.parts) {
    const current = doc.parts.find(p => p.id === part.id)!;
    if (current.uuid !== part.uuid || current.material !== part.material) throw Error(`${part.id}：本阶段不能替换上游 KRA 图层绑定`);
  }
  // Existing poses stay in canvas space even if an artist adds or reparents a
  // local warp. A later phase must not silently overwrite an earlier axis.
  if (stage !== 'jaw' && !horizontalStage(stage)) for (const n of upstream.parts) {
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
  if (stage === 'xy' || stage === 'jaw' || stage === 'hair') fields.push(['keyformsXY', scale.x.flatMap(x => scale.y.map(y => `${angleKey(x)},${angleKey(y)}`))]);
  if (horizontalStage(stage)) {
    const label=stage==='hair'?'头发':'头部饰品',prefix=stage==='hair'?'hair/':'head_accessories/';
    const vertical = doc.parameters?.find(p => p.id === 'ParamAngleY');
    if (vertical?.min !== 0 || vertical.max !== 0 || JSON.stringify(vertical.keys) !== '[0]')
      throw Error(`${label}步骤只制作 left/right，ParamAngleY 必须固定为 0`);
    const original = new Map(nodes(upstream).map(node => [node.id,node]));
    for (const [id,before] of original) if (!horizontalNode(stage,before)) {
      const current = structuredClone(ids.get(id));
      if (!current) throw Error(`${label}阶段缺少上游节点 ${id}`);
      if(stage==='accessories') {
        const a=upstream.parts.find(p=>p.id===id),b=doc.parts.find(p=>p.id===id);
        if(a&&(!b||a.uuid!==b.uuid||a.material!==b.material))throw Error(`${id}：头部饰品阶段不能替换上游图层绑定`);
      }
      // Old jaw deliveries can acquire missing UUIDs/transparent driver tags
      // through their KRA export receipt; their geometry stays byte-for-byte.
      if (!('uuid' in before)) delete (current as any).uuid;
      if ('texture' in before && before.texture === 'layers/mirror-grid-transparent.png' && !('material' in before)) delete (current as any).material;
      if (JSON.stringify(geometryOnly(current)) !== JSON.stringify(geometryOnly(before))) throw Error(`${id}：${label}阶段不能改动已完成的脸部、五官、下颌、脖子或其他上游节点`);
    }
    for (const node of nodes(doc)) if (!original.has(node.id) && !horizontalNode(stage,node)) throw Error(`${node.id}：${label}阶段新增节点须属于 ${prefix}`);
    const inheritedOrder = upstream.parts.filter(part => !horizontalNode(stage,part)).map(part => part.id);
    if (JSON.stringify(doc.parts.filter(part => inheritedOrder.includes(part.id)).map(part => part.id)) !== JSON.stringify(inheritedOrder)) throw Error(`${label}阶段不能改动已有脸部图层及其他上游节点的相对绘制顺序`);
  }
  for (const n of nodes(doc)) {
    const horizontalHair = horizontalStage(stage) && horizontalNode(stage,n);
    if (horizontalHair && (Object.keys(n.keyformsY ?? {}).length || Object.keys(n.keyformsXY ?? {}).length))
      throw Error(`${n.id}：${stage==='hair'?'头发':'头部饰品'}步骤只制作 left/right，不能新增上下或四角关键形`);
    for (const [field, keys] of fields) {
      if (horizontalStage(stage) && field !== 'keyforms') continue;
      for (const key of keys) if (!(n as any)[field]?.[key]) throw Error(`${n.id}：缺少 ${field} 关键形 ${key}`);
    }
    if ('opacity' in n) throw Error(`${n.id}：使用覆盖与裁切，不用透明度隐藏部件`);
    checkWarpGeometry(n);
  }
  return doc;
}

export async function compileContinuation(directory: string, upstreamDirectory: string, value: AuthoredHead, stage: Stage, scale: AngleScale = angleScale(), materialize?: MaterialLoader, signal?: AbortSignal): Promise<Built> {
  const upstream = await readUpstream(upstreamDirectory);
  let author = value;
  if (stage === 'jaw' || horizontalStage(stage)) {
    const root = taskRootOf(dirname(directory)), document = await modelDocument(root, directory, value);
    if (document) author = withDocument(value, root, document) as AuthoredHead;
  }
  const checked = checkContinuation(author, upstream.doc, stage, scale);
  const mirrored = stage === 'up' || stage === 'down' || horizontalStage(stage) ? structuredClone(checked) : mirrorDocument(checked, checked.axis, 'keyformsXY');
  const doc = stage === 'jaw' ? mirrorDocument(mirrored, checked.axis, 'keyforms') : mirrored;
  validateHeadNineAxis(doc); for (const n of nodes(doc)) checkWarpGeometry(n);
  if (materialize) {
    const built = await materialize(directory, { doc, textures: new Map() }, signal, false);
    if (horizontalStage(stage)) {
      const baseline = await materialize(upstreamDirectory, { doc: upstream.doc, textures: new Map() }, signal, false);
      await Promise.all(upstream.doc.parts.filter(part => !horizontalNode(stage,part)).map(async part => {
        const current = built.doc.parts.find(p => p.id === part.id)!;
        const rgba = (file: string) => sharp(file).ensureAlpha().raw().toBuffer();
        const [a,b] = await Promise.all([rgba(baseline.textures.get(baseline.doc.parts.find(p => p.id === part.id)!.texture!)!),rgba(built.textures.get(current.texture!)!)]);
        if (!a.equals(b)) throw Error(`${part.id}：${stage==='hair'?'头发':'头部饰品'} KRA 修改了已有脸部画稿或其他上游画稿，请恢复该图层后继续`);
      }));
    }
    return built;
  }
  const textures = new Map<string,string>();
  for (const p of doc.parts) {
    if (p.uuid || p.material === 'transparent') continue;
    if (!p.texture) throw Error(p.id + '：缺少 KRA UUID');
    const own = join(directory, p.texture), inherited = join(upstreamDirectory, p.texture);
    const source = await access(own).then(() => own, async () => {
      await access(inherited).catch(() => { throw Error(`${p.id}：缺少贴图 ${p.texture}`); }); return inherited;
    });
    textures.set(p.texture, source);
  }
  return { doc: doc as unknown as Built['doc'], textures };
}
export async function buildContinuation(directory: string, upstreamDirectory: string, stage: Stage, scale: AngleScale = angleScale(), materialize?: MaterialLoader): Promise<Built> {
  const path = join(directory, authorFile(stage)); let raw: AuthoredHead;
  try { raw = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { throw Error(`agent 未交付可读的 ${authorFile(stage)}`, { cause: error }); }
  const built = await compileContinuation(directory, upstreamDirectory, raw, stage, scale, materialize);
  if (stage === 'jaw' && !built.doc.parts.some(p => p.role === 'mask')) throw Error('jaw.json：没有蒙版部件');
  return built;
}
