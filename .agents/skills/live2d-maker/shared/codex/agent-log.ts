import { appendFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { sectionIds } from '../paths.ts';
import { retryDelays } from '../agents/runtime.ts';
import { toTaskPath, toTaskPaths } from '../task-paths.ts';
import type { ThreadEvent } from '@openai/codex-sdk';
import { appendWorkflowLog, retryLogOpen } from '../../workflow/log.ts';

// Written into a call's record directory while it waits to retry; see AgentLog.retry.
export const retryWaitFile = 'retry-wait.json';

function readable(value: unknown): string {
  return JSON.stringify(value, function (key, item) {
    if (key === 'result' && this?.type === 'imageGeneration' && typeof item === 'string' && item) {
      return `[图片数据，${item.length} 字符；完整内容见 events.jsonl]`;
    }
    if ((key === 'imageUrl' || key === 'audioUrl') && typeof item === 'string' && item.startsWith('data:')) {
      return `[图片/音频数据，${item.length} 字符；完整内容见 events.jsonl]`;
    }
    if (key === 'data' && typeof item === 'string' && (this?.type === 'base64' || item.length > 1000)) return `[二进制数据，${item.length} 字符]`;
    return item;
  }, 2);
}

// CLI tool-only replies are activity too. Keep raw protocol/media in the
// request record and mirror bounded, readable tool activity into workflow.log.
export function describeCLIActivity(message: Record<string, any>): string {
  const compact = (value: unknown) => {
    const text = readable(value) || '';
    return text.length > 4000 ? text.slice(0, 4000) + '\n[内容较长，完整记录见 events.jsonl]' : text;
  };
  const summary = (text: unknown) => typeof text === 'string' ? text.replace(/\s+/g, ' ').slice(0, 240) : '';
  const lines: string[] = [];
  const content = Array.isArray(message.message?.content) ? message.message.content : [];
  if (message.type === 'assistant') {
    for (const item of content) if (item?.type === 'tool_use') {
      const hint = summary(item.input?.description || item.input?.file_path || item.input?.command);
      lines.push(`工具开始：${item.name}（${item.id}）${hint ? `；${hint}` : ''}\n${compact(item.input)}`);
    }
  } else if (message.type === 'user') {
    for (const item of content) if (item?.type === 'tool_result') {
      const hint = summary(typeof item.content === 'string' ? item.content :
        Array.isArray(item.content) ? item.content.filter((part: any) => part?.type === 'text').map((part: any) => part.text).join(' ') : '');
      lines.push(`工具${item.is_error ? '失败' : '完成'}：${item.tool_use_id}${hint ? `；${hint}` : ''}\n${compact(item.content)}`);
    }
  } else if (message.type === 'system' && message.subtype === 'task_notification') {
    lines.push(`后台工具${message.status === 'completed' ? '完成' : String(message.status || '更新')}：${message.tool_use_id || message.task_id}；${message.summary || ''}`);
  } else if (message.type === 'system' && message.subtype === 'api_retry') {
    lines.push(`CLI 临时错误，正在退避重试${message.attempt ? `（第 ${message.attempt} 次）` : ''}：${compact(message.error)}`);
  } else if (message.step_update?.step_type === 'tool') {
    const step = message.step_update, info = step.tool_info || {}, parameters = info.parameters || {};
    const phase = step.state === 'ACTIVE' ? '开始' : step.state === 'DONE' ? '完成' : String(step.state || '更新');
    const hint = summary(info.output || parameters.Description || parameters.Path || parameters.CommandLine);
    const duration = Number.isFinite(step.duration_seconds) ? `；${step.duration_seconds} 秒` : '';
    lines.push(`工具${phase}：${step.tool_name || info.name || '未命名工具'}（步骤 ${step.step_index}）${hint ? `；${hint}` : ''}${duration}\n${compact(info)}`);
  } else if (message.step_update?.step_type === 'error_message') {
    const step = message.step_update;
    lines.push(`步骤错误：${step.step_index}；${step.state || '未知状态'}\n${compact(step)}`);
  }
  return lines.join('\n');
}

function describeEvent(event: ThreadEvent): string {
  switch (event.type) {
    case 'thread.started': return `会话：${event.thread_id}`;
    case 'turn.started': return '开始处理';
    case 'turn.completed': return `处理完成；用量：${JSON.stringify(event.usage)}`;
    case 'turn.failed': return `处理失败：${event.error.message}`;
    case 'error': return `错误：${event.message}`;
    case 'item.updated': return ''; // The full update remains in events.jsonl.
    case 'item.started':
    case 'item.completed': {
      const item = event.item;
      const phase = event.type === 'item.started' ? '开始' : '完成';
      switch (item.type) {
        case 'reasoning': return event.type === 'item.completed' ? `思考摘要：${item.text}` : '';
        case 'agent_message': return event.type === 'item.completed' ? `消息：${item.text}` : '';
        case 'mcp_tool_call':
          return `工具${phase}：${item.server}/${item.tool}\n${readable(item)}`;
        case 'command_execution':
          return `命令${phase}：${item.command}\n${item.aggregated_output}`;
        case 'file_change': return `文件变更：${JSON.stringify(item)}`;
        case 'web_search': return `搜索：${item.query}`;
        case 'todo_list': return `计划：${JSON.stringify(item.items)}`;
        case 'error': return `错误：${item.message}`;
        default: return `${event.type}：${JSON.stringify(item)}`;
      }
    }
    default: return JSON.stringify(event);
  }
}

export class AgentLog {
  readonly directory: string;
  readonly startedAt = new Date().toISOString();
  private startedMs = Date.now();

  private readonly workflowLog: string;
  private readonly name: string;
  private readonly taskRoot?: string;
  private constructor(directory: string, name: string, root: string, taskRoot?: string) {
    this.directory = directory;
    this.name = name;
    this.workflowLog = workflowLogPath(root);
    this.taskRoot = taskRoot;
  }

  private async write(description: string, timestamp = new Date().toISOString()) {
    if (description) await appendWorkflowLog(this.workflowLog, '[' + timestamp + '] [' + this.name + '] ' + description + '\n');
  }

  // With taskRoot, paths inside the task are recorded relative to it; events.jsonl
  // stays the verbatim protocol stream.
  static async create(root: string, name: string, request: unknown, taskRoot?: string): Promise<AgentLog> {
    await mkdir(root, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const log = new AgentLog(await mkdtemp(join(root, `${timestamp}-`)), name, root, taskRoot);
    if (taskRoot) request = toTaskPaths(taskRoot, request);
    await writeFile(join(log.directory, 'request.json'), JSON.stringify(request, null, 2) + '\n', 'utf8');
    if (request && typeof request === 'object' && 'prompt' in request && typeof request.prompt === 'string')
      await writeFile(join(log.directory, 'prompt.md'), request.prompt, 'utf8');
    await writeFile(join(log.directory, 'events.jsonl'), '', 'utf8');
    await log.write('请求记录：' + (taskRoot ? toTaskPath(taskRoot, log.directory) : log.directory), log.startedAt);
    return log;
  }

  static async retry(directory: string, event: { attempt: number; nextAttempt: number; delayMs: number; error: string; rateLimited?: boolean },
    now = new Date()) {
    const timestamp = now.toISOString();
    await retryLogOpen(() => appendFile(join(directory, 'events.jsonl'), JSON.stringify({ timestamp, event: { type: 'retry.scheduled', ...event } }) + '\n'));
    // The page reads this to show 限流等待 until the next attempt; a later retry overwrites it, and the
    // wait ends on its own when `until` passes, so nothing removes it.
    await writeFile(join(directory, retryWaitFile), JSON.stringify({ reason: event.rateLimited ? 'rate-limit' : 'transient', attempt: event.attempt,
      nextAttempt: event.nextAttempt, since: timestamp, until: new Date(now.getTime() + event.delayMs).toISOString(), error: event.error }, null, 2) + '\n');
    await appendWorkflowLog(workflowLogPath(directory), `[${timestamp}] [${basename(directory)}] 限流等待（${event.rateLimited ? '429' : '临时错误'}），保留并发位置，${event.delayMs / 1000} 秒后第 ${event.attempt}/${retryDelays.retries} 次重试：${event.error}\n`);
  }

  async record(event: ThreadEvent): Promise<string> {
    const timestamp = new Date().toISOString();
    await retryLogOpen(() => appendFile(join(this.directory, 'events.jsonl'), JSON.stringify({ timestamp, event }) + '\n', 'utf8'));
    const description = describeEvent(event);
    await this.write(description, timestamp);
    return description;
  }

  async recordProtocol(message: Record<string, any>, direction: 'in' | 'out' = 'in'): Promise<string> {
    const timestamp = new Date().toISOString();
    await retryLogOpen(() => appendFile(join(this.directory, 'events.jsonl'), JSON.stringify({ timestamp, direction, event: message }) + '\n', 'utf8'));
    const method = message.method as string | undefined;
    if (method === 'item/commandExecution/outputDelta') return ''; // The completed item contains the assembled command output.
    let description = '';
    if (method === 'item/completed') {
      const item = message.params?.item;
      if (item?.type === 'agentMessage') description = `消息：${item.text}`;
      else if (item?.type === 'reasoning') description = `思考摘要：${(item.summary ?? []).join('\n')}`;
      else description = `完成：${readable(item)}`;
    } else if (method === 'item/tool/call') {
      description = `工具调用：${message.params?.tool}\n${readable(message.params?.arguments)}`;
    } else if (direction === 'out' && message.result?.contentItems) {
      description = `工具结果：${readable(message.result)}`;
    } else if (method && !method.endsWith('/delta')) {
      description = `${direction === 'out' ? '发送' : '收到'} ${method}：${readable(message.params)}`;
    } else if (message.error) {
      description = `错误：${readable(message.error)}`;
    }
    if (message.type === 'cli.native') description = String(message.text || '');
    if (message.type === 'agv.gateway') {
      const phases: Record<string, string> = { started: '请求开始', prepared: '发送请求', headers: '收到响应头', first_body: '开始返回内容', completed: '请求完成', failed: '请求失败' };
      description = '网关 ' + String(message.requestId).slice(0, 8) + '：' + phases[message.phase] + '；' + (message.elapsedMs / 1000).toFixed(2) + ' 秒'
        + (message.status ? '；HTTP ' + message.status : '')
        + (message.inputImages !== undefined ? '；图片 ' + message.inputImages + ' 张；力度 ' + (message.thinkingLevel || '未设置') : '')
        + (message.errorName ? '；' + message.errorName : '');
    }
    if (!method && message.text && message.type !== 'agv.gateway') description = String(message.text);
    description = describeCLIActivity(message) || description;
    await this.write(description, timestamp);
    return description;
  }

  async finish(result: Record<string, unknown>): Promise<void> {
    const finishedAt = new Date().toISOString();
    if (this.taskRoot && Array.isArray(result.images)) result = { ...result, images: toTaskPaths(this.taskRoot, result.images) };
    await writeFile(join(this.directory, 'result.json'), JSON.stringify({
      startedAt: this.startedAt, finishedAt, elapsedMs: Date.now() - this.startedMs, ...result,
    }, null, 2) + '\n', 'utf8');
    await this.write(String(result.status) + (result.error ? '：' + result.error : ''), finishedAt);
    if (result.errorDetails !== undefined) await this.write('错误详情：\n' + JSON.stringify(result.errorDetails, null, 2), finishedAt);
  }
}

// All six sections, including independent CLI entrypoints, share the task log.
// Unstructured/test callers keep their log inside their own supplied log root.
export function workflowLogPath(root: string): string {
  for (let path = resolve(root); dirname(path) !== path; path = dirname(path)) {
    if ((sectionIds as readonly string[]).includes(basename(path))) return join(dirname(path), 'workflow.log');
  }
  return join(resolve(root), 'workflow.log');
}
