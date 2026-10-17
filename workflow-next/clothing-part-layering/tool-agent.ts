import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { AgentLog } from './agent-log.ts';
import { AgentCallError } from './agent-runtime.ts';
import { agentDefaults, type AgentOptions, type AgentSession, type AgentTask, type GeneratedImage } from './agents.ts';
import type { ToolResult } from './function-tools.ts';

// Only the protocol subset used here is maintained. The CLI is pinned by codex-sdk.
type Message = { id?: number | string; method?: string; params?: Record<string, any>;
  result?: Record<string, any>; error?: { code: number; message: string } };

export function appServerCommand(override?: string): { command: string; args: string[] } {
  if (override) return { command: override, args: ['app-server'] };
  const sdkRequire = createRequire(import.meta.resolve('@openai/codex-sdk'));
  const packagePath = sdkRequire.resolve('@openai/codex/package.json');
  return { command: process.execPath, args: [join(dirname(packagePath), 'bin/codex.js'), 'app-server'] };
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

export function createFunctionToolSession(options: AgentOptions, resumeThreadId?: string): AgentSession {
  let child: ReturnType<typeof spawn> | undefined;
  let lines: ReturnType<typeof createInterface> | undefined;
  let reader: Promise<void> | undefined;
  let threadId: string | undefined, cwd: string | undefined, toolDefinitions: string | undefined;
  let imageGeneration: boolean | undefined;
  let sandbox: string | undefined, nextId = 0, closed = false, busy = false, stderr = '';
  let failure: { error: unknown } | undefined;
  const closing = new AbortController();
  const pending = new Map<number | string, ReturnType<typeof Promise.withResolvers<Record<string, any>>>>();
  const exited = Promise.withResolvers<void>();
  let current: {
    task: AgentTask; log: AgentLog; signal: AbortSignal;
    completion: ReturnType<typeof Promise.withResolvers<void>>;
    tools: Map<string, NonNullable<AgentTask['tools']>[number]>;
    done: boolean; finalResponse: string; usage: unknown; images: GeneratedImage[];
  } | undefined;

  const fail = (error: unknown) => {
    failure ??= { error };
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
    current?.completion.reject(error);
  };
  const checkFailure = () => { if (failure) throw failure.error; };
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
    void send({ id, method, params }).catch(fail);
    return waiter.promise;
  };

  async function start(threadOptions: Record<string, unknown>) {
    const executable = appServerCommand(options.codexPathOverride);
    const args = [...executable.args];
    for (const config of options.configOverrides ?? []) args.push('-c', config);
    const env = { ...(options.env ?? process.env) };
    if (options.apiKey) env.CODEX_API_KEY = options.apiKey;
    child = spawn(executable.command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    child.once('error', fail);
    child.once('close', (code, exitSignal) => {
      exited.resolve();
      if (!closed) fail(new Error(`Codex App Server 提前退出（${exitSignal ?? code}）：${stderr}`));
    });
    child.stdin!.on('error', error => { if (!closed) fail(error); });
    child.stderr!.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-16_000); });
    lines = createInterface({ input: child.stdout!, crlfDelay: Infinity });
    reader = (async () => {
      for await (const line of lines!) {
        const message = JSON.parse(line) as Message;
        const description = await current?.log.recordProtocol(message);
        if (description && current) options.progress?.(`[${current.task.name}] ${description}`);
        if (message.method && message.id !== undefined) {
          if (message.method !== 'item/tool/call') {
            await send({ id: message.id, error: { code: -32601, message: `未注册的请求：${message.method}` } });
            continue;
          }
          const params = message.params;
          let result: ToolResult;
          try {
            if (!busy || !current || current.done) throw new Error('当前没有可调用工具的回合');
            current.signal.throwIfAborted();
            if (!params || params.threadId !== threadId || (params.namespace != null && params.namespace !== 'functions')) {
              throw new Error('工具请求不属于当前会话或注册命名空间');
            }
            const tool = current.tools.get(params.tool);
            if (!tool) throw new Error(`未注册的工具：${params.tool}`);
            result = await abortable(tool.execute(params.arguments, current.signal), current.signal);
          } catch (error) {
            result = { success: false, contentItems: [{ type: 'inputText',
              text: error instanceof Error ? error.message : String(error) }] };
          }
          await send({ id: message.id, result });
        } else if (message.id !== undefined) {
          const waiter = pending.get(message.id);
          if (waiter) {
            pending.delete(message.id);
            if (message.error) waiter.reject(new AgentCallError(message.error.message));
            else waiter.resolve(message.result ?? {});
          }
        } else if (message.method === 'item/completed' && current) {
          const item = message.params?.item;
          if (item?.type === 'agentMessage') current.finalResponse = item.text;
          else if (item?.type === 'imageGeneration' && current.task.imageGeneration && item.status === 'completed' &&
              typeof item.savedPath === 'string' && item.savedPath.trim()) {
            const savedPath = resolve(cwd!, item.savedPath);
            if (!current.images.some(image => image.savedPath === savedPath)) current.images.push({ savedPath });
          }
        } else if (message.method === 'thread/tokenUsage/updated' && current) {
          current.usage = message.params?.tokenUsage;
        } else if (message.method === 'turn/completed' && current) {
          const turn = message.params?.turn;
          if (turn?.status !== 'completed') failTurn(new AgentCallError(turn?.error?.message ?? `回合状态：${turn?.status}`, turn?.error?.codexErrorInfo));
          else { current.done = true; current.completion.resolve(); }
        }
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
  }

  return {
    async run(task, externalSignal) {
      if (closed) throw new Error('会话已关闭');
      if (busy) throw new Error('同一会话不能并发运行');
      checkFailure();
      const tools = task.tools ?? [];
      const byName = new Map(tools.map(tool => [tool.name, tool]));
      if (byName.size !== tools.length || tools.some(tool => !/^[a-zA-Z0-9_-]+$/.test(tool.name))) {
        throw new Error('function tool 名称无效或重复');
      }
      const workingDirectory = resolve(task.cwd ?? options.cwd ?? fileURLToPath(new URL('.', import.meta.url)));
      const definitions = tools.map(({ name, description, inputSchema }) => ({ type: 'function', name, description, inputSchema }));
      const sandboxMode = task.sandboxMode ?? 'workspace-write';
      const enableImageGeneration = task.imageGeneration ?? false;
      if (threadId && (cwd !== workingDirectory || sandbox !== sandboxMode || imageGeneration !== enableImageGeneration ||
          toolDefinitions !== JSON.stringify(definitions))) {
        throw new Error('延续会话不能改变工作目录、沙箱、工具定义或生图开关');
      }
      cwd = workingDirectory; sandbox = sandboxMode; toolDefinitions = JSON.stringify(definitions);
      imageGeneration = enableImageGeneration;
      busy = true;
      const timeoutMs = task.timeoutMs;
      const signal = AbortSignal.any([closing.signal, ...(externalSignal ? [externalSignal]
        : timeoutMs === undefined ? [] : [AbortSignal.timeout(timeoutMs)])]);
      const threadOptions = {
        model: agentDefaults.model, cwd, sandbox, approvalPolicy: 'never',
        config: flattenConfig({ ...options.config, model_reasoning_effort: agentDefaults.effort, web_search: 'disabled',
          ...(options.baseUrl ? { openai_base_url: options.baseUrl } : {}),
          features: { image_generation: imageGeneration, shell_tool: true, unified_exec: true, multi_agent: false, memories: false } }),
        dynamicTools: definitions,
      };
      const input: Record<string, unknown>[] = [{ type: 'text', text: task.prompt, text_elements: [] }];
      for (const image of task.images ?? []) {
        input.push({ type: 'text', text: image.description, text_elements: [] });
        input.push({ type: 'localImage', path: resolve(image.path) });
      }
      const log = await AgentLog.create(resolve(options.logDirectory ?? join(cwd, '.run/agents')), task.name, {
        transport: 'app-server', task: { ...task, tools: definitions, timeoutMs: timeoutMs ?? null }, input,
        prompt: input.filter(item => item.type === 'text').map(item => item.text).join('\n\n'),
        sessionThreadId: threadId ?? null,
        threadOptions: { ...threadOptions, config: undefined, modelReasoningEffort: agentDefaults.effort },
      });
      const completion = Promise.withResolvers<void>();
      void completion.promise.catch(() => {});
      current = { task, log, signal, completion, tools: byName, done: false, finalResponse: '', usage: null, images: [] };
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
        await request('turn/start', { threadId, input, effort: agentDefaults.effort,
          ...(task.outputSchema ? { outputSchema: task.outputSchema } : {}) });
        await completion.promise;
        await log.finish({ status: 'completed', threadId, usage: state.usage, finalResponse: state.finalResponse, images: state.images });
        options.progress?.(`agent 回合结束：${task.name}`);
        return { text: state.finalResponse, images: state.images, threadId, logDirectory: log.directory };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await log.finish({ status: 'failed', threadId, usage: state.usage, finalResponse: state.finalResponse,
          error: message, ...(error instanceof AgentCallError ? { errorInfo: error.info } : {}),
          images: state.images, ...(stderr ? { stderr } : {}) });
        options.progress?.(`失败：${task.name}；${message}；记录：${log.directory}`);
        const reported = error instanceof AgentCallError ? error : new AgentCallError(message, undefined, { cause: error });
        reported.logDirectory = log.directory;
        reported.threadId = threadId;
        reported.sessionBroken = !!failure || !threadId;
        reported.savedImagePaths = state.images.map(image => image.savedPath);
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
