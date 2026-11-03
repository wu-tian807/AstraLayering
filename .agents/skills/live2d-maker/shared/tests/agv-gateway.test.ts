import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import type { ServerResponse } from 'node:http';
import { createMcpBridge } from '../agents/mcp.ts';
import { gatewayRequestUrl, genaiGateway, prepareGenaiThinking, prepareGenaiTools, rewriteGenaiTools } from '../agents/agv-gateway.ts';
import { ToolCatalog, toolDefinition, toolsDirectory } from '../codex/tool-config.ts';
import { profile as character } from '../../part-layering/profile.ts';
import { profile as clothing } from '../../clothing-part-layering/profile.ts';
const shadowTools = fileURLToPath(new URL('../../shadow/tools/', import.meta.url));

test('AGV gateway forwards headers before delayed SSE content and records phases without request secrets', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-headers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let release!: () => void;
  const blocked = new Promise<void>(done => { release = done; });
  const upstream = createServer(async (req, res) => {
    for await (const chunk of req) {}
    res.writeHead(200, { 'content-type': 'text/event-stream', 'x-request-id': 'upstream-fixture-id' });
    res.flushHeaders();
    await blocked;
    res.end('data: {"candidates":[{"content":{"parts":[{"text":"fixture body"}]}}]}\n\n');
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  t.after(() => { release(); upstream.closeAllConnections(); upstream.close(); });
  const events: any[] = [];
  const gateway = await genaiGateway({ AGY_LLM_GATEWAY_URL: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`,
    AGY_LLM_GATEWAY_WIRE_PROTOCOL: 'genai' }, [], root, new AbortController().signal, async event => { events.push(event); });
  assert.ok(gateway); t.after(() => gateway.close());
  const response = await Promise.race([fetch(gateway.url + '/models/fixture:streamGenerateContent?alt=sse&key=request-secret', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer credential-secret' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'private prompt' }] }] }),
  }), delay(2000).then(() => { throw new Error('Response headers were buffered until body'); })]);
  assert.equal(response.status, 200);
  assert.deepEqual(events.map(e => e.phase), ['started', 'prepared', 'headers']);
  release(); assert.match(await response.text(), /fixture body/);
  assert.deepEqual(events.map(e => e.phase), ['started', 'prepared', 'headers', 'first_body', 'completed']);
  assert.equal(new Set(events.map(e => e.requestId)).size, 1);
  assert.equal(events[2].upstreamRequestId, 'upstream-fixture-id');
  assert.doesNotMatch(JSON.stringify(events), /request-secret|credential-secret|private prompt|alt=sse/);
});

test('AGV request URL preserves gateway prefixes and query parameters without repeating the API path', () => {
  assert.equal(gatewayRequestUrl('https://fixture.test/v1beta', '/v1beta/models/argon:streamGenerateContent?alt=sse').href,
    'https://fixture.test/v1beta/models/argon:streamGenerateContent?alt=sse');
  assert.equal(gatewayRequestUrl('https://fixture.test/tenant/v1beta/', '/v1beta/models/argon:streamGenerateContent?alt=sse').href,
    'https://fixture.test/tenant/v1beta/models/argon:streamGenerateContent?alt=sse');
  assert.equal(gatewayRequestUrl('https://fixture.test/tenant', '/v1beta/models/argon:generateContent').href,
    'https://fixture.test/tenant/v1beta/models/argon:generateContent');
  assert.equal(gatewayRequestUrl('https://fixture.test', '/models/argon:generateContent?key=fixture').href,
    'https://fixture.test/models/argon:generateContent?key=fixture');
});

test('MINIMAL compatibility is opt-in and retains agent effort, thought flags and unrelated request data', () => {
  for (const level of ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']) {
    const body = { contents: [{ role: 'user', parts: [{ text: 'unchanged task' }] }],
      generationConfig: { maxOutputTokens: 65536, thinkingConfig: { includeThoughts: true, thinkingLevel: level } } };
    const original = structuredClone(body);
    prepareGenaiThinking(body);
    assert.deepEqual(body, original);
    prepareGenaiThinking(body, 'LOW');
    assert.deepEqual(body, { ...original, generationConfig: { ...original.generationConfig,
      thinkingConfig: { ...original.generationConfig.thinkingConfig, thinkingLevel: level === 'MINIMAL' ? 'LOW' : level } } });
  }
  const snake = { generation_config: { thinking_config: { thinking_level: 'MINIMAL', include_thoughts: true } } };
  prepareGenaiThinking(snake, 'LOW');
  assert.deepEqual(snake.generation_config.thinking_config, { thinking_level: 'LOW', include_thoughts: true });
});

test('gateway records actual request size/images and configured compatibility without exposing private data', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-prepared-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let received: any, target: string | undefined;
  const upstream = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received = JSON.parse(Buffer.concat(chunks).toString()); target = req.url;
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"candidates":[]}');
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const env = { AGY_LLM_GATEWAY_URL: `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1beta`,
    AGY_LLM_GATEWAY_WIRE_PROTOCOL: 'genai', agv_minimal_thinking_level: 'LOW' };
  const events: any[] = [];
  const gateway = await genaiGateway(env, [], root, new AbortController().signal, async event => { events.push(event); });
  assert.ok(gateway); t.after(() => gateway.close());
  const body = { contents: [{ role: 'user', parts: [{ text: 'private prompt' },
    { functionResponse: { name: 'view', response: {}, parts: [{ inlineData: { mimeType: 'image/png', data: 'private-image' } }] } }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'MINIMAL', includeThoughts: true } } };
  const response = await fetch(gateway.url + '/v1beta/models/argon:generateContent?key=private-key', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  await response.text();
  assert.equal(target, '/v1beta/models/argon:generateContent?key=private-key');
  assert.equal(received.generationConfig.thinkingConfig.thinkingLevel, 'LOW');
  const prepared = events.find(e => e.phase === 'prepared');
  assert.equal(prepared.inputImages, 1); assert.equal(prepared.requestBytes, Buffer.byteLength(JSON.stringify(received)));
  assert.equal(prepared.requestedThinkingLevel, 'MINIMAL'); assert.equal(prepared.thinkingLevel, 'LOW');
  assert.doesNotMatch(JSON.stringify(events), /private-key|private prompt|private-image/);
  await assert.rejects(genaiGateway({ ...env, agv_minimal_thinking_level: 'UNKNOWN' }, [], root,
    new AbortController().signal), /agv_minimal_thinking_level/);
});

test('AGV gateway keeps HTTP failures and broken streams visible after flushing headers', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-stream-error-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let active: ServerResponse | undefined;
  const upstream = createServer(async (req, res) => {
    for await (const chunk of req) {}
    if (req.url === '/error') {
      res.writeHead(400, { 'content-type': 'application/json' }); res.end('{"error":{"message":"actual failure"}}'); return;
    }
    active = res;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: {"candidates":[{"content":{"parts":[{"text":"partial"}]}}]}\n\n');
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const events: any[] = [];
  const gateway = await genaiGateway({ AGY_LLM_GATEWAY_URL: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`,
    AGY_LLM_GATEWAY_WIRE_PROTOCOL: 'genai' }, [], root, new AbortController().signal, async event => { events.push(event); });
  assert.ok(gateway); t.after(() => gateway.close());
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
  const failed = await fetch(gateway.url + '/error', init);
  assert.equal(failed.status, 400); assert.match(await failed.text(), /actual failure/);
  const response = await fetch(gateway.url + '/broken', init);
  const reader = response.body!.getReader();
  assert.equal((await reader.read()).done, false);
  active!.destroy();
  await assert.rejects(reader.read());
  assert.ok(events.some(e => e.phase === 'failed'));
});

test('agv gateway retains original function schema, arguments, signatures, text and every returned image across turns', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-bridge-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const results = join(root, '.run/case/agents/turn/bridge-results'); await mkdir(results, { recursive: true });
  const images = ['first-image', 'second-image'].map(s => Buffer.from(s).toString('base64'));
  let calls = 0;
  const args = { svg: '<svg>原始文本</svg>' };
  const tool = { name: 'fixture_render', description: '保留工具说明', inputSchema: { type: 'object', properties: { svg: { type: 'string' } }, required: ['svg'] },
    async execute(input: unknown) {
      assert.deepEqual(input, args); calls++;
      return { success: true, contentItems: [{ type: 'inputText' as const, text: '原始结果说明' },
        ...images.map(data => ({ type: 'inputImage' as const, imageUrl: `data:image/png;base64,${data}` }))] };
    } };
  const bridge = await createMcpBridge([tool], new AbortController().signal);
  t.after(() => bridge.close());
  const request = { tools: [{ functionDeclarations: [{ name: 'run_command' }] }], contents: [{ role: 'user', parts: [{ text: '完整任务提示词' }] }] };
  await prepareGenaiTools(request, [tool], root);
  assert.deepEqual(request.tools[1].functionDeclarations[0], { name: tool.name, description: tool.description, parametersJsonSchema: tool.inputSchema });
  assert.equal(request.contents[0].parts[0].text, '完整任务提示词');
  const event = rewriteGenaiTools({ candidates: [{ content: { parts: [{ thoughtSignature: 'retain-signature', functionCall: { name: tool.name, args } }] } }] }, [tool]);
  const part = event.candidates[0].content.parts[0], encoded = part.functionCall.args.CommandLine.split(' ').at(-1);
  assert.equal(part.thoughtSignature, 'retain-signature');
  const output = await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../agents/agv-tool.ts', import.meta.url)), encoded],
    { env: { ...process.env, ...bridge.env, LAYERING_BRIDGE_RESULTS: results } });
  const file = output.stdout.trim().slice('ASTRA_TOOL_RESULT:'.length);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).name, tool.name);
  const next: any = { contents: [{ role: 'model', parts: [part] }, { role: 'user', parts: [{ functionResponse: { id: 'function-id', name: 'run_command', response: { output: output.stdout } } }] }] };
  // Later stages need to restore history even when the image/drawing tool is no longer registered.
  await prepareGenaiTools(next, [], root);
  assert.deepEqual(next.contents[0].parts[0].functionCall, { name: tool.name, args });
  const response = next.contents[1].parts[0].functionResponse;
  assert.equal(response.id, 'function-id'); assert.equal(response.name, tool.name);
  assert.equal(response.response.output, '原始结果说明');
  assert.deepEqual(response.parts.map((p: any) => p.inlineData.data), images);
  assert.equal(calls, 1);
});

test('agv HTTP gateway sends the real grouping union schema as JSON Schema and retains native declarations', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-schema-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const definition = toolDefinition('write_groups');
  const tool = { ...definition, async execute() { throw new Error('not called'); } };
  const schema = definition.inputSchema as any;
  assert.deepEqual(schema.properties.groups.items.properties.note.type, ['string', 'null']);
  let received: any;
  const upstream = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received = JSON.parse(Buffer.concat(chunks).toString());
    const declarations = received.tools.flatMap((entry: any) => entry.functionDeclarations || []);
    const group = declarations.find((entry: any) => entry.name === definition.name);
    // Model the Google protobuf rejection that stopped the first grouping call.
    if (group?.parameters) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Schema.type cannot start list' })); return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [
      { functionCall: { name: definition.name, args: { groups: [{ id: 'hair', name: '头发', note: null }] } } },
    ] } }] }));
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const gateway = await genaiGateway({ AGY_LLM_GATEWAY_URL: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`,
    AGY_LLM_GATEWAY_WIRE_PROTOCOL: 'genai' }, [tool], root, new AbortController().signal);
  assert.ok(gateway); t.after(() => gateway.close());
  const native = { name: 'run_command', parameters: { type: 'OBJECT', properties: { CommandLine: { type: 'STRING' } } } };
  const prompt = '本次真实分组提示词';
  const response = await fetch(gateway.url + '/models/gemini-4-argon:generateContent', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      tools: [{ functionDeclarations: [native] }], contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }) });
  assert.equal(response.status, 200);
  assert.deepEqual(received.tools[0].functionDeclarations, [native]);
  const declaration = received.tools[1].functionDeclarations[0];
  assert.deepEqual(declaration.parametersJsonSchema, definition.inputSchema);
  assert.equal(Object.hasOwn(declaration, 'parameters'), false);
  assert.equal(declaration.description, definition.description);
  assert.equal(received.contents[0].parts[0].text, prompt);
  const result: any = await response.json();
  const call = result.candidates[0].content.parts[0].functionCall;
  assert.equal(call.name, 'run_command');
  const input = JSON.parse(Buffer.from(call.args.CommandLine.split(' ').at(-1), 'base64url').toString());
  assert.equal(input.name, definition.name);
  assert.equal(input.arguments.groups[0].note, null);
});

test('all real shared, character and clothing tool schemas retain every constraint in Gemini and MCP registration', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const shared = (await readdir(toolsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  assert.ok(shared.includes('write_groups') && shared.includes('propose_occlusion') && shared.includes('imagegen'));
  for (const [label, overrides] of [['shared', undefined], ['character', character.toolsDirectory], ['clothing', clothing.toolsDirectory], ['shadow', shadowTools]] as const) {
    const catalog = new ToolCatalog(toolsDirectory, overrides), names = catalog.names();
    const definitions = names.map(name => catalog.get(name));
    const snapshot = structuredClone(definitions);
    const tools = definitions.map(definition => ({ ...definition, async execute() { throw new Error('registration only'); } }));
    for (const key of ['functionDeclarations', 'function_declarations']) {
      const native = { name: 'run_command', parameters: { type: 'OBJECT' } };
      const request: any = { tools: [{ [key]: [native] }], contents: [{ role: 'user', parts: [{ text: label }] }] };
      await prepareGenaiTools(request, tools, root);
      // Repeating request preparation must not append another copy of the tools.
      await prepareGenaiTools(request, tools, root);
      const wire = JSON.parse(JSON.stringify(request));
      assert.equal(wire.tools.length, 2, `${label}/${key}`);
      assert.deepEqual(wire.tools[0][key], [native]);
      assert.deepEqual(wire.tools[1].functionDeclarations, snapshot.map(({ name, description, inputSchema }) =>
        ({ name, description, parametersJsonSchema: inputSchema })), `${label}/${key}`);
      const group = wire.tools[1].functionDeclarations.find((definition: any) => definition.name === 'write_groups');
      assert.deepEqual(group.parametersJsonSchema.properties.groups.items.properties.note.type, ['string', 'null']);
      const depth = wire.tools[1].functionDeclarations.find((definition: any) => definition.name === 'propose_occlusion');
      assert.equal(depth.parametersJsonSchema.properties.layers.items.oneOf.length, 2);
      assert.equal(wire.contents[0].parts[0].text, label);
    }
    const bridge = await createMcpBridge(tools, new AbortController().signal);
    try {
      const response = await fetch(bridge.env.LAYERING_MCP_URL, { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bridge.env.LAYERING_MCP_TOKEN}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
      const wire: any = await response.json();
      assert.deepEqual(wire.result.tools, snapshot, `${label}/MCP`);
    } finally { await bridge.close(); }
    assert.deepEqual(definitions, snapshot, `${label}: source definitions mutated`);
  }
});
