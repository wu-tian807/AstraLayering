import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {componentDefaults} from '../../shared/physics-core/component-physics-schema.js';
import {groupAssemblies} from '../../shared/physics-core/assemblies.js';
import {calibrate,calibrationVersion,calibrationGeneration,measureCandidate,parameterCandidate,selectCandidate,validateCalibration} from '../calibration.ts';
import {json,put,hash} from '../input.ts';
import {simulationHash} from '../evidence.ts';
import {toolsFor} from '../tools.ts';
const strand=(id:string,x=60)=>({id,name:id,kind:'strand',priority:'primary',enabled:true,layerRefs:[{uuid:id,contentHash:'a'.repeat(64)}],sourcePartIds:[id],supports:[{id:'root',at:[x,20]}],...componentDefaults('strand'),authoring:{freeLength:130,transitionPixels:20,fixedRegions:[[[x-20,0],[x+20,0],[x+20,30],[x-20,30]]],centerline:[[x,20],[x,70],[x,140]],widths:[20,20,15]}});
const config=(components:any[])=>({kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',source:{canvas:{width:300,height:200}},components});

test('有向挂点决定完整装配，独立源分组和重排序身份稳定',()=>{
  const a=strand('ribbon'),b=strand('ring'),c=strand('pendant'),d=strand('hair');b.supports[0]={id:'neck',at:[60,140],componentId:'ribbon'} as any;c.supports[0]={id:'hook',at:[60,150],componentId:'ring'} as any;
  const groups=groupAssemblies(config([a,b,c,d])),linked=groups.find(g=>g.componentIds.includes('ribbon'))!;
  assert.equal(groups.length,2);assert.deepEqual(linked.componentIds,['pendant','ribbon','ring']);assert.deepEqual(linked.roots,['ribbon']);assert.deepEqual(linked.links.map(l=>[l.parent,l.child]),[['ribbon','ring'],['ring','pendant']]);
  assert.deepEqual(groupAssemblies(config([d,c,b,a])).map(g=>g.id),groups.map(g=>g.id));
});
test('标定参数保持原几何／限幅，不可修改组外组件',()=>{
  const c=config([strand('a'),strand('b',180)]),original=structuredClone(c);
  assert.throws(()=>parameterCandidate(c,['a'],{id:'wide',parameters:{a:{limits:{maxAngle:45}} as any}}),/只能调整/);
  assert.throws(()=>parameterCandidate(c,['a'],{id:'other',parameters:{b:{response:{frequencyHz:1}}}}),/组之外/);
  assert.throws(()=>parameterCandidate(c,['a'],{id:'invalid',parameters:{a:{response:{frequencyHz:NaN}}}}),/无效标定/);
  const next=parameterCandidate(c,['a'],{id:'slow',parameters:{a:{response:{frequencyHz:.7}}}});
  assert.deepEqual(c,original);assert.deepEqual(next.config.components[0].limits,c.components[0].limits);assert.deepEqual(next.config.components[0].authoring,c.components[0].authoring);assert.equal(next.changes.length,1);
});
test('相同固定步输入得到相同响应曲线，保留微风与停止回落',async()=>{
  const c=config([strand('a')]),a=await measureCandidate(c,['a']),b=await measureCandidate(c,['a']);
  assert.deepEqual(a,b);assert.equal(a.inputScale,130);assert.equal(a.metrics.airflow.a.samples.length,161);assert(a.metrics.airflow.a.peak>0);assert.equal(a.metrics['light-brush'].a.root,0);assert.equal(a.metrics['support-release'].a.invalid,0);
});
test('逐组选择候选不会回滚其它组，基线可恢复，绑定变化使旧标定失效',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'astra-calibration-'));
  try{
    const c=config([strand('a'),strand('b',180)]),ids=groupAssemblies(c).map(g=>g.id);
    for(const [i,id]of ids.entries())await calibrate(c,directory,id,'平缓释放',[{id:'slow',parameters:{[c.components[i].id]:{response:{frequencyHz:.7}}}}]);
    let selected=await selectCandidate(c,directory,ids[0],'slow','曲线保持根固定且平缓');assert.equal((await json(join(directory,'tuning.json'))).status,'draft');
    selected=await selectCandidate(selected,directory,ids[1],'slow','独立组同样比较后选择');assert.equal(selected.components[0].response.frequencyHz,.7);assert.equal(selected.components[1].response.frequencyHz,.7);await validateCalibration(selected,directory);
    selected=await selectCandidate(selected,directory,ids[0],'baseline','保留较活跃的原响应');assert.equal(selected.components[0].response.frequencyHz,c.components[0].response.frequencyHz);assert.equal(selected.components[1].response.frequencyHz,.7);await validateCalibration(selected,directory);
    selected.components[0].limits.maxAngle=17;await assert.rejects(validateCalibration(selected,directory),/约束或输入尺度改变/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('每代最多三轮，同一请求恢复复用，几何更新归档旧代',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'astra-calibration-limit-'));
  try{
    const c=config([strand('a')]),id=groupAssemblies(c)[0].id;
    await calibrate(c,directory,id,'第 1 次',[]);
    const initial=await json(join(directory,'tuning.json'));initial.calibrationVersion='astra-physics-calibration-2';await put(join(directory,'tuning.json'),initial);
    assert.equal((await calibrate(c,directory,id,'第 1 次',[])).reused,true);assert.equal((await json(join(directory,'tuning.json'))).calibrationVersion,calibrationVersion);
    await calibrate(c,directory,id,'第 2 次',[]);await calibrate(c,directory,id,'第 3 次',[]);await assert.rejects(calibrate(c,directory,id,'第 4 次',[]),/三轮标定/);
    c.components[0].limits.maxAngle=17;assert.equal((await calibrate(c,directory,id,'实际边界更新',[])).round.round,1);
    const entry=(await json(join(directory,'tuning.json'))).groups[0];assert.equal(entry.history[0].rounds.length,3);assert(!entry.rounds[0].candidates[0].path.startsWith('/'));
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('真实模拟中的零运动候选不能被选为认可参考的复现',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'astra-zero-motion-'));
 try{
  const reference=config([strand('a')]),c=structuredClone(reference);c.components[0].response.inputGain=0;c.components[0].response.windGain=0;
  const assembly=groupAssemblies(c)[0].id,round=(await calibrate(c,directory,assembly,'检查静止不能获胜',[{id:'still',parameters:{a:{response:{outputGain:0}}}}],undefined,reference)).round;
  assert.equal(round.recommendedCandidate,null);assert(round.candidates.every((v:any)=>!v.eligible));
  await assert.rejects(selectCandidate(c,directory,assembly,'still','不能用静止换平滑'),/安全检查失败/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('自动标定保留合格的当前参数，恢复已有选择而不追逐另一候选分数',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'astra-preserve-baseline-'));
 try{
  const c=config([strand('a')]),id=groupAssemblies(c)[0].id;
  const search=await calibrate(c,directory,id,'有限比较',[{id:'slow',parameters:{a:{response:{frequencyHz:.7}}}}]);assert(search.round.candidates.find((v:any)=>v.id==='slow').eligible);
  const selected=await selectCandidate(c,directory,id,'baseline','原动作已合格，保留认可参数');
  const previous=await json(join(directory,'tuning.json'));previous.calibrationVersion='astra-physics-calibration-2';await put(join(directory,'tuning.json'),previous);
  await assert.rejects(validateCalibration(selected,directory),/当前求解器/);
  const resumed=await calibrate(selected,directory,id,'续跑，优先保留',undefined,undefined,undefined,{preserveEligibleBaseline:true});
  assert.equal(resumed.reused,true);assert.equal(resumed.selection,'baseline');assert.equal((await json(join(directory,'tuning.json'))).groups[0].rounds.length,1);
  assert.equal((await json(join(directory,'tuning.json'))).calibrationVersion,calibrationVersion);await validateCalibration(selected,directory);
  const fresh=await mkdtemp(join(tmpdir(),'astra-preserve-fresh-'));
  try{const result=await calibrate(c,fresh,id,'原参数复测',undefined,undefined,c,{preserveEligibleBaseline:true});assert.equal(result.baselinePreserved,true);assert.deepEqual(result.round.candidates.map((v:any)=>v.id),['baseline']);const saved=await selectCandidate(c,fresh,id,'baseline','数值与参考目标均通过');assert.deepEqual(saved,c);await validateCalibration(saved,fresh);}
  finally{await rm(fresh,{recursive:true,force:true});}
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('求解器变化重测原参数并生成新指纹，保留来源、几何、力度和限幅',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'astra-preserve-solver-'));
 try{
  const c=config([strand('a')]),id=groupAssemblies(c)[0].id;
  await calibrate(c,directory,id,'原参数复测',[],undefined,undefined,{preserveEligibleBaseline:true});await selectCandidate(c,directory,id,'baseline','当前原参数合格');
  const tuning=await json(join(directory,'tuning.json')),entry=tuning.groups[0],old=hash(calibrationGeneration(c,['a'],'old-solver'));tuning.calibrationVersion='astra-physics-calibration-2';tuning.solverHash='old-solver';entry.generation=old;entry.rounds[0].solverHash='old-solver';entry.rounds[0].generation=old;await put(join(directory,'tuning.json'),tuning);
  const result=await calibrate(c,directory,id,'求解器修复后原参数复测',undefined,undefined,undefined,{preserveEligibleBaseline:true});assert.equal(result.reused,false);assert.equal(result.baselinePreserved,true);assert.deepEqual(result.round.candidates.map((v:any)=>v.id),['baseline']);assert.equal(result.round.solverHash,await simulationHash());
  const next=await selectCandidate(c,directory,id,'baseline','保持已认可的动作');assert.deepEqual(next,c);await validateCalibration(next,directory);assert.equal((await json(join(directory,'tuning.json'))).groups[0].history.length,1);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('autotune 只搜索运动目标失败组，保留已合格组并严格恢复参考幅度与活动量',async()=>{
 const task=await mkdtemp(join(tmpdir(),'astra-autotune-target-')),directory=join(task,'physics/step02');
 try{
  const reference=config([strand('a'),strand('b',180)]);for(const component of reference.components)component.response.outputGain=1;const c=structuredClone(reference);c.components[1].response.outputGain=.55;
  const referencePhysics=join(task,'reference.json');await put(referencePhysics,reference);await put(join(directory,'physics.draft.json'),c);
  const tool=toolsFor(directory,{task,referencePhysics,profile:'all'} as any,{id:'step02'}).find(t=>t.name==='physics_autotune')!,result=await tool.execute({reason:'保持当前好参数，只修参考运动退化'},new AbortController().signal);assert.equal(result.success,true,JSON.stringify(result));
  const tuning=await json(join(directory,'tuning.json')),good=tuning.groups.find((g:any)=>g.componentIds.includes('a')).rounds.at(-1),failed=tuning.groups.find((g:any)=>g.componentIds.includes('b')).rounds.at(-1);
  assert.deepEqual(good.candidates.map((v:any)=>v.id),['baseline']);assert.equal(good.selectedCandidate,'baseline');assert(failed.candidates.length>1&&failed.candidates.length<=4);assert.equal(failed.candidates[0].eligible,false);assert(failed.candidates[0].issues.some((v:string)=>v.includes('reference-amplitude')||v.includes('reference-activity')));
  const next=await json(join(directory,'physics.draft.json'));assert.deepEqual(next.components[0],c.components[0]);assert.deepEqual(next.components[1].authoring,c.components[1].authoring);assert.deepEqual(next.components[1].limits,c.components[1].limits);await validateCalibration(next,directory);
  for(const metric of Object.values(failed.candidates.find((v:any)=>v.id===failed.selectedCandidate).metrics) as any[])for(const value of Object.values(metric) as any[])if(value.target?.usable){assert(value.target.ratios.peak>=.8&&value.target.ratios.peak<=1.3);assert(value.target.ratios.activity>=.8&&value.target.ratios.activity<=1.3);}
 }finally{await rm(task,{recursive:true,force:true});}
});
