import { parseArgs } from 'node:util';
import { join, dirname, resolve } from 'node:path';
import { copyFile, readFile, stat, rm } from 'node:fs/promises';
import { pipelineDirectory, taskDirectory } from '../shared/paths.ts';
import { acquireTaskLock } from '../workflow/state.ts';
import { runWorkflow as shared, type WorkflowOptions, type Dependencies, type KritaPipeline } from '../shared/raster/workflow.ts';
import { steps, buildPrompt } from './steps.ts';
import { fingerprint, prepareSource, prepareProjectionPreview, resolveInput, put, json, optional, ruleBaseline, type PhysicsInput } from './input.ts';
import { toolsFor, validatePlan, validateBindings, validateProfile } from './tools.ts';
import { validateFindings, configHash } from './evidence.ts';
import {physicsEnvironment} from './environment.ts';
import {validateCalibration} from './calibration.ts';
import {roleAgent,dispatchRepair} from './feedback.ts';
import {readReference,validateReferenceCoverage,validateReferenceReview} from './reference.ts';
import {resumeRuleUpdate} from './rule-recovery.ts';
export async function runWorkflow(options:WorkflowOptions&{profile?:'primary'|'all';referencePhysics?:string;resumeRules?:string},dependencies:Dependencies={}) {
  const profile=options.profile??'primary';if(!['primary','all'].includes(profile))throw Error('物理范围必须为 primary 或 all');
  const directory=pipelineDirectory(options.name,'physics',options.dir??dependencies.runsDirectory);
  if(options.resumeRules&&!options.dryRun){
    const input={...await resolveInput(options.name,options.dir??dependencies.runsDirectory!,profile),...(options.referencePhysics?{referencePhysics:resolve(options.referencePhysics)}:{})};
    const result=await resumeRuleUpdate(input,directory,await json(resolve(options.resumeRules)),async()=>{
      const catalog=await json(join(directory,'source/catalog.json')),plan=await json(join(directory,'step01/analysis.json'));
      await validatePlan(plan,catalog,profile);validateReferenceCoverage(plan,await readReference(input),catalog);
      const config=await optional(join(directory,'step02/physics.draft.json'));
      if(config){await validateBindings(config,catalog,join(directory,'source'));await validateProfile(config,plan,profile);}
    });
    options.progress?.('物理规则升级恢复：'+result.status+('archive'in result?'；原记录保留：'+result.archive:''));
  }
  const renderedSource=async()=>await optional(join(directory,'preview/catalog.json'))?join(directory,'preview'):join(directory,'source');
  if(!options.dryRun&&await stat(join(directory,'step03/.completed')).then(()=>true,()=>false)){
    const saved=await optional(join(directory,'run.json')),krita=options.krita||saved?.krita?.executable;
    if(krita)await prepareProjectionPreview(await resolveInput(options.name,options.dir??dependencies.runsDirectory!,profile),directory,krita);
    try{await validateFindings(await json(join(directory,'step03/physics.json')),join(directory,'step03/evidence'),await json(join(directory,'step03/findings.json')),await renderedSource());}
    catch(e){await rm(join(directory,'step03/.completed'),{force:true});options.progress?.('step03：现有复核需更新，保留旧证据并重新复核：'+(e as Error).message);}
  }
  const pipeline:KritaPipeline<PhysicsInput>={id:'physics',steps,resolveInput:async(name,root)=>({...await resolveInput(name,root,profile),...(options.referencePhysics?{referencePhysics:resolve(options.referencePhysics)}:{})}),validateInput:(v):v is PhysicsInput=>!!v&&typeof v==='object'&&'document'in v&&'profile'in v,inputDirectories:i=>[join(i.task,'character-assembly'),...i.structures.map(dirname)],fingerprintInput:fingerprint,buildPrompt,
    tools:toolsFor,prepareStep:async(output,input,step,krita)=>{if(step.id==='step01')await prepareSource(input,dirname(output),krita.executable);if(step.id==='step03')await prepareProjectionPreview(input,dirname(output),krita.executable);},
    validateDelivery:async(output,input,step)=>{
      const catalog=await json(join(dirname(output),'source/catalog.json'));
      if(step.id==='step01'){const plan=await json(join(output,'analysis.json'));await validatePlan(plan,catalog,profile);validateReferenceCoverage(plan,await readReference(input),catalog);}
      else if(step.id==='step02'){const config=await json(join(output,'physics.draft.json'));await validateBindings(config,catalog,join(dirname(output),'source'));await validateProfile(config,await json(join(dirname(output),'step01/analysis.json')),profile);await validateCalibration(config,output);}
      else {const config=await json(join(output,'physics.json'));await validateBindings(config,catalog,join(dirname(output),'source'));await validateProfile(config,await json(join(dirname(output),'step01/analysis.json')),profile);const findings=await json(join(output,'findings.json'));await validateFindings(config,join(output,'evidence'),findings);await validateReferenceReview(input,join(output,'evidence'),findings);if(config.review?.configHash!==configHash(config))throw Error('发布版本与复核不一致');}
    },
  };
  const environment=dependencies.environment??physicsEnvironment();
  options.progress?.('物理看图上下文：'+(environment.imageCompactThreshold?`${environment.imageCompactThreshold} 张后分段整理，保留原尺寸图像`:'未配置图片数整理；使用原尺寸拼图降低请求图片数'));
  let result:string;
  const execution={...dependencies,environment,...(!options.dryRun?{agent:roleAgent(directory,dependencies.agent)}:{})};
  if(!options.dryRun)await dispatchRepair(directory);
  // A rejection is a measured, versioned transition back to the preserved
  // author session. Ordinary exceptions and stale feedback are never retries.
  for(;;){try{result=await shared(pipeline,options,execution);break;}catch(error){
    options.signal?.throwIfAborted();if(options.dryRun)throw error;
    const feedback=await dispatchRepair(directory);if(!feedback)throw error;
    options.progress?.('独立复核已交回制作 B：'+feedback.items.map((i:any)=>i.component+' / '+i.criterion+'：'+i.reason).join('；'));
  }}
  if(options.dryRun)return result;
  const config=await json(join(directory,'step03/physics.json'));
  await validateBindings(config,await json(join(directory,'source/catalog.json')),join(directory,'source'));
  await validateProfile(config,await json(join(directory,'step01/analysis.json')),profile);
  await validateFindings(config,join(directory,'step03/evidence'),await json(join(directory,'step03/findings.json')),await renderedSource());
  await put(join(directory,'physics.json'),config);await put(join(taskDirectory(options.name,options.dir??dependencies.runsDirectory),'physics.components-cache.json'),{version:1,components:config.components});
  return result;
}
export const help='pnpm physics --name <任务名> --krita <可执行文件> [--dir <绝对运行根目录>] [--profile primary|all] [--reference-physics <认可配置路径>] [--resume-rules <旧规则基线.json>] [--dry-run]\npnpm physics --rule-baseline <保存路径.json>\n独立读取 assembled；参考配置提供明确的初始化和运动目标，必须重新模拟复核，不继承通过状态。规则升级恢复须证明所有源输入与旧指纹相同，重新标定和复核。产出 physics/physics.json 和三步记录。';
if(import.meta.main){const {values}=parseArgs({options:{name:{type:'string'},dir:{type:'string'},krita:{type:'string'},profile:{type:'string'},'reference-physics':{type:'string'},'resume-rules':{type:'string'},'rule-baseline':{type:'string'},'dry-run':{type:'boolean'},help:{type:'boolean'}}});if(values.help)console.log(help);else if(values['rule-baseline']){await put(resolve(values['rule-baseline']),await ruleBaseline());console.log('物理规则基线已保存：'+resolve(values['rule-baseline']));}else {
  if(!values.name)throw Error('需要 --name');const controller=new AbortController();for(const s of ['SIGINT','SIGTERM'])process.once(s,()=>controller.abort(Error('物理工作流中断，进度保留')));
  const release=values['dry-run']?undefined:await acquireTaskLock(taskDirectory(values.name,values.dir));try{console.log(await runWorkflow({name:values.name,dir:values.dir,krita:values.krita,profile:values.profile as any,referencePhysics:values['reference-physics'],resumeRules:values['resume-rules'],dryRun:values['dry-run'],signal:controller.signal,progress:console.log}));}finally{await release?.();}
}}
