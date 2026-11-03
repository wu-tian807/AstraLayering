import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, writeFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test, type TestContext } from 'node:test';
import { inspectAgv } from '../../patches/agv/inspect.ts';
import { cliExecutable } from '../agents/cli.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';

async function fixture(t: TestContext, code: string) {
  const directory = await mkdtemp(join(tmpdir(), 'agv-launch-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const payload = '#!' + process.execPath + '\n' + code;
  await writeFile(join(directory, 'antigravity.bin'), payload, { mode: 0o700 });
  await writeFile(join(directory, 'patch.json'), JSON.stringify({ defaultResponseHeaderTimeoutSeconds: 0, autoUpdateDisabledByTrue: true,
    patchedSha256: createHash('sha256').update(payload).digest('hex') }));
  await copyFile(new URL('../agents/agv-launch.mjs', import.meta.url), join(directory, 'launch.mjs'));
  return directory;
}

test('managed launcher uses the accepted true value and preserves CLI arguments', async t => {
  const directory = await fixture(t, 'if (process.env.AGY_CLI_DISABLE_AUTO_UPDATE !== "true") process.exit(9); process.stdout.write(JSON.stringify(process.argv.slice(2)));');
  const result = await promisify(execFile)(process.execPath, [join(directory, 'launch.mjs'), '--conversation', 'existing-id'], {
    env: { ...process.env, AGY_CLI_DISABLE_AUTO_UPDATE: '1' }, timeout: 5000 });
  assert.deepEqual(JSON.parse(result.stdout), ['--conversation', 'existing-id']);
});

test('a changed executable is rejected before a CLI task can run', async t => {
  const directory = await fixture(t, 'process.stdout.write("MUST_NOT_RUN");');
  await writeFile(join(directory, 'antigravity.bin'), '#!' + process.execPath + '\nprocess.stdout.write("MUST_NOT_RUN"); // update\n');
  await assert.rejects(promisify(execFile)(process.execPath, [join(directory, 'launch.mjs')], { timeout: 5000 }), (error: any) => {
    assert.match(error.stderr, /副本校验失败/); assert.doesNotMatch(error.stdout, /MUST_NOT_RUN/); return true;
  });
});

test('an executable replaced during a task stops with an explicit error', async t => {
  const directory = await fixture(t, 'require("node:fs").appendFileSync(process.argv[1], "// replaced"); setInterval(() => {}, 1000);');
  await assert.rejects(promisify(execFile)(process.execPath, [join(directory, 'launch.mjs')], { timeout: 5000 }), (error: any) => {
    assert.match(error.stderr, /副本校验失败/); assert.equal(error.killed, false); return true;
  });
});

test('unsupported executable formats never receive an assumed patch', () => {
  assert.throws(() => inspectAgv(Buffer.alloc(80)), /无法确认/);
});

test('preflight exposes an ineffective patch setting instead of swallowing it as a missing CLI', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-preflight-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, '.runtime/agv/build/v2'); await mkdir(directory, { recursive: true });
  const executable = join(directory, 'antigravity'); await writeFile(executable, '#!' + process.execPath + '\n', { mode: 0o700 });
  await writeFile(join(directory, 'patch.json'), JSON.stringify({ format: 2, sourceSha256: 'test', defaultResponseHeaderTimeoutSeconds: 0, autoUpdateDisabledByTrue: false }));
  await assert.rejects(cliExecutable(loadWorkflowEnvironment({ agv_path: executable }), 'agv'), error => {
    assert.match(String(error), /禁用自动更新/); assert.doesNotMatch(String(error), /没有可用的全局入口/); return true;
  });
});

test('AGV 自动补丁默认关闭；开启后实际进入兼容检查，不静默运行不支持的入口', async t => {
  const root=await mkdtemp(join(tmpdir(),'agv-auto-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const executable=join(root,'agy'), bytes=Buffer.alloc(80); bytes.write('7f454c460201',0,'hex');
  await writeFile(executable,bytes, {mode:0o700});
  const disabled=loadWorkflowEnvironment({agv_path:executable,agv_unlimited_response_header_timeout:'false'},root);
  assert.equal(await cliExecutable(disabled,'agv',root),await realpath(executable));
  const enabled=loadWorkflowEnvironment({agv_path:executable,agv_unlimited_response_header_timeout:'true'},root);
  await assert.rejects(cliExecutable(enabled,'agv',root),/无法确认/);
  assert.deepEqual(await readFile(executable),bytes);
});
