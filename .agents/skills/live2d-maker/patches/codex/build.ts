import { createHash } from 'node:crypto';
import { createRequire, findPackageJSON } from 'node:module';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import lockfile from 'proper-lockfile';
import { workflowsDirectory } from '../../shared/paths.ts';
import { MissingDependencyError } from '../../shared/missing-dependency.ts';
import { runCommand, watchOutput, type Command } from './process.ts';
import { withRust } from './rust.ts';
import type { PreparationProgress, ReportPreparation } from '../../shared/preparation-progress.ts';

export const codexCommit = '29eb79e9866b3262a777fdf8195c1b9e63684c91';
// building: called once before waiting for or running a build, which can take many minutes.
type Options = { source?: string; jobs?: number; root?: string; env?: NodeJS.ProcessEnv; progress?: (message: string) => void; building?: () => void; report?: ReportPreparation };
type Services = { run?: Command; rust?: typeof withRust; companion?: () => string; platform?: NodeJS.Platform };

// Missing C/C++ build tools: the user installs them and continues the task, which checks again and builds.
export class MissingToolchainError extends MissingDependencyError {
  constructor(found: string, platform: NodeJS.Platform, log?: string) {
    super(`缺少 C/C++ 编译工具链（${found}），无法构建 Codex 补丁。`, toolchainHints[platform] ?? toolchainHints.linux!, log ? `构建日志：${log}` : '');
    this.name = 'MissingToolchainError';
  }
}
const toolchainHints: Partial<Record<NodeJS.Platform, string>> = {
  linux: '请安装：Debian/Ubuntu 运行 sudo apt install build-essential；Fedora/RHEL 运行 sudo dnf install gcc gcc-c++ make；Arch 运行 sudo pacman -S base-devel。',
  darwin: '请在终端运行 xcode-select --install 安装 Xcode Command Line Tools。',
  win32: '请安装 Visual Studio Build Tools 2022，并勾选「使用 C++ 的桌面开发」（含 MSVC 与 Windows SDK）。',
};
// Linker and cc-crate failures that mean the tools are absent, not that the code failed to compile.
const missingToolText = /linker `[^`]+` not found|failed to find tool\. Is `[^`]+` installed|(?:cc|c\+\+|gcc|g\+\+|clang)(?:\.exe)?: (?:command )?not found|link\.exe` not found|could not find (?:native static library|`?link\.exe)|Microsoft C\+\+ Build Tools|xcrun: error: invalid active developer path/i;

async function missingToolchain(run: Command, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<string | undefined> {
  const works = (command: string, args: string[]) => run(command, args, { env }).then(() => true, () => false);
  if (platform === 'win32') {
    // Cargo finds MSVC through the Visual Studio installer even when cl.exe is not on PATH.
    const vswhere = join(env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
    const installed = await run(vswhere, ['-latest', '-prerelease', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { env })
      .then(path => !!path.trim(), () => false);
    return installed || await works('cl', []) ? undefined : '未找到 MSVC（cl.exe）';
  }
  const missing = [];
  for (const [variable, fallback] of [['CC', 'cc'], ['CXX', 'c++']] as const) {
    const command = env[variable]?.trim() || fallback;
    if (!await works(command, ['--version'])) missing.push(env[variable]?.trim() ? `${variable}=${command}` : command);
  }
  return missing.length ? `未找到 ${missing.join('、')}` : undefined;
}
// Reads only what this build appended, so an earlier failure in the same log is not reported again.
async function missingToolInLog(log: string, start: number): Promise<string | undefined> {
  const added = (await readFile(log).catch(() => Buffer.alloc(0))).subarray(start);
  return added.subarray(-256 * 1024).toString('utf8').match(missingToolText)?.[0];
}
const platforms: Record<string, string> = { 'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl',
  'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin', 'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc' };
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const compilers: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'Windows 需要安装 Visual Studio Build Tools 并勾选「使用 C++ 的桌面开发」（MSVC 与 Windows SDK），装好后续跑；路径过长时可把项目放到更短的目录',
  darwin: 'macOS 需要 Xcode 命令行工具（xcode-select --install）',
  linux: 'Linux 需要 gcc 或 clang 等 C/C++ 编译工具' };
// The build must not depend on the user's git setup. These settings decide what lands on disk, so they are
// pinned for our git commands only (GIT_CONFIG_COUNT, git 2.31+; no config file is written): LF as committed,
// which the patch and the sources compiled into the binary expect, whatever autocrlf, eol or a global
// attributes file say; and paths past Windows' 260 characters, since Codex nests deep. Proxy, certificate and
// credential settings stay the user's, because the network may need them. A dead connection (below 1 KB/s
// for 10 minutes) ends a clone instead of hanging.
export const gitSettings: [string, string][] = [['core.autocrlf', 'false'], ['core.eol', 'lf'], ['core.safecrlf', 'false'],
  ['core.attributesFile', ''], ['core.longpaths', 'true'], ['http.lowSpeedLimit', '1000'], ['http.lowSpeedTime', '600']];
export function pinnedGit(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const start = Number.parseInt(env.GIT_CONFIG_COUNT ?? '', 10) || 0;
  const pinned: NodeJS.ProcessEnv = { ...env, GIT_CONFIG_COUNT: String(start + gitSettings.length) };
  gitSettings.forEach(([key, value], index) => { pinned[`GIT_CONFIG_KEY_${start + index}`] = key; pinned[`GIT_CONFIG_VALUE_${start + index}`] = value; });
  return pinned;
}
const sdkPackage = '@openai/codex-sdk';
async function packageVersion(path: string): Promise<string> {
  return JSON.parse(await readFile(path, 'utf8')).version;
}

async function companion(version: string): Promise<string> {
  const platform = `${process.platform}-${process.arch}`, triple = platforms[platform];
  if (!triple) throw new Error(`未支持的 SDK 平台：${platform}`);
  const sdkRequire = createRequire(import.meta.resolve(sdkPackage));
  const manifest = sdkRequire.resolve(`@openai/codex-${platform}/package.json`);
  const installed = await packageVersion(manifest);
  if (installed !== `${version}-${platform}`) {
    throw new Error(`Codex 平台包需要 ${version}-${platform}，已安装 ${installed}。请在 skill 目录运行 pnpm install --frozen-lockfile。`);
  }
  return join(dirname(manifest), 'vendor', triple, 'bin', process.platform === 'win32' ? 'codex-code-mode-host.exe' : 'codex-code-mode-host');
}

async function removePreviousBuilds(directory: string, key: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === key || !/^[a-f0-9]{20}$/.test(entry.name)) continue;
    const previous = join(directory, entry.name);
    try {
      // Older installations locked each build separately.
      const release = await lockfile.lock(previous, { realpath: false, stale: 30_000 });
      try { await rm(previous, { recursive: true, force: true, maxRetries: 3 }); }
      finally { await release(); }
    } catch (error) {
      throw new Error(`无法移除旧版 Codex 缓存（${previous}）：${(error as Error).message}`, { cause: error });
    }
  }
}

export async function ensurePatchedCodex(options: Options = {}, services: Services = {}): Promise<string> {
  const jobs = options.jobs ?? 4;
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('--jobs 必须为正整数');
  const manifest = JSON.parse(await readFile(join(workflowsDirectory, 'package.json'), 'utf8'));
  const version = manifest.dependencies?.[sdkPackage];
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
    throw new Error(`${sdkPackage} 必须在 package.json 中固定为具体版本。`);
  }
  const sdkManifest = findPackageJSON(sdkPackage, import.meta.url);
  const installed = sdkManifest ? await packageVersion(sdkManifest) : '未安装';
  if (installed !== version) {
    throw new Error(`Codex SDK 需要 ${version}，已安装版本：${installed}。请在 skill 目录运行 pnpm install --frozen-lockfile。`);
  }
  const patch = join(workflowsDirectory, 'patches/codex/layering-runtime.patch'), bytes = await readFile(patch);
  const key = sha256(Buffer.concat([Buffer.from(`v2:${version}:${codexCommit}:${process.platform}:${process.arch}:`), bytes])).slice(0, 20);
  const directory = join(options.root ?? join(workflowsDirectory, 'data', 'codex'), `${process.platform}-${process.arch}`);
  const root = join(directory, key);
  const binary = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const host = process.platform === 'win32' ? 'codex-code-mode-host.exe' : 'codex-code-mode-host';
  const output = join(root, 'bin'), executable = join(output, binary), receipt = join(root, 'ready.json');
  const progress = options.progress ?? (message => console.error(message));
  const emit = (state: PreparationProgress['state'], message: string) => {
    if (options.report) options.report({ tool: 'codex', state, message });
    else progress(message);
  };
  const building = (message: string) => emit('running', message);
  const env = options.env ?? process.env, log = join(root, 'build.log');
  const run = services.run ?? runCommand, platform = services.platform ?? process.platform;
  const gitEnv = pinnedGit(env);
  async function cached() {
    try {
      const hashes = JSON.parse(await readFile(receipt, 'utf8'));
      return hashes?.version === version && hashes.binary === sha256(await readFile(executable))
        && hashes.host === sha256(await readFile(join(output, host)));
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return false; throw error; }
  }
  await mkdir(directory, { recursive: true });
  let release: (() => Promise<void>) | undefined, waiting = false, compromised: Error | undefined;
  while (!release) {
    try { release = await lockfile.lock(directory, { realpath: false, stale: 30_000, update: 5000, onCompromised(error) { compromised = error; } }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ELOCKED') throw error;
      if (!waiting) { options.building?.(); building('等待补丁版 Codex 准备完成'); waiting = true; }
      await delay(250);
    }
  }
  let workspace: string | undefined;
  const build = async () => {
    await mkdir(root, { recursive: true });
    const missing = await missingToolchain(run, env, platform);
    if (missing) throw new MissingToolchainError(missing, platform);
    const companionPath = services.companion ? services.companion() : await companion(version);
    if (!waiting) options.building?.();
    building(`正在构建 Codex ${version} 补丁，准备源码。日志：${log}`);
    const work = await mkdtemp(join(tmpdir(), 'astra-codex-'));
    workspace = work;
    const source = join(work, 'source'), target = join(work, 'target');
    const exec = (command: string, args: string[], cwd = work, watch = {}) =>
      run(command, args, { cwd, env: command === 'git' ? gitEnv : env, log, ...watch });
    const checkout = options.source ? ['--shared', resolve(options.source)]
      : ['--depth', '1', '--branch', `rust-v${version}`, 'https://github.com/openai/codex.git'];
    await exec('git', ['clone', '--progress', '--no-checkout', ...checkout, source], work, watchOutput('准备 Codex 源码', building, log));
    await exec('git', ['checkout', '--progress', '--detach', codexCommit], source, watchOutput('检出 Codex 源码', building, log));
    await exec('git', ['apply', patch], source);
    building('准备 Rust 工具链');
    await (services.rust ?? withRust)({ ...env, CARGO_HOME: join(work, 'cargo') }, async toolchain => {
      building(`编译 Codex ${version} 补丁`);
      const start = await stat(log).then(info => info.size, () => 0);
      // Cargo’s bundled Git can fail on the deeply nested V8 submodules on Windows.
      const buildEnv = platform === 'win32'
        ? pinnedGit({ ...toolchain.env, CARGO_NET_GIT_FETCH_WITH_CLI: 'true' })
        : toolchain.env;
      await run(toolchain.cargo, [...toolchain.prefix, 'build', '-p', 'codex-cli', '--bin', 'codex', '--profile', 'dev-small',
        '--jobs', String(jobs), '--target-dir', target], { cwd: join(source, 'codex-rs'), env: buildEnv, log,
        ...watchOutput('编译 Codex 补丁', building, log, { every: 30_000 }) })
        .catch(async error => {
          const found = await missingToolInLog(log, start);
          throw found ? new MissingToolchainError(`构建日志中：${found}`, platform, log) : new Error(`编译失败；${compilers[platform] ?? '需要平台 C/C++ 编译工具'}。`, { cause: error });
        });
    }, progress, { log, temporaryDirectory: work, report: options.report });
    if (compromised) throw compromised;
    const compiled = join(target, 'dev-small', binary);
    building('校验 Codex 版本和补丁能力');
    const reported = await exec(compiled, ['--version']);
    if (reported.trim() !== `codex-cli ${version}`) {
      throw new Error(`Codex 补丁应为 ${version}，实际报告：${reported || '无版本输出'}。`);
    }
    const capabilities = JSON.parse(await exec(compiled, ['debug', 'layering-capabilities']));
    if (capabilities.version !== 1 || capabilities.image_provider_version !== 2 || capabilities.image_compaction_version !== 2 || capabilities.request_compaction_version !== 1
      || capabilities.failed_error_event_version !== 1) throw new Error('新构建未通过补丁能力检查');
    if (compromised) throw compromised;
    try {
      await rm(receipt, { force: true });
      await mkdir(output, { recursive: true });
      for (const [from, name] of [[compiled, binary], [companionPath, host]]) {
        const staged = join(output, name + '.tmp'); await copyFile(from, staged); await rename(staged, join(output, name));
      }
      if (compromised) throw compromised;
      await writeFile(receipt + '.tmp', JSON.stringify({ version, binary: sha256(await readFile(executable)), host: sha256(await readFile(join(output, host))) }));
      if (compromised) throw compromised;
      await rename(receipt + '.tmp', receipt);
    } catch (error) {
      if (!compromised) await Promise.allSettled([
        rm(output, { recursive: true, force: true, maxRetries: 3 }),
        rm(receipt + '.tmp', { force: true, maxRetries: 3 }),
      ]).then(results => {
        for (const result of results) if (result.status === 'rejected') progress(`清理 Codex 未完成的成品失败：${String(result.reason)}`);
      });
      throw error;
    }
  };
  try {
    const rebuilding = !await cached();
    if (rebuilding) {
      await build().catch(error => {
        if (error instanceof MissingToolchainError) throw error;
        throw new Error(`Codex 补丁自动构建失败：${(error as Error).message}\n保留会话和产物，修复依赖后可直接续跑。日志：${log}`, { cause: error });
      });
    }
    if (compromised) throw compromised;
    await removePreviousBuilds(directory, key);
    if (rebuilding || waiting) emit('completed', `Codex ${version} 补丁已准备`);
    return executable;
  } catch (error) {
    options.report?.({ tool: 'codex', state: 'failed', message: (error as Error).message.split('\n')[0]! });
    throw error;
  } finally {
    try {
      if (workspace) await rm(workspace, { recursive: true, force: true, maxRetries: 3 }).catch(error => {
        progress(`清理 Codex 构建临时目录失败（${workspace}）：${String(error)}`);
      });
    } finally { await release(); }
  }
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { source: { type: 'string' }, jobs: { type: 'string', default: '4' }, help: { type: 'boolean' } } });
  if (values.help) console.log('pnpm build:codex [--source <已有官方 Codex Git 仓库>] [--jobs 4]\n在系统临时目录构建，成品缓存于 data/codex/。需要 Git 和平台 C/C++ 编译工具，Rust 1.95.0 按需准备。');
  else console.log(await ensurePatchedCodex({ source: values.source, jobs: Number(values.jobs) }));
}
