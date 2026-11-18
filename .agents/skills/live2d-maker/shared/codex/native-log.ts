import { open, rm } from 'node:fs/promises';
import type { AgentLog } from './agent-log.ts';

// The CLI requires a file destination. Tail its temporary file into the sole
// human-readable workflow.log, then remove the transport file at turn end.
export function followNativeLog(path: string, log: AgentLog, onError: (message: string) => void) {
  let position = 0, pending = '', chain = Promise.resolve();
  const read = async (final = false) => {
    let file;
    try {
      file = await open(path, 'r');
      const size = (await file.stat()).size;
      if (size < position) position = 0;
      const bytes = Buffer.alloc(size - position);
      const result = await file.read(bytes, 0, bytes.length, position); position += result.bytesRead;
      pending += bytes.subarray(0, result.bytesRead).toString('utf8');
      const lines = pending.split('\n'); pending = final ? '' : lines.pop()!;
      for (const line of lines) if (line) await log.recordProtocol({ type: 'cli.native', text: line });
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    finally { await file?.close(); }
  };
  const poll = () => { chain = chain.then(() => read()).catch(error => onError('原生日志读取失败：' + error)); };
  const timer = setInterval(poll, 500); timer.unref();
  return { async close() { clearInterval(timer); await chain; await read(true); await rm(path, { force: true }); } };
}
