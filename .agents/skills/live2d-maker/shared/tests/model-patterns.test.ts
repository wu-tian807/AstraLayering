import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseModelPatterns,modelPatternMatches} from '../model-patterns.js';
import {parseWorkflowEnvironment} from '../codex/environment.ts';
import {imageProvider} from '../agents/models.ts';
import {needsSolidBackground} from '../agents/image-background.ts';
import {generateImage} from '../agents/images.ts';
import sharp from 'sharp';

test('shared glob grammar has only star wildcard, allows empty matches and rejects catch-all or malformed rules',()=>{
 assert.deepEqual(parseModelPatterns(' gpt-*, gpt-*, *seedance-* '),['gpt-*','*seedance-*']);
 for(const rule of ['*','**-**','-*-*','-','gpt-**','gpt-*,','?model','[model]'])assert.throws(()=>parseModelPatterns(rule),rule);
 assert.deepEqual(parseModelPatterns('gpt-*-image-*,*-seedance-*'),['gpt-*-image-*','*-seedance-*']);
 for(const model of ['doubao-seedance-2.0','seedance-2','seedance-2.0'])assert.ok(modelPatternMatches(model,'*seedance-*'));
 assert.ok(!modelPatternMatches('seedance-2','*-seedance-*'));
 assert.ok(!modelPatternMatches('gptXimage','gpt.image'));
 assert.ok(!modelPatternMatches('gpt-image-2','gpt-'));
});
test('custom model declarations extend template rules, local declarations win and specificity decides routing',()=>{
 const config=parseWorkflowEnvironment('codex_models=custom-*\npart_draw_agent_model=custom-v1-medium\nopenai_image_models=custom-image-*\ndefault_image_model=custom-image-v2\n',
   {codex_models:'ignored-*'});
 assert.deepEqual(config.providers!.codex.models,['gpt-*','custom-*']);
 assert.equal(config.stepModels.part_outline.harness,'codex');
 const aliases=parseWorkflowEnvironment('layering_agent_part_draw_model=claude-sonnet-5-5-low\nlayering_default_image_model=gemini-nano-banana-2.1', {part_draw_agent_model:'gpt-6.1-sol-high',default_image_model:'gpt-image-2.5-flare'});
 assert.equal(aliases.stepModels.part_outline.harness,'claude');assert.equal(aliases.stepImages.raster_step01,'gemini-nano-banana-2.1');
 assert.ok(!config.providers!.codex.models!.includes('ignored-*'));
 assert.equal(imageProvider('gpt-image-2.6-sunburst',config.imageRules),'openai');
 assert.equal(imageProvider('custom-image-v2',config.imageRules),'openai');
 assert.equal(imageProvider('nano-banana-new',config.imageRules),'google');
 assert.equal(needsSolidBackground('custom-nano',{prompt:'draw'},'google'),true);
 const exact=parseWorkflowEnvironment('claude_models=gpt-special\npart_draw_agent_model=gpt-special-high');
 assert.equal(exact.stepModels.part_outline.harness,'claude');
 assert.throws(()=>parseWorkflowEnvironment('claude_models=custom-*\ncodex_models=custom-*\npart_draw_agent_model=custom-v1-high'),/多个服务/);
 assert.throws(()=>parseWorkflowEnvironment('default_image_model=unknown-image'),/自定义生图/);
 for(const key of ['codex_models','claude_models','agv_models','openai_image_models','google_image_models'])assert.throws(()=>parseWorkflowEnvironment(`${key}=**`),key);
});
test('GPT Image 2.6 variants and custom image IDs use unchanged static generation and edit parameters',async t=>{
 const png=await sharp({create:{width:2,height:2,channels:4,background:'#ff000080'}}).png().toBuffer();
 const requests:{url:string;init:RequestInit}[]=[];
 t.mock.method(globalThis,'fetch',async (url:string,init:RequestInit)=>{requests.push({url,init});return Response.json({data:[{b64_json:png.toString('base64')}]});});
 for(const model of ['gpt-image-2.6-sunburst','gpt-image-2.6-flare','custom-image-v2']) {
  const api={provider:'openai' as const,baseUrl:'https://image.test/v1',apiKey:'fixture',protocol:'openai' as const};
  for(const inputs of [[],[{bytes:png,mime:'image/png'}]]) {
   assert.deepEqual(await generateImage(api,model,{prompt:'draw',background:'transparent',size:'1024x1024',quality:'high'},inputs,new AbortController().signal),png);
   const request=requests.at(-1)!;
   assert.equal(request.url,api.baseUrl+(inputs.length?'/images/edits':'/images/generations'));
   const body=inputs.length?Object.fromEntries((request.init.body as FormData).entries()):JSON.parse(request.init.body as string);
   assert.equal(body.model,model);assert.equal(body.background,'transparent');assert.equal(body.output_format,'png');assert.equal(body.size,'1024x1024');assert.equal(body.quality,'high');
   if(inputs.length)assert.ok(body.image instanceof Blob);
  }
 }
});
