import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AgentCallError, AgentRuntime, defaultAgentConcurrency, retryableAgentError } from '../agent-runtime.ts';

test('独立运行层默认限制 3 个调用，失败也释放位置', async () => {
  assert.equal(defaultAgentConcurrency, 3);
  const runtime = new AgentRuntime();
  const gates = Array.from({ length: 7 }, () => Promise.withResolvers<void>());
  let active = 0, peak = 0;
  const entered: number[] = [];
  const calls = gates.map((gate, index) => runtime.run(async () => {
    entered.push(index); peak = Math.max(peak, ++active);
    try { await gate.promise; if (index === 0) throw new Error('文件错误'); return index; }
    finally { active--; }
  }));
  const settled = Promise.allSettled(calls);
  await new Promise(setImmediate);
  assert.deepEqual(entered, [0, 1, 2]);
  gates[0].resolve();
  await new Promise(setImmediate);
  assert.deepEqual(entered, [0, 1, 2, 3]);
  for (const gate of gates) gate.resolve();
  const results = await settled;
  assert.equal(results[0].status, 'rejected');
  assert.equal(peak, 3);
  assert.deepEqual(entered, [0, 1, 2, 3, 4, 5, 6]);
});

test('临时容量错误持续重试，不设轮次上限；等待按 5/10/20/40/60 秒增长', async () => {
  const waits: number[] = [], retries: number[] = [];
  const runtime = new AgentRuntime(1, async ms => { waits.push(ms); });
  let attempts = 0;
  const result = await runtime.run(async () => {
    if (++attempts <= 7) throw new AgentCallError('capacity', 'serverOverloaded');
    return 'ok';
  }, { onRetry: retry => { retries.push(retry.nextAttempt); } });
  assert.equal(result, 'ok');
  assert.equal(attempts, 8);
  assert.deepEqual(waits, [5000, 10000, 20000, 40000, 60000, 60000, 60000]);
  assert.deepEqual(retries, [2, 3, 4, 5, 6, 7, 8]);
});

test('退避等待释放并发位置，排队和等待都可以取消', async () => {
  const waiting = Promise.withResolvers<void>(), resume = Promise.withResolvers<void>();
  const controller = new AbortController();
  const runtime = new AgentRuntime(1, async (_ms, signal) => {
    waiting.resolve();
    await new Promise<void>((resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      resume.promise.then(resolve);
    });
  });
  const failed = runtime.run(async () => { throw new AgentCallError('capacity', 'serverOverloaded'); }, { signal: controller.signal });
  const rejected = assert.rejects(failed, /取消等待/);
  await waiting.promise;
  assert.equal(await runtime.run(async () => '其他调用已执行'), '其他调用已执行');
  controller.abort(new Error('取消等待'));
  await rejected;
  resume.resolve();
  const held = Promise.withResolvers<void>();
  const first = runtime.run(async () => { await held.promise; });
  const queued = new AbortController();
  let executed = false;
  const next = runtime.run(async () => { executed = true; }, { signal: queued.signal });
  const cancelled = assert.rejects(next, /取消排队/);
  queued.abort(new Error('取消排队'));
  await cancelled;
  held.resolve(); await first;
  assert.equal(executed, false);
});

test('只恢复可重试的通道错误，不重试认证、额度、参数、校验错误和主动取消', () => {
  for (const info of ['serverOverloaded', 'internalServerError', 'responseStreamDisconnected',
    { httpConnectionFailed: { httpStatusCode: 503 } }, { responseTooManyFailedAttempts: { httpStatusCode: 429 } }]) {
    assert.equal(retryableAgentError(new AgentCallError('test', info)), true);
  }
  assert.equal(retryableAgentError(new AgentCallError('Selected model is at capacity. Please try a different model.')), true);
  for (const info of ['usageLimitExceeded', 'contextWindowExceeded', 'badRequest', 'localError',
    { httpConnectionFailed: { httpStatusCode: 401 } }, { httpConnectionFailed: { httpStatusCode: 400 } }]) {
    assert.equal(retryableAgentError(new AgentCallError('test', info)), false);
  }
  assert.equal(retryableAgentError(new AgentCallError('quota exceeded 503')), false);
  assert.equal(retryableAgentError(new Error('server overloaded')), false);
  assert.equal(retryableAgentError(new DOMException('cancelled', 'AbortError')), false);
  for (const value of [0, -1, 1.2, NaN]) assert.throws(() => new AgentRuntime(value), /正整数/);
});
