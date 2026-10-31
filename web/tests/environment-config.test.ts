import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,realpath,readFile,writeFile,rm,stat,symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { parseEnv } from 'node:util';
import { createEnvironmentConfig, EnvironmentConflict, patchEnvironment } from '../environment-config.ts';
import { createWorkbench } from '../server.ts';
import { loadWorkflowEnvironment } from '../../.agents/skills/live2d-maker/shared/codex/environment.ts';

async function fixture(t:any, text?:string, env:NodeJS.ProcessEnv={}) {
 const directory=await realpath(await mkdtemp(join(tmpdir(),'astra-env-')));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const template=await readFile(new URL('../../.agents/skills/live2d-maker/example.env',import.meta.url),'utf8');
 await writeFile(join(directory,'example.env'),template);
 if(text!==undefined)await writeFile(join(directory,'.env'),text);
 const environment=createEnvironmentConfig({directory,env,probe:async(h)=>({available:h==='codex',detail:h==='codex'?'CLI 1.2.3':'请安装 '+h+' CLI',path:h})});
 return {directory,template,environment};
}
test('preview masks multiline and inherited credentials while exposing resolved roles and unified provider sources',async t=>{
 const f=await fixture(t,"layering_codex_api_key='test-secret-value'\nlayering_claude_api_key=file-claude-secret\nCUSTOM_TOKEN='first\nsecond'\n",{ANTHROPIC_API_KEY:'shell-secret-value',ANTHROPIC_BASE_URL:'https://gateway.example'});
 const data=await f.environment.read();
 const serialized=JSON.stringify(data);
 for(const secret of ['test-secret-value','file-claude-secret','shell-secret-value','first\\nsecond'])assert.ok(!serialized.includes(secret));
 assert.match(data.preview,/CUSTOM_TOKEN=\[已隐藏\]/);
 assert.equal(data.fields.filter(f=>f.section==='llm').length,13);
 assert.equal(data.fields.filter(f=>f.section==='image').length,19);
 const claude=data.fields.find(f=>f.key==='layering_claude_api_key')!;
 assert.equal(claude.overridden,true);assert.equal(claude.sourceKey,'ANTHROPIC_API_KEY');
 assert.equal(data.providers?.claude.baseUrl,'https://gateway.example');
 assert.equal(data.models.find(m=>m.id==='claude-sonnet-5-5')?.available,false);
});
test('saves selected keys atomically, preserving comments, CRLF, secrets, unknown multiline records and budgets',async t=>{
 const original="# Local settings\r\nlayering_agent_preparation_model=gpt-6.1-sol-low # keep this note\r\nlayering_codex_api_key='unchanged-secret'\r\nCUSTOM='first\r\nsecond # still value'\r\nlayering_codex_request_compact_mib=80\r\n";
 const f=await fixture(t,original),before=await f.environment.read();
 const changes={layering_agent_preparation_model:'gpt-6.1-sol-high',layering_part_simplify_image_model:'gpt-image-2.5-flare',layering_openai_image_api_key:'image-secret',layering_openai_image_base_url:'https://images.example/v1'};
 await f.environment.preview({revision:before.revision,changes});
 assert.equal(await readFile(join(f.directory,'.env'),'utf8'),original);
 const saved=await f.environment.save({revision:before.revision,changes});
 const bytes=await readFile(join(f.directory,'.env'),'utf8');
 assert.ok(bytes.includes("layering_codex_api_key='unchanged-secret'\r\nCUSTOM='first\r\nsecond # still value'\r\nlayering_codex_request_compact_mib=80\r\n"));
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
 await assert.rejects(f.environment.save({revision:source.revision,changes:{layering_agent_preparation_model:'claude-sonnet-5-5-high'}}),/安装.*claude/);
 await assert.rejects(f.environment.save({revision:source.revision,changes:{PATH:'arbitrary'}}),/字段无效/);
 await assert.rejects(f.environment.save({revision:source.revision,changes:{layering_codex_base_url:'https://gateway.example'}}),/缺少鉴权/);
 assert.equal(await readFile(join(f.directory,'.env'),'utf8'),'# unchanged\n');
 const result=await Promise.allSettled([f.environment.save({revision:source.revision,changes:{layering_agent_preparation_model:'gpt-6.1-sol-high'}}),f.environment.save({revision:source.revision,changes:{layering_agent_preparation_model:'gpt-6.1-sol-medium'}})]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.ok(result.some(r=>r.status==='rejected'&&r.reason instanceof EnvironmentConflict));
});
test('keeps an unchanged masked credential, allows explicit clearing, and creates missing .env from the current template',async t=>{
 const f=await fixture(t),source=await f.environment.read();assert.equal(source.exists,false);
 const first=await f.environment.save({revision:source.revision,changes:{layering_codex_api_key:'initial-secret'}});
 const second=await f.environment.save({revision:first.revision,changes:{layering_agent_preparation_model:'gpt-6.1-sol-medium'}});
 assert.equal(parseEnv(await readFile(join(f.directory,'.env'),'utf8')).layering_codex_api_key,'initial-secret');
 await f.environment.save({revision:second.revision,changes:{layering_codex_api_key:''}});
 assert.equal(parseEnv(await readFile(join(f.directory,'.env'),'utf8')).layering_codex_api_key,'');
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
 const f=await fixture(t,'layering_agent_preparation_model=gpt-6.1-sol-low\n');
 let observed='';const runs=join(f.directory,'runs');
 const server=await createWorkbench({settingsPath:join(f.directory,'settings.json'),defaultDir:runs,environment:f.environment,preflight:async()=>{},start:async()=>{observed=loadWorkflowEnvironment({},f.directory).stepModels.part_standardize.effort;return 123;}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const url='http://127.0.0.1:'+(server.address() as any).port;
 const post=(path:string,body:any,extra={})=>fetch(url+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({dir:runs,...body})});
 const source=await (await fetch(url+'/api/config/environment')).json() as any;
 const edit={revision:source.revision,changes:{layering_agent_preparation_model:'gpt-6.1-sol-high'}};
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
 let template=f.template.replace(/^layering_agent_\w+_model=.*$/gm,line=>line.split('=')[0]+'=gpt-6-astra-high');
 template=template.replace('layering_default_image_model=codex-native','layering_default_image_model=gpt-image-2.5-flare');
 template=template.replace('layering_part_base_subject_image_model=','layering_part_base_subject_image_model=gemini-nano-banana-2.1');
 await writeFile(join(f.directory,'example.env'),template);
 const data=await f.environment.read();
 for(const field of data.fields.filter(field=>field.section==='llm')){
  assert.equal(field.fallback,'gpt-6-astra-high');assert.equal(field.effective,'gpt-6-astra-high');
 }
 assert.equal(data.fields.find(field=>field.key==='layering_default_image_model')?.fallback,'gpt-image-2.5-flare');
 assert.equal(data.fields.find(field=>field.key==='layering_part_base_subject_image_model')?.effective,'gemini-nano-banana-2.1');
 const before=loadWorkflowEnvironment({},f.directory);
 await f.environment.save({revision:data.revision,changes:{}});
 assert.equal(await readFile(join(f.directory,'.env'),'utf8'),template);
 const after=loadWorkflowEnvironment({},f.directory);
 assert.deepEqual(after.stepModels,before.stepModels);assert.deepEqual(after.stepImages,before.stepImages);
});
