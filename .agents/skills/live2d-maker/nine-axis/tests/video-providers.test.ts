import assert from 'node:assert/strict';
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
 if(provider==='volcengine') {
  assert.equal(requests[0].url,baseUrl+'/contents/generations/tasks');
  assert.equal(body.content[1].role,'first_frame');assert.match(body.content[1].image_url.url,/^data:image\/png;base64,/);
  assert.equal(body.duration,5);assert.equal(body.generate_audio,false);assert.equal(body.ratio,'1:1');
  assert.equal(requests.at(-1)!.init?.headers,undefined);
 }else if(provider==='openrouter') {
  assert.equal(body.duration,5);assert.equal(body.seconds,undefined);assert.equal(body.frame_images[0].frame_type,'first_frame');
  assert.equal(requests.at(-1)!.url,baseUrl+'/videos/task-1/content?index=0');
 }else {
  assert.equal(body.seconds,'5');assert.match(body.input_reference,/^data:image\/png;base64,/);
  assert.equal(requests.at(-1)!.url,baseUrl+'/videos/task-1/content');
 }
});
test('video defaults are native, arbitrary model IDs work and invalid providers fail before a request',()=>{
 const config=parseWorkflowEnvironment('video_base_url=https://video.test/api\nvideo_api_key=fixture');
 assert.equal(config.videoApi?.provider,'volcengine');assert.equal(config.videoApi?.model,'doubao-seedance-2-5-260628');
 assert.equal(parseWorkflowEnvironment('video_provider=openai\nnine_axis_view_video_model=my-seedance-2').codex.env!.video_provider,'openai');
 assert.throws(()=>parseWorkflowEnvironment('video_provider=unsupported'),/video_provider/);
 assert.throws(()=>parseWorkflowEnvironment('nine_axis_view_video_model=*'),/模型 ID/);
});
