import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createNineAxisViewTool } from '../view-tool.ts';
import type { Built } from '../head.ts';

const grid = (x0: number, y0: number, x1: number, y1: number, dx = 0) => [[x0 + dx, y0], [x1 + dx, y0], [x0 + dx, y1], [x1 + dx, y1]];

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
  assert.deepEqual(info.grid, [{ id: 'face/face_base', cols: 1, rows: 1, points: grid(30, 30, 70, 70, -20) }]);
  assert.deepEqual(await pixel({ x: -30, grid: ['face/face_base'] }, 10, 30), [0x1d, 0x3a, 0x4a]);
  await assert.rejects(tool.execute({ grid: ['face/nose'] }, signal), /grid/);
  await assert.rejects(tool.execute({ y: 10 }, signal), /ParamAngleY/);
  await assert.rejects(tool.execute({ x: 40 }, signal), /-30 至 30/);
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
