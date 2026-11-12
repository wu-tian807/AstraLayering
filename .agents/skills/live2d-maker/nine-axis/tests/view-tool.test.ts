import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createNineAxisViewTool } from '../view-tool.ts';
import type { Built } from '../head.ts';
import { frontPreviewScope } from '../hair.ts';

const grid = (x0: number, y0: number, x1: number, y1: number, dx = 0) => [[x0 + dx, y0], [x1 + dx, y0], [x0 + dx, y1], [x1 + dx, y1]];

test('a multiply cast shadow keeps KRA opacity, moves with hair and clips against the current face',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'nine-shadow-render-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const part=(id:string,level:'face'|'hair',box:number[],colour:string,parent?:string)=>({id,level,...parent?{parent}:{},texture:`layers/${id.replace(/[^A-Za-z0-9_-]/g,'-')}.png`,textureBounds:[box[0],box[1],box[2]-box[0],box[3]-box[1]],bbox:box,cols:1,rows:1,keyforms:Object.fromEntries([-30,0,30].map(x=>[x,grid(...box as [number,number,number,number],id==='face/face_base'&&x===30?-10:0)])),colour});
  const face=part('face/face_base','face',[20,20,80,70],'#c87864');
  const hair=part('hair/bangs','hair',[35,10,55,30],'#ff0000','hair/turn');
  const shade={...part('hair/bangs::shadow','hair',[35,25,55,45],'#808080','hair/turn'),clip:{by:[face.id]},shadow:{casters:[hair.id],receivers:[face.id],blendMode:'multiply' as const,opacity:.5}};
  const textures=new Map<string,string>();
  for(const p of [face,shade,hair]){const file=join(directory,`${textures.size}.png`);await sharp({create:{width:p.textureBounds[2],height:p.textureBounds[3],channels:4,background:p.colour}}).png().toFile(file);textures.set(p.texture,file);}
  const doc:Built['doc']={version:2,kind:'head-nine-axis',canvas:[100,80],parameters:[{id:'ParamAngleX',keys:[-30,0,30],min:-30,max:30}],levels:[{id:'hair',includes:['face','hair']}],
    deformers:[{id:'hair/turn',level:'hair',bbox:[0,0,100,80],cols:1,rows:1,keyforms:{'-30':grid(0,0,100,80),0:grid(0,0,100,80),30:grid(0,0,100,80,20)}}],parts:[face,shade,hair]};
  const tool=createNineAxisViewTool(directory,join(directory,'observations'),async()=>({doc,textures})),signal=new AbortController().signal;
  const render=async(args:object)=>{const r=await tool.execute({crop:[0,0,100,80],...args},signal),info=JSON.parse((r.contentItems[0] as {text:string}).text);return {info,pixels:await sharp(info.savedPath).removeAlpha().raw().toBuffer()};};
  const pixel=(p:Buffer,x:number,y:number)=>[...p.subarray((y*100+x)*3,(y*100+x)*3+3)];
  const initial=await render({});pixel(initial.pixels,45,37).forEach((v,i)=>assert.ok(Math.abs(v-[150,90,75][i])<=1));
  const moved=await render({x:30}),plain=await render({x:30,hidden:[shade.id]});
  assert.deepEqual(pixel(moved.pixels,40,37),[200,120,100]);
  pixel(moved.pixels,63,37).forEach((v,i)=>assert.ok(Math.abs(v-[150,90,75][i])<=1));
  assert.deepEqual(pixel(moved.pixels,72,37),pixel(plain.pixels,72,37),'projection outside the deformed face must not appear');
  const reference=join(directory,'reference.png');await sharp({create:{width:100,height:80,channels:4,background:'#888'}}).png().toFile(reference);
  const a=await render({x:30,mode:'edge',reference:{path:reference,bounds:[0,0,100,80]}}),b=await render({x:30,hidden:[shade.id],mode:'edge',reference:{path:reference,bounds:[0,0,100,80]}});
  const overlay=async(p:string)=>sharp(p).extract({left:200,top:28,width:100,height:80}).raw().toBuffer();
  assert.deepEqual(await overlay(a.info.comparison.savedPath),await overlay(b.info.comparison.savedPath),'cast shadows do not expand receiver silhouettes');
});

test('front-stage previews retain the completed face and front hair but exclude unmade hair in every frame', async t => {
  const directory=await mkdtemp(join(tmpdir(),'nine-front-scope-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const rows=[['face/face_base','face','#0f0'],['hair/bangs','hair','#f00'],['hair/back_hair','hair','#00f']] as const;
  const parts=rows.map(([id,level],i)=>({id,level,texture:`layers/${i}.png`,textureBounds:[i*40,0,40,40],bbox:[i*40,0,i*40+40,40],cols:1,rows:1,keyforms:{'0':grid(i*40,0,i*40+40,40)}}));
  const textures=new Map<string,string>();
  for(const [i,row] of rows.entries()) {const file=join(directory,`${i}.png`);await sharp({create:{width:40,height:40,channels:4,background:row[2]}}).png().toFile(file);textures.set(parts[i].texture,file);}
  const doc:Built['doc']={version:2,kind:'head-nine-axis',canvas:[120,40],deformers:[],levels:[{id:'hair',includes:['face','hair']}],parts};
  const tool=createNineAxisViewTool(directory,join(directory,'observations'),async()=>({doc,textures}),undefined,frontPreviewScope),signal=new AbortController().signal;
  const result=await tool.execute({frames:[{x:0},{x:0}],crop:[0,0,120,40]},signal),info=JSON.parse((result.contentItems[0] as {text:string}).text);
  for(const frame of info.frames) {
    const pixels=await sharp(frame.savedPath).removeAlpha().raw().toBuffer(),pixel=(x:number)=>[...pixels.subarray((10*120+x)*3,(10*120+x)*3+3)];
    assert.deepEqual(pixel(20),[0,255,0]);assert.deepEqual(pixel(60),[255,0,0]);assert.notDeepEqual(pixel(100),[0,0,255]);
  }
  await assert.rejects(tool.execute({only:['hair/back_hair']},signal),/尚未开放预览/);
  await assert.rejects(tool.execute({grid:['hair/back_hair']},signal),/尚未开放预览/);
  assert.equal(doc.parts.length,3,'preview scope preserves the cumulative author for subsequent rounds');
});

test('transparent texel colour cannot stain filtered edges or darken translucent paint', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nine-view-alpha-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const textures = await Promise.all([0, 255].map(async hiddenColour => {
    const data = Buffer.alloc(5 * 5 * 4);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const i = (y * 5 + x) * 4, painted = x > 0 && x < 4 && y > 0 && y < 4;
      data.fill(painted ? 255 : hiddenColour, i, i + 3);
      data[i + 3] = painted ? 128 : 0;
    }
    const texture = join(directory, `edge-${hiddenColour}.png`);
    await sharp(data, { raw: { width: 5, height: 5, channels: 4 } }).png().toFile(texture);
    return texture;
  }));
  const doc: Built['doc'] = { version: 2, kind: 'head-nine-axis', canvas: [80, 80], deformers: [],
    levels: [{ id: 'face', name: '脸', includes: ['face'] }],
    parts: [{ id: 'face/face_base', level: 'face', group: 'face', texture: 'layers/edge.png',
      textureBounds: [20, 20, 40, 40], bbox: [20, 20, 60, 60], cols: 1, rows: 1,
      keyforms: { '0': grid(20, 20, 60, 60) } }] };
  const images = [];
  for (const texture of textures) {
    const tool = createNineAxisViewTool(directory, join(directory, 'observations'), async () => ({ doc, textures: new Map([['layers/edge.png', texture]]) }));
    const result = await tool.execute({ crop: [0, 0, 80, 80], scale: 2 }, new AbortController().signal);
    const saved = JSON.parse((result.contentItems[0] as { text: string }).text).savedPath;
    images.push(await sharp(saved).removeAlpha().raw().toBuffer());
  }
  assert.deepEqual(images[0], images[1], 'invisible RGB must not enter the antialiased edge');
  const centre = [...images[0].subarray((80 * 160 + 80) * 3, (80 * 160 + 80) * 3 + 3)];
  const expected = [0x2b, 0x2e, 0x35].map(background => 128 + background * 127 / 255);
  centre.forEach((value, channel) => assert.ok(Math.abs(value - expected[channel]) <= 1, `translucent paint channel ${channel}: ${value}`));
});

test('view_nine_axis 用工作台渲染器在工作台底色上画出本步交付', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nine-view-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const texture = join(directory, 'red.png');
  await sharp({ create: { width: 40, height: 40, channels: 4, background: '#f00' } }).png().toFile(texture);
  const doc: Built['doc'] & {axis:number} = { version: 2, deformers: [], kind: 'head-nine-axis', canvas: [100, 100], view: { x: 0, y: 0, width: 100, height: 100 }, axis: 50,
    parameters: [{ id: 'ParamAngleX', name: '角度 X', min: -30, max: 30, keys: [-30, 0, 30] }], levels: [{ id: 'face', name: '脸', includes: ['face'] }],
    parts: [{ id: 'face/face_base', level: 'face', group: 'face', texture: 'layers/000.png', textureBounds: [30, 30, 40, 40], bbox: [30, 30, 70, 70], cols: 1, rows: 1,
      keyforms: { '-30': grid(30, 30, 70, 70, -20), '0': grid(30, 30, 70, 70), '30': grid(30, 30, 70, 70, 20) } }] };
  const built: Built = { doc, textures: new Map([['layers/000.png', texture]]) };
  const tool = createNineAxisViewTool(directory, join(directory, 'observations'), async () => built), signal = new AbortController().signal;
  const pixel = async (args: object, x: number, y: number) => {
    const result = await tool.execute(args, signal), saved = JSON.parse((result.contentItems[0] as { text: string }).text).savedPath;
    const { data, info } = await sharp(saved).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
  };
  assert.deepEqual(await pixel({}, 50, 50), [255, 0, 0]);
  assert.deepEqual(await pixel({}, 5, 5), [0x2b, 0x2e, 0x35]);
  assert.deepEqual(await pixel({ x: -30, scale: 2 }, 30, 100), [255, 0, 0]);
  assert.deepEqual(await pixel({ x: -30, scale: 2 }, 130, 100), [0x2b, 0x2e, 0x35]);
  const gridded = await tool.execute({ x: -30, grid: ['face/face_base'] }, signal), info = JSON.parse((gridded.contentItems[0] as { text: string }).text);
  assert.equal(info.mode, 'color'); assert.equal(info.comparison, undefined);
  assert.deepEqual(info.grid, [{ id: 'face/face_base', cols: 1, rows: 1, points: grid(30, 30, 70, 70, -20) }]);
  assert.deepEqual(await pixel({ x: -30, grid: ['face/face_base'] }, 10, 30), [0x1d, 0x3a, 0x4a]);
  await assert.rejects(tool.execute({ grid: ['face/nose'] }, signal), /grid/);
  await assert.rejects(tool.execute({ y: 10 }, signal), /ParamAngleY/);
  await assert.rejects(tool.execute({ x: 40 }, signal), /-30 至 30/);
  const reference = join(directory, 'reference.png');
  await sharp({ create: { width: 100, height: 100, channels: 3, background: '#00f' } }).composite([
    { input: await sharp({ create: { width: 10, height: 100, channels: 3, background: '#0f0' } }).png().toBuffer(), left: 30, top: 0 },
  ]).png().toFile(reference);
  const compared = await tool.execute({ x: -30, crop: [10, 20, 60, 60], scale: 2, reference: { path: reference, bounds: [0, 0, 100, 100] } }, signal);
  const comparison = JSON.parse((compared.contentItems[0] as { text: string }).text).comparison;
  assert.equal(compared.contentItems.length, 3);
  assert.equal(comparison.registration, 'none; same canvas coordinates');
  assert.equal(comparison.axis, 50);
  const { data, info: comparisonInfo } = await sharp(comparison.savedPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(comparisonInfo.width, 360); assert.equal(comparisonInfo.height, 148);
  const at = (x: number, y: number) => [...data.subarray((y * comparisonInfo.width + x) * 3, (y * comparisonInfo.width + x) * 3 + 3)];
  // Original x=35 lands at screen x=50 even though the viewport is cropped.
  // The reference and model keep their coordinates; only the edge covers the reference.
  assert.deepEqual(at(50, 88), [0, 255, 0]);
  assert.deepEqual(at(170, 88), [255, 0, 0]);
  assert.deepEqual(at(290, 88), [0, 255, 0]);
  assert.deepEqual(at(290, 48), [0, 205, 255]);
  // Original x=60 remains outside the shifted model: reference blue stays blue.
  assert.deepEqual(at(340, 88), [0, 0, 255]);
  await assert.rejects(tool.execute({ reference: { path: reference, bounds: [0, 0, 0, 100] } }, signal), /reference.bounds/);
});

test('isolated clipped parts retain mask coverage; hidden clipped layers need no render target', async t => {
  const directory=await mkdtemp(join(tmpdir(),'nine-view-clip-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const red=join(directory,'red.png'),white=join(directory,'white.png');
  await sharp({create:{width:40,height:40,channels:4,background:'#f00'}}).png().toFile(red);
  await sharp({create:{width:40,height:40,channels:4,background:'#fff'}}).png().toFile(white);
  const p=(id:string,bbox:number[],texture:string):any=>({id,level:'face',group:'face',texture,textureBounds:[bbox[0],bbox[1],bbox[2]-bbox[0],bbox[3]-bbox[1]],bbox,cols:1,rows:1,keyforms:{'0':grid(...bbox as [number,number,number,number])}});
  const doc:any={version:2,kind:'head-nine-axis',canvas:[100,100],view:{x:0,y:0,width:100,height:100},levels:[{id:'face',includes:['face']}],deformers:[],parts:[
    {...p('mask',[30,30,50,70],'layers/white.png'),role:'mask'},
    {...p('clipped',[30,30,70,70],'layers/red.png'),clip:{by:['mask']}},
    {...p('hidden',[30,30,70,70],'layers/red.png'),clip:{by:['mask'],invert:true}}
  ]};
  const tool=createNineAxisViewTool(directory,join(directory,'observations'),async()=>({doc,textures:new Map([['layers/red.png',red],['layers/white.png',white]])})),signal=new AbortController().signal;
  const r=await tool.execute({only:['clipped']},signal),saved=JSON.parse((r.contentItems[0] as {text:string}).text).savedPath;
  const {data}=await sharp(saved).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([...data.subarray((50*100+40)*3,(50*100+40)*3+3)],[255,0,0]);
  assert.deepEqual([...data.subarray((50*100+60)*3,(50*100+60)*3+3)],[0x30,0x33,0x3a]);
});

test('edge compares only the visible silhouette at fixed canvas coordinates without grid, checkerboard or crop edges', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nine-view-edge-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const texture = join(directory, 'red.png'), reference = join(directory, 'reference.png');
  await sharp({ create: { width: 40, height: 40, channels: 4, background: '#f00' } }).png().toFile(texture);
  await sharp({ create: { width: 100, height: 100, channels: 3, background: '#00f' } }).png().toFile(reference);
  const part = (id: string, left: number): Built['doc']['parts'][number] => ({
    id, group: 'hair', level: 'hair', texture: 'layers/red.png', textureBounds: [left, 20, 40, 40],
    bbox: [left, 20, left + 40, 60], cols: 1, rows: 1,
    keyforms: { '-30': grid(left, 20, left + 40, 60, -5), '0': grid(left, 20, left + 40, 60), '30': grid(left, 20, left + 40, 60) },
  });
  const doc: Built['doc'] = { version: 2, kind: 'head-nine-axis', canvas: [100, 100], deformers: [],
    levels: [{ id: 'hair', name: '头发', includes: ['hair'] }],
    parameters: [{ id: 'ParamAngleX', name: '角度 X', min: -30, max: 30, keys: [-30, 0, 30] }],
    parts: [part('hair/bangs', 20), part('hair/side_hair/side_hair_left', 60)] };
  const before = structuredClone(doc), originalReference = await readFile(reference);
  const tool = createNineAxisViewTool(directory, join(directory, 'observations'), async () => ({ doc, textures: new Map([['layers/red.png', texture]]) }));
  assert.deepEqual((tool.inputSchema.properties as Record<string, { enum?: string[] }>).mode.enum, ['edge']);
  const signal = new AbortController().signal;
  await assert.rejects(tool.execute({ mode: 'edge' }, signal), /reference/);
  await assert.rejects(tool.execute({ mode: 'unsupported' }, signal), /mode/);
  await assert.rejects(tool.execute({ mode: 'blend', reference: { path: reference } }, signal), /仅支持 mode=edge/);
  const result = await tool.execute({ x: -30, level: 'hair', crop: [30, 10, 60, 70], scale: 2,
    only: ['hair/bangs'], grid: ['hair/side_hair/side_hair_left'], reference: { path: reference, bounds: [0, 0, 100, 100] } }, signal);
  const metadata = JSON.parse((result.contentItems[0] as { text: string }).text);
  assert.equal(metadata.comparison.mode, 'edge');
  assert.equal(metadata.comparison.registration, 'none; same canvas coordinates');
  const { data, info } = await sharp(metadata.comparison.savedPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 360); assert.equal(info.height, 168);
  const at = (x: number, y: number) => [...data.subarray(((y + 28) * info.width + 240 + x) * 3, ((y + 28) * info.width + 240 + x) * 3 + 3)];
  assert.deepEqual(at(49, 60), [0, 205, 255], 'shifted edge x=55 stays at the same canvas coordinate after crop and zoom');
  assert.deepEqual(at(30, 60), [0, 0, 255], 'paint inside the contour does not cover the reference');
  assert.deepEqual(at(0, 60), [0, 0, 255], 'cropping through a painted area does not create a false silhouette');
  assert.deepEqual(at(100, 60), [0, 0, 255], 'hidden side hair and checkerboard do not enter the edge image');
  assert.deepEqual(at(100, 20), [0, 0, 255], 'control-grid lines do not enter the edge image');
  assert.deepEqual(doc, before);
  assert.deepEqual(await readFile(reference), originalReference);
});

test('multi-frame preview resolves one cumulative model snapshot and returns per-frame grids and a contact sheet', async t => {
  const directory=await mkdtemp(join(tmpdir(),'nine-view-batch-')); t.after(()=>rm(directory,{recursive:true,force:true}));
  const texture=join(directory,'red.png');
  await sharp({create:{width:10,height:10,channels:4,background:'#f00'}}).png().toFile(texture);
  const doc:Built['doc']={version:2,kind:'head-nine-axis',canvas:[60,60],deformers:[],levels:[{id:'face',includes:['face']}],
    parameters:[{id:'ParamAngleX',min:-30,max:30,keys:[-30,0,30]}],
    parts:[{id:'face/face_base',level:'face',texture:'layers/face.png',textureBounds:[20,20,10,10],bbox:[20,20,30,30],cols:1,rows:1,
      keyforms:{'0':grid(20,20,30,30),'-30':grid(20,20,30,30,-10),'30':grid(20,20,30,30,10)}}]};
  let builds=0;
  const tool=createNineAxisViewTool(directory,join(directory,'observations'),async()=>{
    builds++; return {doc,textures:new Map([['layers/face.png',texture]]),sourceRevision:'saved-kra-revision'};
  });
  const result=await tool.execute({frames:[{x:0},{x:-15},{x:-30}],grid:['face/face_base']},new AbortController().signal);
  const info=JSON.parse((result.contentItems[0] as {text:string}).text);
  assert.equal(builds,1); assert.equal(info.revision,'saved-kra-revision');
  assert.deepEqual(info.frames.map((frame:any)=>[frame.x,frame.grid[0].points[0][0],frame.revision]),[[0,20,'saved-kra-revision'],[-15,15,'saved-kra-revision'],[-30,10,'saved-kra-revision']]);
  const meta=await sharp(info.savedPath).metadata(); assert.deepEqual([meta.width,meta.height],[180,88]);
  await assert.rejects(tool.execute({frames:[{}],x:0},new AbortController().signal),/不能同时/);
});
