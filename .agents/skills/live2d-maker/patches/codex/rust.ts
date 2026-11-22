import { createHash } from 'node:crypto';
import { chmod, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCommand, watchOutput, type Command } from './process.ts';
import { downloadBytes } from '../../shared/download.ts';
import type { PreparationProgress, ReportPreparation } from '../../shared/preparation-progress.ts';

export const rustVersion = '1.95.0';
export type RustToolchain = { cargo: string; prefix: string[]; env: NodeJS.ProcessEnv };
type Services = { run?: Command; download?: (url: string) => Promise<Buffer>; temporaryDirectory: string; log?: string;
  platform?: NodeJS.Platform; arch?: string; report?: ReportPreparation };
const hosts: Record<string, string> = { 'darwin-arm64': 'aarch64-apple-darwin', 'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu', 'linux-arm64': 'aarch64-unknown-linux-gnu',
  'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc' };

// Isolated toolchains live in the build directory, which Codex cleans after success.
export async function withRust<T>(env: NodeJS.ProcessEnv, action: (toolchain: RustToolchain) => Promise<T>,
  progress: (message: string) => void, services: Services): Promise<T> {
  const run = services.run ?? runCommand;
  const pinned = [`+${rustVersion}`];
  const matches = (cargo: string, prefix: string[], env: NodeJS.ProcessEnv) =>
    run(cargo, [...prefix, '--version'], { env: { ...env, RUSTUP_AUTO_INSTALL: '0' } })
      .then(version => version.startsWith(`cargo ${rustVersion} `), () => false);
  for (const prefix of [pinned, []]) {
    if (await matches('cargo', prefix, env)) return action({ cargo: 'cargo', prefix, env });
  }
  const platform = services.platform ?? process.platform, arch = services.arch ?? process.arch;
  const host = hosts[`${platform}-${arch}`];
  if (!host) throw new Error(`无法自动安装 Rust：不支持 ${platform}-${arch}`);
  const emit = (state: PreparationProgress['state'], message: string, bytes?: PreparationProgress['bytes']) => {
    if (services.report) services.report({ tool: 'rust', state, message, bytes });
    else progress(message);
  };
  const root = services.temporaryDirectory, suffix = platform === 'win32' ? '.exe' : '';
  const rustEnv = { ...env, RUSTUP_HOME: join(root, 'rustup'), CARGO_HOME: join(root, 'cargo'), RUSTUP_INIT_SKIP_PATH_CHECK: 'yes' };
  const cargo = join(root, 'cargo/bin/cargo' + suffix);
  try {
    if (!await matches(cargo, pinned, rustEnv)) {
      const installer = join(root, 'rustup-init' + suffix);
      if (!await stat(installer).then(info => info.isFile(), () => false)) {
        const url = `https://static.rust-lang.org/rustup/dist/${host}/rustup-init${suffix}`;
        const bytes = await (services.download?.(url) ?? downloadBytes(url, { idleTimeoutMs: 60_000,
          progress: sizes => emit('running', '下载 Rust 安装器', sizes) }));
        const checksumFile = await (services.download?.(url + '.sha256') ?? downloadBytes(url + '.sha256', { signal: AbortSignal.timeout(120_000) }));
        const checksum = checksumFile.toString('utf8').trim().split(/\s+/)[0];
        if (!/^[a-f0-9]{64}$/.test(checksum) || createHash('sha256').update(bytes).digest('hex') !== checksum) throw new Error('Rust 安装文件 SHA-256 校验失败');
        const staged = installer + '.tmp';
        await writeFile(staged, bytes, { mode: 0o700 });
        await chmod(staged, 0o700);
        await rename(staged, installer);
      }
      const log = services.log ?? join(root, 'install.log');
      const start = await stat(log).then(info => info.size, () => 0);
      emit('running', `安装临时 Rust ${rustVersion}`);
      await run(installer, ['-y', '--no-modify-path', '--profile', 'minimal', '--default-toolchain', rustVersion],
        { env: { ...rustEnv, RUSTUP_TERM_PROGRESS_WHEN: 'always' }, log,
          line: watchOutput('安装临时 Rust', message => emit('running', message)) }).catch(async error => {
          const output = await readFile(log).catch(() => Buffer.alloc(0));
          const detail = output.subarray(Math.max(start, output.length - 8000)).toString('utf8').trim();
          throw new Error(`临时 Rust 安装失败。${detail ? '\n' + detail : ''}`, { cause: error });
        });
      if (!await matches(cargo, pinned, rustEnv)) throw new Error(`临时 Rust 安装后找不到 Cargo ${rustVersion}。`);
    }
    emit('completed', `临时 Rust ${rustVersion} 已准备`);
  } catch (error) {
    emit('failed', (error as Error).message.split('\n')[0]!);
    throw error;
  }
  return action({ cargo, prefix: pinned, env: rustEnv });
}
