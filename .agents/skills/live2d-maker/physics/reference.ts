import {readFile} from 'node:fs/promises';
import {validatePhysicsConfig} from '../shared/physics-core/component-physics-schema.js';
import {hash,put,type PhysicsInput} from './input.ts';
import {configHash} from './evidence.ts';
import {join} from 'node:path';
import {optional,json} from './input.ts';
import {simulationHash} from './evidence.ts';
import {scopedObservations} from './review-observations.ts';

export const referenceVersion='astra-physics-reference-1';
export async function readReference(input:PhysicsInput){
  if(!input.referencePhysics)return null;
  const bytes=await readFile(input.referencePhysics),config=JSON.parse(bytes.toString());validatePhysicsConfig(config);
  return {version:referenceVersion,fileHash:hash(bytes),configHash:configHash(config),config};
}
export function matchingReferenceComponents(reference:any,catalog:any){
  const layers=new Map(catalog.layers.map((l:any)=>[l.uuid,l]));
  // Identity never relies on display names, layer index, or an unverified group path.
  const matched=reference.config.components.filter((c:any)=>c.enabled&&c.layerRefs.every((r:any)=>{
    const l:any=layers.get(r.uuid);return l?.contentHash===r.contentHash&&c.sourcePartIds.includes(l.partPath);
  }));
  let closed=matched;
  for(;;){const ids=new Set(closed.map((c:any)=>c.id)),next=closed.filter((c:any)=>c.supports.every((s:any)=>!s.componentId||ids.has(s.componentId)));if(next.length===closed.length)return closed;closed=next;}
}
export function validateReferenceCoverage(plan:any,reference:any,catalog:any){
  if(!reference)return;
  for(const c of matchingReferenceComponents(reference,catalog))for(const id of c.sourcePartIds){
    if(plan.parts.find((p:any)=>p.id===id)?.decision!=='bind')throw Error('遗漏参考中同 UUID／像素已验证的活动部件：'+id+'。应复现真实支撑，不能退回整类暂缓。');
  }
}
export async function referenceSummary(input:PhysicsInput,catalog:any){
  const reference=await readReference(input);if(!reference)return {available:false};
  const matched=matchingReferenceComponents(reference,catalog);
  return {available:true,version:referenceVersion,fileHash:reference.fileHash,configHash:reference.configHash,components:matched,unmatched:reference.config.components.filter((c:any)=>c.enabled&&!matched.some((v:any)=>v.id===c.id)).map((c:any)=>c.id),purpose:'Explicit initialization and movement target; not inherited approval. Keep source geometry when UUID/pixels and real supports match; rebuild otherwise.'};
}
export async function initializeFromReference(input:PhysicsInput,catalog:any,directory:string){
  const reference=await readReference(input);if(!reference)throw Error('未提供 --reference-physics');
  const matched=matchingReferenceComponents(reference,catalog);
  if(matched.length!==reference.config.components.filter((c:any)=>c.enabled).length)throw Error('参考来源不完全匹配；请只使用已验证的组件建议并重建其余绑定');
  const config=structuredClone(reference.config);config.review={status:'draft'};
  config.components=structuredClone(matched);
  await put(join(directory,'initialization.json'),{version:1,mode:'explicit-same-source-reference',referenceVersion,fileHash:reference.fileHash,referenceConfigHash:reference.configHash,components:matched.map((c:any)=>({id:c.id,sourcePartIds:c.sourcePartIds,geometry:'same-uuid-and-pixels',parameters:'reference'})),humanAcceptanceInherited:false});
  return config;
}
export async function validateReferenceReview(input:PhysicsInput,evidence:string,findings:any){
  const reference=await readReference(input);if(!reference)return;
  const folder=join(evidence,'../reference-evidence'),manifest=await json(join(folder,'manifest.json')),viewed=scopedObservations(await optional(join(folder,'viewed.json'))||[],await optional(join(evidence,'../review-session.json')),findings);
  if(manifest.configHash!==reference.configHash||manifest.simulationHash!==await simulationHash())throw Error('参考画面已过期，需要重新比较');
  const row=findings.referenceComparison;if(row?.verdict!=='supported'||!row.reason?.trim())throw Error('需要明确比较参考版的发束、衣料与挂件自然感，不只比较合法数值');
  for(const step of [0,180,360,540])if(!viewed.some((v:any)=>v.configHash===manifest.configHash&&v.renderHash===manifest.renderHash&&v.test==='airflow'&&v.step===step&&v.mode==='color'&&!v.component))throw Error('缺少参考版微风 '+step+' 步的实际画面对比');
}
