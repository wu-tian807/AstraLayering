import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {summarizeAssemblyTuning,toolsFor} from '../tools.ts';
import {hash,put} from '../input.ts';
import {configHash,simulationHash} from '../evidence.ts';

function fixture(){
  const config={source:{canvas:{width:100,height:100}},components:['hair','cloth'].map(id=>({id,enabled:true,supports:[{id:'root',at:[20,20]}],layerRefs:[{uuid:id}]}))};
  const large=new Array(10_000).fill({step:60,tip:[12,3],secret:'DO-NOT-RETURN-SAMPLES'}),historical={reason:'DO-NOT-RETURN-HISTORY',candidates:[{id:'old',metrics:{airflow:{hair:{samples:large}}}}]};
  const tuning={version:1,status:'calibrated',configHash:configHash(config),solverHash:'solver',groups:config.components.map(c=>({assemblyId:'assembly:'+c.id,history:[{rounds:new Array(50).fill(historical)}],rounds:[{
    round:1,solverHash:'solver',selectedCandidate:'baseline',recommendedCandidate:'baseline',selectionReason:'原参数已合格',selectedComponents:{[c.id]:hash(JSON.stringify(c))},candidates:[{
      id:'baseline',eligible:true,score:.2,issues:[],changes:[{component:c.id,group:'response',key:'inputGain',from:1,to:.8}],metrics:{airflow:{[c.id]:{peak:12,root:0,samples:large,issues:[],target:{usable:true,targetPeak:12,ratios:{peak:1,activity:1},samples:large},recovery:{passed:true,quietSteps:60,samples:large}}}},
    }],
  }]}))};
  return {config,tuning};
}
test('默认装配摘要的大小不随历史曲线增长，保留连接、当前选择和历史次数',()=>{
  const {config,tuning}=fixture(),summary=summarizeAssemblyTuning(config,tuning),text=JSON.stringify(summary);
  assert(text.length<3000);assert(!text.includes('DO-NOT-RETURN'));assert(!text.includes('samples'));assert(!text.includes('metrics'));assert(!text.includes('changes'));
  assert.deepEqual(summary.groups.map(g=>g.componentIds),[['cloth'],['hair']]);assert.equal(summary.tuning.status,'calibrated');
  for(const group of summary.tuning.groups){assert.equal(group.status,'selected');assert.equal(group.roundCount,1);assert.equal(group.historyCount,1);assert.equal(group.historyRoundCount,50);assert.equal(group.selectedCandidate,'baseline');assert.equal(group.selectionReason,'原参数已合格');assert.deepEqual(group.candidates.map((c:any)=>[c.id,c.eligible,c.score,c.issues]),[['baseline',true,.2,[]]]);}
});
test('真实 physics_assemblies 工具默认输出有界摘要，定位组指标且磁盘历史不变',async()=>{
  const task=await mkdtemp(join(tmpdir(),'astra-assembly-summary-'));try{
    const {config,tuning}=fixture(),solver=await simulationHash();tuning.solverHash=solver;for(const group of tuning.groups)group.rounds[0].solverHash=solver;
    const directory=join(task,'physics/step02');await put(join(directory,'physics.draft.json'),config);await put(join(directory,'tuning.json'),tuning);
    const before=await stat(join(directory,'tuning.json'));
    const tool=toolsFor(directory,{task,profile:'all'} as any,{id:'step02'}).find(t=>t.name==='physics_assemblies')!,signal=new AbortController().signal;
    const summary=await tool.execute({},signal);assert.equal(summary.success,true);assert(JSON.stringify(summary).length<4000);assert(!JSON.stringify(summary).includes('DO-NOT-RETURN'));
    const details=await tool.execute({assemblyId:'assembly:cloth'},signal);assert.equal(details.success,true);assert(JSON.stringify(details).includes('targetPeak'));assert(!JSON.stringify(details).includes('DO-NOT-RETURN'));
    const detail=JSON.parse((details.contentItems[0] as any).text);assert.equal(detail.groups.length,1);assert.equal(detail.tuning.groups[0].assemblyId,'assembly:cloth');assert.equal(detail.tuning.groups[0].candidates[0].changes[0].component,'cloth');
    assert.deepEqual(detail.tuning.groups[0].candidates[0].metrics.airflow.cloth,{peak:12,root:0,target:{usable:true,targetPeak:12,ratios:{peak:1,activity:1}},recovery:{passed:true,quietSteps:60}});assert(!JSON.stringify(detail).includes('samples'));
    const after=await stat(join(directory,'tuning.json'));assert.deepEqual([after.size,after.mtimeMs],[before.size,before.mtimeMs]);
  }finally{await rm(task,{recursive:true,force:true});}
});
