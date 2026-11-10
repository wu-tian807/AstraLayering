import { basename, dirname, join } from 'node:path';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { textResult } from '../shared/codex/function-tools.ts';
import { fromTaskPath } from '../shared/task-paths.ts';
import { extractVideoFrame, normalizeView } from './turn.ts';
import { mkdir, writeFile } from 'node:fs/promises';

export function createFrameTool(options: { ffmpeg: string; taskRoot: string; directory: string; videos: string; names: readonly string[]; size: number }): FunctionTool {
  return {
    ...toolDefinition('extract_video_frame'),
    async execute(value, signal) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('抽帧参数须为对象');
      const args = value as { video?: unknown; output?: unknown; frameIndex?: unknown; timeSeconds?: unknown };
      if (typeof args.video !== 'string' || !options.names.includes(args.video)) throw new Error('video 须为本步骤的视频方向');
      if (typeof args.output !== 'string' || !args.output.endsWith('.png')) throw new Error('output 须为 PNG 路径');
      const output = fromTaskPath(options.taskRoot, args.output);
      const index = args.frameIndex, time = args.timeSeconds;
      if ((index === undefined) === (time === undefined)
        || (index !== undefined && (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0))
        || (time !== undefined && (typeof time !== 'number' || !Number.isFinite(time) || time < 0))) throw new Error('提供非负 frameIndex 或 timeSeconds，两者只选一个');
      signal.throwIfAborted();
      const video = join(options.videos, `${args.video}.mp4`), rawFrame = join(options.directory, 'frames', basename(output));
      const position = index !== undefined ? { frameIndex: index as number } : { timeSeconds: time as number };
      await extractVideoFrame(options.ffmpeg, video, rawFrame, position, signal);
      const bytes = await normalizeView(rawFrame, options.size);
      signal.throwIfAborted();
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bytes);
      return textResult(JSON.stringify({ video, path: output, rawFrame, ...position, size: options.size }));
    },
  };
}
