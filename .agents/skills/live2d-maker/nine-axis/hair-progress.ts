import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readStep } from '../shared/step-chain.ts';

export const hairRounds = ['front','side','back','remaining'] as const;
export type HairRound = typeof hairRounds[number];
export const hairRoundLabel = (round: HairRound) => ({front:'前发',side:'侧发',back:'后发',remaining:'其余头发'})[round];
export type HairProgress = { version: 2; completed: HairRound[]; next: HairRound | 'done' };
const initial = ():HairProgress => ({version:2,completed:[],next:'front'});
const progressPath = (directory:string) => join(directory,'hair-progress.json');

function parseProgress(value:any):HairProgress {
  const rounds=value?.version===1?hairRounds.slice(0,3):hairRounds;
  if(!value || ![1,2].includes(value.version) || !Array.isArray(value.completed) || value.completed.length>rounds.length
    || value.completed.some((round:unknown,index:number)=>round!==rounds[index])
    || value.next!==[...rounds,'done'][value.completed.length]) throw Error('头发轮次进度无效');
  return {version:2,completed:value.completed,next:[...hairRounds,'done'][value.completed.length] as HairProgress['next']};
}

export async function readHairProgress(directory:string):Promise<HairProgress> {
  try { return parseProgress(JSON.parse(await readFile(progressPath(directory),'utf8'))); }
  catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return initial();throw error; }
}

async function saveProgress(directory:string,value:HairProgress) {
  const path=progressPath(directory),temporary=path+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n');await rename(temporary,path);
}

/** Extend the old three-round contract without repeating accepted work or
 * replacing its session/artwork. Marker first makes an interrupted migration
 * resumable even if the progress write did not reach disk. */
export async function upgradeHairProgress(directory:string):Promise<void> {
  let raw:any;
  try { raw=JSON.parse(await readFile(progressPath(directory),'utf8')); }
  catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error; }
  const progress=parseProgress(raw);
  const {status}=await readStep(directory);
  if(status==='unmarked'&&progress.completed.length)throw Error('已有头发轮次进度，但步骤标记缺失；不能自动清空已通过产物');
  if(raw.version!==1)return;
  if(status==='completed') {
    if(raw.next!=='done')throw Error('头发完成标记与旧轮次进度不一致');
    await rename(join(directory,'.completed'),join(directory,'.running'));
  }
  await saveProgress(directory,progress);
}

export async function completeHairRound(directory:string,round:HairRound) {
  const progress=await readHairProgress(directory);
  if(progress.next!==round)throw Error('头发轮次进度已变化，不能重复完成或跳过轮次');
  const completed=[...progress.completed,round];
  await saveProgress(directory,{version:2,completed,next:[...hairRounds,'done'][completed.length] as HairProgress['next']});
}
