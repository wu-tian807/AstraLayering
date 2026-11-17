import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fixture, shape, publishGroups } from './layering-fixture.ts';
import { nodeExecutables } from './node-executables.ts';
import { fakeDebug } from '../../shared/tests/fake-codex.ts';
import { AgentDispatcher } from '../../shared/agents/dispatcher.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { normalizeGroups } from '../../shared/part/groups.ts';
import { artifactPath, stepDraftPath } from '../../shared/part/artifact-facts.ts';
import { groupStepId } from '../../shared/part/part-steps.ts';
import { assertCompletionPreserves } from '../../shared/part/completion-svg.ts';

for (const allow of [true, false]) test(`actual completion submit awaits independent review with one slot; allow=${allow}`, { timeout: 10000 }, async t => {
  nodeExecutables(t);
  const f = await fixture(t), executable = join(f.directory, 'completion-server.mjs'), capture = join(f.directory, 'calls.jsonl');
  await writeFile(executable, `#!${process.execPath}
${fakeDebug()}
import {createInterface} from 'node:readline';import {appendFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const threadId=randomUUID(),turnId='turn',send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
let role,calls=[],index=0,model;
const record=x=>appendFile(${JSON.stringify(capture)},JSON.stringify(x)+'\\n');
function finish(){send({method:'item/completed',params:{threadId,turnId,item:{type:'agentMessage',text:'done'}}});send({method:'turn/completed',params:{threadId,turn:{id:turnId,status:'completed',error:null}}});}
function advance(){if(index>=calls.length)return finish();const call=calls[index++];send({method:'item/tool/call',id:'tool-'+index,params:{threadId,turnId,callId:'call-'+index,namespace:null,tool:call[0],arguments:call[1]}});}
for await(const line of createInterface({input:process.stdin})){
 const m=JSON.parse(line);
 if(m.method==='initialize')send({id:m.id,result:{}});
 else if(m.method==='thread/start'||m.method==='thread/resume'){
  role=m.params.dynamicTools?.some(t=>t.name==='set_completion_paths')?'drawing':'review';model=m.params.model;
  await record({role,threadId,model});send({id:m.id,result:{thread:{id:threadId}}});
 }else if(m.method==='turn/start'){
  const text=m.params.input.filter(x=>x.type==='text').map(x=>x.text).join('');
  if(role==='drawing'){
   const path=/^outputDraft：(.+)$/m.exec(text)[1].trim();
   calls=[['set_completion_paths',{paths:[{d:'M5 40H25V60H5Z'}]}],['preview_svg',{path,mode:'blend'}],['preview_svg',{path,mode:'svg'}],['submit_completion',{note:'Checked draft',outsideParentReason:'Hidden continuous structure.'}]];
   if(!${allow})calls.push(['set_completion_paths',{paths:[]}],['preview_svg',{path,mode:'blend'}],['preview_svg',{path,mode:'svg'}],['submit_completion',{note:'Repaired inside parent.'}]);
  }else{
   const body=text.slice(text.indexOf('【本次输入】')+'【本次输入】'.length).trim(),input=JSON.parse(/^\\{[\\s\\S]*?\\n\\}/.exec(body)[0]);
   calls=[['preview_svg',{path:input.candidate,mode:'svg'}],['preview_svg',{path:input.candidate,mode:'blend'}],['preview_svg',{path:input.parent,mode:'svg'}],['view_bitmap',{path:input.outsideReference}],['submit_completion_boundary_review',{allow:${allow},note:'Fixture independent decision.'}]];
  }
  index=0;await record({turn:role});send({id:m.id,result:{turn:{id:turnId,status:'inProgress'}}});advance();
 }else if(typeof m.id==='string'){
  await record({tool: calls[index-1][0],success:m.result?.success});advance();
 }
}
`, { mode: 0o700 });
  const id = 'head/child', source = artifactPath(f.directory, id, 'reduction'), parentPath = artifactPath(f.directory, 'head', 'completion'), outputPath = stepDraftPath(f.directory, id, 'completion');
  await mkdir(dirname(source), { recursive: true }); await mkdir(dirname(parentPath), { recursive: true }); await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(source, shape(id, 20, 80)); await writeFile(parentPath, shape('head', 10, 90));
  await publishGroups(f.directory, [{ id: 'head', groups: [{ id, kind: 'part' }] }]);
  const group = normalizeGroups([{ id, kind: 'part' }])[0], parent = normalizeGroups([{ id: 'head', steps: { completion: { status: 'completed', output: { path: parentPath } } } }])[0];
  const environment = loadWorkflowEnvironment({ part_completion_agent_model: 'gpt-6.1-sol-medium' }, f.directory);
  environment.codex.codexPathOverride = executable;
  const agents = new AgentDispatcher({ environment, agentConcurrency: 1, cwd: f.directory, logDirectory: join(f.directory, 'agents') });
  const adapter = createLayeringSteps(agents);
  const result = await adapter.completeOcclusion({ ...f, group, parent, reviewed: { path: source }, outputPath });
  assert.equal(result.status, 'completed');
  assert.equal(assertCompletionPreserves(await readFile(source, 'utf8'), await readFile(outputPath, 'utf8')), allow ? 1 : 0);
  const calls = (await readFile(capture, 'utf8')).trim().split(/\r?\n/).map(x => JSON.parse(x));
  assert.deepEqual(calls.filter(x => x.role).map(x => [x.role, x.model]), [['drawing', 'gpt-6.1-sol'], ['review', 'gpt-6.1-terra']]);
  assert.deepEqual(calls.filter(x => x.turn).map(x => x.turn), ['drawing', 'review']);
  const session = JSON.parse(await readFile(join(f.directory, 'agents/steps', groupStepId(id, 'completion'), 'session.json'), 'utf8'));
  assert.equal(session.threadId, calls.find(x => x.role === 'drawing').threadId);
  assert.notEqual(session.threadId, calls.find(x => x.role === 'review').threadId);
  assert.equal(calls.filter(x => x.tool === 'submit_completion' && x.success === false).length, allow ? 0 : 1);
});
