import { appendFile, lstat, open } from 'node:fs/promises';
import { join } from 'node:path';

export const taskLogName = 'workflow.log';

// State snapshots must never block the append-only activity log.
export function createTaskLog(directory: string, echo?: (message: string) => void) {
  let pending = Promise.resolve(), failure: unknown;
  return {
    write(message: string) {
      const timestamp = new Date().toISOString();
      pending = pending.then(() => appendFile(join(directory, taskLogName), `[${timestamp}] ${message}\n`))
        .then(() => { failure = undefined; }, error => {
          failure = error;
          console.error('主日志写入失败：', error);
        });
      echo?.(message);
    },
    async flush() { await pending; if (failure) throw failure; },
  };
}

export async function readTaskLog(directory: string, bytes = 24 * 1024) {
  // Old background workers still write service.log. Read the newest source until
  // resumed with this version; all new writers use workflow.log only.
  const candidates = await Promise.all([taskLogName, 'service.log'].map(async name => {
    try {
      const info = await lstat(join(directory, name));
      if (!info.isFile()) throw new Error(`日志必须为普通文件：${name}`);
      return { name, info };
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  }));
  const source = candidates.filter(value => value !== undefined).sort((a, b) => b.info.mtimeMs - a.info.mtimeMs)[0];
  if (!source) return { path: join(directory, taskLogName), text: '', updatedAt: undefined, message: undefined };
  const handle = await open(join(directory, source.name), 'r');
  try {
    const info = await handle.stat(), start = Math.max(0, info.size - bytes);
    const buffer = Buffer.alloc(Math.min(info.size, bytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    const content = buffer.subarray(0, bytesRead).toString('utf8');
    const headers = [...content.matchAll(/^(?:\[\d{4}-\d{2}-\d{2}T[^\]]+\] (.+)|((?:\[[^\]\r\n]+\]) .+))$/gm)]
      .map(match => match[1] ?? match[2])
      .filter(line => !/收到 |完成：\{|工具结果：\{|思考摘要：\s*$/.test(line));
    return { path: join(directory, source.name), text: (start ? '…（仅显示末尾）\n' : '') + content,
      updatedAt: info.mtime.toISOString(), message: headers.at(-1) };
  } finally { await handle.close(); }
}
