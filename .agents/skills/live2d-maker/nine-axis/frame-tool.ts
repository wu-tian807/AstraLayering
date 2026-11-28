import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { textResult } from '../shared/codex/function-tools.ts';
import { fromTaskPath } from '../shared/task-paths.ts';
import { extractVideoFrame, frameOverlay, normalizeView, translateFrame } from './turn.ts';
import { mkdir, writeFile } from 'node:fs/promises';

export function createFrameTool(options: { ffmpeg: string; taskRoot: string; directory: string; videos: string; names: readonly string[]; size: number }): FunctionTool {
  const pngPath = (value: unknown, name: string) => {
    if (typeof value !== 'string' || !/\.png$/i.test(value)) throw Error(name + ' 须为 PNG 路径');
    const path = fromTaskPath(options.taskRoot, value), local = relative(options.directory, path);
    if (!local || isAbsolute(local) || local === '..' || local.startsWith('..' + sep) || local.split(sep)[0].toLowerCase() === 'frames')
      throw Error(name + ' 须位于本选帧步骤内，frames/ 保留给原始帧');
    return path;
  };
  const offset = (value: unknown, name: string) => {
    if (value === undefined) return 0;
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw Error(name + ' 须为整数像素');
    return value;
  };
  return {
    ...toolDefinition('extract_video_frame'),
    async execute(value, signal) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('抽帧参数须为对象');
      const args = value as { video?: unknown; output?: unknown; frameIndex?: unknown; timeSeconds?: unknown;
        offsetX?: unknown; offsetY?: unknown; overlay?: unknown };
      if (typeof args.video !== 'string' || !options.names.includes(args.video)) throw new Error('video 须为本步骤的视频方向');
      const output = pngPath(args.output, 'output'), overlay = args.overlay === undefined ? undefined : pngPath(args.overlay, 'overlay');
      if (overlay && relative(output, overlay) === '') throw Error('overlay 须与 output 使用不同路径');
      const offsetX = offset(args.offsetX, 'offsetX'), offsetY = offset(args.offsetY, 'offsetY');
      const index = args.frameIndex, time = args.timeSeconds;
      if ((index === undefined) === (time === undefined)
        || (index !== undefined && (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0))
        || (time !== undefined && (typeof time !== 'number' || !Number.isFinite(time) || time < 0))) throw new Error('提供非负 frameIndex 或 timeSeconds，两者只选一个');
      signal.throwIfAborted();
      const video = join(options.videos, `${args.video}.mp4`), rawFrame = join(options.directory, 'frames', basename(output));
      const position = index !== undefined ? { frameIndex: index as number } : { timeSeconds: time as number };
      await extractVideoFrame(options.ffmpeg, video, rawFrame, position, signal);
      const bytes = await translateFrame(await normalizeView(rawFrame, options.size), offsetX, offsetY);
      const comparison = overlay ? await frameOverlay(bytes, options.taskRoot, options.size) : undefined;
      signal.throwIfAborted();
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bytes);
      if (overlay && comparison) {
        await mkdir(dirname(overlay), { recursive: true });
        await writeFile(overlay, comparison);
      }
      return textResult({ video, path: output, rawFrame, ...position, size: options.size, offsetX, offsetY, ...(overlay ? { overlay } : {}) });
    },
  };
}
