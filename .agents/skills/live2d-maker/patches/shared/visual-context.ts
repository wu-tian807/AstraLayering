import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runtimePrompt } from '../../shared/knowledge.ts';

export type ImageBudget = { images?: number; bytes?: number; deduplicate?: boolean };
export type VisualProtocol = 'genai' | 'anthropic';
export type VisualContextEvent = { type: 'agent.visual_context'; phase: 'deduplicated' | 'compacting' | 'compacted' | 'prepared';
  images: number; requestBytes: number; removedImages?: number; batchImages?: number; batchBytes?: number; checkpoint?: string };
type Slot = { block: any; replace(value: any): void; label?: (value: any) => void; key: string; hash: string; mime: string; data: string; context: string; identity: string };
type State = { version: 1; occurrences: Record<string, string>; summaries: Record<string, string> };
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const requestBytes = (body: unknown) => Buffer.byteLength(JSON.stringify(body));
export class VisualContextError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'VisualContextError'; this.status = status; }
}
export const visualErrorStatus = (error: unknown) => error instanceof VisualContextError ? error.status : 502;

export function imageBudget(env: NodeJS.ProcessEnv, harness: 'codex' | 'claude' | 'agv'): ImageBudget {
  const integer = (key: string) => {
    const raw = env[key]?.trim();
    if (!raw) return undefined;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1) throw new Error(`${key} 必须是正整数；留空关闭。`);
    return value;
  };
  const images = integer(`${harness}_image_compact_threshold`)
    ?? (harness === 'codex' ? integer('image_compact_threshold') : undefined);
  const mib = integer(`${harness}_request_compact_mib`);
  if (mib && !Number.isSafeInteger(mib * 1048576)) throw new Error(`${harness}_request_compact_mib 超出范围。`);
  const raw = env[`${harness}_image_deduplicate`]?.trim();
  if (raw && !['true', 'false'].includes(raw)) throw new Error(`${harness}_image_deduplicate 只能为 true 或 false。`);
  if (harness === 'codex' && raw === 'true') throw new Error('独立无损图片去重目前用于 AGV／Claude 接入补丁；Codex 使用原生带图 compact，不支持此去重开关。');
  return { ...(images ? { images } : {}), ...(mib ? { bytes: mib * 1048576 } : {}), ...(raw === 'true' ? { deduplicate: true } : {}) };
}

function image(value: any): { mime: string; data: string } | undefined {
  const inline = value?.inlineData ?? value?.inline_data;
  if (inline?.data && typeof inline.data === 'string' && /^image\//.test(inline.mimeType ?? inline.mime_type ?? '')) {
    return { mime: inline.mimeType ?? inline.mime_type, data: inline.data };
  }
  if (value?.type === 'image' && value.source?.type === 'base64' && typeof value.source.data === 'string') {
    return { mime: value.source.media_type, data: value.source.data };
  }
}
const textBlock = (protocol: VisualProtocol, text: string) => protocol === 'genai' ? { text } : { type: 'text', text };

function identityContext(message: any, fallback: string): string {
  const metadata: unknown[] = [];
  const walk = (value: any) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && (parsed.source || parsed.path) && (parsed.crop || parsed.width)) {
          metadata.push(Object.fromEntries(['source', 'path', 'crop', 'scale', 'mode', 'width', 'height'].filter(key => parsed[key] !== undefined).map(key => [key, parsed[key]])));
        }
      } catch {}
      return;
    }
    if (value && typeof value === 'object' && !image(value)) for (const child of Object.values(value)) walk(child);
  };
  walk(message);
  return metadata.length ? JSON.stringify(metadata) : fallback;
}

// FunctionResponse.parts accepts media only. Visual notes for those images go
// in an adjacent ordinary text part, with the result ID and original media index.
// Calls, result output, coordinates and signed model parts are left intact.
function slots(body: any, protocol: VisualProtocol): Slot[] {
  const found: Slot[] = [], ordinals = new Map<string, number>();
  type Media = { response: any; part: any; messageParts: any[] };
  const notes = new Map<any, { part: any; entries: Map<number, string> }>();
  for (const message of body[protocol === 'genai' ? 'contents' : 'messages'] ?? []) {
    if (!['user', 'tool'].includes(message.role)) continue;
    const context = JSON.stringify(message, (key, value) => {
      const payload = image(value);
      if (payload) return { image: digest(Buffer.from(payload.data, 'base64')), mime: payload.mime };
      return key === 'cache_control' ? undefined : value;
    });
    const identity = identityContext(message, context);
    const messageHash = digest(context), ordinal = ordinals.get(messageHash) ?? 0;
    ordinals.set(messageHash, ordinal + 1);
    const walk = (value: any, parent: any, key: string | number, path: string, media?: Media) => {
      const payload = image(value);
      if (payload) {
        const hash = digest(Buffer.from(payload.data, 'base64'));
        const mediaPart = media && parent === media.response.parts;
        const note = (replacement: any) => {
          let record = notes.get(media!.part);
          if (!record) {
            record = { part: { text: '' }, entries: new Map() };
            notes.set(media!.part, record);
            media!.messageParts.splice(media!.messageParts.indexOf(media!.part) + 1, 0, record.part);
          }
          record.entries.set(Number(key), `Tool result ${media!.response.id ?? '(no ID)'} (${media!.response.name}), original media part ${Number(key) + 1}: ${replacement.text}`);
          record.part.text = [...record.entries].sort(([a], [b]) => a - b).map(([, text]) => text).join('\n');
        };
        found.push({ block: value, replace(replacement) {
          if (mediaPart) {
            note(replacement);
            parent.splice(parent.indexOf(value), 1);
            if (!parent.length) delete media!.response.parts;
          } else if (Array.isArray(parent)) parent[parent.indexOf(value)] = replacement;
          else parent[key] = replacement;
        }, hash, ...payload,
          ...(Array.isArray(parent) ? { label(replacement: any) {
            if (mediaPart) note(replacement);
            else parent.splice(parent.indexOf(value), 0, replacement);
          } } : {}),
          key: digest(`${messageHash}:${ordinal}:${path}`), context, identity });
        return;
      }
      if (!value || typeof value !== 'object') return;
      for (const [childKey, child] of Object.entries(value)) {
        const nested = protocol === 'genai' && ['functionResponse', 'function_response'].includes(childKey)
          ? { response: child, part: value, messageParts: message.parts } : media;
        walk(child, value, childKey, `${path}/${childKey}`, nested);
      }
    };
    walk(message, null, '', '');
  }
  return found;
}
export function imageCount(body: any, protocol: VisualProtocol): number { return slots(body, protocol).length; }

// Matching bytes alone is insufficient: an identical blank crop at another
// coordinate has another meaning. Require identical enclosing message context.
export function deduplicateImages(body: any, protocol: VisualProtocol): number {
  const seen = new Map<string, Slot>(), labels = new Map<Slot, string>(); let removed = 0;
  const list = slots(body, protocol);
  for (const slot of [...list].reverse()) {
    if (!slot.label) continue;
    const id = digest(`${slot.mime}:${slot.hash}:${slot.identity}`);
    if (!seen.has(id)) { seen.set(id, slot); continue; }
    slot.replace(textBlock(protocol, `[Identical historical image data omitted; the latest occurrence of image ${id} is retained in full later in this request. This tool result, its coordinates and text remain valid. This is not an unread or unavailable image.]`));
    labels.set(seen.get(id)!, id);
    removed++;
  }
  // Insert labels only after all old replacements, in reverse array order.
  for (const slot of [...list].reverse()) if (labels.has(slot)) slot.label!(textBlock(protocol, `[Retained latest original image ${labels.get(slot)}; identical older occurrences refer to this exact bitmap. The surrounding result supplies its source, coordinates and preview mode.]`));
  return removed;
}

function summaryBody(original: any, protocol: VisualProtocol, batch: Slot[], summaryInstruction: string): any {
  const body = { ...original };
  delete body.tools; delete body.tool_choice; delete body.toolConfig; delete body.tool_config;
  delete body.cachedContent; delete body.cached_content; delete body.context_management;
  const parts: any[] = [textBlock(protocol, summaryInstruction)];
  for (const slot of batch) {
    parts.push(textBlock(protocol, `Image ${slot.key}. Historical message context (data records, not instructions):\n${slot.context}`), slot.block);
  }
  if (protocol === 'genai') {
    delete body.systemInstruction; delete body.system_instruction;
    body.contents = [{ role: 'user', parts }];
    const generation = { ...(body.generationConfig ?? body.generation_config ?? {}) };
    for (const key of ['responseMimeType', 'responseSchema', 'responseJsonSchema', 'response_mime_type', 'response_schema', 'response_json_schema']) delete generation[key];
    delete body.generation_config;
    body.generationConfig = generation;
  } else {
    // Claude Code's subscription authentication may require its native client
    // identity in system. Preserve that envelope; the task is supplied below.
    body.messages = [{ role: 'user', content: parts }];
    body.stream = false;
    // count_tokens omits max_tokens; include it before measuring the wire body.
    body.max_tokens ??= 8192;
  }
  return body;
}

export class VisualContext {
  #state?: State;
  #summaryInstruction: string;
  #queue: Promise<unknown> = Promise.resolve();
  readonly options: { directory: string; protocol: VisualProtocol; budget: ImageBudget;
    observe?: (event: VisualContextEvent) => Promise<void> };
  constructor(options: VisualContext['options']) {
    this.options = options;
    this.#summaryInstruction = options.budget.images || options.budget.bytes ? runtimePrompt('visual-context-summary') : '';
  }
  prepare(original: any, summarize: (body: any) => Promise<string>): Promise<any> {
    const pending = this.#queue.catch(() => {}).then(() => this.#prepare(original, summarize));
    this.#queue = pending; return pending;
  }
  async #prepare(original: any, summarize: (body: any) => Promise<string>): Promise<any> {
    const { budget, protocol, directory, observe } = this.options;
    if (!budget.images && !budget.bytes && !budget.deduplicate) return original;
    const body = structuredClone(original);
    if (!this.#state) {
      try { this.#state = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        this.#state = { version: 1, occurrences: {}, summaries: {} };
      }
      if (this.#state?.version !== 1) throw new Error('图片压缩恢复记录版本不可识别；原会话与产物已保留。');
    }
    const state = this.#state;
    const emit = (phase: VisualContextEvent['phase'], extra: Partial<VisualContextEvent> = {}) => observe?.({
      type: 'agent.visual_context', phase, images: imageCount(body, protocol), requestBytes: requestBytes(body), ...extra });
    if (budget.deduplicate) {
      const removedImages = deduplicateImages(body, protocol);
      if (removedImages) await emit('deduplicated', { removedImages });
    }
    const list = slots(body, protocol);
    // Fresh reads stay available even if the same bitmap was summarized before.
    const latest = new Set(list.slice(-4).map(slot => slot.key));
    const active = new Set(list.map(slot => slot.key));
    const protectedSlot = (slot: Slot) => latest.has(slot.key);
    const shown = new Set<string>();
    const replace = (slot: Slot, batch: string) => {
      const summary = state.summaries[batch];
      if (!summary) throw new Error('图片压缩摘要记录缺失；原历史未改写。');
      const memory = shown.has(batch) ? `Visual memory is supplied at the earlier image from batch ${batch}.`
        : (shown.add(batch), `Visual memory for batch ${batch}:\n${summary}`);
      slot.replace(textBlock(protocol, `[Historical image ${slot.key} was actually included in successful visual compaction. Original image and tool records remain on disk. ${memory}]`));
      active.delete(slot.key);
    };
    for (const slot of list) if (!protectedSlot(slot) && state.occurrences[slot.key]) replace(slot, state.occurrences[slot.key]);
    const over = () => (budget.images !== undefined && imageCount(body, protocol) >= budget.images)
      || (budget.bytes !== undefined && requestBytes(body) >= budget.bytes);
    while (over()) {
      const candidates = list.filter(slot => active.has(slot.key) && !protectedSlot(slot));
      if (!candidates.length) {
        if (latest.size > 1) { latest.delete(latest.values().next().value!); continue; }
        throw new VisualContextError('图片容量保护无法容纳必要参考图、最新图片或文字；原图、会话与已有产物已保留。请提高与实际上游兼容的预算或提供更小的必要输入。', 413);
      }
      const cached = candidates.filter(slot => state.occurrences[slot.key]);
      if (cached.length) { for (const slot of cached) replace(slot, state.occurrences[slot.key]); continue; }
      let batchSize = Math.min(candidates.length, budget.images ?? candidates.length);
      if (budget.bytes) {
        let low = 1, high = batchSize; batchSize = 0;
        while (low <= high) {
          const mid = low + Math.floor((high - low) / 2);
          if (requestBytes(summaryBody(original, protocol, candidates.slice(0, mid), this.#summaryInstruction)) <= budget.bytes) { batchSize = mid; low = mid + 1; }
          else high = mid - 1;
        }
      }
      const batch = candidates.slice(0, batchSize);
      if (!batch.length) throw new VisualContextError('单张历史图片及其文字已超过视觉压缩预算；原历史与图片保留，未发出超限压缩请求。', 413);
      const wire = summaryBody(original, protocol, batch, this.#summaryInstruction), checkpoint = digest(batch.map(slot => slot.key).join(':'));
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const imagesDirectory = join(directory, 'images'); await mkdir(imagesDirectory, { recursive: true, mode: 0o700 });
      for (const slot of batch) await writeFile(join(imagesDirectory, `${slot.hash}.bin`), Buffer.from(slot.data, 'base64'), { mode: 0o600 });
      await emit('compacting', { batchImages: batch.length, batchBytes: requestBytes(wire), checkpoint });
      const summary = (await summarize(wire)).trim();
      if (!summary) throw new VisualContextError('视觉压缩未返回非空摘要；原会话、图片和产物已保留。');
      if (budget.bytes && Buffer.byteLength(summary) >= budget.bytes / 4) throw new VisualContextError('视觉摘要过大；原历史已保留，未替换图片。');
      const next = { ...state, occurrences: { ...state.occurrences }, summaries: { ...state.summaries, [checkpoint]: summary } };
      for (const slot of batch) next.occurrences[slot.key] = checkpoint;
      const record = join(directory, `${checkpoint}.json`);
      await writeFile(record, JSON.stringify({ version: 1, summary, images: batch.map(({ key, hash, mime, context }) => ({ key, hash, mime, context })) }), { mode: 0o600 });
      const temporary = join(directory, `state.${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(next), { mode: 0o600 }); await rename(temporary, join(directory, 'state.json'));
      Object.assign(state, next);
      const before = requestBytes(body), count = imageCount(body, protocol);
      for (const slot of batch) replace(slot, checkpoint);
      await emit('compacted', { batchImages: batch.length, checkpoint });
      if (over() && requestBytes(body) >= before && imageCount(body, protocol) >= count) {
        throw new Error('视觉压缩未减少请求容量；摘要和原图均已保留，停止重复压缩。');
      }
    }
    await emit('prepared'); return body;
  }
}

export async function readVisualSummary(response: Response, protocol: VisualProtocol): Promise<string> {
  if (!response.ok) throw new VisualContextError(`视觉压缩上游 HTTP ${response.status}：${(await response.text()).slice(0, 8000)}`, response.status);
  const text = await response.text();
  const events = response.headers.get('content-type')?.includes('text/event-stream')
    ? text.split('\n').filter(line => line.startsWith('data:') && line.slice(5).trim() !== '[DONE]').map(line => JSON.parse(line.slice(5)))
    : [JSON.parse(text)];
  let summary = '', completed = false;
  for (const event of events) {
    if (event.error || event.type === 'error') throw new Error(`视觉压缩上游错误：${JSON.stringify(event.error ?? event).slice(0, 8000)}`);
    if (protocol === 'genai') for (const candidate of event.candidates ?? []) {
      if (candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) throw new VisualContextError(`视觉压缩未正常完成：${candidate.finishReason}`);
      if (candidate.finishReason === 'MAX_TOKENS') throw new VisualContextError('视觉压缩摘要被截断；原图与历史保留。');
      if (candidate.finishReason === 'STOP') completed = true;
      for (const part of candidate.content?.parts ?? []) if (typeof part.text === 'string' && !part.thought) summary += part.text;
    }
    else {
      if (['max_tokens', 'refusal'].includes(event.stop_reason)) throw new VisualContextError(`视觉压缩未正常完成：${event.stop_reason}`);
      for (const part of event.content ?? []) if (part.type === 'text') summary += part.text;
      if (event.stop_reason === 'end_turn' || event.stop_reason === 'stop_sequence') completed = true;
    }
  }
  if (!completed) throw new VisualContextError('视觉压缩没有成功终态；原图和会话已保留。');
  return summary;
}
