import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, realpath } from 'node:fs/promises';
import { relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { FunctionTool } from '../codex/function-tools.ts';
import { imageBudget, VisualContext, readVisualSummary, visualErrorStatus } from '../../patches/shared/visual-context.ts';

const helper = fileURLToPath(new URL('./agv-tool.ts', import.meta.url));
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
const resultMarker = /ASTRA_TOOL_RESULT:([^\s"'\\]+)/;
export type GatewayEvent = { type: 'agv.gateway'; requestId: string; phase: 'started' | 'prepared' | 'headers' | 'first_body' | 'completed' | 'failed';
  path: string; elapsedMs: number; status?: number; upstreamRequestId?: string; aborted?: boolean; errorName?: string;
  upstreamPath?: string; requestBytes?: number; inputImages?: number; requestedThinkingLevel?: string; thinkingLevel?: string };

export function gatewayRequestUrl(base: string, request: string): URL {
  const target = new URL(base), incoming = new URL(request, 'http://localhost');
  const prefix = target.pathname.split('/').filter(Boolean), suffix = incoming.pathname.split('/').filter(Boolean);
  let overlap = Math.min(prefix.length, suffix.length);
  while (overlap && prefix.slice(-overlap).join('/') !== suffix.slice(0, overlap).join('/')) overlap--;
  target.pathname = '/' + [...prefix, ...suffix.slice(overlap)].join('/');
  for (const [key, value] of incoming.searchParams) target.searchParams.append(key, value);
  return target;
}

export function prepareGenaiThinking(body: any, replacement?: string): void {
  // Some gateways route CLI monitors to a model that does not accept MINIMAL.
  // This opt-in wire compatibility setting never changes LOW/HIGH drawing calls.
  const thinking = body.generationConfig?.thinkingConfig ?? body.generation_config?.thinking_config;
  if (replacement && thinking?.thinkingLevel === 'MINIMAL') thinking.thinkingLevel = replacement;
  if (replacement && thinking?.thinking_level === 'MINIMAL') thinking.thinking_level = replacement;
}

function imageCount(value: any): number {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.reduce((count, part) => count + imageCount(part), 0);
  if (value.inlineData?.data || value.inline_data?.data) return 1;
  return Object.values(value).reduce<number>((count, part) => count + imageCount(part), 0);
}
export async function prepareGenaiTools(body: any, tools: readonly FunctionTool[], logsRoot: string) {
  // Keep all native tools and append the exact workflow descriptions and schemas.
  body.tools ||= [];
  const registered = new Set(body.tools.flatMap((t: any) => (t.functionDeclarations || t.function_declarations || []).map((f: any) => f.name)));
  const added = tools.filter(t => !registered.has(t.name));
  // parameters is Gemini's restricted OpenAPI Schema, whose type is a scalar.
  // Our file-backed JSON Schemas include unions such as ["string", "null"].
  // The JSON Schema field preserves those definitions without weakening them.
  if (added.length) body.tools.push({ functionDeclarations: added.map(({ name, description, inputSchema }) => ({ name, description, parametersJsonSchema: inputSchema })) });
  const root = await realpath(logsRoot);
  for (const content of body.contents || []) {
    const parts = [];
    for (const part of content.parts || []) {
      const call = part.functionCall || part.function_call;
      if (call?.name === 'run_command' && call.args?.CommandLine?.includes(quote(helper))) {
        try {
          const input = JSON.parse(Buffer.from(call.args.CommandLine.trim().split(/\s+/).at(-1), 'base64url').toString());
          if (typeof input.name === 'string') {
            parts.push({ ...part, [part.functionCall ? 'functionCall' : 'function_call']: { ...call, name: input.name, args: input.arguments } });
            continue;
          }
        } catch {}
      }
      const response = part.functionResponse || part.function_response;
      const marker = response && resultMarker.exec(JSON.stringify(response.response));
      if (marker) {
        const path = await realpath(marker[1]);
        const rel = relative(root, path);
        if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error('工具结果不在任务记录目录内');
        const { name, result } = JSON.parse(await readFile(path, 'utf8'));
        const images = (result.content || []).filter((p: any) => p.type === 'image').map((p: any) => ({ inlineData: { mimeType: p.mimeType, data: p.data } }));
        parts.push({ functionResponse: { ...response, name, response: { output: (result.content || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n'),
          isError: !!result.isError }, ...(images.length ? { parts: images } : {}) } });
        continue;
      }
      parts.push(part);
    }
    content.parts = parts;
  }
}
export function rewriteGenaiTools(event: any, tools: readonly FunctionTool[]) {
  for (const candidate of event.candidates || []) for (const part of candidate.content?.parts || []) {
    const key = part.functionCall ? 'functionCall' : part.function_call ? 'function_call' : undefined;
    if (!key || !tools.some(t => t.name === part[key].name)) continue;
    const call = part[key];
    const encoded = Buffer.from(JSON.stringify({ name: call.name, arguments: call.args || {}, invocation: randomUUID() })).toString('base64url');
    part[key] = { ...call, name: 'run_command', args: { CommandLine: `${quote(process.execPath)} ${quote(helper)} ${encoded}`,
      WaitMsBeforeAsync: 10000, toolSummary: `Call ${call.name}` } };
  }
  return event;
}

export async function genaiGateway(env: NodeJS.ProcessEnv, tools: readonly FunctionTool[], logsRoot: string, signal: AbortSignal,
  observe?: (event: GatewayEvent) => Promise<void>, context?: VisualContext) {
  const budget = imageBudget(env, 'agv');
  if (!env.AGY_LLM_GATEWAY_URL || env.AGY_LLM_GATEWAY_WIRE_PROTOCOL !== 'genai') {
    if (budget.images || budget.bytes || budget.deduplicate) throw new Error('AGV 图片容量保护需要已配置的 genai 网关；当前接口无法拦截实际请求，未静默忽略保护配置。');
    return;
  }
  const minimalThinking = env.agv_minimal_thinking_level?.trim();
  if (minimalThinking && !['LOW', 'MEDIUM', 'HIGH'].includes(minimalThinking)) {
    throw new Error('agv_minimal_thinking_level 只能为 LOW、MEDIUM、HIGH；留空保留 CLI 原值。');
  }
  const visual = context ?? new VisualContext({ directory: `${logsRoot}/visual-context`, protocol: 'genai', budget });
  const upstream = env.AGY_LLM_GATEWAY_URL.replace(/\/+$/, '');
  const controllers = new Set<AbortController>();
  const server = createServer(async (req, res) => {
    const controller = new AbortController(); controllers.add(controller);
    const requestId = randomUUID(), started = performance.now();
    const path = new URL(req.url || '/', 'http://localhost').pathname; // Never log query keys, credentials or bodies.
    const trace = (phase: GatewayEvent['phase'], fields: Partial<GatewayEvent> = {}) => observe?.({
      type: 'agv.gateway', requestId, phase, path, elapsedMs: performance.now() - started, ...fields });
    res.once('close', () => controller.abort());
    try {
      await trace('started');
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      let body = JSON.parse(Buffer.concat(chunks).toString());
      if (body.contents) await prepareGenaiTools(body, tools, logsRoot);
      const thinking = body.generationConfig?.thinkingConfig ?? body.generation_config?.thinking_config;
      const requestedThinkingLevel = thinking?.thinkingLevel ?? thinking?.thinking_level;
      prepareGenaiThinking(body, minimalThinking);
      const target = gatewayRequestUrl(upstream, req.url || '/');
      const headers = Object.fromEntries(Object.entries(req.headers).filter(([key, value]) => !['host', 'content-length', 'connection'].includes(key) && typeof value === 'string')) as Record<string, string>;
      body = await visual.prepare(body, async summary => readVisualSummary(await fetch(target, { method: 'POST', headers,
        body: JSON.stringify(summary), signal: AbortSignal.any([signal, controller.signal]) }), 'genai'));
      const payload = JSON.stringify(body);
      await trace('prepared', { upstreamPath: target.pathname, requestBytes: Buffer.byteLength(payload), inputImages: imageCount(body),
        requestedThinkingLevel, thinkingLevel: thinking?.thinkingLevel ?? thinking?.thinking_level });
      const response = await fetch(target, { method: req.method, headers, body: payload, signal: AbortSignal.any([signal, controller.signal]) });
      res.writeHead(response.status, { 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' });
      // writeHead alone buffers headers until the first body write. agy has a
      // separate response-header deadline; upstream SSE may start much later.
      res.flushHeaders();
      await trace('headers', { status: response.status,
        upstreamRequestId: response.headers.get('x-request-id') || response.headers.get('request-id') || undefined });
      if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
        let pending = ''; const decoder = new TextDecoder();
        let first = true;
        const emit = (line: string) => {
          if (line.startsWith('data:') && line.slice(5).trim() !== '[DONE]') line = 'data: ' + JSON.stringify(rewriteGenaiTools(JSON.parse(line.slice(5)), tools));
          res.write(line + '\n');
        };
        for await (const chunk of response.body!) {
          if (first) { first = false; await trace('first_body'); }
          pending += decoder.decode(chunk, { stream: true }); let index;
          while ((index = pending.indexOf('\n')) >= 0) { emit(pending.slice(0, index)); pending = pending.slice(index + 1); }
        }
        pending += decoder.decode(); if (pending) emit(pending);
      } else {
        const text = await response.text();
        await trace('first_body');
        res.write(response.ok ? JSON.stringify(rewriteGenaiTools(JSON.parse(text), tools)) : text);
      }
      res.end();
      await trace('completed', { status: response.status });
    } catch (error) {
      if (!res.headersSent) { res.writeHead(visualErrorStatus(error), { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: String(error).replaceAll(env.AGY_LLM_GATEWAY_API_KEY || '\0', '[redacted]') } })); }
      else res.destroy();
      await trace('failed', { aborted: signal.aborted || controller.signal.aborted,
        errorName: error instanceof Error ? error.name : 'Error' });
    } finally { controllers.delete(controller); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    async close() { for (const controller of controllers) controller.abort(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); } };
}
