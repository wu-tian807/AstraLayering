import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand, watchOutput, type Command } from './process.ts';
import { downloadBytes } from '../../shared/download.ts';
import type { PreparationProgress, ReportPreparation } from '../../shared/preparation-progress.ts';

export const rustVersion = '1.95.0';
export type RustToolchain = { cargo: string; prefix: string[]; env: NodeJS.ProcessEnv };
type Services = { run?: Command; download?: (url: string) => Promise<Buffer>; temporaryDirectory?: string; log?: string;
  platform?: NodeJS.Platform; arch?: string; report?: ReportPreparation };
const hosts: Record<string, string> = { 'darwin-arm64': 'aarch64-apple-darwin', 'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu', 'linux-arm64': 'aarch64-unknown-linux-gnu',
  'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc' };

// Only an enabled feature reaches here. Nothing is installed into the user's
// Cargo/Rustup home, and the temporary compiler is removed even after failure.
export async function withRust<T>(env: NodeJS.ProcessEnv, action: (toolchain: RustToolchain) => Promise<T>,
  progress: (message: string) => void, services: Services = {}): Promise<T> {
  const run = services.run ?? runCommand;
  for (const prefix of [[`+${rustVersion}`], []]) {
    try {
      const version = await run('cargo', [...prefix, '--version'], { env: {...env, RUSTUP_AUTO_INSTALL: '0'} });
      if (!version.startsWith(`cargo ${rustVersion} `)) continue;
    } catch { continue; }
    return action({ cargo: 'cargo', prefix, env });
  }
  const platform = services.platform ?? process.platform, arch = services.arch ?? process.arch;
  const host = hosts[`${platform}-${arch}`];
  if (!host) throw new Error(`无法自动安装 Rust：不支持 ${platform}-${arch}`);
  const emit = (state: PreparationProgress['state'], message: string, bytes?: PreparationProgress['bytes']) => {
    if (services.report) services.report({ tool: 'rust', state, message, bytes });
    else progress(message);
  };
  const root = await mkdtemp(join(services.temporaryDirectory ?? tmpdir(), 'rs-'));
  let installed = false;
  try {
    emit('running', `Codex 补丁需要 Rust ${rustVersion}，当前环境不可用，正在临时目录安装。`);
    const rustEnv = { ...env, RUSTUP_HOME: join(root, 'rustup'), CARGO_HOME: join(root, 'cargo'),
      RUSTUP_INIT_SKIP_PATH_CHECK: 'yes', PATH: join(root, 'cargo/bin') + (platform === 'win32' ? ';' : ':') + (env.PATH ?? '') };
    const suffix = platform === 'win32' ? '.exe' : '';
    const url = `https://static.rust-lang.org/rustup/dist/${host}/rustup-init${suffix}`;
    const bytes = await (services.download?.(url) ?? downloadBytes(url, { idleTimeoutMs: 60_000,
      progress: sizes => emit('running', '下载 Rust 安装器', sizes) }));
    const checksumFile = await (services.download?.(url + '.sha256') ?? downloadBytes(url + '.sha256', { signal: AbortSignal.timeout(120_000) }));
    const checksum = checksumFile.toString('utf8').trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{64}$/.test(checksum) || createHash('sha256').update(bytes).digest('hex') !== checksum) throw new Error('Rust 安装文件 SHA-256 校验失败');
    const installer = join(root, 'rustup-init' + suffix);
    await writeFile(installer, bytes, { mode: 0o700 }); await chmod(installer, 0o700);
    const log = services.log ?? join(root, 'install.log');
    emit('running', `安装临时 Rust ${rustVersion}`);
    await run(installer, ['-y', '--no-modify-path', '--profile', 'minimal', '--default-toolchain', rustVersion],
      { env: rustEnv, log, ...watchOutput('安装临时 Rust', message => emit('running', message), log) }).catch(async error => {
        const detail = await readFile(log, 'utf8').catch(() => '');
        throw new Error(`临时 Rust 安装失败；需要可访问官方 Rust 下载站点。${detail ? '\n' + detail.slice(-8000) : ''}`, { cause: error });
      });
    const cargo = join(root, 'cargo/bin/cargo' + suffix);
    await run(cargo, [`+${rustVersion}`, '--version'], { env: rustEnv });
    installed = true;
    emit('completed', `临时 Rust ${rustVersion} 已准备`);
    return await action({ cargo, prefix: [`+${rustVersion}`], env: rustEnv });
  } catch (error) {
    if (!installed) emit('failed', (error as Error).message.split('\n')[0]!);
    throw error;
  } finally { await rm(root, { recursive: true, force: true }); }
}
