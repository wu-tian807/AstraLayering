import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AgvTurn } from '../agents/agv-turn.ts';
import { runCliTask } from '../agents/cli.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { parseAgentModel } from '../agents/models.ts';
import { CodexAgents } from '../codex/agents.ts';
import { AgentCallError, AgentRuntime, retryableAgentError } from '../codex/agent-runtime.ts';
import { createServer } from 'node:http';
import { once } from 'node:events';

const step = (step_index: number, step_type: string, state = 'DONE', text_delta = '') => ({
  event: 'step_update', step_update: { step_index, step_type, state, text_delta },
});
const oldError = { conversation_id: 'same-session', status: 'ERROR', error: 'previous header timeout', response: 'current response' };

test('AGV current turn accumulates text deltas and ignores steps before its user input', () => {
  const turn = new AgvTurn();
  turn.record(step(1, 'error_message'));
  turn.record(step(20, 'user_input'));
  turn.record(step(19, 'error_message'));
  turn.record(step(21, 'system_message'));
  turn.record(step(22, 'tool', 'ACTIVE'));
  turn.record(step(22, 'tool'));
  turn.record(step(23, 'agent_response', 'ACTIVE', 'current '));
  assert.equal(turn.record(step(23, 'agent_response', 'DONE', 'response')), 'current response');
  assert.equal(turn.recoveredError(oldError, 'same-session'), true);
  assert.equal(turn.userStepIndex, 20);
});

test('AGV recovered errors require an explicit completed response and never hide terminal errors', () => {
  for (const scenario of ['missing-id', 'no-boundary', 'terminal-error', 'active-tool', 'last-tool', 'partial', 'mismatch', 'wrong-session', 'protocol-error', 'second-input', 'cancelled', 'is-error']) {
    const turn = new AgvTurn();
    if (scenario !== 'no-boundary') turn.record(step(2, 'user_input'));
    if (scenario === 'active-tool') turn.record(step(3, 'tool', 'ACTIVE'));
    turn.record(step(4, 'agent_response', scenario === 'partial' ? 'ACTIVE' : 'DONE', 'current response'));
    if (scenario === 'terminal-error') turn.record(step(5, 'error_message'));
    if (scenario === 'last-tool') turn.record(step(5, 'tool'));
    if (scenario === 'protocol-error') turn.record({ event: 'error', error: 'current protocol failure' });
    if (scenario === 'second-input') turn.record(step(5, 'user_input'));
    const result = { ...oldError, ...(scenario === 'mismatch' ? { response: 'old response' } : {}),
      ...(scenario === 'cancelled' ? { status: 'CANCELLED' } : {}), ...(scenario === 'is-error' ? { is_error: true } : {}) };
    assert.equal(turn.recoveredError(result, scenario === 'missing-id' ? undefined : scenario === 'wrong-session' ? 'another-session' : 'same-session'), false, scenario);
  }
});

test('a fresh AGV turn can recover an earlier error before its final response', () => {
  const turn = new AgvTurn();
  turn.record(step(0, 'user_input'));
  turn.record(step(1, 'error_message'));
  turn.record(step(2, 'agent_response', 'DONE', 'current response'));
  assert.equal(turn.recoveredError(oldError, 'same-session'), true);
  assert.deepEqual(turn.recoveredErrorStepIndices, [1]);
});

test('a completed finish and aggregated progress replies recover a stale stream timeout', () => {
  const turn = new AgvTurn();
  turn.record(step(0, 'user_input'));
  turn.record(step(208, 'agent_response', 'DONE', '正在精修。\n'));
  turn.record(step(234, 'agent_response', 'DONE', '正在重开核验。\n'));
  turn.record(step(299, 'tool', 'ACTIVE'));
  turn.record(step(299, 'tool'));
  turn.record(step(300, 'error_message'));
  turn.record(step(321, 'agent_response', 'DONE', '{"status":"completed","summary":"交付已保存"}\n'));
  turn.record({ event: 'step_update', step_update: { step_index: 322, step_type: 'tool', state: 'ACTIVE', tool_name: 'finish' } });
  const result = { conversation_id: 'same-session', status: 'ERROR',
    error: 'API error (attempt 1): request failed: stream idle timeout (5m0s): context deadline exceeded',
    response: '正在精修。\n正在重开核验。\n{"status":"completed","summary":"交付已保存"}\n' };
  assert.equal(turn.recoveredError(result, 'same-session'), false, 'an active finish cannot complete the turn');
  turn.record(step(322, 'finish'));
  assert.equal(turn.recoveredError(result, 'same-session'), true);
  assert.equal(turn.completedResponse, '{"status":"completed","summary":"交付已保存"}\n');
  assert.deepEqual(turn.recoveredErrorStepIndices, [300]);
  assert.equal(turn.recoveredError({ ...result, response: 'old text\n' + result.response }, 'same-session'), false);
  turn.record(step(323, 'error_message'));
  turn.record(step(324, 'finish'));
  assert.equal(turn.recoveredError(result, 'same-session'), false, 'a finish cannot hide a terminal error');
});

const cli = `#!${process.execPath}
import { randomUUID } from 'node:crypto';
let input='';for await(const chunk of process.stdin)input+=chunk;
const mode=JSON.parse(input).message.content[0].text.split('\\n')[0].trim();
const args=process.argv.slice(2), id=args.includes('--conversation')?args[args.indexOf('--conversation')+1]:randomUUID();
const emit=event=>console.log(JSON.stringify(event));
const step=(index,type,state='DONE',text='')=>emit({event:'step_update',step_update:{conversation_id:id,step_index:index,step_type:type,state,text_delta:text}});
emit({event:'init',conversation_id:id});
if(mode!=='no-boundary')step(2,'user_input');
if(mode==='initial-error'){step(3,'error_message');emit({event:'result',result:{conversation_id:id,status:'ERROR',error:'previous header timeout',response:''}});process.exit(3);}
if(mode==='retry-header-timeout'||mode==='retry-idle-timeout'){step(3,'error_message');emit({event:'result',result:{conversation_id:id,status:'ERROR',error:mode==='retry-idle-timeout'?'stream idle timeout (5m0s): context deadline exceeded':'net/http: timeout awaiting response headers',response:''}});process.exit(3);}
if(mode==='aggregated-finish'||mode==='structured-finish'){
 const output={status:'completed',summary:'saved artwork'},reply=JSON.stringify(output)+'\\n';
 step(3,'agent_response','DONE','progress one\\n');step(4,'agent_response','DONE','progress two\\n');
 step(5,'error_message');step(6,'agent_response','DONE',reply);step(7,'tool','ACTIVE');step(7,'finish');
 emit({event:'result',result:{conversation_id:id,status:'ERROR',error:'stream idle timeout (5m0s): context deadline exceeded',response:'progress one\\nprogress two\\n'+reply,...(mode==='structured-finish'?{structured_output:output}:{})}});process.exit(0);
}
if(mode==='in-turn-recovery')step(3,'error_message');
step(4,'agent_response','ACTIVE','current ');step(4,'agent_response','DONE','response');
if(mode==='current-error'||mode==='terminal-error-zero')step(5,'error_message');
if(mode==='abort'){await new Promise(()=>{});}
if(mode!=='missing-result')emit({event:'result',result:{conversation_id:id,status:mode==='cancelled'?'CANCELLED':'ERROR',error:mode==='current-error'?'new timeout':'previous header timeout',response:'current response'}});
process.exit(mode==='nonzero'||mode==='current-error'?3:0);
`;

test('CLI adapter resumes after historical failure, preserves records, and still rejects actual failure, cancellation and incomplete output', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-turn-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, 'agy.mjs'); await writeFile(executable, cli, { mode: 0o700 });
  const cwd = join(root, 'case'); await mkdir(cwd);
  await writeFile(join(cwd, 'keep.svg'), 'existing draft');
  const settings = loadWorkflowEnvironment({ agv_path: executable }, root);
  const model = parseAgentModel('gemini-4-argon-high', 'test');
  const options = { cwd, logDirectory: join(cwd, 'agents') };
  let id: string | undefined;
  await assert.rejects(runCliTask({ name: 'initial', cwd, prompt: 'initial-error' }, model, settings, options, new AbortController().signal), error => {
    id = (error as { threadId?: string }).threadId; return /previous header timeout/.test(String(error));
  });
  assert.ok(id);
  const before = await readFile(join(options.logDirectory, 'sessions.json'), 'utf8');
  const result = await runCliTask({ name: 'resume', cwd, prompt: 'history' }, model, settings, options, new AbortController().signal, id);
  assert.equal(result.threadId, id); assert.equal(result.text, 'current response');
  assert.equal(await readFile(join(options.logDirectory, 'sessions.json'), 'utf8'), before);
  assert.equal(await readFile(join(cwd, 'keep.svg'), 'utf8'), 'existing draft');
  const events = await readFile(join(result.logDirectory!, 'events.jsonl'), 'utf8');
  assert.match(events, /"status":"ERROR"/); assert.match(events, /"outcomeSource":"current_turn_steps"/);
  const fresh = await runCliTask({ name: 'fresh-recovery', cwd, prompt: 'in-turn-recovery' }, model, settings, options, new AbortController().signal);
  assert.equal(fresh.text, 'current response');
  const freshLog = JSON.parse(await readFile(join(fresh.logDirectory!, 'result.json'), 'utf8'));
  assert.equal(freshLog.processExitCode, 0); assert.equal(freshLog.cliStatus, 'ERROR');
  for (const mode of ['aggregated-finish', 'structured-finish']) {
    const recovered = await runCliTask({ name: mode, cwd, prompt: mode }, model, settings, options, new AbortController().signal, id);
    assert.equal(recovered.threadId, id);
    assert.deepEqual(JSON.parse(recovered.text), { status: 'completed', summary: 'saved artwork' });
    assert.equal(await readFile(join(cwd, 'keep.svg'), 'utf8'), 'existing draft');
    const recorded = await readFile(join(recovered.logDirectory!, 'events.jsonl'), 'utf8');
    assert.match(recorded, /stream idle timeout/);
    assert.match(recorded, /"outcomeSource":"current_turn_steps"/);
  }
  for (const mode of ['current-error', 'terminal-error-zero', 'nonzero', 'missing-result', 'no-boundary', 'cancelled']) {
    const failing = runCliTask({ name: mode, cwd, prompt: mode }, model, settings, options, new AbortController().signal, id);
    if (mode === 'current-error') await assert.rejects(failing, /new timeout/);
    else await assert.rejects(failing);
  }
  const controller = new AbortController();
  const aborting = runCliTask({ name: 'abort', cwd, prompt: 'abort' }, model, settings,
    { ...options, onEvent: async () => { controller.abort(new Error('user cancelled')); } }, controller.signal, id);
  // An existing session does not emit thread.started; cancel after its completed message.
  await assert.rejects(aborting, /user cancelled/);
});

for (const failure of ['retry-header-timeout', 'retry-idle-timeout']) test(`${failure}: an exhausted AGV timeout automatically resumes the same session and keeps its artifacts`, async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-retry-header-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, 'agy.mjs'); await writeFile(executable, cli, { mode: 0o700 });
  const cwd = join(root, 'case'); await mkdir(cwd);
  await writeFile(join(cwd, 'keep.svg'), 'existing draft');
  const settings = loadWorkflowEnvironment({ agv_path: executable }, root);
  const waits: number[] = [], ids: string[] = [], retries: string[] = [];
  const agents = new CodexAgents({ environment: settings, selectedModel: parseAgentModel('gemini-4-argon-high', 'test'),
    cwd, logDirectory: join(cwd, 'agents'), runtime: new AgentRuntime(1, async ms => { waits.push(ms); }, () => 1),
    onSessionStarted: async id => { ids.push(id); }, onRetry: retry => { retries.push(String(retry.error)); },
    onThreadReplacement: async () => assert.fail('a network timeout must not replace the session') });
  const session = agents.createSession();
  t.after(() => session.close());
  const result = await session.run({ name: 'transport-timeout', cwd, prompt: failure });
  assert.equal(result.text, 'current response'); assert.deepEqual(waits, [5000]);
  assert.equal(ids.length, 1); assert.equal(result.threadId, ids[0]);
  assert.equal(retries.length, 1); assert.match(retries[0], /timeout awaiting response headers|stream idle timeout/);
  assert.equal(await readFile(join(cwd, 'keep.svg'), 'utf8'), 'existing draft');
});

test('an AGV failure after an upstream 429 through the gateway carries that status and shares the retry policy', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-status-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let requests = 0;
  const upstream = createServer((req, res) => { req.resume(); req.on('end', () => {
    requests++; res.writeHead(requests === 1 ? 200 : 429, { 'content-type': 'application/json' });
    res.end(requests === 1 ? '{"candidates":[]}' : '{"error":{"code":429,"message":"Resource has been exhausted"}}');
  }); });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening'); t.after(() => upstream.close());
  // A fake agy: one successful request, then a throttled one, then AGV's text-only error.
  const executable = join(root, 'agy.mjs');
  await writeFile(executable, `#!${process.execPath}
for await(const _ of process.stdin);
const emit=event=>console.log(JSON.stringify(event)), id='status-session';
emit({event:'init',conversation_id:id});
emit({event:'step_update',step_update:{conversation_id:id,step_index:2,step_type:'user_input',state:'DONE'}});
for(let i=0;i<2;i++)await (await fetch(process.env.AGY_LLM_GATEWAY_URL+'/v1beta/models/m:generateContent',{method:'POST',body:'{}'})).text();
emit({event:'result',result:{conversation_id:id,status:'ERROR',error:'API error (attempt 3): Resource has been exhausted',response:''}});process.exit(3);
`, { mode: 0o700 });
  const cwd = join(root, 'case'); await mkdir(cwd);
  const settings = loadWorkflowEnvironment({ agv_path: executable, agv_api_key: 'fixture',
    agv_base_url: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`, agv_protocol: 'genai' }, root);
  const model = parseAgentModel('gemini-4-argon-high', 'test');
  await assert.rejects(runCliTask({ name: 'throttled', cwd, prompt: 'go' }, model, settings, { cwd, logDirectory: join(cwd, 'agents') },
    new AbortController().signal), error => {
    assert.deepEqual((error as AgentCallError).info, { apiError: { httpStatusCode: 429, code: null } });
    assert.equal(retryableAgentError(error), true);
    return true;
  });
  assert.equal(requests, 2);
});
