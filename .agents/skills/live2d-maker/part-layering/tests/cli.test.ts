import { profile } from '../profile.ts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { getPreparationDirectory, loadPreparedReferences } from '../preparation.ts';
import { parseSectionArguments as parseRunArguments } from '../../shared/section-options.ts';
import { GroupStore } from '../../shared/part/groups.ts';
import { seedPreparedReferences } from './preparation-fixture.ts';
import { seedInitialGroups, shape, workingSteps } from './layering-fixture.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { taskDirectory } from '../../shared/paths.ts';
import { defaultKnowledgeDirectory } from '../../shared/knowledge.ts';

// Every single-section start names its knowledge directory; `knowledge: false` omits it.
function runCli(args: string[], { knowledge = true } = {}) {
  return promisify(execFile)(process.execPath, [
    '--import', new URL('./forbid-model-processes.ts', import.meta.url).href,
    fileURLToPath(new URL('../run.ts', import.meta.url)), ...args,
    ...(knowledge ? ['--knowledge', defaultKnowledgeDirectory] : []),
  ], { timeout: 10000, env: { ...process.env, ASTRA_TEST_CODEX_EXECUTABLE: process.execPath } });
}

test('独立 section 每次启动都须提供 --knowledge；目录缺失文件时启动前即失败', async () => {
  await assert.rejects(runCli(['--name', 'test'], { knowledge: false }), error => {
    assert.ok(String((error as { stderr?: string }).stderr).includes('--knowledge'));
    return true;
  });
  const empty = await mkdtemp(join(tmpdir(), 'knowledge-'));
  try {
    await copyFile(join(defaultKnowledgeDirectory, 'version.json'), join(empty, 'version.json'));
    await assert.rejects(runCli(['--name', 'test', '--knowledge', empty], { knowledge: false }), error => {
      return true;
    });
  } finally { await rm(empty, { recursive: true, force: true }); }
});

test('CLI 隔离模拟本机版本查询，模型调用及其他外部进程仍被拒绝', async t => {
  const source = `
    import assert from 'node:assert/strict';
    import { once } from 'node:events';
    import { spawn, spawnSync, execFile, execFileSync, exec, execSync } from 'node:child_process';
    const child = spawn(process.execPath, ['--version']);
    let stdout = '', stderr = '';
    child.stdout.on('data', data => stdout += data);
    child.stderr.on('data', data => stderr += data);
    const [status] = await once(child, 'close');
    assert.equal(status, 0); assert.equal(stdout, 'fixture CLI 1.2.3'); assert.equal(stderr, '');
    const forbidden = /CLI 测试禁止启动模型或其他外部进程/;
    assert.throws(() => spawn(process.execPath, ['app-server']), forbidden);
    assert.throws(() => spawn(process.execPath, ['--version', 'app-server']), forbidden);
    assert.throws(() => spawn('claude', ['--version']), forbidden);
    for (const launch of [spawnSync, execFile, execFileSync, exec, execSync])
      assert.throws(() => launch(process.execPath, ['app-server']), forbidden);
  `;
  const directory = await mkdtemp(join(tmpdir(), 'part-offline-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const script = join(directory, 'verify.mjs');
  await writeFile(script, source);
  await promisify(execFile)(process.execPath, ['--import', new URL('./forbid-model-processes.ts', import.meta.url).href, script], { timeout: 10000 });
});

test('--jobs / -j 只设置 agent 并发上限，默认 3，不产生组调度上限', () => {
  assert.equal(parseRunArguments(['--name', 'test']).agentConcurrency, 3);
  assert.equal(parseRunArguments(['--name', 'test', '--jobs', '2']).agentConcurrency, 2);
  assert.equal(parseRunArguments(['--name', 'test', '-j', '7']).agentConcurrency, 7);
  assert.equal(parseRunArguments(['--jobs=3']).agentConcurrency, 3);
  assert.ok(!('concurrency' in parseRunArguments(['--jobs=3'])));
  assert.throws(() => parseRunArguments(['--groups', 'groups.json']), { code: 'ERR_PARSE_ARGS_UNKNOWN_OPTION' });
  assert.throws(() => parseRunArguments(['--max-depth', '1']), { code: 'ERR_PARSE_ARGS_UNKNOWN_OPTION' });
});

test('--agents / -a 兼容别名设置同一个 agent 上限', () => {
  assert.equal(parseRunArguments(['--name','test']).agentConcurrency, 3);
  const values = parseRunArguments(['--jobs','2','--agents','2']);
  assert.equal(values.agentConcurrency, 2);
  assert.equal(parseRunArguments(['-a','4']).agentConcurrency, 4);
  assert.throws(() => parseRunArguments(['--jobs','5','--agents','2']), Error);
  for (const value of ['0','-1','1.5','','abc','Infinity','9007199254740992']) {
    assert.throws(() => parseRunArguments([`--agents=${value}`]), Error);
  }
});

test('人物 CLI 的标准化选项不把省略当成关闭', () => {
  assert.equal(parseRunArguments([]).standard, undefined);
  assert.equal(parseRunArguments(['--standard']).standard, true);
  assert.equal(parseRunArguments(['--no-standard']).standard, false);
  assert.throws(() => parseRunArguments(['--standard', '--no-standard']), Error);
});

test('模拟步骤完成后实际入口复用完整事实且强制禁止模型进程', async t => {
  const runName = `test-cli-${randomUUID()}`;
  const references = getPreparationDirectory(runName);
  const directory = dirname(references);
  t.after(() => rm(taskDirectory(runName), { recursive: true, force: true }));
  await seedPreparedReferences(runName);
  await seedInitialGroups(directory, [{ id: 'head', note: '已有识别的组' }]);
  const progress: string[] = [];
  await runLayering({ profile, directory, references: await loadPreparedReferences(runName), groups: null,
    steps: workingSteps([]), progress: message => progress.push(message) });
  const first = await runCli(['--name', runName, '--from-step', 'step14', '-j', '2']);
  assert.match(await readFile(join(directory, 'preview.svg'), 'utf8'), /data-part-preview="1"/);
  await assert.rejects(readFile(join(directory, 'progress.json')), { code: 'ENOENT' });
  const second = await runCli(['--name', runName]);
  const secondState = (await GroupStore.open(directory)).snapshot();
  assert.equal(secondState.groups.length, 1);
  assert.equal(secondState.groups[0].steps.review.status, 'completed');
  assert.equal(secondState.groups[0].steps.completion.status, 'completed');
  const tree = JSON.parse(await readFile(join(directory, 'groups.json'), 'utf8'));
  assert.ok(!('initial' in tree) && !('merge' in tree) && !('steps' in tree.groups[0]));
  assert.equal(tree.groups[0].note, '已有识别的组');
  // 让最后一步重跑，证明隔离保护会立即报错，不能启动真实 SDK / app-server。
  await rm(join(directory, 'step14_occlusion/.completed'));
  await assert.rejects(runCli(['--name', runName]), Error);
});

test('实际入口遇到组产物问题时报告组名、步骤和停止派发，不显示已完成', async t => {
  const runName = `test-cli-${randomUUID()}`;
  const references = getPreparationDirectory(runName);
  const directory = dirname(references);
  t.after(() => rm(taskDirectory(runName), { recursive: true, force: true }));
  await seedPreparedReferences(runName);
  await seedInitialGroups(directory, [{ id: 'head_accessories' }]);
  await assert.rejects(runCli(['--name', runName]), error => {
    const failure = error as Error & { code: number; stderr: string };
    assert.equal(failure.code, 1);
    assert.match(failure.stderr, /head_accessories/);
    return true;
  });
});

test('从描边启动时前置参考缺失，直接退出', async t => {
  const runName = `test-cli-${randomUUID()}`;
  const references = getPreparationDirectory(runName);
  const directory = dirname(references);
  t.after(() => rm(taskDirectory(runName), { recursive: true, force: true }));
  await mkdir(directory, { recursive: true });
  await assert.rejects(runCli(['--name', runName, '--from-step', 'step09']), error => {
    const failure = error as Error & { stderr: string };
    return true;
  });
  await assert.rejects(readFile(join(directory, 'groups.json')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(references, 'judgment.json')), { code: 'ENOENT' });
});

test('命令行并发参数拒绝零、负数、小数、空值及非数字', () => {
  for (const value of ['0', '-1', '1.5', '', 'abc', 'Infinity', '9007199254740992']) {
    assert.throws(() => parseRunArguments([`--jobs=${value}`]), Error);
  }
  assert.throws(() => parseRunArguments(['--jobs', '-1']));
});

test('实际命令行帮助包含并发参数，无效值退出且不调用模型', async () => {
  const help = await runCli(['--help']);
  assert.match(help.stdout, /--jobs/);
  assert.match(help.stdout, /--agents/);
  await assert.rejects(runCli(['--name', 'test', '-j', '0']), error => {
    const failure = error as Error & { code: number; stderr: string };
    assert.equal(failure.code, 1);
    return true;
  });
});
