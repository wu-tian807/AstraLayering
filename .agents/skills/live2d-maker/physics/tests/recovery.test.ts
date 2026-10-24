import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {steps} from '../steps.ts';
import {inspectRun,resetSteps,newConfig} from '../../shared/raster/run-store.ts';

test('binding-stage simulation survives resume without clearing the binding thread or approving review',async()=>{
  const root=await mkdtemp(join(tmpdir(),'astra-physics-resume-'));
  try {
    for(const step of ['step01','step02','step03/evidence'])await mkdir(join(root,step),{recursive:true});
    await writeFile(join(root,'step01/.completed'),'');await writeFile(join(root,'step02/.running'),'');
    const trace=join(root,'step03/evidence/trace.jsonl');await writeFile(trace,'failed-motion-for-diagnosis');
    const config=newConfig('character',{}, {executable:'/krita',version:'test'});config.threadId='binding-thread';config.threadStep='step02';
    const plan=await inspectRun(root,steps);assert.equal(plan.resetFrom,undefined);assert.equal(plan.statuses.get('step03'),'absent');
    await resetSteps(root,config,plan);assert.equal(config.threadId,'binding-thread');
    assert.equal(await readFile(trace,'utf8'),'failed-motion-for-diagnosis');
    // Starting review adds a scheduler marker; pre-existing evidence never
    // marks the review as completed or bypasses its delivery validation.
    await writeFile(join(root,'step03/.running'),'');assert.equal((await inspectRun(root,steps)).statuses.get('step03'),'running');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('unmarked ordinary steps and missing upstream steps retain the normal reset rule',async()=>{
  const root=await mkdtemp(join(tmpdir(),'astra-physics-reset-'));
  try {
    await mkdir(join(root,'step01'));await mkdir(join(root,'step03/evidence'),{recursive:true});
    assert.equal((await inspectRun(root,steps)).resetFrom,1);
    await writeFile(join(root,'step01/.completed'),'');assert.equal((await inspectRun(root,steps)).resetFrom,2);
  }finally{await rm(root,{recursive:true,force:true});}
});
