import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { angleKey, angleScale, type AngleScale } from './angles.ts';
import { writeBuilt, type Built } from './head.ts';
import { buildContinuation, readUpstream, startContinuation } from './continuation.ts';
import { fileHash } from './turn.ts';
export const cornerKey=(x:number,y:number)=>`${angleKey(x)},${angleKey(y)}`;
export const corners=['left-up','left-down'] as const;
export type Corner=typeof corners[number];
export const cornerAngleValues=(scale:AngleScale=angleScale())=>({left_up:cornerKey(scale.x[0],scale.y[1]),left_down:cornerKey(scale.x[0],scale.y[0])});
// Selection belongs to the agent; completion only verifies that both fits
// still refer to its recorded video frames and traces.
export async function checkCornerReferences(directory:string,size:number) {
  const selected=JSON.parse(await readFile(join(directory,'selected-frames.json'),'utf8'));
  const videos=JSON.parse(await readFile(join(directory,'videos.json'),'utf8'));
  if(selected.version!==1||!selected.frames||typeof selected.frames!=='object')throw Error('selected-frames.json 需要 version:1 和 frames 对象');
  for(const corner of corners) {
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
