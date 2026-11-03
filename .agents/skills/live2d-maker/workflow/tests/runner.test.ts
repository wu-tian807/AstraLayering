import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import { sectionIds, type SectionId } from '../../shared/paths.ts';
import { runTask } from '../runner.ts';
import { preflightKrita } from '../krita.ts';
import { checkKrita } from '../../shared/raster/krita.ts';
import { MissingDependencyError } from '../../shared/missing-dependency.ts';
import { acquireTaskLock, configureRun, directoryFor, readRun, saveRun, taskStatus } from '../state.ts';
import { main, parseArguments, startBackground } from '../run.ts';
import { fakePatchedCodex } from '../../shared/tests/fake-codex.ts';
import { defaultKnowledgeDirectory, knowledgeDirectory, selectKnowledge } from '../../shared/knowledge.ts';
import { markBaseStep } from '../../shared/tests/dressup-fixture.ts';

// Real background workers inherit this and pass the Codex startup check without a build.
process.env.codex_path = await fakePatchedCodex();

const png = (background: string) => sharp({ create: { width: 2, height: 2, channels: 4, background } }).png().toBuffer();
const originalImage = await png('#f00');

async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'live2d-runner-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const options = { name: 'case', dir, krita: process.execPath };
  const directory = directoryFor(options);
  await mkdir(directory);
  await writeFile(join(directory, 'reference.png'), originalImage);
  return { options, directory };
}
const preflight = async (executable: string) => ({ executable, version: 'test' });

test('agent 进度只写入日志，不改写状态记录', async t => {
  const f = await fixture(t);
  let saves = 0, during = 0;
  await runTask({ ...f.options, from: 'part-layering', to: 'part-layering' }, {
    save: async (directory, run) => { saves++; await saveRun(directory, run); },
    execute: async (_id, _run, context) => {
      const before = saves;
      context.progress('[hair] 第一条消息');
      context.progress('[hair] 写入草稿成功');
      during = saves - before;
      return { summary: '完成' };
    },
  });
  assert.equal(during, 0);
  const log = await readFile(join(f.directory, 'workflow.log'), 'utf8');
  assert.equal(log.match(/\[hair\] 写入草稿成功/g)?.length, 1);
  assert.match(log, /所选路线已完成/);
  assert.equal((await readRun(f.directory))?.status, 'completed');
  assert.equal((await taskStatus(f.options)).log, join(f.directory, 'workflow.log'));
  assert.equal((await readdir(f.directory)).includes('service.log'), false);
});

test('状态原子替换对短暂占用重试，永久失败保留旧状态并清理暂存', async t => {
  const f = await fixture(t), run = await configureRun(f.options, f.directory);
  let attempts = 0;
  await saveRun(f.directory, run, async (source, destination) => {
    if (++attempts < 3) throw Object.assign(new Error('busy'), { code: 'EPERM' });
    await rename(source, destination);
  });
  assert.equal(attempts, 3);
  const before = await readFile(join(f.directory, 'run.json'), 'utf8');
  await assert.rejects(saveRun(f.directory, { ...run, status: 'completed' }, async () => {
    throw Object.assign(new Error('disk failure'), { code: 'EIO' });
  }), /disk failure/);
  assert.equal(await readFile(join(f.directory, 'run.json'), 'utf8'), before);
  assert.equal((await readdir(f.directory)).some(name => name.endsWith('.tmp')), false);
});

test('真实后台启动失败只写主日志，不另建 service.log', async t => {
  const f = await fixture(t);
  // A Krita path that is not executable fails the light check.
  await assert.rejects(startBackground({ ...f.options, krita: join(f.directory, 'reference.png'), from: 'raster-layering', to: 'raster-layering' }), /Krita|krita/);
  assert.match(await readFile(join(f.directory, 'workflow.log'), 'utf8'), /Krita|krita/);
  assert.equal((await readdir(f.directory)).includes('service.log'), false);
});

test('总控保留输入与配置，按依赖推进；后续仅用 name 和 dir 恢复', async t => {
  const f = await fixture(t), first: SectionId[] = [], second: SectionId[] = [];
  await runTask({ ...f.options, image: 'reference.png', jobs: 2, standard: true }, { preflight, execute: async (id, run) => {
    first.push(id);
    const disk = (await readRun(f.directory))!;
    assert.ok(disk.activeSections?.includes(id));
    assert.equal(disk.status, 'running');
    assert.equal(run.jobs, 2);
    assert.equal(run.standard, true); assert.equal(disk.standard, true);
    return { summary: id, output: join(f.directory, id, 'output') };
  } });
  assert.deepEqual([...first].sort(), [...sectionIds].sort());
  for (const [before, after] of [['part-layering', 'raster-layering'], ['part-layering', 'clothing-part-layering'],
    ['clothing-part-layering', 'clothing-raster-layering'], ['raster-layering', 'character-assembly'],
    ['clothing-raster-layering', 'character-assembly'], ['character-assembly', 'shadow']] as const) assert.ok(first.indexOf(before) < first.indexOf(after), before + ' → ' + after);
  // The delivery is the furthest section's, whichever lane finished last.
  assert.equal((await readRun(f.directory))!.output, 'shadow/output');
  assert.deepEqual(await readFile(join(f.directory, 'input/original.png')), originalImage);
  await rm(join(f.directory, 'reference.png'));
  await runTask({ name: 'case', dir: f.options.dir }, { preflight, execute: async (id, run) => {
    second.push(id); assert.equal(run.jobs, 2); assert.equal(run.krita, process.execPath);
    assert.equal(run.standard, true);
    return { summary: '管线自身检查并跳过', output: 'retained' };
  } });
  // Re-enter the section's own authoritative checks, never trust a stale top-level completion alone.
  assert.deepEqual([...second].sort(), sectionIds.filter(id => !['part-layering', 'clothing-part-layering'].includes(id)).sort());
  const status = await taskStatus(f.options);
  assert.equal(status.status, 'completed'); assert.equal(status.runnerAlive, false); assert.equal(status.lockHeld, false);
  assert.equal(status.output, 'retained');
});

test('一条线异常只阻断汇合后的管线，另一条线做完；展示模型原因，续跑沿用原始配置', async t => {
  const f = await fixture(t), calls: SectionId[] = [];
  await assert.rejects(runTask({ ...f.options, image: 'reference.png' }, { preflight, execute: async id => {
    calls.push(id);
    if (id === 'raster-layering') throw new Error('thread=draw-1\n模型最后消息：没有 image_generation 工具');
    return { summary: 'complete' };
  } }), /没有 image_generation/);
  assert.deepEqual([...calls].sort(), ['clothing-part-layering', 'clothing-raster-layering', 'part-layering', 'raster-layering']);
  const run = (await readRun(f.directory))!;
  assert.equal(run.status, 'failed'); assert.deepEqual(run.activeSections, ['raster-layering']);
  assert.equal(run.sections['raster-layering']!.status, 'failed');
  assert.match(run.error!, /thread=draw-1/);
  assert.equal(run.sections['clothing-raster-layering']!.status, 'completed');
  assert.equal(run.sections['character-assembly']!.status, 'pending');
  assert.match(await readFile(join(f.directory, 'workflow.log'), 'utf8'), /模型最后消息/);
  await runTask({ name: 'case', dir: f.options.dir }, { preflight, execute: async () => ({ summary: 'resumed' }) });
  assert.equal((await readRun(f.directory))!.status, 'completed');
});

test('人物准备完成即并发启动衣服线，两条线共用 agent 名额，在组装处汇合', async t => {
  const f = await fixture(t), order: string[] = [];
  let clothingStarted!: () => void;
  const clothing = new Promise<void>(resolve => { clothingStarted = resolve; }), checked = Promise.withResolvers<void>();
  await runTask({ ...f.options, image: 'reference.png', jobs: 3 }, { preflight, execute: async (id, run, context) => {
    order.push('start ' + id);
    assert.equal(context.slots?.limit, 3);
    if (id === 'part-layering') {
      // Still layering the character when the clothing lane starts.
      context.prepared?.(); context.prepared?.();
      await clothing;
      const disk = (await readRun(f.directory))!;
      assert.deepEqual(disk.activeSections, ['part-layering', 'clothing-part-layering']);
      checked.resolve();
    }
    // The clothing lane runs until the character lane has seen both on disk.
    if (id === 'clothing-part-layering') { clothingStarted(); await checked.promise; }
    order.push('end ' + id);
    return { summary: id };
  } });
  assert.ok(order.indexOf('start clothing-part-layering') < order.indexOf('end part-layering'));
  assert.equal(order.filter(item => item === 'start clothing-part-layering').length, 1);
  assert.ok(order.indexOf('start raster-layering') > order.indexOf('end part-layering'));
  assert.ok(order.indexOf('start character-assembly') > Math.max(order.indexOf('end raster-layering'), order.indexOf('end clothing-raster-layering')));
  assert.match(await readFile(join(f.directory, 'workflow.log'), 'utf8'), /路线：part-layering → \[raster-layering ∥ clothing-part-layering → clothing-raster-layering\] → character-assembly → shadow/);
});

test('停止时两条并发管线一起中断，记录各自状态，汇合处不再启动', async t => {
  const f = await fixture(t), controller = new AbortController(), calls: SectionId[] = [];
  let started = 0;
  await assert.rejects(runTask({ ...f.options, image: 'reference.png' }, { preflight, signal: controller.signal, execute: async (id, _run, context) => {
    calls.push(id);
    if (id === 'part-layering') return { summary: id };
    if (++started === 2) controller.abort(new Error('stop test'));
    await new Promise((_resolve, reject) => {
      if (context.signal.aborted) reject(context.signal.reason);
      else context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true });
    });
    return { summary: id };
  } }), /stop test/);
  assert.deepEqual([...calls].sort(), ['clothing-part-layering', 'part-layering', 'raster-layering']);
  const run = (await readRun(f.directory))!;
  assert.equal(run.status, 'interrupted');
  assert.deepEqual(run.activeSections, ['raster-layering', 'clothing-part-layering']);
  assert.equal(run.sections['clothing-raster-layering']!.status, 'pending');
  assert.equal(run.runner!.childPids, undefined);
});

test('手动上游可从组装开始，不伪造此前进度；更换原图不会覆盖已有输入', async t => {
  const f = await fixture(t), calls: SectionId[] = [];
  await runTask({ ...f.options, from: 'character-assembly' }, { preflight, execute: async id => {
    calls.push(id); return { summary: 'assembled' };
  } });
  assert.deepEqual(calls, ['character-assembly', 'shadow']);
  assert.deepEqual(Object.keys((await readRun(f.directory))!.sections), ['character-assembly', 'shadow']);
  await runTask({ ...f.options, image: 'reference.png' }, { preflight, execute: async () => ({ summary: 'ok' }) });
  await writeFile(join(f.directory, 'different.png'), await png('#00f'));
  await assert.rejects(runTask({ ...f.options, image: 'different.png' }), /已有不同的原图/);
  assert.deepEqual(await readFile(join(f.directory, 'input/original.png')), originalImage);
});

test('Krita 不可用时拒绝启动且不改动任务记录；用 --krita 重新指定后继续', async t => {
  const f = await fixture(t);
  const refuse = { execute: async () => assert.fail('preflight must stop production') };
  await assert.rejects(runTask({ name: 'case', dir: f.options.dir, image: 'reference.png' }, refuse), /没有记录 Krita 路径[\s\S]*--krita/);
  await assert.rejects(readFile(join(f.directory, 'run.json')), { code: 'ENOENT' });
  assert.match(await readFile(join(f.directory, 'workflow.log'), 'utf8'), /--krita/);
  await runTask({ ...f.options, image: 'reference.png', to: 'part-layering' }, { ...refuse, execute: async () => ({ summary: 'ok' }) });
  const before = await readFile(join(f.directory, 'run.json'), 'utf8');
  const broken = async () => { throw new Error('Krita无法启动'); };
  await assert.rejects(runTask({ name: 'case', dir: f.options.dir, to: 'shadow' }, { ...refuse, preflight: broken }),
    error => /记录的 Krita 不可用：/.test(String(error)) && /Krita无法启动/.test(String(error)) && /--krita/.test(String(error)));
  await assert.rejects(runTask({ name: 'case', dir: f.options.dir, to: 'shadow', krita: 'other-krita' }, { ...refuse, preflight: broken }), /指定的 Krita 不可用：.*other-krita/);
  assert.equal(await readFile(join(f.directory, 'run.json'), 'utf8'), before, '拒绝启动不能记录失败状态或错误路径');
  await runTask({ name: 'case', dir: f.options.dir, to: 'shadow' }, { preflight, execute: async () => ({ summary: 'ok' }) });
  assert.equal((await readRun(f.directory))!.krita, process.execPath);
});

test('Linux 无桌面且缺 Xvfb：不当成 Krita 路径问题，任务记为失败，workflow.log 首行给安装和继续提示；装好后继续即运行', { skip: process.platform !== 'linux' }, async t => {
  const f = await fixture(t);
  await runTask({ ...f.options, image: 'reference.png', to: 'part-layering' }, { preflight, execute: async () => ({ summary: 'ok' }) });
  const headless = (path: string) => checkKrita(path, { PATH: '' });
  // The workbench and CLI pre-start check let it through, so the run records it.
  assert.equal(await preflightKrita({ name: 'case', dir: f.options.dir, to: 'shadow' }, headless), undefined);
  await assert.rejects(runTask({ name: 'case', dir: f.options.dir, to: 'shadow' }, { preflight: headless, execute: async () => assert.fail('缺依赖时不能开始生产') }),
    error => error instanceof MissingDependencyError);
  const failed = (await readRun(f.directory))!;
  assert.equal(failed.status, 'failed'); assert.equal(failed.krita, process.execPath);
  assert.match(failed.error!.split('\n')[0], /找不到虚拟桌面 Xvfb.*apt install xvfb.*ASTRA_STUDIO_XVFB.*在网页点「继续」（命令行 --continue）/);
  assert.doesNotMatch(failed.error!, /重新指定 Krita/);
  const log = await readFile(join(f.directory, 'workflow.log'), 'utf8');
  assert.match(log, /找不到虚拟桌面 Xvfb[^\n]*在网页点「继续」/);
  await runTask({ name: 'case', dir: f.options.dir, to: 'shadow' }, { preflight: path => checkKrita(path, { PATH: '', DISPLAY: ':1' }), execute: async () => ({ summary: 'ok' }) });
  assert.equal((await readRun(f.directory))!.status, 'completed');
});

test('同名任务锁阻止重复启动，取消保留状态并释放锁', async t => {
  const f = await fixture(t);
  const release = await acquireTaskLock(f.directory);
  await assert.rejects(runTask(f.options), /不能重复启动/);
  await release();
  const controller = new AbortController();
  await assert.rejects(runTask(f.options, { preflight, signal: controller.signal, execute: async () => {
    controller.abort(new Error('cancelled')); controller.signal.throwIfAborted();
    return { summary: 'unreachable' };
  } }), /cancelled/);
  assert.equal((await taskStatus(f.options)).status, 'interrupted');
  const unlock = await acquireTaskLock(f.directory); await unlock();
});

test('--knowledge 记入 run.json，续跑省略沿用；缺失文件时拒绝启动，写入 workflow.log 且不改任务记录', async t => {
  const f = await fixture(t);
  t.after(() => selectKnowledge(defaultKnowledgeDirectory));
  const knowledge = join(f.options.dir, 'knowledge');
  await cp(defaultKnowledgeDirectory, knowledge, { recursive: true });
  const done = { preflight, execute: async () => ({ summary: 'ok' }) };
  await runTask({ ...f.options, image: 'reference.png', to: 'part-layering', knowledge }, done);
  assert.equal((await readRun(f.directory))!.knowledge, knowledge);
  assert.equal(knowledgeDirectory(), knowledge);
  const before = await readFile(join(f.directory, 'run.json'), 'utf8');
  await rm(join(knowledge, 'shared/prompts/runtime/interrupted-task.md'));
  await assert.rejects(runTask({ name: 'case', dir: f.options.dir, to: 'part-layering' }, done), /先验知识缺少文件：.*interrupted-task\.md/);
  assert.equal(await readFile(join(f.directory, 'run.json'), 'utf8'), before, '拒绝启动不能改动任务记录');
  assert.match(await readFile(join(f.directory, 'workflow.log'), 'utf8'), /先验知识缺少文件：.*interrupted-task\.md/);
});

test('CLI 区分只读查询、后台启动和恢复，拒绝冲突参数', () => {
  assert.equal(parseArguments(['--name', 'case', '--status', '--json']).mode, 'status');
  assert.equal(parseArguments(['--name', 'case', '--background']).mode, 'background');
  for (const args of [ ['--name', 'case', '--dir', 'relative'], ['--name', 'case', '--json'],
    ['--name', 'case', '--status', '--background'], ['--name', 'case', '--status', '--image', 'x'],
    ['--name', 'case', '--jobs', '0'],
    ['--name', 'case', '--standard', '--no-standard'], ['--name', 'case', '--status', '--standard'],
    ['--name', 'case', '--status', '--no-standard'] ]) {
    assert.throws(() => parseArguments(args));
  }
});

test('CLI 与网页操作对应：继续、恢复、重试、停止，可指定单个步骤', () => {
  const parse = (...args: string[]) => parseArguments(['--name', 'case', ...args]) as any;
  assert.deepEqual(parse('--retry').action, { action: 'retry', section: undefined, step: '' });
  assert.equal(parse('--retry').mode, 'run');
  assert.deepEqual([parse('--resume', '--background').mode, parse('--resume', '--background').action.action], ['background', 'resume']);
  assert.equal(parse('--continue', '--krita', '/opt/krita').options.krita, '/opt/krita');
  assert.equal(parse('--resume', '--knowledge', '/opt/knowledge').options.knowledge, '/opt/knowledge');
  assert.deepEqual(parse('--retry', '--section', 'part-layering', '--step', 'step11_completion/head').action,
    { action: 'retry', section: 'part-layering', step: 'step11_completion/head' });
  assert.deepEqual(parse('--continue', '--section', 'shadow').action, { action: 'continue', section: 'shadow', step: '' });
  assert.equal(parse('--stop').mode, 'stop');
  assert.equal(parse().action, undefined);
  for (const args of [['--resume', '--retry'], ['--section', 'shadow'], ['--retry', '--step', 'step01'],
    ['--retry', '--section', 'shadow'], ['--retry', '--section', 'unknown', '--step', 'step01'],
    ['--stop', '--krita', 'x'], ['--stop', '--knowledge', 'x'], ['--status', '--knowledge', 'x'], ['--stop', '--background'], ['--stop', '--retry'], ['--status', '--retry']]) {
    assert.throws(() => parse(...args), Error, args.join(' '));
  }
});

test('CLI 恢复与重试先检查 Krita，不可用则拒绝且不改动步骤', async t => {
  const f = await fixture(t), dir = f.options.dir!;
  const session = join(f.directory, 'part-layering/agents/steps/step11_completion/head/session.json');
  await mkdir(join(f.directory, 'part-layering/step11_completion/head'), { recursive: true });
  await writeFile(join(f.directory, 'part-layering/step11_completion/head/.running'), JSON.stringify({ inputs: {} }));
  await mkdir(join(session, '..'), { recursive: true }); await writeFile(session, JSON.stringify({ threadId: 'thread-1' }));
  for (const action of ['--resume', '--retry']) {
    await assert.rejects(main(['--name', 'case', '--dir', dir, action]), /没有记录 Krita 路径[\s\S]*--krita/);
    await assert.rejects(main(['--name', 'case', '--dir', dir, action, '--krita', join(f.directory, 'missing-krita')]), /指定的 Krita 不可用[\s\S]*不存在或不可执行[\s\S]*--krita/);
  }
  assert.equal(JSON.parse(await readFile(session, 'utf8')).threadId, 'thread-1');
  assert.equal(await readFile(join(f.directory, 'part-layering/step11_completion/head/.running'), 'utf8'), JSON.stringify({ inputs: {} }));
  await assert.rejects(main(['--name', 'case', '--dir', dir, '--stop']), /缺少总控记录/);
});

test('标准化选项保持未指定、开启和关闭的区别，只由总控记录，不读取 part 步骤产物', async t => {
  for (const [flags, expected] of [[[], undefined], [['--standard'], true], [['--no-standard'], false]] as const) {
    const parsed = parseArguments(['--name', 'case', ...flags]);
    assert.notEqual(parsed.mode, 'help');
    if (parsed.mode !== 'help') assert.equal(parsed.options.standard, expected);
  }
  const f = await fixture(t);
  assert.equal((await configureRun(f.options, f.directory)).standard, false);
  const options = join(f.directory, 'part-layering/step02_options');
  await mkdir(options, { recursive: true });
  await writeFile(join(options, 'options.json'), JSON.stringify({ standard: true }));
  assert.equal((await configureRun(f.options, f.directory)).standard, false);
  assert.equal((await configureRun({ ...f.options, standard: false }, f.directory)).standard, false);
  await assert.rejects(configureRun({ ...f.options, from: 'character-assembly', standard: true }, f.directory), /需要本次路线包含 part-layering/);
  await assert.rejects(configureRun({ ...f.options, from: 'character-assembly', standard: false }, f.directory), /需要本次路线包含 part-layering/);
});


test('绘画中断后总控不重进已完成 part 管线，沿用新增结构', async t => {
  for (const [part, raster] of [['part-layering', 'raster-layering'], ['clothing-part-layering', 'clothing-raster-layering']] as const) {
    const f = await fixture(t);
    const options = { ...f.options, from: part, to: raster };
    const file = join(f.directory, part, 'groups.json');
    await assert.rejects(runTask(options, { preflight, execute: async id => {
      if (id === part) { await mkdir(join(f.directory, part)); await writeFile(file, 'original'); return { summary: 'complete' }; }
      await writeFile(file, 'drawing corrected structure');
      throw new Error('drawing interrupted');
    } }), /drawing interrupted/);
    const calls: string[] = [];
    await runTask(options, { preflight, execute: async id => {
      calls.push(id);
      assert.equal(await readFile(file, 'utf8'), 'drawing corrected structure');
      return { summary: 'complete' };
    } });
    assert.deepEqual(calls, [raster]);
  }
});

test('素体未换装时跳过衣服拆分与衣服绘制，记为已完成后继续组装和阴影', async t => {
  const f = await fixture(t), executed: SectionId[] = [];
  const execute = async (id: SectionId) => {
    executed.push(id);
    if (id === 'part-layering') await markBaseStep(f.directory, false);
    return { summary: id };
  };
  const run = await runTask({ ...f.options, image: 'reference.png' }, { preflight, execute });
  assert.deepEqual(executed, ['part-layering', 'raster-layering', 'character-assembly', 'shadow']);
  for (const id of ['clothing-part-layering', 'clothing-raster-layering'] as const) {
    assert.equal(run.sections[id]?.status, 'completed'); assert.equal(run.sections[id]?.skipped, true);
    assert.match(run.sections[id]!.summary!, /没有衣服需要拆分和绘制/);
  }
  assert.equal(run.status, 'completed');
  // A rerun of the base step that dresses the subject runs the clothing lane again.
  executed.length = 0;
  await markBaseStep(f.directory, true);
  const dressed = await runTask({ name: 'case', dir: f.options.dir }, { preflight, execute: async id => { executed.push(id); return { summary: id }; } });
  // part-layering stays as drawn: its raster stage has started.
  assert.deepEqual(executed, sectionIds.slice(1));
  assert.equal(dressed.sections['clothing-part-layering']?.skipped, undefined);
});
