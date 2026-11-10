import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { knowledgeDirectory, useKnowledge, stepKnowledge, runtimePrompt } from '../knowledge.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { VisualContext } from '../../patches/shared/visual-context.ts';

async function fixture(t: any) {
  const root=await mkdtemp(join(tmpdir(),'knowledge-binding-')), previous=knowledgeDirectory();
  t.after(async()=>{useKnowledge(previous);await rm(root,{recursive:true,force:true});});
  const put=async(path:string,text:string)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,text);};
  const prior=async(name:string)=>{
    const directory=join(root,name);
    await put(join(directory,'nine-axis/step03_frames/agent.json'),JSON.stringify({main:{initial:['shared/prompts/main.md'],tools:['view_bitmap']}}));
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
  assert.throws(()=>knowledge.tools('main',[]),/step03_frames.*main.*view_bitmap.*没有提供执行实现/);
  await f.put(join(root,'nine-axis/step03_frames/agent.json'),JSON.stringify({main:{initial:['shared/prompts/main.md'],tools:['imagegen']}}));
  assert.deepEqual(knowledge.tools('main',[]),[]);
});

test('prompt filenames stay within the selected knowledge root',async t=>{
  const f=await fixture(t),root=await f.prior('A');useKnowledge(root);
  const config=join(root,'nine-axis/step03_frames/agent.json');
  for(const path of ['../../../outside.md','/outside.md','C:\\outside.md']){
    await f.put(config,JSON.stringify({main:{initial:[path]}}));
    assert.throws(()=>stepKnowledge('nine-axis','step03_frames').render('main',{}),/相对路径/);
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
  assert.throws(()=>new VisualContext(options),/先验知识缺少文件.*visual-context-summary/);
  const path=join(root,'shared/prompts/runtime/visual-context-summary.md');await f.put(path,'');
  assert.throws(()=>new VisualContext(options),/先验知识文件为空/);
  await f.put(path,'declared maintenance instruction');
  const context=new VisualContext(options);
  const input={contents:[{role:'user',parts:Array.from({length:6},(_,i)=>({inlineData:{mimeType:'image/png',data:Buffer.alloc(10,i+1).toString('base64')}}))}]};
  await context.prepare(input,async wire=>{assert.equal(wire.contents[0].parts[0].text,'declared maintenance instruction');return 'summary';});
});
