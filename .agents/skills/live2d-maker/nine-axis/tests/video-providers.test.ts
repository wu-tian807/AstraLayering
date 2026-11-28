import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {generateVideo} from '../turn.ts';
import {parseWorkflowEnvironment} from '../../shared/codex/environment.ts';
import {videoProviders} from '../../shared/video.ts';
for(const provider of videoProviders)test(`${provider} submits first frame, polls and downloads using its own protocol`,async t=>{
 const requests:{url:string;init?:RequestInit}[]=[];let downloads=0;
 const baseUrl='https://video.test/api',api={provider,baseUrl,apiKey:'secret-fixture',model:'my-seedance-model'};
 t.mock.method(globalThis,'fetch',async (url:string,init?:RequestInit)=>{
  requests.push({url,init});
  if(init?.method==='POST')return Response.json({id:'task-1',status:'queued'});
  if(url.endsWith('/task-1'))return Response.json(provider==='volcengine'?{status:'succeeded',content:{video_url:'https://cdn.test/result.mp4'}}:{status:'completed'});
  if(++downloads===1)return new Response('',{status:503});
  return new Response('mp4',{headers:{'content-length':'3'}});
 });
 const result=await generateVideo(api,'turn',Buffer.from('png'),{poll:1});
 assert.equal(result.bytes.toString(),'mp4');assert.equal(downloads,2);
 const body=JSON.parse(requests[0].init!.body as string);
 assert.equal(body.model,api.model);
 assert.equal(Object.hasOwn(body,'ratio'),false);
 assert.equal(Object.hasOwn(body,'aspect_ratio'),false);
 if(provider==='volcengine') {
  assert.equal(requests[0].url,baseUrl+'/contents/generations/tasks');
  assert.equal(body.content[1].role,'first_frame');assert.match(body.content[1].image_url.url,/^data:image\/png;base64,/);
  assert.equal(body.duration,5);assert.equal(body.generate_audio,false);
  assert.equal(requests.at(-1)!.init?.headers,undefined);
 }else if(provider==='openrouter') {
  assert.equal(body.duration,5);assert.equal(body.seconds,undefined);assert.equal(body.frame_images[0].frame_type,'first_frame');
  assert.equal(requests.at(-1)!.url,baseUrl+'/videos/task-1/content?index=0');
 }else {
  assert.equal(body.seconds,'5');assert.match(body.input_reference,/^data:image\/png;base64,/);
  assert.equal(requests.at(-1)!.url,baseUrl+'/videos/task-1/content');
 }
});

for (const provider of ['volcengine', 'openrouter'] as const) {
 test(`${provider} resumes a job submitted before the explicit aspect ratio was removed`, async t => {
  const baseUrl = 'https://video.test/api', model = 'fixture-model', prompt = 'turn', image = Buffer.from('png');
  const url = `data:image/png;base64,${image.toString('base64')}`;
  const body = provider === 'volcengine'
   ? { model, content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url }, role: 'first_frame' }],
     duration: 5, resolution: '720p', ratio: '1:1', generate_audio: false }
   : { model, prompt, duration: 5, resolution: '720p', aspect_ratio: '1:1', generate_audio: false,
     frame_images: [{ type: 'image_url', image_url: { url }, frame_type: 'first_frame' }] };
  const requestHash = createHash('sha256').update(JSON.stringify({ provider, baseUrl, body })).digest('hex');
  const checkpoint = {
   read: async () => ({ version: 1 as const, id: 'existing-video', requestHash }),
   write: async () => assert.fail('An existing video job must not be replaced'),
  };
  const calls = t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
   assert.notEqual(init?.method, 'POST');
   if (url.endsWith('/existing-video')) return Response.json(provider === 'volcengine'
    ? { status: 'succeeded', content: { video_url: 'https://cdn.test/video.mp4' } } : { status: 'completed' });
   return new Response('mp4');
  });
  const api = { provider, baseUrl, model, apiKey: 'fixture-key' };
  const result = await generateVideo(api, prompt, image, { checkpoint });
  assert.equal(result.id, 'existing-video');
  assert.equal(result.bytes.toString(), 'mp4');
  assert.equal(calls.mock.callCount(), 2);
 });
}

test('video defaults are native, arbitrary model IDs work and invalid providers fail before a request',()=>{
 const config=parseWorkflowEnvironment('video_base_url=https://video.test/api\nvideo_api_key=fixture');
 assert.equal(config.videoApi?.provider,'volcengine');assert.equal(config.videoApi?.model,'doubao-seedance-2-5-260628');
 assert.equal(parseWorkflowEnvironment('video_provider=openai\nnine_axis_view_video_model=my-seedance-2').codex.env!.video_provider,'openai');
 assert.throws(()=>parseWorkflowEnvironment('video_provider=unsupported'),Error);
 assert.throws(()=>parseWorkflowEnvironment('nine_axis_view_video_model=*'),Error);
});
