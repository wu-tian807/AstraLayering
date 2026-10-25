import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runWorkflow,type KritaPipeline} from '../raster/workflow.ts';
import {loadWorkflowEnvironment} from '../codex/environment.ts';

test('independent review uses its own configured model and resumes its saved thread after interruption',async t=>{
  const root=await mkdtemp(join(tmpdir(),'astra-independent-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'case','input'),{recursive:true});await writeFile(join(root,'case','input','source.txt'),'source');
  const pipeline:KritaPipeline<any>={id:'physics',steps:[
    {id:'step01',title:'analysis',model:'gpt-6.1-sol',effort:'xhigh',modelStep:'physics_analysis',prompt:new URL(import.meta.url),requiredFiles:['report.md']},
    {id:'step02',title:'review',model:'gpt-6-astra',effort:'xhigh',modelStep:'physics_review',freshSession:true,prompt:new URL(import.meta.url),requiredFiles:['report.md']}],
    resolveInput:async()=>({source:join(root,'case','input')}),validateInput:(v:any):v is any=>!!v?.source,inputDirectories:i=>[i.source],buildPrompt:async step=>step.title};
  const options={name:'case',dir:root,krita:process.execPath},deps={environment:loadWorkflowEnvironment({},root),preflight:async(executable:string)=>({executable,version:'fixture'})};let calls=0;
  await assert.rejects(runWorkflow(pipeline,options,{...deps,agent:async request=>{calls++;assert.equal(request.threadId,undefined);const review=request.step==='physics_review';assert.equal(request.model,review?'gpt-6-astra':'gpt-6.1-sol');await request.onEvent({type:'thread.started',thread_id:review?'review-thread':'author-thread'});if(review)throw Error('interrupted review');await writeFile(join(request.directory,'step01/report.md'),'analysis');return {status:'completed',summary:'analysis'};}}),/interrupted review/);
  assert.equal(calls,2);const saved=JSON.parse(await readFile(join(root,'case','physics/run.json'),'utf8'));assert.equal(saved.threadId,'review-thread');assert.equal(saved.threadStep,'step02');
  await runWorkflow(pipeline,options,{...deps,agent:async request=>{assert.equal(request.threadId,'review-thread');assert.equal(request.step,'physics_review');await request.onEvent({type:'thread.started',thread_id:'review-thread'});await writeFile(join(request.directory,'step02/report.md'),'review');return {status:'completed',summary:'review'};}});
});
