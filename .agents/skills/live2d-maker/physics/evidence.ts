// Workflow review policy uses the standalone evidence store; no frontend imports.
import { join, resolve } from 'node:path';
import { reviewCriteria } from '../shared/physics-core/component-physics-schema.js';
import { json } from './input.ts';
import { configHash, simulationHash, evidenceVersion } from '../shared/physics-evidence/store.ts';
import { recoveryProofValid } from '../shared/physics-evidence/settling.js';
import { motionReviewVersion } from '../shared/physics-evidence/physics-motion-review.js';
export { configHash, simulationHash, evidenceVersion, simulate, traceWindow, traceReplayWindow } from '../shared/physics-evidence/store.ts';
export async function validateFindings(config:any,evidence:string,findings:any,expectedSource?:string) {
  const manifest=await json(join(evidence,'manifest.json'));
  if(manifest.simulationHash!==await simulationHash())throw Error('求解器实现已改变，需要重新生成证据');
  if(manifest.version!==evidenceVersion||manifest.configHash!==configHash(config)||findings.configHash!==manifest.configHash||findings.evidenceVersion!==evidenceVersion)throw Error('复核引用了另一版配置或证据');
  if(manifest.runs.some((r:any)=>r.metrics.invalidSteps||r.metrics.maxRoot>1e-5))throw Error('数值复核失败');
  for(const run of manifest.runs){
    if(run.metrics.motionReview?.version!==motionReviewVersion)throw Error('运动复核规则已改变，需要重新测量');
    if(run.test!=='neutral')for(const c of config.components.filter((c:any)=>c.enabled))
      if(!recoveryProofValid(run.metrics.motionReview?.components?.[c.id]?.recovery,run.durationSteps))
        throw Error(c.name+' 缺少 '+run.test+' 的连续近静止及内部速度回落证明');
  }
  const failed=manifest.runs.flatMap((r:any)=>Object.entries(r.metrics.motionReview?.components||{}).filter(([,v]:any)=>v.issues.length).map(([id,v]:any)=>r.test+'/'+id+': '+v.issues.join(', ')));
  if(failed.length)throw Error('运动响应复核失败：'+failed.join('; '));
  if(manifest.coverage.render!=='completed')throw Error('渲染复核未完成');
  if(!manifest.renderDirectory||manifest.renderHash!==await(await import('./render.ts')).renderFingerprint(resolve(evidence,manifest.renderDirectory)))throw Error('渲染器、贴图或裁切关系已变化，需要重新复核');
  if(expectedSource&&resolve(evidence,manifest.renderDirectory)!==resolve(expectedSource))throw Error('可用投影输入已变化，需要重新复核');
  if(!Array.isArray(findings.components))throw Error('缺少逐组件复核');
  const viewed=await json(join(evidence,'viewed.json'));
  for(const c of config.components.filter((c:any)=>c.enabled)) {
    const row=findings.components.find((r:any)=>r.id===c.id);if(!row)throw Error('未复核组件：'+c.name);
    for(const run of manifest.runs) {
      const samples=[0,60,96,180,360,960];
      for(const step of samples)if(!viewed.some((v:any)=>v.configHash===manifest.configHash&&v.renderHash===manifest.renderHash&&v.test===run.test&&v.step===step&&(v.component===c.id||!v.component)&&v.mode==='color'))throw Error(c.name+' 缺少 '+run.test+' / '+step+' 步的实际图像复核');
      if(!viewed.some((v:any)=>v.configHash===manifest.configHash&&v.renderHash===manifest.renderHash&&v.test===run.test&&(v.component===c.id||!v.component)&&v.mode==='lit'&&v.step>60))throw Error(c.name+' 缺少 '+run.test+' 的运动光照复核');
      const event=run.events.find((e:any)=>e.component===c.id&&e.type==='fallback')||run.events.find((e:any)=>e.component===c.id&&e.type==='peak');
      if(event){const stride=event.type==='fallback'?1:2;for(const step of [Math.max(0,event.step-stride),event.step,Math.min(run.durationSteps??960,event.step+stride)])if(!viewed.some((v:any)=>v.configHash===manifest.configHash&&v.renderHash===manifest.renderHash&&v.test===run.test&&v.step===step&&(v.component===c.id||!v.component)&&v.mode==='color'))throw Error(c.name+' 缺少 '+run.test+' 的 '+event.type+' 连续帧：'+step);}
      if(run.metrics.motionReview?.components?.[c.id]?.recovery?.passed)for(const step of [Math.max(960,run.durationSteps-12),run.durationSteps])if(!viewed.some((v:any)=>v.configHash===manifest.configHash&&v.renderHash===manifest.renderHash&&v.test===run.test&&v.step===step&&(v.component===c.id||!v.component)&&v.mode==='color'))throw Error(c.name+' 缺少 '+run.test+' 的有界回落复核：'+step);
    }
    for(const mode of ['normal','depth'])if(!viewed.some((v:any)=>v.configHash===manifest.configHash&&v.renderHash===manifest.renderHash&&(v.component===c.id||!v.component)&&v.mode===mode&&v.step>60))throw Error(c.name+' 缺少运动 '+mode+' 贴图复核');
    for(const criterion of reviewCriteria) {
      const f=row.criteria?.[criterion];if(f?.verdict!=='supported'||!f.reason?.trim()||!Array.isArray(f.images)||new Set(f.images).size<2)throw Error(c.name+' 的 '+criterion+' 需要证据或修复');
      const cited=f.images.map((ref:string)=>viewed.find((v:any)=>v.path===ref&&v.configHash===manifest.configHash&&v.renderHash===manifest.renderHash&&(v.component===c.id||!v.component)));
      if(cited.some((v:any)=>!v))throw Error('未查看当前组件或整体的证据：'+c.name+' / '+criterion);
      if(['attachment','shape'].includes(criterion)&&!cited.some((v:any)=>v.component===c.id))throw Error(c.name+' 的 '+criterion+' 缺少原尺寸组件局部');
      if(['response','shape','limits'].includes(criterion)&&new Set(cited.map((v:any)=>v.step)).size<2)throw Error(c.name+' 的 '+criterion+' 缺少不同时间的画面');
    }
  }
  return manifest;
}
