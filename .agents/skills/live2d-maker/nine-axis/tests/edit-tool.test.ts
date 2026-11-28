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
import { compileContinuation, startContinuation } from '../continuation.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { hairPreviewScope } from '../hair.ts';
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

test('explicit mirror preserves other nodes and reflects paired and central poses through their parents', () => {
  const leftParent = node('left-parent', [0, 0, 200, 100], 11);
  const rightParent = node('right-parent', [0, 0, 200, 100], 2);
  rightParent.keyforms['30'] = points(rightParent.bbox, 9);
  const layer = (id: string, bbox: number[], dx: number, parent?: string) => ({
    ...node(id, bbox, dx), parent, material: 'transparent', textureBounds: [0, 0, 20, 20],
  });
  const left = layer('hair/side_left', [115, 20, 135, 40], 3, leftParent.id);
  const right = layer('hair/side_right', [45, 20, 65, 40], -2, rightParent.id);
  left.keyforms['-12'] = points(left.bbox, 1);
  const center = layer('hair/bangs', [70, 25, 110, 45], 4);
  const asymmetric = layer('head_accessories/one-clip', [43, 10, 54, 16], 7);
  const doc: any = { version: 2, kind: 'head-nine-axis', axis: 90, levels: [{ id: 'face', includes: ['face'] }],
    deformers: [leftParent, rightParent], parts: [left, right, center, asymmetric] };
  const mirrored = editNineAxis(doc, [{ action: 'mirror', targets: [right.id, center.id] }]);
  assert.deepEqual([...evaluatePoints(mirrored, mirrored.parts[1], 30)], [31, 20, 51, 20, 31, 40, 51, 40]);
  assert.ok(mirrored.parts[1].keyforms['12']);
  assert.deepEqual([...evaluatePoints(mirrored, mirrored.parts[2], 30)], [66, 25, 106, 25, 66, 45, 106, 45]);
  assert.deepEqual(mirrored.parts[0], left);
  assert.deepEqual(mirrored.parts[3], asymmetric);
  assert.deepEqual(mirrored.deformers, doc.deformers);
  assert.equal(right.keyforms['30'], undefined);
});

test('mirror honors explicit pairs and writes only the matching positive-X corner', () => {
  const left = { ...node('part-A', [60, 20, 90, 40], 0), mirror: 'part-B', material: 'transparent', textureBounds: [60, 20, 30, 20] };
  const right = { ...node('part-B', [10, 20, 40, 40], 0), mirror: 'part-A', material: 'transparent', textureBounds: [10, 20, 30, 20] };
  const doc: any = { version: 2, kind: 'head-nine-axis', axis: 50, levels: [{ id: 'face', includes: ['face'] }],
    parameters: [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [-25, 0, 25] }],
    deformers: [], parts: [left, right] };
  const before = editNineAxis(doc, [
    { action: 'transform', id: left.id, x: -30, y: -25, translate: [-3, 2] },
    { action: 'transform', id: right.id, x: 30, y: 25, translate: [2, -1] },
  ]);
  const after = editNineAxis(before, [{ action: 'mirror', targets: [right.id], x: -30, y: -25 }]);
  assert.deepEqual([...evaluatePoints(after, after.parts[1], 30, -25)], [13, 22, 43, 22, 13, 42, 43, 42]);
  assert.deepEqual(after.parts[0], before.parts[0]);
  assert.deepEqual(after.parts[1].keyforms, before.parts[1].keyforms);
  assert.deepEqual(after.parts[1].keyformsY, before.parts[1].keyformsY);
  assert.deepEqual(after.parts[1].keyformsXY!['30,25'], before.parts[1].keyformsXY!['30,25']);
});

test('hair mirror cannot write or borrow a counterpart outside the active round', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-mirror-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const upstreamDirectory = join(root, 'nine-axis/step07_jaw-line'), directory = join(root, 'nine-axis/step08_hair');
  await Promise.all([upstreamDirectory, directory].map(d => mkdir(d, { recursive: true })));
  const face = { ...node('face/face_base', [10, 10, 90, 90], 0), material: 'transparent', textureBounds: [10, 10, 80, 80] };
  const upstream: any = { version: 2, kind: 'head-nine-axis', canvas: [100, 100], axis: 50, levels: [{ id: 'face', includes: ['face'] }],
    parameters: [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [0] }], deformers: [], parts: [face] };
  const doc = startContinuation(upstream, 'hair');
  const front = 'hair/bangs', side = 'hair/side_hair/right';
  for (const [id, mirror] of [[front, side], [side, front]]) doc.parts.push({
    ...node(id, [10, 10, 90, 90], 2), mirror, partId: 'character:' + id, level: 'hair', material: 'transparent', textureBounds: [10, 10, 80, 80],
  });
  const author = join(directory, 'hair.json'), original = JSON.stringify(doc);
  await writeFile(join(upstreamDirectory, 'deformers.json'), JSON.stringify(upstream));
  await writeFile(author, original);
  const tool = createContinuationEditTool(directory, upstreamDirectory, 'hair', undefined, root, undefined, hairPreviewScope('side'));
  for (const id of [front, side]) await assert.rejects(tool.execute({ operations: [{ action: 'mirror', targets: [id] }] },
    new AbortController().signal), /不能镜像范围外/);
  assert.equal(await readFile(author, 'utf8'), original);
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

test('jaw publishing mirrors new shapes and preserves the delivered right-side geometry', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-axis-jaw-mirror-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const upstream = join(root, 'step06_angle-xy');
  await mkdir(upstream);
  const bbox = [20, 20, 80, 80];
  const base = { ...node('face/face_base', bbox, -2), material: 'transparent', textureBounds: [20, 20, 60, 60] };
  base.keyforms['30'] = points(bbox, 13);
  const doc = {
    version: 2, kind: 'head-nine-axis', axis: 50, canvas: [100, 100],
    source: { document: 'original.kra' }, levels: [{ id: 'face', includes: ['face'] }],
    deformers: [], parts: [base],
  } as Parameters<typeof startContinuation>[0];
  await writeFile(join(upstream, 'deformers.json'), JSON.stringify(doc));
  const author = startContinuation(doc, 'jaw');
  author.parts.push({ ...node('face/jaw', bbox, -3), material: 'transparent', textureBounds: [20, 20, 60, 60] });

  const { doc: published } = await compileContinuation(join(root, 'step07_jaw-line'), upstream, author, 'jaw');

  assert.deepEqual(published.parts[0], base);
  assert.deepEqual(published.parts[1].keyforms['30'], points(bbox, 3));
});
