import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, access, mkdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { imageSteps, modelSlotKey, modelSlots, stepModelSlots } from '../agents/models.ts';

const templateUrl = new URL('../../example.env', import.meta.url);
const replace = (text:string, key:string, value:string) => text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
async function fixture(t:{after(fn:()=>Promise<unknown>):void}) {
  const root=await mkdtemp(join(tmpdir(),'skill-defaults-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return root;
}

test('the skill template drives missing .env, missing role keys, legacy tiers and image defaults on each load', async t => {
  const root=await fixture(t);
  let template=await readFile(templateUrl,'utf8');
  for(const slot of modelSlots)template=replace(template,modelSlotKey(slot),'gpt-6-astra-high');
  template=replace(template,'default_image_model','gpt-image-2.5-flare');
  template=replace(template,'part_base_subject_image_model','gemini-nano-banana-2.1');
  template=replace(template,'image_model','gpt-image-2.5-flare');
  template=replace(template,'google_image_protocol','openai');
  await writeFile(join(root,'example.env'),template);
  const first=loadWorkflowEnvironment({},root);
  for(const step of Object.keys(stepModelSlots) as (keyof typeof stepModelSlots)[]) {
    assert.equal(first.stepModels[step].model,'gpt-6-astra');assert.equal(first.stepModels[step].effort,'high');
  }
  assert.deepEqual(first.models,{medium:{model:'gpt-6-astra',effort:'high'},high:{model:'gpt-6-astra',effort:'high'}});
  for(const step of imageSteps())assert.equal(first.stepImages[step],step==='part_base_subject'?'gemini-nano-banana-2.1':'gpt-image-2.5-flare');
  await assert.rejects(access(join(root,'.env')),{code:'ENOENT'});
  await writeFile(join(root,'.env'),template);
  assert.deepEqual(loadWorkflowEnvironment({},root).stepModels,first.stepModels);
  assert.deepEqual(loadWorkflowEnvironment({},root).stepImages,first.stepImages);
  // Blank startup values do not replace nonempty local settings.
  const explicit=loadWorkflowEnvironment({preparation_agent_model:'gpt-6.1-sol-low',part_base_subject_image_model:''},root);
  assert.equal(explicit.stepModels.part_standardize.model,'gpt-6-astra');
  assert.equal(explicit.stepImages.part_base_subject,'gemini-nano-banana-2.1');
  await writeFile(join(root,'.env'),'# partial config\nshadow_agent_model=gpt-6.1-sol-medium\n');
  template=replace(template,'preparation_agent_model','gpt-6.1-sol-xhigh');
  await writeFile(join(root,'example.env'),template);
  const updated=loadWorkflowEnvironment({image_base_url:'https://images.example/v1',image_api_key:'fixture',google_image_base_url:'https://images.example/v1',google_image_api_key:'fixture'},root);
  assert.equal(updated.stepModels.part_standardize.effort,'xhigh');
  assert.equal(updated.stepModels.shadow_mask.effort,'medium');
  assert.equal(updated.stepImages.part_simplify,'gpt-image-2.5-flare');
  assert.equal(updated.imageApis.google?.protocol,'openai');
  assert.equal(await readFile(join(root,'.env'),'utf8'),'# partial config\nshadow_agent_model=gpt-6.1-sol-medium\n');
});

test('invalid or incomplete defaults identify the skill template and preserve the user file', async t => {
  const root=await fixture(t),template=await readFile(templateUrl,'utf8');
  const user='# user settings\n';await writeFile(join(root,'.env'),user);
  await writeFile(join(root,'example.env'),replace(template,'preparation_agent_model',''));
  assert.throws(()=>loadWorkflowEnvironment({},root),/example.env.*preparation_agent_model/);
  await writeFile(join(root,'example.env'),replace(template,'default_image_model','unsupported'));
  assert.throws(()=>loadWorkflowEnvironment({},root),/example.env:default_image_model/);
  await writeFile(join(root,'example.env'),template.replace(/^raster_step01_image_model=.*\n/m,''));
  assert.throws(()=>loadWorkflowEnvironment({},root),/example.env.*raster_step01_image_model/);
  assert.equal(await readFile(join(root,'.env'),'utf8'),user);
});

test('all scalar runtime defaults come from the template and partial local settings retain those defaults',async t=>{
 const root=await fixture(t);let template=await readFile(templateUrl,'utf8');
 for(const [key,value] of Object.entries({agv_image_compact_threshold:'12',codex_request_compact_mib:'4',claude_image_deduplicate:'true',agv_unlimited_response_header_timeout:'true',krita_max_instances:'7'}))template=replace(template,key,value);
 await writeFile(join(root,'example.env'),template);await writeFile(join(root,'.env'),'# partial\n');
 const actual=loadWorkflowEnvironment({},root);
 assert.equal(actual.imageBudgets!.agv.images,12);assert.equal(actual.imageBudgets!.codex.bytes,4*1048576);assert.equal(actual.imageBudgets!.claude.deduplicate,true);
 assert.equal(actual.codex.env!.agv_unlimited_response_header_timeout,'true');assert.equal(actual.codex.env!.krita_max_instances,'7');
 await writeFile(join(root,'.env'),'agv_image_compact_threshold=8\nclaude_image_deduplicate=false\n');
 const local=loadWorkflowEnvironment({agv_image_compact_threshold:'9'},root);assert.equal(local.imageBudgets!.agv.images,8);assert.equal(local.imageBudgets!.claude.deduplicate,undefined);
 await writeFile(join(root,'example.env'),template.replace(/^video_api_key=.*\n/m,''));assert.throws(()=>loadWorkflowEnvironment({},root),/example.env.*video_api_key/);
});

test('an installed skill without its template fails immediately rather than inventing defaults',async t=>{
 const root=await fixture(t),shared=join(root,'shared');await mkdir(shared);
 for(const name of ['default-configuration.ts','configuration-sources.ts','legacy-keys.ts','paths.ts'])await copyFile(new URL('../'+name,import.meta.url),join(shared,name));
 const installed=await import(pathToFileURL(join(shared,'default-configuration.ts')).href);
 assert.throws(()=>installed.readDefaultConfiguration(),/example.env/);
});
