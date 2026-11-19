import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import type { CodexOptions } from '@openai/codex-sdk';
import { checkCodexCapabilities, type WorkflowEnvironment } from '../codex/environment.ts';
import { generateImage, validateImageSelection, type ImageArguments, type ImageInput } from './images.ts';
import { imageProvider, type AgentStep } from './models.ts';
import type { ImageProcessingOptions } from '../image-processing.ts';
import { agentImageGeneration } from '../agent-knowledge.ts';

export function usesPatchedImageTool(settings: WorkflowEnvironment, step?: AgentStep): boolean {
  return !!step && agentImageGeneration(step) && settings.stepModels[step].harness === 'codex'
    && !!settings.stepImages[step] && settings.stepImages[step] !== 'codex-native';
}

// One route per Codex process. Its model and credentials never enter prompts or global config.
// The original extension still owns tool execution, image events and saving the final PNG.
export async function createCodexImageRoute(settings: WorkflowEnvironment, step: AgentStep,
  outputDirectory: string, options: CodexOptions = settings.codex, signal?: AbortSignal, normalization: ImageProcessingOptions = {}) {
  signal?.throwIfAborted();
  validateImageSelection(settings, step);
  if (!usesPatchedImageTool(settings, step)) throw new Error(`${step} 不使用自定义 Codex 生图补丁。`);
  await checkCodexCapabilities(settings, options, { image: true });
  const model = settings.stepImages[step]!;
  const api = settings.imageApis[imageProvider(model,settings.imageRules) as 'openai' | 'google']!;
  const processing = { ...normalization, env: normalization.env ?? options.env, directory: outputDirectory };
  const token = randomBytes(32).toString('hex');
  const closing = new AbortController();
  const server = createServer(async (request, response) => {
    const abort = new AbortController();
    const signal = AbortSignal.any([closing.signal, abort.signal]);
    response.once('close', () => { if (!response.writableEnded) abort.abort(); });
    try {
      if (request.headers.authorization !== `Bearer ${token}`) { response.writeHead(401).end(); return; }
      if (request.method !== 'POST' || !['/v1/images/generations', '/v1/images/edits'].includes(request.url || '')) {
        response.writeHead(404).end(); return;
      }
      const chunks: Buffer[] = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 192 * 1024 * 1024) throw new Error('原生生图请求超过 192 MiB。');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks), inputs: ImageInput[] = [];
      let args: Record<string, unknown>;
      if (request.url!.endsWith('/edits')) {
        const form = await new Request('http://localhost', { method: 'POST',
          headers: { 'content-type': request.headers['content-type'] || '' }, body: new Uint8Array(bytes) }).formData();
        args = {};
        for (const [key, value] of form) {
          if (key === 'image' || key === 'image[]') {
            if (typeof value === 'string') throw new Error('编辑参考图必须是文件。');
            inputs.push({ bytes: Buffer.from(await value.arrayBuffer()), mime: value.type || 'image/png' });
          } else args[key] = value;
        }
        if (!inputs.length || inputs.length > 5) throw new Error('原生编辑需要 1–5 张参考图。');
      } else args = JSON.parse(bytes.toString());
      if (!args || typeof args.prompt !== 'string' || !args.prompt.trim() || args.model !== model
        || args.background !== undefined && !['transparent', 'auto', 'opaque'].includes(String(args.background))
        || args.size !== undefined && typeof args.size !== 'string'
        || args.n !== undefined && Number(args.n) !== 1) throw new Error('原生生图请求的模型或参数不符合本步骤配置。');
      const png = await generateImage(api, model, step === 'shadow_maps' ? { ...args, background: 'opaque' } as ImageArguments : args as ImageArguments, inputs, signal, processing);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ created: Math.floor(Date.now() / 1000), data: [{ b64_json: png.toString('base64') }] }));
    } catch (error) {
      if (response.destroyed) return;
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: String(error).replaceAll(api.apiKey, '[redacted]').replaceAll(token, '[redacted]') } }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const env = {
    LAYERING_IMAGE_BASE_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
    LAYERING_IMAGE_API_KEY: token, LAYERING_IMAGE_MODEL: model,
    LAYERING_IMAGE_OUTPUT_DIR: resolve(outputDirectory),
  };
  let closed = false;
  const close = async () => {
    if (closed) return;
    signal?.removeEventListener('abort', cancel);
    closed = true; closing.abort(new Error('Codex 生图通道已关闭'));
    const done = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections(); await done;
  };
  const cancel = () => { void close(); };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) { await close(); signal.throwIfAborted(); }
  return { env, close };
}
