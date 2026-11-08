import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { checkSelectedFrames, runFrameSelection } from './turn.ts';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { angleKey, angleScale, type AngleScale } from './angles.ts';
import { writeBuilt, type Built } from './head.ts';
import { buildContinuation, readUpstream, startContinuation } from './continuation.ts';
export const cornerKey=(x:number,y:number)=>`${angleKey(x)},${angleKey(y)}`;
export const corners=['left-up','left-down'] as const;
export type Corner=typeof corners[number];
export const cornerAngleValues=(scale:AngleScale=angleScale())=>({left_up:cornerKey(scale.x[0],scale.y[1]),left_down:cornerKey(scale.x[0],scale.y[0])});
// Frames are chosen once by an agent; delivered frames are kept as is.
export const runFrames=(directory:string,run:()=>Promise<void>)=>runFrameSelection(directory,corners,run);
// Selection belongs to the agent; completion only verifies that both fits
// still refer to its recorded video frames and traces.
export async function checkCornerReferences(directory:string,size:number) {
  await checkSelectedFrames(directory,corners,size);
  for(const corner of corners)await readFile(join(directory,`${corner}-fit-report.json`));
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
