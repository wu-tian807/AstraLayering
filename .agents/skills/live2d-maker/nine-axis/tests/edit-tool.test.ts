import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {zipSync,strToU8} from 'fflate';
import { createHeadEditTool } from '../edit-tool.ts';
import { buildHead, mirrorHierarchy, type FaceLeft } from '../head.ts';
import { evaluatePoints } from '../../shared/nine-axis-model.js';
import { editNineAxis } from '../../shared/nine-axis-edit.js';
const points = (box: number[], dx = 0) => [[box[0],box[1]],[box[2],box[1]],[box[0],box[3]],[box[2],box[3]]].map(([x,y]) => [x+dx,y]);
const node = (id: string, bbox: number[], dx: number): any => ({id, level:'face',bbox,cols:1,rows:1,keyforms:{'0':points(bbox),'-30':points(bbox,dx)}});
test('registration stays static; editing lazily creates only the target axes and children inherit the carrier',()=>{
  const base={...node('face/face_base',[0,0,100,100],0),texture:'layers/a.png',textureBounds:[0,0,100,100]};
  const doc:any={version:2,kind:'head-nine-axis',levels:[{id:'face',includes:['face']}],
    parameters:[{id:'ParamAngleX',keys:[-30,0,30]},{id:'ParamAngleY',keys:[-25,0,25]}],deformers:[],parts:[base]};
  const registered=editNineAxis(doc,[
    {action:'add_part',part:{id:'face/new',material:'transparent',bbox:[20,20,80,80],cols:1,rows:1}},
    {action:'create_warp',id:'carrier',targets:['face/new']},
  ]);
  for(const n of [registered.parts[1],registered.deformers[0]]){
    assert.deepEqual(Object.keys(n.keyforms),['0']);assert.equal(n.keyformsY,undefined);assert.equal(n.keyformsXY,undefined);
  }
  const x=editNineAxis(registered,[{action:'transform',id:'carrier',x:-30,translate:[-6,0]}]);
  assert.deepEqual(Object.keys(x.deformers[0].keyforms).sort(),['-30','0','30']);
  assert.equal(x.deformers[0].keyformsY,undefined);assert.equal(x.deformers[0].keyformsXY,undefined);
  assert.ok(Math.abs(evaluatePoints(x,x.parts[1],-15)[0]-17)<.01);
  const xy=editNineAxis(x,[{action:'transform',id:'carrier',x:-30,y:25,translate:[1,2]}]);
  assert.deepEqual(Object.keys(xy.deformers[0].keyformsY).sort(),['-25','25']);
  assert.deepEqual(Object.keys(xy.deformers[0].keyformsXY).sort(),['-30,-25','-30,25','30,-25','30,25']);
  assert.ok(Math.abs(evaluatePoints(xy,xy.parts[1],-30,25)[0]-15)<.01);
  assert.ok(Math.abs(evaluatePoints(xy,xy.parts[1],-30,25)[1]-22)<.01);
  assert.deepEqual([...evaluatePoints(xy,xy.parts[1],-30,0)],[...evaluatePoints(x,x.parts[1],-30,0)]);
  assert.deepEqual(xy.parts[0],base);assert.deepEqual(Object.keys(xy.parts[1].keyforms),['0']);
  const combined=editNineAxis(registered,[{action:'transform',id:'carrier',x:-30,translate:[-6,0]},
    {action:'transform',id:'carrier',x:-30,y:25,translate:[1,2]}]);
  assert.deepEqual(combined,xy,'the same edits produce the same model across one batch or separate calls');
  const sample=[...evaluatePoints(xy,xy.parts[1],-15,12.5)];
  const corrected=editNineAxis(xy,[{action:'transform',id:'carrier',x:-15,y:12.5,translate:[1,1]}]);
  const actual=[...evaluatePoints(corrected,corrected.parts[1],-15,12.5)];
  for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-sample[i]-1)<.01,'an auxiliary XY edit is rendered without hand-written axis scaffolding');
  for(const [a,b] of [[-30,-25],[-30,25],[30,-25],[30,25]])
    assert.deepEqual([...evaluatePoints(corrected,corrected.parts[1],a,b)],[...evaluatePoints(xy,xy.parts[1],a,b)]);
  assert.equal(Object.keys(corrected.deformers[0].keyformsXY!).length,5,'only the requested auxiliary intersection is added');
  assert.equal(doc.parts.length,1);assert.equal(doc.deformers.length,0,'edits never mutate the source document');
});
test('mirror uses the complete source hierarchy even when only one eye has a parent', () => {
  const warp = node('author-chosen', [0,0,200,100], 11);
  const left = {...node('face/eye_left', [120,20,140,40], 3),parent:warp.id};
  const right = node('face/eye_right', [60,20,80,40], -2);
  const mirrored = mirrorHierarchy({version:2,axis:100,deformers:[warp],parts:[left,right]} as FaceLeft);
  const doc: any = {deformers:mirrored.deformers,parts:mirrored.parts};
  assert.deepEqual([...evaluatePoints(doc,mirrored.parts[1],30)], [46,20,66,20,46,40,66,40]);
  assert.deepEqual([...evaluatePoints(doc,mirrored.parts[0],30)], [122,20,142,20,122,40,142,40]);
});
test('edit tool imports source textures, persists artist groups, previews revision, and rejects stale writes',async t=>{
  const root = await mkdtemp(join(tmpdir(),'astra-edit-tool-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const dir=join(root,'nine-axis/step04_angles');await mkdir(join(dir,'layers'),{recursive:true});
  const color=join(root,'source.png'),document=join(root,'source.kra');await writeFile(document,'source');
  await sharp({create:{width:200,height:200,channels:4,background:'#fff'}}).png().toFile(color);
  await writeFile(document,zipSync({'maindoc.xml':strToU8('<DOC/>'),'mergedimage.png':await readFile(color)}));
  await sharp({create:{width:1,height:1,channels:4,background:'#fff'}}).png().toFile(join(dir,'layers/a.png'));
  const tool=createHeadEditTool(dir,{color,document} as any,{x:0,y:0,size:200}),signal=new AbortController().signal;
  const read = (r: any) => JSON.parse(r.contentItems[0].text);
  assert.deepEqual(read(await tool.execute({},signal)).nodes,[]);
  const imported=read(await tool.execute({importParts:['face/face_base','face/mouth'].map(id=>({id,group:'face',texture:join(dir,'layers/a.png'),textureBounds:[20,20,80,80],bbox:[20,20,100,100],cols:1,rows:1}))},signal));
  const neutral=join(root,'neutral');await mkdir(join(neutral,'layers'),{recursive:true});
  await writeFile(join(neutral,'layers/a.png'),await readFile(join(dir,'layers/a.png')));
  await writeFile(join(neutral,'deformers.json'),JSON.stringify((await buildHead(dir,{color,document} as any,{x:0,y:0,size:200})).doc));
  const guarded=createHeadEditTool(dir,{color,document} as any,{x:0,y:0,size:200},undefined,root,neutral);
  const before=await readFile(join(dir,'face-left.json'));
  await assert.rejects(guarded.execute({operations:[{action:'clip',id:'face/mouth',by:['face/face_base']}]},signal),/原图层的 clip/);
  assert.deepEqual(await readFile(join(dir,'face-left.json')),before);
  await guarded.execute({revision:imported.revision,operations:[{action:'create_warp',id:'my-form',targets:['face/face_base']},{action:'transform',id:'my-form',x:-30,translate:[4,0]}]},signal);
  const source=JSON.parse(await readFile(join(dir,'face-left.json'),'utf8'));
  assert.equal(source.parts.find((p:any)=>p.id==='face/face_base').parent,'my-form');assert.equal(source.deformers.length,1);
  await assert.rejects(tool.execute({revision:imported.revision,operations:[{action:'remove_warp',id:'my-form'}]},signal),/revision/);
});
