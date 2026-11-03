import { readStepSession } from '../../shared/agents/step-session.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { runWorkflow, section, parseRunArguments } from '../run.ts';
import { resolveAssemblyInput, isAssemblyInput } from '../input.ts';
import { steps } from '../steps.ts';
import { formatAgentError } from '../../shared/codex/diagnostics.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { type AgentRequest } from '../../shared/raster/agent.ts';
import { markBaseStep } from '../../shared/tests/dressup-fixture.ts';
import sharp from 'sharp';

async function fixture(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'character-assembly-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const task = join(root, 'case');
  const inputs = {
    characterKra: join(task, 'raster-layering/step03/character-dressup-base.kra'),
    clothingKra: join(task, 'clothing-raster-layering/step02/clothing-soft-edges.kra'),
    simplifiedCharacter: join(task, 'part-layering/references/simplified-subject.png'),
  };
  for (const [kind, path] of Object.entries(inputs)) {
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, kind);
  }
  const output = join(task, 'character-assembly');
  const options = { name: 'case', dir: root, krita: process.execPath };
  const environment = loadWorkflowEnvironment({}, root);
  const deps = { environment, preflight: async (executable: string) => ({ executable }) };
  return { root, task, inputs, output, options, deps };
}
async function deliver(request: AgentRequest) {
  await request.onEvent({ type: 'thread.started', thread_id: request.threadId ?? 'assembly-thread' });
  for (const file of steps[0].requiredFiles) await writeFile(join(request.directory, 'step01', file), 'assembled');
  return { status: 'completed' as const, summary: '已组装并重开核对' };
}

test('按 name 和 dir 定位两份 KRA 与实际扩展名的参考图，不需要 part SVG 或上游会话', async t => {
  const f = await fixture(t);
  assert.deepEqual(await resolveAssemblyInput('case', f.root), f.inputs);
  assert.equal(parseRunArguments(['--name', 'case', '--dir', f.root, '--knowledge', 'knowledge']).dir, f.root);
  assert.equal(isAssemblyInput(f.inputs), true);
  assert.equal(isAssemblyInput({ directory: f.task, parts: f.task }), false);
});

test('每个缺失上游明确给出具体文件和对应管线，不启动 agent', async t => {
  for (const [key, upstream] of [['characterKra', 'raster-layering'], ['clothingKra', 'clothing-raster-layering'],
    ['simplifiedCharacter', 'part-layering']] as const) {
    const f = await fixture(t); await rm(f.inputs[key]);
    await assert.rejects(runWorkflow(f.options, { ...f.deps,
      agent: async () => assert.fail('missing input must not call agent'),
    }), error => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes(` ${upstream} --name`));
      assert.ok(error.message.includes(key === 'simplifiedCharacter'
        ? join(dirname(f.inputs[key]), 'simplified-subject.png') : f.inputs[key]));
      assert.ok(error.message.includes('手动放置'));
      return true;
    });
    await assert.rejects(stat(f.output), { code: 'ENOENT' });
  }
});

test('dry-run 展开组装专用提示词与绝对路径，不混入拆层和深度写回协议', async t => {
  const f = await fixture(t);
  const prompt = await runWorkflow({ ...f.options, dryRun: true }, { ...f.deps,
    agent: async () => assert.fail('dry run must not call agent'),
  });
  // Agents are shown absolute task paths.
  for (const input of Object.values(f.inputs)) assert.ok(prompt.includes(JSON.stringify(input)));
  for (const file of steps[0].requiredFiles) assert.ok(prompt.includes(join(f.output, 'step01', file)));
  assert.match(prompt, /局部修画/);
  assert.match(prompt, /parts 填入要检查的衣物部件路径/);
  assert.match(prompt, /已有部件的发色、材质、笔触、细发丝和描边差异保留/);
  assert.match(prompt, /可关闭的透明度遮罩/);
  assert.match(prompt, /不要随意拆分现有部件或新增绘画层/);
  assert.ok(!prompt.includes('occlusion.json'));
  assert.ok(!prompt.includes('三色控制图'));
  await assert.rejects(stat(f.output), { code: 'ENOENT' });
});

test('只调一次组装 agent，提供像素比对且无 reviewer 和深度工具；完整交付才完成', async t => {
  const f = await fixture(t); let calls = 0;
  const agent = async (request: AgentRequest) => {
    calls++;
    assert.equal(request.directory, f.output);
    assert.equal(request.model, 'gpt-6.1-sol'); assert.equal(request.effort, 'xhigh');
    assert.equal(request.threadId, undefined);
    assert.deepEqual(request.tools?.map(tool => tool.name), ['locate_pixel_differences', 'krita']);
    assert.ok((request.tools?.[0].inputSchema.properties as any).parts);

    await stat(join(f.output, 'step01/.running'));
    return deliver(request);
  };
  assert.equal(section.steps.length, 1); assert.equal(section.steps[0].review, undefined);
  await runWorkflow(f.options, { ...f.deps, agent });
  await stat(join(f.output, 'step01/.completed'));
  await assert.rejects(stat(join(f.output, 'step01/.running')), { code: 'ENOENT' });
  await runWorkflow(f.options, { ...f.deps, agent });
  assert.equal(calls, 1);
  assert.equal((await readStepSession(f.output, 'step01'))?.threadId, 'assembly-thread');
  await assert.rejects(stat(join(f.output, 'run.json')), { code: 'ENOENT' });
  assert.ok(!(await readdir(join(f.output, 'step01'))).some(name => /review|repair/.test(name)));
  for (const [kind, file] of Object.entries(f.inputs)) assert.equal(await readFile(file, 'utf8'), kind);
});

test('中断恢复同一组装 thread；删 completed 重建 thread，只清理组装输出', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'in-progress' });
    await writeFile(join(f.output, 'step01/work.kra'), 'progress');
    throw new Error('interrupted');
  } }), /interrupted/);
  await runWorkflow({ name: 'case', dir: f.root, krita: f.options.krita }, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, 'in-progress');
    assert.equal(await readFile(join(f.output, 'step01/work.kra'), 'utf8'), 'progress');
    return deliver(request);
  } });
  await rm(join(f.output, 'step01/.completed'));
  await runWorkflow({ name: 'case', dir: f.root, krita: f.options.krita }, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, undefined);
    await assert.rejects(stat(join(f.output, 'step01/work.kra')), { code: 'ENOENT' });
    return deliver(request);
  } });
  for (const [kind, file] of Object.entries(f.inputs)) assert.equal(await readFile(file, 'utf8'), kind);
});

test('medium 从环境配置读取，不使用 high 配置或上游绘制 thread', async t => {
  const f = await fixture(t);
  const environment = loadWorkflowEnvironment({
    medium_model: 'gpt-6.1-sol-high', high_model: 'gpt-6-astra-xhigh',
  }, f.root);
  await runWorkflow(f.options, { ...f.deps, environment, agent: async request => {
    assert.equal(request.model, 'gpt-6.1-sol'); assert.equal(request.effort, 'high');
    assert.equal(request.threadId, undefined);
    return deliver(request);
  } });
});

test('正常退出但缺 PNG 时显示最后消息，保留 running 和 thread', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'missing-output' });
    await writeFile(join(f.output, 'step01/character-assembled.kra'), 'draft');
    return { status: 'completed', summary: 'PNG 导出失败' };
  } }), error => {
    assert.match(formatAgentError(error), /character-assembled.png[\s\S]*PNG 导出失败/);
    return true;
  });
  await stat(join(f.output, 'step01/.running'));
  await assert.rejects(stat(join(f.output, 'step01/.completed')), { code: 'ENOENT' });
  assert.match(await readFile(join(f.output, 'agents/steps/step01/error.txt'), 'utf8'), /PNG 导出失败/);
  assert.equal((await readStepSession(f.output, 'step01'))?.threadId, 'missing-output');
});

test('素体未换装时不需要衣服 KRA，不调用 agent，直接复制人物结果作为组装交付', async t => {
  const f = await fixture(t);
  await markBaseStep(f.task, false);
  await rm(dirname(dirname(f.inputs.clothingKra)), { recursive: true });
  const characterPng = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#8040c0' } }).png().toBuffer();
  await writeFile(f.inputs.characterKra.replace(/\.kra$/, '.png'), characterPng);
  const agent = async () => assert.fail('no clothing: assembly must not call agent');
  await runWorkflow(f.options, { ...f.deps, agent });
  assert.equal(await readFile(join(f.output, 'step01/character-assembled.kra'), 'utf8'), 'characterKra');
  assert.deepEqual(await readFile(join(f.output, 'step01/character-assembled.png')), characterPng);
  assert.match(await readFile(join(f.output, 'step01/report.md'), 'utf8'), /没有衣服需要组装/);
  await stat(join(f.output, 'step01/.completed'));
  await runWorkflow(f.options, { ...f.deps, agent });
});

test('旧任务未换装但已画出衣服 KRA 时继续按原输入组装，不改变已完成的输入', async t => {
  const f = await fixture(t);
  await markBaseStep(f.task, false);
  assert.deepEqual(await resolveAssemblyInput('case', f.root), f.inputs);
  await markBaseStep(f.task, true);
  await rm(f.inputs.clothingKra);
  await assert.rejects(resolveAssemblyInput('case', f.root), /clothing-raster-layering/);
});
