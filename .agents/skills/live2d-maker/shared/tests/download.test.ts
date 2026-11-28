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

test('a download can continue beyond ten minutes while bytes are arriving', async t => {
  const expected = Buffer.from(Array.from({ length: 16 }, (_, i) => i));
  const stream = fixture(t, expected.length);
  const result = downloadBytes(url, { idleTimeoutMs: 60_000 });
  for (const byte of expected) await stream.chunk(40_000, byte);
  stream.close();
  assert.deepEqual(await result, expected);
});

test('a stalled body reports the idle timeout and bytes already received', async t => {
  const stream = fixture(t, 3);
  const result = downloadBytes(url, { idleTimeoutMs: 60_000 });
  const failure = assert.rejects(result, Error);
  await stream.chunk(40_000, 1);
  t.mock.timers.tick(60_000);
  await failure;
});
