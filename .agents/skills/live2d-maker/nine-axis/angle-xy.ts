import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { angleKey, angleScale, type AngleScale } from './angles.ts';
import { writeBuilt, type Built } from './head.ts';
import { buildContinuation, compileContinuation, readUpstream, startContinuation, type AuthoredHead } from './continuation.ts';
import { evaluatePoints, nodes } from '../shared/nine-axis-model.js';
import { fileHash } from './turn.ts';
export const cornerKey=(x:number,y:number)=>`${angleKey(x)},${angleKey(y)}`;
export const corners=['left-up','left-down'] as const;
export type Corner=typeof corners[number];
export const cornerAngleValues=(scale:AngleScale=angleScale())=>({left_up:cornerKey(scale.x[0],scale.y[1]),left_down:cornerKey(scale.x[0],scale.y[0])});
// Selection belongs to the agent; completion only verifies that both fits
// still refer to its recorded video frames and traces.
export async function checkCornerReferences(directory:string,size:number,checked:readonly Corner[]=corners) {
  const selected=JSON.parse(await readFile(join(directory,'selected-frames.json'),'utf8'));
  const videos=JSON.parse(await readFile(join(directory,'videos.json'),'utf8'));
  if(selected.version!==1||!selected.frames||typeof selected.frames!=='object')throw Error('selected-frames.json 需要 version:1 和 frames 对象');
  for(const corner of checked) {
    const frame=selected.frames[corner];
    const sameFile=(value:unknown,name:string)=>typeof value==='string'&&resolve(directory,value)===resolve(directory,name);
    if(!frame||!sameFile(frame.video,`${corner}.mp4`)||!sameFile(frame.path,`${corner}.png`)||typeof frame.reason!=='string'||!frame.reason.trim())throw Error(`${corner}：缺少本步选帧路径或选择依据`);
    if(!(Number.isSafeInteger(frame.frameIndex)&&frame.frameIndex>=0)&&!(Number.isFinite(frame.timeSeconds)&&frame.timeSeconds>=0))throw Error(`${corner}：记录实际 frameIndex 或 timeSeconds，不以估算角度代替`);
    const videoHash=await fileHash(resolve(directory,frame.video)),referenceHash=await fileHash(resolve(directory,frame.path));
    if(frame.videoSha256!==videoHash||videos[corner]?.sha256!==videoHash||frame.sha256!==referenceHash)throw Error(`${corner}：选帧记录的原片或参考帧已变化`);
    await readFile(join(directory,'frames',`${corner}.png`));
    const meta=await sharp(resolve(directory,frame.path)).metadata();
    if(meta.format!=='png'||meta.width!==size||meta.height!==size)throw Error(`${corner}：参考帧必须保留裁框并规范化为 ${size}×${size} PNG`);
    const report=JSON.parse(await readFile(join(directory,`${corner}-fit-report.json`),'utf8'));
    if(report.referenceSha256!==referenceHash||report.traceSha256!==await fileHash(join(directory,`${corner}-face-trace.json`)))throw Error(`${corner}：参考帧或描线变化后必须重新拟合`);
  }
}
export async function writeLinearCorners(directory:string,angleY:string,scale:AngleScale=angleScale()) {
  const upstream=await readUpstream(angleY),doc=startContinuation(upstream.doc,upstream.hash,'xy',scale);
  await mkdir(directory,{recursive:true});const path=join(directory,'linear.json'),temporary=`${path}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(doc)+'\n');await rename(temporary,path);
}
export async function buildAngleXY(directory:string,angleY:string,scale:AngleScale=angleScale()):Promise<Built>{return buildContinuation(directory,angleY,'xy',scale);}
export async function finishAngleXY(directory:string,angleY:string,scale:AngleScale=angleScale()):Promise<number>{
  const built=await buildAngleXY(directory,angleY,scale);await writeBuilt(directory,built);
  // Native tools return absolute task paths. Verify their identity before
  // publishing portable metadata; the selected frame/video bytes stay exact.
  const path=join(directory,'selected-frames.json'),selected=JSON.parse(await readFile(path,'utf8'));
  const size=(await sharp(join(directory,'left-up.png')).metadata()).width!;
  await checkCornerReferences(directory,size);
  for(const corner of corners){selected.frames[corner].video=`${corner}.mp4`;selected.frames[corner].path=`${corner}.png`;}
  const temporary=`${path}.${randomUUID()}.tmp`;await writeFile(temporary,JSON.stringify(selected,null,2)+'\n');await rename(temporary,path);
  return built.doc.parts.length;
}

// Each corner is an independent child session of step03 with its own copy of
// the shared corner video; the parent combines the two finished authors.
export const cornerKeyOf=(corner:Corner,scale:AngleScale=angleScale())=>cornerKey(scale.x[0],corner==='left-up'?scale.y[1]:scale.y[0]);
export async function seedCorner(directory:string,parent:string,corner:Corner) {
  await mkdir(directory,{recursive:true});
  for(const name of [`${corner}.mp4`,'videos.json','linear.json'])await copyFile(join(parent,name),join(directory,name));
}
async function writeJson(path:string,value:unknown) {
  const temporary=`${path}.${randomUUID()}.tmp`;await writeFile(temporary,JSON.stringify(value,null,2)+'\n');await rename(temporary,path);
}
export async function finishCorner(directory:string,angleY:string,corner:Corner,scale:AngleScale=angleScale()):Promise<number>{
  const built=await buildAngleXY(directory,angleY,scale);
  const upstream=await readUpstream(angleY),ids=(parts:{id:string}[])=>parts.map(p=>p.id).sort().join('\n');
  if(ids(built.doc.parts)!==ids(upstream.doc.parts))throw Error(`${corner}：分角斜向只用上游图层，不新增或删除图层`);
  await writeBuilt(directory,built);
  const path=join(directory,'selected-frames.json'),selected=JSON.parse(await readFile(path,'utf8'));
  const size=(await sharp(join(directory,`${corner}.png`)).metadata()).width!;
  await checkCornerReferences(directory,size,[corner]);
  selected.frames={[corner]:{...selected.frames[corner],video:`${corner}.mp4`,path:`${corner}.png`}};
  await writeJson(path,selected);
  return built.doc.parts.length;
}
const suffixes:Record<Corner,string>={'left-up':'.xy-up','left-down':'.xy-down'};
// Upstream deformers are empty, so every warp belongs to one corner's author.
// Suffixes keep left/right as whole words for implicit mirror pairing.
function renamed(doc:AuthoredHead,corner:Corner):AuthoredHead{
  const value=structuredClone(doc),parts=new Set(value.parts.map(p=>p.id)),name=(id:string)=>id+suffixes[corner];
  for(const n of value.deformers)n.id=name(n.id);
  for(const n of nodes(value)){
    if(n.parent!==undefined&&n.parent!==null)n.parent=name(n.parent);
    if(n.mirror!==undefined&&!parts.has(n.id))n.mirror=name(n.mirror);
  }
  return value;
}
// Each child warp is identity at every key except its own corner, so a leaf's
// chain becomes leaf -> left-up warps -> left-down warps; mirror recomputes the
// right corners. An up warp shared by leaves under different down parents is
// duplicated per down context.
export function mergeCornerDocs(upstream:AuthoredHead|{deformers:unknown[];parts:{id:string}[]},up:AuthoredHead,down:AuthoredHead,scale:AngleScale=angleScale()):AuthoredHead{
  if(upstream.deformers.length)throw Error('斜向分角合并要求上游没有变形器');
  const A=renamed(up,'left-up'),B=renamed(down,'left-down'),order=(parts:{id:string}[])=>parts.map(p=>p.id).join('\n');
  if(order(A.parts)!==order(B.parts)||[...A.parts.map(p=>p.id)].sort().join('\n')!==[...upstream.parts.map(p=>p.id)].sort().join('\n'))throw Error('左上、左下须保留上游图层及相同前后顺序');
  const aDeformers=new Map(A.deformers.map(n=>[n.id,n])),bParts=new Map(B.parts.map(p=>[p.id,p]));
  const context=(id:string)=>bParts.get(id)!.parent??'';
  const contexts=new Map<string,Set<string>>();
  for(const p of A.parts)for(let a=p.parent;a;a=aDeformers.get(a)!.parent){if(!contexts.has(a))contexts.set(a,new Set());contexts.get(a)!.add(context(p.id));}
  const contextsOf=(id:string):Set<string>=>contexts.get(id)??(aDeformers.get(id)!.parent?contextsOf(aDeformers.get(id)!.parent!):new Set(['']));
  const instance=(id:string,ctx:string)=>contextsOf(id).size>1?`${id}.in.${ctx||'root'}`:id;
  const under=<T extends {id:string;parent?:string|null}>(n:T,ctx:string)=>{
    const parent=n.parent?instance(n.parent,ctx):ctx;
    if(parent)n.parent=parent;else delete n.parent;
    return n;
  };
  const deformers=[...B.deformers];
  for(const n of A.deformers)for(const ctx of contextsOf(n.id)){
    const copy=under(structuredClone(n),ctx);copy.id=instance(n.id,ctx);
    if(copy.id!==n.id)delete copy.mirror;
    deformers.push(copy);
  }
  const ids=new Map(deformers.map(n=>[n.id,n]));
  for(const n of deformers)if(n.mirror!==undefined&&ids.get(n.mirror)?.mirror!==n.id)delete n.mirror;
  const dynamic=['parent','keyforms','keyformsY','keyformsXY'],down0=cornerKeyOf('left-down',scale);
  const statics=(p:object)=>JSON.stringify(Object.entries(p).filter(([k])=>!dynamic.includes(k)).sort(([a],[b])=>a<b?-1:1));
  const parts=A.parts.map(p=>{
    const b=bParts.get(p.id)!;
    if(statics(p)!==statics(b))throw Error(`${p.id}：左上、左下的图层静态设置不同，不能合并`);
    const q=under(structuredClone(p),context(p.id));
    q.keyformsXY={...q.keyformsXY,[down0]:structuredClone(b.keyformsXY![down0])};
    return q;
  });
  const notes=[up.notes,down.notes].filter(Boolean).join('\n\n');
  const merged={...A,deformers,parts} as AuthoredHead;
  if(notes)merged.notes=notes;else delete merged.notes;
  return merged;
}
// Combine finished children into the parent's face-xy.json, verifying each
// corner side of the compiled result against that child's own compiled pose.
// The authored left side must match exactly; the right side is mirrored from
// the merged chain, which differs slightly from mirroring one child alone.
export async function mergeCorners(directory:string,angleY:string,scale:AngleScale=angleScale()):Promise<number>{
  const upstream=await readUpstream(angleY),child=(corner:Corner)=>join(directory,corner);
  const read=async(corner:Corner)=>JSON.parse(await readFile(join(child(corner),'face-xy.json'),'utf8')) as AuthoredHead;
  const merged=mergeCornerDocs(upstream.doc,await read('left-up'),await read('left-down'),scale);
  const built=await compileContinuation(directory,angleY,merged,'xy',scale),x=scale.x[0];
  for(const corner of corners){
    const own=await buildAngleXY(child(corner),angleY,scale),y=corner==='left-up'?scale.y[1]:scale.y[0];
    const parts=new Map(own.doc.parts.map(p=>[p.id,p]));
    for(const px of [x,x/2,0,-x/2,-x])for(const py of [0,y/2,y])for(const p of built.doc.parts){
      const a=evaluatePoints(built.doc,p,px,py,2),b=evaluatePoints(own.doc,parts.get(p.id)!,px,py,2);
      const tolerance=px>0?2:.02;
      if(a.length!==b.length||a.some((v,i)=>Math.abs(v-b[i])>tolerance))throw Error(`${p.id}：合并后 ${px},${py} 与 ${corner} 的结果不一致`);
    }
  }
  await writeJson(join(directory,'face-xy.json'),merged);
  await mkdir(join(directory,'frames'),{recursive:true});
  const frames:Record<string,unknown>={};
  for(const corner of corners){
    for(const name of [`${corner}.png`,`frames/${corner}.png`,`${corner}-face-trace.json`,`${corner}-fit-report.json`])await copyFile(join(child(corner),name),join(directory,name));
    frames[corner]=JSON.parse(await readFile(join(child(corner),'selected-frames.json'),'utf8')).frames[corner];
  }
  await writeJson(join(directory,'selected-frames.json'),{version:1,frames});
  return finishAngleXY(directory,angleY,scale);
}
