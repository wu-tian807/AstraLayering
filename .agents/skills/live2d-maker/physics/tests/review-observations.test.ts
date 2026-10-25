import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {put,json} from '../input.ts';
import {roleAgent} from '../feedback.ts';
import {toolsFor} from '../tools.ts';
import {observationScopeVersion,scopedObservations} from '../review-observations.ts';

test('制作与另一 C 的实际看图不能替代当前 C；原会话恢复保留本人的记录',()=>{
  const session={id:'current-c',configHash:'config',observationScopeVersion};
  const author={path:'tail.png'},old={path:'tail.png',reviewSession:'old-c'},current={path:'tail.png',reviewSession:'current-c'};
  const ledger=[author,old,current],original=JSON.stringify(ledger);
  assert.deepEqual(scopedObservations(ledger,session,{reviewSession:'current-c',configHash:'config'}),[current]);
  assert.deepEqual(scopedObservations(ledger,{...session}),[current]);
  assert.throws(()=>scopedObservations(ledger,session,{reviewSession:'old-c',configHash:'config'}),/不是当前/);
  assert.throws(()=>scopedObservations(ledger,session,{reviewSession:'current-c',configHash:'old-config'}),/不是当前/);
  assert.equal(JSON.stringify(ledger),original);
});

test('历史复核保持历史格式，未知范围版本拒绝',()=>{
  const historical=[{path:'frame.png'}];
  assert.equal(scopedObservations(historical,{id:'legacy'}),historical);
  assert.throws(()=>scopedObservations(historical,{id:'c',observationScopeVersion:99}),/未知/);
});

test('正常 C 调度建立独立记录范围，实际看图工具标记当前会话，制作阶段不继承它',async()=>{
  const root=await mkdtemp(join(tmpdir(),'astra-physics-review-scope-'));
  try{
    for(const dir of ['step02','step03/evidence/airflow/frames'])await mkdir(join(root,dir),{recursive:true});
    await put(join(root,'step02/physics.draft.json'),{components:[],review:{status:'draft'}});
    await put(join(root,'run.json'),{threadHarness:'codex'});
    const invoke=roleAgent(root,async request=>{
      await request.onEvent({type:'thread.started',thread_id:'review-c'} as any);
      return {status:'completed',summary:'fixture'};
    });
    const request:any={step:'physics_review',onEvent:async()=>{}};
    await invoke(request);
    const session=await json(join(root,'step03/review-session.json'));
    assert.equal(session.observationScopeVersion,observationScopeVersion);
    await invoke({...request,threadId:'review-c'});
    assert.equal((await json(join(root,'step03/review-session.json'))).id,session.id);
    const path='airflow/frames/1292-color.png',frame={path,test:'airflow',step:1292,mode:'color',configHash:'config',renderHash:'render'};
    await put(join(root,'step03/evidence/manifest.json'),{configHash:'config',renderHash:'render'});
    await put(join(root,'step03/evidence/frames.json'),[frame]);
    const bytes=await sharp({create:{width:10,height:12,channels:4,background:'#eeccee'}}).png().toBuffer();
    await import('node:fs/promises').then(fs=>fs.writeFile(join(root,'step03/evidence',path),bytes));
    const input:any={task:root,structures:[]};
    for(const id of ['step02','step03']){
      const tool=toolsFor(join(root,id),input,{id}).find(t=>t.name==='physics_view')!;
      await tool.execute({paths:[path]},new AbortController().signal);
    }
    const ledger=await json(join(root,'step03/evidence/viewed.json'));
    assert.equal(ledger[0].reviewSession,undefined);
    assert.equal(ledger[1].reviewSession,session.id);
    assert.equal(scopedObservations(ledger,session).length,1);
    assert.deepEqual(await readFile(join(root,'step03/evidence',path)),bytes);
  }finally{await rm(root,{recursive:true,force:true});}
});
