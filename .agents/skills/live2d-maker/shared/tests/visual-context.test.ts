import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { VisualContext, deduplicateImages, imageBudget, imageCount, requestBytes, readVisualSummary, type VisualProtocol } from '../../patches/shared/visual-context.ts';
import { claudeGateway } from '../../patches/claude/gateway.ts';
import { genaiGateway } from '../agents/agv-gateway.ts';

const bitmap = (protocol: VisualProtocol, index: number, bytes = 300) => {
  const data = Buffer.alloc(bytes, index + 1).toString('base64');
  return protocol === 'genai' ? { inlineData: { mimeType: 'image/png', data } }
    : { type: 'image', source: { type: 'base64', media_type: 'image/png', data } };
};
// GenAI FunctionResponsePart is a media union, unlike an ordinary Content Part.
// A text sibling is valid; a text block inside functionResponse.parts is not.
function assertGenaiMedia(body: any) {
  for (const content of body.contents ?? []) for (const part of content.parts ?? []) {
    const response = part.functionResponse ?? part.function_response;
    for (const media of response?.parts ?? []) {
      assert.ok(Object.keys(media).length === 1 && ['inlineData', 'inline_data', 'fileData', 'file_data'].includes(Object.keys(media)[0]),
        'FunctionResponse.parts must contain only media, never text');
    }
  }
}
function history(protocol: VisualProtocol, count: number, bytes = 300) {
  const result = Array.from({ length: count }, (_, index) => bitmap(protocol, index, bytes));
  return protocol === 'genai' ? { systemInstruction: { parts: [{ text: 'original drawing instructions' }] },
    tools: [{ functionDeclarations: [{ name: 'fixture_view' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'HIGH' } },
    contents: [{ role: 'model', parts: [{ thoughtSignature: 'signed-original', functionCall: { id: 'call-id', name: 'fixture_view', args: { crop: [1, 2, 3, 4] } } }] },
      { role: 'user', parts: [{ functionResponse: { id: 'call-id', name: 'fixture_view', response: { output: 'already completed; no rerun required' }, parts: result } }] }] }
    : { model: 'claude-sonnet-5-5', max_tokens: 8192, system: 'original drawing instructions', stream: true,
      messages: [{ role: 'assistant', content: [{ type: 'thinking', thinking: 'earlier reasoning', signature: 'signed-original' },
        { type: 'tool_use', id: 'call-id', name: 'fixture_view', input: { crop: [1, 2, 3, 4] } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call-id', content: [{ type: 'text', text: 'already completed; no rerun required' }, ...result] }] }] };
}
async function fixture(t: { after(fn: () => Promise<unknown>): void }) {
  const directory = await mkdtemp(join(tmpdir(), 'visual-context-')); t.after(() => rm(directory, { recursive: true, force: true })); return directory;
}

test('budgets are independently opt-in, legacy image threshold only affects Codex, and invalid configuration fails', () => {
  assert.deepEqual(imageBudget({ image_compact_threshold: '49' }, 'codex'), { images: 49 });
  assert.deepEqual(imageBudget({ image_compact_threshold: '49' }, 'agv'), {});
  assert.deepEqual(imageBudget({ agv_request_compact_mib: '80', agv_image_compact_threshold: '90' }, 'agv'), { images: 90, bytes: 80 * 1048576 });
  for (const value of ['0', '-1', '1.5', 'NaN']) assert.throws(() => imageBudget({ claude_request_compact_mib: value }, 'claude'), /正整数/);
  assert.throws(() => imageBudget({ agv_image_deduplicate: '1' }, 'agv'), /true 或 false/);
});

test('exact-image dedup retains the latest image and all source/coordinate/call context; another crop is not merged', () => {
  const meta = (crop: number[]) => ({ text: JSON.stringify({ source: '/case/outline.svg', crop, scale: 6, mode: 'edge', savedPath: '/observation/latest.png' }) });
  const body = { contents: [0, 1, 2].map(index => ({ role: 'user', parts: [{ functionResponse: { id: `call-${index}`, name: 'preview_svg',
    response: { output: meta(index === 2 ? [10, 0, 10, 10] : [0, 0, 10, 10]).text }, parts: [bitmap('genai', 0)] } }] })) };
  const latest = structuredClone(body.contents[1]), other = structuredClone(body.contents[2]);
  assert.equal(deduplicateImages(body, 'genai'), 1);
  assertGenaiMedia(body);
  assert.deepEqual(body.contents[1].parts[0].functionResponse.response, latest.parts[0].functionResponse.response);
  assert.deepEqual(body.contents[1].parts[0].functionResponse.parts.at(-1), latest.parts[0].functionResponse.parts[0]);
  assert.match(JSON.stringify(body.contents[1]), /Retained latest original image/);
  assert.deepEqual(body.contents[2], other);
  assert.equal(body.contents[0].parts[0].functionResponse.id, 'call-0');
  assert.match(JSON.stringify(body.contents[0]), /latest occurrence/);
  assert.match(JSON.stringify(body.contents[0]), /coordinates and text remain valid/);
  assert.equal(imageCount(body, 'genai'), 2);
});

test('GenAI visual notes preserve media order, result identity/output and ordinary neighboring parts in both wire spellings', async t => {
  for (const key of ['functionResponse', 'function_response']) {
    const directory = await fixture(t), original: any = { contents: [{ role: 'user', parts: [
      { text: 'before' }, { [key]: { id: 'result-1', name: 'preview', response: { output: { crop: [1, 2, 3, 4], text: 'original' } },
        parts: [bitmap('genai', 1), bitmap('genai', 2), bitmap('genai', 3), bitmap('genai', 4), bitmap('genai', 5)] } },
      { text: 'after' }, bitmap('genai', 6)] }] };
    const prepared = await new VisualContext({ directory, protocol: 'genai', budget: { images: 5 } }).prepare(original, async wire => {
      assertGenaiMedia(wire); return 'observed colors and boundaries';
    });
    assertGenaiMedia(prepared);
    const response = prepared.contents[0].parts[1][key];
    assert.equal(response.id, 'result-1'); assert.equal(response.name, 'preview');
    assert.deepEqual(response.response, original.contents[0].parts[1][key].response);
    assert.deepEqual(response.parts, original.contents[0].parts[1][key].parts.slice(2));
    assert.deepEqual(prepared.contents[0].parts[0], { text: 'before' });
    assert.match(prepared.contents[0].parts[2].text, /result-1.*original media part 1/);
    assert.match(prepared.contents[0].parts[2].text, /original media part 2/);
    assert.deepEqual(prepared.contents[0].parts[3], { text: 'after' });
    assert.deepEqual(prepared.contents[0].parts[4], original.contents[0].parts[3]);
    const resumed = new VisualContext({ directory, protocol: 'genai', budget: { images: 5 } });
    assert.deepEqual(await resumed.prepare(original, async () => { throw new Error('must reuse successful summary'); }), prepared);
  }
});

for (const protocol of ['genai', 'anthropic'] as const) {
  test(`${protocol}: oversized single tool result is visually summarized in bounded batches, with latest originals and signed pairs intact`, async t => {
    const directory = await fixture(t), original = history(protocol, 120), snapshot = structuredClone(original), events: any[] = [], seen: any[] = [];
    const context = new VisualContext({ directory, protocol, budget: { images: 49 }, observe: async event => { events.push(event); } });
    const output = await context.prepare(original, async body => {
      if (protocol === 'genai') assertGenaiMedia(body);
      assert.ok(imageCount(body, protocol) <= 49); seen.push(body); return `actual visual memory ${seen.length}`;
    });
    if (protocol === 'genai') assertGenaiMedia(output);
    assert.deepEqual(original, snapshot);
    assert.ok(imageCount(output, protocol) < 49);
    assert.equal(seen.reduce((count, body) => count + imageCount(body, protocol), 0) + imageCount(output, protocol), 120);
    assert.match(JSON.stringify(output), /signed-original/); assert.match(JSON.stringify(output), /already completed; no rerun required/);
    assert.match(JSON.stringify(output), /call-id/); assert.match(JSON.stringify(output), /actual visual memory/);
    assert.match(JSON.stringify(output), new RegExp(Buffer.alloc(300, 120).toString('base64')));
    const calls = seen.length;
    const resumed = new VisualContext({ directory, protocol, budget: { images: 49 } });
    assert.deepEqual(await resumed.prepare(original, async () => { throw new Error('successful image summaries must be reused'); }), output);
    assert.equal(seen.length, calls);
    if (protocol === 'anthropic') assert.ok(seen.every(body => body.system === original.system));
    assert.ok(events.some(event => event.phase === 'compacted'));
    assert.equal(JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')).version, 1);
  });
  test(`${protocol}: actual JSON/base64 byte budgets apply to each summary and the outgoing request`, async t => {
    const directory = await fixture(t), original = history(protocol, 18, 10000), budget = 85000, batches: any[] = [];
    const context = new VisualContext({ directory, protocol, budget: { bytes: budget } });
    assert.ok(requestBytes(original) > budget);
    const prepared = await context.prepare(original, async body => {
      assert.ok(requestBytes(body) <= budget); assert.ok(imageCount(body, protocol) > 0); batches.push(body); return 'bounded visual memory';
    });
    assert.ok(requestBytes(prepared) < budget); assert.ok(imageCount(prepared, protocol) > 0);
    assert.ok(batches.length > 1);
  });
  test(`${protocol}: failed/empty summaries leave the source unchanged and valid earlier batches remain recoverable`, async t => {
    const directory = await fixture(t), original = history(protocol, 120), snapshot = structuredClone(original); let calls = 0;
    const context = new VisualContext({ directory, protocol, budget: { images: 49 } });
    await assert.rejects(context.prepare(original, async () => ++calls === 1 ? 'first successful visual memory' : ''), /非空摘要/);
    assert.deepEqual(original, snapshot);
    const state = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')); assert.equal(Object.keys(state.summaries).length, 1);
    const recovered = new VisualContext({ directory, protocol, budget: { images: 49 } });
    const output = await recovered.prepare(original, async () => 'next successful visual memory');
    assert.ok(imageCount(output, protocol) < 49); assert.match(JSON.stringify(output), /first successful visual memory/);
  });
}

test('disabled protection does not project history or start summary requests', async t => {
  const directory = await fixture(t), original = history('genai', 52);
  assert.equal(await new VisualContext({ directory, protocol: 'genai', budget: {} }).prepare(original, async () => { throw new Error('unexpected compaction'); }), original);
});

test('visual summary validation rejects in-stream errors and truncated/missing successful terminals', async () => {
  await assert.rejects(readVisualSummary(new Response('data: {"candidates":[{"content":{"parts":[{"text":"partial"}]}}]}\n\n',
    { headers: { 'content-type': 'text/event-stream' } }), 'genai'), /成功终态/);
  await assert.rejects(readVisualSummary(new Response(JSON.stringify({ content: [{ type: 'text', text: 'partial' }], stop_reason: 'max_tokens' })), 'anthropic'), /未正常完成/);
  await assert.rejects(readVisualSummary(new Response(JSON.stringify({ error: { message: 'actual upstream error' } })), 'genai'), /actual upstream error/);
});

test('Claude transport protects actual Messages requests, preserves authentication/SSE and leaves auxiliary endpoints unchanged', async t => {
  const directory = await fixture(t), requests: any[] = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString()); requests.push({ path: req.url, auth: req.headers['x-api-key'], body });
    if (body.stream === false) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ content: [{ type: 'text', text: 'fixture visual memory' }], stop_reason: 'end_turn' })); }
    else { res.writeHead(200, { 'content-type': 'text/event-stream', 'request-id': 'fixture-request' }); res.end('event: message_stop\ndata: {"type":"message_stop"}\n\n'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => { server.closeAllConnections(); server.close(); });
  const context = new VisualContext({ directory, protocol: 'anthropic', budget: { images: 49 } });
  const gateway = await claudeGateway(`http://127.0.0.1:${(server.address() as { port: number }).port}`, context, new AbortController().signal);
  t.after(() => gateway.close());
  const response = await fetch(gateway.url + '/v1/messages', { method: 'POST', headers: { 'x-api-key': 'private-fixture', 'content-type': 'application/json' }, body: JSON.stringify(history('anthropic', 52)) });
  assert.equal(response.headers.get('request-id'), 'fixture-request'); assert.match(await response.text(), /message_stop/);
  assert.equal(requests.length, 2); assert.ok(requests.every(request => request.auth === 'private-fixture'));
  assert.ok(requests.every(request => imageCount(request.body, 'anthropic') < 50));
});

test('AGV transport partitions actual inline request bytes before forwarding; capacity errors are not retryable gateway 502s', async t => {
  const directory = await fixture(t), requests: any[] = [], budget = 85000;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const payload = Buffer.concat(chunks), body = JSON.parse(payload.toString()); requests.push(body);
    assertGenaiMedia(body);
    assert.ok(payload.length < budget);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'actual complete visual summary' }] } }] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => { server.closeAllConnections(); server.close(); });
  const context = new VisualContext({ directory, protocol: 'genai', budget: { bytes: budget } });
  const gateway = await genaiGateway({ AGY_LLM_GATEWAY_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`, AGY_LLM_GATEWAY_WIRE_PROTOCOL: 'genai' },
    [], directory, new AbortController().signal, undefined, context);
  assert.ok(gateway); t.after(() => gateway.close());
  const response = await fetch(gateway.url + '/models/fixture:generateContent', { method: 'POST', body: JSON.stringify(history('genai', 18, 10000)) });
  assert.equal(response.status, 200); await response.text(); assert.ok(requests.length > 2);
  const tooLarge = history('genai', 1, 100000);
  const stopped = await fetch(gateway.url + '/models/fixture:generateContent', { method: 'POST', body: JSON.stringify(tooLarge) });
  assert.equal(stopped.status, 413); assert.match(await stopped.text(), /必要参考图|最新图片/);
});
