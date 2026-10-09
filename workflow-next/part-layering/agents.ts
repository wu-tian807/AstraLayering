import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const agentDefaults = { model: 'gpt-6.1-sol', effort: 'xhigh' } as const;

export type AgentTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(args: unknown): Promise<unknown>;
};

export type AgentTask = {
  name: string;
  prompt: string;
  images?: { path: string; description: string }[];
  imageGeneration?: boolean;
  outputSchema?: Record<string, unknown>;
  tools?: AgentTool[];
  timeoutMs?: number;
};

export type GeneratedImage = { result?: string; savedPath?: string };
export type AgentResult = { text: string; images: GeneratedImage[] };
export type AgentServerOptions = {
  command?: string;
  args?: string[];
  cwd?: string;
  progress?: (message: string) => void;
};

type Item = GeneratedImage & {
  id: string; type: string; text?: string; phase?: string | null;
  status?: string; failure?: unknown;
};
type Params = {
  threadId?: string; item?: Item;
  turn?: { id: string; status: string; error?: { message: string }; items?: Item[] };
  tool?: string; arguments?: unknown;
};
type Message = {
  id?: number | string; method?: string; params?: Params;
  result?: unknown; error?: { message: string };
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

type Session = ReturnType<typeof deferred<AgentResult>> & {
  text: string; images: Map<string, GeneratedImage>; tools: AgentTool[];
};

export class CodexAgents {
  private process: ChildProcessWithoutNullStreams;
  private pending = new Map<number, ReturnType<typeof deferred<unknown>>>();
  private sessions = new Map<string, Session>();
  private nextId = 1;
  private stopped = false;
  private imageGenerationSupported = false;
  private exited = deferred<void>();
  private cwd: string;
  private progress?: AgentServerOptions['progress'];

  private constructor(options: AgentServerOptions) {
    this.cwd = resolve(options.cwd ?? fileURLToPath(new URL('.', import.meta.url)));
    this.progress = options.progress;
    this.process = spawn(options.command ?? (process.platform === 'win32' ? 'codex.exe' : 'codex'),
      [...(options.args ?? []), 'app-server', '--listen', 'stdio://'],
      { cwd: this.cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.process.stderr.resume();
    this.process.once('close', () => this.exited.resolve());
    this.process.on('error', error => this.fail(error));
    this.process.on('exit', code => this.fail(new Error(`Codex app-server exited (${code})`)));
    this.process.stdin.on('error', error => this.fail(error));
    const lines = createInterface({ input: this.process.stdout });
    lines.on('line', line => {
      try { this.receive(JSON.parse(line) as Message); }
      catch (error) { this.fail(error); this.process.kill(); }
    });
  }

  static async connect(options: AgentServerOptions = {}): Promise<CodexAgents> {
    const server = new CodexAgents(options);
    try {
      await server.request('initialize', {
        clientInfo: { name: 'astra_part_layering', title: 'Astra part-layering', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      });
      server.send({ method: 'initialized' });
      const capabilities = await server.request<{ imageGeneration: boolean }>('modelProvider/capabilities/read', {});
      server.imageGenerationSupported = capabilities.imageGeneration;
      return server;
    } catch (error) {
      await server.close();
      throw error;
    }
  }

  private send(message: object) {
    if (this.stopped) throw new Error('Codex app-server is closed');
    this.process.stdin.write(JSON.stringify(message) + '\n');
  }

  private async request<T>(method: string, params: object): Promise<T> {
    const id = this.nextId++;
    const result = deferred<unknown>();
    const timer = setTimeout(() => result.reject(new Error(`RPC timed out: ${method}`)), 30_000);
    this.pending.set(id, result);
    try {
      this.send({ id, method, params });
      return await result.promise as T;
    } finally {
      clearTimeout(timer);
      this.pending.delete(id);
    }
  }

  private fail(error: unknown) {
    this.stopped = true;
    for (const request of this.pending.values()) request.reject(error);
    for (const session of this.sessions.values()) session.reject(error);
  }

  private collect(session: Session, item: Item) {
    if (item.type === 'agentMessage' && item.phase !== 'commentary' && typeof item.text === 'string') {
      session.text = item.text;
    }
    if (item.type === 'imageGeneration' && item.status === 'completed' && !item.failure) {
      session.images.set(item.id, { result: item.result, savedPath: item.savedPath });
    }
  }

  private receive(message: Message) {
    if (message.method && message.id !== undefined) {
      void this.handleTool(message);
      return;
    }
    if (message.id !== undefined) {
      const request = this.pending.get(Number(message.id));
      if (message.error) request?.reject(new Error(message.error.message));
      else request?.resolve(message.result);
      return;
    }
    const params = message.params;
    const session = this.sessions.get(params?.threadId ?? '');
    if (!session) return;
    if (message.method === 'item/completed' && params?.item) this.collect(session, params.item);
    if (message.method === 'turn/completed' && params?.turn) {
      for (const item of params.turn.items ?? []) this.collect(session, item);
      if (params.turn.status === 'completed') session.resolve({ text: session.text, images: [...session.images.values()] });
      else session.reject(new Error(params.turn.error?.message ?? `Agent turn ${params.turn.status}`));
    }
  }

  private async handleTool(message: Message) {
    try {
      if (message.method !== 'item/tool/call') {
        this.send({ id: message.id, error: { code: -32601, message: `Unhandled request: ${message.method}` } });
        return;
      }
      const params = message.params;
      const tool = this.sessions.get(params?.threadId ?? '')?.tools.find(tool => tool.name === params?.tool);
      if (!tool) throw new Error(`Unknown function tool: ${params?.tool}`);
      const output = await tool.execute(params?.arguments);
      this.send({ id: message.id, result: { success: true, contentItems: [
        { type: 'inputText', text: typeof output === 'string' ? output : JSON.stringify(output) ?? 'null' },
      ] } });
    } catch (error) {
      if (!this.stopped) this.send({ id: message.id, result: { success: false, contentItems: [
        { type: 'inputText', text: error instanceof Error ? error.message : String(error) },
      ] } });
    }
  }

  async run(task: AgentTask): Promise<AgentResult> {
    if (task.imageGeneration && !this.imageGenerationSupported) {
      throw new Error('The current Codex provider does not support image_generation');
    }
    this.progress?.(`开始：${task.name}`);
    const started = await this.request<{ thread: { id: string }; model: string }>('thread/start', {
      model: agentDefaults.model, allowProviderModelFallback: false, cwd: this.cwd,
      approvalPolicy: 'never', sandbox: 'read-only', ephemeral: true,
      config: {
        model_reasoning_effort: agentDefaults.effort,
        'features.image_generation': task.imageGeneration ?? false,
        'features.shell_tool': false, 'features.unified_exec': false,
        'features.multi_agent': false, 'features.memories': false, web_search: 'disabled',
      },
      dynamicTools: (task.tools ?? []).map(({ name, description, inputSchema }) => ({ type: 'function', name, description, inputSchema })),
    });
    const threadId = started.thread.id;
    const completion = deferred<AgentResult>();
    void completion.promise.catch(() => {});
    this.sessions.set(threadId, { ...completion, text: '', images: new Map(), tools: task.tools ?? [] });
    let turnId: string | undefined;
    const timer = setTimeout(() => {
      completion.reject(new Error(`Agent timed out: ${task.name}`));
      if (turnId) void this.request('turn/interrupt', { threadId, turnId }).catch(() => {});
    }, task.timeoutMs ?? 15 * 60_000);
    try {
      if (started.model !== agentDefaults.model) throw new Error(`Unexpected model: ${started.model}`);
      const input: object[] = [{ type: 'text', text: task.prompt, text_elements: [] }];
      for (const image of task.images ?? []) {
        input.push({ type: 'text', text: image.description, text_elements: [] });
        input.push({ type: 'localImage', path: resolve(image.path) });
      }
      const startedTurn = await this.request<{ turn: { id: string } }>('turn/start', {
        threadId, input, model: agentDefaults.model, effort: agentDefaults.effort,
        ...(task.outputSchema ? { outputSchema: task.outputSchema } : {}),
      });
      turnId = startedTurn.turn.id;
      const result = await completion.promise;
      this.progress?.(`完成：${task.name}`);
      return result;
    } finally {
      clearTimeout(timer);
      this.sessions.delete(threadId);
      await this.request('thread/unsubscribe', { threadId }).catch(() => {});
    }
  }

  async close(): Promise<void> {
    this.fail(new Error('Codex app-server closed'));
    this.process.stdin.end();
    if (this.process.exitCode === null && this.process.signalCode === null) {
      this.process.kill();
    }
    await this.exited.promise;
  }
}
