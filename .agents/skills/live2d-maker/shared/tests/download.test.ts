import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { downloadBytes } from '../download.ts';

const url = 'https://download.test/installer';

function fixture(t: TestContext, length: number) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const signal = init.signal!;
    signal.addEventListener('abort', () => stream.error(new DOMException('Aborted', 'AbortError')), { once: true });
    return new Response(body, { headers: { 'content-length': String(length) } });
  });
  return {
    async chunk(milliseconds: number, value: number) {
      t.mock.timers.tick(milliseconds);
      stream.enqueue(Uint8Array.of(value));
      await setImmediate();
    },
    close() { stream.close(); },
  };
}

test('byte progress keeps a slow download alive beyond the idle timeout', async t => {
  const stream = fixture(t, 3);
  const result = downloadBytes(url, { timeout: { idleMs: 60_000, totalMs: 600_000 } });
  await stream.chunk(40_000, 1);
  await stream.chunk(40_000, 2);
  await stream.chunk(40_000, 3);
  stream.close();
  assert.deepEqual(await result, Buffer.from([1, 2, 3]));
});

test('a stalled body reports the idle timeout and bytes already received', async t => {
  const stream = fixture(t, 3);
  const result = downloadBytes(url, { timeout: { idleMs: 60_000, totalMs: 600_000 } });
  const failure = assert.rejects(result, /连续 60 秒没有收到新数据，已下载 1 \/ 3 字节/);
  await stream.chunk(40_000, 1);
  t.mock.timers.tick(60_000);
  await failure;
});

test('the total deadline still applies while the body keeps making progress', async t => {
  const stream = fixture(t, 4);
  const result = downloadBytes(url, { timeout: { idleMs: 60_000, totalMs: 150_000 } });
  const failure = assert.rejects(result, /总时长达到 150 秒，已下载 3 \/ 4 字节/);
  await stream.chunk(40_000, 1);
  await stream.chunk(40_000, 2);
  await stream.chunk(40_000, 3);
  t.mock.timers.tick(30_000);
  await failure;
});
