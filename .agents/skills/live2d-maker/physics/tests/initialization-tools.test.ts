import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {toolsFor} from '../tools.ts';
import {componentDefaults} from '../../shared/physics-core/component-physics-schema.js';

test('真实初始化工具可保存同源参考子集，但完整保存不能漏做新增组件',async()=>{
 const task=await mkdtemp(join(tmpdir(),'astra-reference-init-')),pipeline=join(task,'physics'),source=join(pipeline,'source'),output=join(pipeline,'step02');
 try {
  for(const dir of [source,output,join(pipeline,'step01')])await mkdir(dir,{recursive:true});
  const c={...componentDefaults('strand'),id:'accepted',name:'accepted',kind:'strand',enabled:true,priority:'primary',sourcePartIds:['accepted'],layerRefs:[{uuid:'uuid-accepted',contentHash:'a'.repeat(64)}],supports:[{id:'root',at:[10,10]}],authoring:{freeLength:30,transitionPixels:5,fixedRegions:[[[0,0],[20,0],[20,15],[0,15]]],centerline:[[10,10],[10,25],[10,40]],widths:[10,10,10]}};
  const config={kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',source:{canvas:{width:30,height:50}},components:[c]};
  const referencePhysics=join(task,'reference.json');await writeFile(referencePhysics,JSON.stringify(config));
  await sharp({create:{width:1,height:1,channels:4,background:'#ffffffff'}}).png().toFile(join(source,'accepted.png'));
  const catalog={canvas:config.source.canvas,parts:[{id:'accepted'},{id:'new'}],layers:[{uuid:'uuid-accepted',contentHash:'a'.repeat(64),partPath:'accepted',bounds:{x:10,y:20,width:1,height:1},original:'accepted.png'}]};
  await writeFile(join(source,'catalog.json'),JSON.stringify(catalog));
  const plan={version:2,parts:['accepted','new'].map(id=>({id,decision:'bind',reason:'真实自由发束',motion:{family:'hair',region:'侧发',freedom:'free'}})),components:['accepted','new'].map(id=>({id,name:id,kind:'strand',priority:'primary',sourcePartIds:[id],layerUuids:['uuid-'+id],connection:'根部贴头'}))};
  await writeFile(join(pipeline,'step01/analysis.json'),JSON.stringify(plan));
  const tools=toolsFor(output,{task,referencePhysics,profile:'all'} as any,{id:'step02'}),signal=new AbortController().signal;
  const initialized=await tools.find(t=>t.name==='physics_initialize_reference')!.execute({},signal);
  assert.equal(initialized.success,true,JSON.stringify(initialized));
  const seed=JSON.parse(await readFile(join(output,'physics.draft.json'),'utf8'));
  assert.deepEqual(seed.components,[c]);assert.equal(seed.review.status,'draft');
  assert.equal(JSON.parse(await readFile(join(output,'initialization.json'),'utf8')).humanAcceptanceInherited,false);
  const full=await tools.find(t=>t.name==='physics_save_binding')!.execute({config:seed},signal);
  assert.equal(full.success,false);assert.match(JSON.stringify(full),/漏做已选择组件/);
  await assert.rejects(access(join(output,'.completed')));
 } finally {await rm(task,{recursive:true,force:true});}
});
