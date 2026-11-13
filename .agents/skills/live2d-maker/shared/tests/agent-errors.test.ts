import { withCodex } from './fake-codex.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { errorDetails, errorMessage } from '../agents/errors.ts';
import { agentCallError, codexContentFilterInfo, agentOutcomeError, formatAgentError } from '../codex/diagnostics.ts';
import { AgentCallError, AgentRuntime, recoverableAgentError, retryableAgentError } from '../codex/agent-runtime.ts';
import { CodexAgents } from '../codex/agents.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { runCliTask } from '../agents/cli.ts';
import { parseAgentModel } from '../agents/models.ts';
import { runAgent } from '../raster/agent.ts';
import {AgentLog} from '../codex/agent-log.ts';
import {setTimeout as delay} from 'node:timers/promises';
import { nodeExecutables } from '../../part-layering/tests/node-executables.ts';
import { fakeDebug } from './fake-codex.ts';

const payload = { message: 'Provider rejected this reference', code: 'bad_reference',
  type: 'invalid_request_error', param: 'input[0]', status: 400, request_id: 'provider-request-123' };

async function fixture(t: TestContext) {
  nodeExecutables(t);
  const root = await mkdtemp(join(tmpdir(), 'layering-errors-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cwd = join(root, 'case'); await mkdir(cwd);
  const logDirectory = join(cwd, 'part-layering/agents');
  return { root, cwd, logDirectory };
}

async function savedFailure(error: AgentCallError, cwd: string) {
  const result = JSON.parse(await readFile(join(error.logDirectory!, 'result.json'), 'utf8'));
  assert.equal(result.status, 'failed');
  assert.equal(result.threadId, error.threadId);
  assert.match(JSON.stringify(result.errorDetails), /bad_reference/);
  const workflow = await readFile(join(cwd, 'workflow.log'), 'utf8');
  assert.match(workflow, /错误详情/);
  assert.match(workflow, /bad_reference/);
  assert.match(workflow, /input\[0\]/);
  assert.match(formatAgentError(error), /模型最后消息/);
  assert.match(formatAgentError(error), /provider-request-123/);
  return result;
}

// An app server that fails the turn in the given mode after a saved draft message.
async function errorServer(root: string, mode: string) {
  const executable = join(root, 'codex.mjs');
  await writeFile(executable, `#!${process.execPath}
import { createInterface } from 'node:readline';
${fakeDebug()}
const payload=${JSON.stringify(payload)}, mode=${JSON.stringify(mode)};
const emit=value=>console.log(JSON.stringify(value));
for await (const line of createInterface({input:process.stdin})) {
 const message=JSON.parse(line);
 if(message.method==='initialize')emit({id:message.id,result:{}});
 if(message.method==='thread/start')emit({id:message.id,result:{thread:{id:'app-server-thread'}}});
 if(message.method==='turn/start') {
  if(mode==='rpc'){emit({id:message.id,error:{code:-32603,message:'RPC failed',data:{error:payload}}});continue;}
  emit({id:message.id,result:{turn:{id:'turn'}}});
  emit({method:'item/completed',params:{threadId:'app-server-thread',turnId:'turn',item:{type:'agentMessage',text:'当前草稿已保存'}}});
  emit({method:'error',params:{threadId:'app-server-thread',turnId:'turn',willRetry:true,error:payload}});
  if(mode==='eof')process.exit(0);
  emit({method:'turn/completed',params:{threadId:'app-server-thread',turn:{id:'turn',status:mode==='recovered'?'completed':'failed',error:mode==='recovered'?null:{...payload,codexErrorInfo:'other'}}}});
 }
}
`, { mode: 0o700 });
  return executable;
}

test('error snapshots retain nested provider details and causes without serializing SDK request credentials', () => {
  const transport = Object.assign(new Error('connection failed'), { code: 'ECONNRESET',
    config: { headers: { Authorization: 'secret-test-token' } }, request: { apiKey: 'secret-test-token' },
    cause: Object.assign(new Error('upstream closed'), { code: 'UPSTREAM_CLOSED' }) });
  const outer = agentOutcomeError('调用没有完成', { text: '当前草稿已保存', threadId: 'thread-1', logDirectory: '/case/agents/1' }, transport);
  const formatted = formatAgentError(outer);
  assert.match(formatted, /原因：connection failed/);
  assert.match(formatted, /UPSTREAM_CLOSED/);
  assert.match(formatted, /当前草稿已保存/);
  assert.doesNotMatch(formatted, /secret-test-token|Authorization/);
  const circular: Record<string, unknown> = { ...payload }; circular.cause = circular;
  assert.match(JSON.stringify(errorDetails(circular)), /\[circular\]/);
  assert.equal(errorMessage({ errors: [payload, { error: { message: 'second error' } }] }), payload.message + '\nsecond error');
  const error = agentCallError({ data: { error: payload } }, 'fallback');
  assert.equal(error.message, payload.message);
  assert.deepEqual(error.details, { data: { error: payload } });
  const info = { responseStreamDisconnected: { httpStatusCode: 503 } };
  const detailed = agentCallError({ message: 'stream disconnected', code: 'upstream' }, 'fallback', info);
  assert.equal(detailed.info, info);
  assert.equal(retryableAgentError(detailed), retryableAgentError(new AgentCallError('stream disconnected', info)));
});

for (const mode of ['rpc', 'turn', 'eof', 'recovered']) test(`Codex App Server ${mode}: preserve payloads and wait for terminal status`, async t => {
  if (mode === 'eof') {
    const record = AgentLog.prototype.recordProtocol;
    t.mock.method(AgentLog.prototype, 'recordProtocol', async function(this: AgentLog, ...args: Parameters<typeof record>) {
      if ((args[0] as {method?: string}).method === 'item/completed') await delay(100);
      return record.apply(this, args);
    });
  }
  const f = await fixture(t);
  const executable = await errorServer(f.root, mode);
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, f.root), codexPathOverride: executable, cwd: f.cwd, logDirectory: f.logDirectory });
  const session = agents.createSession();
  try {
    if (mode === 'recovered') {
      const result = await session.run({ name: mode, prompt: 'same task', tools: [] });
      assert.equal(result.text, '当前草稿已保存');
      const record = JSON.parse(await readFile(join(result.logDirectory!, 'result.json'), 'utf8'));
      assert.equal(record.status, 'completed');
      assert.equal(record.errorDetails, undefined);
    } else {
      let failure: AgentCallError | undefined;
      await assert.rejects(session.run({ name: mode, prompt: 'same task', tools: [] }), error => {
        assert.ok(error instanceof AgentCallError); failure = error;
        assert.match(JSON.stringify(error.details), /bad_reference/);
        assert.equal(error.threadId, 'app-server-thread');
        if (mode === 'rpc') assert.equal(error.message, 'RPC failed');
        else assert.equal(error.finalResponse, '当前草稿已保存');
        return true;
      });
      const record = JSON.parse(await readFile(join(failure!.logDirectory!, 'result.json'), 'utf8'));
      assert.match(JSON.stringify(record.errorDetails), /bad_reference/);
      assert.match(await readFile(join(f.cwd, 'workflow.log'), 'utf8'), /bad_reference/);
    }
  } finally { await session.close(); }
});

test('raster steps keep turn failure details without retrying', async t => {
  const f = await fixture(t);
  const environment = withCodex(loadWorkflowEnvironment({}, f.root), await errorServer(f.root, 'turn'));
  await assert.rejects(runAgent({ prompt: 'same task', directory: f.cwd, model: 'gpt-6.1-sol', effort: 'low', environment, onEvent: async () => {} },
    new AgentRuntime(1, async () => assert.fail('must not retry'))), error => {
    assert.ok(error instanceof AgentCallError);
    assert.match(JSON.stringify(error.details), /bad_reference/); assert.equal(error.threadId, 'app-server-thread');
    assert.match(formatAgentError(error), /当前草稿已保存/); return true;
  });
});

for (const harness of ['claude', 'agv'] as const) test(`${harness}: structured errors survive CLI results and workflow.log`, async t => {
  const f = await fixture(t);
  const executable = join(f.root, `${harness}.mjs`);
  const final = harness === 'claude'
    ? { type: 'result', session_id: 'cli-session', is_error: true, subtype: 'error_during_execution', errors: [payload] }
    : { event: 'result', result: { conversation_id: 'cli-session', status: 'ERROR', error: payload, response: '当前草稿已保存' } };
  await writeFile(executable, `#!${process.execPath}
for await(const chunk of process.stdin){}
console.log(JSON.stringify({type:'assistant',session_id:'cli-session',message:{content:[{type:'text',text:'当前草稿已保存'}]}}));
console.log(JSON.stringify(${JSON.stringify(final)}));
process.exit(3);
`, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ [`${harness}_path`]: executable }, f.root);
  const model = parseAgentModel(harness === 'agv' ? 'gemini-4-argon-high' : 'claude-haiku-5-5-xhigh', 'test');
  let failure: AgentCallError | undefined;
  await assert.rejects(runCliTask({ name: harness, cwd: f.cwd, prompt: 'same task' }, model, settings,
    { cwd: f.cwd, logDirectory: f.logDirectory }, new AbortController().signal), error => {
    assert.ok(error instanceof AgentCallError); failure = error;
    assert.equal(error.message, payload.message);
    assert.doesNotMatch(error.message, /\[object Object\]/); return true;
  });
  const record = await savedFailure(failure!, f.cwd);
  assert.equal(record.processExitCode, 3);
  assert.equal(record.finalResponse, '当前草稿已保存');
});

test('Codex content filter is recognised only from the structured terminal failure', () => {
  const failure = { message: 'stream disconnected', codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: null } }, additionalDetails: 'reason: content_filter' };
  const info = codexContentFilterInfo(failure);
  assert.equal(recoverableAgentError(new AgentCallError('x', info)), 'modelRefusal');
  assert.equal(codexContentFilterInfo({ ...failure, additionalDetails: 'network reset' }), undefined);
  assert.equal(codexContentFilterInfo({ ...failure, codexErrorInfo: 'other' }), undefined);
  assert.equal(codexContentFilterInfo({ message: 'reason: content_filter' }), undefined);
});

test('known errors with a remedy are recovered at once without the retry budget; without one they fail fast', async () => {
  assert.equal(recoverableAgentError(new AgentCallError('content_policy_violation', 'other')), 'blockedImages');
  assert.equal(recoverableAgentError(new AgentCallError('thread not found: 019a', undefined)), 'unavailableSession');
  assert.equal(recoverableAgentError(new AgentCallError('cannot resume paginated thread 019a with stale path: requested /new/rollout.jsonl, current /old/rollout.jsonl; omit path and resume by thread id')), 'unavailableSession');
  assert.equal(recoverableAgentError(new AgentCallError('原 session 不可用：CLI 未恢复 a，返回了新的会话 ID b')), 'unavailableSession');
  const refused = new AgentCallError("API Error: Opus 5.5's safeguards flagged this message. Try rephrasing the request in a new session or change your model.", { refusal: { category: 'reasoning_extraction' } });
  assert.equal(recoverableAgentError(refused), 'modelRefusal');
  assert.equal(retryableAgentError(refused), false);
  assert.equal(recoverableAgentError(new AgentCallError('x', 'contextWindowExceeded')), 'contextWindow');
  assert.equal(recoverableAgentError(new AgentCallError('prompt is too long: 210000 tokens', { cliFailed: {} })), 'contextWindow');
  assert.equal(recoverableAgentError(new AgentCallError('The input token count (1200000) exceeds the maximum number of tokens allowed (1048576).', { apiError: { httpStatusCode: 400 } })), 'contextWindow');
  assert.equal(recoverableAgentError(new AgentCallError('x', { apiError: { httpStatusCode: 413 } })), 'imageOverflow');
  assert.equal(recoverableAgentError(new AgentCallError('too many images per request', { apiError: { httpStatusCode: 429 } })), 'imageOverflow');
  assert.equal(recoverableAgentError(new AgentCallError('too many images per minute, rate limit', { apiError: { httpStatusCode: 429 } })), undefined);
  for (const kind of ['contextWindowExceeded', { apiError: { httpStatusCode: 413 } }])
    assert.equal(retryableAgentError(new AgentCallError('x', kind)), false);
  // Local failures have nothing to do with the channel.
  assert.equal(retryableAgentError(new AgentCallError('App Server RPC 调用失败')), false);
  assert.equal(retryableAgentError(new AgentCallError('invalid api key · please run /login', { cliFailed: {} })), false);
  // A failed turn without a code came from the channel; Gemini's throttle mentions quota but waits.
  assert.equal(retryableAgentError(new AgentCallError('回合状态：failed', 'turnFailed')), true);
  for (const text of ['Resource has been exhausted (e.g. check quota).', 'Quota exceeded for metric: generate_content_requests_per_minute. Please retry in 30s.'])
    assert.equal(retryableAgentError(new AgentCallError(text, { apiError: { httpStatusCode: 429 } })), true);
  for (const text of ['You exceeded your current quota, please check your plan and billing details.', 'insufficient_quota', 'Quota exceeded for metric generate_requests_per_day'])
    assert.equal(retryableAgentError(new AgentCallError(text, { apiError: { httpStatusCode: 429 } })), false);

  const waits: number[] = [];
  const runtime = new AgentRuntime(1, async ms => { waits.push(ms); }, () => 0);
  const attempts: number[] = [];
  let recovered = 0;
  const result = await runtime.run(async attempt => {
    attempts.push(attempt);
    if (attempts.length === 1) throw new AgentCallError('x', 'contextWindowExceeded');
    if (attempts.length === 2) throw new AgentCallError('overloaded', 'serverOverloaded');
    return 'done';
  }, { recover: async error => recoverableAgentError(error) === 'contextWindow' && ++recovered === 1 });
  assert.equal(result, 'done'); assert.equal(recovered, 1);
  assert.deepEqual(attempts, [1, 1, 2]); assert.deepEqual(waits, [2_500]);
  await assert.rejects(runtime.run(async () => { throw new AgentCallError('x', 'contextWindowExceeded'); },
    { recover: async () => false }), /x/);
  assert.equal(waits.length, 1);
});
