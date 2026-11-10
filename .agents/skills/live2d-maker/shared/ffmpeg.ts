import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { delimiter, dirname, join, resolve, win32 } from 'node:path';
import { promisify } from 'node:util';
import { MissingDependencyError } from './missing-dependency.ts';

export type FFmpegInstallation = { executable: string; version: string };
export type FFmpegCheck = (path: string) => Promise<FFmpegInstallation>;

// Probe the selected file without opening a video or starting a model.
export async function checkFFmpeg(requested: string, env: NodeJS.ProcessEnv = process.env): Promise<FFmpegInstallation> {
  if (!requested?.trim()) throw new Error('请指定 FFmpeg 可执行文件路径。');
  const executable = resolve(requested);
  try {
    if (!(await stat(executable)).isFile()) throw new Error('不是文件');
    await access(executable, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    const { stdout } = await promisify(execFile)(executable, ['-version'], { env, timeout: 5_000, maxBuffer: 64 * 1024 });
    const version = stdout.split(/\r?\n/)[0];
    if (!/^ffmpeg version\s+\S+/i.test(version)) throw new Error('版本检查未返回 FFmpeg 版本');
    return { executable, version };
  } catch (error) { throw new Error(`指定的 FFmpeg 不存在、不可执行或版本检查失败：${executable}`, { cause: error }); }
}

export function ffmpegCandidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string[] {
  const command = env.ASTRA_STUDIO_FFMPEG || (platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  const paths = platform === 'win32' ? win32 : { join, isAbsolute: (value: string) => value.startsWith('/') };
  if (/[\\/]/.test(command) || paths.isAbsolute(command)) return [command];
  const path = Object.entries(env).find(([key]) => platform === 'win32' ? /^path$/i.test(key) : key === 'PATH')?.[1] ?? '';
  return path.split(platform === 'win32' ? ';' : delimiter).filter(Boolean).map(directory => paths.join(directory, command));
}

// Legacy callers can still locate a system installation; workflow startup passes
// its selected absolute path explicitly instead of relying on this lookup.
export async function ffmpegPath(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  for (const candidate of ffmpegCandidates(env)) {
    if (await stat(candidate).then(info => info.isFile(), () => false)) return (await checkFFmpeg(candidate, env)).executable;
  }
  throw new MissingDependencyError('找不到 FFmpeg，无法从视频提取参考帧。',
    '请在全局设置选择已安装或解压的 FFmpeg 可执行文件；CLI 使用 --ffmpeg <路径>。');
}

// Only the nine-axis invocation receives this environment. Never modify the
// parent process or persist it in section outputs.
export function ffmpegEnvironment(executable: string, env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const result = Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const keys = process.platform === 'win32' ? Object.keys(result).filter(key => /^path$/i.test(key)) : ['PATH'];
  const inherited = keys.map(key => result[key]).find(value => value !== undefined) ?? '';
  for (const key of keys) delete result[key];
  const directory = dirname(executable);
  result.PATH = [directory, ...inherited.split(delimiter).filter(path => path && path !== directory)].join(delimiter);
  result.ASTRA_STUDIO_FFMPEG = executable;
  return result;
}
