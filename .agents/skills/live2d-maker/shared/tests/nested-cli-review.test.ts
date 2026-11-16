import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentDispatcher } from '../agents/dispatcher.ts';
import { withAgentSlotReleased } from '../agents/runtime.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { textResult } from '../codex/function-tools.ts';
import { fixture } from '../../part-layering/tests/layering-fixture.ts';
import { fakeDebug } from './fake-codex.ts';
import { nodeExecutables } from '../../part-layering/tests/node-executables.ts';

const models = { codex: 'gpt-6.1-sol-medium', claude: 'claude-sonnet-5-5-medium', agv: 'gemini-4-argon-medium' };
for (const parent of ['codex', 'claude', 'agv'] as const) for (const reviewer of ['codex', 'claude', 'agv'] as const) {
  test(`${parent} tool awaits ${reviewer} reviewer through common execution with one model slot`, { timeout: 10000 }, async t => {
    nodeExecutables(t);
    const f = await fixture(t), capture = join(f.directory, 'model-calls.jsonl');
    const native = join(f.directory, 'native.mjs'), cli = join(f.directory, 'cli.mjs');
    const record = `await appendFile(${JSON.stringify(capture)},JSON.stringify({kind,model:process.env.FIXTURE_MODEL??null})+'\\n');`;
    await writeFile(native, `#!${process.execPath}
${fakeDebug()}
import {createInterface} from 'node:readline';import {appendFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const threadId=randomUUID(),turnId='turn',send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
let kind='';
function finish(){send({method:'item/completed',params:{threadId,turnId,item:{type:'agentMessage',text:'done'}}});send({method:'turn/completed',params:{threadId,turn:{id:turnId,status:'completed',error:null}}});}
for await(const line of createInterface({input:process.stdin})){
 const msg=JSON.parse(line);
 if(msg.method==='initialize')send({id:msg.id,result:{}});
 else if(msg.method==='thread/start'||msg.method==='thread/resume')send({id:msg.id,result:{thread:{id:threadId}}});
 else if(msg.method==='turn/start'){
  const prompt=msg.params.input.filter(x=>x.type==='text').map(x=>x.text).join('');kind=prompt.includes('NESTED_PARENT')?'parent':'review';${record}
  send({id:msg.id,result:{turn:{id:turnId,status:'inProgress'}}});
  if(kind==='parent')send({method:'item/tool/call',id:'parent-tool',params:{threadId,turnId,callId:'delegate',namespace:null,tool:'delegate_review',arguments:{}}});else finish();
 }else if(msg.id==='parent-tool'){
  if(msg.result?.success!==true)throw new Error(JSON.stringify(msg));finish();
 }
}
`, { mode: 0o700 });
    await writeFile(cli, `#!${process.execPath}
import {readFile,appendFile} from 'node:fs/promises';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
const args=process.argv.slice(2),claude=args.includes('--mcp-config');let raw='';for await(const chunk of process.stdin)raw+=chunk;
const prompt=JSON.parse(raw).message.content[0].text,kind=prompt.includes('NESTED_PARENT')?'parent':'review',id=randomUUID();${record}
console.log(JSON.stringify(claude?{type:'system',subtype:'init',session_id:id}:{event:'init',conversation_id:id}));
if(kind==='parent'){
 const config=claude?args[args.indexOf('--mcp-config')+1]:join(process.env.ANTIGRAVITY_GEMINI_DIR,'config/mcp_config.json');
 const env=JSON.parse(await readFile(config,'utf8')).mcpServers.layering.env;
 const response=await fetch(env.LAYERING_MCP_URL,{method:'POST',headers:{authorization:'Bearer '+env.LAYERING_MCP_TOKEN},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'delegate_review',arguments:{}}})});
 const result=await response.json();if(result.error||result.result.isError)throw new Error(JSON.stringify(result));
}
console.log(JSON.stringify(claude?{type:'result',session_id:id,result:'done'}:{event:'result',result:{conversation_id:id,status:'SUCCESS',response:'done'}}));
`, { mode: 0o700 });
    const environment = loadWorkflowEnvironment({ part_draw_agent_model: models[parent],
      part_completion_boundary_review_agent_model: reviewer === 'codex' ? 'gpt-6.1-terra-medium' : models[reviewer],
      claude_path: cli, agv_path: cli }, f.directory);
    environment.codex.codexPathOverride = native;
    const agents = new AgentDispatcher({ environment, agentConcurrency: 1, cwd: f.directory, logDirectory: join(f.directory, 'agents') });
    let reviews = 0;
    const result = await agents.run({ step: 'part_outline', name: 'transport-parent', prompt: 'NESTED_PARENT', shell: false,
      tools: [{ name: 'delegate_review', description: 'Await an independent review.', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        async execute(_, signal) {
          const result = await withAgentSlotReleased(async signal => { reviews++; return agents.run({ step: 'part_completion_boundary_review', name: 'transport-review', prompt: 'NESTED_CHILD', shell: false }, signal); }, signal);
          return textResult(result.text);
        } }] }, t.signal);
    assert.equal(result.text, 'done'); assert.equal(reviews, 1);
    const calls = (await readFile(capture, 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
    assert.deepEqual(calls.map(c => c.kind), ['parent', 'review']);
  });
}
