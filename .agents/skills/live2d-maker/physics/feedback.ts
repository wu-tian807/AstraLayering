import {copyFile,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {groupAssemblies} from '../shared/physics-core/assemblies.js';
import {reviewCriteria} from '../shared/physics-core/component-physics-schema.js';
import {runAgent,type Agent} from '../shared/raster/agent.ts';
import {saveConfig} from '../shared/raster/run-store.ts';
import {configHash} from './evidence.ts';
import {json,optional,put} from './input.ts';
import {observationScopeVersion,scopedObservations} from './review-observations.ts';

export async function rejectReview(config:any,directory:string,items:any[]){
  const session=await json(join(directory,'step03/review-session.json')),digest=configHash(config);
  if(session.configHash!==digest)throw Error('复核会话与当前草稿不一致');
  if(!Array.isArray(items)||!items.length)throw Error('返修必须记录明确的组件、准则、原因和证据窗口');
  const manifest=await optional(join(directory,'step03/evidence/manifest.json')),viewed=scopedObservations(await optional(join(directory,'step03/evidence/viewed.json'))||[],session);
  for(const item of items){
    if(!config.components.some((c:any)=>c.id===item.component&&c.enabled)||!reviewCriteria.includes(item.criterion)||!['rejected','needs-evidence'].includes(item.verdict)||!item.reason?.trim())throw Error('无效的逐组件返修项');
    const run=manifest?.runs.find((r:any)=>r.test===item.test);
    if(!Array.isArray(item.steps)||!item.steps.length||item.steps.some((s:any)=>!Number.isInteger(s)||s<0||s>(run?.durationSteps??960))||!run||manifest.configHash!==digest)throw Error('返修需引用当前规范输入和真实整数步');
    if(!Array.isArray(item.images))throw Error('images 必须为当前已查看证据路径，可在需要补证据时为空');
    for(const path of item.images)if(!viewed.some((v:any)=>v.path===path&&v.configHash===digest&&v.renderHash===manifest.renderHash&&v.test===item.test&&(!v.component||v.component===item.component)))throw Error('返修引用了未查看的当前图像');
    if(item.verdict==='rejected'&&!item.images.length&&!['response','limits'].includes(item.criterion))throw Error('视觉否决需要实际图像；缺图应使用 needs-evidence');
  }
  const roles=await optional(join(directory,'roles.json'))||{},feedback={version:1,status:'repair-requested',configHash:digest,reviewTurn:session.id,createdAt:new Date().toISOString(),items,disposition:'pending',repairRounds:roles.repairRounds||{}};
  await put(join(directory,'step03/feedback.json'),feedback);await rm(join(directory,'step03/physics.json'),{force:true});return feedback;
}

// This scheduler wrapper preserves author sessions and verifies that the
// independent reviewer did not mutate the measured author configuration.
export function roleAgent(directory:string,agent:Agent=runAgent):Agent{
  return async request=>{
    const role=request.step==='physics_analysis'?'analysis':request.step==='physics_authoring'?'authoring':'review';
    const roles=await optional(join(directory,'roles.json'))||{version:1},draft=join(directory,'step02/physics.draft.json');
    let before:string|undefined;
    if(role==='review'){
      before=await readFile(draft,'utf8');const config=JSON.parse(before),old=await optional(join(directory,'step03/review-session.json'));
      const session=old&&old.threadId&&old.threadId===request.threadId&&old.configHash===configHash(config)?old:{id:randomUUID(),configHash:configHash(config),observationScopeVersion,createdAt:new Date().toISOString(),threadId:request.threadId||null};
      await put(join(directory,'step03/review-session.json'),session);
      if(session.id!==old?.id){
        const feedback=await optional(join(directory,'step03/feedback.json'));if(feedback){await mkdir(join(directory,'step03/reviews',feedback.reviewTurn),{recursive:true});await copyFile(join(directory,'step03/feedback.json'),join(directory,'step03/reviews',feedback.reviewTurn,'feedback.json'));await rm(join(directory,'step03/feedback.json'),{force:true});}
        await rm(join(directory,'step03/physics.json'),{force:true});
      }
    }
    try{return await agent({...request,onEvent:async event=>{
      await request.onEvent(event);
      if(event.type==='thread.started'){
        const current=await json(join(directory,'run.json'));roles[role]={threadId:event.thread_id,threadHarness:current.threadHarness||'codex',at:new Date().toISOString()};await put(join(directory,'roles.json'),roles);
        if(role==='review'){const session=await json(join(directory,'step03/review-session.json'));session.threadId=event.thread_id;await put(join(directory,'step03/review-session.json'),session);}
      }
    }});}finally{
      const after=role==='review'?await readFile(draft,'utf8').catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}):undefined;
      if(role==='review'&&before!==after){
        const session=await json(join(directory,'step03/review-session.json')),folder=join(directory,'step03/reviews',session.id);await mkdir(folder,{recursive:true});if(after!==undefined)await writeFile(join(folder,'unauthorized-review-draft.json'),after);else await put(join(folder,'unauthorized-review-deletion.json'),{deleted:true});await writeFile(draft,before!);await rm(join(directory,'step03/physics.json'),{force:true});throw Error('独立复核不得改写制作草稿；已保留越权版本并恢复 B 的配置');
      }
    }
  };
}

export async function dispatchRepair(directory:string){
  const feedback=await optional(join(directory,'step03/feedback.json')),session=await optional(join(directory,'step03/review-session.json')),config=await optional(join(directory,'step02/physics.draft.json'));
  if(!feedback||!config||feedback.status!=='repair-requested'||!['pending','dispatching'].includes(feedback.disposition)||feedback.reviewTurn!==session?.id||feedback.configHash!==configHash(config))return false;
  const roles=await json(join(directory,'roles.json')),assemblies=groupAssemblies(config),affected=assemblies.filter(a=>feedback.items.some((i:any)=>a.componentIds.includes(i.component))),counts=feedback.disposition==='dispatching'?{...feedback.repairRounds}:{...(roles.repairRounds||{})};
  if(!affected.length)throw Error('返修没有对应的完整装配组');
  if(feedback.disposition==='pending')for(const group of affected){const round=counts[group.id]??1;if(round>=3)throw Error('装配组已完成三轮制作／复核：'+group.id+'；保留失败证据，停止自动返修');counts[group.id]=round+1;}
  if(!roles.authoring?.threadId)throw Error('缺少制作会话，不能把复核反馈交回 B');
  feedback.disposition='dispatching';feedback.repairRounds=counts;await put(join(directory,'step03/feedback.json'),feedback);
  const archive=join(directory,'step03/reviews',session.id);await mkdir(archive,{recursive:true});
  for(const file of ['feedback.json','findings.json','report.md','review-session.json'])if(await optionalFile(join(directory,'step03',file)))await copyFile(join(directory,'step03',file),join(archive,file));
  await copyFile(join(directory,'step02/physics.draft.json'),join(archive,'physics.draft.json'));
  roles.repairRounds=counts;await put(join(directory,'roles.json'),roles);
  await put(join(directory,'step02/repair-request.json'),feedback);
  if(await optionalFile(join(directory,'step02/.completed')))await rename(join(directory,'step02/.completed'),join(directory,'step02/.running'));
  await rm(join(directory,'step03/.running'),{force:true});await rm(join(directory,'step03/.completed'),{force:true});await rm(join(directory,'step03/physics.json'),{force:true});
  const run=await json(join(directory,'run.json'));run.threadId=roles.authoring.threadId;run.threadHarness=roles.authoring.threadHarness;run.threadStep='step02';delete run.threadHandoff;await saveConfig(directory,run);
  feedback.disposition='dispatched';feedback.dispatchedAt=new Date().toISOString();await put(join(directory,'step03/feedback.json'),feedback);await put(join(directory,'step02/repair-request.json'),feedback);
  return feedback;
}
async function optionalFile(path:string){try{await readFile(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
