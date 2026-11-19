import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readStep } from '../shared/step-chain.ts';
import { isPromptRounds, type PromptRound } from '../shared/prompt-rounds.ts';
import { continuationPrefix } from '../shared/step-continuation.ts';
import { nineAxisHairRounds } from '../shared/nine-axis.ts';

export const hairRounds = nineAxisHairRounds;
export type HairRound = typeof hairRounds[number];
export type HairPromptRound = PromptRound & { id: HairRound };
export const hairRoundLabel = (round: HairRound) => ({front:'前发',side:'侧发',back:'后发',remaining:'其余头发'})[round];
export type HairProgress = { version: 2; completed: HairRound[]; next: HairRound | 'done' };
const initial = ():HairProgress => ({version:2,completed:[],next:'front'});
const progressPath = (directory:string) => join(directory,'hair-progress.json');

export function isHairPromptPlan(rounds: unknown): rounds is HairPromptRound[] {
  return isPromptRounds(rounds) && rounds[0]?.id === 'front'
    && rounds.every(round => hairRounds.some(id => id === round.id));
}

function parseProgress(value:any) {
  const plan = value?.rounds;
  if (plan !== undefined && (value.version !== 2 || !isHairPromptPlan(plan))) throw Error('头发轮次进度无效');
  const order: readonly HairRound[] = plan ? plan.map((round: HairPromptRound) => round.id) : hairRounds;
  const recorded = value?.version === 1 ? hairRounds.slice(0, 3) : order;
  if (!value || ![1, 2].includes(value.version) || !Array.isArray(value.completed)
    || !continuationPrefix(recorded.map(id => ({ id })), value.completed)
    || value.next !== (recorded[value.completed.length] ?? 'done')) throw Error('头发轮次进度无效');
  const progress: HairProgress = { version: 2, completed: value.completed, next: order[value.completed.length] ?? 'done' };
  return { progress, order, plan: plan as HairPromptRound[] | undefined };
}

export async function readHairState(directory: string) {
  try { return parseProgress(JSON.parse(await readFile(progressPath(directory), 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

export async function readHairProgress(directory: string): Promise<HairProgress> {
  return (await readHairState(directory))?.progress ?? initial();
}

async function saveProgress(directory:string,value:HairProgress, plan?: readonly HairPromptRound[]) {
  const path=progressPath(directory),temporary=path+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,JSON.stringify({ ...value, ...(plan ? { rounds: plan } : {}) },null,2)+'\n');await rename(temporary,path);
}

export async function saveHairPlan(directory: string, plan: readonly HairPromptRound[], completed: HairRound[]) {
  if (!continuationPrefix(plan, completed)) throw Error('头发轮次进度无效');
  await saveProgress(directory, { version: 2, completed, next: plan[completed.length]?.id ?? 'done' }, plan);
}

/** Extend the old three-round contract without repeating accepted work or
 * replacing its session/artwork. Marker first makes an interrupted migration
 * resumable even if the progress write did not reach disk. */
export async function upgradeHairProgress(directory:string):Promise<void> {
  let raw:any;
  try { raw=JSON.parse(await readFile(progressPath(directory),'utf8')); }
  catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error; }
  const { progress }=parseProgress(raw);
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
  const state = await readHairState(directory);
  const progress=state?.progress ?? initial();
  if(progress.next!==round)throw Error('头发轮次进度已变化，不能重复完成或跳过轮次');
  const completed=[...progress.completed,round];
  await saveProgress(directory,{version:2,completed,next:(state?.order ?? hairRounds)[completed.length] ?? 'done'},state?.plan);
}
