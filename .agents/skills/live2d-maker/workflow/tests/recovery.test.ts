import {staticPromptPrefix} from '../../shared/tests/prompt-prefix.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { runWorkflow as assemble } from '../../character-assembly/run.ts';
import { isAssemblyInput } from '../../character-assembly/input.ts';
import { steps as assemblySteps } from '../../character-assembly/steps.ts';
import { runWorkflow as raster } from '../../raster-layering/run.ts';
import { steps as rasterSteps } from '../../raster-layering/steps.ts';
import { runWorkflow as clothing } from '../../clothing-raster-layering/run.ts';
import { steps as clothingSteps } from '../../clothing-raster-layering/steps.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { loadConfig } from '../../shared/raster/run-store.ts';
import { seedUpstream } from '../../shared/tests/upstream-fixture.ts';
import type { AgentRequest } from '../../shared/raster/agent.ts';
import type { StepDefinition } from '../../shared/raster/steps.ts';
import { acquireTaskLock } from '../state.ts';
import { replaceThread } from '../recovery.ts';

test('物理复核换会话保留已完成绑定、完整轨迹和当前贴图，不改步骤标记', async t => {
  const f = await fixture(t), target = join(f.task, 'physics');
  const files = {
    'step01/.completed': 'analysis complete', 'step02/.completed': 'binding complete',
    'step02/physics.draft.json': 'source-matched binding', 'step03/.running': 'review pending',
    'step03/evidence/manifest.json': 'current simulation manifest',
    'step03/evidence/tip-impulse/trace.jsonl.gz': 'complete recorded commands and meshes',
    'preview/normal.png': 'real normal map', 'preview/depth.png': 'real depth map',
    'step03/prompt.md': 'previous review prompt',
  };
  for (const [file, bytes] of Object.entries(files)) {
    await mkdir(dirname(join(target, file)), { recursive: true });
    await writeFile(join(target, file), bytes);
  }
  await writeFile(join(target, 'run.json'), JSON.stringify({ version: 2, name: 'case', threadId: 'old-physics-review', threadStep: 'step03',
    sourceInput: { task: f.task, document: 'source.kra', color: 'source.png', profile: 'all', structures: [] },
    krita: { executable: process.execPath, version: 'test' }, models: { step03: { model: 'gpt-6-astra', effort: 'xhigh' } } }));
  await writeFile(join(f.task, 'handoff.md'), '真实两图已补齐，同指纹完整数值轨迹保留，继续重渲染并实际看图。');
  const archive = await replaceThread({ ...f.recovery, pipeline: 'physics' });
  const config = JSON.parse(await readFile(join(target, 'run.json'), 'utf8'));
  assert.equal(config.threadId, null);
  assert.equal(config.threadStep, 'step03');
  assert.equal(config.threadHandoff.previousThreadId, 'old-physics-review');
  assert.match(await readFile(config.threadHandoff.notes, 'utf8'), /完整数值轨迹保留/);
  assert.equal(JSON.parse(await readFile(join(archive, 'run-before.json'), 'utf8')).threadId, 'old-physics-review');
  for (const [file, bytes] of Object.entries(files)) assert.equal(await readFile(join(target, file), 'utf8'), bytes);
  await assert.rejects(readFile(join(target, 'step03/.completed')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(target, 'physics.json')), { code: 'ENOENT' });
});

test('阴影恢复按保存模式替换当前会话，保留另一分支与已生成贴图', async t => {
  for (const mode of ['normal-depth', 'mask'] as const) {
    const f = await fixture(t), target = join(f.task, 'shadow', mode), other = join(f.task, 'shadow', mode === 'mask' ? 'normal-depth' : 'mask');
    await mkdir(join(target, 'step01'), { recursive: true }); await mkdir(join(other, 'step01'), { recursive: true });
    const rootRun = { version: 1, name: 'case', dir: f.dir, from: 'shadow', to: 'shadow', jobs: 1, status: 'interrupted', pipelines: {}, shadowMode: mode };
    await writeFile(join(f.task, 'run.json'), JSON.stringify(rootRun));
    await writeFile(join(target, 'run.json'), JSON.stringify({ version: 2, name: 'case', threadId: 'old-shadow',
      sourceInput: { characterKra: 'source.kra', characterColor: 'source.png', simplifiedCharacter: 'simplified.png', structureFiles: [] },
      krita: { executable: process.execPath, version: 'test' }, models: { step01: { model: 'gpt-6.1-sol', effort: 'xhigh' } } }));
    await writeFile(join(target, 'step01/.running'), 'running');
    await writeFile(join(target, 'step01/normal.png'), 'existing map');
    await writeFile(join(other, 'run.json'), 'other branch unchanged');
    await writeFile(join(other, 'step01/.completed'), 'completed');
    const archive = await replaceThread({ ...f.recovery, pipeline: 'shadow' });
    assert.ok(archive.startsWith(join(target, 'recovery')));
    assert.equal(JSON.parse(await readFile(join(target, 'run.json'), 'utf8')).threadId, null);
    assert.equal(await readFile(join(target, 'step01/normal.png'), 'utf8'), 'existing map');
    assert.equal(await readFile(join(other, 'run.json'), 'utf8'), 'other branch unchanged');
    assert.equal(await readFile(join(other, 'step01/.completed'), 'utf8'), 'completed');
    assert.equal(await readFile(join(f.task, 'run.json'), 'utf8'), JSON.stringify(rootRun));
  }
});

async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'live2d-recovery-')), name = 'case', task = join(dir, name);
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const file of ['raster-layering/step03/character-dressup-base.kra',
    'clothing-raster-layering/step02/clothing-soft-edges.kra', 'part-layering/references/simplified-subject.png']) {
    await mkdir(dirname(join(task, file)), { recursive: true }); await writeFile(join(task, file), 'upstream');
  }
  await writeFile(join(task, 'handoff.md'), '保留 draft.kra 中完成的衣领，继续导出 PNG 并核对图层。');
  return { dir, task, options: { name, dir, krita: process.execPath },
    deps: { environment: loadWorkflowEnvironment({}, dir), preflight: async (executable: string) => ({ executable, version: 'test' }) },
    recovery: { name, dir, pipeline: 'character-assembly' as const, handoff: 'handoff.md', reason: '会话历史损坏' } };
}
async function deliver(request: AgentRequest, step: StepDefinition, thread = request.threadId ?? 'replacement') {
  await request.onEvent({ type: 'thread.started', thread_id: thread });
  for (const file of step.requiredFiles) {
    await writeFile(join(request.directory, step.id, step.review && file === 'report.md' ? 'report.md.tmp' : file), 'fixture');
  }
  return { status: 'completed' as const, summary: 'done' };
}

test('替换归档旧 thread 并保留全部文件；新绘制接收交接，之后中断续新 thread', async t => {
  const f = await fixture(t), output = join(f.task, 'character-assembly');
  await assert.rejects(assemble(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'old-thread' });
    await writeFile(join(output, 'step01/draft.kra'), 'painted pixels'); throw new Error('history damaged');
  } }), /history damaged/);
  const before = await readdir(join(output, 'step01'));
  const archive = await replaceThread(f.recovery);
  assert.equal(JSON.parse(await readFile(join(archive, 'run-before.json'), 'utf8')).threadId, 'old-thread');
  assert.equal(await readFile(join(archive, 'step01/prompt.md'), 'utf8'), await readFile(join(output, 'step01/prompt.md'), 'utf8'));
  assert.match(await readFile(join(archive, 'step01/error.txt'), 'utf8'), /history damaged/);
  assert.deepEqual(await readdir(join(output, 'step01')), before);
  assert.equal((await loadConfig(output, 'case', isAssemblyInput))!.threadId, null);
  await assert.rejects(assemble(f.options, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, undefined);
    assert.match(request.prompt, /旧 threadId：old-thread/);
    assert.match(request.prompt, /保留 draft.kra 中完成的衣领/);
    assert.ok(request.prompt.startsWith(staticPromptPrefix(await readFile(assemblySteps[0].prompt, 'utf8'))));
    await request.onEvent({ type: 'thread.started', thread_id: 'new-thread' });
    throw new Error('interrupted again');
  } }), /interrupted again/);
  const config = (await loadConfig(output, 'case', isAssemblyInput))!;
  assert.equal(config.threadId, 'new-thread'); assert.equal(config.threadHandoff!.replacementThreadId, 'new-thread');
  await assemble(f.options, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, 'new-thread');
    assert.ok(!request.prompt.includes('会话恢复交接'));
    return deliver(request, assemblySteps[0]);
  } });
  assert.equal(await readFile(join(output, 'step01/draft.kra'), 'utf8'), 'painted pixels');
  await assert.rejects(replaceThread(f.recovery), /没有 .running/);
  // Deliberately deleting completion is still a full reset, not a handoff.
  await rm(join(output, 'step01/.completed'));
  await assert.rejects(replaceThread(f.recovery), /已请求重跑/);
  await assemble(f.options, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, undefined); assert.ok(!request.prompt.includes('会话恢复交接'));
    await assert.rejects(readFile(join(output, 'step01/draft.kra')), { code: 'ENOENT' });
    return deliver(request, assemblySteps[0], 'reset-thread');
  } });
  assert.equal((await loadConfig(output, 'case', isAssemblyInput))!.threadHandoff, undefined);
  await readFile(join(archive, 'run-before.json'));
});

test('锁定时不允许换 thread，空交接和 part 也被拒绝', async t => {
  const f = await fixture(t), unlock = await acquireTaskLock(f.task);
  await assert.rejects(replaceThread(f.recovery), /不能重复启动/);
  await unlock();
  await assert.rejects(replaceThread({ ...f.recovery, pipeline: 'part-layering' }), /仅适用于/);
  await assert.rejects(replaceThread({ ...f.recovery, reason: ' ' }), /非空/);
  await assert.rejects(assemble(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'old-thread' }); throw new Error('stop');
  } }));
  await writeFile(join(f.task, 'handoff.md'), '  ');
  await assert.rejects(replaceThread(f.recovery), /不能为空/);
});

for (const [pipeline, execute, definitions, upstream] of [
  ['raster-layering', raster, rasterSteps, 'part-layering'],
  ['clothing-raster-layering', clothing, clothingSteps, 'clothing-part-layering'],
] as const) {
  test(pipeline + ' 换 thread 接续修复包含原任务，reviewer 仍全新且第二轮修完结束', async t => {
    const dir = await mkdtemp(join(tmpdir(), 'review-recovery-')), name = 'case', task = join(dir, name);
    t.after(() => rm(dir, { recursive: true, force: true }));
    await seedUpstream(name, upstream, dir);
    const options = { name, dir, krita: process.execPath }, output = join(task, pipeline);
    const deps = { environment: loadWorkflowEnvironment({}, dir), steps: definitions.slice(0, 2),
      preflight: async (executable: string) => ({ executable, version: 'test' }) };
    let call = 0;
    await assert.rejects(execute(options, { ...deps, agent: async request => {
      call++;
      if (call === 1) return deliver(request, definitions[0], 'original');
      if (call === 2) {
        assert.equal(request.threadId, undefined);
        await writeFile(join(output, 'step01/review-01.md.tmp'), '结论：需要修复\n袖口残色。');
        return { status: 'completed', summary: 'reviewed' };
      }
      assert.equal(call, 3); assert.equal(request.threadId, 'original'); throw new Error('broken context');
    } }), /broken context/);
    await writeFile(join(task, 'handoff.md'), '当前在修复 review-01 的袖口残色；保留绘制。');
    const report = await readFile(join(output, 'step01/review-01.md'));
    await replaceThread({ name, dir, pipeline, handoff: 'handoff.md', reason: 'broken context' });
    let resumed = 0;
    await execute(options, { ...deps, agent: async request => {
      resumed++;
      if (resumed === 1) {
        assert.equal(request.threadId, undefined);
        const original = (await readFile(definitions[0].prompt, 'utf8')).replaceAll('step01/report.md', 'step01/report.md.tmp');
        assert.ok(request.prompt.startsWith(staticPromptPrefix(original)));
        assert.match(request.prompt, /repair-01.md.tmp/); assert.match(request.prompt, /保留绘制/);
        await request.onEvent({ type: 'thread.started', thread_id: 'replacement-draw' });
        await writeFile(join(output, 'step01/repair-01.md.tmp'), '结论：已修复\n袖口已修画。');
      } else if (resumed === 2) {
        assert.equal(request.threadId, undefined); assert.ok(!request.prompt.includes('会话恢复交接'));
        await request.onEvent({ type: 'thread.started', thread_id: 'fresh-review' });
        await writeFile(join(output, 'step01/review-02.md.tmp'), '结论：需要修复\n领口需修画。');
      } else if (resumed === 3) {
        assert.equal(resumed, 3); assert.equal(request.threadId, 'replacement-draw');
        await writeFile(join(output, 'step01/repair-02.md.tmp'), '结论：已修复\n领口已修画。');
      }
      if (resumed === 4) return deliver(request, definitions[1], 'replacement-draw');
      return { status: 'completed', summary: 'done' };
    } });
    assert.equal(resumed, 4); assert.deepEqual(await readFile(join(output, 'step01/review-01.md')), report);
    await readFile(join(output, 'step01/.completed'));
    assert.equal((await loadConfig(output, name))!.threadId, 'replacement-draw');
  });
}
