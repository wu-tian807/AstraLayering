import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,realpath,readFile,writeFile,rm,stat,symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { parseEnv } from 'node:util';
import { createEnvironmentConfig, EnvironmentConflict, patchEnvironment, probeEnvironmentCli } from '../environment-config.ts';
import { createWorkbench } from '../server.ts';
import { loadWorkflowEnvironment } from '../../.agents/skills/live2d-maker/shared/codex/environment.ts';
import { imageSteps, imageModelKey } from '../../.agents/skills/live2d-maker/shared/agents/models.ts';
import { videoModels } from '../../.agents/skills/live2d-maker/shared/video.ts';

async function fixture(t:any, text?:string, env:NodeJS.ProcessEnv={}) {
 const directory=await realpath(await mkdtemp(join(tmpdir(),'astra-env-')));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const template=await readFile(new URL('../../.agents/skills/live2d-maker/example.env',import.meta.url),'utf8');
 await writeFile(join(directory,'example.env'),template);
 if(text!==undefined)await writeFile(join(directory,'.env'),text);
 const environment=createEnvironmentConfig({directory,env,authentication:async()=>({kind:'unknown',configured:false}),probe:async(h)=>({available:h==='codex',detail:h==='codex'?'CLI 1.2.3':'请安装 '+h+' CLI',path:h})});
 return {directory,template,environment};
}
test('preview masks multiline and inherited credentials while exposing resolved roles and unified provider sources',async t=>{
 const f=await fixture(t,"codex_api_key='test-secret-value'\nclaude_api_key=file-claude-secret\nCUSTOM_TOKEN='first\nsecond'\n",{ANTHROPIC_API_KEY:'shell-secret-value',ANTHROPIC_BASE_URL:'https://gateway.example'});
 const data=await f.environment.read();
 const serialized=JSON.stringify(data);
 for(const secret of ['test-secret-value','file-claude-secret','shell-secret-value','first\\nsecond'])assert.ok(!serialized.includes(secret));
 assert.match(data.preview,/CUSTOM_TOKEN=\[已隐藏\]/);
 assert.equal(data.fields.filter(f=>f.section==='llm').length,14);
 assert.deepEqual(data.fields.filter(f=>f.section==='image').map(f=>f.key), ['default_image_model', ...imageSteps().map(imageModelKey)]);
 assert.ok(!data.fields.some(f=>f.key==='raster_step03_image_model'));
 const claude=data.fields.find(f=>f.key==='claude_api_key')!;
 assert.equal(claude.overridden,false);assert.equal(claude.sourceKey,'claude_api_key');assert.equal(claude.effectiveConfigured,true);
 assert.equal(data.providers?.claude.baseUrl,'https://gateway.example');
 assert.equal(data.models.find(m=>m.id==='claude-sonnet-5-5')?.available,false);
});
test('Codex is managed by the pipeline and no executable-path field can be saved', async t => {
 const f=await fixture(t,'# keep\n'),data=await f.environment.read();
 assert.equal(data.fields.some(field=>field.key==='codex_path'),false);
 await assert.rejects(f.environment.save({revision:data.revision,changes:{codex_path:'/local/codex'}}),/字段无效/);
 const codex=await probeEnvironmentCli('codex',{codex_path:'/missing/local-codex'},{codex_path:'/missing/env-codex',PATH:''},f.directory);
 assert.equal(codex.available,true);assert.equal(codex.path,'');assert.match(codex.detail,/管线内置补丁版/);
 assert.equal(await readFile(join(f.directory,'.env'),'utf8'),'# keep\n');
});
test('saves selected keys atomically, preserving comments, CRLF, secrets, unknown multiline records and budgets',async t=>{
 const original="# Local settings\r\npreparation_agent_model=gpt-6.1-sol-low # keep this note\r\ncodex_api_key='unchanged-secret'\r\nCUSTOM='first\r\nsecond # still value'\r\ncodex_request_compact_mib=80\r\n";
 const f=await fixture(t,original),before=await f.environment.read();
 const changes={preparation_agent_model:'gpt-6.1-sol-high',part_simplify_image_model:'gpt-image-2.5-flare',openai_image_api_key:'image-secret',openai_image_base_url:'https://images.example/v1'};
 await f.environment.preview({revision:before.revision,changes});
 assert.equal(await readFile(join(f.directory,'.env'),'utf8'),original);
 const saved=await f.environment.save({revision:before.revision,changes});
 const bytes=await readFile(join(f.directory,'.env'),'utf8');
 assert.ok(bytes.includes("codex_api_key='unchanged-secret'\r\nCUSTOM='first\r\nsecond # still value'\r\ncodex_request_compact_mib=80\r\n"));
 assert.match(bytes,/gpt-6.1-sol-high # keep this note\r\n/);
 assert.ok(!bytes.replaceAll('\r\n','').includes('\n'));
 assert.ok(!JSON.stringify(saved).includes('image-secret'));
 const settings=loadWorkflowEnvironment({},f.directory);
 assert.equal(settings.stepModels.part_standardize.effort,'high');
 assert.equal(settings.stepImages.part_simplify,'gpt-image-2.5-flare');
 assert.equal(settings.imageApis.openai?.baseUrl,'https://images.example/v1');
 assert.equal(settings.imageBudgets?.codex.bytes,80*1024*1024);
 if(process.platform!=='win32')assert.equal((await stat(join(f.directory,'.env'))).mode&0o777,0o600);
});
test('rejects stale and concurrent writes, unsupported keys, missing CLIs and broken connections without changing the file',async t=>{
 const f=await fixture(t,'# unchanged\n'),source=await f.environment.read();
 await assert.rejects(f.environment.save({revision:source.revision,changes:{preparation_agent_model:'claude-sonnet-5-5-high'}}),/安装.*claude/);
 await assert.rejects(f.environment.save({revision:source.revision,changes:{PATH:'arbitrary'}}),/字段无效/);
 await assert.rejects(f.environment.save({revision:source.revision,changes:{codex_base_url:'https://gateway.example'}}),/缺少鉴权/);
 assert.equal(await readFile(join(f.directory,'.env'),'utf8'),'# unchanged\n');
 const result=await Promise.allSettled([f.environment.save({revision:source.revision,changes:{preparation_agent_model:'gpt-6.1-sol-high'}}),f.environment.save({revision:source.revision,changes:{preparation_agent_model:'gpt-6.1-sol-medium'}})]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.ok(result.some(r=>r.status==='rejected'&&r.reason instanceof EnvironmentConflict));
});
test('keeps an unchanged masked credential, allows explicit clearing, and creates missing .env from the current template',async t=>{
 const f=await fixture(t),source=await f.environment.read();assert.equal(source.exists,false);
 const first=await f.environment.save({revision:source.revision,changes:{codex_api_key:'initial-secret'}});
 const second=await f.environment.save({revision:first.revision,changes:{preparation_agent_model:'gpt-6.1-sol-medium'}});
 assert.equal(parseEnv(await readFile(join(f.directory,'.env'),'utf8')).codex_api_key,'initial-secret');
 await f.environment.save({revision:second.revision,changes:{codex_api_key:''}});
 assert.equal(parseEnv(await readFile(join(f.directory,'.env'),'utf8')).codex_api_key,'');
 assert.ok((await readFile(join(f.directory,'.env'),'utf8')).includes('# 三种主模型 CLI 共用'));
});
test('ordinary values round-trip quotes and Windows paths; unrelated records stay byte-identical',()=>{
 const original="# untouched\nEXTRA='a\n# part of the multiline value\nb'\nA=old\nA=duplicate\n";
 const patched=patchEnvironment(original,{A:'C:\\Program Files\\tool',B:'value # punctuation',C:'both " quotes'});
 assert.ok(patched.startsWith(original.split('A=old')[0]));
 assert.equal(parseEnv(patched).A,'C:\\Program Files\\tool');
 assert.equal(parseEnv(patched).B,'value # punctuation');
 assert.equal(parseEnv(patched).C,'both " quotes');
 assert.equal(patched.match(/^A=/gm)?.length,1);
});
test('refuses symlinked .env and keeps its external target untouched',async t=>{
 const f=await fixture(t);const target=join(f.directory,'external');await writeFile(target,'KEEP=yes');
 await symlink(target,join(f.directory,'.env'));
 await assert.rejects(f.environment.read(),/普通文件/);
 assert.equal(await readFile(target,'utf8'),'KEEP=yes');
});
test('HTTP save is same-origin, revision-checked, and the next task start reads the saved configuration',async t=>{
 const f=await fixture(t,'preparation_agent_model=gpt-6.1-sol-low\n');
 let observed='';const runs=join(f.directory,'runs');
 const server=await createWorkbench({settingsPath:join(f.directory,'settings.json'),defaultDir:runs,environment:f.environment,preflight:async()=>{},start:async()=>{observed=loadWorkflowEnvironment({},f.directory).stepModels.part_standardize.effort;return 123;}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const url='http://127.0.0.1:'+(server.address() as any).port;
 const post=(path:string,body:any,extra={})=>fetch(url+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({dir:runs,...body})});
 const source=await (await fetch(url+'/api/config/environment')).json() as any;
 const edit={revision:source.revision,changes:{preparation_agent_model:'gpt-6.1-sol-high'}};
 assert.equal((await post('config/environment',edit,{Origin:'https://unrelated.example'})).status,403);
 assert.equal((await post('config/environment/preview',edit)).status,200);
 assert.equal(loadWorkflowEnvironment({},f.directory).stepModels.part_standardize.effort,'low');
 assert.equal((await post('config/environment',edit)).status,200);
 assert.equal((await post('config/environment',edit)).status,409);
 const image=await sharp({create:{width:8,height:8,channels:3,background:'#f9cdde'}}).png().toBuffer();
 assert.equal((await post('tasks',{name:'test',upload:image.toString('base64')})).status,201);
 assert.equal((await post('start',{name:'test'})).status,202);
 assert.equal(observed,'high');
});

test('web defaults, runtime fallback and generated .env follow the skill template after model changes',async t=>{
 const f=await fixture(t);
 let template=f.template.replace(/^\w+_agent_model=.*$/gm,line=>line.split('=')[0]+'=gpt-6-astra-high');
 template=template.replace('default_image_model=codex-native','default_image_model=gpt-image-2.5-flare');
 template=template.replace('part_base_subject_image_model=','part_base_subject_image_model=gemini-nano-banana-2.1');
 await writeFile(join(f.directory,'example.env'),template);
 const data=await f.environment.read();
 for(const field of data.fields.filter(field=>field.section==='llm')){
  assert.equal(field.fallback,'gpt-6-astra-high');assert.equal(field.effective,'gpt-6-astra-high');
 }
 assert.equal(data.fields.find(field=>field.key==='default_image_model')?.fallback,'gpt-image-2.5-flare');
 assert.equal(data.fields.find(field=>field.key==='part_base_subject_image_model')?.effective,'gemini-nano-banana-2.1');
 const before=loadWorkflowEnvironment({},f.directory);
 await f.environment.save({revision:data.revision,changes:{}});
 assert.equal(await readFile(join(f.directory,'.env'),'utf8'),template);
 const after=loadWorkflowEnvironment({},f.directory);
 assert.deepEqual(after.stepModels,before.stepModels);assert.deepEqual(after.stepImages,before.stepImages);
});

test('head configuration names the shared maker role and exposes the actual video fields and supported models', async t => {
 const f=await fixture(t),data=await f.environment.read();
 const maker=data.fields.find(field=>field.key==='nine_axis_head_agent_model')!;

 const services=data.fields.filter(field=>field.section==='video-api'),models=data.fields.filter(field=>field.section==='video');
 assert.deepEqual(services.map(field=>field.key),['video_provider','video_base_url','video_api_key']);
 assert.deepEqual(models.map(field=>field.key),['nine_axis_view_video_model']);
 assert.equal(services[2].secret,true);assert.equal(models[0].type,'video');assert.deepEqual(data.videoModels,[...videoModels]);
 assert.ok(!data.fields.some(field=>field.section==='advanced'&&['video_base_url','video_api_key','nine_axis_view_video_model'].includes(field.key)));
 const saved=await f.environment.save({revision:data.revision,changes:{nine_axis_head_agent_model:'gpt-6-astra-high',video_base_url:'https://video.example/v1',video_api_key:'video-test-secret',nine_axis_view_video_model:'seedance-2-fast'}});
 assert.ok(!JSON.stringify(saved).includes('video-test-secret'));
 const settings=loadWorkflowEnvironment({},f.directory);
 for(const step of ['nine_axis_head','nine_axis_head_hair','nine_axis_head_accessories'] as const)assert.equal(settings.stepModels[step].model,'gpt-6-astra');
 assert.equal(settings.videoApi?.model,'seedance-2-fast');
});

test('every editable field exists once in the initialization template and default creation preserves all bytes',async t=>{
 const f=await fixture(t),data=await f.environment.read(),template=parseEnv(f.template),keys=data.fields.map(field=>field.key);
 assert.equal(new Set(keys).size,keys.length);for(const key of keys)assert.ok(Object.hasOwn(template,key),key);
 await f.environment.save({revision:data.revision,changes:{}});assert.equal(await readFile(join(f.directory,'.env'),'utf8'),f.template);
 const actual=loadWorkflowEnvironment({},f.directory);assert.equal(actual.stepModels.nine_axis_head_hair.model,actual.stepModels.nine_axis_head.model);assert.equal(actual.videoApi,undefined);
});

test('local values win across field families; clearing falls back to startup and saving changes actual runtime settings',async t=>{
 const local={preparation_agent_model:'gpt-6.1-sol-low',default_image_model:'codex-native',agv_request_compact_mib:'80',claude_image_deduplicate:'false',krita_max_instances:'2',update_check:'false',DISPLAY:':local',nine_axis_view_video_model:'seedance-2-fast'};
 const startup={preparation_agent_model:'gpt-6-astra-high',default_image_model:'gpt-image-2.5-flare',agv_request_compact_mib:'90',claude_image_deduplicate:'true',krita_max_instances:'6',update_check:'true',DISPLAY:':startup',nine_axis_view_video_model:'seedance-2.5'};
 const f=await fixture(t,Object.entries(local).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',startup),data=await f.environment.read();
 for(const [key,value] of Object.entries(local)){const field=data.fields.find(field=>field.key===key)!;assert.equal(field.source,'file',key);assert.equal(field.effective,value,key);}
 const saved=await f.environment.save({revision:data.revision,changes:{preparation_agent_model:'gpt-6.1-sol-high',agv_request_compact_mib:'',krita_max_instances:'3'}});
 assert.equal(saved.fields.find(field=>field.key==='agv_request_compact_mib')?.source,'environment');
 const actual=loadWorkflowEnvironment(startup,f.directory);assert.equal(actual.stepModels.part_pose_judgment.effort,'high');assert.equal(actual.imageBudgets?.agv.bytes,90*1048576);assert.equal(actual.codex.env!.krita_max_instances,'3');assert.equal(actual.codex.env!.DISPLAY,':local');
});

test('all three connections report effective key and URL sources including aliases without returning secrets',async t=>{
 const f=await fixture(t,'codex_api_key=LOCAL_CODEX\nclaude_api_key=LOCAL_CLAUDE\nclaude_base_url=https://local.test\n',{codex_api_key:'STARTUP_CODEX',ANTHROPIC_API_KEY:'STARTUP_CLAUDE',ANTHROPIC_BASE_URL:'https://startup.test',AGY_LLM_GATEWAY_API_KEY:'STARTUP_AGV',AGY_LLM_GATEWAY_URL:'https://agv.test'});
 const data=await f.environment.read();
 for(const h of ['codex','claude','agv']){const field=data.fields.find(field=>field.key===h+'_api_key')!;assert.equal(field.source,h==='agv'?'environment':'file');assert.equal(field.effectiveConfigured,true);assert.equal(field.value,'');assert.equal(field.effective,undefined);assert.equal(data.connections[h].mode,'api');}
 assert.equal(data.fields.find(field=>field.key==='agv_base_url')?.sourceKey,'AGY_LLM_GATEWAY_URL');assert.equal(data.fields.find(field=>field.key==='claude_base_url')?.effective,'https://local.test');
 for(const secret of ['LOCAL_CODEX','LOCAL_CLAUDE','STARTUP_CODEX','STARTUP_CLAUDE','STARTUP_AGV'])assert.ok(!JSON.stringify(data).includes(secret));
});

test('account and unknown CLI modes stay distinct; explicit API credentials avoid native-auth probing',async t=>{
 const f=await fixture(t),calls:string[]=[];
 const config=createEnvironmentConfig({directory:f.directory,env:{},probe:async()=>({available:true,detail:'fixture',path:''}),authentication:async h=>{calls.push(h);return {kind:h==='agv'?'unknown':'account',configured:h!=='agv'};}});
 const data=await config.read();assert.equal(data.connections.codex.mode,'account');assert.equal(data.connections.claude.mode,'account');assert.equal(data.connections.agv.mode,'cli');
 assert.equal(data.fields.find(field=>field.key==='codex_api_key')?.source,'cli');assert.equal(data.fields.find(field=>field.key==='codex_api_key')?.effectiveConfigured,true);
 calls.length=0;const preview=await config.preview({revision:data.revision,changes:{codex_api_key:'API_SECRET'}});
 assert.equal(preview.connections.codex.mode,'api');assert.ok(!calls.includes('codex'));assert.ok(!JSON.stringify(preview).includes('API_SECRET'));
});

test('custom model IDs are offered and saved through the declared harness; unknown or ambiguous IDs cannot silently route',async t=>{
 const f=await fixture(t,'codex_models=gpt-6.1-sol,gpt-6-astra,custom/router-model\n');
 let data=await f.environment.read();assert.equal(data.models.find(model=>model.id==='custom/router-model')?.harness,'codex');
 const saved=await f.environment.save({revision:data.revision,changes:{preparation_agent_model:'custom/router-model-high'}});
 const model=loadWorkflowEnvironment({},f.directory).stepModels.part_pose_judgment;
 assert.deepEqual(model,{model:'custom/router-model',effort:'high',harness:'codex'});
 await assert.rejects(f.environment.save({revision:saved.revision,changes:{preparation_agent_model:'undeclared-model-high'}}),/codex_models/);
 await assert.rejects(f.environment.save({revision:saved.revision,changes:{claude_models:'custom/router-model'}}),/多个服务/);
 assert.deepEqual(loadWorkflowEnvironment({},f.directory).stepModels.part_pose_judgment,model);
 data=await f.environment.read();assert.equal(data.fields.find(field=>field.key==='preparation_agent_model')?.effective,'custom/router-model-high');
});

test('shared model-rule validation blocks malformed drafts, extends defaults and routes free-form image/video IDs',async t=>{
 const f=await fixture(t),initial=await f.environment.read();
 for(const key of ['codex_models','claude_models','agv_models','openai_image_models','google_image_models'])for(const rule of ['*','**-**','-*-*','model-**']) {
  await assert.rejects(f.environment.preview({revision:initial.revision,changes:{[key]:rule}}));
  await assert.rejects(f.environment.save({revision:initial.revision,changes:{[key]:rule}}));
 }
 const saved=await f.environment.save({revision:initial.revision,changes:{codex_models:'custom-*',part_draw_agent_model:'custom-v3-high',
  openai_image_models:'custom-image-*',default_image_model:'custom-image-v4',openai_image_base_url:'https://images.test/v1',openai_image_api_key:'image-secret-fixture',
  video_provider:'openrouter',nine_axis_view_video_model:'custom-seedance-v5',video_base_url:'https://video.test/v1',video_api_key:'video-secret-fixture'}});
 assert.ok(!saved.models.some(model=>model.id.includes('*')));
 assert.ok(saved.models.some(model=>model.id==='custom-v3'&&model.harness==='codex'));
 const settings=loadWorkflowEnvironment({},f.directory);
 assert.deepEqual(settings.providers!.codex.models,['gpt-*','custom-*']);
 assert.deepEqual(settings.imageRules!.openai,['gpt-*','custom-image-*']);
 assert.equal(settings.videoApi!.provider,'openrouter');assert.equal(settings.videoApi!.model,'custom-seedance-v5');
 assert.equal(settings.stepImages.raster_step01,'custom-image-v4');
 assert.doesNotMatch(JSON.stringify(saved),/image-secret-fixture|video-secret-fixture/);
});
