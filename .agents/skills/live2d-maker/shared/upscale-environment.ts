import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { release } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { SectionSize } from './section-size.ts';

type UpscaleEnvironment = { supported: true } | { supported: false; reason: string };
export type UpscaleEnvironmentCheck = () => Promise<UpscaleEnvironment>;
const run = promisify(execFile);

async function hasMetal(): Promise<boolean> {
  const { stdout } = await run('/usr/sbin/system_profiler', ['SPDisplaysDataType', '-json', '-detailLevel', 'mini'], { timeout: 8_000 });
  const devices = JSON.parse(stdout).SPDisplaysDataType;
  return Array.isArray(devices) && devices.some(device =>
    /^spdisplays_(?:metal\d*(?:_supported)?|supported)$/.test(device.spdisplays_mtlgpufamilysupport ?? device.spdisplays_metal ?? ''));
}

async function hasVulkan(): Promise<boolean> {
  const powershell = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = await readFile(new URL('./upscale-vulkan.ps1', import.meta.url), 'utf8');
  const { stdout } = await run(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { timeout: 12_000, windowsHide: true });
  return stdout.trim() === 'True';
}

export async function probeUpscaleEnvironment(): Promise<UpscaleEnvironment> {
  const kernelMajor = Number.parseInt(release(), 10);
  try {
    if (process.platform === 'darwin') {
      // Darwin 21 is macOS 12.
      if (kernelMajor < 21) return { supported: false, reason: '超分需要 macOS 12 或更新版本。' };
      return await hasMetal() ? { supported: true } : { supported: false, reason: '未检测到支持 Metal 的显卡。' };
    }
    if (process.platform === 'win32') {
      if (kernelMajor < 10) return { supported: false, reason: '超分需要 Windows 10 或更新版本。' };
      if (process.arch !== 'x64') return { supported: false, reason: 'Windows 超分暂支持 x64 环境。' };
      return await hasVulkan() ? { supported: true } : { supported: false, reason: '未检测到可用于 Vulkan 计算的显卡和驱动。' };
    }
    return { supported: false, reason: '当前平台暂不支持超分。' };
  } catch {
    return { supported: false, reason: '无法确认显卡环境。' };
  }
}

export function createUpscaleEnvironmentCheck(probe = probeUpscaleEnvironment) {
  let cached: { expires: number; result: ReturnType<typeof probe> } | undefined;
  return () => {
    if (!cached || cached.expires <= Date.now()) cached = { expires: Date.now() + 60_000, result: probe() };
    return cached.result;
  };
}

export async function resolveUpscaleSize(size: SectionSize, check: UpscaleEnvironmentCheck = probeUpscaleEnvironment,
  progress?: (message: string) => void): Promise<SectionSize> {
  if (size === '1K') return size;
  const environment = await check();
  if (environment.supported) return size;
  progress?.(`超分档位 ${size} 已调整为 1K。原因：${environment.reason}`);
  return '1K';
}
