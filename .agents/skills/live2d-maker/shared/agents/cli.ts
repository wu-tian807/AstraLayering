import { knowledgeDirectory } from '../knowledge.ts';
import { agentImageGeneration } from '../agent-knowledge.ts';
import { access, mkdir, readFile, writeFile, copyFile, rename, chmod, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, delimiter, relative, isAbsolute } from 'node:path';
import spawn from 'cross-spawn';
import { stopCliProcess } from './process.ts';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { genaiGateway } from './agv-gateway.ts';
import { claudeGateway } from '../../patches/claude/gateway.ts';
import { VisualContext, imageBudget } from '../../patches/shared/visual-context.ts';
import { AgvTurn } from './agv-turn.ts';
import { createMcpBridge } from './mcp.ts';
import type { WorkflowEnvironment } from '../codex/environment.ts';
import type { AgentModel, Harness } from './models.ts';
import type { AgentTask, AgentResult, AgentOptions } from '../codex/agents.ts';
import { AgentCallError } from '../codex/agent-runtime.ts';
import { agentCallError } from '../codex/diagnostics.ts';
import { errorDetails, errorMessage } from './errors.ts';
import { followNativeLog } from '../codex/native-log.ts';
import { resolvePatchedAgv } from './agv-patch.ts';
import { AgentLog } from '../codex/agent-log.ts';
import { resolveRunsDirectory } from '../paths.ts';
import { withNodePath } from '../process-environment.ts';
import { claudeProviderSettings, validateProviderModel } from './providers.ts';
import { prepareWorkspace, workspacePrompt, workspaceTools } from './workspace.ts';
import { fromTaskPath, toTaskPath } from '../task-paths.ts';

// AGV reports its Go transport timeouts only as text; these two exact forms are tagged where the CLI ends.
const agvTransportTimeout = /net\/http: timeout awaiting response headers|stream idle timeout \(\w+\): context deadline exceeded/;

// Agent CLIs run in their own process groups, so a signal to the worker's group misses them; a worker
// stopping on a signal exits before each call's abort can follow up, and ends them here instead.
const agentGroups = new Map<number, import('node:child_process').ChildProcess>();
export function signalAgentProcesses(signal: NodeJS.Signals) {
  for (const child of agentGroups.values()) stopCliProcess(child, signal === 'SIGKILL');
}

export async function cliExecutable(settings: WorkflowEnvironment, harness: Harness, runsRoot?: string): Promise<string> {
  const explicit = settings.cliPaths[harness];
  const names = harness === 'claude' ? ['claude'] : harness === 'agv' ? ['agy', 'agv', 'antigravity'] : ['codex'];
  const candidates = explicit ? [explicit] : (settings.codex.env?.PATH ?? process.env.PATH ?? '').split(delimiter)
    .flatMap(directory => names.flatMap(name => process.platform === 'win32' ? [join(directory, `${name}.exe`), join(directory, `${name}.cmd`)] : [join(directory, name)]));
  for (const path of candidates) {
    let executable;
    try { await access(path, constants.X_OK); if (!(await stat(path)).isFile()) continue; executable = await realpath(path); }
    catch { continue; }
    // Compatibility errors must reach the user, rather than be swallowed and
    // misreported as a missing CLI or silently fall back to an unpatched one.
    if (harness !== 'agv') return executable;
    if (settings.codex.env?.agv_unlimited_response_header_timeout === 'true') {
      const {createPatchedAgv} = await import('../../patches/agv/patch-response-header.ts');
      const root = resolveRunsDirectory(runsRoot);
      await mkdir(root, {recursive: true});
      return createPatchedAgv(executable, root);
    }
    return resolvePatchedAgv(executable);
  }
  throw new Error(`所选步骤需要 ${harness} CLI，但没有可用的全局入口${explicit ? `：${explicit}` : ''}。工作流不会自动安装；请安装并登录，或设置 ${harness}_path / 改用已有模型。`);
}
type StoredSession = { harness: Harness; data: string; workspace: string };
async function readSessions(root: string): Promise<Record<string, StoredSession>> {
  try { return JSON.parse(await readFile(join(root, 'sessions.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}
// Serialize only the registry writes; CLI calls themselves keep the shared concurrency budget.
const registryWrites = new Map<string, Promise<void>>();
async function remember(root: string, id: string, session: StoredSession): Promise<void> {
  const next = (registryWrites.get(root) || Promise.resolve()).catch(() => {}).then(async () => {
    const records = await readSessions(root); records[id] = session;
    const file = join(root, 'sessions.json'), temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2), { mode: 0o600 }); await rename(temporary, file);
  });
  registryWrites.set(root, next); await next;
}
async function copyCredential(source: string, target: string) {
  try { await copyFile(source, target); await chmod(target, 0o600); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

export async function runCliTask(task: AgentTask, model: AgentModel, settings: WorkflowEnvironment, options: AgentOptions,
  signal: AbortSignal, resumed?: string): Promise<AgentResult> {
  validateProviderModel(settings.providers, model, task.step ?? task.name);
  const executable = await cliExecutable(settings, model.harness, options.imageNormalization?.runsRoot);
  const root = resolve(options.logDirectory || join(task.cwd || options.cwd!, 'agents'));
  const paths = await prepareWorkspace(task, options.cwd!);
  task = { ...task, tools: workspaceTools((task.tools || []).filter(tool =>
    tool.name !== 'imagegen' || !task.step || agentImageGeneration(task.step)), paths) };
  const log = await AgentLog.create(root, task.name, { task: { ...task, tools: task.tools?.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
    workspace: paths.workspace, outputDirectory: paths.outputDirectory,
    prompt: task.prompt, sessionThreadId: resumed || null, threadOptions: { model: model.model, modelReasoningEffort: model.effort, harness: model.harness } }, paths.root);
  let mcpServer: Awaited<ReturnType<typeof createMcpBridge>> | undefined;
  const requestedSession = resumed;
  let bridge: Awaited<ReturnType<typeof genaiGateway>>;
  let threadId = resumed, text = '', final: any, stderr = '';
  let processExitCode: number | null | undefined;
  let upstreamStatus: number | undefined;
  const eventErrors: unknown[] = [];
  let refusal: string | undefined;
  // Tool calls this turn made: Claude's tool_use items, AGV's tool steps.
  let toolCalls = 0;
  const agvTurn = model.harness === 'agv' ? new AgvTurn() : undefined;
  try {
    const records = await readSessions(root);
    let previous = resumed ? records[resumed] : undefined;
    // The registry records task-relative directories; older entries hold absolute ones.
    if (previous) previous = { ...previous, data: fromTaskPath(paths.root, previous.data) };
    if (resumed && previous?.harness !== model.harness) {
      await options.onThreadReplacement?.(resumed, 'CLI 已改变或原会话记录不可用'); resumed = undefined;
      threadId = undefined;
      previous = undefined;
    }
    if (previous) try {
      for (const path of [previous.data]) {
        const lexical = relative(root, resolve(path));
        if (!lexical || lexical === '..' || lexical.startsWith('../') || isAbsolute(lexical)) throw new Error('CLI 会话目录不在当前任务记录目录内');
        const rel = relative(await realpath(root), await realpath(path));
        if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error('CLI 会话目录不在当前任务记录目录内');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await options.onThreadReplacement?.(resumed!, '原 CLI 会话目录已不存在');
      resumed = undefined; threadId = undefined; previous = undefined;
    }
    const workspace = paths.workspace;
    // The CLI works in the step workspace; a resumed session keeps the directory it started in.
    const cwd = previous?.workspace ? fromTaskPath(paths.root, previous.workspace) : workspace;
    const data = previous?.harness === model.harness ? previous.data : join(log.directory, 'cli-data');
    await mkdir(data, { recursive: true, mode: 0o700 });
    // Some CLI releases ignore their config-directory overrides for native history.
    // Give only the child a private home; the host environment and user config stay untouched.
    const env = { ...withNodePath(settings.codex.env),
      HOME: join(data, 'home'), USERPROFILE: join(data, 'home'), TMPDIR: join(log.directory, 'tmp'),
      XDG_CONFIG_HOME: join(data, 'config'), XDG_DATA_HOME: join(data, 'data'), XDG_STATE_HOME: join(data, 'state'), XDG_CACHE_HOME: join(data, 'cache'),
      CLAUDE_CONFIG_DIR: join(data, 'claude'), CLAUDE_CODE_TMPDIR: join(log.directory, 'tmp'),
      ANTIGRAVITY_APP_DATA_DIR: join(data, 'home/.gemini/antigravity-cli'), JETSKI_APP_DATA_DIR: join(data, 'home/.gemini/antigravity-cli'),
      ANTIGRAVITY_GEMINI_DIR: join(data, 'home/.gemini'), GEMINI_DIR: join(data, 'home/.gemini'), AGY_CLI_DISABLE_AUTO_UPDATE: 'true',
    };
    for (const path of [env.TMPDIR, env.CLAUDE_CONFIG_DIR, env.ANTIGRAVITY_APP_DATA_DIR, env.ANTIGRAVITY_GEMINI_DIR]) await mkdir(path, { recursive: true, mode: 0o700 });
    if (!previous && model.harness === 'claude') {
      await copyCredential(join(settings.codex.env?.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), '.credentials.json'), join(env.CLAUDE_CONFIG_DIR, '.credentials.json'));
    }
    if (!previous && model.harness === 'agv') {
      const sourceGemini = settings.codex.env?.ANTIGRAVITY_GEMINI_DIR || settings.codex.env?.GEMINI_DIR || join(homedir(), '.gemini');
      await copyCredential(join(sourceGemini, 'oauth_creds.json'), join(env.ANTIGRAVITY_GEMINI_DIR, 'oauth_creds.json'));
      await copyCredential(join(sourceGemini, 'google_accounts.json'), join(env.ANTIGRAVITY_GEMINI_DIR, 'google_accounts.json'));
      await copyCredential(join(settings.codex.env?.ANTIGRAVITY_APP_DATA_DIR || join(sourceGemini, 'antigravity-cli'), 'jetski_state.pbtxt'), join(env.ANTIGRAVITY_APP_DATA_DIR, 'jetski_state.pbtxt'));
    }
    const authSettings = join(log.directory, 'auth-settings.json');
    let userSettings: any = {};
    try { if (model.harness === 'claude') userSettings = JSON.parse(await readFile(join(settings.codex.env?.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json'), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const inherited = { ...(userSettings.apiKeyHelper ? { apiKeyHelper: userSettings.apiKeyHelper } : {}),
      ...(model.harness === 'claude' ? claudeProviderSettings(settings.providers?.claude) : {}),
      env: Object.fromEntries(Object.entries(userSettings.env || {}).filter(([key]) => /^(ANTHROPIC_|CLAUDE_CODE_USE_|AWS_|AZURE_|GOOGLE_|VERTEX_)/.test(key))
        .map(([key, value]) => [key, settings.codex.env?.[key] ?? value])) };
    if (model.harness === 'claude' && settings.providers?.claude.connection === 'unified') {
      delete inherited.apiKeyHelper;
      delete inherited.env.ANTHROPIC_AUTH_TOKEN;
    }
    if (model.harness === 'claude' && settings.providers?.claude.connection === 'unified') {
      const nativeEnv: NodeJS.ProcessEnv = { ...inherited.env, ...env };
      if (['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY'].some(key => /^(true|1)$/.test(String(nativeEnv[key])))) {
        throw new Error('统一 Claude 网关使用 Anthropic Messages，与当前启用的云平台路由不兼容；请清空统一连接配置以复用原路由，或关闭对应云平台设置。');
      }
    }
    mcpServer = await createMcpBridge(task.tools || [], signal, event => log.recordProtocol(event));
    const mcp = { mcpServers: { layering: mcpServer.config } };
    const budget = imageBudget(env, model.harness);
    const visual = new VisualContext({ directory: join(data, 'visual-context'), protocol: model.harness === 'agv' ? 'genai' : 'anthropic', budget,
      observe: async event => {
        await log.recordProtocol(event);
        if (event.phase !== 'prepared' || model.harness === 'claude') options.progress?.(`[${task.name}] 图片容量保护 ${event.phase}；${event.images} 张；${event.requestBytes} 字节${event.batchImages ? `；本批 ${event.batchImages} 张 / ${event.batchBytes ?? 0} 字节` : ''}`);
      } });
    if (model.harness === 'agv') {
      bridge = await genaiGateway(env, task.tools || [], root, signal,
        event => {
          // AGV reports upstream failures only as text; the gateway sees the real status. A later success clears it.
          if (event.phase === 'headers' && event.status) upstreamStatus = event.status >= 400 ? event.status : undefined;
          return log.recordProtocol(event).then(() => {});
        }, visual);
      if (bridge) Object.assign(env, { AGY_LLM_GATEWAY_URL: bridge.url });
    } else if (budget.images || budget.bytes || budget.deduplicate) {
      const nativeEnv: NodeJS.ProcessEnv = { ...inherited.env, ...env };
      if (['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY'].some(key => /^(true|1)$/.test(String(nativeEnv[key])))) {
        throw new Error('当前 Claude 原生云平台协议无法使用 Messages 图片容量保护；保护配置未被忽略，未启动模型。');
      }
      const upstream = String(nativeEnv.ANTHROPIC_BASE_URL || 'https://api.anthropic.com');
      const secrets = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'].map(key => nativeEnv[key]).filter((value): value is string => !!value);
      bridge = await claudeGateway(upstream, visual, signal, text => secrets.reduce((value, secret) => value.replaceAll(String(secret), '[redacted]'), text));
      Object.assign(env, { ANTHROPIC_BASE_URL: bridge.url });
      inherited.env.ANTHROPIC_BASE_URL = bridge.url;
    }
    await writeFile(authSettings, JSON.stringify(inherited), { mode: 0o600 });
    Object.assign(env, mcp.mcpServers.layering.env, { LAYERING_BRIDGE_RESULTS: join(log.directory, 'bridge-results') });
    const configPath = join(log.directory, 'mcp.json'); await writeFile(configPath, JSON.stringify(mcp), { mode: 0o600 });
    await mkdir(join(env.GEMINI_DIR, 'config'), { recursive: true, mode: 0o700 });
    await writeFile(join(env.GEMINI_DIR, 'config/mcp_config.json'), JSON.stringify(mcp), { mode: 0o600 });
    // A --print run ends with its turn: nothing re-invokes a session that scheduled a wakeup, so the
    // CLI forces the structured result early and the step stops as unfinished.
    const args = model.harness === 'claude'
      ? ['--print', '--verbose', '--input-format', 'stream-json', '--output-format', 'stream-json', '--model', model.model, '--effort', model.effort,
        '--strict-mcp-config', '--mcp-config', configPath, '--settings', authSettings, '--setting-sources', '', '--disable-slash-commands', '--dangerously-skip-permissions',
        '--disallowedTools', 'ScheduleWakeup,CronCreate,CronDelete,CronList', '--add-dir', task.cwd || options.cwd!]
      : ['--input-format', 'stream-json', '--output-format', 'stream-json', '--model', model.model, '--effort', model.effort,
        '--disable-slash-commands', '--dangerously-skip-permissions', '--log-file', join(env.TMPDIR, 'native.log'), '--add-dir', task.cwd || options.cwd!];
    if (resumed) args.push(model.harness === 'claude' ? '--resume' : '--conversation', resumed);
    // Reference images are paths in the prompt; the agent opens them itself.
    args.push('--add-dir', knowledgeDirectory());
    if (task.outputSchema) args.push('--json-schema', JSON.stringify(task.outputSchema));
    // agy requires an explicit empty --print value when prompts come from stdin.
    if (model.harness === 'agv') args.push('--print=');
    const reportId = async (id: string) => {
      if (!id || id === threadId) return;
      // AGV opens a new conversation when the one asked for is gone, so the old session is unavailable and gets replaced.
      if (threadId) throw new Error(threadId === resumed ? `原 session 不可用：CLI 未恢复 ${resumed}，返回了新的会话 ID ${id}` : 'CLI 返回了不同的原会话 ID');
      threadId = id; await remember(root, id, { harness: model.harness, data: toTaskPath(paths.root, data), workspace: toTaskPath(paths.root, cwd) });
      await options.onEvent?.({ type: 'thread.started', thread_id: id });
    };
    options.progress?.(`开始：${task.name}；${model.harness} / ${model.model} / ${model.effort}；记录：${log.directory}`);
    signal.throwIfAborted();
    const child = spawn(executable, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    if (child.pid) agentGroups.set(child.pid, child);
    let spawnError: Error | undefined;
    child.on('error', error => { spawnError = error; });
    let childClosed = false;
    const close = new Promise<number | null>(done => child.once('close', code => { childClosed = true; agentGroups.delete(child.pid!); done(code); }));
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      if (childClosed) return;
      stopCliProcess(child);
      if (!killTimer) { killTimer = setTimeout(() => {
        stopCliProcess(child, true);
      }, 5000); killTimer.unref(); }
    };
    const nativeLog = model.harness === 'agv' ? followNativeLog(join(env.TMPDIR, 'native.log'), log, message => { spawnError = new Error(message); abort(); }) : undefined;
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
    try {
      child.stderr!.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-16000); });
      child.stdin!.on('error', error => { spawnError ||= error; });
      const prompt = !resumed && requestedSession && task.recoveryPrompt ? task.recoveryPrompt : task.prompt;
      const input: any[] = [{ type: 'text', text: workspacePrompt(prompt, paths) }];
      await writeFile(join(log.directory,'prompt.md'),input[0].text);
      child.stdin!.end(JSON.stringify(model.harness === 'agv' ? { event: 'user', message: { role: 'user', content: input } } : { type: 'user', message: { role: 'user', content: input } }) + '\n');
      for await (const line of createInterface({ input: child.stdout!, crlfDelay: Infinity })) {
        if (!line.trim()) continue;
        let event: any; try { event = JSON.parse(line); } catch { await log.recordProtocol({ text: line }); continue; }
        await log.recordProtocol(event);
        if (event.type === 'error' || event.event === 'error') eventErrors.push(errorDetails(event));
        if (event.type === 'system' && /^model_refusal/.test(event.subtype ?? '')) refusal = event.api_refusal_category ?? 'unknown';
        const completedText = agvTurn?.record(event);
        const id = event.session_id || event.conversation_id || event.step_update?.conversation_id;
        if (id) await reportId(id);
        if (event.type === 'assistant') {
          for (const item of event.message?.content || []) if (item.type === 'tool_use') toolCalls++;
          for (const item of event.message?.content || []) if (item.type === 'text') {
            text = item.text; options.progress?.(`[${task.name}] 消息：${text}`);
            await options.onEvent?.({ type: 'item.completed', item: { type: 'agent_message', id: event.uuid || randomUUID(), text } });
          }
        }
        if (event.event === 'result' || event.type === 'result') { final = event.result && typeof event.result === 'object' ? event.result : event;
          await reportId(final.conversation_id || final.session_id || '');
          text = final.structured_output ? JSON.stringify(final.structured_output) : final.response || final.result || text;
        }
        if (completedText !== undefined) {
          text = completedText;
          options.progress?.(`[${task.name}] ${text}`);
          await options.onEvent?.({ type: 'item.completed', item: { type: 'agent_message', id: String(event.step_update.step_index), text } });
        }
      }
      const code = await close;
      processExitCode = code;
      await nativeLog?.close();
      if (spawnError) throw spawnError;
      signal.throwIfAborted();
      const recoveredError = code === 0 && final && agvTurn?.recoveredError(final, threadId);
      const successfulStatus = model.harness === 'agv' ? final?.status === 'SUCCESS' || recoveredError : final?.status !== 'ERROR';
      if (code !== 0 || !final || final.is_error || !successfulStatus) {
        // Name the failure from structured signals: the API status Claude reports, the upstream status AGV's
        // response carried through our gateway, a CLI killed before any result, or one of AGV's two Go
        // transport timeouts, which it reports only as the terminal error string.
        const status = final?.api_error_status ?? (model.harness === 'agv' ? upstreamStatus : undefined);
        // Claude's safeguards refused the turn (stop_reason refusal), often a false flag on its own compacted history.
        if (final?.stop_reason === 'refusal') refusal ??= final.stop_details?.category ?? 'unknown';
        const info = refusal ? { refusal: { category: refusal, turns: final?.num_turns ?? null } }
          : typeof status === 'number' ? { apiError: { httpStatusCode: status, code: final?.api_error_code ?? null } }
          : code === null && !final ? 'processKilled'
          : model.harness === 'agv' && final?.status === 'ERROR' && agvTransportTimeout.test(final.error ?? '') ? 'transportTimeout'
          // Any other terminal failure the CLI reported: unknown, so it waits and retries unless the text or subtype says otherwise.
          : { cliFailed: { subtype: final?.subtype ?? null, cliStatus: final?.status ?? null, exitCode: code } };
        // Claude puts the upstream error ("API Error: …") in result and leaves stderr with an unrelated line.
        const reported = final?.is_error && typeof final.result === 'string' && final.result.trim() ? final.result : undefined;
        const error = agentCallError(final?.error || final?.errors || reported || stderr || eventErrors, 'CLI 未返回成功终态', info);
        error.details = errorDetails({ error: final?.error, errors: final?.errors, events: eventErrors,
          stderr, processExitCode, cliStatus: final?.status, subtype: final?.subtype });
        throw error;
      }
      if (recoveredError) {
        if (!final.structured_output) text = agvTurn!.completedResponse!;
        await log.recordProtocol({ type: 'agv.turn.completed', outcomeSource: 'current_turn_steps',
          conversationStatus: final.status, earlierError: final.error, userStepIndex: agvTurn!.userStepIndex,
          recoveredErrorStepIndices: agvTurn!.recoveredErrorStepIndices, processExitCode: code });
        options.progress?.(`[${task.name}] 本轮最终已完成；此前错误与恢复过程已保留在记录中。`);
      }
      await options.onEvent?.({ type: 'item.completed', item: { type: 'agent_message', id: randomUUID(), text } });
      await log.finish({ status: 'completed', threadId: threadId || null, usage: final.usage || null, finalResponse: text, images: [], processExitCode, cliStatus: final.status });
      return { text, images: [], threadId, logDirectory: log.directory };
    } finally { signal.removeEventListener('abort', abort); abort(); await close; if (killTimer) clearTimeout(killTimer); await nativeLog?.close(); }
  } catch (error) {
    const reported = error instanceof AgentCallError ? error : new AgentCallError(errorMessage(error, String(error)), undefined, { cause: error });
    reported.details ??= errorDetails(error);
    await log.finish({ status: 'failed', threadId: threadId || null, finalResponse: text, error: reported.message,
      errorDetails: reported.details, stderr, processExitCode, cliStatus: final?.status });
    reported.threadId = threadId; reported.finalResponse = text; reported.logDirectory = log.directory;
    // Claude counts an API turn per tool round, so more than one turn is progress even if the stream missed the calls.
    reported.progress = Math.max(toolCalls, agvTurn?.toolSteps ?? 0, typeof final?.num_turns === 'number' ? final.num_turns - 1 : 0);
    throw reported;
  } finally { await bridge?.close(); await mcpServer?.close(); }
}
