import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { pipelineIds, type PipelineId } from '../../shared/paths.ts';
import { runTask } from '../runner.ts';
import { acquireTaskLock, configureRun, directoryFor, readRun, saveRun, taskStatus } from '../state.ts';
import { parseArguments, startBackground } from '../run.ts';

async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'live2d-runner-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const options = { name: 'case', dir, krita: process.execPath };
  const directory = directoryFor(options);
  await mkdir(directory);
  await writeFile(join(directory, 'reference.png'), 'original-image');
  return { options, directory };
}
const preflight = async (executable: string) => ({ executable, version: 'test' });

test('物理参考路径保存在总控并在无重复参数的续跑中保留',async t=>{
 const f=await fixture(t),parsed=parseArguments(['--name','case','--dir',f.options.dir,'--physics','--physics-reference','approved.json']);
 assert('options' in parsed);const run=await configureRun({...f.options,...parsed.options},f.directory);assert.equal(run.physicsReference,join(f.directory,'approved.json'));await saveRun(f.directory,run);
 const resumed=await configureRun(f.options,f.directory);assert.equal(resumed.physicsReference,run.physicsReference);
});

test('状态保存失败不能切断后续 agent 日志、状态和阶段推进', async t => {
  const f = await fixture(t);
  let injected = false;
  await runTask({ ...f.options, from: 'part-layering', to: 'part-layering' }, {
    save: async (directory, run) => {
      if (run.lastMessage === '[hair] 第一条消息' && !injected) {
        injected = true;
        throw Object.assign(new Error('模拟 Windows 文件占用'), { code: 'EPERM' });
      }
      await saveRun(directory, run);
    },
    execute: async (_id, _run, context) => {
      context.progress('[hair] 第一条消息');
      context.progress('[hair] 写入草稿成功');
      return { summary: '完成' };
    },
  });
  assert.equal(injected, true);
  const log = await readFile(join(f.directory, 'workflow.log'), 'utf8');
  assert.match(log, /状态保存失败.*模拟 Windows 文件占用/);
  assert.equal(log.match(/\[hair\] 写入草稿成功/g)?.length, 1);
  assert.match(log, /所选路线已完成/);
  assert.equal((await readRun(f.directory, 'case'))?.status, 'completed');
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
  await assert.rejects(startBackground({ ...f.options, from: 'raster-layering', to: 'raster-layering' }), /Krita|krita/);
  assert.match(await readFile(join(f.directory, 'workflow.log'), 'utf8'), /Krita|krita/);
  assert.equal((await readdir(f.directory)).includes('service.log'), false);
});

test('总控保留输入与配置，严格按序推进；后续仅用 name 和 dir 恢复', async t => {
  const f = await fixture(t), first: PipelineId[] = [], second: PipelineId[] = [];
  await runTask({ ...f.options, image: 'reference.png', jobs: 2, standard: true }, { preflight, execute: async (id, run) => {
    first.push(id);
    const disk = (await readRun(f.directory, 'case'))!;
    assert.equal(disk.activePipeline, id);
    assert.equal(disk.status, 'running');
    assert.equal(run.jobs, 2);
    assert.equal(run.image, join('input', 'original.png'));
    assert.equal(run.standard, true); assert.equal(disk.standard, true);
    return { summary: id, output: join(f.directory, id, 'output') };
  } });
  assert.deepEqual(first, pipelineIds.filter(id=>id!=='physics'));
  assert.equal(await readFile(join(f.directory, 'input/original.png'), 'utf8'), 'original-image');
  await rm(join(f.directory, 'reference.png'));
  await runTask({ name: 'case', dir: f.options.dir }, { preflight, execute: async (id, run) => {
    second.push(id); assert.equal(run.jobs, 2); assert.equal(run.krita, process.execPath);
    assert.equal(run.standard, true);
    return { summary: '管线自身检查并跳过', output: 'retained' };
  } });
  // Re-enter the pipeline's own authoritative checks, never trust a stale top-level completion alone.
  assert.deepEqual(second, pipelineIds.filter(id => !['part-layering', 'clothing-part-layering','physics'].includes(id)));
  const status = await taskStatus(f.options);
  assert.equal(status.status, 'completed'); assert.equal(status.runnerAlive, false); assert.equal(status.lockHeld, false);
  assert.equal(status.output, 'retained');
});

test('异常停止后续管线并展示模型原因；续跑沿用原始配置', async t => {
  const f = await fixture(t), calls: PipelineId[] = [];
  await assert.rejects(runTask({ ...f.options, image: 'reference.png' }, { preflight, execute: async id => {
    calls.push(id);
    if (id === 'raster-layering') throw new Error('thread=draw-1\n模型最后消息：没有 image_generation 工具');
    return { summary: 'complete' };
  } }), /没有 image_generation/);
  assert.deepEqual(calls, ['part-layering', 'raster-layering']);
  const run = (await readRun(f.directory, 'case'))!;
  assert.equal(run.status, 'failed'); assert.equal(run.activePipeline, 'raster-layering');
  assert.match(run.error!, /thread=draw-1/);
  assert.equal(run.pipelines['clothing-part-layering']!.status, 'pending');
  assert.match(await readFile(join(f.directory, 'workflow.log'), 'utf8'), /模型最后消息/);
  await runTask({ name: 'case', dir: f.options.dir }, { preflight, execute: async () => ({ summary: 'resumed' }) });
  assert.equal((await readRun(f.directory, 'case'))!.status, 'completed');
});

test('手动上游可从组装开始，不伪造此前进度；更换原图不会覆盖已有输入', async t => {
  const f = await fixture(t), calls: PipelineId[] = [];
  await runTask({ ...f.options, from: 'character-assembly' }, { preflight, execute: async id => {
    calls.push(id); return { summary: 'assembled' };
  } });
  assert.deepEqual(calls, ['character-assembly', 'shadow']);
  assert.deepEqual(Object.keys((await readRun(f.directory, 'case'))!.pipelines), ['character-assembly', 'shadow']);
  await runTask({ ...f.options, image: 'reference.png' }, { preflight, execute: async () => ({ summary: 'ok' }) });
  await writeFile(join(f.directory, 'different.png'), 'different image');
  await assert.rejects(runTask({ ...f.options, image: 'different.png' }), /已有不同的原图/);
  assert.equal(await readFile(join(f.directory, 'input/original.png'), 'utf8'), 'original-image');
});

test('Krita 预检先于任何制作且错误可查询；用户可补路径恢复', async t => {
  const f = await fixture(t);
  await assert.rejects(runTask({ name: 'case', dir: f.options.dir, image: 'reference.png' }, {
    execute: async () => assert.fail('preflight must stop production'),
  }), /--krita/);
  const state = await taskStatus(f.options);
  assert.equal(state.status, 'failed'); assert.match(state.error!, /不会自动下载或搜索/);
  await assert.rejects(runTask(f.options, { preflight: async () => { throw new Error('Krita无法启动'); },
    execute: async () => assert.fail('preflight must stop production'),
  }), /Krita无法启动/);
  await runTask(f.options, { preflight, execute: async () => ({ summary: 'ok' }) });
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

test('CLI 区分只读查询、后台启动和恢复，拒绝冲突参数', () => {
  assert.equal(parseArguments(['--name', 'case', '--status', '--json']).mode, 'status');
  assert.equal(parseArguments(['--name', 'case', '--background']).mode, 'background');
  for (const args of [ ['--name', 'case', '--dir', 'relative'], ['--name', 'case', '--json'],
    ['--name', 'case', '--status', '--background'], ['--name', 'case', '--status', '--image', 'x'],
    ['--name', 'case', '--replace-thread', 'raster-layering'], ['--name', 'case', '--jobs', '0'],
    ['--name', 'case', '--standard', '--no-standard'], ['--name', 'case', '--status', '--standard'],
    ['--name', 'case', '--status', '--no-standard'] ]) {
    assert.throws(() => parseArguments(args));
  }
});

test('标准化选项保持未指定、开启和关闭的区别，并继承独立 part 的已存选项', async t => {
  for (const [flags, expected] of [[[], undefined], [['--standard'], true], [['--no-standard'], false]] as const) {
    const parsed = parseArguments(['--name', 'case', ...flags]);
    assert.notEqual(parsed.mode, 'help');
    if (parsed.mode !== 'help') assert.equal(parsed.options.standard, expected);
  }
  const f = await fixture(t);
  assert.equal((await configureRun(f.options, f.directory)).standard, false);
  const refs = join(f.directory, 'part-layering/references');
  await mkdir(refs, { recursive: true });
  await writeFile(join(refs, 'preparation.json'), JSON.stringify({ version: 1, standard: true, files: {} }));
  assert.equal((await configureRun(f.options, f.directory)).standard, true);
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


test('物理是可选末尾阶段，也可独立执行并透传范围',async t=>{
  const f=await fixture(t),calls:PipelineId[]=[];
  await runTask({...f.options,image:'reference.png',physicsEnabled:true,physicsProfile:'all'},{preflight,execute:async(id,run)=>{calls.push(id);assert.equal(run.physicsProfile,'all');return {summary:id};}});
  assert.deepEqual(calls,pipelineIds);
  const parsed=parseArguments(['--name','case','--from','physics','--to','physics','--physics-profile','primary']);
  assert.equal(parsed.options?.physicsProfile,'primary');
});
