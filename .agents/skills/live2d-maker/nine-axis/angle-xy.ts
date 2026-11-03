import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { angleKey, angleScale, type AngleScale } from './angles.ts';
import { writeBuilt, type Built } from './head.ts';
import { buildContinuation, readUpstream, startContinuation } from './continuation.ts';
export const cornerKey=(x:number,y:number)=>`${angleKey(x)},${angleKey(y)}`;
export const corners=['left-up','left-down'] as const;
export type Corner=typeof corners[number];
export const cornerAngleValues=(scale:AngleScale=angleScale())=>({left_up:cornerKey(scale.x[0],scale.y[1]),left_down:cornerKey(scale.x[0],scale.y[0])});
export async function writeLinearCorners(directory:string,angleY:string,scale:AngleScale=angleScale()) {
  const upstream=await readUpstream(angleY),doc=startContinuation(upstream.doc,upstream.hash,'xy',scale);
  await mkdir(directory,{recursive:true});const path=join(directory,'linear.json'),temporary=`${path}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(doc)+'\n');await rename(temporary,path);
}
export async function buildAngleXY(directory:string,angleY:string,scale:AngleScale=angleScale()):Promise<Built>{return buildContinuation(directory,angleY,'xy',scale);}
export async function finishAngleXY(directory:string,angleY:string,scale:AngleScale=angleScale()):Promise<number>{const built=await buildAngleXY(directory,angleY,scale);await writeBuilt(directory,built);return built.doc.parts.length;}
