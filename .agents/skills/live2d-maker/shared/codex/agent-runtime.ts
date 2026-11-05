import { runtimePrompt } from '../knowledge.ts';
import { setTimeout as delay } from 'node:timers/promises';

export const defaultAgentConcurrency = 3;
// Retry n waits about initial * 2^(n-1), at most maximum: 5, 10, 20, 40, 80, then 120 s; after the tenth the call fails.
// retries also caps the new sessions one call starts for known errors.
export const retryDelays = { initial: 5_000, maximum: 120_000, retries: 10 } as const;

export class AgentCallError extends Error {
  readonly info?: unknown;
  details?: unknown;
  logDirectory?: string;
  threadId?: string;
  threadPath?: string;
  finalResponse?: string;
  // Work the failed attempt got done (tool calls), counted by the harness; 0 when it did none.
  progress = 0;
  savedImagePaths: string[] = [];
  sessionBroken = false;
  constructor(message: string, info?: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentCallError';
    this.info = info;
  }
}

const imageBlocked = /image (?:processing |input )?blocked|blocked due to content policy|content[\s_-]*policy[\s_-]*violation/i;
// 内容策略拦截图片：重连只会重发同一张图，要换掉历史里的图片再继续。
export function blockedAgentError(error: unknown): boolean {
  const seen = new Set<unknown>();
  for (let current = error; current instanceof Error && !seen.has(current); current = current.cause) {
    seen.add(current);
    if (imageBlocked.test(current.message)) return true;
  }
  return false;
}

// Structured codes that no reconnect fixes: quota, auth, a bad request, policy or a local sandbox failure.
const fatalCodes = new Set(['usageLimitExceeded', 'sessionBudgetExceeded', 'unauthorized', 'badRequest', 'invalidPrompt', 'cyberPolicy',
  'bioPolicy', 'misalignmentPolicyViolation', 'tooManyDenials', 'sandboxError', 'threadRollbackFailed', 'activeTurnNotSteerable']);
// Codex files most local and invalid-request failures (spawn, tool collision, bad image, IO) under "other" too; only
// its stream and timeout failures there are the channel's, and they keep Codex's fixed texts.
const otherChannelText = /stream disconnected|request timed out|timed? ?out|connection (?:reset|closed|refused|error)/i;
// Claude result subtypes for limits this call set itself (turns, budget, structured output retries).
const fatalCliSubtype = /^error_max_/;
// Gemini throttles with "Resource has been exhausted (e.g. check quota)" or a per-minute "Quota exceeded … retry in";
// only a used-up quota is fatal.
const fatalText = /exceeded your (?:current )?quota|insufficient[\s_-]*quota|quota (?:has been |is )?(?:exceeded|exhausted)(?![\s\S]*(?:retry in|per[\s_-]?minute))|usage limit|credits|billing|spend limit|unauthori[sz]ed|authentication|api[\s_-]*key|not logged in|\/login|invalid.*(?:request|input)/i;

const errorCode = (info: unknown) => typeof info === 'string' ? info : info && typeof info === 'object' ? Object.keys(info)[0] : undefined;
const httpStatus = (info: unknown, code: string) => info && typeof info === 'object' ? (info as Record<string, any>)[code]?.httpStatusCode : undefined;

const unavailableSessionText = /(?:thread|session|conversation).{0,80}(?:not found|does not exist|unavailable|invalid|不存在|不可用)|no (?:conversation|session|rollout) found|rollout path.{0,40}not found/i;
// Gemini reports "The input token count (N) exceeds the maximum number of tokens allowed (M)".
const contextWindowText = /context.{0,30}(?:length|window)|prompt is too long|maximum context|input token count.{0,40}exceeds|exceeds the maximum number of tokens/i;
const payloadTooLarge = /(?:request|payload|entity).{0,20}too large/i;
// A per-request image count limit; "N images per minute" is throttling and waits instead.
function imageCountLimit(message: string): boolean {
  const count = /too many (?:input )?images|(?:maximum|max|limit).{0,30}\b\d+\b.{0,12}images|\bimages?\b.{0,20}(?:limit|maximum)/i.test(message);
  const throughput = /\brate[\s_-]*limit\b|\bper\s+(?:second|minute|hour|day)\b/i.test(message);
  return count && (!throughput || /\bper\s+request\b/i.test(message));
}

// Known errors with a remedy: the caller fixes the session and calls again at once, without waiting.
// blockedImages swaps blocked images for text; the others start a new session from the recovery prompt.
// A model refusal can come from anything in the history, its own reasoning included, so it gets a new session too.
export type RecoverableAgentError = 'blockedImages' | 'modelRefusal' | 'unavailableSession' | 'contextWindow' | 'imageOverflow' | 'sessionProtocol';
export function recoverableAgentError(error: unknown): RecoverableAgentError | undefined {
  if (blockedAgentError(error)) return 'blockedImages';
  if (error instanceof AgentCallError && errorCode(error.info) === 'refusal') return 'modelRefusal';
  if (unavailableSessionText.test(String(error instanceof Error ? error.message : error))) return 'unavailableSession';
  if (!(error instanceof AgentCallError)) return undefined;
  const code = errorCode(error.info);
  if (code === 'sessionProtocol') return 'sessionProtocol';
  if (code === 'contextWindowExceeded' || contextWindowText.test(error.message)) return 'contextWindow';
  if ((code && httpStatus(error.info, code) === 413) || imageCountLimit(error.message) || payloadTooLarge.test(error.message)) return 'imageOverflow';
  return undefined;
}

// Unknown channel failures wait and retry. Local errors (no channel code) and known errors without a remedy fail at once;
// known errors with a remedy are left to recoverableAgentError.
export function retryableAgentError(error: unknown): boolean {
  if (!(error instanceof AgentCallError) || recoverableAgentError(error)) return false;
  const info = error.info;
  const code = errorCode(info);
  if (!code || code === 'localError' || fatalCodes.has(code)) return false;
  if (code === 'other' && !otherChannelText.test(error.message)) return false;
  if (code === 'cliFailed' && fatalCliSubtype.test((info as { cliFailed: { subtype?: string } }).cliFailed?.subtype ?? '')) return false;
  // 文本只能否决重试：结构化 429 也可能是额度耗尽，重试要等很久。
  if (fatalText.test(error.message)) return false;
  const status = httpStatus(info, code);
  // 400/401/403 等 4xx 不是重连能解决的；408、409、429、5xx 和没有 HTTP 状态的失败都重试。
  return typeof status !== 'number' || status < 400 || status > 499 || status === 408 || status === 409 || status === 429;
}

// A retryable 429: the service is throttling. Every retryable error waits the same way and the page shows
// 限流等待; this only names the reason.
export function rateLimitedAgentError(error: unknown): boolean {
  if (!(error instanceof AgentCallError)) return false;
  const code = errorCode(error.info);
  return code === 'rateLimitExceeded' || !!code && httpStatus(error.info, code) === 429;
}

export type AgentRetry = { attempt: number; nextAttempt: number; delayMs: number; error: unknown; rateLimited: boolean };
type Waiter = { start(): void; cancel(): void };

// Agent slots shared by every section process of one task. The total scheduler
// installs them in its section workers, so concurrent sections together run at
// most jobs agents; each AgentRuntime still applies its own limit first.
export type AgentSlots = (signal?: AbortSignal) => Promise<() => void>;
let sharedSlots: AgentSlots | undefined;
export function shareAgentSlots(slots: AgentSlots | undefined) { sharedSlots = slots; }

// 只管理 agent 调用与临时错误，不依赖 group、步骤、树或 progress.json。
export class AgentRuntime {
  private active = 0;
  private waiting: Waiter[] = [];
  readonly concurrency: number;
  private wait: (ms: number, signal?: AbortSignal) => Promise<void>;
  private random: () => number;
  constructor(
    concurrency = defaultAgentConcurrency,
    wait: (ms: number, signal?: AbortSignal) => Promise<void> = async (ms, signal) => { await delay(ms, undefined, { signal }); },
    // Jitter source, 0 to 1; tests pin it.
    random: () => number = Math.random,
  ) {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('agentConcurrency 必须是正整数');
    this.concurrency = concurrency;
    this.wait = wait;
    this.random = random;
  }

  private acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        start: () => {
          signal?.removeEventListener('abort', waiter.cancel);
          this.active++;
          let released = false;
          resolve(() => {
            if (released) return;
            released = true;
            this.active--;
            this.dispatch();
          });
        },
        cancel: () => {
          this.waiting = this.waiting.filter(item => item !== waiter);
          reject(signal?.reason);
        },
      };
      this.waiting.push(waiter);
      signal?.addEventListener('abort', waiter.cancel, { once: true });
      this.dispatch();
    });
  }

  private dispatch() {
    while (this.active < this.concurrency && this.waiting.length) this.waiting.shift()!.start();
  }

  async run<T>(
    operation: (attempt: number) => Promise<T>,
    options: {
      signal?: AbortSignal; onRetry?(retry: AgentRetry): Promise<void> | void;
      // Fixes a known error and returns true to call again at once; the retry budget is not used.
      recover?(error: unknown): Promise<boolean>;
    } = {},
  ): Promise<T> {
    const local = await this.acquire(options.signal);
    let shared: (() => void) | undefined;
    // Without a shared pool the operation starts in the same turn as before.
    try { if (sharedSlots) shared = await sharedSlots(options.signal); }
    catch (error) { local(); throw error; }
    // The slots stay held through backoff until the call succeeds, fails or is cancelled. Handing them back let a queued call start in the gap, so
    // under 429 the groups of one layer took turns instead of finishing one by one.
    try {
      for (let attempt = 1; ; attempt++) {
        let error: unknown;
        try {
          options.signal?.throwIfAborted();
          return await operation(attempt);
        } catch (caught) {
          options.signal?.throwIfAborted();
          if (await options.recover?.(caught)) { attempt--; continue; }
          options.signal?.throwIfAborted();
          if (!retryableAgentError(caught) || attempt > retryDelays.retries) throw caught;
          error = caught;
        }
        // Equal jitter: half the step is fixed, half random, so calls that failed together do not retry together.
        const step = Math.min(retryDelays.initial * 2 ** (attempt - 1), retryDelays.maximum);
        const delayMs = Math.round(step / 2 + this.random() * step / 2);
        await options.onRetry?.({ attempt, nextAttempt: attempt + 1, delayMs, error, rateLimited: rateLimitedAgentError(error) });
        await this.wait(delayMs, options.signal);
      }
    } finally { shared?.(); local(); }
  }
}

export const interruptedTaskPrompt = (): string => runtimePrompt('interrupted-task').trim();
