import { profile } from '../profile.ts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { getPreparationDirectory, loadPreparedReferences } from '../preparation.ts';
import { formatLayeringSummary, parseRunArguments, readGroupInput } from '../run.ts';
import { GroupStore, normalizeGroups } from '../../shared/part/groups.ts';
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
    assert.match(String((error as { stderr?: string }).stderr), /必须提供 --knowledge/);
    return true;
  });
  const empty = await mkdtemp(join(tmpdir(), 'knowledge-'));
  try {
    await assert.rejects(runCli(['--name', 'test', '--knowledge', empty], { knowledge: false }), error => {
      assert.match(String((error as { stderr?: string }).stderr), /先验知识缺少文件/);
      return true;
    });
  } finally { await rm(empty, { recursive: true, force: true }); }
});

test('CLI 隔离模拟本机版本查询，模型调用及其他外部进程仍被拒绝', async () => {
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
  await promisify(execFile)(process.execPath, ['--import', new URL('./forbid-model-processes.ts', import.meta.url).href,
    '--input-type=module', '-e', source], { timeout: 10000 });
});

test('--jobs / -j 只设置 agent 并发上限，默认 3，不产生组调度上限', () => {
  assert.equal(parseRunArguments(['--name', 'test']).agentConcurrency, 3);
  assert.equal(parseRunArguments(['--name', 'test', '--jobs', '2']).agentConcurrency, 2);
  assert.equal(parseRunArguments(['--name', 'test', '-j', '7']).agentConcurrency, 7);
  assert.equal(parseRunArguments(['--jobs=3']).agentConcurrency, 3);
  assert.ok(!('concurrency' in parseRunArguments(['--jobs=3'])));
  assert.equal(parseRunArguments(['--groups', 'groups.json']).groups, 'groups.json');
});

test('--agents / -a 兼容别名设置同一个 agent 上限', () => {
  assert.equal(parseRunArguments(['--name','test']).agentConcurrency, 3);
  const values = parseRunArguments(['--jobs','2','--agents','2']);
  assert.equal(values.agentConcurrency, 2);
  assert.equal(parseRunArguments(['-a','4']).agentConcurrency, 4);
  assert.throws(() => parseRunArguments(['--jobs','5','--agents','2']), /同一 agent 并发上限/);
  for (const value of ['0','-1','1.5','','abc','Infinity','9007199254740992']) {
    assert.throws(() => parseRunArguments([`--agents=${value}`]), /必须是正整数/);
  }
});

test('人物 CLI 的标准化选项不把省略当成关闭', () => {
  assert.equal(parseRunArguments([]).standard, undefined);
  assert.equal(parseRunArguments(['--standard']).standard, true);
  assert.equal(parseRunArguments(['--no-standard']).standard, false);
  assert.throws(() => parseRunArguments(['--standard', '--no-standard']), /不能同时使用/);
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
  assert.ok(progress.some(message => message.includes('最终预览合并：完成')));
  const groupsPath = join(directory, 'input.json');
  await writeFile(groupsPath, JSON.stringify([{ id: 'head', note: '不能覆盖已有的说明' }]));
  const first = await runCli(['--name', runName, '--groups', groupsPath, '-j', '2']);
  assert.doesNotMatch(first.stdout, /最终预览合并：开始/);
  assert.match(first.stdout, /遮挡层级规划：沿用/);
  assert.match(first.stdout, /\[head\] 本组流程已完成（part）/);
  assert.match(first.stdout, /Layering 已完成：.*preview\.svg/);
  assert.match(await readFile(join(directory, 'preview.svg'), 'utf8'), /data-part-preview="1"/);
  await assert.rejects(readFile(join(directory, 'progress.json')), { code: 'ENOENT' });
  const second = await runCli(['--name', runName]);
  assert.match(second.stdout, /首次分组：沿用已有结果/);
  assert.doesNotMatch(second.stdout, /最终预览合并：开始/);
  const secondState = (await GroupStore.open(directory)).snapshot();
  assert.equal(secondState.groups.length, 1);
  assert.equal(secondState.groups[0].steps.review.status, 'completed');
  assert.equal(secondState.groups[0].steps.completion.status, 'completed');
  const tree = JSON.parse(await readFile(join(directory, 'groups.json'), 'utf8'));
  assert.ok(!('initial' in tree) && !('merge' in tree) && !('steps' in tree.groups[0]));
  assert.equal(tree.groups[0].note, '已有识别的组');
  assert.deepEqual((await readGroupInput(join(directory, 'groups.json')) as { id: string }[]).map(group => group.id), ['head']);
  // 让最后一步重跑，证明隔离保护会立即报错，不能启动真实 SDK / app-server。
  await rm(join(directory, 'step14_occlusion/.completed'));
  await assert.rejects(runCli(['--name', runName]), /CLI 测试禁止启动模型或其他外部进程/);
});

test('结果明确区分通过、返修、无法核对和执行失败', () => {
  const groups = normalizeGroups([
    { id: 'passed', steps: { outline: { status: 'completed', output: { path: 'passed.svg' } },
      review: { status: 'completed', output: { path: 'passed.svg' } } } },
    { id: 'revise', steps: { outline: { status: 'completed', output: { path: 'revise.svg' } },
      review: { status: 'pending', message: '轮廓 review revise：边缘不符' } } },
    { id: 'blocked', steps: { outline: { status: 'completed', output: { path: 'blocked.svg' } },
      review: { status: 'pending', message: '轮廓 review blocked：无法核对' } } },
    { id: 'failed', steps: { review: { status: 'failed', message: '测试工具异常' } } },
  ]);
  const lines = formatLayeringSummary(groups);
  assert.match(lines[0], /review 已通过/);
  assert.match(lines[1], /review 尚未通过.*需要返修/);
  assert.match(lines[2], /review 尚未通过.*无法核对/);
  assert.match(lines[3], /review 尚未通过.*失败：测试工具异常/);
});

test('两轮意见修正完成的结果不会显示成独立 review 已通过', () => {
  const groups = normalizeGroups([{ id: 'repaired', steps: {
    outline: { status: 'completed', output: { path: 'repaired.svg' } },
    review: { status: 'completed', output: { path: 'repaired.svg', reviewOutcome: 'repaired',
      note: '已按第 2 轮意见返修并自检，不再复审' } },
    reduction: { status: 'completed', output: { path: 'reduced.svg' } },
    completion: { status: 'pending', message: '直接遮挡补形：待接入' },
  } }]);
  const line = formatLayeringSummary(groups)[0];
  assert.match(line, /已按第 2 轮意见返修并自检，不再复审；直接遮挡补形：待接入/);
  assert.doesNotMatch(line, /review 已通过|需要返修|尚未通过/);
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
    assert.match(failure.stderr, /\[head_accessories\] 组轮廓与自检失败/);
    assert.match(failure.stderr, /Layering 未完成：停止派发新待办/);
    assert.match(failure.stderr, /其余未启动的待办未执行/);
    assert.match(failure.stderr, /事实产物目录：/);
    assert.doesNotMatch(failure.stderr, /Layering 已完成/);
    return true;
  });
});

test('显式 groups 缺少前置参考时直接退出，不启动准备 agent 或自动补齐文件', async t => {
  const runName = `test-cli-${randomUUID()}`;
  const references = getPreparationDirectory(runName);
  const directory = dirname(references);
  t.after(() => rm(taskDirectory(runName), { recursive: true, force: true }));
  await mkdir(directory, { recursive: true });
  const groupsPath = join(directory, 'input.json');
  await writeFile(groupsPath, JSON.stringify([{ id: 'face' }]));
  await assert.rejects(runCli(['--name', runName, '--groups', groupsPath]), error => {
    const failure = error as Error & { stderr: string };
    assert.match(failure.stderr, /前置参考未完成/);
    return true;
  });
  await assert.rejects(readFile(join(directory, 'groups.json')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(references, 'judgment.json')), { code: 'ENOENT' });
});

test('读取 groups 选择文件不加载外部进度，也不迁移或改写输入文件', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'part-layering-selection-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const groupsPath = join(directory, 'groups.json');
  const progressPath = join(directory, 'progress.json');
  const contents = JSON.stringify({ groups: [{ id: 'face' }], initial: { status: 'completed' }, merge: { status: 'pending' } });
  await writeFile(groupsPath, contents);
  await writeFile(progressPath, '{broken external progress');
  assert.deepEqual((await readGroupInput(groupsPath) as { id: string }[]).map(group => group.id), ['face']);
  assert.equal(await readFile(groupsPath, 'utf8'), contents);
  assert.equal(await readFile(progressPath, 'utf8'), '{broken external progress');
});

test('命令行并发参数拒绝零、负数、小数、空值及非数字', () => {
  for (const value of ['0', '-1', '1.5', '', 'abc', 'Infinity', '9007199254740992']) {
    assert.throws(() => parseRunArguments([`--jobs=${value}`]), /必须是正整数/);
  }
  assert.throws(() => parseRunArguments(['--jobs', '-1']));
});

test('实际命令行帮助包含并发参数，无效值退出且不调用模型', async () => {
  const help = await runCli(['--help']);
  assert.match(help.stdout, /--jobs/);
  assert.doesNotMatch(help.stdout, /默认 5|层内组调度并发上限/);
  assert.match(help.stdout, /--agents/);
  assert.match(help.stdout, /默认 3/);
  await assert.rejects(runCli(['--name', 'test', '-j', '0']), error => {
    const failure = error as Error & { code: number; stderr: string };
    assert.equal(failure.code, 1);
    assert.match(failure.stderr, /必须是正整数/);
    return true;
  });
});
