// Real patched CLI + simulated models/APIs. No account, key or paid generation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { CodexAgents } from '../../shared/codex/agents.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';

const { values } = parseArgs({ options: { codex: { type: 'string' } } });
if (!values.codex) throw new Error('请用 --codex 指定构建返回的实际二进制路径');
const root = await mkdtemp(join(tmpdir(), 'layering-native-image-smoke-'));
const png = await sharp({ create: { width: 32, height: 48, channels: 4, background: '#d1479580' } }).png().toBuffer();
const nanoPng = await sharp({ create: { width: 32, height: 48, channels: 3, background: '#09f20a' } })
  .composite([{ input: Buffer.from('<svg width="32" height="48"><rect x="8" y="8" width="16" height="32" fill="#414141"/></svg>') }]).png().toBuffer();
const picture = join(root, 'input.png'); await writeFile(picture, png);
let turn = 0, generation = 0, protocol = 'openai';
const imageCalls: string[] = [];
const server = createServer(async (req, res) => {
  try {
    let bytes = Buffer.alloc(0); for await (const chunk of req) bytes = Buffer.concat([bytes, chunk]);
    if (req.url === '/chat/v1/responses') {
      assert.equal(req.headers.authorization, 'Bearer chat-fixture');
      const body = JSON.parse(bytes.toString());
      // Namespace tool definitions may be rendered into system instructions by Codex.
      if (turn === 0) assert.ok(JSON.stringify(body).includes('imagegen'), 'native tool definition missing from the model request');
      const index = ++turn, id = `resp_${protocol}_${index}`;
      const item = index <= 2 ? { type: 'function_call', namespace: 'image_gen', name: 'imagegen',
        call_id: `image-${protocol}-${index}`, arguments: JSON.stringify({ prompt: 'Original image prompt',
          transparent_background: true, ...(index === 2 ? { referenced_image_paths: [picture] } : {}) }) }
        : { type: 'message', id: `msg-${protocol}-${index}`, role: 'assistant', content: [{ type: 'output_text', text: 'done' }] };
      const events = [{ type: 'response.created', response: { id } }, { type: 'response.output_item.done', item },
        { type: 'response.completed', response: { id, usage: { input_tokens: 30, output_tokens: 10, total_tokens: 40 } } }];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(events.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('')); return;
    }
    const model = protocol === 'openai' ? 'gpt-image-2.5-flare' : 'gemini-nano-banana-2.1';
    if (protocol === 'gemini') {
      assert.equal(req.url, '/images/v1beta/models/gemini-nano-banana-2.1:generateContent');
      assert.equal(req.headers['x-goog-api-key'], 'image-fixture');
      const parts = JSON.parse(bytes.toString()).contents[0].parts;
      assert.ok(parts[0].text.startsWith('Original image prompt\n\n'));
      assert.match(parts[0].text, /背景使用高纯度纯色 #00FF00/);
      assert.equal(parts.length, generation ? 2 : 1);
      if (generation) assert.deepEqual(Buffer.from(parts[1].inlineData.data, 'base64'), png);
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: nanoPng.toString('base64') } }] } }] }));
    } else {
      assert.equal(req.headers.authorization, 'Bearer image-fixture');
      if (generation) {
        assert.equal(req.url, '/images/v1/images/edits');
        const form = await new Request('http://localhost', { method: 'POST', headers: { 'content-type': req.headers['content-type']! }, body: new Uint8Array(bytes) }).formData();
        assert.equal(form.get('model'), model); assert.equal(form.get('prompt'), 'Original image prompt');
        const input = form.get('image') || form.get('image[]');
        assert.deepEqual(Buffer.from(await (input as File).arrayBuffer()), png);
      } else {
        assert.equal(req.url, '/images/v1/images/generations');
        const body = JSON.parse(bytes.toString()); assert.equal(body.model, model); assert.equal(body.prompt, 'Original image prompt');
      }
      res.end(JSON.stringify({ created: 1, data: [{ b64_json: png.toString('base64') }] }));
    }
    generation++; imageCalls.push(req.url!);
  } catch (error) { console.error(error); res.writeHead(500).end(String(error)); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
try {
  for (protocol of ['openai', 'gemini']) {
    turn = 0; generation = 0;
    const directory = join(root, protocol), home = join(directory, 'codex-home'); await mkdir(home, { recursive: true });
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('layering_') && !key.startsWith('LAYERING_')));
    const settings = loadWorkflowEnvironment({ ...env, CODEX_HOME: home, layering_codex_path: resolve(values.codex!),
      layering_custom_provider: 'true', layering_provider_base_url: base + '/chat/v1', layering_provider_api_key: 'chat-fixture',
      part_simplify_image_model: protocol === 'openai' ? 'gpt-image-2.5-flare' : 'gemini-nano-banana-2.1',
      [`layering_${protocol === 'openai' ? 'openai' : 'google'}_image_base_url`]: base + (protocol === 'openai' ? '/images/v1' : '/images/v1beta'),
      [`layering_${protocol === 'openai' ? 'openai' : 'google'}_image_api_key`]: 'image-fixture' }, directory);
    const session = new CodexAgents({ environment: settings, cwd: directory, logDirectory: join(directory, 'agents') }).createSession();
    try {
      const result = await session.run({ step: 'part_simplify', name: 'native fixture', prompt: 'Run the simulated image fixture.',
        imageGeneration: true, timeoutMs: 90_000 });
      assert.equal(generation, 2); assert.equal(result.images.length, 2);
      for (const image of result.images) {
        assert.ok(image.savedPath.startsWith(join(directory, 'step05_simplified/workspace/generated') + '/'));
        assert.equal((await sharp(image.savedPath).metadata()).hasAlpha, true);
        if (protocol === 'openai') assert.deepEqual(await sharp(image.savedPath).raw().toBuffer(), await sharp(png).raw().toBuffer());
        else {
          const { data, info } = await sharp(image.savedPath).raw().toBuffer({ resolveWithObject: true });
          assert.equal(info.width, 32); assert.equal(info.height, 48); assert.equal(data[3], 0);
          assert.deepEqual([...data.subarray((24 * 32 + 16) * 4, (24 * 32 + 16) * 4 + 4)], [65, 65, 65, 255]);
        }
      }
      const resumed = await session.run({ step: 'part_simplify', name: 'resume fixture', prompt: 'Finish.' });
      assert.equal(resumed.threadId, result.threadId);
      assert.deepEqual(await readFile(picture), png);
      console.log(JSON.stringify({ protocol, passed: true, images: result.images.length, resumed: true, imageCalls }));
    } finally { await session.close(); }
  }
} finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
