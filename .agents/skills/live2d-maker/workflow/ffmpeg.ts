import { checkFFmpeg, type FFmpegCheck, type FFmpegInstallation } from '../shared/ffmpeg.ts';
import { directoryFor, readRun, selectedSections, taskRoute, taskFFmpeg, type TaskOptions, type TaskRun } from './state.ts';

export class FFmpegUnavailable extends Error {
  readonly reason: string; readonly path?: string;
  constructor(reason: string, path?: string, options?: ErrorOptions) {
    super(reason + '\n请用 --ffmpeg <FFmpeg 可执行文件路径> 重新指定。', options);
    this.reason = reason; this.path = path;
  }
}

export async function requireFFmpeg(run: Pick<TaskRun, 'from' | 'to' | 'ffmpeg'>, check: FFmpegCheck = checkFFmpeg): Promise<FFmpegInstallation | undefined> {
  if (!selectedSections(run.from, run.to).includes('nine-axis')) return;
  if (!run.ffmpeg) throw new FFmpegUnavailable('本次路线包含九轴，但没有配置 FFmpeg 路径。');
  try { return await check(run.ffmpeg); }
  catch (error) { throw new FFmpegUnavailable(`本次九轴的 FFmpeg 不可用：${run.ffmpeg}\n${(error as Error).message}`, run.ffmpeg, { cause: error }); }
}

export async function preflightFFmpeg(options: TaskOptions, check: FFmpegCheck = checkFFmpeg): Promise<FFmpegInstallation | undefined> {
  const saved = await readRun(directoryFor(options));
  if (saved?.archive) return;
  return requireFFmpeg({ ...taskRoute(options, saved), ffmpeg: taskFFmpeg(options, saved) }, check);
}
