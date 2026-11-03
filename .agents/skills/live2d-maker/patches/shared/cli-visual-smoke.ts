import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { runCliTask } from '../../shared/agents/cli.ts';
import { parseAgentModel } from '../../shared/agents/models.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { imageCount, requestBytes } from './visual-context.ts';

// Real installed CLI, local fake upstream, no external model calls or drawing.
const { values } = parseArgs({ options: { harness: { type: 'string' }, cli: { type: 'string' } } });
assert.ok(values.harness === 'agv' || values.harness === 'claude');
const harness = values.harness, protocol = harness === 'agv' ? 'genai' : 'anthropic';
const root = await mkdtemp(join(tmpdir(), `astra-${harness}-visual-smoke-`));
const pictures = await Promise.all(Array.from({ length: 52 }, (_, index) => sharp({ create: { width: 8, height: 8, channels: 4,
  background: { r: index + 1, g: 100, b: 180, alpha: 1 } } }).png().toBuffer()));
let mainCalls = 0, summaryCalls = 0;
const requests: { images: number; bytes: number; summary: boolean }[] = [];
function required(schema: any): any {
  if (schema?.default !== undefined) return schema.default;
  const type = String(schema?.type ?? '').toLowerCase();
  if (type === 'object') return Object.fromEntries((schema.required ?? Object.keys(schema.properties ?? {})).map((key: string) => [key, required(schema.properties?.[key])]));
  if (type === 'array') return [];
  if (type === 'boolean') return true;
  if (type === 'integer' || type === 'number') return 1;
  return 'DONE';
}
const server = createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (protocol === 'genai') for (const content of body.contents ?? []) for (const part of content.parts ?? []) {
      const result = part.functionResponse ?? part.function_response;
      for (const media of result?.parts ?? []) assert.ok(Object.keys(media).length === 1
        && ['inlineData', 'inline_data', 'fileData', 'file_data'].includes(Object.keys(media)[0]),
      'Real CLI payload has invalid FunctionResponse media');
    }
    const summary = JSON.stringify(body).includes('This is internal visual context compaction');
    const images = imageCount(body, protocol); requests.push({ images, bytes: requestBytes(body), summary });
    assert.ok(images < 50, `Real CLI sent ${images} images to strict upstream`);
    let text = 'DONE', name: string | undefined, args = {};
    if (summary) { summaryCalls++; text = 'The supplied historical fixture images were visually compacted; retain original colors and completed tool results.'; }
    else {
      const definitions = harness === 'agv' ? (body.tools ?? []).flatMap((tool: any) => tool.functionDeclarations ?? tool.function_declarations ?? []) : body.tools ?? [];
      // AGV also calls an internal monitor. Only the main agent's request has
      // native run_command; monitor responses must not consume our tool turn.
      const isMain = harness !== 'agv' || definitions.some((tool: any) => tool.name === 'run_command');
      const imageTool = isMain && definitions.find((tool: any) => tool.name?.includes('fixture_images'));
      if (imageTool && mainCalls++ === 0) name = imageTool.name;
      else if (harness === 'agv' && isMain) {
        const finish = definitions.find((tool: any) => tool.name === 'finish');
        if (finish) { name = finish.name; args = required(finish.parameters ?? finish.parametersJsonSchema); }
      }
    }
    if (harness === 'agv') {
      const event = { candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: name ? [{ functionCall: { name, args } }] : [{ text }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 } };
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end('data: ' + JSON.stringify(event) + '\n\n');
    } else {
      const content = name ? [{ type: 'tool_use', id: 'fixture-read', name, input: args }] : [{ type: 'text', text }];
      const message = { id: `msg-${requests.length}`, type: 'message', role: 'assistant', model: body.model,
        content, stop_reason: name ? 'tool_use' : 'end_turn', stop_sequence: null, usage: { input_tokens: 100, output_tokens: 20 } };
      if (!body.stream) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(message)); return; }
      const events: any[] = [{ type: 'message_start', message: { ...message, content: [], stop_reason: null } }];
      events.push({ type: 'content_block_start', index: 0, content_block: name ? { type: 'tool_use', id: 'fixture-read', name, input: {} } : { type: 'text', text: '' } });
      events.push({ type: 'content_block_delta', index: 0, delta: name ? { type: 'input_json_delta', partial_json: '{}' } : { type: 'text_delta', text } });
      events.push({ type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: 20 } }, { type: 'message_stop' });
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
    }
  } catch (error) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: String(error) } })); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const upstream = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
try {
  const env = { ...process.env, ANTHROPIC_BASE_URL: upstream, ANTHROPIC_API_KEY: 'local-fixture', ANTHROPIC_AUTH_TOKEN: 'local-fixture',
    AGY_LLM_GATEWAY_URL: upstream, AGY_LLM_GATEWAY_API_KEY: 'local-fixture', AGY_LLM_GATEWAY_WIRE_PROTOCOL: 'genai', AGY_LLM_GATEWAY_MODELS: 'gemini-4-argon',
    [`${harness}_image_compact_threshold`]: '49', ...(values.cli ? { [`${harness}_path`]: values.cli } : {}) };
  const settings = loadWorkflowEnvironment(env, root);
  const model = parseAgentModel(harness === 'agv' ? 'gemini-4-argon-high' : 'claude-sonnet-5-5-high', 'fixture');
  const result = await runCliTask({ name: 'local-visual-transport-fixture', cwd: root, prompt: 'Complete the local transport fixture.',
    tools: [{ name: 'fixture_images', description: 'Return the 52 local fixture images.', inputSchema: { type: 'object', properties: {} },
      async execute() { return { success: true, contentItems: pictures.map(bytes => ({ type: 'inputImage' as const, imageUrl: `data:image/png;base64,${bytes.toString('base64')}` })) }; } }] },
    model, settings, { cwd: root, logDirectory: join(root, 'agents') }, new AbortController().signal);
  assert.ok(result.threadId); assert.ok(summaryCalls > 0, JSON.stringify({ mainCalls, requests })); assert.ok(mainCalls > 1);
  console.log(JSON.stringify({ harness, status: 'passed', mainCalls, summaryCalls, maximumImages: Math.max(...requests.map(request => request.images)) }));
} finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
