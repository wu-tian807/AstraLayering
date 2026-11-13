import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import sharp from 'sharp';
import { joint } from './axis-fixtures.ts';
import { prepareHair, buildHair, checkFrontRound, checkHairRound, hairRoundAllows, hairRoundLabel, hairPreviewScope, isFrontHair, isBackHair, isHairId, hairRounds, readHairProgress, completeHairRound, type HairRound } from '../hair.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { KraMaterials, type MaterialLoader } from '../kra-materials.ts';
import { createHairHead, hairPrompt, runWorkflow } from '../run.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { readStepSession, sessionPath, writeStepSession } from '../../shared/agents/step-session.ts';
import { readStep } from '../../shared/step-chain.ts';
import { applyStepAction, applyTaskAction, validStepId } from '../../workflow/step-actions.ts';
import type { CodexAgents, AgentTask } from '../../shared/codex/agents.ts';
import type { FunctionTool } from '../../shared/codex/function-tools.ts';
import { evaluatePoints } from '../../shared/nine-axis-model.js';
import { createNineAxisViewTool } from '../view-tool.ts';
import { frontPreviewScope } from '../hair.ts';

const hairIds=['hair/bangs','hair/side_hair/side_hair_left','hair/back_hair','hair/free_form_bundle'];
const uuid=(index: number)=>`00000000-0000-0000-0000-${String(index).padStart(12,'0')}`;
async function fixture(t: TestContext, withShadows = false, withRemaining = true) {
  const root=await mkdtemp(join(tmpdir(),'nine-hair-front-')),task=join(root,'case'),nine=join(task,'nine-axis');
  t.after(()=>rm(root,{recursive:true,force:true}));
  const upstream=join(nine,'step07_jaw-line'),output=join(nine,'step08_hair');
  await mkdir(upstream,{recursive:true});
  const doc=joint(); doc.parts.forEach((part,i)=>{part.uuid=uuid(i+1);});
  doc.parameters=[{id:'ParamAngleX',min:-30,max:30,keys:[-30,0,30]},{id:'ParamAngleY',min:-25,max:25,keys:[-25,0,25]}];
  const layerIds=[...doc.parts.map(p=>p.id),...hairIds.filter((_,i)=>withRemaining||i<3),...withShadows?['shadow/bangs-face','shadow/bangs-side','shadow/side-face']:[],'head_accessories/bell'];
  const xml='<DOC><IMAGE><layers>'+layerIds.toReversed().map(id=>`<layer uuid="{${uuid(layerIds.indexOf(id)+1)}}" name="${id}" nodetype="paintlayer" visible="1" opacity="${id.startsWith('shadow/')?41:255}" compositeop="${id.startsWith('shadow/')?'multiply':'normal'}"/>`).join('')+'</layers></IMAGE></DOC>';
  if(withShadows){
    const id=(name:string)=>uuid(layerIds.indexOf(name)+1);
    await mkdir(join(task,'shadow/step01_mask'),{recursive:true});
    await writeFile(join(task,'shadow/step01_mask/shadows.json'),JSON.stringify({shadows:[
      {id:'bangs-face',casterPartId:'character:hair/bangs',receiverPartIds:['character:face/face_base'],casterLayerUuids:[id('hair/bangs')],receiverLayerUuids:[id('face/face_base')],shadowLayerUuid:id('shadow/bangs-face'),follow:'caster'},
      {id:'bangs-side',casterPartId:'character:hair/bangs',receiverPartIds:['character:'+hairIds[1]],casterLayerUuids:[id('hair/bangs')],receiverLayerUuids:[id(hairIds[1])],shadowLayerUuid:id('shadow/bangs-side'),follow:'caster'},
      {id:'side-face',casterPartId:'character:'+hairIds[1],receiverPartIds:['character:face/face_base'],casterLayerUuids:[id(hairIds[1])],receiverLayerUuids:[id('face/face_base')],shadowLayerUuid:id('shadow/side-face'),follow:'caster'},
    ]}));
  }
  const colors=Object.fromEntries(layerIds.map(id=>[id,'#ddaa88']));
  const makeKra=async(next=colors)=>zipSync({'maindoc.xml':strToU8(xml),'mergedimage.png':await sharp({create:{width:100,height:100,channels:4,background:'#ddaa88'}}).png().toBuffer(),'test-colours.json':strToU8(JSON.stringify(next))});
  const source=join(upstream,'character-nine-axis.kra'); await writeFile(source,await makeKra());
  await writeFile(join(upstream,'deformers.json'),JSON.stringify(doc)); await writeFile(join(upstream,'.completed'),'');
  await writeStepSession(nine,'step07_jaw-line',{threadId:'jaw-thread',harness:'codex'});
  const materialRequests:any[]=[];
  const materials=new KraMaterials(async(document,directory,rows)=>{
    materialRequests.push(...rows);
    const zip=unzipSync(await readFile(document)),paint=JSON.parse(strFromU8(zip['test-colours.json']));
    return Promise.all(rows.map(async row=>{
      const id=layerIds[Number(row.uuid!.slice(-12))-1],bounds=row.bounds??[5,5,30,30] as [number,number,number,number];
      await sharp({create:{width:bounds[2],height:bounds[3],channels:4,background:paint[id]}}).png().toFile(join(directory,row.texture));
      return {...row,bounds};
    }));
  });
  const materialize: MaterialLoader=(directory,built,signal,context)=>materials.resolve(task,directory,built,signal,context);
  const edit=(round: HairRound='front')=>createContinuationEditTool(output,upstream,'hair',undefined,task,materialize,{label:hairRoundLabel(round)+'轮次',allows:hairRoundAllows(round)});
  const build=async()=>materialize(output,await buildHair(output,upstream,undefined,materialize));
  const options={name:'case',dir:root,step:'step08_hair'};
  const dependencies={environment:loadWorkflowEnvironment({}),materialize,
    ffmpegCheck:async()=>assert.fail('the front round uses KRA and existing images, not FFmpeg/video generation'),
    resolveInput:async()=>({document:source,color:join(upstream,'character-nine-axis.png'),parts:[],source:{id:'jaw',directory:upstream}}),
  };
  return {root,task,nine,upstream,output,doc,source,colors,makeKra,materialize,materialRequests,edit,build,options,dependencies};
}

async function selectFront(f: Awaited<ReturnType<typeof fixture>>, shadow=false){
  const part={id:'hair/bangs',uuid:uuid(f.doc.parts.length+1),level:'hair',bbox:[5,5,35,35],cols:6,rows:6};
  const operations:any[]=[{action:'add_part',part}];
  if(shadow)operations.push({action:'add_part',after:'face/face_base',part:{...part,id:'hair/bangs/shadow',uuid:uuid(f.doc.parts.length+hairIds.length+1),shadow:{casters:['hair/bangs'],receivers:['face/face_base']},clip:{by:['face/face_base']}}});
  await f.edit().execute({operations},new AbortController().signal);
}
async function selectSide(f: Awaited<ReturnType<typeof fixture>>){
  await f.edit('side').execute({operations:[{action:'add_part',part:{id:hairIds[1],uuid:uuid(f.doc.parts.length+2),level:'hair',bbox:[5,5,35,35],cols:6,rows:6}}]},new AbortController().signal);
}
async function selectBack(f: Awaited<ReturnType<typeof fixture>>){
  await f.edit('back').execute({operations:[{action:'add_part',before:'hair/bangs',part:{id:hairIds[2],uuid:uuid(f.doc.parts.length+3),level:'hair',bbox:[5,5,35,35],cols:6,rows:6}}]},new AbortController().signal);
}
async function selectRemaining(f: Awaited<ReturnType<typeof fixture>>){
  await f.edit('remaining').execute({operations:[{action:'add_part',part:{id:hairIds[3],uuid:uuid(f.doc.parts.length+4),level:'hair',bbox:[5,5,35,35],cols:6,rows:6}}]},new AbortController().signal);
}

const fixtureTools=async():Promise<FunctionTool[]>=>['krita','view_bitmap','edit_nine_axis','view_nine_axis'].map(name=>({name,description:'fixture',inputSchema:{type:'object'},async execute(){throw Error('not used');}}));
const selectRound=(f:Awaited<ReturnType<typeof fixture>>,round:HairRound)=>round==='front'?selectFront(f):round==='side'?selectSide(f):round==='back'?selectBack(f):selectRemaining(f);
async function reachRound(f:Awaited<ReturnType<typeof fixture>>,target:HairRound){
  for(const round of hairRounds){
    if(round===target)break;
    await runWorkflow(f.options,{...f.dependencies,fitHair:async()=>{
      await selectRound(f,round);await writeFile(join(f.output,'notes.md'),`${round} saved`);
    }});
  }
}

test('preparation retains UUID references only; maker explicitly selects a part and shadow and controls their grouping',async t=>{
  const f=await fixture(t,true);await prepareHair(f.output,f.upstream,f.task,f.materialize);
  const initial=JSON.parse(await readFile(join(f.output,'hair.json'),'utf8'));
  assert.equal(initial.parts.filter((p:any)=>p.level==='hair').length,0);
  assert.equal(f.materialRequests.length,0,'preparation must not read pixels');
  await selectFront(f,true);
  const before=await f.build(),shadow=before.doc.parts.find(p=>p.shadow)!;
  assert.deepEqual(shadow.shadow,{casters:['hair/bangs'],receivers:['face/face_base'],blendMode:'multiply',opacity:41/255});
  assert.ok(f.materialRequests.some(row=>row.uuid===shadow.uuid&&row.raw===true));
  const tool=f.edit(),signal=new AbortController().signal;
  await tool.execute({operations:[{action:'create_warp',id:'hair/bangs/turn',targets:['hair/bangs']}]},signal);
  let after=await f.build();assert.equal(after.doc.parts.find(p=>p.id===shadow.id)!.parent,undefined,'targets must not silently include a related part');
  await tool.execute({operations:[{action:'reparent',targets:[shadow.id],parent:'hair/bangs/turn'},{action:'transform',id:'hair/bangs/turn',x:-30,translate:[-8,0]}]},signal);
  after=await f.build();const moved=after.doc.parts.find(p=>p.id===shadow.id)!;
  const a=evaluatePoints(after.doc,moved,0,0),b=evaluatePoints(after.doc,moved,-30,0);assert.ok(Math.abs(b[0]-a[0]+8)<.01);
  await checkFrontRound(before,after);
  const author=JSON.parse(await readFile(join(f.output,'hair.json'),'utf8'));
  assert.ok(author.parts.every((p:any)=>!p.texture&&p.uuid));
  await assert.rejects(access(join(f.output,'layers')),{code:'ENOENT'});
});

test('hair copies the actually referenced jaw KRA once and preserves its own saved copy on continue',async t=>{
  const f=await fixture(t),source=await readFile(f.source);
  await prepareHair(f.output,f.upstream,f.task,f.materialize);
  const own=join(f.output,'character-nine-axis.kra'),author=JSON.parse(await readFile(join(f.output,'hair.json'),'utf8'));
  assert.deepEqual(await readFile(own),source);
  assert.equal(author.source.document,'nine-axis/step08_hair/character-nine-axis.kra');
  assert.equal(author.authoring.stage,'hair'); assert.equal(author.parts.filter((p:any)=>p.level==='hair').length,0);
  const edited=await f.makeKra({...f.colors,'hair/bangs':'#ffaacc'}); await writeFile(own,edited);
  await prepareHair(f.output,f.upstream,f.task,f.materialize);
  assert.deepEqual(await readFile(own),Buffer.from(edited));assert.deepEqual(await readFile(f.source),source);
  await rm(f.source);await prepareHair(f.output,f.upstream,f.task,f.materialize);
  assert.deepEqual(await readFile(own),Buffer.from(edited));
  await rm(own);
  await assert.rejects(prepareHair(f.output,f.upstream,f.task,f.materialize),/本步 KRA 缺失/);
});

test('front edit scope rejects side/back writes; the first-round check also catches Krita-only changes to other hair',async t=>{
  const f=await fixture(t); await prepareHair(f.output,f.upstream,f.task,f.materialize);
  await selectFront(f);
  const before=await f.build(),tool=f.edit(),signal=new AbortController().signal;
  const prior=await readFile(join(f.output,'hair.json'));
  await assert.rejects(tool.execute({operations:[{action:'transform',id:hairIds[1],x:-30,translate:[2,0]}]},signal),/前发轮次/);
  assert.deepEqual(await readFile(join(f.output,'hair.json')),prior);
  await tool.execute({operations:[{action:'create_warp',id:'hair/bangs/turn',targets:['hair/bangs']},{action:'transform',id:'hair/bangs/turn',x:-30,translate:[-2,0]}]},signal);
  await checkFrontRound(before,await f.build());
  await writeFile(join(f.output,'character-nine-axis.kra'),await f.makeKra({...f.colors,'hair/back_hair':'#224466'}));
  await assert.rejects(checkFrontRound(before,await f.build()),/其他图层画稿/);
});

test('front preservation matches exact node IDs before a shared KRA UUID',async t=>{
  const f=await fixture(t);await prepareHair(f.output,f.upstream,f.task,f.materialize);await selectFront(f);
  const before=await f.build(),neck=before.doc.parts.find(part=>part.id==='neck')!;
  const extension={...structuredClone(neck),id:'neck_top_extension',texture:'layers/neck-extension.png',textureBounds:[0,0,3,2] as [number,number,number,number]};
  before.doc.parts.splice(before.doc.parts.indexOf(neck)+1,0,extension);
  const original=join(f.root,'neck-extension.png'),changed=join(f.root,'neck-extension-changed.png');
  await sharp({create:{width:3,height:2,channels:4,background:'#224466'}}).png().toFile(original);
  await sharp({create:{width:3,height:2,channels:4,background:'#775533'}}).png().toFile(changed);
  before.textures.set(extension.texture,original);
  const after={doc:structuredClone(before.doc),textures:new Map(before.textures)};
  await checkFrontRound(before,after);
  const current=after.doc.parts.find(part=>part.id===extension.id)!;
  current.bbox=[...current.bbox];current.bbox[0]+=1;
  await assert.rejects(checkFrontRound(before,after),/neck_top_extension：前发轮次不能修改/);
  current.bbox=structuredClone(extension.bbox);
  after.textures.set(extension.texture,changed);
  await assert.rejects(checkFrontRound(before,after),/neck_top_extension：前发轮次修改了其他图层画稿/);
});

test('hair dispatch runs four rounds in the same thread and completes only after remaining hair',async t=>{
  const f=await fixture(t),calls:{thread?:string;prompt:string}[]=[],signal=new AbortController().signal;
  let interrupt=true;
  const agents={
    async run(){assert.fail('front uses the common persistent step session');},
    createSession(id?:string,callbacks:NonNullable<Parameters<CodexAgents['createSession']>[1]>={}){
      const thread=id??'hair-thread';
      return {async run(task:AgentTask){
        calls.push({thread:id,prompt:task.prompt}); await callbacks.onSessionStarted?.(thread,'codex');
        assert.equal((await readStepSession(f.nine,'step08_hair'))?.threadId,thread);
        const round=task.name==='前发左右制作'?'front':task.name==='侧发左右制作'?'side':task.name==='后发左右制作'?'back':'remaining';
        if(interrupt) {interrupt=false;throw Error(`interrupted ${round} turn`);}
        await selectRound(f,round);
        await f.edit(round).execute({operations:[{action:'transform',id:hairIds[hairRounds.indexOf(round)],x:-30,translate:[-2,0]}]},signal);
        if(round==='back')await f.edit(round).execute({operations:[{action:'transform',id:'hair/bangs',x:-30,translate:[1,0]},{action:'transform',id:hairIds[1],x:-30,translate:[1,0]}]},signal);
        await writeFile(join(f.output,'notes.md'),`${round} 已保存。`);
        return {text:'{"error":null}',images:[],threadId:thread,harness:'codex' as const};
      },async close(){}};
    },
  } satisfies Parameters<typeof createHairHead>[0];
  const tools=async():Promise<FunctionTool[]>=>['krita','view_bitmap','edit_nine_axis','view_nine_axis'].map(name=>({name,description:'fixture',inputSchema:{type:'object'},async execute(){throw Error('not used');}}));
  const fitHair=createHairHead(agents,tools,undefined,f.nine),deps={...f.dependencies,fitHair};
  await assert.rejects(runWorkflow(f.options,deps),/interrupted front turn/);
  assert.equal((await readStep(f.output)).status,'running');
  assert.equal((await readStepSession(f.nine,'step08_hair'))?.threadId,'hair-thread');
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:[],next:'front'});
  await applyStepAction({name:'case',dir:f.root,section:'nine-axis',step:'step08_hair',action:'continue'});
  assert.match(await runWorkflow(f.options,deps),/前发轮次已完成/);
  assert.deepEqual(calls.map(call=>call.thread),[undefined,'hair-thread']);
  assert.ok(calls.every(call=>call.prompt.includes('只制作前发')));
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:['front'],next:'side'});
  assert.equal((await readStep(f.output)).status,'running');
  assert.equal((await readStepSession(f.nine,'step07_jaw-line'))?.threadId,'jaw-thread');
  await assert.rejects(access(join(f.output,'.completed')),{code:'ENOENT'});
  const bytes=await readFile(join(f.output,'character-nine-axis.kra'));
  const front=JSON.parse(await readFile(join(f.output,'hair.json'),'utf8')).parts.find((p:any)=>p.id==='hair/bangs');
  interrupt=true;
  await assert.rejects(runWorkflow(f.options,deps),/interrupted side turn/);
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:['front'],next:'side'});
  assert.match(await runWorkflow(f.options,deps),/侧发轮次已完成/);
  assert.deepEqual(calls.map(call=>call.thread),[undefined,'hair-thread','hair-thread','hair-thread']);
  assert.ok(calls.slice(2).every(call=>call.prompt.includes('继续制作两片侧发')));
  assert.ok(calls.slice(2).every(call=>!call.prompt.includes('只制作前发')));
  assert.deepEqual(JSON.parse(await readFile(join(f.output,'hair.json'),'utf8')).parts.find((p:any)=>p.id==='hair/bangs'),front);
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:['front','side'],next:'back'});
  await assert.rejects(access(join(f.output,'.completed')),{code:'ENOENT'});
  interrupt=true;
  await assert.rejects(runWorkflow(f.options,deps),/interrupted back turn/);
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:['front','side'],next:'back'});
  assert.match(await runWorkflow(f.options,deps),/后发轮次已完成/);
  assert.deepEqual(calls.map(call=>call.thread),[undefined,'hair-thread','hair-thread','hair-thread','hair-thread','hair-thread']);
  assert.ok(calls.slice(4).every(call=>call.prompt.includes('继续制作后发')));
  assert.ok(calls.slice(4).every(call=>!call.prompt.includes('只制作前发')&&!call.prompt.includes('继续制作两片侧发')));
  assert.notDeepEqual(JSON.parse(await readFile(join(f.output,'hair.json'),'utf8')).parts.find((p:any)=>p.id==='hair/bangs'),front);
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:['front','side','back'],next:'remaining'});
  assert.equal((await readStep(f.output)).status,'running');
  interrupt=true;
  await assert.rejects(runWorkflow(f.options,deps),/interrupted remaining turn/);
  assert.equal((await readHairProgress(f.output)).next,'remaining');
  assert.match(await runWorkflow(f.options,deps),/其余头发轮次已完成/);
  assert.deepEqual(calls.slice(6).map(call=>call.thread),['hair-thread','hair-thread']);
  assert.ok(calls.slice(6).every(call=>call.prompt.includes('继续制作其余头发')));
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:[...hairRounds],next:'done'});
  assert.equal((await readStep(f.output)).status,'completed');
  await access(join(f.output,'.completed'));
  await runWorkflow(f.options,deps);assert.equal(calls.length,8,'a completed hair step must not redispatch');
  assert.deepEqual(await readFile(join(f.output,'character-nine-axis.kra')),bytes);
  assert.equal(validStepId('nine-axis','step08_hair/front'),false);
  await assert.rejects(applyStepAction({name:'case',dir:f.root,section:'nine-axis',step:'step08_hair',action:'resume'}),/已完成/);
  assert.equal((await readStepSession(f.nine,'step08_hair'))?.threadId,'hair-thread');
  assert.deepEqual(await readFile(join(f.output,'character-nine-axis.kra')),bytes);
  await applyStepAction({name:'case',dir:f.root,section:'nine-axis',step:'step08_hair',action:'retry'});
  await assert.rejects(access(f.output),{code:'ENOENT'});
  assert.equal((await readStepSession(f.nine,'step07_jaw-line'))?.threadId,'jaw-thread');
  assert.equal(await readStepSession(f.nine,'step08_hair'),undefined);
  await runWorkflow(f.options,deps);
  assert.equal(calls.at(-1)!.thread,undefined,'retry starts a fresh session');
  assert.match(calls.at(-1)!.prompt,/只制作前发/);
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:['front'],next:'side'});
});

for(const round of hairRounds){
  test(`${round}: missing then empty delivery gets two repairs in the same session before progress advances`,async t=>{
    const f=await fixture(t);await reachRound(f,round);
    const prompts:string[]=[],threads:(string|undefined)[]=[];
    const agents={async run(){assert.fail('persistent session required');},createSession(id?:string,callbacks:any={}){
      threads.push(id);return {async run(task:AgentTask){
        prompts.push(task.prompt);await callbacks.onSessionStarted?.('repair-thread','codex');
        assert.equal((await readHairProgress(f.output)).next,round,'failed deliveries must not advance');
        if(prompts.length===1)await selectRound(f,round);
        const notes=join(f.output,'notes.md');
        if(prompts.length===1)await rm(notes,{force:true});else await writeFile(notes,prompts.length===2?'':'saved');
        return {text:'{"error":null}',images:[],threadId:'repair-thread',harness:'codex' as const};
      },async close(){}};
    }};
    const fitHair=createHairHead(agents,fixtureTools,undefined,f.nine);
    await runWorkflow(f.options,{...f.dependencies,fitHair});
    assert.equal(prompts.length,3,'one initial turn plus at most two repair turns');
    assert.equal(threads.length,1,'repairs must reuse the already-open session');
    assert.ok(prompts.slice(1).every(prompt=>prompt.includes('notes.md')));
    assert.notEqual((await readHairProgress(f.output)).next,round);
    assert.equal((await readStep(f.output)).status,round==='remaining'?'completed':'running');
    for(const n of [1,2])assert.match(await readFile(join(f.output,'checks',String(n),'problems.txt'),'utf8'),/notes.md/);
  });

  test(`${round}: task resume keeps partial products and dispatches the pending prompt in a fresh session`,async t=>{
    const f=await fixture(t);await reachRound(f,round);
    const pending=await readHairProgress(f.output);
    await assert.rejects(runWorkflow(f.options,{...f.dependencies,fitHair:async()=>{
      await selectRound(f,round);await writeStepSession(f.nine,'step08_hair',{threadId:'old-thread',harness:'codex'});
      throw Error('interrupted');
    }}),/interrupted/);
    const kra=await readFile(join(f.output,'character-nine-axis.kra')),author=await readFile(join(f.output,'hair.json'));
    await applyTaskAction({name:'case',dir:f.root,section:'nine-axis',action:'resume'});
    assert.equal(await readStepSession(f.nine,'step08_hair'),undefined);
    assert.deepEqual(await readHairProgress(f.output),pending);
    assert.deepEqual(await readFile(join(f.output,'character-nine-axis.kra')),kra);
    assert.deepEqual(await readFile(join(f.output,'hair.json')),author);
    let calls=0;
    const agents={async run(){assert.fail('persistent session required');},createSession(id?:string,callbacks:any={}){
      assert.equal(id,undefined);return {async run(task:AgentTask){
        calls++;await callbacks.onSessionStarted?.('new-thread','codex');
        assert.match(task.prompt,round==='front'?/只制作前发/:round==='side'?/继续制作两片侧发/:round==='back'?/继续制作后发/:/继续制作其余头发/);
        await writeFile(join(f.output,'notes.md'),`${round} saved`);
        return {text:'{"error":null}',images:[],threadId:'new-thread',harness:'codex' as const};
      },async close(){}};
    }};
    await runWorkflow(f.options,{...f.dependencies,fitHair:createHairHead(agents,fixtureTools,undefined,f.nine)});
    assert.equal(calls,1);
    assert.equal((await readStepSession(f.nine,'step08_hair'))?.threadId,'new-thread');
    assert.equal((await readStepSession(f.nine,'step07_jaw-line'))?.threadId,'jaw-thread');
  });
}

test('exhausted delivery repairs leave back pending and never send another round',async t=>{
  const f=await fixture(t);await reachRound(f,'back');let calls=0;
  const agents={async run(){assert.fail('persistent session required');},createSession(_id?:string,callbacks:any={}){
    return {async run(){
      calls++;await callbacks.onSessionStarted?.('back-thread','codex');
      if(calls===1)await selectBack(f);await writeFile(join(f.output,'notes.md'),'');
      return {text:'{"error":null}',images:[],threadId:'back-thread',harness:'codex' as const};
    },async close(){}};
  }};
  await assert.rejects(runWorkflow(f.options,{...f.dependencies,fitHair:createHairHead(agents,fixtureTools,undefined,f.nine)}),/已返修 2 次仍未通过/);
  assert.equal(calls,3);
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:['front','side'],next:'back'});
  assert.equal((await readStep(f.output)).status,'running');
  assert.equal((await readStepSession(f.nine,'step08_hair'))?.threadId,'back-thread');
});

test('a model removed during the turn is repaired before the round is recorded complete',async t=>{
  const f=await fixture(t);let calls=0,author:Buffer;
  const agents={async run(){assert.fail('persistent session required');},createSession(_id?:string,callbacks:any={}){
    return {async run(){
      calls++;await callbacks.onSessionStarted?.('hair-thread','codex');
      if(calls===1){await selectFront(f);author=await readFile(join(f.output,'hair.json'));await rm(join(f.output,'hair.json'));}
      else await writeFile(join(f.output,'hair.json'),author);
      await writeFile(join(f.output,'notes.md'),'saved');
      return {text:'{"error":null}',images:[],threadId:'hair-thread',harness:'codex' as const};
    },async close(){}};
  }};
  await runWorkflow(f.options,{...f.dependencies,fitHair:createHairHead(agents,fixtureTools,undefined,f.nine)});
  assert.equal(calls,2);assert.equal((await readHairProgress(f.output)).next,'side');
});

test('a crash after remaining progress was saved only repairs the outer marker without redispatching',async t=>{
  const f=await fixture(t);await reachRound(f,'remaining');
  await runWorkflow(f.options,{...f.dependencies,fitHair:async()=>{await selectRemaining(f);await writeFile(join(f.output,'notes.md'),'saved');}});
  await rm(join(f.output,'.completed'));await writeFile(join(f.output,'.running'),'');
  await runWorkflow(f.options,{...f.dependencies,fitHair:async()=>assert.fail('all rounds already delivered')});
  assert.equal((await readStep(f.output)).status,'completed');
});

test('remaining hair requires explicit coverage of unbound hair and protects non-hair artwork',async t=>{
  const f=await fixture(t);await reachRound(f,'remaining');const before=await f.build();
  await assert.rejects(checkHairRound(before,before,'remaining'),/尚未注册剩余 KRA 发片/);
  await selectRemaining(f);await checkHairRound(before,await f.build(),'remaining');
  const tool=f.edit('remaining'),signal=new AbortController().signal;
  for(const id of hairIds)await tool.execute({operations:[{action:'transform',id,x:-30,translate:[1,0]}]},signal);
  await checkHairRound(before,await f.build(),'remaining');
  await assert.rejects(tool.execute({operations:[{action:'transform',id:'face/face_base',x:-30,translate:[1,0]}]},signal),/其余头发轮次/);
  await assert.rejects(tool.execute({operations:[{action:'add_part',part:{id:'head_accessories/bell',uuid:uuid(1),level:'accessory',bbox:[0,0,10,10]}}]},signal),/其余头发轮次/);
  await writeFile(join(f.output,'character-nine-axis.kra'),await f.makeKra({...f.colors,'head_accessories/bell':'#224466'}));
  await assert.rejects(checkHairRound(before,await f.build(),'remaining'),/其他图层画稿/);
});

test('leaving remaining hair as static KRA context consumes the normal repair budget before it can complete',async t=>{
  const f=await fixture(t);await reachRound(f,'remaining');let calls=0;
  const agents={async run(){assert.fail('persistent session required');},createSession(_id?:string,callbacks:any={}){
    return {async run(){
      calls++;await callbacks.onSessionStarted?.('hair-thread','codex');
      if(calls===3)await selectRemaining(f);
      await writeFile(join(f.output,'notes.md'),'checked');
      return {text:'{"error":null}',images:[],threadId:'hair-thread',harness:'codex' as const};
    },async close(){}};
  }};
  await runWorkflow(f.options,{...f.dependencies,fitHair:createHairHead(agents,fixtureTools,undefined,f.nine)});
  assert.equal(calls,3);assert.equal((await readHairProgress(f.output)).next,'done');
});

test('a character without remaining hair completes with a recorded inspection and no invented parts',async t=>{
  const f=await fixture(t,false,false);await reachRound(f,'remaining');
  const author=await readFile(join(f.output,'hair.json'));
  await runWorkflow(f.options,{...f.dependencies,fitHair:async()=>{await writeFile(join(f.output,'notes.md'),'Krita 图层与绑定已核对，没有其余头发。');}});
  assert.equal((await readHairProgress(f.output)).next,'done');
  assert.equal((await readStep(f.output)).status,'completed');
  assert.deepEqual(JSON.parse(await readFile(join(f.output,'hair.json'),'utf8')).parts,JSON.parse(author.toString()).parts);
});

for(const scope of ['step','task'] as const)for(const action of ['continue','resume'] as const)
test(`old completed hair: ${scope} ${action} dispatches remaining only and preserves the first three rounds`,async t=>{
  const f=await fixture(t);await reachRound(f,'remaining');
  await writeFile(join(f.output,'hair-progress.json'),JSON.stringify({version:1,completed:['front','side','back'],next:'done'}));
  await rm(join(f.output,'.running'));await writeFile(join(f.output,'.completed'),'');
  await writeStepSession(f.nine,'step08_hair',{threadId:'accepted-thread',harness:'codex'});
  const kra=await readFile(join(f.output,'character-nine-axis.kra')),author=await readFile(join(f.output,'hair.json'));
  if(scope==='step')await applyStepAction({name:'case',dir:f.root,section:'nine-axis',step:'step08_hair',action});
  else await applyTaskAction({name:'case',dir:f.root,section:'nine-axis',action});
  assert.equal((await readHairProgress(f.output)).next,'remaining');
  assert.deepEqual(await readFile(join(f.output,'character-nine-axis.kra')),kra);
  assert.deepEqual(await readFile(join(f.output,'hair.json')),author);
  let calls=0;
  const agents={async run(){assert.fail('persistent session required');},createSession(id?:string,callbacks:any={}){
    assert.equal(id,action==='continue'?'accepted-thread':undefined);
    const nextId=id??'fresh-thread';return {async run(task:AgentTask){
      calls++;assert.match(task.prompt,/继续制作其余头发/);await callbacks.onSessionStarted?.(nextId,'codex');
      await selectRemaining(f);await writeFile(join(f.output,'notes.md'),'其余头发已完成。');
      return {text:'{"error":null}',images:[],threadId:nextId,harness:'codex' as const};
    },async close(){}};
  }};
  await runWorkflow(f.options,{...f.dependencies,fitHair:createHairHead(agents,fixtureTools,undefined,f.nine)});
  assert.equal(calls,1);assert.equal((await readHairProgress(f.output)).next,'done');
});

test('remaining prompt and scope accept arbitrary hair structures while excluding static context and head accessories',()=>{
  const prompt=hairPrompt({document:'/task/current.kra',color:''} as any,'/task','remaining');
  for(const title of ['目标是什么','要保护什么','自检查什么'])assert.ok(prompt.includes(title));
  assert.match(prompt,/范围由实际发型决定/);assert.match(prompt,/若确实没有其余头发/);
  assert.match(prompt,/对应独立投影一并制作/);assert.match(prompt,/本轮不使用 fit/);
  assert.match(prompt,/保留 KRA 原关系/);assert.match(prompt,/不为这类投影越界新增非头发节点/);
  const scope=hairPreviewScope('remaining');
  for(const id of ['hair/braid','hair/cowlick','hair/free_form_bundle','hair/custom-uuid/strand','hair/bangs/shadow','hair/side_hair/extra_temples']){
    assert.ok(scope.includes({id,level:'hair'}));assert.ok(hairRoundAllows('remaining')(id));
  }
  assert.ok(isHairId('hair/custom-uuid/strand'));assert.ok(isHairId('hair/back_hair/strand'));
  assert.ok(!scope.includes({id:'__kra__/unregistered',level:'hair'}));
  assert.ok(!scope.includes({id:'head_accessories/bell',level:'accessory'}));assert.equal(scope.allowsPose(0,25),false);
});

test('remaining work is selected by unbound KRA UUID, even when its original name belongs to an earlier region',async t=>{
  const f=await fixture(t);await reachRound(f,'remaining');const before=await f.build();
  await f.edit('remaining').execute({operations:[{action:'add_part',part:{id:'hair/side_hair/extra_temples',uuid:uuid(f.doc.parts.length+4),level:'hair',bbox:[5,5,35,35],cols:6,rows:6}}]},new AbortController().signal);
  await checkHairRound(before,await f.build(),'remaining');
});

test('registering a protected native accessory under hair cannot bypass preservation',async t=>{
  const f=await fixture(t);await reachRound(f,'remaining');await selectRemaining(f);
  const before=await f.build(),accessory=before.doc.parts.find(p=>p.level==='accessory')!;
  assert.ok(accessory.uuid);
  await f.edit('remaining').execute({operations:[{action:'add_part',part:{id:'hair/misclassified_accessory',uuid:accessory.uuid,level:'hair',bbox:[5,5,35,35],cols:6,rows:6}}]},new AbortController().signal);
  await assert.rejects(checkHairRound(before,await f.build(),'remaining'),/不能修改其他已有节点/);
});

test('back round can keep artwork unchanged or coordinate front/side/back KRA paint while protecting the face',async t=>{
  const f=await fixture(t);await prepareHair(f.output,f.upstream,f.task,f.materialize);await selectFront(f);await selectSide(f);
  const before=await f.build();
  await assert.rejects(checkHairRound(before,before,'back'),/尚未注册制作发片/);
  await selectBack(f);await checkHairRound(before,await f.build(),'back');
  const tool=f.edit('back'),signal=new AbortController().signal;
  for(const id of hairIds.slice(0,3))await tool.execute({operations:[{action:'transform',id,x:-30,translate:[1,0]}]},signal);
  await writeFile(join(f.output,'character-nine-axis.kra'),await f.makeKra({...f.colors,'hair/bangs':'#ffaacc',[hairIds[1]]:'#aaccff','hair/back_hair':'#cc8844'}));
  await checkHairRound(before,await f.build(),'back');
  await assert.rejects(tool.execute({operations:[{action:'transform',id:'face/face_base',x:-30,translate:[1,0]}]},signal),/后发轮次/);
  await assert.rejects(tool.execute({operations:[{action:'transform',id:'hair/braid',x:-30,translate:[1,0]}]},signal),/后发轮次/);
  await writeFile(join(f.output,'character-nine-axis.kra'),await f.makeKra({...f.colors,'face/face_base':'#224466'}));
  await assert.rejects(f.build(),/已有脸部画稿/);
});

test('an interrupted back round resumes its pending progress after a generic session reset',async t=>{
  const f=await fixture(t);await prepareHair(f.output,f.upstream,f.task,f.materialize);
  await writeFile(join(f.output,'.running'),'');
  await completeHairRound(f.output,'front');await completeHairRound(f.output,'side');
  await writeStepSession(f.nine,'step08_hair',{threadId:'hair-thread',harness:'codex'});
  const kra=await readFile(join(f.output,'character-nine-axis.kra'));
  await applyStepAction({name:'case',dir:f.root,section:'nine-axis',step:'step08_hair',action:'resume'});
  assert.equal(await readStepSession(f.nine,'step08_hair'),undefined);
  assert.equal((await readHairProgress(f.output)).next,'back');
  assert.deepEqual(await readFile(join(f.output,'character-nine-axis.kra')),kra);
});

test('side dispatch requires saved front deliveries and does not silently rebuild missing outputs',async t=>{
  const f=await fixture(t);await prepareHair(f.output,f.upstream,f.task,f.materialize);await selectFront(f);
  await writeFile(join(f.output,'.running'),'');
  await completeHairRound(f.output,'front');
  const kra=await readFile(join(f.output,'character-nine-axis.kra'));
  await rm(join(f.output,'hair.json'));
  await assert.rejects(runWorkflow(f.options,{...f.dependencies,fitHair:async()=>assert.fail('missing front deliveries must stop before dispatch')}),/缺少非空交付文件/);
  await assert.rejects(access(join(f.output,'hair.json')),{code:'ENOENT'});
  assert.deepEqual(await readFile(join(f.output,'character-nine-axis.kra')),kra);
  assert.equal((await readHairProgress(f.output)).next,'side');
});

test('side edits and preservation protect completed front geometry and native pixels',async t=>{
  const f=await fixture(t);await prepareHair(f.output,f.upstream,f.task,f.materialize);await selectFront(f);
  const before=await f.build(),tool=f.edit('side'),signal=new AbortController().signal;
  await assert.rejects(tool.execute({operations:[{action:'transform',id:'hair/bangs',x:-30,translate:[1,0]}]},signal),/侧发轮次/);
  await assert.rejects(tool.execute({bindings:[{id:'hair/bangs',uuid:uuid(1)}]},signal),/侧发轮次/);
  await selectSide(f);
  await tool.execute({operations:[{action:'transform',id:hairIds[1],x:-30,translate:[-3,0]}]},signal);
  const after=await f.build();await checkHairRound(before,after,'side');
  const front=after.doc.parts.find(p=>p.id==='hair/bangs')!;
  const original=structuredClone(front.bbox);front.bbox[0]+=1;
  await assert.rejects(checkHairRound(before,after,'side'),/hair\/bangs：侧发轮次不能修改/);
  front.bbox=original;
  await writeFile(join(f.output,'character-nine-axis.kra'),await f.makeKra({...f.colors,'hair/bangs':'#224466'}));
  await assert.rejects(checkHairRound(before,await f.build(),'side'),/hair\/bangs：侧发轮次修改了其他图层画稿/);
});

test('front prompt is a single-round task using the owned KRA',()=>{
  const prompt=hairPrompt({document:'/task/nine-axis/step08_hair/character-nine-axis.kra',color:'/task/nine-axis/step08_hair/character-nine-axis.png'} as any,'/task');
  assert.match(prompt,/step08_hair\/character-nine-axis.kra/);
});

test('side prompt inherits current KRA, keeps front initial separate and uses edge with color inspection',()=>{
  const prompt=hairPrompt({document:'/task/nine-axis/step08_hair/character-nine-axis.kra',color:''} as any,'/task','side');
  assert.match(prompt,/step08_hair\/character-nine-axis.kra/);
  const scope=hairPreviewScope('side');
  for(const id of ['face/face_base','hair/bangs','hair/bangs/shadow','hair/side_hair/left','hair/side_hair/shadow'])assert.ok(scope.includes({id,level:id.startsWith('face')?'face':'hair'}));
  for(const id of ['hair/back_hair','hair/braid','hair/accessory'])assert.ok(!scope.includes({id,level:'hair'}));
  assert.equal(scope.allowsPose(-30,25),false);
});

test('hair progress rejects out-of-order, duplicate and skipped rounds',async t=>{
  const f=await fixture(t);await mkdir(f.output,{recursive:true});
  await assert.rejects(completeHairRound(f.output,'side'),/不能重复完成或跳过轮次/);
  await assert.rejects(completeHairRound(f.output,'back'),/不能重复完成或跳过轮次/);
  await completeHairRound(f.output,'front');
  await assert.rejects(completeHairRound(f.output,'front'),/不能重复完成或跳过轮次/);
  await completeHairRound(f.output,'side');
  await assert.rejects(completeHairRound(f.output,'side'),/不能重复完成或跳过轮次/);
  await completeHairRound(f.output,'back');
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:['front','side','back'],next:'remaining'});
  await assert.rejects(completeHairRound(f.output,'back'),/不能重复完成或跳过轮次/);
  await completeHairRound(f.output,'remaining');
  assert.deepEqual(await readHairProgress(f.output),{version:2,completed:[...hairRounds],next:'done'});
  await assert.rejects(completeHairRound(f.output,'remaining'),/不能重复完成或跳过轮次/);
  await writeFile(join(f.output,'hair-progress.json'),JSON.stringify({version:2,completed:['side'],next:'back'}));
  await assert.rejects(readHairProgress(f.output),/进度无效/);
});

test('back prompt prioritizes reference motion and conditional KRA edits, with cumulative head-hair preview',()=>{
  const prompt=hairPrompt({document:'/task/nine-axis/step08_hair/character-nine-axis.kra',color:''} as any,'/task','back');
  assert.match(prompt,/step08_hair\/character-nine-axis.kra/);
  const scope=hairPreviewScope('back');
  for(const id of ['face/face_base',...hairIds.slice(0,3),'hair/back_hair/shadow','hair/bangs/shadow'])assert.ok(scope.includes({id,level:id.startsWith('face')?'face':'hair'}));
  for(const id of ['hair/braid','head_accessories/bell']){assert.ok(!scope.includes({id,level:'hair'}));assert.ok(!hairRoundAllows('back')(id));}
  assert.equal(scope.allowsPose(30,25),false);
  assert.ok(isBackHair('hair/back_hair/shadow'));assert.ok(!isBackHair('hair/back_hair_other'));
});

test('hair exposes only X while retaining completed face Y/XY and creates no vertical hair keys',async t=>{
  const f=await fixture(t);await prepareHair(f.output,f.upstream,f.task,f.materialize);
  await selectFront(f);
  await f.edit().execute({operations:[{action:'create_warp',id:'hair/bangs/turn',targets:['hair/bangs']}]},new AbortController().signal);
  const author=JSON.parse(await readFile(join(f.output,'hair.json'),'utf8'));
  const y=author.parameters.find((p:any)=>p.id==='ParamAngleY');
  assert.deepEqual([y.min,y.max,y.keys],[0,0,[0]]);
  for(const original of f.doc.parts){
    const current=author.parts.find((p:any)=>p.id===original.id);
    assert.deepEqual(current.keyformsY,original.keyformsY);
    assert.deepEqual(current.keyformsXY,original.keyformsXY);
  }
  for(const node of [...author.parts,...author.deformers].filter((p:any)=>isFrontHair(p.id))){
    assert.equal(node.keyformsY,undefined);assert.equal(node.keyformsXY,undefined);
  }
});

test('hair rejects Y editing and embedded vertical keys without saving, and rejects direct-file bypass',async t=>{
  const f=await fixture(t);await prepareHair(f.output,f.upstream,f.task,f.materialize);await selectFront(f);
  const path=join(f.output,'hair.json'),before=await readFile(path),tool=f.edit(),signal=new AbortController().signal;
  for(const action of ['transform','points','drag'])
    await assert.rejects(tool.execute({operations:[{action,id:'hair/bangs',x:-30,y:25}]},signal),/Y=0/);
  const author=JSON.parse(before.toString()),front=author.parts.find((p:any)=>p.id==='hair/bangs');
  await assert.rejects(tool.execute({operations:[{action:'add_part',part:{...front,id:'hair/bangs/extra',keyformsY:{'25':front.keyforms['0']}}}]},signal),/上下或四角/);
  assert.deepEqual(await readFile(path),before);
  front.keyformsXY={'-30,25':structuredClone(front.keyforms['0'])};
  await writeFile(path,JSON.stringify(author));
  await assert.rejects(buildHair(f.output,f.upstream),/上下或四角/);
});

test('front preview refuses vertical and corner frames before reading KRA or rendering',async()=>{
  let builds=0;
  const tool=createNineAxisViewTool('/task/nine-axis','/unused',async()=>{builds++;throw Error('must not build');},undefined,frontPreviewScope);
  const signal=new AbortController().signal;
  await assert.rejects(tool.execute({x:0,y:25},signal),/Y=0/);
  await assert.rejects(tool.execute({frames:[{x:-30,y:0},{x:-30,y:-25}]},signal),/Y=0/);
  assert.equal(builds,0);
});
