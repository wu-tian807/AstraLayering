import { Codex, type CodexOptions, type Usage, type UserInput } from '@openai/codex-sdk';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentLog } from './agent-log.ts';
import { AgentCallError, AgentRuntime, continuationPrompt, retryableAgentError } from './agent-runtime.ts';
import { createFunctionToolSession } from './tool-agent.ts';
import type { FunctionTool } from './function-tools.ts';

export const agentDefaults = { model: 'gpt-6.1-sol', effort: 'xhigh' } as const;

export type AgentTask = {
  name: string;
  prompt: string;
  images?: { path: string; description: string }[];
  imageGeneration?: boolean;
  outputSchema?: Record<string, unknown>;
  timeoutMs?: number;
  cwd?: string;
  tools?: FunctionTool[];
  sandboxMode?: 'read-only' | 'workspace-write';
};

export type GeneratedImage = { savedPath: string };
export type AgentResult = {
  text: string; images: GeneratedImage[]; threadId?: string | null; logDirectory?: string;
};
export type AgentSession = {
  run(task: AgentTask, signal?: AbortSignal): Promise<AgentResult>;
  close(): Promise<void>;
};
export type AgentOptions = CodexOptions & {
  cwd?: string;
  progress?: (message: string) => void;
  logDirectory?: string;
  agentConcurrency?: number;
  runtime?: AgentRuntime;
};

export class CodexAgents {
  private options: AgentOptions;
  private runtime: AgentRuntime;

  constructor(options: AgentOptions = {}) {
    this.options = options;
    this.runtime = options.runtime ?? new AgentRuntime(options.agentConcurrency);
  }

  private async invoke<T>(task: AgentTask, signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    return this.runtime.run(operation, { signal, onRetry: async ({ attempt, nextAttempt, delayMs, error }) => {
      const failure = error as AgentCallError;
      this.options.progress?.(`[${task.name}] 临时服务错误；${delayMs / 1000} 秒后第 ${nextAttempt} 次尝试，沿用会话与已有产物：${failure.message}`);
      if (failure.logDirectory) await AgentLog.retry(failure.logDirectory,
        { attempt, nextAttempt, delayMs, error: failure.message });
    } });
  }

  // 延续原生 function tools 会话；每次 run 是同一 thread 的一个新 turn。
  createSession(): AgentSession {
    let session = createFunctionToolSession(this.options);
    const closing = new AbortController();
    let closed = false, busy = false;
    return {
      run: async (task, externalSignal) => {
        if (closed) throw new Error('会话已关闭');
        if (busy) throw new Error('同一会话不能并发运行');
        busy = true;
        const signal = taskSignal(task, [closing.signal, ...(externalSignal ? [externalSignal] : [])]);
        let interrupted = false;
        const savedImages = new Set<string>();
        try {
          return await this.invoke(task, signal, async () => {
            try {
              const result = await session.run(interrupted ? { ...task,
                prompt: continuationPrompt([...savedImages]), images: undefined } : task, signal);
              for (const image of result.images) savedImages.add(image.savedPath);
              return { ...result, images: [...savedImages].map(savedPath => ({ savedPath })) };
            } catch (error) {
              if (retryableAgentError(error) && !signal.aborted) {
                const failure = error as AgentCallError;
                for (const path of failure.savedImagePaths) savedImages.add(path);
                interrupted = !!failure.threadId;
                if (failure.sessionBroken) {
                  await session.close();
                  session = createFunctionToolSession(this.options, failure.threadId);
                }
              }
              throw error;
            }
          });
        } finally { busy = false; }
      },
      close: async () => {
        closed = true;
        closing.abort(new Error('会话已结束'));
        await session.close();
      },
    };
  }

  async run(task: AgentTask): Promise<AgentResult> {
    if (task.tools?.length) {
      const session = this.createSession();
      try { return await session.run(task); }
      finally { await session.close(); }
    }
    const { cwd, progress, logDirectory, config, agentConcurrency: _concurrency, runtime: _runtime, ...options } = this.options;
    const workingDirectory = resolve(task.cwd ?? cwd ?? fileURLToPath(new URL('.', import.meta.url)));
    const codex = new Codex({
      ...options,
      config: {
        ...config,
        features: {
          image_generation: task.imageGeneration ?? false,
          shell_tool: false, unified_exec: false, multi_agent: false, memories: false,
        },
      },
    });
    const threadOptions = {
      model: agentDefaults.model, modelReasoningEffort: agentDefaults.effort,
      workingDirectory,
      sandboxMode: task.sandboxMode ?? 'read-only', approvalPolicy: 'never', webSearchMode: 'disabled',
    } as const;
    const thread = codex.startThread(threadOptions);
    const signal = taskSignal(task);
    const savedImages = new Set<string>();
    let interrupted = false;
    return this.invoke(task, signal, async () => {
      const attemptTask = interrupted && thread.id ? { ...task,
        prompt: continuationPrompt([...savedImages]), images: undefined } : task;
      try { return await runSdkAttempt(attemptTask); }
      catch (error) {
        if (error instanceof AgentCallError) {
          interrupted = true;
          for (const path of error.savedImagePaths) savedImages.add(path);
        }
        throw error;
      }
    });

    async function runSdkAttempt(task: AgentTask): Promise<AgentResult> {
      const input: UserInput[] = [{ type: 'text', text: task.prompt }];
      for (const image of task.images ?? []) {
        input.push({ type: 'text', text: image.description });
        input.push({ type: 'local_image', path: resolve(image.path) });
      }
      const timeoutMs = task.timeoutMs;
      const log = await AgentLog.create(resolve(logDirectory ?? join(workingDirectory, '.run/agents')), task.name, {
        task: { ...task, timeoutMs: timeoutMs ?? null }, input,
        // Persist the exact prompt sent by the SDK, without credentials or environment variables.
        prompt: input.filter(item => item.type === 'text').map(item => item.text).join('\n\n'),
        threadOptions, sessionThreadId: thread.id,
      });
      progress?.(`开始：${task.name}；记录：${log.directory}`);
      let finalResponse = '';
      let usage: Usage | null = null;
      let completed = false;
      let lastError: string | undefined;
      try {
        const { events } = await thread.runStreamed(input, {
          outputSchema: task.outputSchema,
          signal,
        });
        for await (const event of events) {
          const description = await log.record(event);
          if (description) progress?.(`[${task.name}] ${description}`);
          if (event.type === 'item.completed' && event.item.type === 'agent_message') {
            finalResponse = event.item.text;
          } else if (event.type === 'item.completed') {
            const item = event.item as unknown as Record<string, unknown>;
            if (['image_generation', 'imageGeneration'].includes(String(item.type)) && typeof item.savedPath === 'string') {
              savedImages.add(resolve(workingDirectory, item.savedPath));
            }
          } else if (event.type === 'turn.completed') {
            completed = true;
            usage = event.usage;
          } else if (event.type === 'turn.failed') {
            throw new AgentCallError(event.error.message);
          } else if (event.type === 'error') {
            // CLI 的内置重连也会发出 error。等待终态，不能提前切断它的重试。
            lastError = event.message;
          }
        }
        if (!completed) throw lastError ? new AgentCallError(lastError) : new Error(`${task.name} 的事件流结束，但未收到 turn.completed`);
        const images: GeneratedImage[] = [];
        if (task.imageGeneration) {
          const output = JSON.parse(finalResponse) as { savedPath?: unknown; error?: unknown };
          if (typeof output.error === 'string' && output.error) throw new Error(`${task.name}：${output.error}`);
          if (typeof output.savedPath !== 'string' || !output.savedPath.trim()) {
            throw new Error(`${task.name} 没有返回生成图片的 savedPath`);
          }
          images.push({ savedPath: resolve(workingDirectory, output.savedPath) });
        }
        for (const image of images) savedImages.add(image.savedPath);
        await log.finish({ status: 'completed', threadId: thread.id, usage, finalResponse, images });
        progress?.(`agent 回合结束：${task.name}`);
        return { text: finalResponse, images: [...savedImages].map(savedPath => ({ savedPath })), threadId: thread.id, logDirectory: log.directory };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await log.finish({ status: 'failed', threadId: thread.id, usage, finalResponse, error: message,
          images: [...savedImages].map(savedPath => ({ savedPath })) });
        progress?.(`失败：${task.name}；${message}；记录：${log.directory}`);
        const reported = error instanceof AgentCallError ? error : new AgentCallError(message,
          completed || signal.aborted ? 'localError' : undefined, { cause: error });
        reported.logDirectory = log.directory;
        reported.threadId = thread.id ?? undefined;
        reported.savedImagePaths = [...savedImages];
        throw reported;
      }
    }
  }
}

function taskSignal(task: AgentTask, signals: AbortSignal[] = []): AbortSignal {
  return AbortSignal.any([...signals, ...(task.timeoutMs === undefined ? [] : [AbortSignal.timeout(task.timeoutMs)])]);
}
