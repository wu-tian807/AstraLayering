import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createCodexImageRoute, usesPatchedImageTool } from '../agents/codex-images.ts';
import { loadWorkflowEnvironment, checkCodexCapabilities } from '../codex/environment.ts';
import { CodexAgents } from '../codex/agents.ts';
import { fakeAppServer } from '../../part-layering/tests/fake-app-server.ts';
import { fakeDebug } from './fake-codex.ts';
import { imageGenerationTool } from '../agents/images.ts';
import { runAgent } from '../raster/agent.ts';
import { textResult } from '../codex/function-tools.ts';

const capabilities = { version: 1, image_provider: true, image_provider_version: 2, image_compaction: true, image_compaction_version: 2, failed_error_event_version: 1 };

test('raster 自定义框选工具与原生生图兼容，保留配置与会话', async t => {
  const { root } = await fixture(t);
  const server = await fakeAppServer(root, [{ tool: 'annotate_review_regions', arguments: {} }]);
  let source = await readFile(server.executable, 'utf8');
  source = source.replace('#!/usr/bin/env node', `#!${process.execPath}`)
    .replace('const calls =', `${fakeDebug(capabilities)}\nconst calls =`)
    .replace('文件已保存，不返回 JSON。', '{"status":"completed","summary":"inspected"}');
  await writeFile(server.executable, source);
  const environment = loadWorkflowEnvironment({ layering_codex_path: server.executable,
    raster_step01_image_model: 'gpt-image-2.5-flare',
    layering_openai_image_base_url: 'https://image.example/v1', layering_openai_image_api_key: 'fixture' }, root);
  let called = 0;
  const result = await runAgent({ directory: root, step: 'raster_step01', model: 'gpt-6-astra', effort: 'xhigh',
    prompt: 'inspect', threadId: 'native-thread', environment, onEvent: async () => {},
    tools: [{ name: 'annotate_review_regions', description: 'fixture', inputSchema: { type: 'object' },
      execute: async () => { called++; return textResult('located'); } }] });
  assert.equal(result.status, 'completed'); assert.equal(called, 1);
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(protocol.some(event => event.method === 'thread/resume'));
  assert.equal(protocol.find(event => event.method === 'thread/resume').params.config['features.image_generation'], true);
  const native = await runAgent({ directory: root, step: 'raster_step01', model: 'gpt-6-astra', effort: 'xhigh',
    prompt: 'native inspect', environment: loadWorkflowEnvironment({ layering_codex_path: server.executable }, root), onEvent: async () => {},
    tools: [{ name: 'annotate_review_regions', description: 'fixture', inputSchema: { type: 'object' }, execute: async () => textResult('located') }] });
  assert.equal(native.status, 'completed');
  const latest = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(latest.findLast(event => event.method === 'thread/start').params.config['features.image_generation'], true);
  // The catalog's tool_mode would hide these tools behind code mode's script; every model calls them directly.
  const argv: string[] = JSON.parse(await readFile(server.argv, 'utf8'));
  for (const config of ['features.code_mode=false', 'features.code_mode_only=false']) assert.ok(argv.includes(config), config);
  const catalog = argv.findLast(value => value.startsWith('model_catalog_json='))!;
  const models = JSON.parse(await readFile(JSON.parse(catalog.slice('model_catalog_json='.length)), 'utf8')).models;
  assert.deepEqual(models.map((model: { tool_mode: unknown }) => model.tool_mode), [null]);
});
async function fixture(t: { after(fn: () => Promise<unknown>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'codex-native-images-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, 'codex.mjs');
  await writeFile(executable, `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify(capabilities))});\n`, { mode: 0o700 });
  return { root, executable };
}
test('normal/depth use opaque data transport in both tools and native routes without matting', async t => {
  const { root, executable } = await fixture(t);
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#8080ff' } }).png().toBuffer();
  const input = join(root, 'input.png'); await writeFile(input, png);
  let calls = 0;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    const args = req.headers['content-type']?.startsWith('multipart')
      ? Object.fromEntries(await new Request('http://localhost', { method: 'POST', headers: { 'content-type': req.headers['content-type']! }, body: new Uint8Array(bytes) }).formData())
      : JSON.parse(bytes.toString());
    assert.equal(args.background, 'opaque'); assert.equal(args.prompt, 'normal data'); calls++;
    res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(done => server.close(() => done())));
  const settings = loadWorkflowEnvironment({ layering_codex_path: executable,
    shadow_maps_image_model: 'gemini-nano-banana-2.1',
    layering_google_image_base_url: `http://127.0.0.1:${(server.address() as any).port}/v1`,
    layering_google_image_api_key: 'fixture', layering_google_image_protocol: 'openai' }, root);
  const tool = imageGenerationTool(settings, 'shadow_maps', join(root, 'output'))!;
  const result = await tool.execute({ prompt: 'normal data', input_images: [input] }, new AbortController().signal);
  const saved = JSON.parse((result.contentItems[0] as { text: string }).text).savedPath;
  assert.deepEqual(await readFile(saved), png); // absolute for the agent
  const route = await createCodexImageRoute(settings, 'shadow_maps', root);
  try {
    const response = await fetch(route.env.LAYERING_IMAGE_BASE_URL + '/images/generations', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + route.env.LAYERING_IMAGE_API_KEY },
      body: JSON.stringify({ model: 'gemini-nano-banana-2.1', prompt: 'normal data' }),
    });
    assert.equal(response.status, 200); assert.equal(calls, 2);
  } finally { await route.close(); }
});

test('codex-native does not enable image patches; custom Codex models require current image capabilities', async t => {
  const { root, executable } = await fixture(t);
  const native = loadWorkflowEnvironment({ layering_codex_path: '/missing/codex', LAYERING_IMAGE_BASE_URL: 'https://stale.example',
    layering_image_base_url: 'https://legacy.example/v1', layering_image_api_key: 'fixture', default_image_model: 'codex-native' }, root);
  assert.equal(usesPatchedImageTool(native, 'part_simplify'), false);
  assert.equal(native.codex.env!.LAYERING_IMAGE_BASE_URL, undefined);
  await assert.rejects(checkCodexCapabilities(native), /补丁能力检查/);
  const custom = loadWorkflowEnvironment({ layering_codex_path: executable,
    part_simplify_image_model: 'gpt-image-2.5-flare', layering_openai_image_base_url: 'https://image.example/v1',
    layering_openai_image_api_key: 'fixture' }, root);
  assert.equal(usesPatchedImageTool(custom, 'part_simplify'), true);
  await checkCodexCapabilities(custom, custom.codex, { image: true });
  await assert.rejects(checkCodexCapabilities(custom, { codexPathOverride: '/missing/codex' }, { image: true }), /补丁能力检查/);
  const noBinary = loadWorkflowEnvironment({}, root);
  let builds = 0;
  const prepare = async () => { builds++; return executable; };
  const requestOptions = {...noBinary.codex};
  await checkCodexCapabilities(noBinary, requestOptions, {}, prepare);
  assert.equal(builds, 1);
  assert.equal(requestOptions.codexPathOverride, executable);
  assert.equal(noBinary.codex.codexPathOverride, executable);
  await checkCodexCapabilities(noBinary, noBinary.codex, { image: true }, prepare);
  assert.equal(builds, 1);
});

test('native routes share OpenAI/Gemini transports, preserve image bytes/alpha and isolate concurrent models', async t => {
  const { root, executable } = await fixture(t);
  const png = await sharp({ create: { width: 8, height: 12, channels: 4, background: '#d03e7780' } }).png().toBuffer();
  const calls: { url: string; prompt: string; model: string; refs: number }[] = [];
  const server = createServer(async (req, res) => {
    let bytes = Buffer.alloc(0); for await (const chunk of req) bytes = Buffer.concat([bytes, chunk]);
    let args: any, inputs: Buffer[];
    if (req.url?.includes(':generateContent')) {
      assert.equal(req.headers['x-goog-api-key'], 'google-secret');
      const body = JSON.parse(bytes.toString());
      args = { prompt: body.contents[0].parts[0].text, model: 'gemini-nano-banana-2.1' };
      inputs = body.contents[0].parts.slice(1).map((p: any) => Buffer.from(p.inlineData.data, 'base64'));
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: png.toString('base64') } }] } }] }));
    } else {
      assert.equal(req.headers.authorization, 'Bearer openai-secret');
      if (req.url?.endsWith('/edits')) {
        const form = await new Request('http://localhost', { method: 'POST', headers: { 'content-type': req.headers['content-type']! }, body: new Uint8Array(bytes) }).formData();
        args = Object.fromEntries(form); inputs = [];
        for (const [key, value] of form) if (key.startsWith('image')) inputs.push(Buffer.from(await (value as File).arrayBuffer()));
      } else { args = JSON.parse(bytes.toString()); inputs = []; }
      res.end(JSON.stringify({ created: 1, data: [{ b64_json: png.toString('base64') }] }));
    }
    for (const input of inputs) assert.deepEqual(input, png);
    calls.push({ url: req.url!, prompt: args.prompt, model: args.model, refs: inputs.length });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise<void>(done => server.close(() => done())); });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const settings = loadWorkflowEnvironment({ layering_codex_path: executable,
    PATH: process.env.PATH,
    part_simplify_image_model: 'gpt-image-2.5-flare', part_base_subject_image_model: 'gemini-nano-banana-2.1',
    layering_openai_image_base_url: base + '/v1', layering_openai_image_api_key: 'openai-secret',
    layering_google_image_base_url: base + '/v1beta', layering_google_image_api_key: 'google-secret' }, root);
  const openai = await createCodexImageRoute(settings, 'part_simplify', join(root, 'openai'));
  t.after(() => openai.close());
  const google = await createCodexImageRoute(settings, 'part_base_subject', join(root, 'google'), settings.codex, undefined, { runsRoot: root });
  t.after(() => google.close());
  try {
    assert.notEqual(openai.env.LAYERING_IMAGE_API_KEY, google.env.LAYERING_IMAGE_API_KEY);
    const invoke = async (route: typeof openai, count: number) => {
      const form = new FormData(); form.set('model', route.env.LAYERING_IMAGE_MODEL); form.set('prompt', '不改写的原始提示词');
      for (let i = 0; i < count; i++) form.append('image[]', new Blob([new Uint8Array(png)], { type: 'image/png' }), `input-${i}.png`);
      const result = await fetch(route.env.LAYERING_IMAGE_BASE_URL + `/images/${count ? 'edits' : 'generations'}`, { method: 'POST',
        headers: { authorization: `Bearer ${route.env.LAYERING_IMAGE_API_KEY}`, ...(count ? {} : { 'content-type': 'application/json' }) },
        body: count ? form : JSON.stringify({ model: route.env.LAYERING_IMAGE_MODEL, prompt: '不改写的原始提示词', background: 'transparent' }) });
      assert.equal(result.status, 200);
      const data = await result.json(); const output = Buffer.from(data.data[0].b64_json, 'base64');
      assert.equal((await sharp(output).metadata()).hasAlpha, true);
      assert.deepEqual(await sharp(output).raw().toBuffer(), await sharp(png).raw().toBuffer());
    };
    await Promise.all([invoke(openai, 0), invoke(google, 0)]);
    await Promise.all([invoke(openai, 2), invoke(google, 2)]);
    assert.equal(calls.length, 4);
    assert.ok(calls.filter(c => c.model === 'gpt-image-2.5-flare').every(c => c.prompt === '不改写的原始提示词'));
    for (const call of calls.filter(c => c.model === 'gemini-nano-banana-2.1')) {
      assert.ok(call.prompt.startsWith('不改写的原始提示词\n\n'));
      assert.match(call.prompt.replaceAll('\r\n', '\n'), /背景使用高纯度纯色 #00FF00/);
    }
    assert.equal((await fetch(openai.env.LAYERING_IMAGE_BASE_URL + '/images/generations', { method: 'POST' })).status, 401);
  } finally { await openai.close(); await google.close(); }
  await assert.rejects(fetch(openai.env.LAYERING_IMAGE_BASE_URL + '/images/generations'));
});

test('Codex completion uses native image events, resumes after changing image model and keeps products', async t => {
  const { root } = await fixture(t);
  const savedPath = join(root, 'existing.png'); await writeFile(savedPath, 'keep');
  const server = await fakeAppServer(root, [], 'completed', [{ type: 'imageGeneration', status: 'completed', savedPath }]);
  let source = await readFile(server.executable, 'utf8');
  source = source.replace('#!/usr/bin/env node', `#!${process.execPath}`);
  source = source.replace('const calls =', `${fakeDebug(capabilities)}\nconst calls =`);
  await writeFile(server.executable, source);
  const settings = loadWorkflowEnvironment({ layering_codex_path: server.executable,
    part_completion_image_model: 'gpt-image-2.5-flare',
    layering_openai_image_base_url: 'https://image.example/v1', layering_openai_image_api_key: 'fixture' }, root);
  const session = new CodexAgents({ environment: settings, cwd: root, logDirectory: join(root, 'logs') }).createSession();
  try {
    const a = await session.run({ step: 'part_completion', name: 'complete', prompt: '原补全任务' });
    settings.stepImages.part_completion = 'gpt-image-2.5-sunburst';
    const b = await session.run({ step: 'part_completion', name: 'continue', prompt: '继续补全任务' });
    assert.equal(a.threadId, b.threadId); assert.deepEqual(b.images, [{ savedPath }]);
    assert.equal(await readFile(savedPath, 'utf8'), 'keep');
    const records = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const starts = records.filter(r => ['thread/start', 'thread/resume'].includes(r.method));
    assert.deepEqual(starts.map(r => r.method), ['thread/start', 'thread/resume']);
    for (const r of starts) {
      assert.equal(r.params.config['features.image_generation'], true);
      assert.ok(!r.params.dynamicTools.some((tool: any) => tool.name === 'imagegen'));
    }
  } finally { await session.close(); }
});

test('构造会话后才解析的补丁路径传给实际 App Server，不沿用构造时的入口快照', async t => {
  const {root} = await fixture(t), server = await fakeAppServer(root, []);
  const source = (await readFile(server.executable,'utf8')).replace('#!/usr/bin/env node', `#!${process.execPath}`)
    .replace('const calls =', `${fakeDebug(capabilities)}\nconst calls =`);
  await writeFile(server.executable,source);
  const environment = loadWorkflowEnvironment({layering_image_compact_threshold:'49'},root);
  const session = new CodexAgents({environment,cwd:root,logDirectory:join(root,'logs')}).createSession();
  environment.codex.codexPathOverride = server.executable;
  try {
    await session.run({name:'late-patch',prompt:'fixture',tools:[]},AbortSignal.timeout(5000));
    const protocol=(await readFile(server.capture,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    assert.ok(protocol.some(event=>event.method==='thread/start'));
  } finally {await session.close();}
});
