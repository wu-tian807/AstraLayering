import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { checkKnowledge, defaultKnowledgeDirectory, knowledgeDirectory, useKnowledge, stepKnowledge, runtimePrompt, renderKnowledge } from '../knowledge.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { textResult } from '../codex/function-tools.ts';
import { VisualContext } from '../../patches/shared/visual-context.ts';
import { temporaryKnowledge } from './knowledge-fixture.ts';

async function fixture(t: any) {
  const root=await mkdtemp(join(tmpdir(),'knowledge-binding-')), previous=knowledgeDirectory();
  t.after(async()=>{useKnowledge(previous);await rm(root,{recursive:true,force:true});});
  const put=async(path:string,text:string)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,text);};
  const prior=async(name:string)=>{
    const directory=join(root,name);
    await put(join(directory,'head-nine-axis/step03_frames/agent.json'),JSON.stringify({main:{initial:['shared/prompts/main.md'],tools:['view_bitmap']}}));
    await put(join(directory,'shared/prompts/main.md'),name+' {shared_reference:x.png}');
    await put(join(directory,'shared/prompts/runtime/agent-turn.md'),name);
    return directory;
  };
  return {root,put,prior};
}

test('same-process calls retain their own knowledge handles and asynchronous runtime reads',async t=>{
  const f=await fixture(t),a=await f.prior('A'),b=await f.prior('B');
  useKnowledge(a);const handle=stepKnowledge('nine-axis','step03_frames');
  const pending=(async()=>{await delay(10);return runtimePrompt('agent-turn');})();
  useKnowledge(b);
  assert.equal(runtimePrompt('agent-turn'),'B');
  assert.equal(handle.render('main',{}),'A '+join(a,'shared/references/x.png'));
  assert.equal(await pending,'A');
});

test('declared handlers are required while native imagegen remains an adapter capability',async t=>{
  const f=await fixture(t),root=await f.prior('A');useKnowledge(root);
  const knowledge=stepKnowledge('nine-axis','step03_frames');
  assert.throws(()=>knowledge.tools('main',[]),Error);
  await f.put(join(root,'head-nine-axis/step03_frames/agent.json'),JSON.stringify({main:{initial:['shared/prompts/main.md'],tools:['imagegen']}}));
  assert.deepEqual(knowledge.tools('main',[]),[]);
});

test('tool selection follows the active agent.json for each role', async t => {
  const f = await fixture(t), step = stepKnowledge('raster-layering', 'step01', f.root);
  const path = join(step.directory, 'agent.json');
  const config = {
    main: { initial: ['prompts/draw.md'], tools: ['edit_groups'] },
    review: { initial: ['prompts/review.md'], tools: ['annotate_review_regions'], repair: { initial: ['prompts/repair.md'] } },
  };
  const provided = ['edit_groups', 'annotate_review_regions', 'edit_occlusion'].map(name => ({
    ...toolDefinition(name), execute: async () => textResult('fixture'),
  }));
  const mounted = (role: 'main' | 'review' | 'repair') => step.tools(role, provided).map(tool => tool.name);
  await f.put(path, JSON.stringify(config));
  assert.deepEqual(mounted('main'), config.main.tools);
  assert.deepEqual(mounted('repair'), config.main.tools);
  assert.deepEqual(mounted('review'), config.review.tools);

  config.main.tools.unshift('edit_occlusion');
  config.review.tools = [];
  await f.put(path, JSON.stringify(config));
  assert.deepEqual(mounted('main'), config.main.tools);
  assert.deepEqual(mounted('repair'), config.main.tools);
  assert.deepEqual(mounted('review'), config.review.tools);
});

test('prompt filenames stay within the selected knowledge root',async t=>{
  const f=await fixture(t),root=await f.prior('A');useKnowledge(root);
  const config=join(root,'head-nine-axis/step03_frames/agent.json');
  for(const path of ['../../../outside.md','/outside.md','C:\\outside.md']){
    await f.put(config,JSON.stringify({main:{initial:[path]}}));
    assert.throws(()=>stepKnowledge('nine-axis','step03_frames').render('main',{}),Error);
  }

});

test('a reviewer has only initial prompts while its repair can declare separate prompt rounds', async t => {
  const f = await fixture(t), root = join(f.root, 'review-priors');
  const step = stepKnowledge('raster-layering', 'step01', root);
  const config = {
    main: { initial: ['prompts/draw.md'] },
    review: { initial: ['prompts/review.md'], repair: { initial: ['prompts/repair.md'],
      then: [{ id: 'finish', prompts: ['prompts/a.md', 'prompts/b.md'] }] } },
  };
  const path = join(step.directory, 'agent.json');
  await f.put(path, JSON.stringify(config));
  await f.put(join(step.directory, 'prompts/a.md'), 'A {review_round}\n');
  await f.put(join(step.directory, 'prompts/b.md'), 'B');
  const rounds = step.rounds('repair');
  assert.deepEqual(rounds.map(round => round.id), ['initial', 'finish']);
  assert.equal(step.render('repair', { review_round: '2' }, { round: rounds[1] }), 'A 2\nB');
  await f.put(path, JSON.stringify({ ...config, review: { ...config.review, then: config.review.repair.then } }));
  assert.throws(() => step.rounds('review'), Error);
});

test('head knowledge uses the explicit namespace, resolves its shared prompts and orders tool overrides', async t => {
  const f = await fixture(t), root = join(f.root, 'head-priors'); useKnowledge(root);
  const agent = JSON.stringify({ main: { initial: ['head-nine-axis/prompts/common.md', 'prompts/main.md'], tools: ['view_bitmap'] } });
  await f.put(join(root, 'nine-axis/step03_frames/agent.json'), agent);
  assert.throws(() => stepKnowledge('nine-axis', 'step03_frames').render('main', {}), Error);
  await f.put(join(root, 'head-nine-axis/step03_frames/agent.json'), agent);
  await f.put(join(root, 'head-nine-axis/prompts/common.md'), 'head common\n');
  await f.put(join(root, 'head-nine-axis/step03_frames/prompts/main.md'), 'frame task');
  const step = stepKnowledge('nine-axis', 'step03_frames');
  assert.equal(step.render('main', {}), 'head common\nframe task');
  assert.equal(renderKnowledge('{reference:step03_frames/references/source.png}', {}, { section: 'nine-axis' }), join(root, 'head-nine-axis/step03_frames/references/source.png'));
  const provided = [{ ...toolDefinition('view_bitmap'), description: 'provided fallback', execute: async () => textResult('') }];
  await f.put(join(root, 'shared/tools/view_bitmap/description.md'), 'common tool');
  assert.equal(step.tools('main', provided)[0].description, 'common tool');
  await f.put(join(root, 'head-nine-axis/tools/view_bitmap/description.md'), 'head tool');
  assert.equal(step.tools('main', provided)[0].description, 'head tool');
  await f.put(join(root, 'head-nine-axis/step03_frames/tools/view_bitmap/description.md'), 'step tool');
  assert.equal(step.tools('main', provided)[0].description, 'step tool');
});

test('known prompt groups can supply every direction without a default file', async t => {
  const root = await temporaryKnowledge(t);
  const step = stepKnowledge('nine-axis', 'step04_angles', root);
  const defaultPrompt = join(step.directory, 'prompts/方向任务.md');
  await assert.rejects(readFile(defaultPrompt), { code: 'ENOENT' });

  checkKnowledge(root);
  const down = join(step.directory, 'prompts/groups/down/方向任务.md');
  await rm(down);
  assert.throws(() => checkKnowledge(root), error => error instanceof Error && error.message.includes(down));
  assert.throws(() => step.render('main', { group_id: 'down' }, { taskRoot: '/task', group: 'down' }),
    error => error instanceof Error && error.message.includes(down));
  assert.doesNotThrow(() => step.render('main', { group_id: 'up' }, { taskRoot: '/task', group: 'up' }));

  await writeFile(defaultPrompt, 'shared direction task');
  checkKnowledge(root);
  assert.ok(step.files('main', 'down').includes(defaultPrompt));
});

test('head-only documents are registered from their migrated owner, with no copies under shared', async () => {
  for (const name of ['edit_nine_axis', 'fit_nine_axis', 'view_nine_axis', 'extract_video_frame']) {
    const path = join(defaultKnowledgeDirectory, 'head-nine-axis/tools', name, 'description.md');
    assert.ok((await readFile(path, 'utf8')).trim());
    await assert.rejects(readFile(join(defaultKnowledgeDirectory, 'shared/tools', name, 'description.md')), { code: 'ENOENT' });
  }
  for (const step of ['step06_angle-xy', 'step07_jaw-line', 'step08_hair', 'step09_head-accessories', 'step10_head-pitch', 'step11_head-angle-xy']) {
    const knowledge = stepKnowledge('nine-axis', step);
    for (const round of knowledge.rounds('main')) {
      const files = knowledge.files('main', undefined, round);
      assert.equal(files.length, 1);
      assert.equal(dirname(files[0]), join(knowledge.directory, 'prompts'));
      assert.ok((await readFile(files[0], 'utf8')).trim());
    }
  }
});

test('tool registration reads current definitions instead of a process-wide catalog cache',async t=>{
  const f=await fixture(t),root=await f.prior('A');useKnowledge(root);
  await f.put(join(root,'shared/tools/view_bitmap/description.md'),'description');
  const overrides=join(f.root,'tools'),path=join(overrides,'view_bitmap/schema.json');
  const schema=(value:number)=>JSON.stringify({type:'object',properties:{scale:{type:'number',default:value}}});
  await f.put(path,schema(1));const before=toolDefinition('view_bitmap',overrides);
  await f.put(path,schema(2));const after=toolDefinition('view_bitmap',overrides);
  assert.equal((before.inputSchema.properties as any).scale.default,1);
  assert.equal((after.inputSchema.properties as any).scale.default,2);
});

test('visual maintenance prompt is loaded from runtime and missing or empty files fail immediately',async t=>{
  const f=await fixture(t),root=await f.prior('A');useKnowledge(root);
  const options={directory:join(f.root,'visual'),protocol:'genai' as const,budget:{images:5}};
  assert.throws(()=>new VisualContext(options),Error);
  const path=join(root,'shared/prompts/runtime/visual-context-summary.md');await f.put(path,'');
  assert.throws(()=>new VisualContext(options),Error);
  await f.put(path,'declared maintenance instruction');
  const context=new VisualContext(options);
  const input={contents:[{role:'user',parts:Array.from({length:6},(_,i)=>({inlineData:{mimeType:'image/png',data:Buffer.alloc(10,i+1).toString('base64')}}))}]};
  await context.prepare(input,async wire=>{assert.equal(wire.contents[0].parts[0].text,'declared maintenance instruction');return 'summary';});
});
