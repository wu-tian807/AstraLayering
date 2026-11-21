import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { downloadBytes } from './download.ts';
import { ensureUpscayl } from './upscayl.ts';

const model = 'digital-art-4x';
const modelUrl = 'https://raw.githubusercontent.com/upscayl/upscayl/4f39acfc6f88260d105920a64deff8431d5e1544/resources/models';
const modelFiles = [
  { extension: 'param', size: 30290, digest: '2b8fb6e0ae4d2d85704ca08c119a2f5ea40add4f2ecd512eb7f4cd44b6127ed4' },
  { extension: 'bin', size: 8943500, digest: 'fe01c269cfd10cdef8e018ab66ebe750cf79c7af4d1f9c16c737e1295229bacc' },
];
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

type UpscaleOptions = { signal?: AbortSignal; progress?: (message: string) => void };
export type UpscaleFactor = 2 | 3 | 4;

async function ensureModel(directory: string, { signal, progress }: UpscaleOptions) {
  await mkdir(directory, { recursive: true });
  for (const { extension, size, digest } of modelFiles) {
    const name = `${model}.${extension}`, path = join(directory, name);
    const cached = await readFile(path).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (cached && sha256(cached) === digest) continue;
    progress?.(`下载 Upscayl Digital Art 模型（${name}）`);
    const timeout = AbortSignal.timeout(300_000);
    const bytes = await downloadBytes(`${modelUrl}/${name}`, { maxBytes: size,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (sha256(bytes) !== digest) throw new Error(`Upscayl 模型 ${name} 的 SHA-256 校验失败。`);
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes, { flag: 'wx' });
      await rename(temporary, path);
    } finally { await rm(temporary, { force: true }); }
  }
}

async function runUpscayl(executable: string, input: string, output: string, jobs: string, scale: UpscaleFactor,
  { signal, progress }: UpscaleOptions) {
  signal?.throwIfAborted();
  const models = join(dirname(dirname(executable)), 'models');
  await ensureModel(models, { signal, progress });
  // Upscayl builds the model path in a fixed-length native buffer.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ['-i', input, '-o', output, '-m', 'models', '-n', model,
      '-z', '4', '-s', String(scale), '-f', 'png', '-j', jobs], { cwd: dirname(models), signal, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let tail = '', failure: Error | undefined;
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { tail = (tail + chunk).slice(-4096); });
    child.once('error', error => { failure = error; });
    child.once('close', (code, termination) => {
      if (signal?.aborted) return reject(signal.reason);
      if (failure) return reject(new Error(`Upscayl 启动失败：${failure.message}`, { cause: failure }));
      if (code === 0) return resolve();
      const detail = tail.trim().split(/[\r\n]+/).at(-1) || termination || code;
      reject(new Error(`Upscayl 超分失败：${detail}`));
    });
  });
}

export function upscaleImageDirectory(executable: string, input: string, output: string, scale: UpscaleFactor,
  options: UpscaleOptions = {}): Promise<void> {
  // Let the native CLI overlap image I/O and use up to two Vulkan compute queues.
  return runUpscayl(executable, input, output, '1:2:2', scale, options);
}

export type PngGeometry = { width: number; height: number; hasAlpha: boolean };

export async function checkUpscaledPng(output: Buffer | string, source: PngGeometry, scale: UpscaleFactor = 4) {
  const metadata = await sharp(output).metadata();
  if (metadata.format !== 'png' || metadata.width !== source.width * scale || metadata.height !== source.height * scale
    || metadata.hasAlpha !== source.hasAlpha) throw new Error('Upscayl 未交付预期尺寸和透明通道的 PNG。');
  return metadata;
}

export async function upscaleReferenceImage(bytes: Buffer, options: UpscaleOptions = {}): Promise<Buffer> {
  options.signal?.throwIfAborted();
  const scratch = await mkdtemp(join(tmpdir(), 'astra-upscale-'));
  try {
    const input = join(scratch, 'input.png'), output = join(scratch, 'output.png');
    const source = await sharp(bytes).metadata();
    await writeFile(input, bytes);
    options.progress?.(`Upscayl 超分参考图（${source.width} × ${source.height}）`);
    const executable = await ensureUpscayl({ signal: options.signal });
    await runUpscayl(executable, input, output, '1:1:1', 4, options);
    const result = await readFile(output);
    await checkUpscaledPng(result, source);
    return result;
  } finally { await rm(scratch, { recursive: true, force: true, maxRetries: 3 }); }
}
