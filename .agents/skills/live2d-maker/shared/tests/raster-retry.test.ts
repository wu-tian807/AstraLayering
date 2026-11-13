import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { join } from 'node:path';
import { runAgent, type AgentRequest } from '../raster/agent.ts';
import { AgentCallError, AgentRuntime, retryableAgentError } from '../codex/agent-runtime.ts';
import { executionPaths, workspacePrompt } from '../agents/workspace.ts';
import { rasterAppServer } from './raster-app-server.ts';

async function fixture(t: TestContext, behavior: Parameters<typeof rasterAppServer>[2] = {}) {
  const server = await rasterAppServer(t, JSON.stringify({ status: 'completed', summary: '完成' }), behavior);
  const request = (): AgentRequest => ({ prompt: '按原图继续修边', directory: server.directory, model: 'gpt-6.1-sol', effort: 'xhigh',
    onEvent: async () => {}, environment: server.environment });
  return { ...server, request };
}

test('raster 等待 CLI 终态后在原 thread 继续并记录退避', async t => {
  const f = await fixture(t, { failedTurns: 1, nativeReconnect: true });
  const waits: number[] = [], events: string[] = [];
  let retries = 0;
  const result = await runAgent({ ...f.request(), onEvent: async event => { events.push(event.type); }, onRetry: () => { retries++; } },
    new AgentRuntime(1, async ms => { waits.push(ms); }, () => 1));
  assert.equal(result.status, 'completed');
  assert.equal(retries, 1);
  assert.deepEqual(waits, [5000]);
  const protocol = await f.protocol();
  assert.equal(protocol.filter(message => message.method === 'thread/start').length, 1);
  const thread = protocol.find(message => message.method === 'thread/start').params;
  assert.equal(thread.cwd, join(f.directory, 'workspace'));
  assert.equal(thread.sandbox, 'danger-full-access');
  const prompts = protocol.filter(message => message.method === 'turn/start').map(message => message.params.input[0].text);
  assert.equal(prompts.length, 2);
  assert.equal(prompts[0], workspacePrompt(f.request().prompt, executionPaths({ cwd: f.directory }, f.directory)));
  assert.equal(prompts[1].includes(f.request().prompt), false);
  assert.ok(events.includes('thread.started'));
});

test('额度、输入图数和上下文上限不会被结构化 429 误判为临时故障', () => {
  for (const message of ['quota exhausted', 'maximum of 50 images', 'context window exceeded', 'invalid input']) {
    assert.equal(retryableAgentError(new AgentCallError(message, { rateLimitExceeded: { httpStatusCode: 429 } })), false);
  }
  assert.equal(retryableAgentError(new AgentCallError('too many requests', { rateLimitExceeded: { httpStatusCode: 429 } })), true);
});

test('AGV response-header timeouts retry in the same runtime; a recovered response ends retries', async () => {
  const timeout = 'API error (attempt 1): request failed: net/http: timeout awaiting response headers';
  // The AGV CLI tags the timeout at its source; the same text without that code is not retried.
  assert.equal(retryableAgentError(new AgentCallError(timeout, 'transportTimeout')), true);
  assert.equal(retryableAgentError(new AgentCallError(timeout)), false);
  assert.equal(retryableAgentError(new Error(timeout)), false);
  assert.equal(retryableAgentError(new AgentCallError('authentication failed; ' + timeout, 'transportTimeout')), false);
  const waits: number[] = [], errors: string[] = [];
  const runtime = new AgentRuntime(1, async ms => { waits.push(ms); }, () => 1);
  let calls = 0;
  const result = await runtime.run(async () => {
    calls++;
    if (calls === 1) throw new AgentCallError(timeout, 'transportTimeout');
    return 'completed after retry';
  }, { onRetry: retry => { errors.push(String(retry.error)); } });
  assert.equal(result, 'completed after retry'); assert.equal(calls, 2);
  assert.deepEqual(waits, [5000]); assert.equal(errors.length, 1);
});

test('取消可以中断 raster 退避；本地事件保存失败不触发网络重试', async t => {
  const failing = await fixture(t, { failedTurns: 5 });
  const controller = new AbortController();
  await assert.rejects(runAgent({ ...failing.request(), signal: controller.signal },
    new AgentRuntime(1, async () => { controller.abort(new Error('用户取消')); })), /用户取消/);
  assert.equal((await failing.protocol()).filter(message => message.method === 'turn/start').length, 1);
  const f = await fixture(t);
  await assert.rejects(runAgent({ ...f.request(), onEvent: async event => {
    if (event.type === 'item.completed') throw new Error('503 local disk error');
  } }, new AgentRuntime(1, async () => assert.fail('local failure must not retry'))), /local disk error/);
});
