import { writeStepSession } from '../../shared/agents/step-session.ts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { steps } from '../../character-assembly/steps.ts';
import { startBackground } from '../run.ts';
import { runTask } from '../runner.ts';
import { processAlive, taskStatus } from '../state.ts';
import { fakePatchedCodex, patchedCodexCapabilities } from '../../shared/tests/fake-codex.ts';

// Real background workers inherit this and pass the Codex startup check without a build.
process.env.codex_path = await fakePatchedCodex();

const cli = fileURLToPath(new URL('../run.ts', import.meta.url));
async function fixture(t: TestContext, slow = false) {
  const dir = await mkdtemp(join(tmpdir(), 'live2d-background-')), name = 'case', task = join(dir, name);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const inputs = {
    characterKra: join(task, 'raster-layering/step03/character-dressup-base.kra'),
    clothingKra: join(task, 'clothing-raster-layering/step02/clothing-soft-edges.kra'),
    simplifiedCharacter: join(task, 'part-layering/references/simplified-subject.png'),
  };
  for (const path of Object.values(inputs)) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, 'upstream'); }
  const krita = join(task, 'krita-fixture');
  // The light Krita check only needs an executable file; Krita itself is never started here.
  await writeFile(krita, '#!' + process.execPath + '\n', { mode: 0o755 });
  // The worker's Codex startup check stands in for a tool process of its agent
  // call: the parent's capability check (the first) answers, the worker's hangs.
  if (slow) {
    const codex = join(task, 'slow-codex.cjs'), seen = join(task, 'codex-checked');
    await writeFile(codex, '#!' + process.execPath + '\nconst fs = require("node:fs");\n'
      + 'if (process.argv[2] !== "debug") console.log("codex-cli 0.161.0");\n'
      + 'else if (!fs.existsSync(' + JSON.stringify(seen) + ')) { fs.writeFileSync(' + JSON.stringify(seen) + ', ""); '
      + 'console.log(' + JSON.stringify(JSON.stringify(patchedCodexCapabilities)) + '); }\n'
      + 'else { fs.writeFileSync(' + JSON.stringify(join(task, 'probe.pid')) + ', String(process.pid)); setTimeout(() => {}, 60000); }\n', { mode: 0o755 });
    const previous = process.env.codex_path;
    process.env.codex_path = codex;
    t.after(() => { process.env.codex_path = previous; });
  }
  const output = join(task, 'character-assembly');
  await mkdir(output, { recursive: true });
  await writeStepSession(output, 'step01', { threadId: 'completed-fixture', harness: 'codex' });
  await mkdir(join(output, 'step01'));
  // A slow fixture leaves the step unfinished, so the worker calls the agent.
  for (const file of [...steps[0].requiredFiles, ...(slow ? [] : ['.completed'])]) await writeFile(join(output, 'step01', file), 'retained');
  return { dir, name, task, inputs, output, options: { dir, name, krita, from: 'character-assembly' as const, to: 'character-assembly' as const } };
}
async function until(check: () => Promise<boolean>, timeout = 10_000) {
  const end = Date.now() + timeout;
  while (!await check()) { if (Date.now() > end) assert.fail('timed out'); await delay(30); }
}
async function startFixtureBackground(f: Awaited<ReturnType<typeof fixture>>, krita?: string) {
  // Give the worker an explicit Qt platform so the light Krita check does not
  // depend on the test host's desktop.
  return promisify(execFile)(process.execPath, [cli, '--name', f.name, '--dir', f.dir,
    '--from', 'character-assembly', '--to', 'character-assembly', '--background',
    ...(krita === undefined ? [] : ['--krita', krita])], {
    timeout: 15_000, env: { ...process.env, QT_QPA_PLATFORM: 'offscreen' },
  });
}

test('真实后台父进程退出后任务继续，已完成组装跳过模型并记录交付', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t);
  const { stdout } = await startFixtureBackground(f, f.options.krita);
  assert.match(stdout, /后台总调度已启动/);
  await until(async () => !(await taskStatus(f.options)).lockHeld);
  const status = await taskStatus(f.options);
  assert.equal(status.status, 'completed'); assert.equal(status.sections[0].threadId, 'completed-fixture');
  // The delivery is recorded relative to the task root.
  assert.equal(status.output, 'character-assembly/step01/character-assembled.kra');
  const before = await readFile(join(f.task, 'run.json'));
  const result = await promisify(execFile)(process.execPath, [cli, '--name', f.name, '--dir', f.dir, '--status', '--json']);
  assert.equal(JSON.parse(result.stdout).status, 'completed');
  assert.deepEqual(await readFile(join(f.task, 'run.json')), before, 'status is read-only');
});

test('后台前置错误不假报启动；子管线错误完整进入总控', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t);
  await assert.rejects(startBackground({ ...f.options, krita: join(f.task, 'missing') }), /不存在或不可执行[\s\S]*--krita/);
  await assert.rejects(taskStatus(f.options), /缺少总控记录/);
  await rm(f.inputs.clothingKra);
  await startFixtureBackground(f, f.options.krita);
  await until(async () => !(await taskStatus(f.options)).lockHeld);
  const status = await taskStatus(f.options);
  assert.equal(status.status, 'failed'); assert.match(status.error!, /clothing-soft-edges.kra/);
  assert.match(status.error!, /手动放置/);
});

test('后台启动转发标准化的显式开启和关闭，不悄悄忽略选项', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t);
  // The actual worker must reject these options for an assembly-only route before it signals ready.
  for (const standard of [true, false]) {
    await assert.rejects(startBackground({ ...f.options, standard }), /需要本次路线包含 part-layering/);
  }
});

test('后台启动转发 --knowledge，实际 worker 检查后才报告启动', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t);
  await assert.rejects(startBackground({ ...f.options, knowledge: join(f.dir, 'missing-knowledge') }), /先验知识目录不存在：.*missing-knowledge/);
});

test('取消总调度会终止实际管线子进程及其工具进程，保留已有工程', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t, true), controller = new AbortController();
  const running = runTask(f.options, { signal: controller.signal,
    // Skip just the parent's check, so cancellation targets the actual worker and its tool child.
    preflight: async executable => ({ executable }),
  });
  // Attach a rejection handler immediately while waiting for the child to initialize.
  const stopped = assert.rejects(running, /cancel test/);
  await until(() => readFile(join(f.task, 'probe.pid')).then(() => true, () => false));
  const probePid = Number(await readFile(join(f.task, 'probe.pid'), 'utf8'));
  const workerPid = (await taskStatus(f.options)).runner!.childPids!['character-assembly']!;
  controller.abort(new Error('cancel test'));
  await stopped;
  await until(async () => !processAlive(workerPid));
  // Linux can retain an orphan as a zombie briefly: it is dead, even if kill(pid, 0) succeeds.
  if (process.platform === 'linux' && processAlive(probePid)) {
    assert.match(await readFile('/proc/' + probePid + '/status', 'utf8').catch(() => 'State: Z'), /State:\s+Z/);
  } else assert.equal(processAlive(probePid), false);
  assert.equal((await taskStatus(f.options)).status, 'interrupted');
  // Cancelling keeps the existing upstream projects untouched.
  for (const path of Object.values(f.inputs)) assert.equal(await readFile(path, 'utf8'), 'upstream');
});

test('real background workers retain both explicit live values without expanding a narrow range', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t), previous = process.env.QT_QPA_PLATFORM;
  process.env.QT_QPA_PLATFORM = 'offscreen'; t.after(() => { if (previous === undefined) delete process.env.QT_QPA_PLATFORM; else process.env.QT_QPA_PLATFORM = previous; });
  for (const live of [true, false]) {
    await startBackground({ ...f.options, live });
    await until(async () => !(await taskStatus(f.options)).lockHeld);
    const status = await taskStatus(f.options);
    assert.equal(status.live, live); assert.equal(status.to, 'character-assembly'); assert.equal(status.status, 'completed');
  }
});
