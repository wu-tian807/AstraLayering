import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';

// line: each output line; git, cargo and rustup redraw progress with \r, so both end a line.
// quiet: notify after every `after` ms without output. Nothing is stopped: slow networks and long links are normal.
export type Quiet = { after: number; notify: (silentMs: number) => void };
export type CommandOptions = { cwd?: string; env: NodeJS.ProcessEnv; log?: string; line?: (text: string) => void; quiet?: Quiet };
export type Command = (command: string, args: string[], options: CommandOptions) => Promise<string>;
export const runCommand: Command = async (command, args, options) => {
  const log = options.log ? createWriteStream(options.log, { flags: 'a', mode: 0o600 }) : undefined;
  let timer: NodeJS.Timeout | undefined;
  try {
    return await new Promise<string>((done, reject) => {
      const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let output = '', partial = '', last = Date.now(), notified = 0;
      const receive = (bytes: Buffer) => {
        log?.write(bytes); last = Date.now(); notified = 0;
        if (!options.line) return;
        const parts = (partial + bytes).split(/\r\n|\r|\n/); partial = parts.pop()!.slice(-4096);
        for (const part of parts) if (part.trim()) options.line(part.trim());
      };
      child.stdout.on('data', bytes => { output = (output + bytes).slice(-1024 * 1024); receive(bytes); });
      child.stderr.on('data', receive);
      const quiet = options.quiet;
      if (quiet) timer = setInterval(() => {
        const silent = Date.now() - last;
        if (silent >= quiet.after * (notified + 1)) { notified++; quiet.notify(silent); }
      }, Math.min(1000, quiet.after / 2)).unref();
      child.once('error', reject);
      child.once('close', code => {
        if (partial.trim()) options.line?.(partial.trim());
        if (code === 0) done(output.trim());
        else reject(new Error(`${command} 退出码 ${code}${options.log ? `；日志：${options.log}` : ''}`));
      });
      log?.once('error', error => { child.kill(); reject(error); });
    });
  } finally { clearInterval(timer); if (log) await new Promise<void>(resolve => log.end(resolve)); }
};

const duration = (ms: number) => ms < 60_000 ? `${Math.round(ms / 1000)} 秒` : `${Math.floor(ms / 60_000)} 分 ${Math.round(ms % 60_000 / 1000)} 秒`;
// The full output stays in the build log; the workflow log gets the latest line (and how many crates
// cargo compiled) at most every `every` ms, plus a warning with ways out when the command goes silent.
export function watchOutput(stage: string, progress: (message: string) => void, log: string | undefined,
  { every = 20_000, quietAfter = 180_000, now = Date.now }: { every?: number; quietAfter?: number; now?: () => number } = {}):
  Pick<CommandOptions, 'line' | 'quiet'> {
  const start = now(); let reported = -Infinity, compiled = 0;
  const logHint = log ? `；完整输出：${log}` : '';
  return {
    line(text) {
      if (/^Compiling /.test(text)) compiled++;
      if (now() - reported < every) return;
      reported = now();
      progress(`${stage}：${compiled ? `已编译 ${compiled} 个 crate，最近 ` : ''}${text.slice(0, 160)}（已用 ${duration(now() - start)}）`);
    },
    quiet: { after: quietAfter, notify: silent => progress(`${stage}已 ${duration(silent)}没有新输出（共用时 ${duration(now() - start)}）；`
      + `可能是网络受阻${compiled ? '，也可能在链接大文件' : ''}。可继续等待；或停止任务，设置 HTTPS_PROXY 等代理后续跑；`
      + `也可在 .env 设置 codex_path 指向已构建好的补丁 Codex 跳过构建${logHint}`) },
  };
}
