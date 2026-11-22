import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { stripVTControlCharacters } from 'node:util';

// line: each output line; git, cargo and rustup redraw progress with \r, so both end a line.
export type CommandOptions = { cwd?: string; env: NodeJS.ProcessEnv; log?: string; line?: (text: string) => void };
export type Command = (command: string, args: string[], options: CommandOptions) => Promise<string>;
export const runCommand: Command = async (command, args, options) => {
  const log = options.log ? createWriteStream(options.log, { flags: 'a', mode: 0o600 }) : undefined;
  try {
    return await new Promise<string>((done, reject) => {
      const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let output = '', partial = '';
      const emitLine = (raw: string) => {
        const text = stripVTControlCharacters(raw).trim();
        if (text) options.line?.(text);
      };
      const receive = (bytes: Buffer) => {
        log?.write(bytes);
        if (!options.line) return;
        const parts = (partial + bytes).split(/\r\n|\r|\n/); partial = parts.pop()!.slice(-4096);
        for (const part of parts) emitLine(part);
      };
      child.stdout.on('data', bytes => { output = (output + bytes).slice(-1024 * 1024); receive(bytes); });
      child.stderr.on('data', receive);
      child.once('error', reject);
      child.once('close', code => {
        emitLine(partial);
        if (code === 0) done(output.trim());
        else reject(new Error(`${command} 退出码 ${code}${options.log ? `；日志：${options.log}` : ''}`));
      });
      log?.once('error', error => { child.kill(); reject(error); });
    });
  } finally { if (log) await new Promise<void>(resolve => log.end(resolve)); }
};

const duration = (ms: number) => ms < 60_000 ? `${Math.round(ms / 1000)} 秒` : `${Math.floor(ms / 60_000)} 分 ${Math.round(ms % 60_000 / 1000)} 秒`;
// Forward actual child output to the workflow log at most every `every` ms.
export function watchOutput(stage: string, progress: (message: string) => void,
  { every = 20_000, now = Date.now }: { every?: number; now?: () => number } = {}) {
  const start = now(); let reported = -Infinity, compiled = 0;
  return (text: string) => {
    if (/^Compiling /.test(text)) compiled++;
    if (now() - reported < every) return;
    reported = now();
    progress(`${stage}：${compiled ? `已编译 ${compiled} 个 crate，最近 ` : ''}${text.slice(0, 160)}（已用 ${duration(now() - start)}）`);
  };
}
