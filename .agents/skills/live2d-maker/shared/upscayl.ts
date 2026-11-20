import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { unzipSync } from 'fflate';
import lockfile from 'proper-lockfile';
import { workflowsDirectory } from './paths.ts';
import { downloadBytes } from './download.ts';
import type { PreparationProgress, ReportPreparation } from './preparation-progress.ts';

const version = '20251207-174704';
type Asset = {
  platform: string; binary: string; bytes: number; digest: string;
  runtime?: { file: string; url: string; bytes: number; digest: string };
};
const macOS = { platform: 'macos', binary: 'upscayl-bin', bytes: 9338240,
  digest: '277419791281a56eae0c739c70120b974d7267cf7c2de8e86dc09798d4b314db' };
const releases: Record<string, Asset> = {
  'darwin-arm64': macOS,
  'darwin-x64': macOS,
  'win32-x64': { platform: 'windows', binary: 'upscayl-bin.exe', bytes: 2421760,
    digest: '1f0f65c5d2ade866555e2ac467d35952c35a47080a4060fe56a1ab028f67258a',
    // The CLI ZIP imports VCOMP140.DLL. Use the same DLL as the official desktop build.
    runtime: { file: 'vcomp140.dll', bytes: 196688, digest: 'd49b394de1154176b39611c37c669ebff50aa5a818dbd5ff3d2214a299368ddd',
      url: 'https://raw.githubusercontent.com/upscayl/upscayl/4f39acfc6f88260d105920a64deff8431d5e1544/resources/win/bin/vcomp140.dll' } },
};
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

type InstallOptions = {
  signal?: AbortSignal;
  preparing?: () => void;
  report?: ReportPreparation;
};
type InstallServices = { root?: string; platform?: string; asset?: Asset; download?: typeof downloadBytes };

export async function ensureUpscayl({ signal, preparing, report }: InstallOptions = {}, {
  root = join(workflowsDirectory, 'data', 'upscayl'), platform = `${process.platform}-${process.arch}`,
  asset = releases[platform], download = downloadBytes,
}: InstallServices = {}): Promise<string> {
  const emit = (state: PreparationProgress['state'], message: string, bytes?: PreparationProgress['bytes']) =>
    report?.({ tool: 'upscayl', state, message, bytes });
  let unlock: (() => Promise<void>) | undefined, waiting = false, compromised: Error | undefined;
  const directory = join(root, platform), pending = directory + '.tmp';
  try {
    if (!asset) throw new Error(`当前平台 ${platform} 暂不支持超分，请选择 1K。`);
    const executable = join(directory, asset.binary);
    await mkdir(root, { recursive: true });
    while (!unlock) {
      signal?.throwIfAborted();
      try {
        unlock = await lockfile.lock(directory, { realpath: false, stale: 30_000, update: 5000,
          onCompromised(error) { compromised = error; } });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ELOCKED') throw error;
        if (!waiting) { preparing?.(); emit('running', '等待其他任务准备 Upscayl'); waiting = true; }
        await delay(250, undefined, { signal });
      }
    }
    await rm(pending, { recursive: true, force: true, maxRetries: 3 });
    const receipt = await readFile(join(directory, 'ready.json'), 'utf8').then(text => JSON.parse(text), () => undefined).catch(() => undefined);
    const cachedHash = async (path: string) => readFile(path).then(sha256, () => undefined);
    if (receipt?.archive === asset.digest && typeof receipt.binary === 'string' && receipt.binary === await cachedHash(executable)) {
      if (!asset.runtime || asset.runtime.digest === await cachedHash(join(directory, asset.runtime.file))) {
        if (waiting) emit('completed', 'Upscayl 已准备');
        return executable;
      }
    }
    if (!waiting) preparing?.();
    const name = `upscayl-bin-${version}-${asset.platform}`;
    const fetchVerified = async (label: string, url: string, total: number, digest: string) => {
      const reportDownload = (received: number) => emit('running', `下载 ${label}`, { received, total });
      reportDownload(0);
      const timeout = AbortSignal.timeout(300_000);
      const payload = await download(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        maxBytes: total, progress: ({ received }) => reportDownload(received) });
      if (sha256(payload) !== digest) throw new Error(`${label} 下载文件的 SHA-256 与发布版本不符。`);
      return payload;
    };
    const archive = await fetchVerified('Upscayl', `https://github.com/upscayl/upscayl-ncnn/releases/download/${version}/${name}.zip`, asset.bytes, asset.digest);
    const runtime = asset.runtime && await fetchVerified('Upscayl Windows 运行库', asset.runtime.url, asset.runtime.bytes, asset.runtime.digest);
    signal?.throwIfAborted();
    emit('running', '解包并校验 Upscayl 成品');
    const names = [asset.binary, 'LICENSE', 'README.md'];
    const files = unzipSync(archive, { filter: ({ name: entry }) => names.some(file => entry === `${name}/${file}`) });
    await mkdir(pending, { recursive: true });
    for (const file of names) {
      const contents = files[`${name}/${file}`];
      if (!contents?.length) throw new Error(`Upscayl 下载包缺少 ${file}。`);
      await writeFile(join(pending, file), contents, { mode: file === asset.binary ? 0o755 : 0o644 });
    }
    if (asset.runtime && runtime) await writeFile(join(pending, asset.runtime.file), runtime, { mode: 0o644 });
    await writeFile(join(pending, 'ready.json'), JSON.stringify({ version, archive: asset.digest, binary: sha256(files[`${name}/${asset.binary}`]!) }));
    if (compromised) throw compromised;
    signal?.throwIfAborted();
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    await rename(pending, directory);
    emit('completed', 'Upscayl 已准备');
    return executable;
  } catch (error) {
    if (!signal?.aborted) emit('failed', (error as Error).message);
    throw error;
  } finally {
    if (unlock) {
      try { if (!compromised) await rm(pending, { recursive: true, force: true, maxRetries: 3 }); }
      finally { await unlock(); }
    }
  }
}
