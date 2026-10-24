import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {toolsFor} from '../tools.ts';
import {roleAgent,rejectReview,dispatchRepair} from '../feedback.ts';
import {json,put} from '../input.ts';
import {configHash} from '../evidence.ts';
import {inspectRun} from '../../shared/raster/run-store.ts';
import {steps} from '../steps.ts';
import {runWorkflow as shared,type KritaPipeline} from '../../shared/raster/workflow.ts';
import {loadWorkflowEnvironment} from '../../shared/codex/environment.ts';
const config=()=>({source:{canvas:{width:200,height:200}},components:[{id:'cloth',enabled:true,supports:[{id:'root',at:[50,20]}],layerRefs:[{uuid:'cloth'}]}]});
async function fixture(){
  const directory=await mkdtemp(join(tmpdir(),'astra-physics-feedback-')),c=config();
  await put(join(directory,'run.json'),{version:2,name:'case',sourceInput:{},krita:{executable:'/krita',version:'test'},threadId:'review-thread',threadStep:'step03',threadHarness:'codex'});
  await put(join(directory,'roles.json'),{version:1,authoring:{threadId:'author-thread',threadHarness:'codex'}});
  await put(join(directory,'step02/physics.draft.json'),c);await writeFile(join(directory,'step02/.completed'),'');await mkdir(join(directory,'step01'));await writeFile(join(directory,'step01/.completed'),'');
  await put(join(directory,'step03/review-session.json'),{id:'turn-1',configHash:configHash(c),threadId:'review-thread'});await writeFile(join(directory,'step03/.running'),'');
  await put(join(directory,'step03/evidence/manifest.json'),{configHash:configHash(c),runs:[{test:'light-brush'}],renderHash:'renderer'});await writeFile(join(directory,'step03/evidence/trace.jsonl'),'preserved trace');
  return directory;
}
const item={component:'cloth',criterion:'response',verdict:'rejected',reason:'释放后持续顿挫，轨迹提供数值依据',test:'light-brush',steps:[180,181],images:[]};
test('返修可引用实际采集的回落尾段，不能引用记录结束后的步数',async()=>{
  const directory=await fixture();try{
    await put(join(directory,'step03/evidence/manifest.json'),{configHash:configHash(config()),runs:[{test:'extreme',durationSteps:1200}],renderHash:'renderer'});
    await rejectReview(config(),directory,[{...item,test:'extreme',steps:[1188,1200]}]);
    assert.deepEqual((await json(join(directory,'step03/feedback.json'))).items[0].steps,[1188,1200]);
    await assert.rejects(rejectReview(config(),directory,[{...item,test:'extreme',steps:[1201]}]),/真实整数步/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('正式工具按 A/B/C 隔离，复核不能改绑定或代选候选',()=>{
  const input:any={task:'/task',structures:[]},names=(id:string)=>toolsFor('/task/physics/'+id,input,{id}).map(t=>t.name);
  assert(names('step01').includes('physics_save_plan'));assert(!names('step01').includes('physics_save_binding'));
  assert(names('step02').includes('physics_calibrate'));assert(!names('step02').includes('physics_submit_review'));
  assert(names('step03').includes('physics_request_repair'));assert(!names('step03').includes('physics_save_binding'));assert(!names('step03').includes('physics_select_candidate'));
});
test('有效 C 反馈真正恢复 B 原会话并保留证据，旧反馈不触发自动返修',async()=>{
  const directory=await fixture();try{
    await rejectReview(config(),directory,[item]);const dispatched=await dispatchRepair(directory);assert.equal(dispatched.disposition,'dispatched');assert.equal(dispatched.repairRounds['assembly:cloth'],2);
    const run=await json(join(directory,'run.json'));assert.equal(run.threadId,'author-thread');assert.equal(run.threadStep,'step02');
    const plan=await inspectRun(directory,steps);assert.equal(plan.resetFrom,undefined);assert.equal(plan.statuses.get('step02'),'running');assert.equal(plan.statuses.get('step03'),'absent');assert.equal(await readFile(join(directory,'step03/evidence/trace.jsonl'),'utf8'),'preserved trace');assert.equal((await json(join(directory,'step02/repair-request.json'))).items[0].component,'cloth');
    assert.equal(await dispatchRepair(directory),false);const feedback=await json(join(directory,'step03/feedback.json'));feedback.disposition='pending';feedback.reviewTurn='old-turn';await put(join(directory,'step03/feedback.json'),feedback);assert.equal(await dispatchRepair(directory),false);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('返修轮次不能无限增长，三轮后保存失败并停止',async()=>{
  const directory=await fixture();try{
    await put(join(directory,'roles.json'),{authoring:{threadId:'author-thread',threadHarness:'codex'},repairRounds:{'assembly:cloth':3}});await rejectReview(config(),directory,[item]);await assert.rejects(dispatchRepair(directory),/三轮制作/);assert.equal((await json(join(directory,'step03/feedback.json'))).disposition,'pending');
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('交接中断重放不会重复消耗轮次，也不会删除数值证据',async()=>{
  const directory=await fixture();try{
    await rejectReview(config(),directory,[item]);const feedback=await json(join(directory,'step03/feedback.json'));feedback.disposition='dispatching';feedback.repairRounds={'assembly:cloth':2};await put(join(directory,'step03/feedback.json'),feedback);
    const roles=await json(join(directory,'roles.json'));roles.repairRounds={'assembly:cloth':2};await put(join(directory,'roles.json'),roles);
    const dispatched=await dispatchRepair(directory);assert.equal(dispatched.repairRounds['assembly:cloth'],2);assert.equal(await readFile(join(directory,'step03/evidence/trace.jsonl'),'utf8'),'preserved trace');assert.equal(await dispatchRepair(directory),false);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('真实步骤调度按 A→B→C失败→B原会话→C新会话执行',async()=>{
  const root=await mkdtemp(join(tmpdir(),'astra-physics-loop-')),directory=join(root,'case/physics'),calls:any[]=[],fakeSteps=steps.map(s=>({...s,requiredFiles:s.id==='step02'?['physics.draft.json']:s.id==='step03'?['physics.json']:['output.json']}));
  try{
    const pipeline:KritaPipeline<any>={id:'physics',steps:fakeSteps,resolveInput:async()=>({test:true}),validateInput:(v):v is any=>!!v,inputDirectories:()=>[],buildPrompt:async s=>s.id};
    const agent=roleAgent(directory,async request=>{
      const index=calls.length,step=request.step!,id=request.threadId||'thread-'+index;calls.push({step,threadId:request.threadId,id});await request.onEvent({type:'thread.started',thread_id:id});
      if(step==='physics_analysis')await put(join(directory,'step01/output.json'),{analyzed:true});
      else if(step==='physics_authoring'){const c:any=await json(join(directory,'step02/physics.draft.json')).catch(()=>config());c.revision=index;await put(join(directory,'step02/physics.draft.json'),c);}
      else{
        const c=await json(join(directory,'step02/physics.draft.json'));if(index===2){await put(join(directory,'step03/evidence/manifest.json'),{configHash:configHash(c),runs:[{test:'light-brush'}],renderHash:'renderer'});await rejectReview(c,directory,[item]);return {status:'blocked',summary:'需要返修'};}
        await put(join(directory,'step03/physics.json'),c);
      }
      return {status:'completed',summary:'test step'};
    });
    const dependencies={agent,environment:loadWorkflowEnvironment({},root),preflight:async()=>({executable:'/krita',version:'test'})};
    for(;;){try{await shared(pipeline,{name:'case',dir:root,krita:'/krita'},dependencies);break;}catch(error){if(!await dispatchRepair(directory))throw error;}}
    assert.deepEqual(calls.map(c=>c.step),['physics_analysis','physics_authoring','physics_review','physics_authoring','physics_review']);assert.equal(calls[3].threadId,calls[1].id);assert.equal(calls[4].threadId,undefined);assert.notEqual(calls[4].id,calls[2].id);assert.equal((await inspectRun(directory,fakeSteps)).statuses.get('step03'),'completed');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('独立 reviewer 修改草稿被检测，保留异常版本并恢复作者配置',async()=>{
  const directory=await fixture();try{
    const wrapped=roleAgent(directory,async request=>{await request.onEvent({type:'thread.started',thread_id:'new-review'});await put(join(directory,'step02/physics.draft.json'),{changed:true});return {status:'completed',summary:'changed'};});
    await assert.rejects(wrapped({step:'physics_review',prompt:'review',directory,model:'gpt-6.1-sol',effort:'xhigh',onEvent:async()=>{}}),/独立复核不得改写/);assert.deepEqual(await json(join(directory,'step02/physics.draft.json')),config());
    const session=await json(join(directory,'step03/review-session.json'));assert.deepEqual(await json(join(directory,'step03/reviews',session.id,'unauthorized-review-draft.json')),{changed:true});
  }finally{await rm(directory,{recursive:true,force:true});}
});
