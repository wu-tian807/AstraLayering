import { appendFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ThreadEvent } from '@openai/codex-sdk';

function readable(value: unknown): string {
  return JSON.stringify(value, function (key, item) {
    if (key === 'result' && this?.type === 'imageGeneration' && typeof item === 'string' && item) {
      return `[图片数据，${item.length} 字符；完整内容见 events.jsonl]`;
    }
    if ((key === 'imageUrl' || key === 'audioUrl') && typeof item === 'string' && item.startsWith('data:')) {
      return `[图片/音频数据，${item.length} 字符；完整内容见 events.jsonl]`;
    }
    if (key === 'data' && typeof item === 'string' && item.length > 1000) return `[二进制数据，${item.length} 字符]`;
    return item;
  }, 2);
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

  private constructor(directory: string) {
    this.directory = directory;
  }

  static async create(root: string, name: string, request: unknown): Promise<AgentLog> {
    await mkdir(root, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = name.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 48) || 'agent';
    const log = new AgentLog(await mkdtemp(join(root, `${timestamp}-${safeName}-`)));
    await writeFile(join(log.directory, 'request.json'), JSON.stringify(request, null, 2) + '\n', 'utf8');
    await writeFile(join(log.directory, 'events.jsonl'), '', 'utf8');
    await writeFile(join(log.directory, 'transcript.log'), `[${log.startedAt}] ${name}\n`, 'utf8');
    return log;
  }

  static async retry(directory: string, event: { attempt: number; nextAttempt: number; delayMs: number; error: string }) {
    const timestamp = new Date().toISOString();
    await appendFile(join(directory, 'events.jsonl'), JSON.stringify({ timestamp, event: { type: 'retry.scheduled', ...event } }) + '\n');
    await appendFile(join(directory, 'transcript.log'),
      `[${timestamp}] 临时错误，${event.delayMs / 1000} 秒后第 ${event.nextAttempt} 次尝试：${event.error}\n`);
  }

  async record(event: ThreadEvent): Promise<string> {
    const timestamp = new Date().toISOString();
    await appendFile(join(this.directory, 'events.jsonl'), JSON.stringify({ timestamp, event }) + '\n', 'utf8');
    const description = describeEvent(event);
    if (description) {
      await appendFile(join(this.directory, 'transcript.log'), `[${timestamp}] ${description}\n\n`, 'utf8');
    }
    return description;
  }

  async recordProtocol(message: Record<string, any>, direction: 'in' | 'out' = 'in'): Promise<string> {
    const timestamp = new Date().toISOString();
    await appendFile(join(this.directory, 'events.jsonl'), JSON.stringify({ timestamp, direction, event: message }) + '\n', 'utf8');
    const method = message.method as string | undefined;
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
    if (description) await appendFile(join(this.directory, 'transcript.log'), `[${timestamp}] ${description}\n\n`, 'utf8');
    return description;
  }

  async finish(result: Record<string, unknown>): Promise<void> {
    const finishedAt = new Date().toISOString();
    await writeFile(join(this.directory, 'result.json'), JSON.stringify({
      startedAt: this.startedAt, finishedAt, elapsedMs: Date.now() - this.startedMs, ...result,
    }, null, 2) + '\n', 'utf8');
    await appendFile(join(this.directory, 'transcript.log'),
      `[${finishedAt}] ${result.status}${result.error ? `：${result.error}` : ''}\n`, 'utf8');
  }
}
