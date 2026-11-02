import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import sharp from 'sharp';
import { generateImage, imageRetry } from '../agents/images.ts';

async function provider(t: any, statuses: number[]) {
  const png = (await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer()).toString('base64');
  let calls = 0;
  const server = createServer((req, res) => {
    req.resume(); req.on('end', () => {
      const status = statuses[calls++] ?? 200;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(status === 200 ? JSON.stringify({ data: [{ b64_json: png }] }) : '{"error":"x"}');
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const api = { protocol: 'openai', baseUrl: `http://127.0.0.1:${(server.address() as any).port}/v1`, apiKey: 'k' } as any;
  return { api, calls: () => calls };
}

test('生图遇到 429/5xx 自动退避重试，404 立即报错', async t => {
  const saved = imageRetry.delays; imageRetry.delays = [1, 1, 1];
  t.after(() => { imageRetry.delays = saved; });
  const args = { prompt: 'p', background: 'opaque' as const };
  const ok = await provider(t, [429, 503]);
  assert.ok((await generateImage(ok.api, 'gpt-image-2.5-flare', args, [], AbortSignal.timeout(5000))).length);
  assert.equal(ok.calls(), 3);
  const missing = await provider(t, [404]);
  await assert.rejects(generateImage(missing.api, 'gpt-image-2.5-flare', args, [], AbortSignal.timeout(5000)), /HTTP 404/);
  assert.equal(missing.calls(), 1);
  const busy = await provider(t, [429, 429, 429, 429]);
  await assert.rejects(generateImage(busy.api, 'gpt-image-2.5-flare', args, [], AbortSignal.timeout(5000)), /HTTP 429/);
  assert.equal(busy.calls(), 4);
});
