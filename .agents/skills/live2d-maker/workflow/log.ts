import { appendFile, lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { preparationLogPrefix, preparationMessage, type PreparationProgress } from '../shared/preparation-progress.ts';

export const taskLogName = 'workflow.log';

const busyOpeningLog = (error: unknown) => {
  const io = error as NodeJS.ErrnoException | undefined;
  return io?.code === 'EBUSY' && io.syscall === 'open';
};

// A sharing violation before open is safe to retry. A failed write can
// already have appended bytes, so retrying it could duplicate a record.
export async function retryLogOpen<T>(operation: () => Promise<T>): Promise<T> {
  for (const wait of [25, 50, 100, 200, 400]) {
    try { return await operation(); }
    catch (error) { if (!busyOpeningLog(error)) throw error; }
    await delay(wait);
  }
  return operation();
}

const warnedLogs = new Set<string>();
export async function appendWorkflowLog(path: string, line: string): Promise<void> {
  try {
    // During a reported outage, probe once per event so the agent does not
    // wait through the retry window on every subsequent event.
    const append = () => appendFile(path, line);
    await (warnedLogs.has(path) ? append() : retryLogOpen(append));
    warnedLogs.delete(path);
  } catch (error) {
    // This is the readable summary, separate from raw events and task state.
    // Report an outage once even when several events cannot be mirrored.
    if (!warnedLogs.has(path)) {
      warnedLogs.add(path);
      console.error('主日志写入失败：', error);
    }
  }
}

// State snapshots must never block the append-only activity log.
export function createTaskLog(directory: string, echo?: (message: string) => void) {
  let pending = Promise.resolve();
  const path = join(directory, taskLogName);
  const append = (message: string) => {
    const timestamp = new Date().toISOString();
    pending = pending.then(() => appendWorkflowLog(path, `[${timestamp}] ${message}\n`));
  };
  return {
    write(message: string) {
      append(message);
      echo?.(message);
    },
    preparation(runId: string, event: PreparationProgress) {
      append(preparationLogPrefix + JSON.stringify({ runId, ...event }));
      echo?.(preparationMessage(event));
    },
    flush() { return pending; },
  };
}

export async function readTaskLog(directory: string, bytes = 24 * 1024, runId?: string) {
  const path = join(directory, taskLogName);
  const preparations = new Map<PreparationProgress['tool'], PreparationProgress>();
  try {
    if (!(await lstat(path)).isFile()) throw new Error(`日志必须为普通文件：${taskLogName}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { path, text: '', updatedAt: undefined, message: undefined, preparations: [] };
    throw error;
  }
  const handle = await retryLogOpen(() => open(path, 'r')).catch(error => {
    if (!busyOpeningLog(error)) throw error;
    return undefined;
  });
  if (!handle) return { path, text: 'workflow.log 正被占用，暂时无法读取。', updatedAt: undefined, message: undefined, preparations: [] };
  try {
    const info = await handle.stat(), start = Math.max(0, info.size - bytes);
    const buffer = Buffer.alloc(Math.min(info.size, bytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    const content = buffer.subarray(0, bytesRead).toString('utf8').split('\n').map(line => {
      const headerEnd = line.indexOf('] ') + 2;
      if (!line.startsWith(preparationLogPrefix, headerEnd) || !line.startsWith('[')) return line;
      try {
        const { runId: recordRun, ...event } = JSON.parse(line.slice(headerEnd + preparationLogPrefix.length)) as PreparationProgress & { runId: string };
        if (!['upscayl', 'rust', 'codex'].includes(event.tool) || !['running', 'completed', 'failed'].includes(event.state)
          || typeof event.message !== 'string') return line;
        if (runId && recordRun === runId) preparations.set(event.tool, event);
        return line.slice(0, headerEnd) + preparationMessage(event);
      } catch { return line; }
    }).join('\n');
    const headers = [...content.matchAll(/^(?:\[\d{4}-\d{2}-\d{2}T[^\]]+\] (.+)|((?:\[[^\]\r\n]+\]) .+))$/gm)]
      .map(match => match[1] ?? match[2])
      .filter(line => !/收到 |完成：\{|工具结果：\{|思考摘要：\s*$/.test(line));
    return { path, text: (start ? '…（仅显示末尾）\n' : '') + content,
      updatedAt: info.mtime.toISOString(), message: headers.at(-1), preparations: [...preparations.values()] };
  } finally { await handle.close(); }
}
