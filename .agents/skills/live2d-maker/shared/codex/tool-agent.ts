import { runtimePrompt } from '../knowledge.ts';
import { loadWorkflowEnvironment, workflowCodexOptions } from './environment.ts';
import { agentCallError, codexContentFilterInfo, formatAgentError } from './diagnostics.ts';
import { errorDetails, errorMessage } from '../agents/errors.ts';
import { workflowsDirectory } from '../paths.ts';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { AgentLog } from './agent-log.ts';
import { AgentCallError } from './agent-runtime.ts';
import { type AgentOptions, type AgentSession, type AgentTask, type GeneratedImage } from './agents.ts';
import type { ToolResult } from './function-tools.ts';
import { validateProviderModel } from '../agents/providers.ts';
import { prepareWorkspace, workspacePrompt, workspaceTools } from '../agents/workspace.ts';
import { imagePath } from '../task-paths.ts';
import { agentImageGeneration } from '../agent-knowledge.ts';

// Only the protocol subset used here is maintained. The CLI is pinned by codex-sdk.
type Message = { id?: number | string; method?: string; params?: Record<string, any>;
  result?: Record<string, any>; error?: { code: number; message: string; data?: unknown } };

export function appServerCommand(override?: string): { command: string; args: string[] } {
  if (override) return { command: override, args: ['app-server'] };
  const sdkRequire = createRequire(import.meta.resolve('@openai/codex-sdk'));
  const packagePath = sdkRequire.resolve('@openai/codex/package.json');
  return { command: process.execPath, args: [join(dirname(packagePath), 'bin/codex.js'), 'app-server'] };
}

// The model catalog's tool_mode puts every tool behind code mode's exec script, which outranks
// features.code_mode. That script receives a dynamic tool result as one string of JSON plus a data
// URL, so the model misses images and paths. Run every model with direct tool calls instead.
async function directToolCatalog(executable: { command: string; args: string[] }, configArgs: string[], env: NodeJS.ProcessEnv) {
  const { stdout } = await promisify(execFile)(executable.command, [...executable.args.slice(0, -1), 'debug', 'models', ...configArgs],
    { env, timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
  const catalog = JSON.parse(stdout);
  if (!Array.isArray(catalog?.models)) throw new Error('Codex debug models 未返回模型目录');
  for (const model of catalog.models) model.tool_mode = null;
  const text = JSON.stringify(catalog);
  const directory = join(tmpdir(), 'astra-layering-codex-catalogs');
  const file = join(directory, `${createHash('sha256').update(text).digest('hex').slice(0, 16)}.json`);
  await mkdir(directory, { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, text);
  await rename(temporary, file);
  return file;
}

function flattenConfig(value: Record<string, unknown>, prefix = '', result: Record<string, unknown> = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length) {
      flattenConfig(child as Record<string, unknown>, path, result);
    } else if (child !== undefined) result[path] = child;
  }
  return result;
}

async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  const cancellation = Promise.withResolvers<T>();
  const abort = () => cancellation.reject(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  try { return await Promise.race([operation, cancellation.promise]); }
  finally { signal.removeEventListener('abort', abort); }
}

// history: model-visible items for a new thread (e.g. after blocked images were
// replaced). Tools are registered by thread/start, so history is injected after it.
export function createFunctionToolSession(options: AgentOptions, resumeThreadId?: string, history?: unknown[]): AgentSession {
  const environment = options.environment ?? loadWorkflowEnvironment(options.env);
  options = { ...options, ...workflowCodexOptions(environment, options) };
  const selectedModel = options.selectedModel ?? environment.models.medium;
  let child: ReturnType<typeof spawn> | undefined;
  let lines: ReturnType<typeof createInterface> | undefined;
  let reader: Promise<void> | undefined;
  let threadId: string | undefined, threadPath: string | undefined, cwd: string | undefined, toolDefinitions: string | undefined;
  let imageGeneration: boolean | undefined, shell: boolean | undefined;
  let nextId = 0, closed = false, busy = false, stderr = '';
  let activeTurnId: string | undefined;
  let startRequestId: number | undefined;
  let startEvents: Message[] = [];
  const endedTurns = new Set<string>();
  const turnEndWaiters = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
  let failure: { error: unknown } | undefined;
  const closing = new AbortController();
  const transportEnded = new AbortController();
  const pending = new Map<number | string, ReturnType<typeof Promise.withResolvers<Record<string, any>>>>();
  const exited = Promise.withResolvers<void>();
  let current: {
    task: AgentTask; log: AgentLog; signal: AbortSignal; turnId?: string;
    completion: ReturnType<typeof Promise.withResolvers<void>>;
    tools: Map<string, NonNullable<AgentTask['tools']>[number]>;
    done: boolean; finalResponse: string; usage: unknown; images: GeneratedImage[]; errors: unknown[];
    // Tool calls and other work items this turn completed; messages and reasoning are not work.
    progress: number;
  } | undefined;

  const fail = (error: unknown) => {
    failure ??= { error };
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
    current?.completion.reject(error);
  };
  const checkFailure = () => { if (failure) throw failure.error; };
  const emit = async (event: Parameters<NonNullable<AgentOptions['onEvent']>>[0]) => { await options.onEvent?.(event); };
  const failTurn = (error: unknown) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
    if (current) { current.done = true; current.completion.reject(error); }
  };
  const send = async (message: Message) => {
    if (closed) return;
    const logged = ['thread/start', 'thread/resume'].includes(message.method ?? '')
      ? { ...message, params: { ...message.params, config: '[运行配置已省略；不记录凭据]' } } : message;
    await current?.log.recordProtocol(logged, 'out');
    if (closed) return;
    if (!child || child.stdin!.destroyed || child.stdin!.writableEnded) throw new Error('App Server 输入流已关闭');
    if (!child.stdin!.write(JSON.stringify(message) + '\n')) await once(child.stdin!, 'drain');
  };
  const request = (method: string, params: Record<string, unknown>) => {
    const id = ++nextId;
    const waiter = Promise.withResolvers<Record<string, any>>();
    pending.set(id, waiter);
    if (method === 'turn/start') { startRequestId = id; startEvents = []; }
    void send({ id, method, params }).catch(fail);
    return waiter.promise;
  };

  const rememberActiveTurn = (thread: Record<string, any> | undefined) => {
    const turn = thread?.turns?.findLast((turn: any) => turn.status === 'inProgress');
    if (typeof turn?.id === 'string' && !endedTurns.has(turn.id)) activeTurnId = turn.id;
  };
  // The interrupt RPC only acknowledges the request. Wait for the terminal event
  // before submitting our input, and bound the wait if the old turn is stuck.
  async function interruptActiveTurn(signal: AbortSignal, refresh = false): Promise<boolean> {
    const waiting = AbortSignal.any([signal, transportEnded.signal, AbortSignal.timeout(30_000)]);
    if (refresh) rememberActiveTurn((await abortable(request('thread/read', { threadId, includeTurns: true }), waiting)).thread);
    const id = activeTurnId;
    if (!id) return false;
    const ended = Promise.withResolvers<void>();
    turnEndWaiters.set(id, ended);
    try {
      try { await abortable(request('turn/interrupt', { threadId, turnId: id }), waiting); }
      catch (error) { if (!endedTurns.has(id)) throw error; }
      if (!endedTurns.has(id)) await abortable(ended.promise, waiting);
      return true;
    } finally { turnEndWaiters.delete(id); }
  }
  const schemaMismatch = (error: unknown) => error instanceof AgentCallError &&
    (error.details as { code?: number } | undefined)?.code === -32603 &&
    /\bActiveTurnOutputSchemaMismatch\b/.test(error.message);
  const protocolFailure = (cause: unknown) => new AgentCallError(
    'Codex 活动回合未能恢复到可提交状态', 'sessionProtocol', { cause });

  async function dispatch(message: Message, trackLifecycle = true): Promise<void> {
    const sameThread = !message.params?.threadId || message.params.threadId === (threadId ?? resumeThreadId);
    if (trackLifecycle && sameThread && message.method === 'turn/started' && typeof message.params?.turn?.id === 'string') {
      activeTurnId = message.params.turn.id;
    } else if (trackLifecycle && sameThread && message.method === 'turn/completed' && typeof message.params?.turn?.id === 'string') {
      const id = message.params.turn.id;
      endedTurns.add(id);
      if (activeTurnId === id) activeTurnId = undefined;
      turnEndWaiters.get(id)?.resolve();
    }
    // Events can precede the reply that identifies our turn.
    if (startRequestId !== undefined && message.method &&
        ['item/tool/call', 'item/completed', 'turn/completed', 'thread/tokenUsage/updated', 'error'].includes(message.method)) {
      startEvents.push(message);
      return;
    }
    // A missing identity cannot safely be attributed to the current turn.
    // Completion uses the nested turn.id; other turn-scoped events use turnId.
    const turnScoped = ['item/tool/call', 'item/completed', 'turn/completed', 'thread/tokenUsage/updated', 'error'].includes(message.method ?? '');
    const eventTurnId = message.method === 'turn/completed' ? message.params?.turn?.id : message.params?.turnId;
    if (sameThread && current?.turnId && turnScoped && (typeof eventTurnId !== 'string' || !eventTurnId.trim())) {
      const reason = 'Codex App Server 的 ' + message.method + ' 缺少有效回合 ID';
      if (message.method === 'item/tool/call' && message.id !== undefined) {
        await send({ id: message.id, result: { success: false, contentItems: [{ type: 'inputText', text: reason }] } });
      }
      failTurn(new AgentCallError(reason, 'localError'));
      child?.kill();
      return;
    }
    // Resumed/automatic turns must not run this task's tools or finish it.
    const ownTurn = sameThread && !!current?.turnId && eventTurnId === current.turnId;
    if (message.method && message.id !== undefined) {
      if (message.method !== 'item/tool/call') {
        await send({ id: message.id, error: { code: -32601, message: `未注册的请求：${message.method}` } });
        return;
      }
      const params = message.params;
      let result: ToolResult;
      try {
        if (!busy || !current || current.done || !ownTurn) throw new Error('当前没有可调用工具的回合');
        current.signal.throwIfAborted();
        if (!params || params.threadId !== threadId || (params.namespace != null && params.namespace !== 'functions')) {
          throw new Error('工具请求不属于当前会话或注册命名空间');
        }
        const tool = current.tools.get(params.tool);
        if (!tool) throw new Error(`未注册的工具：${params.tool}`);
        const signal = AbortSignal.any([current.signal, transportEnded.signal]);
        current.progress++;
        result = await abortable(tool.execute(params.arguments, signal), signal);
      } catch (error) {
        result = { success: false, contentItems: [{ type: 'inputText',
          text: error instanceof Error ? error.message : String(error) }] };
      }
      await send({ id: message.id, result });
    } else if (message.id !== undefined) {
      const waiter = pending.get(message.id);
      if (waiter) {
        if (message.id === startRequestId) {
          startRequestId = undefined;
          const id = message.result?.turn?.id;
          const invalid = !message.error && (typeof id !== 'string' || !id.trim());
          if (!message.error && !invalid && current) current.turnId = id;
          const buffered = startEvents; startEvents = [];
          for (const event of buffered) await dispatch(event, false);
          if (invalid) {
            pending.delete(message.id);
            waiter.reject(new AgentCallError('Codex App Server 的 turn/start 返回缺少有效 turn.id', 'localError'));
            child?.kill();
            return;
          }
        }
        pending.delete(message.id);
        if (message.error) waiter.reject(agentCallError(message.error, 'App Server RPC 调用失败'));
        else waiter.resolve(message.result ?? {});
      }
    } else if (message.method === 'item/completed' && current && ownTurn) {
      const item = message.params?.item;
      if (item?.type && !['userMessage', 'agentMessage', 'reasoning'].includes(item.type)) current.progress++;
      if (item?.type === 'agentMessage') {
        current.finalResponse = item.text;
        await emit({ type: 'item.completed', item: { type: 'agent_message', id: item.id || 'message', text: item.text } });
      }
      else if (item?.type === 'imageGeneration' && current.task.imageGeneration && item.status === 'completed' &&
          typeof item.savedPath === 'string' && item.savedPath.trim()) {
        // Codex saves native images under its cwd and reports absolute paths; anything else is a protocol change.
        let savedPath: string;
        try { savedPath = imagePath(item.savedPath, 'Codex 原生生图 savedPath'); }
        catch (error) { failTurn(error); return; }
        if (!current.images.some(image => image.savedPath === savedPath)) current.images.push({ savedPath });
      }
    } else if (message.method === 'thread/tokenUsage/updated' && current && ownTurn) {
      current.usage = message.params?.tokenUsage;
    } else if (message.method === 'turn/completed' && current && ownTurn) {
      const turn = message.params?.turn;
      if (turn?.status !== 'completed') {
        // A failed turn without a code is still a channel failure, unlike a local error.
        failTurn(agentCallError(turn?.error, `回合状态：${turn?.status}`, codexContentFilterInfo(turn?.error) ?? turn?.error?.codexErrorInfo ?? 'turnFailed'));
      }
      else { current.done = true; current.completion.resolve(); }
    } else if (message.method === 'error' && current && ownTurn) {
      current.errors.push(errorDetails(message.params));
    }
  }

  async function start(threadOptions: Record<string, unknown>) {
    const executable = appServerCommand(options.codexPathOverride);
    const env = { ...(options.env ?? process.env) };
    if (options.apiKey) env.CODEX_API_KEY = options.apiKey;
    const configArgs = ['features.code_mode=false', 'features.code_mode_only=false', ...options.configOverrides ?? []].flatMap(config => ['-c', config]);
    const catalog = await directToolCatalog(executable, configArgs, env);
    const args = [...executable.args, ...configArgs, '-c', `model_catalog_json=${JSON.stringify(catalog)}`];
    child = spawn(executable.command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    child.once('error', fail);
    child.once('close', (code, exitSignal) => {
      exited.resolve();
      const error = new Error(`Codex App Server 提前退出（${exitSignal ?? code}）：${stderr}`);
      transportEnded.abort(error);
      // stdout can already be buffered while the reader awaits log writes.
      // Drain its notifications before rejecting the turn and clearing state.
      void (reader ?? Promise.resolve()).then(() => { if (!closed) fail(error); });
    });
    child.stdin!.on('error', error => { if (!closed) fail(error); });
    child.stderr!.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-16_000); });
    lines = createInterface({ input: child.stdout!, crlfDelay: Infinity });
    reader = (async () => {
      for await (const line of lines!) {
        const message = JSON.parse(line) as Message;
        const description = await current?.log.recordProtocol(message);
        if (description && current) options.progress?.(`[${current.task.name}] ${description}`);
        await dispatch(message);
        // error(willRetry=true/false) 都是通知。等 turn/completed 的终态后才决定恢复，
        // 不能在 CLI 仍重连或正在结束旧 turn 时启动另一个 turn。
      }
      if (!closed) fail(new Error('Codex App Server 事件流结束'));
    })().catch(fail);
    await request('initialize', {
      clientInfo: { name: 'part_layering', title: 'Part Layering', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    await send({ method: 'initialized', params: {} });
    const started = await request(resumeThreadId ? 'thread/resume' : 'thread/start',
      resumeThreadId ? { ...threadOptions, threadId: resumeThreadId } : threadOptions);
    threadId = started.thread?.id;
    if (typeof threadId !== 'string') throw new Error('App Server 未返回会话 ID');
    threadPath = typeof started.thread?.path === 'string' ? started.thread.path : undefined;
    rememberActiveTurn(started.thread);
    if (resumeThreadId) {
      try { await interruptActiveTurn(current!.signal, !activeTurnId && started.thread?.status?.type === 'active'); }
      catch (error) { current!.signal.throwIfAborted(); throw protocolFailure(error); }
    }
    if (history?.length && !resumeThreadId) await request('thread/inject_items', { threadId, items: history });
    await emit({ type: 'thread.started', thread_id: threadId });
  }

  return {
    async run(task, externalSignal) {
      validateProviderModel(environment.providers, { ...selectedModel, harness: 'codex' }, task.step ?? task.name);
      if (closed) throw new Error('会话已关闭');
      if (busy) throw new Error('同一会话不能并发运行');
      checkFailure();
      const paths = await prepareWorkspace(task, options.cwd ?? workflowsDirectory);
      const permittedImages = task.step ? agentImageGeneration(task.step) : task.imageGeneration === true;
      const tools = workspaceTools((task.tools ?? []).filter(tool => permittedImages || tool.name !== 'imagegen'), paths);
      const byName = new Map(tools.map(tool => [tool.name, tool]));
      if (byName.size !== tools.length || tools.some(tool => !/^[a-zA-Z0-9_-]+$/.test(tool.name))) {
        throw new Error('function tool 名称无效或重复');
      }
      const workingDirectory = paths.workspace;
      const definitions = tools.map(({ name, description, inputSchema }) => ({ type: 'function', name, description, inputSchema }));
      // Named workflow steps must declare image capability. A caller or global
      // Codex config cannot enable native imagegen for a manual drawing step.
      const enableImageGeneration = permittedImages && task.imageGeneration === true;
      const enableShell = task.shell ?? true;
      if (threadId && (cwd !== workingDirectory || imageGeneration !== enableImageGeneration || shell !== enableShell ||
          toolDefinitions !== JSON.stringify(definitions))) {
        throw new Error('延续会话不能改变工作目录、工具定义、shell 或生图开关');
      }
      cwd = workingDirectory; toolDefinitions = JSON.stringify(definitions);
      imageGeneration = enableImageGeneration; shell = enableShell;
      busy = true;
      const timeoutMs = task.timeoutMs;
      const signal = AbortSignal.any([closing.signal, ...(externalSignal ? [externalSignal]
        : timeoutMs === undefined ? [] : [AbortSignal.timeout(timeoutMs)])]);
      const threadOptions = {
        // No sandbox for now: paths are managed by the prompt and tools, not by write limits.
        model: selectedModel.model, cwd, sandbox: 'danger-full-access', approvalPolicy: 'never',
        // Normalize user dotted/nested keys before applying workflow overrides;
        // otherwise a dotted features.image_generation=true may win by key order.
        config: flattenConfig({ ...flattenConfig(options.config ?? {}), model_reasoning_effort: selectedModel.effort, web_search: 'disabled',
          ...(options.baseUrl ? { openai_base_url: options.baseUrl } : {}),
          features: { image_generation: imageGeneration, shell_tool: shell, unified_exec: shell, multi_agent: false, memories: false, goals: false } }),
        dynamicTools: definitions,
      };
      const input: Record<string, unknown>[] = [{ type: 'text', text: workspacePrompt(task.prompt, paths), text_elements: [] }];
      const log = await AgentLog.create(resolve(options.logDirectory ?? join(paths.directory, 'agents')), task.name, {
        workspace: paths.workspace, outputDirectory: paths.outputDirectory,
        transport: 'app-server', task: { ...task, tools: definitions, timeoutMs: timeoutMs ?? null }, input,
        prompt: input.filter(item => item.type === 'text').map(item => item.text).join('\n\n'),
        sessionThreadId: threadId ?? null,
        threadOptions: { ...threadOptions, config: undefined, modelReasoningEffort: selectedModel.effort },
      }, paths.root);
      const completion = Promise.withResolvers<void>();
      void completion.promise.catch(() => {});
      current = { task, log, signal, completion, tools: byName, done: false, finalResponse: '', usage: null, images: [], errors: [], progress: 0 };
      const state = current;
      options.progress?.(`开始：${task.name}；原生 function tools${threadId ? `；沿用会话 ${threadId}` : ''}；记录：${log.directory}`);
      const abort = () => {
        fail(signal.reason);
        child?.kill();
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        signal.throwIfAborted();
        if (!threadId) await start(threadOptions);
        checkFailure();
        // The workflow owns turn scheduling, including resumed threads. goals:false
        // prevents native goal continuation racing this explicit schema-bound turn.
        const params = { threadId, input, effort: selectedModel.effort,
          ...(task.outputSchema ? { outputSchema: task.outputSchema } : {}) };
        try { await request('turn/start', params); }
        catch (error) {
          if (!schemaMismatch(error)) throw error;
          options.progress?.(`[${task.name}] Codex 自动续跑回合与输出格式冲突；中断后沿用原会话立即重试一次。`);
          try {
            if (!await interruptActiveTurn(signal, true)) throw error;
          } catch (cause) { signal.throwIfAborted(); throw protocolFailure(cause); }
          try { await request('turn/start', params); }
          catch (cause) { if (schemaMismatch(cause)) throw protocolFailure(cause); throw cause; }
        }
        // dispatch assigns the validated turn ID before releasing buffered events.
        await completion.promise;
        if (task.checkResult) state.images = task.checkResult(state.finalResponse, state.images);
        await log.finish({ status: 'completed', threadId, usage: state.usage, finalResponse: state.finalResponse, images: state.images });
        options.progress?.(`agent 回合结束：${task.name}`);
        return { text: state.finalResponse, images: state.images, threadId, logDirectory: log.directory };
      } catch (error) {
        const message = errorMessage(error, String(error));
        const reported = error instanceof AgentCallError ? error : new AgentCallError(message, undefined, { cause: error });
        reported.details ??= errorDetails(error);
        if (state.errors.length) reported.details = { terminal: reported.details, notifications: state.errors };
        await log.finish({ status: 'failed', threadId, usage: state.usage, finalResponse: state.finalResponse,
          error: message, ...(error instanceof AgentCallError ? { errorInfo: error.info } : {}),
          errorDetails: reported.details,
          images: state.images, ...(stderr ? { stderr } : {}) });
        options.progress?.(`失败：${task.name}；${message}；记录：${log.directory}`);
        reported.logDirectory = log.directory;
        reported.threadId = threadId;
        reported.threadPath = threadPath;
        reported.finalResponse = state.finalResponse;
        reported.progress = state.progress;
        reported.sessionBroken = !!failure || !threadId;
        reported.savedImagePaths = state.images.map(image => image.savedPath);
        options.progress?.(formatAgentError(reported));
        throw reported;
      } finally {
        signal.removeEventListener('abort', abort);
        busy = false;
        current = undefined;
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      fail(new Error('会话已结束'));
      closing.abort(new Error('会话已结束'));
      if (!child) return;
      child.stdin!.end();
      child.kill();
      const killTimer = setTimeout(() => child?.kill('SIGKILL'), 1500);
      killTimer.unref();
      await exited.promise;
      clearTimeout(killTimer);
      lines?.close();
      await reader;
    },
  };
}
