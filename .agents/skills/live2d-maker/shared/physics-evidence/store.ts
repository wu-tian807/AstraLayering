// Deterministic recording and replay: independent of any editor or HTTP service.
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { createGzip, createGunzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { ComponentScene } from '../physics-core/component-physics-model.js';
import { applyTestInput, testNames, inputVersion } from './physics-test-input.js';
import { motionIssues, motionReviewVersion, motionStepBasis, MotionStepTracker } from './physics-motion-review.js';
import { atomicJSON } from '../artifact-files.ts';
import {recoveryBudgetSteps,recoveryState,settlingVersion} from './settling.js';
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const json=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const put=atomicJSON;
async function optional(path:string){try{return await json(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
export const evidenceVersion='astra-physics-evidence-2';
export async function simulationHash(){return hash((await Promise.all([
  readFile(new URL(import.meta.url)),
  ...['component-physics-model.js','component-physics-geometry.js','component-physics-schema.js','physics-airflow.js','vendor/psd2live/xpbd.js','vendor/psd2live/pendulum.js','vendor/inochi2d/pendulum.js'].map(n=>readFile(new URL('../physics-core/'+n,import.meta.url))),
  ...['component-physics-worker.js','physics-test-input.js','physics-motion-review.js','physics-recorded-frame.js','settling.js'].map(n=>readFile(new URL(n,import.meta.url)))
])).map(hash).join(':'));}
export const configHash=(config:any)=>{const {review,...body}=config;return hash(JSON.stringify(body));};
export async function simulate(config:any, output:string,signal?:AbortSignal) {
  const digest=configHash(config),runtimeHash=await simulationHash(),runs:any[]=[];
  const prior=await optional(join(output,'manifest.json'));
  if(prior?.configHash===digest&&prior.version===evidenceVersion&&prior.simulationHash===runtimeHash)return prior;
  const partial=await readdir(output).then(files=>files.length>0,(e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return false;throw e;});
  if(prior||partial){const backups=join(dirname(output),'backups');await mkdir(backups,{recursive:true});await rename(output,join(backups,'evidence-'+randomUUID()));}
  await mkdir(output,{recursive:true});
  await (await import('node:fs/promises')).rm(join(output,'failure.json'),{force:true});
  for(const test of testNames) {
    const scene=new ComponentScene(config),directory=join(output,test);await mkdir(directory,{recursive:true});
    const frames:number[]=[0],events:any[]=[],previousStats=new Map(),curvePoints=new Map<string,number[][]>(),metrics:any={invalidSteps:0,fallbackSteps:0,limitedSteps:0,maxRoot:0,maxTravel:0,minArea:1,notSettled:[],simulationMs:0};
    const motionMetrics:any={};const stepTrackers=new Map<string,InstanceType<typeof MotionStepTracker>>();
    const peaks=new Map<string,{step:number;travel:number}>();const signs=new Map<string,number>();
    const started=performance.now();
    const recovery=new Map<string,any>(),budgetSteps=recoveryBudgetSteps(config);let durationSteps=960;
    async function* records(){for(let step=0;step<=960+budgetSteps;step++) {
      signal?.throwIfAborted();
      if(step) {applyTestInput(scene,test,step);try{scene.step();}catch(e){await put(join(output,'failure.json'),{test,step,time:step/120,reason:(e as Error).message,configHash:digest,simulationHash:runtimeHash,components:Object.fromEntries([...scene.bodies].map(([id,b])=>[id,{stats:b.stats,controls:b.inspect(true),positions:Array.from(b.positions),pose:Array.from(b.pose),velocity:Array.from(b.velocity)}]))});throw e;}}
      const components:any={};
      for(const [id,b]of scene.bodies) {
        const m=motionMetrics[id]||=( {peak:0,root:0,fallback:0,limited:0,maxStep:0,maxWorldStep:0,final:0,invalid:0} );
        if(step<=960){m.peak=Math.max(m.peak,b.stats.travel);m.fallback+=+b.stats.fallback;m.limited+=+b.stats.limited;m.final=b.stats.travel;}
        m.root=Math.max(m.root,b.stats.root);m.invalid+=+!b.stats.valid;
        let tracker=stepTrackers.get(id);if(!tracker){tracker=new MotionStepTracker(config.source.canvas,b.positions.length,b.maxDistance);stepTrackers.set(id,tracker);}
        tracker.update(b.positions,scene.sourcePose,b.stats.fallback);m.maxStep=tracker.maxStep;m.maxWorldStep=tracker.maxWorldStep;m.maxAcceleration=tracker.maxAcceleration;m.discontinuityRatio=tracker.discontinuityRatio;m.maxFallbackStreak=tracker.maxFallbackStreak;if(step<=960)m.visiblePeak=tracker.visiblePeak;
        if(step===960&&test!=='neutral')recovery.set(id,{quietSteps:0,fallbackSteps:0});
        if(step>=960&&recovery.has(id)){const r=recovery.get(id),state=recoveryState(b,m.visiblePeak,tracker.visibleTravel);r.quietSteps=state.quiet?r.quietSteps+1:0;if(step>960)r.fallbackSteps+=+b.stats.fallback;r.final=state.travel;r.internalSpeed=state.internalSpeed;r.tolerance=state.tolerance;}
        const stats=b.stats,residual=Array.from(b.positions,(v:any,i:number)=>v-b.pose[i]);
        let tip=0;for(let i=1;i<b.weights.length;i++)if(b.weights[i]>b.weights[tip]||b.weights[i]===b.weights[tip]&&Math.hypot(b.rest[i*2]-b.component.supports[0].at[0],b.rest[i*2+1]-b.component.supports[0].at[1])>Math.hypot(b.rest[tip*2]-b.component.supports[0].at[0],b.rest[tip*2+1]-b.component.supports[0].at[1]))tip=i;
        const sign=Math.sign(residual[tip*2]);if(sign&&signs.get(id)&&signs.get(id)!==sign&&stats.travel>.1)events.push({type:'reversal',component:id,step});if(sign)signs.set(id,sign);
        if(stats.limited&&!previousStats.get(id)?.limited)events.push({type:'limit',component:id,step});
        if(stats.fallback&&!previousStats.get(id)?.fallback)events.push({type:'fallback',component:id,step});previousStats.set(id,stats);
        if(!peaks.has(id)||stats.travel>peaks.get(id)!.travel)peaks.set(id,{step,travel:stats.travel});
        metrics.invalidSteps+=!stats.valid;metrics.fallbackSteps+=!!stats.fallback;metrics.limitedSteps+=!!stats.limited;metrics.maxRoot=Math.max(metrics.maxRoot,stats.root);metrics.maxTravel=Math.max(metrics.maxTravel,stats.travel);metrics.minArea=Math.min(metrics.minArea,stats.minArea);
        components[id]={stats,pose:Array.from(b.pose),positions:Array.from(b.positions),velocity:Array.from(b.velocity),residual,supports:b.component.supports.map((s:any)=>scene.support(s)),tip:residual.slice(tip*2,tip*2+2)};
        if(step%4===0){if(!curvePoints.has(id))curvePoints.set(id,[]);curvePoints.get(id)!.push([step/120,residual[tip*2]]);}
        if(step===960&&stats.travel>.1)metrics.notSettled.push(id);
      }
      yield JSON.stringify({step,time:step/120,sourcePose:scene.sourcePose,airflow:scene.airflow,components})+'\n';if(step&&step%12===0)frames.push(step);
      durationSteps=step;
      if(step>=960&&(!recovery.size||step>960&&[...recovery.values()].every(r=>r.quietSteps>=60)))break;
    }}
    await pipeline(Readable.from(records()),createGzip({level:1}),createWriteStream(join(directory,'trace.jsonl.gz')),{signal});
    for(const [id,r]of recovery)motionMetrics[id].recovery={version:settlingVersion,startStep:960,endStep:durationSteps,budgetSteps,...r,passed:r.quietSteps>=60&&!r.fallbackSteps};
    metrics.initiallyNotSettled=[...metrics.notSettled];metrics.notSettled=metrics.notSettled.filter((id:string)=>motionMetrics[id].recovery?.passed!==true);
    metrics.simulationMs=performance.now()-started;
    metrics.motionReview={version:motionReviewVersion,stepBasis:motionStepBasis,components:Object.fromEntries([...scene.bodies].map(([id,b])=>[id,{...motionMetrics[id],issues:motionIssues(test,b.component,motionMetrics[id])}]))};
    for(const[id,peak]of peaks)if(peak.travel>.1)events.push({type:'peak',component:id,...peak});
    // The first sequence is uniform. Dense windows supplement it; they never
    // replace uninteresting frames or interpolate unrecorded peak positions.
    const dense=new Set([...frames,durationSteps]);for(const event of events)for(let step=Math.max(0,event.step-12);step<=Math.min(durationSteps,event.step+12);step+=event.type==='limit'?1:2)dense.add(step);
    const frameSteps=[...dense].sort((a,b)=>a-b);
    await put(join(directory,'metrics.json'),metrics);await put(join(directory,'events.json'),events);
    const curves=[...scene.bodies.keys()].map(id=>({id,points:curvePoints.get(id)!}));
    const max=Math.max(1,...curves.flatMap(c=>c.points.map(p=>Math.abs(p[1]))));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="320" viewBox="0 0 960 320"><rect width="960" height="320" fill="#131c28"/><path d="M30 160H940" stroke="#64748b"/>${curves.map((c,i)=>`<polyline fill="none" stroke="hsl(${i*67%360} 80% 70%)" stroke-width="2" points="${c.points.map(p=>`${30+p[0]/(durationSteps/120)*900},${160-p[1]/max*130}`).join(' ')}"/>`).join('')}</svg>`;
    await writeFile(join(directory,'curves.svg'),svg);
    runs.push({test,durationSteps,frameSteps,metrics,events,curves,trace:test+'/trace.jsonl.gz',plot:test+'/curves.svg'});
  }
  const manifest={version:evidenceVersion,solver:config.solver,inputVersion,configHash:digest,simulationHash:runtimeHash,stepHz:120,steps:960,baselineRenderHz:10,diagnosticRenderHz:60,createdAt:new Date().toISOString(),runs,coverage:{numerical:'all-steps-all-meshes',render:'pending',aiVisual:'unreviewed',human:'unreviewed'}};
  await put(join(output,'manifest.json'),manifest);return manifest;
}
export async function traceWindow(evidence:string,test:string,steps:number[],maxSteps=60) {
  return (await readTraceWindow(evidence,test,steps,maxSteps,false)).rows;
}
// Replay the recorded command, rather than re-evaluating its transcendental
// waveform in another JS engine. Outputs remain independently simulated and
// checked against every recorded mesh vertex at the original tolerance.
export async function traceReplayWindow(evidence:string,test:string,steps:number[],maxSteps=600) {
  return readTraceWindow(evidence,test,steps,maxSteps,true);
}
async function readTraceWindow(evidence:string,test:string,steps:number[],maxSteps:number,collectInputs:boolean) {
  const manifest=await json(join(evidence,'manifest.json')),maximum=manifest.runs.find((r:any)=>r.test===test)?.durationSteps??960;
  if(!testNames.includes(test)||!Array.isArray(steps)||steps.some(n=>!Number.isInteger(n)||n<0||n>maximum)||steps.length>maxSteps)throw Error('无效时间窗');
  if(!steps.length)return {rows:[],inputs:[]};const wanted=new Set(steps),result=new Map(),inputs:any[]=[],input=createReadStream(join(evidence,test,'trace.jsonl.gz')),gzip=createGunzip();input.pipe(gzip);
  const rows=createInterface({input:gzip,crlfDelay:Infinity});let step=0;
  try{for await(const line of rows){
    if(collectInputs){
      // Commands precede the potentially large mesh payload. Keep the prefix
      // only; decoding every full mesh would make a 960-step replay expensive.
      const end=line.indexOf(',"components":');if(end<0)throw Error('轨迹缺少组件数据');
      const row=JSON.parse(line.slice(0,end)+'}');
      if(row.step!==step||!row.sourcePose||!row.airflow||!['x','y','angle'].every(k=>Number.isFinite(row.sourcePose[k]))||!['x','y'].every(k=>Number.isFinite(row.airflow[k])))throw Error('轨迹缺少有效的逐步输入，请重新模拟');
      inputs.push({sourcePose:row.sourcePose,airflow:row.airflow});
    }
    if(wanted.has(step))result.set(step,JSON.parse(line));if(++step>Math.max(...steps))break;
  }if(result.size!==wanted.size)throw Error('轨迹不完整');return {rows:steps.map(n=>result.get(n)),inputs};}
  finally{rows.close();input.destroy();gzip.destroy();}
}
