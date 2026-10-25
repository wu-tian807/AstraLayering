import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import sharp from 'sharp';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { textResult } from '../shared/codex/function-tools.ts';
import { validatePhysicsConfig, componentDefaults } from '../shared/physics-core/component-physics-schema.js';
import { ComponentScene } from '../shared/physics-core/component-physics-model.js';
import { meshCoverage } from '../shared/physics-core/component-physics-geometry.js';
import { groupAssemblies } from '../shared/physics-core/assemblies.js';
import {calibrate,selectCandidate,recipes} from './calibration.ts';
import {rejectReview} from './feedback.ts';
import type {StepDefinition} from '../shared/raster/steps.ts';
import { simulate, validateFindings, configHash, simulationHash, traceWindow } from './evidence.ts';
import { renderFrames } from './render.ts';
import { json, optional, put, hash, type PhysicsInput } from './input.ts';
import { validateMotionScope, coverageReport } from './coverage.ts';
import {imageSheet} from './images.ts';
import {referenceSummary,readReference,initializeFromReference,validateReferenceCoverage,validateReferenceReview} from './reference.ts';
import {initializeConfigParameters,motionPresets,motionPresetVersion} from '../shared/physics-core/motion-presets.js';
import { summarizeEvidence } from './evidence-summary.ts';

export function summarizeAssemblyTuning(config:any,tuning:any,assemblyId?:string,runtimeHash=tuning?.solverHash){
  const assemblies=groupAssemblies(config).filter(g=>!assemblyId||g.id===assemblyId);
  if(assemblyId&&!assemblies.length)throw Error('装配组不存在：'+assemblyId);
  const scalars=(value:any)=>Object.fromEntries(Object.entries(value||{}).filter(([,v])=>typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)));
  const groups=assemblies.map(assembly=>{
    const record=tuning?.groups.find((g:any)=>g.assemblyId===assembly.id),round=record?.rounds.at(-1),current=round?.selectedCandidate&&round.solverHash===runtimeHash&&assembly.componentIds.every(id=>round.selectedComponents?.[id]===hash(JSON.stringify(config.components.find((c:any)=>c.id===id))));
    const candidates=(round?.candidates||[]).map((c:any)=>({id:c.id,eligible:c.eligible,score:c.score,issues:c.issues,
      ...(assemblyId?{changes:(c.changes||[]).map(({component,group,key,from,to}:any)=>({component,group,key,from,to})),metrics:Object.fromEntries(Object.entries(c.metrics||{}).map(([test,components]:any)=>[test,Object.fromEntries(Object.entries(components).map(([id,m]:any)=>[id,{...scalars(m),...(m.target?{target:{...scalars(m.target),ratios:scalars(m.target.ratios)}}:{}),...(m.recovery?{recovery:scalars(m.recovery)}:{})}]))]))}:{}),
    }));
    return {assemblyId:assembly.id,componentIds:assembly.componentIds,status:!round?'unmeasured':!round.selectedCandidate?'needs-selection':current?'selected':'stale',round:round?.round,roundCount:record?.rounds.length||0,historyCount:record?.history?.length||0,historyRoundCount:(record?.history||[]).reduce((n:number,h:any)=>n+(h.rounds?.length||0),0),selectedCandidate:round?.selectedCandidate,selectionReason:round?.selectionReason,recommendedCandidate:round?.recommendedCandidate,candidates};
  });
  return {groups:assemblies,tuning:{version:tuning?.version,status:!tuning?'missing':tuning.configHash===configHash(config)&&tuning.solverHash===runtimeHash?tuning.status:'stale',configHash:tuning?.configHash,solverHash:tuning?.solverHash,groups},details:'step02/tuning.json'};
}

export async function validateBindings(config:any,catalog:any,source?:string) {
  validatePhysicsConfig(config);const scene=new ComponentScene(config);
  if(config.source.canvas.width!==catalog.canvas.width||config.source.canvas.height!==catalog.canvas.height)throw Error('物理画布与原稿不一致');
  for(const c of config.components) for(const ref of c.layerRefs) {
    const layer=catalog.layers.find((l:any)=>l.uuid===ref.uuid);
    if(!layer||layer.contentHash!==ref.contentHash)throw Error('组件源 UUID 或像素指纹不一致：'+c.name);
  }
  if(source)for(const c of config.components.filter((c:any)=>c.enabled))for(const ref of c.layerRefs){const l=catalog.layers.find((l:any)=>l.uuid===ref.uuid),b=scene.bodies.get(c.id),raw=await sharp(join(source,l.original)).ensureAlpha().raw().toBuffer(),coverage=meshCoverage(b.rest,b.indices,l.bounds,raw);if(coverage.missing>2)throw Error(c.name+' 网格裁掉 '+coverage.missing+' 个原像素；扩大完整轮廓或横截面，例 '+JSON.stringify(coverage.examples));}
  return scene;
}
export async function validatePlan(plan:any,catalog:any,profile='all') {
  if(!Array.isArray(plan.parts)||!Array.isArray(plan.components))throw Error('物理分析结构无效');
  validateMotionScope(plan,profile);
  const sourceIds=new Set(catalog.parts.map((p:any)=>p.id)),ids=new Set();
  if(plan.parts.length!==sourceIds.size||plan.parts.some((p:any)=>!sourceIds.has(p.id)))throw Error('分析需与实际源 part 一一对应');
  for(const part of catalog.parts) {
    const decisions=plan.parts.filter((p:any)=>p.id===part.id);
    if(decisions.length!==1||!['bind','defer','excluded'].includes(decisions[0].decision)||!decisions[0].reason?.trim())throw Error('每个源 part 必须有唯一判断与原因：'+part.id);
    if(decisions[0].decision==='bind'&&!plan.components.some((c:any)=>c.sourcePartIds?.includes(part.id)))throw Error('选择制作的 part 未归属组件：'+part.id);
  }
  for(const c of plan.components) {
    if(!c.id||!c.name||!['strand','cloth','pendant'].includes(c.kind)||!['primary','secondary'].includes(c.priority)||!c.connection?.trim()||!c.layerUuids?.length)throw Error('组件必须说明形态与实际连接');
    if(ids.has(c.id))throw Error('组件 ID 重复');ids.add(c.id);
    if(!c.sourcePartIds?.length||c.sourcePartIds.some((id:string)=>plan.parts.find((p:any)=>p.id===id)?.decision!=='bind'))throw Error('组件只能关联已选择的原 part');
    for(const id of c.layerUuids)if(!catalog.layers.some((l:any)=>l.uuid===id))throw Error('组件源层不存在：'+id);
    const expected=catalog.layers.filter((l:any)=>c.sourcePartIds.includes(l.partPath));
    if(expected.length&&(expected.length!==c.layerUuids.length||expected.some((l:any)=>!c.layerUuids.includes(l.uuid))))throw Error('选定 part 与实际图层来源不一致：'+c.name);
  }
  for(const p of plan.parts.filter((p:any)=>p.decision==='bind'))if(plan.components.filter((c:any)=>c.sourcePartIds.includes(p.id)).length!==1)throw Error('每个选定 part 必须有唯一组件场：'+p.id);
}
export async function validateProfile(config:any,plan:any,profile:string){
  validateMotionScope(plan,profile);
  for(const c of plan.components.filter((c:any)=>profile==='all'||c.priority==='primary')){
    const binding=config.components.find((v:any)=>v.id===c.id&&v.enabled);
    if(!binding)throw Error('漏做已选择组件：'+c.name);
    if(c.sourcePartIds.length!==binding.sourcePartIds.length||c.sourcePartIds.some((id:string)=>!binding.sourcePartIds.includes(id))||c.layerUuids.length!==binding.layerRefs.length||c.layerUuids.some((id:string)=>!binding.layerRefs.some((r:any)=>r.uuid===id)))throw Error('绑定与选定原层不一致：'+c.name);
  }
}
export function validatePreservedComponents(config:any,catalog:any,cache:any){
  for(const old of cache?.components||[]){if(!old.layerRefs.every((r:any)=>catalog.layers.some((l:any)=>l.uuid===r.uuid&&l.contentHash===r.contentHash)))continue;const next=config.components.find((c:any)=>c.id===old.id);if(!next||old.enabled&&!next.enabled&&!next.disabledReason?.trim())throw Error('保留已制作组件，或明确关闭并记录 disabledReason：'+old.name);}
}
export function toolsFor(output:string,input:PhysicsInput,step?:Pick<StepDefinition,'id'>,_phase?:string):FunctionTool[] {
  const pipeline=dirname(output),source=join(pipeline,'source'),evidence=join(pipeline,'step03/evidence');
  const tool=(name:string,description:string,properties:any,execute:any):FunctionTool=>({name,description,inputSchema:{type:'object',properties,additionalProperties:false},execute:async(args:any,signal)=>{signal.throwIfAborted();try{return await execute(args,signal);}catch(e){return {success:false,contentItems:[{type:'inputText',text:(e as Error).message}]};}}});
  const str={type:'string'},arr={type:'array',items:str};
  const getConfig=()=>json(join(pipeline,'step02/physics.draft.json'));
  const renderSource=async()=>await optional(join(pipeline,'preview/catalog.json'))?join(pipeline,'preview'):source;
  const saveBinding=async(config:any,partial=false)=>{
    config={...config,kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',review:{status:'draft'}};
    const catalog=await json(join(source,'catalog.json'));await validateBindings(config,catalog,source);
    const plan=await json(join(pipeline,'step01/analysis.json'));
    // Seed matched reference geometry before authoring newly selected parts.
    // Full save and stage completion still require every selected component.
    if(partial) {
      await validateProfile(config,{...plan,components:plan.components.filter((c:any)=>config.components.some((v:any)=>v.id===c.id))},input.profile);
      if(config.components.some((c:any)=>!plan.components.some((v:any)=>v.id===c.id)))throw Error('参考初始化含分析未选择的组件');
    } else await validateProfile(config,plan,input.profile);
    validateReferenceCoverage(plan,await readReference(input),catalog);
    validatePreservedComponents(config,catalog,await optional(join(input.task,'physics.components-cache.json')));
    const groups=groupAssemblies(config);await put(join(pipeline,'step02/physics.draft.json'),config);await put(join(pipeline,'step02/assemblies.json'),{version:1,configHash:configHash(config),groups});await put(join(pipeline,'step02/coverage.json'),coverageReport(plan,config));
    return {saved:true,configHash:configHash(config),components:config.components.length,assemblies:groups};
  };
  const tools=[
    tool('physics_catalog','默认读取源层/UUID/指纹/原尺寸及简明分组索引。partIds 指定原 part 后返回这些部件及父组的完整连接和造型说明；先索引再按部位查询，不一次灌入所有长说明。无需生图。',{partIds:arr},async({partIds}:any)=>{
      const catalog=await json(join(source,'catalog.json')),structures=await Promise.all(input.structures.map(json)),descriptions=new Map<string,any>();
      const indexed=structures.map((s:any,i:number)=>{
        const walk=(nodes:any[],parents:any[]=[]):any[]=>nodes.map(n=>{const {groups,...fields}=n,id=(i?'clothing:':'character:')+n.id;
          if(groups?.length)return {id,name:n.name??n.label??n.id,groups:walk(groups,[...parents,fields])};
          descriptions.set(id,{part:fields,parents});return {id,name:n.name??n.label??n.id};
        });return walk(s.groups);
      });
      if(partIds?.some((id:string)=>!descriptions.has(id)))throw Error('未知源 part，先读取索引');
      return textResult({...catalog,...(partIds?.length?{descriptions:partIds.map((id:string)=>({id,...descriptions.get(id)}))}:{structures:indexed}),defaults:{strand:componentDefaults('strand'),cloth:componentDefaults('cloth'),pendant:componentDefaults('pendant')},profile:input.profile,reuse:await optional(join(input.task,'physics.components-cache.json'))});
    }),
    tool('physics_source_image','查看原尺寸源层。uuids 一次 1–16 层，返回单张无缩放拼图及编号/原 bounds；uuid 单层；空参数为整体。优先分部位批量看图，避免累计超过服务图片上限。',{uuid:str,uuids:arr},async({uuid,uuids}:any)=>{
      const catalog=await json(join(source,'catalog.json'));if(uuid&&uuids)throw Error('uuid 与 uuids 二选一');
      const ids=uuids||[uuid];if(!ids.length||ids.length>16)throw Error('一次查看 1–16 层');
      const layers=ids.map((id:string)=>{const l=id&&catalog.layers.find((l:any)=>l.uuid===id);if(id&&!l)throw Error('源层不存在');return l;});
      const items=await Promise.all(layers.map(async(l:any)=>({label:l?.partPath||'character',bytes:await readFile(join(source,l?l.original:'color.png'))})));
      const sheet=await imageSheet(items);return {success:true,contentItems:[{type:'inputText',text:JSON.stringify({sourcePixelScale:1,tiles:sheet.tiles,layers:layers.map((l:any)=>l||catalog.canvas)})},{type:'inputImage',imageUrl:'data:image/png;base64,'+sheet.image.toString('base64')}]};
    }),
    tool('physics_reference','读取显式认可参考的完整绑定／参数与匹配来源。匹配以 UUID 和像素为准，可作为同源初始化；不继承审核通过。无参考时返回 unavailable。',{},async()=>textResult(await referenceSummary(input,await json(join(source,'catalog.json'))))),
    tool('physics_save_plan','保存 version:2 分析。parts 每项 id/decision/reason/motion:{family(hair|fabric|accessory|other),region,freedom(free|fixed|follow|uncertain)}；defer 另需 deferCode。components 每项 id/name/kind/priority/sourcePartIds/layerUuids/connection。按实际自由段判断，固定发盖排除，头发和挂件不能整类跳过。',{plan:{type:'object'}},async({plan}:any)=>{const catalog=await json(join(source,'catalog.json'));await validatePlan(plan,catalog,input.profile);validateReferenceCoverage(plan,await readReference(input),catalog);await put(join(pipeline,'step01/analysis.json'),plan);const coverage=coverageReport(plan);await put(join(pipeline,'step01/coverage.json'),coverage);return textResult({saved:true,coverage});}),
    tool('physics_save_binding','保存完整组件配置。结构见 skill physics/guide.md，source.canvas、components；每项有 supports、authoring、response、material、limits。不接受仅按图层包围盒摆动。',{config:{type:'object'}},async({config}:any)=>{
      return textResult(await saveBinding(config));
    }),
    tool('physics_initialize_reference','从同源认可参考初始化绑定草稿。逐 UUID／像素核对；保留固定区、自由段、原图、最大约束和参数。新增分析组件可随后补齐；完整保存及完成阶段仍要求全部组件。不是无参考从零制作，不继承审核。',{},async()=>{const config=await initializeFromReference(input,await json(join(source,'catalog.json')),join(pipeline,'step02'));return textResult(await saveBinding(config,true));}),
    tool('physics_initialize_parameters','对已制作几何应用通用运动配方。presets 指定组件 ID 到配方 ID 时只初始化这些组件；省略时初始化全部。保持来源、固定区和最大约束，不决定图层范围。',{presets:{type:'object'}},async({presets}:any)=>{const config=initializeConfigParameters(await getConfig(),presets);const result=await saveBinding(config);const previous=await optional(join(pipeline,'step02/initialization.json'));await put(join(pipeline,'step02/initialization.json'),{...previous,version:1,mode:previous?.mode==='explicit-same-source-reference'?'reference-and-geometry-presets':'geometry-aware-presets',motionPresetVersion,initializedComponentIds:presets?Object.keys(presets):config.components.map((c:any)=>c.id),humanAcceptanceInherited:false});return textResult(result);}),
    tool('physics_assemblies','默认读取有向装配连接与当前标定摘要，不返回历史轮次或完整曲线。assemblyId 定位一组后提供当前候选参数差异和标量指标；精确轨迹用 physics_trace，完整曲线留在 step02/tuning.json。候选按完整装配模拟。',{assemblyId:str},async({assemblyId}:any)=>textResult(summarizeAssemblyTuning(await getConfig(),await optional(join(pipeline,'step02/tuning.json')),assemblyId,await simulationHash()))),
    tool('physics_recipes','读取经认可案例归纳的长度相关运动起点；真实根部／活动范围和最大约束必须按原图制作。',{},async()=>textResult({motionPresetVersion,presets:motionPresets,legacyRecipes:recipes})),
    tool('physics_repair_request','读取独立 reviewer 的返修原因、整数步窗口和当前完整装配组轮次；不得伪造复核通过。',{},async()=>textResult(await optional(join(pipeline,'step02/repair-request.json'))||{pending:false})),
    tool('physics_calibrate','对完整装配组保留基线与最多三个 response/material 候选，运行一致的微风、轻扫和支撑释放。有认可参考时同时约束幅度和持续活动，弱响应／长期回退不能被选择。每组最多三轮，不放宽限幅。',{assemblyId:str,reason:str,candidates:{type:'array',items:{type:'object'},maxItems:3}},async({assemblyId,reason,candidates}:any,signal:AbortSignal)=>textResult(await calibrate(await getConfig(),join(pipeline,'step02'),assemblyId,reason,candidates,signal,(await readReference(input))?.config))),
    tool('physics_autotune','程序先复测当前完整装配的原参数，数值与参考运动目标合格即保留；同指纹已选参数复用已有测量。仅失败组搜索最多三个候选，有参考时保持 80%–130% 幅度及活动量。求解器变化重新测原参数，不重置来源、几何或限幅；仍失败则保留并返回模型修正。不授予视觉通过，之后仍需模拟看图。',{reason:str},async({reason}:any,signal:AbortSignal)=>{let config=await getConfig();const results:any[]=[];const reference=(await readReference(input))?.config;for(const group of groupAssemblies(config).filter(g=>g.enabledComponentIds.length)){signal.throwIfAborted();const result=await calibrate(config,join(pipeline,'step02'),group.id,reason,undefined,signal,reference,{preserveEligibleBaseline:true});const best=result.selection??result.round.recommendedCandidate;if(best)config=await selectCandidate(config,join(pipeline,'step02'),group.id,best,result.baselinePreserved?'程序保留当前数值与运动目标均合格的参数；等待独立视觉复核':'程序仅修正失败装配，按数值安全与运动目标选择；等待独立视觉复核');results.push({assemblyId:group.id,selected:best,baselinePreserved:!!result.baselinePreserved,reused:result.reused,candidates:result.round.candidates.map((c:any)=>({id:c.id,eligible:c.eligible,score:c.score,issues:c.issues}))});}return textResult({status:results.every(r=>r.selected)?'calibrated':'needs-repair',groups:results});}),
    tool('physics_select_candidate','根据完整装配的响应曲线和实际图像，明确选择标定候选；记录理由并保存草稿。只更新当前装配组，其他组保持原配置。',{assemblyId:str,candidateId:str,reason:str},async({assemblyId,candidateId,reason}:any)=>{const config=await selectCandidate(await getConfig(),join(pipeline,'step02'),assemblyId,candidateId,reason);return textResult({saved:true,configHash:configHash(config)});}),
    tool('physics_simulate','运行 9 组规范输入，每步保存完整网格、姿态残差与约束。改参数后必须重新运行。',{render:{type:'boolean'}},async({render}:any,signal:AbortSignal)=>{
      const config=await getConfig(),manifest=await simulate(config,evidence,signal);
      if(render!==false)await renderFrames(config,await renderSource(),evidence,manifest.runs.map((r:any)=>({test:r.test,steps:[...new Set([...Array.from({length:81},(_,i)=>i*12),...(r.durationSteps>960?[r.durationSteps-12,r.durationSteps]:[])])],modes:['color','lit'],cropSteps:[0,60,96,180,360,960]})),signal);
      return textResult(summarizeEvidence(await json(join(evidence,'manifest.json'))));
    }),
    tool('physics_frames','精确重放整数步并输出原尺寸固定取景帧。事件窗用间隔 2 步（60 Hz），疑似顿挫用 1 步；component 可仅截指定局部，完整索引分页读取。',{test:str,component:str,steps:{type:'array',items:{type:'integer'}},modes:arr},async({test,component,steps,modes}:any,signal:AbortSignal)=>{const frames=await renderFrames(await getConfig(),await renderSource(),evidence,[{test,steps,modes:modes||['color','lit','normal','depth'],components:component?[component]:undefined}],signal);return textResult({images:frames.slice(0,24),total:frames.length,index:'physics_evidence_index'});}),
    tool('physics_view','读取 evidence 图片（最多 8 张），返回一张原像素拼图并记录每帧版本。按编号逐帧看，不缩放原图；先均匀序列，再事件窗与原尺寸接缝。',{paths:arr},async({paths}:any)=>{
      if(!Array.isArray(paths)||!paths.length||paths.length>8)throw Error('一次查看 1–8 张');
      const manifest=await json(join(evidence,'manifest.json')),frames=await json(join(evidence,'frames.json')),viewed=await optional(join(evidence,'viewed.json'))||[],items:any[]=[],chosen:any[]=[];
      for(const path of paths){const f=frames.find((f:any)=>f.path===path&&f.configHash===manifest.configHash);if(!f)throw Error('图片未在当前证据索引中');const bytes=await readFile(join(evidence,path));items.push({label:path,bytes});chosen.push({...f,path,configHash:manifest.configHash,imageHash:hash(bytes)});}
      if(step?.id==='step03'){const session=await json(join(pipeline,'step03/review-session.json'));for(const frame of chosen)frame.reviewSession=session.id;}
      const sheet=await imageSheet(items);await put(join(evidence,'viewed.json'),[...viewed,...chosen]);return {success:true,contentItems:[{type:'inputText',text:JSON.stringify({sourcePixelScale:1,tiles:sheet.tiles,frames:chosen})},{type:'inputImage',imageUrl:'data:image/png;base64,'+sheet.image.toString('base64')}]};
    }),
    tool('physics_reference_view','用同一规范输入与渲染器查看显式参考（1–8 帧），重新模拟，保存独立来源记录。参考不是通过结论；C 须与当前版的微风 0/180/360/540 步对照自然感。',{test:str,steps:{type:'array',items:{type:'integer'},maxItems:8},component:str,mode:str},async({test,steps,component,mode='color'}:any,signal:AbortSignal)=>{
      if(!Array.isArray(steps)||!steps.length||steps.length>8)throw Error('一批 1–8 张参考帧');
      const reference=await readReference(input);if(!reference)throw Error('未配置显式参考');
      const folder=join(pipeline,'step03/reference-evidence');await simulate(reference.config,folder,signal);
      const rendered=await renderFrames(reference.config,await renderSource(),folder,[{test,steps,modes:[mode],components:component?[component]:undefined}],signal);
      const chosen=rendered.filter((f:any)=>f.test===test&&steps.includes(f.step)&&f.mode===mode&&(component?f.component===component:!f.component));
      const items=await Promise.all(chosen.map(async(f:any)=>{const bytes=await readFile(join(folder,f.path));return {label:'reference / '+f.path,bytes};})),sheet=await imageSheet(items);
      if(step?.id==='step03'){const session=await json(join(pipeline,'step03/review-session.json'));for(const frame of chosen)frame.reviewSession=session.id;}
      const viewed=await optional(join(folder,'viewed.json'))||[];await put(join(folder,'viewed.json'),[...viewed,...chosen]);
      return {success:true,contentItems:[{type:'inputText',text:JSON.stringify({reference:true,sourcePixelScale:1,tiles:sheet.tiles,frames:chosen})},{type:'inputImage',imageUrl:'data:image/png;base64,'+sheet.image.toString('base64')}]};
    }),
    tool('physics_trace','读取精确步的指标、速度峰值、末端与支撑。指定 component 可聚焦；fullMesh=true 可读单组件最多 5 步完整顶点，完整所有步轨迹保留在 gzip JSONL。',{test:str,component:str,fullMesh:{type:'boolean'},steps:{type:'array',items:{type:'integer'}}},async({test,steps,component,fullMesh}:any)=>{
      if(fullMesh&&(!component||steps.length>5))throw Error('完整网格需指定单个组件，最多 5 步');
      const rows=await traceWindow(evidence,test,steps);return textResult(rows.map((r:any)=>({...r,components:Object.fromEntries(Object.entries(r.components).filter(([id])=>!component||id===component).map(([id,v]:[string,any])=>[id,fullMesh?v:{stats:v.stats,supports:v.supports,tip:v.tip,maxSpeed:Math.max(...v.velocity.map(Math.abs))}]))})));
    }),
    tool('physics_strip','以原像素拼接连续颜色帧并返回模型，记录每一帧的实际查看。最多 6 帧；component 可指定固定局部，留空为整体。',{test:str,component:str,steps:{type:'array',items:{type:'integer'}}},async({test,component,steps}:any)=>{
      if(!Array.isArray(steps)||!steps.length||steps.length>6)throw Error('一组 1–6 帧');
      const manifest=await json(join(evidence,'manifest.json')),frames=await json(join(evidence,'frames.json')),chosen=steps.map((step:number)=>frames.find((f:any)=>f.configHash===manifest.configHash&&f.test===test&&f.step===step&&f.mode==='color'&&(component?f.component===component:!f.component)));
      if(chosen.some((f:any)=>!f))throw Error('请先生成所需精确帧');
      const images=await Promise.all(chosen.map((f:any)=>readFile(join(evidence,f.path)))),meta=await sharp(images[0]).metadata();
      const width=meta.width!,height=meta.height!;
      if(width*height*images.length>64_000_000)throw Error('拼图过大，请减少帧数');
      const strip=await sharp({create:{width:width*images.length,height:height+28,channels:4,background:'#182232'}}).composite(images.map((input,i)=>({input,left:i*width,top:28}))).png().toBuffer();
      const viewed=await optional(join(evidence,'viewed.json'))||[];for(let i=0;i<chosen.length;i++)viewed.push({...chosen[i],...(step?.id==='step03'?{reviewSession:(await json(join(pipeline,'step03/review-session.json'))).id}:{}),imageHash:hash(images[i])});await put(join(evidence,'viewed.json'),viewed);
      return {success:true,contentItems:[{type:'inputText',text:JSON.stringify({leftToRight:chosen,sourcePixelScale:1})},{type:'inputImage',imageUrl:'data:image/png;base64,'+strip.toString('base64')}]};
    }),
    tool('physics_evidence_index','查询事件、指标与图片索引（分页）。不要猜不存在的帧。',{test:str,component:str,offset:{type:'integer'},limit:{type:'integer'}},async({test,component,offset=0,limit=24}:any)=>{
      const manifest=await optional(join(evidence,'manifest.json')),frames=await optional(join(evidence,'frames.json'))||[];
      if(!manifest)return textResult({complete:false,failure:await optional(join(evidence,'failure.json')),images:[]});
      const images=frames.filter((f:any)=>f.configHash===manifest.configHash&&(!test||f.test===test)&&(!component||f.component===component));
      return textResult({manifest:summarizeEvidence(manifest,test),images:images.slice(Math.max(0,offset),Math.max(0,offset)+Math.min(60,Math.max(1,limit))),total:images.length,nextOffset:offset+limit<images.length?offset+limit:null});
    }),
    tool('physics_submit_review','逐组件提交六项视觉结论。每项 verdict/reason/images，images 必须通过 physics_view 读取。通过后生成 step03/physics.json。',{findings:{type:'object'}},async({findings}:any)=>{
      const session=await optional(join(pipeline,'step03/review-session.json')),feedback=await optional(join(pipeline,'step03/feedback.json'));if(feedback?.status==='repair-requested'&&feedback.reviewTurn===session?.id)throw Error('当前复核已请求返修，应交回制作 B 后重新独立复核');
      if(session)findings={...findings,reviewSession:session.id};
      const config=await getConfig(),manifest=await validateFindings(config,evidence,findings,await renderSource());await validateReferenceReview(input,evidence,findings);
      await put(join(pipeline,'step03/findings.json'),findings);
      config.review={status:'accepted',configHash:manifest.configHash,evidenceVersion:manifest.version,coverage:{...manifest.coverage,aiVisual:'selected-frames',human:'unreviewed'},findings:'step03/findings.json',evidence:'step03/evidence/manifest.json'};
      await put(join(pipeline,'step03/physics.json'),config);if(session)await put(join(pipeline,'step03/feedback.json'),{version:1,status:'accepted',configHash:manifest.configHash,reviewTurn:session.id,createdAt:new Date().toISOString(),items:[],disposition:'accepted'});return textResult({published:true,coverage:config.review.coverage});
    }),
    tool('physics_request_repair','独立复核拒收／需要补证据时，记录逐组件 component、criterion、verdict(rejected|needs-evidence)、reason、test、steps、images。返回 blocked；调度器会真正交回 B，保留当前证据。不得改写制作草稿。',{items:{type:'array',items:{type:'object'}}},async({items}:any)=>textResult(await rejectReview(await getConfig(),pipeline,items))),
  ];
  if(!step)return tools;
  const read=['physics_catalog','physics_source_image','physics_reference'],evidenceTools=['physics_simulate','physics_frames','physics_view','physics_reference_view','physics_trace','physics_strip','physics_evidence_index','physics_assemblies'];
  const allowed=step.id==='step01'?[...read,'physics_save_plan']:step.id==='step02'?[...read,...evidenceTools,'physics_save_binding','physics_initialize_reference','physics_initialize_parameters','physics_recipes','physics_repair_request','physics_calibrate','physics_autotune','physics_select_candidate']:[...read,...evidenceTools,'physics_submit_review','physics_request_repair'];
  return tools.filter(t=>allowed.includes(t.name));
}
