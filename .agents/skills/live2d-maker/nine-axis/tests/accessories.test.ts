import '../../shared/tests/ignore-local-env.ts';
import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import sharp from 'sharp';
import {joint,grid,pts} from './axis-fixtures.ts';
import {prepareAccessories,buildAccessories,checkAccessories,checkAccessoryShadows,accessoryPreviewScope,isAccessoryId} from '../accessories.ts';
import {KraMaterials,type MaterialLoader} from '../kra-materials.ts';
import {createContinuationEditTool} from '../continuation-edit-tool.ts';
import {createFitHead,runWorkflow,accessoriesPrompt} from '../run.ts';
import {loadWorkflowEnvironment} from '../../shared/codex/environment.ts';
import {readStepSession,writeStepSession} from '../../shared/agents/step-session.ts';
import {readStep} from '../../shared/step-chain.ts';
import {applyStepAction} from '../../workflow/step-actions.ts';
import {runSection} from '../../shared/step-section.ts';
import {createNineAxisViewTool} from '../view-tool.ts';

const uuid=(i:number)=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
async function fixture(t:TestContext,withAccessory=true){
  const root=await mkdtemp(join(tmpdir(),'nine-accessories-')),task=join(root,'case'),nine=join(task,'nine-axis');
  t.after(()=>rm(root,{recursive:true,force:true}));
  const upstream=join(nine,'step08_hair'),output=join(nine,'step09_head-accessories');await mkdir(upstream,{recursive:true});
  const doc=joint();doc.parts.forEach((p,i)=>p.uuid=uuid(i+1));
  for(const a of doc.axisSources!)a.doc.parts.forEach((p,i)=>p.uuid=uuid(i+1));
  const hair=grid('hair/bangs',[10,10,90,90]);hair.level='hair';hair.keyforms=Object.fromEntries([-30,0,30].map(x=>[x,pts(hair)]));
  doc.deformers.push({...hair,id:'hair/turn'});
  doc.parts.push({...hair,uuid:uuid(5),parent:'hair/turn',textureBounds:[10,10,80,80]});doc.levels.push({id:'hair',includes:['face','hair']});
  doc.parameters=[{id:'ParamAngleX',min:-30,max:30,keys:[-30,0,30]},{id:'ParamAngleY',min:0,max:0,keys:[0]}];
  doc.source={document:'nine-axis/step08_hair/character-nine-axis.kra',geometryDocument:'original.kra'};
  const layerIds=[...doc.parts.map(p=>p.id),...withAccessory?['head_accessories/object','accessory-shadow']:[]];
  const xml='<DOC><IMAGE><layers>'+layerIds.toReversed().map((id)=>`<layer uuid="{${uuid(layerIds.indexOf(id)+1)}}" name="${id}" nodetype="paintlayer" visible="1" opacity="${id==='accessory-shadow'?100:255}" compositeop="${id==='accessory-shadow'?'multiply':'normal'}"/>`).join('')+'</layers></IMAGE></DOC>';
  const colors=Object.fromEntries(layerIds.map(id=>[id,'#ddaa88']));
  const makeKra=async(paint=colors)=>zipSync({'maindoc.xml':strToU8(xml),'mergedimage.png':await sharp({create:{width:100,height:100,channels:4,background:'#ddaa88'}}).png().toBuffer(),'colors.json':strToU8(JSON.stringify(paint))});
  const source=join(upstream,'character-nine-axis.kra');await writeFile(source,await makeKra());
  for(const file of ['hair.json','deformers.json'])await writeFile(join(upstream,file),JSON.stringify(doc));
  for(const file of ['source.json','export-record.json','notes.md','character-nine-axis.png'])await writeFile(join(upstream,file),file.endsWith('.json')?'{}':'fixture');
  await writeFile(join(upstream,'.completed'),'');await writeFile(join(upstream,'hair-progress.json'),JSON.stringify({version:2,completed:['front','side','back','remaining'],next:'done'}));
  await writeStepSession(nine,'step08_hair',{threadId:'accepted-hair',harness:'codex'});
  if(withAccessory){await mkdir(join(task,'shadow/step01_mask'),{recursive:true});await writeFile(join(task,'shadow/step01_mask/shadows.json'),JSON.stringify({shadows:[{id:'object-hair',casterPartId:'character:head_accessories/object',receiverPartIds:['character:hair/bangs'],casterLayerUuids:[uuid(6)],receiverLayerUuids:[uuid(5)],shadowLayerUuid:uuid(7)}]}));}
  const materials=new KraMaterials(async(document,dir,rows)=>{
    const paint=JSON.parse(strFromU8(unzipSync(await readFile(document))['colors.json']));
    return Promise.all(rows.map(async row=>{
      const bounds=row.bounds??[10,10,30,30] as [number,number,number,number],id=layerIds[Number(row.uuid!.slice(-12))-1];
      await sharp({create:{width:bounds[2],height:bounds[3],channels:4,background:paint[id]}}).png().toFile(join(dir,row.texture));return {...row,bounds};
    }));
  });
  const materialize:MaterialLoader=(dir,built,signal,context)=>materials.resolve(task,dir,built,signal,context);
  const edit=()=>createContinuationEditTool(output,upstream,'accessories',undefined,task,materialize,{label:'头部饰品',allows:isAccessoryId,allowsParent:id=>doc.deformers.some(n=>n.id===id)});
  const build=async()=>materialize(output,await buildAccessories(output,upstream,undefined,materialize));
  const select=async(shadow=true)=>{
    const part={id:'head_accessories/object',uuid:uuid(6),level:'accessory',bbox:[10,10,40,40],cols:4,rows:4};
    const operations:any[]=[{action:'add_part',part}];
    if(shadow)operations.push({action:'add_part',after:'hair/bangs',part:{...part,id:'head_accessories/object/shadow',uuid:uuid(7),shadow:{casters:[part.id],receivers:['hair/bangs']},clip:{by:['hair/bangs']}}});
    await edit().execute({operations},new AbortController().signal);
  };
  const options={name:'case',dir:root,step:'step09_head-accessories'};
  const dependencies={environment:loadWorkflowEnvironment({}),materialize,ffmpegCheck:async()=>assert.fail('artwork-only step must not require FFmpeg'),resolveInput:async()=>({document:source,color:join(upstream,'character-nine-axis.png'),parts:[],source:{id:'hair',directory:upstream}})};
  return {root,task,nine,upstream,output,source,doc,colors,makeKra,materialize,edit,build,select,options,dependencies};
}
const tools=async()=>['krita','view_bitmap','edit_nine_axis','view_nine_axis'].map(name=>({name,description:'fixture',inputSchema:{type:'object'},async execute(){throw Error('unused');}}));

test('accessories bind only UUIDs, preserve the owned KRA on continue, and inherit all face/hair axes',async t=>{
  const f=await fixture(t);await prepareAccessories(f.output,f.upstream,f.task,f.materialize);
  const before=await f.build();await f.select(true);await checkAccessories(before,await f.build());
  await f.edit().execute({operations:[{action:'reparent',targets:['head_accessories/object'],parent:'hair/turn'}]},new AbortController().signal);
  await checkAccessories(before,await f.build());
  const built=await f.build(),shadow=built.doc.parts.find(p=>p.shadow)!;
  assert.equal(shadow.shadow!.blendMode,'multiply');assert.equal(shadow.shadow!.opacity,100/255);
  assert.deepEqual(shadow.shadow!.receivers,['hair/bangs']);
  const author=JSON.parse(await readFile(join(f.output,'accessories.json'),'utf8'));
  assert.ok(author.parts.every((p:any)=>p.uuid&&!p.texture));
  assert.deepEqual(author.parts.find((p:any)=>p.id==='hair/bangs').keyformsY,undefined);
  assert.deepEqual(author.parts.find((p:any)=>p.id==='face/face_base').keyformsXY,f.doc.parts[0].keyformsXY);
  const own=join(f.output,'character-nine-axis.kra'),modified=await f.makeKra({...f.colors,'head_accessories/object':'#ffaacc'});
  await writeFile(own,modified);await prepareAccessories(f.output,f.upstream,f.task,f.materialize);
  assert.deepEqual(await readFile(own),Buffer.from(modified));assert.notDeepEqual(await readFile(f.source),Buffer.from(modified));
  await rm(own);await assert.rejects(prepareAccessories(f.output,f.upstream,f.task,f.materialize),/本步 KRA 缺失/);
});

test('accessories reject unbound static ornaments, nonzero Y, and edits to completed hair',async t=>{
  const f=await fixture(t);await prepareAccessories(f.output,f.upstream,f.task,f.materialize);const before=await f.build();
  await assert.rejects(checkAccessories(before,before),/尚未注册剩余 KRA 头部饰品/);await f.select();
  const signal=new AbortController().signal;
  await assert.rejects(f.edit().execute({operations:[{action:'transform',id:'head_accessories/object',x:-30,y:5,translate:[1,0]}]},signal),/Y=0/);
  await assert.rejects(f.edit().execute({operations:[{action:'transform',id:'hair/bangs',x:-30,translate:[1,0]}]},signal),/只能编辑/);
  await writeFile(join(f.output,'character-nine-axis.kra'),await f.makeKra({...f.colors,'hair/bangs':'#ff0000'}));
  await assert.rejects(f.build(),/其他上游画稿/);
});

test('accessories continue with legacy fingerprints and upstream metadata changes while retaining their owned artwork',async t=>{
  const f=await fixture(t);await prepareAccessories(f.output,f.upstream,f.task,f.materialize);
  const path=join(f.output,'accessories.json'),author=JSON.parse(await readFile(path,'utf8'));
  assert.deepEqual(author.authoring,{stage:'accessories'});
  author.authoring.upstreamSha256='legacy-fingerprint';
  await writeFile(path,JSON.stringify(author));
  const own=await readFile(join(f.output,'character-nine-axis.kra'));
  await writeFile(join(f.upstream,'deformers.json'),JSON.stringify({...f.doc,notes:'updated explanation'},null,2));
  await prepareAccessories(f.output,f.upstream,f.task,f.materialize);
  await f.select();
  assert.ok((await f.build()).doc.parts.some(p=>p.id==='head_accessories/object'));
  assert.deepEqual(await readFile(join(f.output,'character-nine-axis.kra')),own);
});

test('native accessory shadows are required when their actual dependencies exist',async t=>{
  const f=await fixture(t);await prepareAccessories(f.output,f.upstream,f.task,f.materialize);await f.select(false);
  await assert.rejects(checkAccessoryShadows(f.task,(await f.build()).doc),/依赖已齐全/);
});

test('preview includes completed face/hair and registered accessories, with no static placeholders or Y poses',async()=>{
  for(const p of [{id:'face/face_base',level:'face'},{id:'hair/braid',level:'hair'},{id:'head_accessories/object',level:'accessory'}])assert.ok(accessoryPreviewScope.includes(p));
  assert.equal(accessoryPreviewScope.includes({id:'__kra__/unknown',level:'accessory'}),false);
  const tool=createNineAxisViewTool('/task/nine-axis','/task/out',async()=>assert.fail('pose rejected before KRA load'),undefined,accessoryPreviewScope);
  await assert.rejects(tool.execute({x:0,y:5},new AbortController().signal),/只允许 Y=0/);
  const prompt=accessoriesPrompt({document:'/task/owned.kra',color:''} as any,'/task');assert.ok(prompt.includes('持续被遮挡'));assert.ok(prompt.includes('head_accessories'));
});

test('missing and empty accessory deliveries consume at most two repairs in one persistent step session',async t=>{
  const f=await fixture(t);let calls=0,sessions=0;
  const agents={async run(){throw Error('persistent session required');},createSession(_id?:string,callbacks:any={}){sessions++;return {async run(task:any){
    calls++;assert.equal(task.step,'nine_axis_head_accessories');await callbacks.onSessionStarted?.('accessory-thread','codex');
    if(calls===1)await f.select();
    if(calls>1)await writeFile(join(f.output,'notes.md'),calls===2?'':'verified accessories');
    return {text:'{"error":null}',images:[],threadId:'accessory-thread',harness:'codex' as const};
  },async close(){}};}};
  await runWorkflow(f.options,{...f.dependencies,fitAccessories:createFitHead(agents,tools,'step09_head-accessories','饰品',undefined,f.nine)});
  assert.equal(calls,3);assert.equal(sessions,1);assert.equal((await readStep(f.output)).status,'completed');
  assert.equal((await readStepSession(f.nine,'step08_hair'))!.threadId,'accepted-hair');
  assert.equal((await readStepSession(f.nine,'step09_head-accessories'))!.threadId,'accessory-thread');
});

test('exhausted accessory delivery repairs leave only this step running',async t=>{
  const f=await fixture(t);let calls=0;
  const agents={async run(){throw Error('persistent session required');},createSession(){return {async run(){
    if(++calls===1)await f.select();return {text:'{"error":null}',images:[],threadId:'accessory-thread',harness:'codex' as const};
  },async close(){}};}};
  await assert.rejects(runWorkflow(f.options,{...f.dependencies,fitAccessories:createFitHead(agents,tools,'step09_head-accessories','饰品',undefined,f.nine)}),/已返修 2 次仍未通过/);
  assert.equal(calls,3);assert.equal((await readStep(f.output)).status,'running');assert.equal((await readStep(f.upstream)).status,'completed');
});

for(const action of ['continue','resume','retry'] as const)test(`accessory ${action} uses the normal step recovery contract`,async t=>{
  const f=await fixture(t);
  await assert.rejects(runWorkflow(f.options,{...f.dependencies,fitAccessories:async()=>{await f.select();throw Error('interrupted');}}),/interrupted/);
  const old=await readFile(join(f.output,'accessories.json'));await writeStepSession(f.nine,'step09_head-accessories',{threadId:'old-accessory',harness:'codex'});
  await applyStepAction({...f.options,section:'nine-axis',action});
  if(action==='retry')await assert.rejects(access(join(f.output,'accessories.json')),{code:'ENOENT'});
  else assert.deepEqual(await readFile(join(f.output,'accessories.json')),old);
  assert.equal((await readStepSession(f.nine,'step09_head-accessories'))?.threadId,action==='continue'?'old-accessory':undefined);
  await runWorkflow(f.options,{...f.dependencies,fitAccessories:async()=>{if(action==='retry')await f.select();await writeFile(join(f.output,'notes.md'),'checked');}});
  assert.equal((await readStep(f.output)).status,'completed');assert.equal((await readStep(f.upstream)).status,'completed');
});

test('a character without accessories can complete an explicit inspection without invented nodes',async t=>{
  const f=await fixture(t,false);await runWorkflow(f.options,{...f.dependencies,fitAccessories:async()=>{await writeFile(join(f.output,'notes.md'),'KRA inspected: no head accessories');}});
  assert.equal((await readStep(f.output)).status,'completed');
});

test('unfinished hair blocks targeted accessories before creating the new step',async t=>{
  const f=await fixture(t);await writeFile(join(f.upstream,'hair-progress.json'),JSON.stringify({version:2,completed:['front'],next:'side'}));
  await assert.rejects(runWorkflow(f.options,{...f.dependencies,fitAccessories:async()=>assert.fail('not ready')}),/先完成头发/);
  assert.equal((await readStep(f.output)).status,'absent');
});

test('a completed accessories marker cannot hide a lost delivery',async t=>{
  const f=await fixture(t);
  await runWorkflow(f.options,{...f.dependencies,fitAccessories:async()=>{await f.select();await writeFile(join(f.output,'notes.md'),'checked');}});
  await rm(join(f.output,'notes.md'));
  await assert.rejects(runWorkflow(f.options,f.dependencies),/缺少非空交付文件/);
});

test('a saved round that is still waiting stops the sequential chain before accessories',async t=>{
  const root=await mkdtemp(join(tmpdir(),'nine-accessory-order-'));t.after(()=>rm(root,{recursive:true,force:true}));let started=false;
  await runSection({directory:root,steps:[{number:8,note:'hair'},{number:9,note:'head-accessories'}],async step(s){return async()=>{if(s.id==='step09_head-accessories')started=true;};},async finished(){return false;}});
  assert.equal(started,false);assert.equal((await readStep(join(root,'step09_head-accessories'))).status,'absent');
});
