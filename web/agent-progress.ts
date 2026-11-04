import { lstat, readFile } from 'node:fs/promises';
import { safePath } from './files.ts';
import { retryWaitFile } from '../.agents/skills/live2d-maker/shared/codex/agent-log.ts';
import { fromTaskPath, toTaskPath } from '../.agents/skills/live2d-maker/shared/task-paths.ts';

// throttledUntil: the call holds its slot while waiting to retry until then; retryError is the error as logged, verbatim.
export type AgentCall = { name: string; step: string; request: string; mtime: number; finished: boolean; failed: boolean; outputDirectory?: string; throttledUntil?: number; retryError?: string };
export const throttled = (call: AgentCall, now = Date.now()) => !call.finished && (call.throttledUntil ?? 0) > now;
const requests = new Map<string, { version: string; name: string; step: string; outputDirectory?: string }>();

// A request is recorded after acquiring a slot. Read these records, never infer activity from a draft.
export async function currentAgentCalls(directory: string, section: string, files: Set<string>,
  errors: string[], activeSince?: string, readFailures = false): Promise<AgentCall[]> {
  if (!activeSince) return [];
  const since = Date.parse(activeSince), calls: AgentCall[] = [];
  const paths = [...files].filter(path => path.startsWith(section + '/agents/') && path.endsWith('/request.json'));
  for (let offset = 0; offset < paths.length; offset += 16) {
    await Promise.all(paths.slice(offset, offset + 16).map(async request => {
      try {
        const path = await safePath(directory, request), info = await lstat(path);
        if (info.mtimeMs < since) return;
        const version = `${info.mtimeMs}:${info.size}`;
        let cached = requests.get(path);
        if (cached?.version !== version) {
          const value = JSON.parse(await readFile(path, 'utf8'));
          const output = value.task?.outputDirectory ?? value.outputDirectory;
          cached = { version, name: value.task?.name ?? value.name ?? '', step: value.task?.step ?? value.step ?? '',
            ...(typeof output === 'string' ? { outputDirectory: toTaskPath(directory, fromTaskPath(directory, output)) } : {}) };
          if (requests.size >= 2048) requests.delete(requests.keys().next().value!);
          requests.set(path, cached);
        }
        // A CLI attempt writes its failed result and then the retry wait; the call goes on in the next attempt's record.
        // A result written after the wait (Codex keeps one record across retries) ends the call.
        const result = request.replace(/request.json$/, 'result.json'), waitPath = request.replace(/request.json$/, retryWaitFile);
        const [resultTime, waitTime] = await Promise.all([result, waitPath].map(path => files.has(path)
          ? safePath(directory, path).then(lstat).then(info => info.mtimeMs, () => undefined) : undefined));
        const pending = waitTime !== undefined && (resultTime === undefined || waitTime >= resultTime);
        const finished = resultTime !== undefined && !pending;
        const failed = readFailures && finished
          ? JSON.parse(await readFile(await safePath(directory, result), 'utf8')).status === 'failed' : false;
        const wait = pending ? JSON.parse(await readFile(await safePath(directory, waitPath), 'utf8')) : undefined;
        const throttledUntil = Date.parse(wait?.until) || undefined;
        calls.push({ name: cached.name, step: cached.step, outputDirectory: cached.outputDirectory, request, mtime: info.mtimeMs, finished, failed,
          ...(throttledUntil ? { throttledUntil, retryError: String(wait.error ?? '') } : {}) });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(request + ': ' + String(error));
      }
    }));
  }
  return calls.sort((a, b) => a.mtime - b.mtime);
}
