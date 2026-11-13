import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import { ensurePatchedCodex, codexCommit, pinnedGit, MissingToolchainError } from '../../patches/codex/build.ts';
import { withRust, rustVersion } from '../../patches/codex/rust.ts';
import { runCommand, watchOutput, type Command } from '../../patches/codex/process.ts';
import { formatAgentError } from '../codex/diagnostics.ts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'patch-startup-'));
  t.after(() => rm(root, {recursive: true, force: true})); return root;
}
const capabilities = {version: 1, image_provider_version: 2, image_compaction_version: 2, request_compaction_version: 1, failed_error_event_version: 1};
test('并发自动构建只运行一次，校验缓存，损坏后重建，失败不写成功记录；构建或等待前通知调用方', async t => {
  const root = await fixture(t), sdkHost = join(root, 'sdk-host'); await writeFile(sdkHost, 'companion');
  let builds = 0, building = 0, fail = true;
  const run: Command = async (command, args) => {
    if (command === 'git') {
      if (args[0] === 'clone') await mkdir(args.at(-1)!, {recursive: true});
      if (args[0] === 'rev-parse') return codexCommit;
      if (args.includes('--reverse')) throw new Error('not applied');
    } else if (command === 'cargo') {
      builds++; await delay(350); if (fail) throw new Error('compiler fixture failure');
      const target = join(args[args.indexOf('--target-dir') + 1], 'dev-small');
      await mkdir(target, {recursive: true});
      await writeFile(join(target, process.platform === 'win32' ? 'codex.exe' : 'codex'), 'binary');
    } else return JSON.stringify(capabilities);
    return '';
  };
  const services = {run, companion: () => sdkHost,
    rust: (async (env, action) => action({cargo: 'cargo', prefix: [], env})) as typeof withRust};
  const opts = {root: join(root, 'cache'), env: {PATH: 'fixture'}, progress() {}, building() { building++; }};
  await assert.rejects(ensurePatchedCodex(opts, services), /自动构建失败/);
  const [platform] = await readdir(opts.root), [key] = await readdir(join(opts.root, platform));
  const cache = join(opts.root, platform, key);
  await assert.rejects(readFile(join(cache, 'ready.json')), {code: 'ENOENT'});
  fail = false;
  const results = await Promise.all([ensurePatchedCodex(opts, services), ensurePatchedCodex(opts, services)]);
  // The waiting call is notified too: it can take as long as the build.
  assert.equal(results[0], results[1]); assert.equal(builds, 2); assert.equal(building, 3);
  await ensurePatchedCodex(opts, services); assert.equal(builds, 2); assert.equal(building, 3);
  await writeFile(results[0], 'corrupted'); await ensurePatchedCodex(opts, services); assert.equal(builds, 3);
  assert.equal(await readFile(results[0], 'utf8'), 'binary');
  assert.equal(await readFile(join(cache, 'bin', process.platform === 'win32' ? 'codex-code-mode-host.exe' : 'codex-code-mode-host'), 'utf8'), 'companion');
});
test('源码按固定 git 设置检出，不受用户换行与长路径配置影响；无法打补丁的旧缓存重新获取一次', async t => {
  const root = await fixture(t), sdkHost = join(root, 'sdk-host'); await writeFile(sdkHost, 'companion');
  // The user's own settings lose to the pinned ones; earlier GIT_CONFIG_* entries are kept.
  const global = join(root, 'gitconfig');
  await writeFile(global, '[core]\n\tautocrlf = true\n\teol = crlf\n\tlongpaths = false\n\tattributesFile = ' + join(root, 'attrs') + '\n');
  const env = pinnedGit({...process.env, GIT_CONFIG_GLOBAL: global, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.proxy', GIT_CONFIG_VALUE_0: 'http://proxy'});
  const read = (key: string) => execFileSync('git', ['config', '--get', key], {env, encoding: 'utf8'}).trim();
  assert.deepEqual(['core.autocrlf', 'core.eol', 'core.longpaths', 'core.attributesFile', 'http.proxy'].map(read), ['false', 'lf', 'true', '', 'http://proxy']);
  const fetched: string[] = []; let checks = 0;
  const run: Command = async (command, args, options) => {
    if (command === 'git') {
      assert.equal(options.env?.GIT_CONFIG_KEY_0, 'core.autocrlf');
      if (args[0] === 'clone') { fetched.push(args.at(-1)!); await mkdir(args.at(-1)!, {recursive: true}); }
      if (args[0] === 'rev-parse') return codexCommit;
      if (args.includes('--reverse')) throw new Error('not applied');
      if (args.includes('--check') && checks++ < 2) throw new Error('patch does not apply');
    } else if (command === 'cargo') {
      const target = join(args[args.indexOf('--target-dir') + 1], 'dev-small');
      await mkdir(target, {recursive: true});
      await writeFile(join(target, process.platform === 'win32' ? 'codex.exe' : 'codex'), 'binary');
    } else return JSON.stringify(capabilities);
    return '';
  };
  const services = {run, companion: () => sdkHost, rust: (async (env, action) => action({cargo: 'cargo', prefix: [], env})) as typeof withRust};
  const opts = {root: join(root, 'cache'), env: {PATH: 'fixture'}, progress() {}};
  // A fresh checkout that rejects the patch is a real failure; its source stays, and the next run that finds it
  // unpatchable fetches it again.
  await assert.rejects(ensurePatchedCodex(opts, services), /自动构建失败/);
  assert.equal(fetched.length, 1);
  const messages: string[] = [];
  await ensurePatchedCodex({...opts, progress: message => messages.push(message)}, services);
  assert.equal(fetched.length, 2); assert.ok(messages.some(message => message.includes('重新获取')));
  await ensurePatchedCodex(opts, services); assert.equal(fetched.length, 2);
});

test('匹配 Rust 时复用；构建失败不额外下载且不改原环境', async () => {
  const env = {PATH: '/fixture', CARGO_HOME: '/user/cargo'}, before = {...env}; let downloads = 0, runs = 0;
  await assert.rejects(withRust(env, async tc => { assert.equal(tc.env, env); throw new Error('build failed'); }, () => {},
    {run: async () => {runs++; return `cargo ${rustVersion} (fixture)`;}, download: async () => {downloads++; throw new Error('unexpected');}}), /build failed/);
  assert.equal(runs, 1); assert.equal(downloads, 0); assert.deepEqual(env, before);
});
test('缺 Rust 时隔离临时安装，校验官方文件，成功失败均清理且不改原环境', async t => {
  const root = await fixture(t), env = {PATH: '/fixture', CARGO_HOME: '/user/cargo', RUSTUP_HOME: '/user/rust'};
  const before = {...env}, bytes = Buffer.from('installer-fixture'), checksum = createHash('sha256').update(bytes).digest('hex');
  for (const mode of ['success', 'install-failure', 'build-failure', 'checksum-failure']) {
    let downloads = 0, installed = false, used = false; const messages: string[] = [];
    const result = withRust(env, async tc => {
      used = true; assert.equal(installed, true); assert.ok(tc.cargo.startsWith(root));
      assert.ok(tc.env.CARGO_HOME!.startsWith(root)); assert.ok(tc.env.RUSTUP_HOME!.startsWith(root));
      if (mode === 'build-failure') throw new Error('compile failed'); return 'ok';
    }, message => messages.push(message), {temporaryDirectory: root,
      download: async url => { downloads++; assert.ok(url.startsWith('https://static.rust-lang.org/rustup/dist/'));
        return url.endsWith('.sha256') ? Buffer.from(mode === 'checksum-failure' ? 'bad checksum' : checksum) : bytes; },
      run: async (command, args, options) => {
        if (command === 'cargo') throw new Error('ENOENT');
        if (command.includes('rustup-init')) {
          assert.ok(args.includes('--no-modify-path')); assert.ok(args.includes(rustVersion)); assert.ok(options.env.CARGO_HOME!.startsWith(root));
          if (mode === 'install-failure') throw new Error('download failed'); installed = true;
        } return `cargo ${rustVersion} (fixture)`;
      }});
    if (mode === 'success') assert.equal(await result, 'ok');
    else await assert.rejects(result, mode === 'checksum-failure' ? /SHA-256/ : mode === 'install-failure' ? /临时 Rust 安装失败/ : /compile failed/);
    assert.equal(used, ['success', 'build-failure'].includes(mode)); assert.equal(downloads, 2);
    assert.match(messages[0], /当前环境不可用.*临时目录/); assert.deepEqual(await readdir(root), []); assert.deepEqual(env, before);
  }
});
test('Linux、Windows、macOS 均使用传入的系统临时根和对应官方安装器', async t => {
  const root = await fixture(t), bytes = Buffer.from('installer'), checksum = createHash('sha256').update(bytes).digest('hex');
  for (const [platform, arch, host] of [['linux', 'x64', 'x86_64-unknown-linux-gnu'], ['win32', 'x64', 'x86_64-pc-windows-msvc'], ['darwin', 'arm64', 'aarch64-apple-darwin']] as const) {
    const env = {PATH: 'original-path'}; let installed = false;
    await withRust(env, async tc => {
      assert.equal(installed, true); assert.ok(tc.cargo.startsWith(root));
      assert.equal(tc.cargo.endsWith('.exe'), platform === 'win32');
      assert.ok(tc.env.PATH!.endsWith((platform === 'win32' ? ';' : ':') + env.PATH));
      assert.ok(tc.env.RUSTUP_HOME!.startsWith(root));
    }, () => {}, {platform, arch, temporaryDirectory: root,
      download: async url => {
        assert.ok(url.includes('/' + host + '/rustup-init' + (platform === 'win32' ? '.exe' : '')));
        return url.endsWith('.sha256') ? Buffer.from(checksum) : bytes;
      }, run: async (command, args) => {
        if (command === 'cargo') throw new Error('missing');
        if (command.includes('rustup-init')) { installed = true; assert.ok(args.includes('--no-modify-path')); }
        return `cargo ${rustVersion} (fixture)`;
      }});
    assert.deepEqual(await readdir(root), []);
  }
});
test('长命令按行汇报进度，节流并统计编译数；静默时提示但不中止', async () => {
  const lines: string[] = [], warnings: number[] = [];
  const script = "process.stderr.write('Receiving 10%\\rReceiving 50%\\r'); setTimeout(() => console.log('   Compiling a v1\\n   Compiling b v1'), 400)";
  assert.equal(await runCommand(process.execPath, ['-e', script], {env: process.env, line: text => lines.push(text),
    quiet: {after: 200, notify: silent => warnings.push(silent)}}), 'Compiling a v1\n   Compiling b v1');
  assert.deepEqual(lines, ['Receiving 10%', 'Receiving 50%', 'Compiling a v1', 'Compiling b v1']);
  assert.ok(warnings.length >= 1 && warnings[0] >= 200, 'silence between the two bursts is reported');
  let clock = 0; const messages: string[] = [];
  const watch = watchOutput('编译 Codex 补丁', message => messages.push(message), '/logs/build.log', {every: 1000, now: () => clock});
  watch.line!('Updating crates.io index'); clock = 500; watch.line!('Compiling a v1'); clock = 1500; watch.line!('Compiling b v1');
  assert.deepEqual(messages, ['编译 Codex 补丁：Updating crates.io index（已用 0 秒）', '编译 Codex 补丁：已编译 2 个 crate，最近 Compiling b v1（已用 2 秒）']);
  watch.quiet!.notify(180_000);
  assert.match(messages[2], /已 3 分 0 秒没有新输出.*网络受阻.*HTTPS_PROXY.*补丁构建会复用.*\/logs\/build\.log/);
});
test('缺 C/C++ 工具链时先检查后报清楚的安装提示，不克隆；构建日志里的缺工具也同样提示；装好后继续即构建', async t => {
  const root = await fixture(t), sdkHost = join(root, 'sdk-host'); await writeFile(sdkHost, 'companion');
  let compilers = false, linker = false; const commands: string[] = [];
  const run: Command = async (command, args, options) => {
    commands.push(command);
    if (command === 'cc' || command === 'c++') { if (!compilers) throw new Error('spawn ENOENT'); return 'cc 1.0'; }
    if (command === '/opt/gcc') return 'gcc 14';
    if (command === '/opt/missing-cc') throw new Error('spawn ENOENT');
    if (command.endsWith('vswhere.exe')) { if (!compilers) throw new Error('spawn ENOENT'); return 'C:\\BuildTools'; }
    if (command === 'cl') throw new Error('spawn ENOENT');
    if (command === 'git') {
      if (args[0] === 'clone') await mkdir(args.at(-1)!, {recursive: true});
      if (args[0] === 'rev-parse') return codexCommit;
      if (args.includes('--reverse')) throw new Error('not applied');
    } else if (command === 'cargo') {
      if (!linker) { await writeFile(options.log!, 'error: linker `cc` not found\n  = note: No such file or directory', {flag: 'a'}); throw new Error('cargo 退出码 101'); }
      const target = join(args[args.indexOf('--target-dir') + 1], 'dev-small');
      await mkdir(target, {recursive: true});
      await writeFile(join(target, process.platform === 'win32' ? 'codex.exe' : 'codex'), 'binary');
    } else return JSON.stringify(capabilities);
    return '';
  };
  const services = {run, companion: () => sdkHost, rust: (async (env, action) => action({cargo: 'cargo', prefix: [], env})) as typeof withRust};
  const opts = {root: join(root, 'cache'), env: {PATH: 'fixture'}, progress() {}};
  for (const [platform, hint] of [['linux', /build-essential/], ['darwin', /xcode-select --install/], ['win32', /Visual Studio Build Tools/]] as const) {
    commands.length = 0;
    const error = await ensurePatchedCodex(opts, {...services, platform}).catch(error => error);
    assert.ok(error instanceof MissingToolchainError); assert.match(error.message, hint);
    assert.match(error.message, platform === 'win32' ? /MSVC/ : /未找到 cc、c\+\+/);
    // Shown first in workflow.log and on the page, with what to do next.
    assert.match(formatAgentError(error).split('\n')[0], /缺少 C\/C\+\+ 编译工具链.*安装完成后在网页点「继续」（命令行 --continue）/);
    assert.ok(!commands.includes('git'), 'no clone before the tools exist');
  }
  // CC/CXX are respected.
  const named = await ensurePatchedCodex({...opts, env: {PATH: 'fixture', CC: '/opt/missing-cc', CXX: '/opt/gcc'}}, {...services, platform: 'linux'}).catch(error => error);
  assert.match(named.message, /未找到 CC=\/opt\/missing-cc）/);
  // The tools answer --version yet the linker is missing at build time: the log names it.
  compilers = true;
  const failed = await ensurePatchedCodex(opts, {...services, platform: 'linux'}).catch(error => error);
  assert.ok(failed instanceof MissingToolchainError); assert.match(failed.message, /linker `cc` not found/);
  // After installing, continuing checks again and builds; the earlier failure in the log is not reported again.
  linker = true;
  assert.match(await ensurePatchedCodex(opts, {...services, platform: 'linux'}), /codex(\.exe)?$/);
  // Other build failures keep the general message.
  const other = await ensurePatchedCodex({...opts, root: join(root, 'other')}, {...services, platform: 'linux',
    run: async (command, args, options) => command === 'cargo' ? Promise.reject(new Error('cargo 退出码 101')) : run(command, args, options)}).catch(error => error);
  assert.ok(!(other instanceof MissingToolchainError)); assert.match(other.message, /自动构建失败/);
});
test('真实进程：PATH 里没有编译器时直接报缺少工具链', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t);
  const error = await ensurePatchedCodex({root, env: {PATH: join(root, 'empty')}, progress() {}}, {run: runCommand}).catch(error => error);
  assert.ok(error instanceof MissingToolchainError); assert.match(error.message, /未找到 cc、c\+\+/);
});
