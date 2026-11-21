import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, parse } from 'node:path';
import sharp from 'sharp';
import { textResult, type FunctionTool } from '../../codex/function-tools.ts';
import { toolDefinition } from '../../codex/tool-config.ts';
import { writeAtomic } from '../../part/groups.ts';
import { canonicalPath } from '../../raster/run-store.ts';
import { imagePath } from '../../task-paths.ts';
import { checkUpscaledPng, upscaleImageDirectory, type PngGeometry } from '../../upscale-image.ts';

type Job = { input_path: string; output_path: string };
type Result = Job & ({ status: 'upscaled'; width: number; height: number }
  | { status: 'failed'; error: string });

const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const extension = (path: string) => extname(path).toLowerCase();
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
async function pathKey(path: string) {
  const canonical = await canonicalPath(path);
  return process.platform === 'win32' || process.platform === 'darwin' ? canonical.toLowerCase() : canonical;
}

const scales = { '2x': 2, '3x': 3, '4x': 4 } as const;

function batchArguments(value: unknown) {
  const args = value as { items?: unknown[]; scale?: keyof typeof scales } | null;
  if (!args || !Array.isArray(args.items) || !args.items.length || Object.keys(args).some(key => key !== 'items' && key !== 'scale')) {
    throw new Error('请提供 scale 和至少一组输入、输出路径 items。');
  }
  if (typeof args.scale !== 'string' || !Object.hasOwn(scales, args.scale)) {
    throw new Error('scale 必须是 2x、3x 或 4x。');
  }
  return { items: args.items, scale: scales[args.scale] };
}

async function planJobs(items: unknown[]): Promise<Job[]> {
  const jobs: Job[] = [];
  for (const item of items) {
    const args = item as Partial<Job> | null;
    if (!args || typeof args.input_path !== 'string' || typeof args.output_path !== 'string'
      || Object.keys(args).some(key => key !== 'input_path' && key !== 'output_path')) {
      throw new Error('每组需要 input_path 与 output_path。');
    }
    const input = imagePath(args.input_path, 'input_path');
    const output = imagePath(args.output_path, 'output_path');
    const source = await stat(input).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (source?.isDirectory()) {
      if (await pathKey(input) === await pathKey(output)) throw new Error('输入和输出目录必须分开。');
      const images = (await readdir(input, { withFileTypes: true }))
        .filter(entry => entry.isFile() && extensions.has(extension(entry.name))).map(entry => entry.name).sort();
      if (!images.length) throw new Error(`目录内没有可处理的图片：${input}`);
      for (const name of images) jobs.push({ input_path: join(input, name), output_path: join(output, parse(name).name + '.png') });
    } else {
      if (!extensions.has(extension(input)) || extension(output) !== '.png') {
        throw new Error('单文件映射需要 PNG、JPEG 或 WebP 输入，并指定 PNG 输出路径。');
      }
      jobs.push({ input_path: input, output_path: output });
    }
  }
  const inputs = new Set(await Promise.all(jobs.map(({ input_path }) => pathKey(input_path))));
  const outputs = new Set<string>();
  for (const { output_path } of jobs) {
    const key = await pathKey(output_path);
    if (inputs.has(key) || outputs.has(key)) throw new Error(`输出路径与输入或另一张输出冲突：${output_path}`);
    outputs.add(key);
  }
  return jobs;
}

export function createUpscaleImageTool(runBatch = upscaleImageDirectory): FunctionTool {
  return {
    ...toolDefinition('upscale_image'),
    async execute(value, signal) {
      signal.throwIfAborted();
      const { items, scale } = batchArguments(value);
      const jobs = await planJobs(items);
      const scratch = await mkdtemp(join(tmpdir(), 'astra-upscale-'));
      try {
        const inputs = join(scratch, 'input'), outputs = join(scratch, 'output');
        await Promise.all([mkdir(inputs), mkdir(outputs)]);
        const results: Result[] = [];
        const staged: { index: number; name: string; source: PngGeometry }[] = [];
        const fail = (index: number, error: unknown) => {
          signal.throwIfAborted();
          results[index] = { ...jobs[index], status: 'failed', error: errorMessage(error) };
        };
        for (const [index, job] of jobs.entries()) {
          signal.throwIfAborted();
          try {
            const name = `${index}.png`;
            // Stage ordinary RGB/RGBA PNGs for both WIC on Windows and stb on macOS.
            const { data, info } = await sharp(job.input_path).autoOrient().toColourspace('srgb')
              .png({ compressionLevel: 1 }).toBuffer({ resolveWithObject: true });
            const { width, height, channels } = info;
            await writeFile(join(inputs, name), data);
            staged.push({ index, name, source: { width, height, hasAlpha: channels === 4 } });
          } catch (error) { fail(index, error); }
        }
        let batchError: unknown;
        if (staged.length) {
          try { await runBatch(inputs, outputs, scale, { signal }); }
          catch (error) { signal.throwIfAborted(); batchError = error; }
        }
        for (const { index, name, source } of staged) {
          signal.throwIfAborted();
          const job = jobs[index];
          try {
            const data = await readFile(join(outputs, name)).catch(error => { throw batchError ?? error; });
            const { width, height } = await checkUpscaledPng(data, source, scale);
            await writeAtomic(job.output_path, data);
            results[index] = { ...job, status: 'upscaled', width, height };
          } catch (error) { fail(index, error); }
        }
        return { ...textResult({ results }), success: results.some(result => result.status !== 'failed') };
      } finally { await rm(scratch, { recursive: true, force: true, maxRetries: 3 }); }
    },
  };
}
