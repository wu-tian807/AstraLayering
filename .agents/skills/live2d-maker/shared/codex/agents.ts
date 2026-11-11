import { checkCodexCapabilities, defaultModels, loadWorkflowEnvironment, workflowCodexOptions, type WorkflowEnvironment } from './environment.ts';
import { toolDefinition } from './tool-config.ts';
import { workflowsDirectory } from '../paths.ts';
import type { CodexOptions } from '@openai/codex-sdk';
import { join } from 'node:path';
import { AgentLog } from './agent-log.ts';
import { AgentCallError, AgentRuntime, retryDelays, interruptedTaskPrompt, recoverableAgentError, retryableAgentError, type AgentRetry, type RecoverableAgentError } from './agent-runtime.ts';
import { blockedImagesPrompt, readBlockedImages, type BlockedImages } from './blocked-images.ts';
import { createFunctionToolSession } from './tool-agent.ts';
import type { FunctionTool } from './function-tools.ts';
import { parseAgentModel, type AgentStep, type AgentModel } from '../agents/models.ts';
import { validateProviderModel } from '../agents/providers.ts';
import { runCliTask } from '../agents/cli.ts';
import { imageGenerationTool, validateImageSelection } from '../agents/images.ts';
import { createCodexImageRoute, usesPatchedImageTool } from '../agents/codex-images.ts';
import { randomUUID } from 'node:crypto';
import type { ThreadEvent } from '@openai/codex-sdk';
import type { ImageProcessingOptions } from '../image-processing.ts';
import { executionPaths } from '../agents/workspace.ts';
import { freshPrompt } from './fresh-prompt.ts';
import { agentImageGeneration } from '../agent-knowledge.ts';

export const agentDefaults = defaultModels.medium;

export type AgentTask = {
  step?: AgentStep;
  name: string;
  prompt: string;
  recoveryPrompt?: string;
  // Original task text a follow-up turn is preceded by when its thread is new.
  resumeContext?: string;
  imageGeneration?: boolean;
  outputSchema?: Record<string, unknown>;
  timeoutMs?: number;
  cwd?: string;
  outputDirectory?: string;
  tools?: FunctionTool[];
  // Off keeps a tool-less turn to the model and its image tool.
  shell?: boolean;
  // Checked by the Codex app-server turn before it counts as completed, so a
  // rejected reply is logged as failed; returns the turn's images.
  checkResult?: (text: string, images: GeneratedImage[]) => GeneratedImage[];
};

export type GeneratedImage = { savedPath: string };
export type AgentResult = {
  text: string; images: GeneratedImage[]; threadId?: string | null; logDirectory?: string; harness?: AgentModel['harness'];
};
export type AgentSession = {
  run(task: AgentTask, signal?: AbortSignal): Promise<AgentResult>;
  close(): Promise<void>;
};
export type AgentOptions = CodexOptions & {
  imageNormalization?: ImageProcessingOptions;
  resumeHarness?: AgentModel['harness'];
  onSessionStarted?: (id: string, harness: AgentModel['harness']) => Promise<void>;
  selectedModel?: AgentModel;
  onEvent?: (event: ThreadEvent) => Promise<void>;
  onRetry?: (retry: AgentRetry) => Promise<void> | void;
  onThreadReplacement?: (oldId: string, reason: string) => Promise<void>;
  environment?: WorkflowEnvironment;
  cwd?: string;
  progress?: (message: string) => void;
  logDirectory?: string;
  agentConcurrency?: number;
  runtime?: AgentRuntime;
};

// Known errors fixed by a new session, only when there is a session to replace; see replacement for how often.
const sessionReplacements: Partial<Record<RecoverableAgentError, { reason: string; progress: string }>> = {
  modelRefusal: { reason: '模型安全过滤拒绝了本会话', progress: '模型安全过滤拒绝了本会话（常为误判）' },
  sessionProtocol: { reason: 'CLI 活动回合无法安全恢复', progress: 'CLI 活动回合恢复失败' },
  unavailableSession: { reason: '原 thread/session 不可用', progress: '原会话不可用' },
  contextWindow: { reason: '上下文超出模型窗口', progress: '上下文超出模型窗口' },
  imageOverflow: { reason: '单次请求的图片数量或体积超限', progress: '单次请求的图片数量或体积超限' },
};

export class CodexAgents {
  private options: AgentOptions;
  private runtime: AgentRuntime;

  constructor(options: AgentOptions = {}) {
    const environment = options.environment ?? loadWorkflowEnvironment(options.env);
    this.options = { ...options, ...workflowCodexOptions(environment, options), environment };
    this.runtime = options.runtime ?? new AgentRuntime(options.agentConcurrency);
  }

  private async invoke<T>(task: AgentTask, signal: AbortSignal, operation: () => Promise<T>,
    recover?: (error: unknown) => Promise<boolean>): Promise<T> {
    return this.runtime.run(operation, { signal, recover, onRetry: async ({ attempt, nextAttempt, delayMs, error, rateLimited }) => {
      const failure = error as AgentCallError;
      this.options.progress?.(`[${task.name}] 限流等待（${rateLimited ? '429' : '临时错误'}），保留并发位置；${delayMs / 1000} 秒后第 ${attempt}/${retryDelays.retries} 次重试，沿用会话与已有产物：${failure.message}`);
      if (failure.logDirectory) await AgentLog.retry(failure.logDirectory,
        { attempt, nextAttempt, delayMs, error: failure.message, rateLimited });
      await this.options.onRetry?.({ attempt, nextAttempt, delayMs, error, rateLimited });
    } });
  }

  // Starts a new session for a known error that one fixes; the old records and files stay. The session replaced must be
  // the original one or a new one that made progress (a tool call): a new session that fails its first work with the
  // same kind of error would fail the same way again, so the call fails. Called with every error of the run, it adds up
  // the progress of the current session across retries. Progress is any tool call, which an agent re-reading its inputs
  // also makes, so a call replaces at most as many sessions as it retries.
  private replacement(task: AgentTask) {
    const sinceProgress = new Set<RecoverableAgentError>();
    let progress = 0, replaced = 0;
    return async (error: unknown, oldId: string | undefined): Promise<boolean> => {
      if (error instanceof AgentCallError) progress += error.progress;
      const kind = recoverableAgentError(error), replacement = kind && sessionReplacements[kind];
      if (!replacement || !oldId) return false;
      if (progress) sinceProgress.clear();
      if (sinceProgress.has(kind) || replaced >= retryDelays.retries) return false;
      sinceProgress.add(kind); progress = 0; replaced++;
      await this.options.onThreadReplacement?.(oldId, replacement.reason);
      this.options.progress?.(`[${task.name}] ${replacement.progress}，保留旧记录与产物并新建会话。`);
      return true;
    };
  }

  // 延续原生 function tools 会话；每次 run 是同一 thread 的一个新 turn。
  private createCodexSession(selectedModel?: AgentModel, resumeThreadId?: string): AgentSession {
    const sessionOptions = { ...this.options, ...(selectedModel ? { selectedModel } : {}), onEvent: async (event: ThreadEvent) => {
      if (event.type === 'thread.started') await this.options.onSessionStarted?.(event.thread_id, 'codex');
      await this.options.onEvent?.(event);
    } };
    let session: AgentSession | undefined;
    let route: Awaited<ReturnType<typeof createCodexImageRoute>> | undefined;
    let imageModel: string | undefined;
    let transportKey: string | undefined;
    let id = resumeThreadId;
    const functionOptions = () => ({ ...sessionOptions,
      // Startup may select the cached patch after this session was constructed.
      codexPathOverride: this.options.codexPathOverride ?? this.options.environment?.codex.codexPathOverride,
      env: { ...sessionOptions.env, ...route?.env } });
    const closing = new AbortController();
    let closed = false, busy = false;
    return {
      run: async (task, externalSignal) => {
        await checkCodexCapabilities(this.options.environment!, this.options);
        if (closed) throw new Error('会话已关闭');
        if (busy) throw new Error('同一会话不能并发运行');
        busy = true;
        const signal = taskSignal(task, [closing.signal, ...(externalSignal ? [externalSignal] : [])]);
        let interrupted = false;
        const savedImages = new Set<string>();
        try {
          const nextImage = usesPatchedImageTool(this.options.environment!, task.step)
            ? this.options.environment!.stepImages[task.step!] : undefined;
          const paths = executionPaths(task, this.options.cwd ?? workflowsDirectory);
          const routeKey = nextImage ? nextImage + ':' + paths.workspace : undefined;
          const nextTransport = JSON.stringify({ paths,
            imageGeneration: task.imageGeneration ?? false, shell: task.shell ?? true,
            tools: task.tools?.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) ?? [] });
          if (routeKey !== imageModel || nextTransport !== transportKey) {
            await session?.close(); session = undefined;
            transportKey = nextTransport;
          }
          if (routeKey !== imageModel) {
            await route?.close(); route = undefined;
            if (nextImage) route = await createCodexImageRoute(this.options.environment!, task.step!,
              join(paths.workspace, 'generated'), this.options, closing.signal, this.options.imageNormalization);
            imageModel = routeKey;
          }
          session ||= createFunctionToolSession(functionOptions(), id);
          let blocked: BlockedImages | undefined, fresh = false;
          const replace = this.replacement(task);
          return await this.invoke(task, signal, async () => {
            try {
              const result = await session!.run(blocked ? { ...task, prompt: blockedImagesPrompt(blocked) }
                : interrupted ? { ...task, prompt: interruptedTaskPrompt() }
                : fresh ? { ...task, prompt: freshPrompt(task) } : task, signal);
              id = result.threadId || id;
              for (const image of result.images) savedImages.add(image.savedPath);
              return { ...result, images: [...savedImages].map(savedPath => ({ savedPath })) };
            } catch (error) {
              const failure = error as AgentCallError;
              if (retryableAgentError(error) && !signal.aborted) {
                id = failure.threadId || id;
                for (const path of failure.savedImagePaths) savedImages.add(path);
                interrupted = !!failure.threadId; blocked = undefined;
                if (failure.sessionBroken) {
                  await session!.close();
                  session = createFunctionToolSession(functionOptions(), failure.threadId);
                }
              }
              throw error;
            }
          }, async error => {
            const failure = error as AgentCallError;
            if (await replace(error, failure.threadId || id)) {
              await session!.close();
              session = createFunctionToolSession(functionOptions(), undefined);
              id = undefined; blocked = undefined; interrupted = false; fresh = true;
              return true;
            }
            if (recoverableAgentError(error) === 'blockedImages') {
              // 每次拦截都把本批图片换成文字，在新会话里引导 agent 换法读取；
              // 没有图片可换时拦截与图片无关，按致命错误结束。
              const replaced = failure.threadPath ? await readBlockedImages(failure.threadPath) : undefined;
              if (!replaced) return false;
              for (const path of failure.savedImagePaths) savedImages.add(path);
              await session!.close();
              const old = failure.threadId || id;
              if (old) await this.options.onThreadReplacement?.(old, '图片被内容策略拦截，历史图片已换成文字');
              this.options.progress?.(`[${task.name}] 图片被内容策略拦截；${replaced.origins.length} 张图片已换成文字，新会话继续。`);
              session = createFunctionToolSession(functionOptions(), undefined, replaced.items);
              id = undefined; blocked = replaced; interrupted = false;
              return true;
            }
            return false;
          });
        } finally { busy = false; }
      },
      close: async () => {
        closed = true;
        closing.abort(new Error('会话已结束'));
        try { await session?.close(); } finally { await route?.close(); }
      },
    };
  }

  createSession(resumeThreadId?: string, callbacks?: Pick<AgentOptions, 'resumeHarness' | 'onEvent' | 'onSessionStarted' | 'onThreadReplacement'>): AgentSession {
    if (callbacks) return new CodexAgents({ ...this.options, ...callbacks, runtime: this.runtime }).createSession(resumeThreadId);
    let inner: AgentSession | undefined, selection: AgentModel | undefined, id = resumeThreadId, closed = false;
    let busy = false;
    const closing = new AbortController();
    return {
      run: async (original, externalSignal) => {
        if (closed) throw new Error('会话已关闭');
        if (busy) throw new Error('同一会话不能并发运行');
        busy = true;
        try {
          // agent.json is the capability source for every harness and image
          // provider. Model selection and old caller flags cannot grant access.
          if (original.step) {
            original = { ...original, imageGeneration: agentImageGeneration(original.step) };
          }
          const settings = this.options.environment!;
          const selected = this.options.selectedModel || (original.step ? settings.stepModels[original.step]
            : parseAgentModel(`${settings.models.medium.model}-${settings.models.medium.effort}`, '默认模型'));
          validateProviderModel(settings.providers, selected, original.step ?? original.name);
          if (original.step) validateImageSelection(settings, original.step);
          if ((selection?.harness || this.options.resumeHarness) && (selection?.harness || this.options.resumeHarness) !== selected.harness) {
            if (id) await this.options.onThreadReplacement?.(id, '模型配置切换到其他 CLI');
            id = undefined;
          }
          if (selection && JSON.stringify(selection) !== JSON.stringify(selected)) { await inner?.close(); inner = undefined; }
          selection = selected;
          const generated: GeneratedImage[] = [];
          const paths = executionPaths(original, this.options.cwd!);
          const image = original.step && selected.harness !== 'codex' ? imageGenerationTool(settings, original.step,
            join(paths.workspace, 'generated', randomUUID()),
            this.options.imageNormalization) : undefined;
          if (image) {
            const execute = image.execute;
            // The tool reports the absolute savedPath it wrote.
            image.execute = async (args, signal, context) => {
              const result = await execute(args, signal, context);
              for (const item of result.contentItems) if (item.type === 'inputText') {
                const value = JSON.parse(item.text); if (value.savedPath) generated.push({ savedPath: value.savedPath });
              }
              return result;
            };
          }
          let task = image ? { ...original, imageGeneration: false, tools: [...original.tools || [], image] } : original;
          if (!id && (original.recoveryPrompt || original.resumeContext)) task = { ...task, prompt: freshPrompt(original) };
          const signal = taskSignal(task, [closing.signal, ...(externalSignal ? [externalSignal] : [])]);
          let result: AgentResult;
          try {
            if (selected.harness === 'codex') {
              inner ||= this.createCodexSession(selected, id);
              result = await inner.run(task, signal);
            } else {
              let interrupted = false;
              const replace = this.replacement(task);
              result = await this.invoke(task, signal, async () => {
                try { return await runCliTask(interrupted ? { ...task, prompt: interruptedTaskPrompt() } : task,
                  selected, settings, { ...this.options, onEvent: async event => {
                    if (event.type === 'thread.started') await this.options.onSessionStarted?.(event.thread_id, selected.harness);
                    await this.options.onEvent?.(event);
                  } }, signal, id); }
                catch (error) {
                  if (error instanceof AgentCallError && error.threadId) { id = error.threadId; interrupted = true; }
                  throw error;
                }
              }, async error => {
                // CLI 会话里被拦截的图片无法替换，只能按致命错误结束；replace 对它返回 false。
                if (!await replace(error, id)) return false;
                id = undefined; interrupted = false;
                if (original.recoveryPrompt || original.resumeContext) task = { ...task, prompt: freshPrompt(original) };
                return true;
              });
            }
          } catch (error) {
            if (error instanceof AgentCallError && error.threadId) id = error.threadId;
            throw error;
          }
          id = result.threadId || id;
          return { ...result, harness: selected.harness, images: [...result.images, ...generated] };
        } finally { busy = false; }
      },
      close: async () => { closed = true; closing.abort(new Error('会话已结束')); await inner?.close(); },
    };
  }

  // One-shot turns share the app-server session path. A turn without function
  // tools stays shell-free unless the task asks otherwise.
  async run(task: AgentTask): Promise<AgentResult> {
    if (task.step) task = { ...task, imageGeneration: agentImageGeneration(task.step) };
    const plain = !task.tools?.length;
    const session = this.createSession();
    let result: AgentResult;
    try { return await session.run(plain ? { ...task, shell: task.shell ?? false, ...(task.imageGeneration ? { checkResult: nativeImageResult(task.name) } : {}) } : task); }
    finally { await session.close(); }
  }
}

// A native image turn delivers the images the turn recorded; the agent never copies their paths.
// Its reply only explains a turn that produced none.
function nativeImageResult(name: string) {
  return (text: string, images: GeneratedImage[]): GeneratedImage[] => {
    if (images.length) return images;
    let error: unknown;
    try { error = (JSON.parse(text) as { error?: unknown }).error; } catch {}
    throw new Error(typeof error === 'string' && error ? `${name}：${error}` : `${name} 没有生成图片`);
  };
}

function taskSignal(task: AgentTask, signals: AbortSignal[] = []): AbortSignal {
  return AbortSignal.any([...signals, ...(task.timeoutMs === undefined ? [] : [AbortSignal.timeout(task.timeoutMs)])]);
}
