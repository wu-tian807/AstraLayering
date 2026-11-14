import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFunctionToolSession } from '../codex/tool-agent.ts';
import { CodexAgents } from '../codex/agents.ts';
import { AgentRuntime, AgentCallError, recoverableAgentError, retryableAgentError } from '../codex/agent-runtime.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { nodeExecutables } from '../../part-layering/tests/node-executables.ts';
import { fakeDebug } from './fake-codex.ts';

const schema = { type: 'object', properties: { status: { type: 'string' } }, required: ['status'], additionalProperties: false };
async function fixture(t: TestContext, mode: string) {
  nodeExecutables(t);
  const root = await mkdtemp(join(tmpdir(), 'session-resume-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const capture = join(root, 'protocol.jsonl'), executable = join(root, 'server.mjs');
  await writeFile(executable, `#!${process.execPath}
import {createInterface} from 'node:readline';
import {appendFile, readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const mode=${JSON.stringify(mode)}, capture=${JSON.stringify(capture)};
${fakeDebug()}
const emit=v=>console.log(JSON.stringify(v)), record=v=>appendFile(capture,JSON.stringify(v)+'\\n');
let cachedCredential=null;
if(mode==='auth-file')try{cachedCredential=await readFile(join(process.env.CODEX_HOME,'auth.json'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
if(mode==='auth-dynamic')cachedCredential=execFileSync(process.env.TEST_AUTH_HELPER,{encoding:'utf8'}).trim();
let threadId='old-thread', active, ended=false, starts=0, resuming=false;
const done=(id,status)=>emit({method:'turn/completed',params:{threadId,turn:{id,status}}});
for await(const line of createInterface({input:process.stdin})) {
 const m=JSON.parse(line);await record(m);
 if(m.method==='initialize')emit({id:m.id,result:{}});
 if(m.method==='thread/resume'||m.method==='thread/start') {
  resuming=m.method==='thread/resume';threadId=resuming?m.params.threadId:'new-thread';
  active=resuming&&(mode==='active'||mode==='stuck')?'old-turn':undefined;
  emit({id:m.id,result:{thread:{id:threadId,status:{type:active?'active':'idle'},turns:active?[{id:active,status:'inProgress'}]:[]}}});
 }
 if(m.method==='thread/read')emit({id:m.id,result:{thread:{id:threadId,turns:active?[{id:active,status:'inProgress'}]:[]}}});
 if(m.method==='turn/interrupt') {
  if(m.params.turnId!==active)throw Error('wrong interrupted turn');
  emit({id:m.id,result:{}});
  // Acknowledgement and another turn's completion must not unblock start.
  done('unrelated-turn','completed');
  emit({method:'item/completed',params:{threadId,turnId:active,item:{type:'agentMessage',text:'stale reply'}}});
  emit({id:'stale-tool',method:'item/tool/call',params:{threadId,turnId:active,tool:'probe',arguments:{}}});
  if(mode!=='stuck')setTimeout(async()=>{ended=true;await record({event:'old-turn-ended'});done(active,'interrupted');active=undefined;},40);
 }
 if(m.method==='turn/start') {
  if(mode==='auth-file'||mode==='auth-dynamic')await record({event:'observed-auth',value:cachedCredential});
  starts++;
  if(resuming&&((mode==='race'&&starts===1)||mode==='repeat'||mode==='unknown')) {
   active='auto-'+starts;emit({method:'turn/started',params:{threadId,turn:{id:active,status:'inProgress'}}});
   emit({id:m.id,error:{code:-32603,message:mode==='unknown'?'other RPC failure':'failed to submit turn input: ActiveTurnOutputSchemaMismatch'}});continue;
  }
  if(mode==='early'||mode==='missing-id') {
   emit({method:'turn/started',params:{threadId,turn:{id:'our-turn',status:'inProgress'}}});
   emit({id:'old-early',method:'item/tool/call',params:{threadId,turnId:'old-turn',tool:'probe',arguments:{origin:'old'}}});
   emit({id:'our-early',method:'item/tool/call',params:{threadId,turnId:'our-turn',tool:'probe',arguments:{origin:'our'}}});
   emit({method:'item/completed',params:{threadId,turnId:'our-turn',item:{type:'agentMessage',text:'early reply'}}});
   done('our-turn','completed');
   emit({id:m.id,result:{turn:mode==='missing-id'?{status:'inProgress'}:{id:'our-turn',status:'inProgress'}}});continue;
  }
  // A replaced session is a new process, so count this test's turns from the capture.
  const allStarts=((await readFile(capture,'utf8')).match(/"method":"turn.start"/g)||[]).length;
  if(mode==='overflow'||mode==='overflow-always'||(mode==='overflow-work'&&allStarts<=2)) {
   emit({id:m.id,result:{turn:{id:'our-turn',status:'inProgress'}}});
   if(mode!=='overflow')emit({method:'item/completed',params:{threadId,turnId:'our-turn',item:{type:'commandExecution',status:'completed'}}});
   emit({method:'turn/completed',params:{threadId,turn:{id:'our-turn',status:'failed',error:{message:'context window exceeded',codexErrorInfo:'contextWindowExceeded'}}}});continue;
  }
  if(mode==='active'&&!ended)throw Error('started before old turn ended');
  emit({id:m.id,result:{turn:{id:'our-turn',status:'inProgress'}}});
  if(mode==='missing-tool')emit({id:'bad-tool',method:'item/tool/call',params:{threadId,tool:'probe',arguments:{}}});
  if(mode==='missing-item')emit({method:'item/completed',params:{threadId,item:{type:'agentMessage',text:'bad'}}});
  if(mode==='missing-completed')emit({method:'turn/completed',params:{threadId,turn:{status:'completed'}}});
  if(mode==='missing-usage')emit({method:'thread/tokenUsage/updated',params:{threadId,tokenUsage:{}}});
  if(mode==='missing-error')emit({method:'error',params:{threadId,error:{message:'bad'},willRetry:false}});
  if(mode==='foreign') {
   emit({id:'foreign-tool',method:'item/tool/call',params:{threadId,turnId:'foreign-turn',tool:'probe',arguments:{}}});
   emit({method:'item/completed',params:{threadId,turnId:'foreign-turn',item:{type:'agentMessage',text:'wrong reply'}}});
   emit({method:'turn/completed',params:{threadId,turn:{id:'foreign-turn',status:'failed',error:{message:'wrong failure'}}}});
   emit({method:'thread/tokenUsage/updated',params:{threadId,turnId:'foreign-turn',tokenUsage:{total:{inputTokens:999}}}});
   emit({method:'error',params:{threadId,turnId:'foreign-turn',error:{message:'wrong error'},willRetry:false}});
  }
  emit({method:'item/completed',params:{threadId,turnId:'our-turn',item:{type:'agentMessage',text:'{"status":"completed"}'}}});
  done('our-turn','completed');
 }
}

`, { mode: 0o700 });
  const options = { environment: loadWorkflowEnvironment({}, root), codexPathOverride: executable, cwd: root,
    config: { features: { goals: true } }, logDirectory: join(root, 'agents') };
  return { root, options, async messages() { return (await readFile(capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line)); } };
}

test('Codex reloads changed native credentials on the same thread and preserves local token refresh', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'auth-file'), native = join(f.root, 'native');
  await mkdir(native); await writeFile(join(native, 'auth.json'), 'first-login');
  const agents = new CodexAgents({ ...f.options, env: { ...process.env, CODEX_HOME: native } });
  const session = agents.createSession(), task = { name: 'credential', prompt: 'continue', outputSchema: schema };
  try {
    const first = await session.run(task);
    await writeFile(join(native, 'auth.json'), 'second-login');
    const second = await session.run(task);
    const registry = JSON.parse(await readFile(join(f.root, 'agents/sessions.json'), 'utf8'));
    const privateAuth = join(f.root, registry[first.threadId!].data, 'codex/auth.json');
    await writeFile(privateAuth, 'refreshed-in-session');
    const third = await session.run(task);
    assert.equal(await readFile(privateAuth, 'utf8'), 'refreshed-in-session');
    await rm(join(native, 'auth.json'));
    const fourth = await session.run(task);
    assert.ok([second, third, fourth].every(result => result.threadId === first.threadId));
    const messages = await f.messages();
    assert.deepEqual(messages.filter(m => m.event === 'observed-auth').map(m => m.value), ['first-login', 'second-login', 'second-login', null]);
    assert.equal(messages.filter(m => m.method === 'thread/resume').length, 2);
  } finally { await session.close(); }
});

test('Codex reruns a dynamic auth command for the next turn of the same thread', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'auth-dynamic'), native = join(f.root, 'native'), value = join(f.root, 'value'), helper = join(f.root, 'helper.mjs');
  await mkdir(native); await writeFile(value, 'first-key');
  await writeFile(helper, `#!${process.execPath}\nimport {readFileSync} from 'node:fs';\nprocess.stdout.write(readFileSync(process.env.TEST_AUTH_VALUE,'utf8'));\n`, { mode: 0o700 });
  await writeFile(join(native, 'config.toml'), `model_provider = "fixture"\n[model_providers.fixture]\nname = "Fixture"\nbase_url = "https://fixture.invalid/v1"\n[model_providers.fixture.auth]\ncommand = ${JSON.stringify(helper)}\n`);
  const agents = new CodexAgents({ ...f.options, env: { ...process.env, CODEX_HOME: native, TEST_AUTH_HELPER: helper, TEST_AUTH_VALUE: value } });
  const session = agents.createSession(), task = { name: 'dynamic-auth', prompt: 'continue', outputSchema: schema };
  try {
    const first = await session.run(task);
    await writeFile(value, 'second-key');
    const second = await session.run(task);
    assert.equal(second.threadId, first.threadId);
    const messages = await f.messages();
    assert.deepEqual(messages.filter(m => m.event === 'observed-auth').map(m => m.value), ['first-key', 'second-key']);
    assert.equal(messages.filter(m => m.method === 'thread/resume').length, 1);
  } finally { await session.close(); }
});

for (const mode of ['active', 'race']) test('resume: interrupts and waits for the old turn (' + mode + ')', { timeout: 10_000 }, async t => {
  const f = await fixture(t, mode), progress: string[] = [];
  const session = createFunctionToolSession({ ...f.options, progress: line => progress.push(line) }, 'old-thread');
  let tools = 0;
  await writeFile(join(f.root, 'keep.kra'), 'existing artifact');
  try {
    const result = await session.run({ name: 'resume', prompt: 'continue', outputSchema: schema, tools: [{ name: 'probe', description: 'probe', inputSchema: { type: 'object' }, execute: async () => { tools++; return { success: true, contentItems: [] }; } }] });
    assert.equal(result.threadId, 'old-thread');
    assert.equal(result.text, '{"status":"completed"}');
    assert.equal(tools, 0, 'the resumed turn cannot invoke the new task tools');
    assert.equal(await readFile(join(f.root, 'keep.kra'), 'utf8'), 'existing artifact');
    const messages = await f.messages(), resume = messages.find(m => m.method === 'thread/resume');
    assert.equal(resume.params.config['features.goals'], false, 'override inherited automatic scheduling');
    const turns = messages.filter(m => m.method === 'turn/start');
    assert.equal(turns.length, mode === 'race' ? 2 : 1);
    assert.ok(turns.every(m => JSON.stringify(m.params.outputSchema) === JSON.stringify(schema)));
    assert.deepEqual(turns[0].params, turns.at(-1).params, 'retry preserves input and output schema');
    assert.ok(messages.findIndex(m => m.event === 'old-turn-ended') < messages.findLastIndex(m => m.method === 'turn/start'));
    assert.equal(messages.filter(m => m.method === 'turn/interrupt').length, 1);
    if (mode === 'race') assert.ok(progress.some(line => line.startsWith('[resume] Codex 自动续跑')));
    assert.equal(messages.find(m => m.id === 'stale-tool').result.success, false);
  } finally { await session.close(); }
});

test('a repeated conflict replaces the session once without backoff or deleting artifacts', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'repeat'), replacements: string[] = [], waits: number[] = [];
  const agents = new CodexAgents({ ...f.options, onThreadReplacement: async id => { replacements.push(id); },
    runtime: new AgentRuntime(1, async delay => { waits.push(delay); }) });
  const session = agents.createSession('old-thread');
  await writeFile(join(f.root, 'keep.png'), 'saved image');
  try {
    const result = await session.run({ name: 'resume', prompt: 'continue', outputSchema: schema });
    assert.equal(result.threadId, 'new-thread');
    assert.deepEqual(replacements, ['old-thread']);
    assert.deepEqual(waits, []);
    assert.equal(await readFile(join(f.root, 'keep.png'), 'utf8'), 'saved image');
    const messages = await f.messages();
    assert.equal(messages.filter(m => m.method === 'thread/resume').length, 1);
    assert.equal(messages.filter(m => m.method === 'thread/start').length, 1);
    assert.equal(messages.filter(m => m.method === 'turn/start').length, 3);
  } finally { await session.close(); }
});

test('a new session over its context window fails unless it did work first, up to the retry limit', { timeout: 10_000 }, async t => {
  // Sessions that always work and then overflow stop at the retry limit.
  for (const [mode, starts, replaced] of [['overflow', 2, 1], ['overflow-work', 3, 2], ['overflow-always', 11, 10]] as const) {
    const f = await fixture(t, mode), replacements: string[] = [];
    const agents = new CodexAgents({ ...f.options, onThreadReplacement: async id => { replacements.push(id); },
      runtime: new AgentRuntime(1, async () => assert.fail('a known error must not wait')) });
    const session = agents.createSession('old-thread');
    try {
      const run = session.run({ name: 'resume', prompt: 'continue', recoveryPrompt: 'start over', outputSchema: schema });
      if (mode !== 'overflow-work') await assert.rejects(run, error => recoverableAgentError(error) === 'contextWindow');
      else assert.equal((await run).threadId, 'new-thread');
      assert.equal(replacements.length, replaced, mode);
      assert.equal((await f.messages()).filter(m => m.method === 'turn/start').length, starts, mode);
    } finally { await session.close(); }
  }
});

test('an unrelated RPC failure is not treated as a schema race', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'unknown'), session = createFunctionToolSession(f.options, 'old-thread');
  try {
    await assert.rejects(session.run({ name: 'resume', prompt: 'continue', outputSchema: schema }), /other RPC failure/);
    assert.equal((await f.messages()).filter(m => m.method === 'turn/start').length, 1);
    assert.equal((await f.messages()).filter(m => m.method === 'turn/interrupt').length, 0);
  } finally { await session.close(); }
  const error = new AgentCallError('adapter classified a broken active turn', 'sessionProtocol');
  assert.equal(recoverableAgentError(error), 'sessionProtocol');
  assert.equal(retryableAgentError(error), false);
  assert.equal(recoverableAgentError(new Error('ActiveTurnOutputSchemaMismatch')), undefined);
});

test('a stuck interrupted turn has a bounded wait and never accepts the new input', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'stuck'), timeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, 'timeout', (ms: number) => timeout(ms === 30_000 ? 100 : ms));
  const session = createFunctionToolSession(f.options, 'old-thread');
  try {
    await assert.rejects(session.run({ name: 'resume', prompt: 'continue', outputSchema: schema }), error => {
      assert.equal(recoverableAgentError(error), 'sessionProtocol'); return true;
    });
    assert.equal((await f.messages()).filter(m => m.method === 'turn/start').length, 0);
  } finally { await session.close(); }
});

test('events before turn/start reply are buffered and routed only to the returned turn', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'early'), calls: unknown[] = [];
  const session = createFunctionToolSession(f.options, 'old-thread');
  try {
    const result = await session.run({ name: 'early', prompt: 'continue', outputSchema: schema, tools: [{ name: 'probe', description: 'probe', inputSchema: { type: 'object' }, execute: async args => { calls.push(args); return { success: true, contentItems: [] }; } }] });
    assert.equal(result.text, 'early reply');
    assert.deepEqual(calls, [{origin:'our'}]);
  } finally { await session.close(); }
});

test('turn/start without a valid turn ID fails promptly and does not execute buffered tools', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'missing-id'); let calls = 0;
  const session = createFunctionToolSession(f.options, 'old-thread');
  try {
    await assert.rejects(session.run({ name: 'missing-id', prompt: 'continue', outputSchema: schema, tools: [{ name: 'probe', description: 'probe', inputSchema: { type: 'object' }, execute: async () => { calls++; return { success: true, contentItems: [] }; } }] }), /turn\/start 返回缺少有效 turn.id/);
    assert.equal(calls, 0);
  } finally { await session.close(); }
});

test('an error processing a buffered event rejects the pending start instead of hanging', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'early');
  const session = createFunctionToolSession({ ...f.options, onEvent: async event => {
    if (event.type === 'item.completed') throw new Error('event callback failed');
  } }, 'old-thread');
  try {
    await assert.rejects(session.run({ name: 'early-error', prompt: 'continue', outputSchema: schema,
      tools: [{ name: 'probe', description: 'probe', inputSchema: { type: 'object' }, execute: async () => ({ success: true, contentItems: [] }) }] }), /event callback failed/);
  } finally { await session.close(); }
});

for (const mode of ['missing-tool','missing-item','missing-completed','missing-usage','missing-error']) {
  test(mode + ': missing turn identity fails explicitly', { timeout: 10_000 }, async t => {
    const f = await fixture(t, mode), session = createFunctionToolSession(f.options, 'old-thread'); let calls = 0;
    try {
      await assert.rejects(session.run({ name: mode, prompt: 'continue', outputSchema: schema,
        tools: [{ name: 'probe', description: 'probe', inputSchema: { type: 'object' }, execute: async () => { calls++; return { success:true, contentItems:[] }; } }] }), /缺少有效回合 ID/);
      assert.equal(calls, 0);
    } finally { await session.close(); }
  });
}

test('events with another turn ID cannot execute tools or complete the current turn', { timeout: 10_000 }, async t => {
  const f = await fixture(t, 'foreign'), session = createFunctionToolSession(f.options, 'old-thread'); let calls = 0;
  try {
    const result = await session.run({ name: 'foreign', prompt: 'continue', outputSchema: schema,
      tools: [{ name: 'probe', description: 'probe', inputSchema: { type: 'object' }, execute: async () => { calls++; return { success:true, contentItems:[] }; } }] });
    assert.equal(result.text, '{"status":"completed"}'); assert.equal(calls, 0);
  } finally { await session.close(); }
});
