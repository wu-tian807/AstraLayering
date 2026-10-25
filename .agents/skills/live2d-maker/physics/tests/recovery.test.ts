import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {steps} from '../steps.ts';
import {inspectRun,rasterSteps,newConfig,saveConfig} from '../../shared/raster/run-store.ts';
import {runSection} from '../../shared/step-section.ts';

test('binding-stage simulation survives resume without clearing the binding thread or approving review',async()=>{
  const root=await mkdtemp(join(tmpdir(),'astra-physics-resume-'));
  try {
    for(const step of ['step01','step02','step03/evidence'])await mkdir(join(root,step),{recursive:true});
    await writeFile(join(root,'step01/.completed'),'');await writeFile(join(root,'step02/.running'),'');
    const trace=join(root,'step03/evidence/trace.jsonl');await writeFile(trace,'failed-motion-for-diagnosis');
    const config=newConfig('character',{}, {executable:'/krita',version:'test'});config.threadId='binding-thread';config.threadStep='step02';
    await saveConfig(root,config);
    const plan=await inspectRun(root,steps);assert.equal(plan.resetFrom,undefined);assert.equal(plan.statuses.get('step03'),'absent');
    await assert.rejects(runSection({directory:root,steps:rasterSteps(steps),step:async step=>{
      if(step.id==='step01')return undefined;
      assert.equal(step.id,'step02');throw new Error('stop-before-resuming-binding');
    }}),/stop-before-resuming-binding/);
    assert.equal(JSON.parse(await readFile(join(root,'run.json'),'utf8')).threadId,'binding-thread');
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
    await writeFile(join(root,'step01/.completed'),'');assert.equal((await inspectRun(root,steps)).resetFrom,undefined);
    // Early diagnostics have no started review to reset. An actually started
    // review still breaks when its binding-stage dependency is absent.
    await writeFile(join(root,'step03/.running'),'');assert.equal((await inspectRun(root,steps)).resetFrom,2);
  }finally{await rm(root,{recursive:true,force:true});}
});
