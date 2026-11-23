import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import lockfile from 'proper-lockfile';
import { ensurePatchedCodex, codexCommit, pinnedGit, MissingToolchainError } from '../../patches/codex/build.ts';
import { withRust, rustVersion } from '../../patches/codex/rust.ts';
import { runCommand, watchOutput, type Command } from '../../patches/codex/process.ts';
import { formatAgentError } from '../codex/diagnostics.ts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'patch-startup-'));
  t.after(() => rm(root, {recursive: true, force: true})); return root;
}
const capabilities = {version: 1, image_provider_version: 2, image_compaction_version: 2, request_compaction_version: 1, failed_error_event_version: 1};
const codexVersion = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).dependencies['@openai/codex-sdk'];
test('并发自动构建只运行一次，校验缓存，损坏后重建，失败不写成功记录；构建或等待前通知调用方', async t => {
  const root = await fixture(t), sdkHost = join(root, 'sdk-host'); await writeFile(sdkHost, 'companion');
  let builds = 0, building = 0, fail = true;
  let reportedVersion = codexVersion;
  const workspaces: string[] = [];
  const run: Command = async (command, args, options) => {
    if (command === 'git') {
      if (args.includes('--reverse')) throw new Error('not applied');
    } else if (command === 'cargo') {
      const buildTarget = args[args.indexOf('--target-dir') + 1];
      const workspace = dirname(buildTarget);
      assert.equal(dirname(workspace), tmpdir());
      assert.equal(options.env?.CARGO_HOME, join(workspace, 'cargo'));
      workspaces.push(workspace);
      const target = join(buildTarget, 'dev-small');
      await mkdir(target, {recursive: true});
      await writeFile(join(target, 'object'), 'partial build');
      builds++; await delay(350); if (fail) throw new Error('compiler fixture failure');
      await writeFile(join(target, process.platform === 'win32' ? 'codex.exe' : 'codex'), 'binary');
    } else return args[0] === '--version' ? `codex-cli ${reportedVersion}` : JSON.stringify(capabilities);
    return '';
  };
  const services = {run, companion: () => sdkHost,
    rust: (async (env, action) => action({cargo: 'cargo', prefix: [], env})) as typeof withRust};
  const opts = {root: join(root, 'cache'), env: {PATH: 'fixture'}, progress() {}, building() { building++; }};
  const directory = join(opts.root, `${process.platform}-${process.arch}`);
  const previousKey = '1'.repeat(20), previous = join(directory, previousKey);
  await mkdir(previous, { recursive: true });
  await writeFile(join(previous, 'ready.json'), 'previous receipt');
  await assert.rejects(ensurePatchedCodex(opts, services), /自动构建失败/);
  const key = (await readdir(directory)).find(entry => entry !== previousKey)!;
  const cache = join(directory, key);
  assert.equal(await readFile(join(previous, 'ready.json'), 'utf8'), 'previous receipt');
  await assert.rejects(readFile(join(cache, 'ready.json')), {code: 'ENOENT'});
  assert.equal(await readFile(join(workspaces[0], 'target/dev-small/object'), 'utf8'), 'partial build');
  fail = false;
  const results = await Promise.all([ensurePatchedCodex(opts, services), ensurePatchedCodex(opts, services)]);
  // The waiting call is notified too: it can take as long as the build.
  assert.equal(results[0], results[1]); assert.equal(builds, 2); assert.equal(building, 3);
  assert.equal(workspaces[0], workspaces[1]);
  assert.deepEqual(await readdir(directory), [key]);
  await assert.rejects(readdir(workspaces[1]), {code: 'ENOENT'});
  assert.equal(relative(cache, results[0]), join('bin', process.platform === 'win32' ? 'codex.exe' : 'codex'));
  await ensurePatchedCodex(opts, services); assert.equal(builds, 2); assert.equal(building, 3);
  await writeFile(results[0], 'corrupted'); await ensurePatchedCodex(opts, services); assert.equal(builds, 3);
  assert.equal(await readFile(results[0], 'utf8'), 'binary');
  assert.equal(await readFile(join(cache, 'bin', process.platform === 'win32' ? 'codex-code-mode-host.exe' : 'codex-code-mode-host'), 'utf8'), 'companion');
  const receiptPath = join(cache, 'ready.json');
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  assert.equal(receipt.version, codexVersion);
  await writeFile(receiptPath, JSON.stringify({ ...receipt, version: '0.0.0' }));
  reportedVersion = '0.0.0';
  await assert.rejects(ensurePatchedCodex(opts, services), /Codex 补丁应为 .*实际报告：codex-cli 0\.0\.0/);
  assert.equal(JSON.parse(await readFile(receiptPath, 'utf8')).version, '0.0.0');
  reportedVersion = codexVersion;
  await ensurePatchedCodex(opts, services);
  assert.equal(builds, 5);
  assert.equal(JSON.parse(await readFile(receiptPath, 'utf8')).version, codexVersion);
  await mkdir(previous);
  const release = await lockfile.lock(previous, { stale: 30_000 });
  try {
    assert.equal(await ensurePatchedCodex(opts, services), results[0]);
    assert.ok((await readdir(directory)).includes(previousKey));
  } finally { await release(); }
  assert.equal(await ensurePatchedCodex(opts, services), results[0]);
  assert.deepEqual(await readdir(directory), [key]);
  assert.equal(builds, 5);
  await writeFile(results[0], 'corrupted again');
  await assert.rejects(ensurePatchedCodex(opts, { ...services, companion: () => join(root, 'missing-host') }), /自动构建失败/);
  assert.ok((await readdir(join(cache, 'bin'))).length > 0);
  await assert.rejects(readFile(receiptPath), { code: 'ENOENT' });
  assert.equal(await ensurePatchedCodex(opts, services), results[0]);
  assert.deepEqual(await readdir(directory), [key]);
  assert.equal(builds, 7);
});
test('源码按固定 git 设置检出，应用补丁失败后继续使用已下载源码', async t => {
  const root = await fixture(t), sdkHost = join(root, 'sdk-host'); await writeFile(sdkHost, 'companion');
  // The user's own settings lose to the pinned ones; earlier GIT_CONFIG_* entries are kept.
  const global = join(root, 'gitconfig');
  await writeFile(global, '[core]\n\tautocrlf = true\n\teol = crlf\n\tlongpaths = false\n');
  execFileSync('git', ['config', '--file', global, 'core.attributesFile', join(root, 'attrs')]);
  const env = pinnedGit({...process.env, GIT_CONFIG_GLOBAL: global, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.proxy', GIT_CONFIG_VALUE_0: 'http://proxy'});
  const read = (key: string) => execFileSync('git', ['config', '--get', key], {env, encoding: 'utf8'}).trim();
  assert.deepEqual(['core.autocrlf', 'core.eol', 'core.longpaths', 'core.attributesFile', 'http.proxy'].map(read), ['false', 'lf', 'true', '', 'http://proxy']);
  const upstream = join(root, 'upstream');
  const fetched: string[] = []; let attempts = 0;
  const run: Command = async (command, args, options) => {
    if (command === 'git') {
      assert.equal(options.env?.GIT_CONFIG_KEY_0, 'core.autocrlf');
      if (args[0] === 'cat-file') await readFile(join(options.cwd!, 'downloaded'));
      if (args[0] === 'fetch') {
        assert.deepEqual(args.slice(-2), [upstream, codexCommit]);
        fetched.push(options.cwd!); await writeFile(join(options.cwd!, 'downloaded'), 'source');
      }
      if (args[0] === 'checkout') assert.equal(args.at(-1), codexCommit);
      if (args.includes('--reverse')) throw new Error('not applied');
      if (args[0] === 'apply' && attempts++ === 0) throw new Error('patch does not apply');
    } else if (command === 'cargo') {
      const target = join(args[args.indexOf('--target-dir') + 1], 'dev-small');
      await mkdir(target, {recursive: true});
      await writeFile(join(target, process.platform === 'win32' ? 'codex.exe' : 'codex'), 'binary');
    } else return args[0] === '--version' ? `codex-cli ${codexVersion}` : JSON.stringify(capabilities);
    return '';
  };
  const services = {run, companion: () => sdkHost, rust: (async (env, action) => action({cargo: 'cargo', prefix: [], env})) as typeof withRust};
  const opts = {root: join(root, 'cache'), source: upstream, env: {PATH: 'fixture'}, progress() {}};
  await assert.rejects(ensurePatchedCodex(opts, services), /自动构建失败/);
  assert.equal(fetched.length, 1);
  assert.equal(await readFile(join(fetched[0], 'downloaded'), 'utf8'), 'source');
  await ensurePatchedCodex(opts, services);
  assert.equal(attempts, 2); assert.equal(fetched.length, 1);
  await assert.rejects(readdir(dirname(fetched[0])), {code: 'ENOENT'});
});

test('匹配 Rust 时复用；构建失败不额外下载且不改原环境', async t => {
  const temporaryDirectory = await fixture(t);
  const env = {PATH: '/fixture', CARGO_HOME: '/user/cargo'}, before = {...env}; let downloads = 0, runs = 0;
  await assert.rejects(withRust(env, async tc => { assert.equal(tc.env, env); throw new Error('build failed'); }, () => {},
    {temporaryDirectory, run: async () => {runs++; return `cargo ${rustVersion} (fixture)`;}, download: async () => {downloads++; throw new Error('unexpected');}}), /build failed/);
  assert.equal(runs, 1); assert.equal(downloads, 0); assert.deepEqual(env, before);
});
test('临时 Rust 校验安装器并保留中断的组件，继续复用下载或已安装的工具链', async t => {
  const root = await fixture(t), env = {PATH: '/fixture', CARGO_HOME: '/user/cargo', RUSTUP_HOME: '/user/rust'};
  const before = {...env}, bytes = Buffer.from('installer-fixture'), checksum = createHash('sha256').update(bytes).digest('hex');
  for (const mode of ['success', 'install-failure', 'build-failure', 'checksum-failure']) {
    const work = join(root, mode); await mkdir(work);
    let downloads = 0, installs = 0, installed = false, failed = mode !== 'success'; const messages: string[] = [];
    const log = mode === 'install-failure' ? join(work, 'build.log') : undefined;
    if (log) await writeFile(log, 'error: unrelated earlier run\n');
    const execute = () => withRust(env, async tc => {
      assert.equal(installed, true); assert.ok(tc.cargo.startsWith(work));
      assert.equal(tc.env.CARGO_HOME, join(work, 'cargo')); assert.equal(tc.env.RUSTUP_HOME, join(work, 'rustup'));
      if (failed && mode === 'build-failure') throw new Error('compile failed'); return 'ok';
    }, message => messages.push(message), {temporaryDirectory: work, log,
      download: async url => { downloads++; assert.ok(url.startsWith('https://static.rust-lang.org/rustup/dist/'));
        return url.endsWith('.sha256') ? Buffer.from(mode === 'checksum-failure' ? 'bad checksum' : checksum) : bytes; },
      run: async (command, args, options) => {
        if (command === 'cargo') throw new Error('ENOENT');
        if (command.includes('rustup-init')) {
          installs++;
          assert.ok(args.includes('--no-modify-path')); assert.ok(args.includes(rustVersion)); assert.ok(options.env.CARGO_HOME!.startsWith(root));
          assert.equal(options.env.RUSTUP_TERM_PROGRESS_WHEN, 'always');
          if (log && failed) {
            const download = join(options.env.RUSTUP_HOME!, 'downloads');
            await mkdir(download, {recursive:true});
            await writeFile(join(download, 'component.partial'), 'downloaded bytes');
            await appendFile(log, 'error: component checksum mismatch\n');
            throw new Error('installer exited');
          }
          if (log) assert.equal(await readFile(join(options.env.RUSTUP_HOME!, 'downloads/component.partial'), 'utf8'), 'downloaded bytes');
          installed = true;
        }
        if (!installed) throw new Error('ENOENT');
        return `cargo ${rustVersion} (fixture)`;
      }});
    const result = execute();
    if (mode === 'success') assert.equal(await result, 'ok');
    else if (log) {
      await assert.rejects(result, (error: Error) => error.message.split('\n').at(-1) === 'error: component checksum mismatch'
        && !error.message.includes('unrelated earlier run'));
    } else await assert.rejects(result, mode === 'checksum-failure' ? /SHA-256/ : /compile failed/);
    if (log || mode === 'build-failure') {
      failed = false;
      assert.equal(await execute(), 'ok');
      assert.equal(installs, log ? 2 : 1);
    }
    assert.equal(downloads, 2); assert.deepEqual(env, before);
  }
});
test('Linux、Windows、macOS 均使用传入的系统临时根和对应官方安装器', async t => {
  const root = await fixture(t), bytes = Buffer.from('installer'), checksum = createHash('sha256').update(bytes).digest('hex');
  for (const [platform, arch, host] of [['linux', 'x64', 'x86_64-unknown-linux-gnu'], ['win32', 'x64', 'x86_64-pc-windows-msvc'], ['darwin', 'arm64', 'aarch64-apple-darwin']] as const) {
    const work = join(root, platform); await mkdir(work);
    const pathKey = platform === 'win32' ? 'Path' : 'PATH';
    const env = {[pathKey]: 'original-path'}; let installed = false;
    await withRust(env, async tc => {
      assert.equal(installed, true); assert.ok(tc.cargo.startsWith(root));
      assert.equal(tc.cargo.endsWith('.exe'), platform === 'win32');
      assert.equal(tc.env[pathKey], env[pathKey]);
      assert.deepEqual(Object.keys(tc.env).filter(key => /^path$/i.test(key)), [pathKey]);
      assert.ok(tc.env.RUSTUP_HOME!.startsWith(root));
    }, () => {}, {platform, arch, temporaryDirectory: work,
      download: async url => {
        assert.ok(url.includes('/' + host + '/rustup-init' + (platform === 'win32' ? '.exe' : '')));
        return url.endsWith('.sha256') ? Buffer.from(checksum) : bytes;
      }, run: async (command, args) => {
        if (command === 'cargo') throw new Error('missing');
        if (command.includes('rustup-init')) { installed = true; assert.ok(args.includes('--no-modify-path')); }
        if (!installed) throw new Error('missing');
        return `cargo ${rustVersion} (fixture)`;
      }});
  }
});
test('长命令转发实际输出，清理终端控制符并节流编译进度', async () => {
  const lines: string[] = [];
  const script = "process.stderr.write('\\x1b[2Krustc 10 MiB / 70 MiB\\r\\x1b[2Krustc 20 MiB / 70 MiB\\r'); "
    + "setTimeout(() => console.log('   Compiling a v1\\n   Compiling b v1'), 100)";
  assert.equal(await runCommand(process.execPath, ['-e', script], {env: process.env, line: text => lines.push(text)}),
    'Compiling a v1\n   Compiling b v1');
  assert.deepEqual(lines, ['rustc 10 MiB / 70 MiB', 'rustc 20 MiB / 70 MiB', 'Compiling a v1', 'Compiling b v1']);
  let clock = 0; const messages: string[] = [];
  const line = watchOutput('编译 Codex 补丁', message => messages.push(message), {every: 1000, now: () => clock});
  line('Updating crates.io index'); clock = 500; line('Compiling a v1'); clock = 1500; line('Compiling b v1');
  assert.deepEqual(messages, ['编译 Codex 补丁：Updating crates.io index（已用 0 秒）', '编译 Codex 补丁：已编译 2 个 crate，最近 Compiling b v1（已用 2 秒）']);
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
      if (args.includes('--reverse')) throw new Error('not applied');
    } else if (command === 'cargo') {
      if (!linker) { await writeFile(options.log!, 'error: linker `cc` not found\n  = note: No such file or directory', {flag: 'a'}); throw new Error('cargo 退出码 101'); }
      const target = join(args[args.indexOf('--target-dir') + 1], 'dev-small');
      await mkdir(target, {recursive: true});
      await writeFile(join(target, process.platform === 'win32' ? 'codex.exe' : 'codex'), 'binary');
    } else return args[0] === '--version' ? `codex-cli ${codexVersion}` : JSON.stringify(capabilities);
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
  await assert.rejects(ensurePatchedCodex({...opts, root: join(root, 'long-path')}, {...services, platform: 'win32',
    run: async (command, args, options) => {
      if (command !== 'cargo') return run(command, args, options);
      await writeFile(options.log!, "  path too long: 'C:/fixture/cargo/git/checkouts/dependency'; class=Filesystem (30)\n", {flag: 'a'});
      throw new Error('cargo 退出码 101');
    }}), (error: Error) => {
    assert.ok(!(error instanceof MissingToolchainError));
    assert.match(error.message, /Windows.*TEMP\/TMP/);
    return true;
  });
});
test('真实进程：PATH 里没有编译器时直接报缺少工具链', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t);
  const error = await ensurePatchedCodex({root, env: {PATH: join(root, 'empty')}, progress() {}}, {run: runCommand}).catch(error => error);
  assert.ok(error instanceof MissingToolchainError); assert.match(error.message, /未找到 cc、c\+\+/);
});
