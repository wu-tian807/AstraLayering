import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { createServer, type RequestListener } from 'node:http';
import { once, getEventListeners } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { generateVideo, producePitchVideos, produceCornerVideos, runFrameSelection, ffmpegPath } from '../turn.ts';
import { createFrameTool } from '../frame-tool.ts';
import { runWorkflow } from '../run.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { missingDeliveries } from '../../shared/step-deliveries.ts';
import { joint } from './axis-fixtures.ts';

async function fixture(t:any){const root=await mkdtemp(join(tmpdir(),'nine-production-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}

const videoEnvironment = () => loadWorkflowEnvironment({ video_base_url: 'https://video.example/v1', video_api_key: 'fixture' });
const mockInput = async () => ({ color: '/unused/character.png', parts: [], source: { id: 'fixture', directory: '/unused' } });
const mockFFmpeg = async (executable: string) => ({ executable, version: 'ffmpeg version fixture' });

test('missing video configuration refuses preparation before reading inputs or creating outputs', async t => {
  const root = await fixture(t);
  await assert.rejects(runWorkflow({ name: 'case', dir: root, ffmpeg: process.execPath, step: 'step01_preparation' }, {
    environment: loadWorkflowEnvironment({}), ffmpegCheck: mockFFmpeg,
    resolveInput: async () => assert.fail('startup must refuse before preparing inputs'),
  }), /生视频接口/);
  await assert.rejects(readFile(join(root, 'case/nine-axis/step01_preparation/.completed')), { code: 'ENOENT' });
});

for (const step of ['step02_video', 'step03_frames', 'step07_jaw-line', 'step04_angles/video', 'step04_angles/model']) {
  test(`completed ${step} cannot hide missing deliveries`, async t => {
    const root = await fixture(t), folder = join(root, 'case/nine-axis', step);
    await mkdir(folder, { recursive: true }); await writeFile(join(folder, '.completed'), '');
    if (step.includes('/')) await writeFile(join(root, 'case/nine-axis/step04_angles/.running'), '');
    await assert.rejects(runWorkflow({ name: 'case', dir: root, ffmpeg: process.execPath, step }, {
      environment: videoEnvironment(), ffmpegCheck: mockFFmpeg, resolveInput: mockInput,
    }), /缺少非空交付文件/);
    assert.equal(await readFile(join(folder, '.completed'), 'utf8'), '');
  });
}

test('actual MP4s satisfy video delivery without the optional summary; empty files do not', async t => {
  const root = await fixture(t), nine = join(root, 'case/nine-axis'), folder = join(nine, 'step02_video');
  await mkdir(folder, { recursive: true });
  for (const file of ['upper-body.png', 'crop.json', 'left.mp4', 'up.mp4', 'down.mp4']) await writeFile(join(folder, file), 'fixture bytes');
  await writeFile(join(folder, '.completed'), '');
  assert.deepEqual(await missingDeliveries(nine, 'nine-axis', 'step02_video'), []);
  assert.match(await runWorkflow({ name: 'case', dir: root, ffmpeg: process.execPath, step: 'step02_video' }, {
    environment: videoEnvironment(), ffmpegCheck: mockFFmpeg, resolveInput: mockInput,
  }), /沿用/);
  await writeFile(join(folder, 'up.mp4'), '');
  assert.deepEqual(await missingDeliveries(nine, 'nine-axis', 'step02_video'), [join(folder, 'up.mp4')]);
});

test('a failed corner outline waits for its successful sibling before returning the failure', async t => {
  const root = await fixture(t), model = join(root, 'case/nine-axis/step04_angles/model');
  await mkdir(join(model, 'layers'), { recursive: true });
  const doc = joint(); await writeFile(join(model, 'deformers.json'), JSON.stringify(doc));
  const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#888' } }).png().toBuffer();
  for (const part of doc.parts) await writeFile(join(model, part.texture), png);
  let entered = 0, siblingFinished = false;
  const both = Promise.withResolvers<void>();
  await assert.rejects(runWorkflow({ name: 'case', dir: root, ffmpeg: process.execPath, step: 'step06_angle-xy' }, {
    environment: videoEnvironment(), ffmpegCheck: mockFFmpeg, resolveInput: mockInput,
    fitAngleXY: async () => assert.fail('fit must not start after a failed outline'),
    outlineHead: async directory => {
      if (++entered === 2) both.resolve(); await both.promise;
      if (directory.endsWith('left-up')) throw new Error('left-up failed');
      await delay(30); await writeFile(join(directory, 'notes.md'), 'completed sibling'); siblingFinished = true;
    },
  }), /left-up failed/);
  assert.equal(siblingFinished, true);
  assert.equal(await readFile(join(root, 'case/nine-axis/step06_angle-xy/outline/left-down/notes.md'), 'utf8'), 'completed sibling');
  await assert.rejects(readFile(join(root, 'case/nine-axis/step06_angle-xy/.completed')), { code: 'ENOENT' });
});

for(const kind of ['pitch','corner'])test(`${kind}: a failed branch does not discard or regenerate its sibling MP4`,async t=>{
  const root=await fixture(t),input=join(root,'input'),output=join(root,'output');await mkdir(input);
  for(const name of ['upper-body.png','up.png','down.png'])await writeFile(join(input,name),name==='up.png'?'up-first':'down-first');
  const calls={up:0,down:0};let fail=true;
  const generate=async(prompt:string)=>{const view=prompt==='up'?'up':'down';calls[view]++;if(view==='down'&&fail)throw new Error('down failed');return{id:view,status:{status:'completed'},bytes:Buffer.from(view)};};
  const produce=()=>kind==='pitch'?producePitchVideos(output,input,generate,{up:'up',down:'down'},{model:'fixture'}):produceCornerVideos(output,input,async(_prompt,image)=>generate(image.toString().startsWith('up')?'up':'down'),'corner',{model:'fixture'});
  await assert.rejects(produce(),/down failed/);
  const success=join(output,(kind==='pitch'?'up':'left-up')+'.mp4');assert.equal((await readFile(success)).toString(),'up');
  await assert.rejects(readFile(join(output,'videos.json')),{code:'ENOENT'});
  fail=false;await produce();assert.deepEqual(calls,{up:1,down:2});
  await writeFile(join(output,(kind==='pitch'?'down':'left-down')+'.mp4'),'');
  await produce();assert.deepEqual(calls,{up:1,down:3});
});

test('empty generated bytes never create a successful video artifact',async t=>{
  const root=await fixture(t),input=join(root,'input'),output=join(root,'output');await mkdir(input);
  await writeFile(join(input,'upper-body.png'),'first');
  await assert.rejects(producePitchVideos(output,input,async()=>({id:'v',status:{status:'completed'},bytes:Buffer.alloc(0)}),{up:'up',down:'down'},{model:'fixture'}),/没有产出视频内容/);
  await assert.rejects(readFile(join(output,'up.mp4')),{code:'ENOENT'});
});

test('empty selection outputs call the agent, while complete actual PNGs skip it',async t=>{
  const root=await fixture(t);await mkdir(join(root,'frames'));
  for(const file of ['left.png','frames/left.png','selected-frames.json'])await writeFile(join(root,file),'');
  let calls=0;const png=await sharp({create:{width:4,height:4,channels:3,background:'#888'}}).png().toBuffer();
  const select=async()=>{calls++;await writeFile(join(root,'left.png'),png);await writeFile(join(root,'frames/left.png'),png);await writeFile(join(root,'selected-frames.json'),JSON.stringify({version:1,frames:{left:{video:'left.mp4',path:'left.png',frameIndex:0,reason:'fixture'}}}));};
  await runFrameSelection(root,['left'],select);await runFrameSelection(root,['left'],select);assert.equal(calls,1);
});

async function server(t:any,handle:RequestListener){
  const srv=createServer(handle);srv.listen(0,'127.0.0.1');await once(srv,'listening');
  t.after(()=>{srv.closeAllConnections();return new Promise<void>(done=>srv.close(()=>done()));});
  return{baseUrl:`http://127.0.0.1:${(srv.address() as any).port}`,apiKey:'fixture',model:'fixture'};
}

for(const stage of ['submit','query','download'])test(`video deadline covers a hung ${stage}`,async t=>{
  const api=await server(t,(req,res)=>{
    if(stage==='submit'||stage==='query'&&req.method==='GET'||stage==='download'&&req.url?.endsWith('/content'))return;
    res.end(JSON.stringify({id:'v',status:stage==='query'?'queued':'completed'}));
  });
  const start=Date.now();await assert.rejects(generateVideo(api,'turn',Buffer.from('png'),{poll:1,timeout:80}));
  assert.ok(Date.now()-start<1000);
});

test('polling removes abort listeners and respects already-cancelled invocations',async t=>{
  let polls=0;
  const api=await server(t,(req,res)=>{
    if(req.url?.endsWith('/content')){res.end('mp4');return;}
    res.end(JSON.stringify({id:'v',status:req.method==='POST'||++polls<3?'queued':'completed'}));
  });
  const controller=new AbortController();await generateVideo(api,'turn',Buffer.from('png'),{signal:controller.signal,poll:1});
  assert.equal(getEventListeners(controller.signal,'abort').length,0);
  controller.abort(new Error('stopped'));await assert.rejects(generateVideo(api,'turn',Buffer.from('png'),{signal:controller.signal}),/stopped/);
});

test('an empty HTTP 200 download is refused',async t=>{
  const api=await server(t,(req,res)=>res.end(req.url?.endsWith('/content')?'':JSON.stringify({id:'v',status:'completed'})));
  await assert.rejects(generateVideo(api,'turn',Buffer.from('png')),{message:'生视频 v 下载失败'});
});

test('frame tool uses the selected custom executable with spaces and returns actual frames',async t=>{
  if(process.platform==='win32'){t.skip('Linux executable wrapper; Windows runtime not claimed');return;}
  const actual=await ffmpegPath().catch(()=>undefined);if(!actual){t.skip('FFmpeg unavailable');return;}
  const root=await fixture(t),step=join(root,'nine-axis/step03_frames'),videos=join(root,'nine-axis/step02_video');await mkdir(step,{recursive:true});await mkdir(videos);
  const video=join(videos,'left.mp4');
  await promisify(execFile)(actual,['-v','error','-y','-f','lavfi','-i','testsrc=size=16x16:rate=10','-frames:v','12','-pix_fmt','yuv420p',video]);
  const selected=join(root,'ffmpeg-custom name'),capture=join(root,'calls.jsonl');
  await writeFile(selected,`#!${process.execPath}\nimport {appendFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';appendFileSync(${JSON.stringify(capture)},JSON.stringify(process.argv.slice(2))+'\\n');const r=spawnSync(${JSON.stringify(actual)},process.argv.slice(2),{stdio:'inherit'});process.exit(r.status??1);`,{mode:0o755});
  const tool=createFrameTool({ffmpeg:selected,taskRoot:root,directory:step,videos,names:['left'],size:8});
  const output=join(step,'left.png');await tool.execute({video:'left',frameIndex:3,output},new AbortController().signal);
  assert.equal((await sharp(output).metadata()).width,8);
  assert.equal((await sharp(join(step,'frames/left.png')).metadata()).width,16);
  assert.match(await readFile(capture,'utf8'),/eq\(n/);
  await tool.execute({video:'left',timeSeconds:0.4,output:'nine-axis/step03_frames/candidate.png'},new AbortController().signal);
  assert.equal((await sharp(join(step,'candidate.png')).metadata()).width,8);
  await assert.rejects(tool.execute({video:'left',frameIndex:0,timeSeconds:0,output},new AbortController().signal),/两者只选一个/);
});
