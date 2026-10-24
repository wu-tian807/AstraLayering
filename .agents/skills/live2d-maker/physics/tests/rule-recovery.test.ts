import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fingerprint,put,ruleBaseline,type PhysicsInput} from '../input.ts';
import {resumeRuleUpdate} from '../rule-recovery.ts';

async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'astra-physics-rules-')),input:PhysicsInput={task:root,document:join(root,'source.kra'),color:join(root,'source.png'),structures:[join(root,'groups.json')],profile:'all',referencePhysics:join(root,'reference.json')};
  await writeFile(input.document,'source-kra');await writeFile(input.color,'source-pixels');await put(input.structures[0],{groups:[{id:'hair'}]});await put(input.referencePhysics!,{components:[{id:'hair'}]});
  const baseline=await ruleBaseline();baseline.rules[0].hash='0'.repeat(64);
  const run={name:'fixture',inputFingerprint:await fingerprint(input,baseline),threadId:'authoring-thread'};
  await put(join(root,'run.json'),run);await put(join(root,'step02/physics.draft.json'),{review:{status:'draft'},components:[{id:'hair'}]});
  await writeFile(join(root,'step01.completed'),'existing-analysis');
  return {root,input,baseline,run};
}
test('explicit rule maintenance preserves artifacts and sessions only after validating unchanged source inputs',async()=>{
  const f=await fixture();try{
    let validations=0;const draft=await readFile(join(f.root,'step02/physics.draft.json'),'utf8');
    const result=await resumeRuleUpdate(f.input,f.root,f.baseline,async()=>{validations++;});
    assert.equal(result.status,'migrated');assert.equal(validations,1);
    const run=JSON.parse(await readFile(join(f.root,'run.json'),'utf8'));
    assert.equal(run.threadId,f.run.threadId);assert.equal(run.inputFingerprint,await fingerprint(f.input));
    assert.equal(await readFile(join(f.root,'step02/physics.draft.json'),'utf8'),draft);
    assert.equal(await readFile(join(f.root,'step01.completed'),'utf8'),'existing-analysis');
    assert.deepEqual(JSON.parse(await readFile(join(result.archive!,'run-before.json'),'utf8')),f.run);
    assert.equal(JSON.parse(await readFile(join(result.archive!,'migration.json'),'utf8')).reviewAcceptanceInherited,false);
  }finally{await rm(f.root,{recursive:true,force:true});}
});
test('rule recovery refuses changed pixels, documents, groups, reference or profile without mutating the run',async()=>{
  const f=await fixture();try{
    const before=await readFile(join(f.root,'run.json'),'utf8');
    for(const path of [f.input.color,f.input.document,f.input.structures[0],f.input.referencePhysics!]){
      const original=await readFile(path);await writeFile(path,path.endsWith('.json')?'{}':'changed');
      await assert.rejects(resumeRuleUpdate(f.input,f.root,f.baseline,async()=>assert.fail('must reject before validation')),/规则恢复拒绝/);
      await writeFile(path,original);assert.equal(await readFile(join(f.root,'run.json'),'utf8'),before);
    }
    await assert.rejects(resumeRuleUpdate({...f.input,profile:'primary'},f.root,f.baseline,async()=>{}),/规则恢复拒绝/);
    const invalid=structuredClone(f.baseline);invalid.rules.reverse();
    await assert.rejects(resumeRuleUpdate(f.input,f.root,invalid,async()=>{}),/无效的物理规则基线/);
  }finally{await rm(f.root,{recursive:true,force:true});}
});
test('a failed current binding validation cannot migrate the input fingerprint',async()=>{
  const f=await fixture();try{
    const before=await readFile(join(f.root,'run.json'),'utf8');
    await assert.rejects(resumeRuleUpdate(f.input,f.root,f.baseline,async()=>{throw Error('binding mismatch');}),/binding mismatch/);
    assert.equal(await readFile(join(f.root,'run.json'),'utf8'),before);
  }finally{await rm(f.root,{recursive:true,force:true});}
});
