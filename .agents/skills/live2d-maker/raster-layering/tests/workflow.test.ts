import {staticPromptPrefix} from '../../shared/tests/prompt-prefix.ts';
import { seedUpstream } from '../../shared/tests/upstream-fixture.ts';
import { sectionDirectory } from '../../shared/paths.ts';
const runDirectory = (name: string) => sectionDirectory(name, 'raster-layering');
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Prompt paths are relative to the task root.
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import { rasterAppServer } from '../../shared/tests/raster-app-server.ts';
import { runAgent, type AgentRequest, type StepResult } from '../../shared/raster/agent.ts';
import { checkKrita } from '../../shared/raster/krita.ts';
import { resolvePartInput } from '../../shared/raster/input.ts';
import { parseRunArguments } from '../run.ts';
import { inspectRun } from '../../shared/raster/run-store.ts';
import { readStepSession } from '../../shared/agents/step-session.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { steps, stepModels, type StepDefinition } from '../steps.ts';
import { runWorkflow } from '../run.ts';
import { markBaseStep } from '../../shared/tests/dressup-fixture.ts';
import { stepKnowledge } from '../../shared/knowledge.ts';
const mainPrompt = (step: { knowledge: { section: string; step: string } }) => stepKnowledge(step.knowledge.section, step.knowledge.step).files('main')[0];

const preflight = async (executable: string) => ({ executable });
const complete: StepResult = { status: 'completed', summary: 'Fixture delivery' };
const forbidden = async (): Promise<never> => { assert.fail('must not call agent/preflight'); };
async function absent(path: string) { await assert.rejects(readFile(path), { code: 'ENOENT' }); }
const threadOf = async (directory: string, step = 'step01') => (await readStepSession(directory, step))?.threadId;
async function fixture(t: TestContext) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'raster-workflow-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runsDirectory = join(directory, 'runs'), name = 'test';
  const input = await seedUpstream(name, 'part-layering', runsDirectory);
  await mkdir(join(input, 'parts'), { recursive: true });
  await mkdir(join(input, 'references'), { recursive: true });
  await writeFile(join(input, 'parts/face.svg'), 'source part');
  await writeFile(join(input, 'references/source.png'), 'source image');
  await writeFile(join(input, 'preview.svg'), 'preview');
  const definitions = steps.map((step: StepDefinition) => {
    const { review: _review, ...drawing } = step;
    return drawing;
  });
  return { directory, input, output: join(runsDirectory, name, 'raster-layering'), definitions,
    options: { name, krita: process.execPath }, resume: { name, krita: process.execPath }, deps: { environment: loadWorkflowEnvironment({}, directory), runsDirectory, preflight, steps: [definitions[0]] } };
}
async function deliver(request: AgentRequest, step: StepDefinition = { ...steps[0], review: undefined }, thread = request.threadId ?? 'thread-1') {
  await readFile(join(request.directory, step.id, '.running'));
  await request.onEvent({ type: 'thread.started', thread_id: thread });
  assert.equal(await threadOf(request.directory, step.id), thread, 'thread must be persisted during the event');
  for (const file of step.requiredFiles) await writeFile(join(request.directory, step.id, step.review && file === 'report.md' ? 'report.md.tmp' : file), `fixture ${step.id}/${file}`);
  return complete;
}

test('任务名限制为单个目录；默认仓库 .run 任务目录与 cwd 无关，CLI 可只传 --name', () => {
  assert.equal(runDirectory('测试-01'), fileURLToPath(new URL('../../../../../.run/测试-01/raster-layering', import.meta.url)));
  const cwd = process.cwd();
  try {
    process.chdir(tmpdir());
    assert.equal(runDirectory('test'), fileURLToPath(new URL('../../../../../.run/test/raster-layering', import.meta.url)));
  } finally { process.chdir(cwd); }
  for (const name of ['', '.', '..', '../other', '/tmp/other', 'a/b', 'a\\b']) assert.throws(() => runDirectory(name), /--name/);
  assert.equal(parseRunArguments(['--name', 'test', '--knowledge', 'knowledge']).name, 'test');
  // A single section keeps no configuration, so every start names its knowledge.
  assert.throws(() => parseRunArguments(['--name', 'test']), /--knowledge/);
  assert.throws(() => parseRunArguments([]), /--name/);
  assert.throws(() => parseRunArguments(['--check-krita']), /--krita/);
  assert.throws(() => parseRunArguments(['--name', 'test', '--output', 'x']), /Unknown option/);
});

test('Krita 只检查显式路径，失败不探索安装或创建任务', async t => {
  const f = await fixture(t);
  assert.deepEqual(await checkKrita(process.execPath, { DISPLAY: ':1' }), { executable: process.execPath });
  await assert.rejects(checkKrita(join(f.input, 'missing-krita')), /不存在或不可执行/);
  await assert.rejects(checkKrita(''), /明确指定/);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, preflight: async () => { throw new Error('Krita unavailable'); }, agent: forbidden }), /Krita unavailable/);
  await assert.rejects(readdir(f.output), { code: 'ENOENT' });
  await assert.rejects(runWorkflow({ name: 'test' }, f.deps), /必须提供 --krita/);
});

test('dry-run 按 name 定位上游，保留完整提示词，不写文件、不调用模型', async t => {
  const f = await fixture(t);
  const expected = { directory: f.input, parts: join(f.input, 'parts') };
  assert.deepEqual(await resolvePartInput('test', 'part-layering', f.deps.runsDirectory), expected);
  const prompt = await runWorkflow({ ...f.options, dryRun: true }, { ...f.deps, agent: forbidden });
  assert.ok(prompt.startsWith(staticPromptPrefix(await readFile(mainPrompt(steps[0]), 'utf8'))));
  assert.ok(prompt.includes(JSON.stringify(join(f.input, 'parts'))));
  assert.ok(prompt.includes(JSON.stringify(join(f.output, 'step01'))));
  await assert.rejects(readdir(f.output), { code: 'ENOENT' });
});

test('缺少 parts 时在前置检查和模型调用前报错', async t => {
  const f = await fixture(t);
  await rm(join(f.input, 'parts'), { recursive: true });
  await assert.rejects(runWorkflow(f.options, { ...f.deps, preflight: forbidden, agent: forbidden }), /缺少上游产物/);
  await assert.rejects(readdir(f.output), { code: 'ENOENT' });
});

test('step01 绘制和 review 完成后才执行 step02；缺 PNG 保留中断，各步骤各自新建绘制会话，续跑恢复本步骤会话', async t => {
  const f = await fixture(t), deps = { ...f.deps, steps };
  const calls: string[] = [];
  await assert.rejects(runWorkflow(f.options, { ...deps, agent: async request => {
    if (request.prompt.startsWith('你负责对第一步交付')) {
      calls.push('review'); assert.equal(request.threadId, undefined);
      assert.equal(request.tools?.[0].name, 'annotate_review_regions');
      await absent(join(f.output, 'step01/.completed'));
      await absent(join(f.output, 'step02/.running'));
      await request.onEvent({ type: 'thread.started', thread_id: 'fresh-review' });
      await writeFile(join(f.output, 'step01/review-01.md.tmp'), '结论：通过\n完整检查。');
      return complete;
    }
    if (calls.length === 0) { calls.push('step01'); assert.deepEqual(request.tools?.map(tool => tool.name), ['edit_groups', 'edit_occlusion', 'krita']); return deliver(request, steps[0]); }
    calls.push('step02'); assert.equal(request.threadId, undefined); assert.equal(request.tools?.[0].name, 'locate_pixel_differences');
    await request.onEvent({ type: 'thread.started', thread_id: 'thread-step02' });
    await readFile(join(f.output, 'step01/.completed'));
    await writeFile(join(f.output, 'step02/character-soft-edges.kra'), 'partially softened artwork');
    await writeFile(join(f.output, 'step02/report.md'), 'PNG missing'); return complete;
  } }), /缺少有效交付：character-soft-edges.png/);
  assert.deepEqual(calls, ['step01', 'review', 'step02']);
  await readFile(join(f.output, 'step02/.running'));
  await runWorkflow(f.resume, { ...deps, agent: async request => {
    if (request.step === 'raster_step03') {
      calls.push('step03'); assert.equal(request.threadId, undefined); await readFile(join(f.output, 'step02/.completed'));
      assert.ok(request.prompt.startsWith(staticPromptPrefix(await readFile(mainPrompt(steps[2]), 'utf8'))));
      return deliver(request, steps[2]);
    }
    calls.push('resume-step02'); assert.equal(request.threadId, 'thread-step02');
    assert.equal(await readFile(join(f.output, 'step02/character-soft-edges.kra'), 'utf8'), 'partially softened artwork');
    return deliver(request, steps[1]);
  } });
  assert.deepEqual(calls, ['step01', 'review', 'step02', 'resume-step02', 'step03']);
  await absent(join(f.output, 'step02/review-01.md'));
  await readFile(join(f.output, 'step03/.completed'));
  await runWorkflow(f.resume, { ...deps, agent: forbidden });
});

test('已完成第一步的任务可按 name 预览第二步，显示实际输入输出路径且保留完整正文', async t => {
  const f = await fixture(t);
  await runWorkflow(f.options, { ...f.deps, agent: request => deliver(request) });
  const deps = { ...f.deps, steps: f.definitions };
  const prompt = await runWorkflow({ ...f.resume, dryRun: true }, { ...deps, agent: forbidden });
  assert.ok(prompt.startsWith(staticPromptPrefix(await readFile(mainPrompt(steps[1]), 'utf8'))));
  assert.ok(prompt.includes(JSON.stringify(join(f.input, 'references'))));
  assert.ok(prompt.includes(JSON.stringify(join(f.output, 'step01/character-depth.kra'))));
  assert.ok(prompt.includes(JSON.stringify(join(f.output, 'step02/character-soft-edges.kra'))));
  assert.ok(prompt.includes(JSON.stringify(join(f.output, 'step02/character-soft-edges.png'))));
  assert.ok(!prompt.includes(process.execPath), 'Krita 只经 krita 工具使用，路径不进提示词');
  assert.ok(!prompt.includes('demos/soft-edge-krita'), '不引用历史示例工程');
  await assert.rejects(readdir(join(f.output, 'step02')), { code: 'ENOENT' });
});

test('直接读取上游；中断保留 .running、产物和 thread；只用 name 续跑', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    assert.equal(request.model, 'gpt-6.1-sol');
    assert.equal(request.effort, 'xhigh');
    await readFile(join(f.output, 'step01/.running'));
    await request.onEvent({ type: 'thread.started', thread_id: 'thread-1' });
    assert.equal(await threadOf(f.output), 'thread-1');
    await writeFile(join(f.output, 'step01/accepted-part.png'), 'keep this work');
    throw new Error('connection lost');
  } }), /connection lost/);
  await absent(join(f.output, 'run.json'));
  assert.equal(await threadOf(f.output), 'thread-1');
  await assert.rejects(readdir(join(f.output, 'input')), { code: 'ENOENT' });
  await writeFile(join(f.input, 'parts/face.svg'), 'corrected upstream part');
  await runWorkflow(f.resume, { ...f.deps, preflight: async path => {
    assert.equal(path, process.execPath);
    return preflight(path);
  }, agent: async request => {
    assert.equal(request.threadId, 'thread-1');
    assert.equal(await readFile(join(f.input, 'parts/face.svg'), 'utf8'), 'corrected upstream part');
    assert.equal(await readFile(join(f.output, 'step01/accepted-part.png'), 'utf8'), 'keep this work');
    return deliver(request);
  } });
  await readFile(join(f.output, 'step01/.completed'));
  await absent(join(f.output, 'step01/.running'));
  await runWorkflow(f.resume, { ...f.deps, agent: forbidden });
  assert.equal((await readFile(join(f.output, 'agents/steps/step01/attempts.jsonl'), 'utf8')).trim().split('\n').length, 2);
  await assert.rejects(readdir(join(f.output, 'step02')), { code: 'ENOENT' });
});

test('已完成第一步的任务接续后两步，各步新建 thread 并使用各步模型配置', async t => {
  const f = await fixture(t);
  await runWorkflow(f.options, { ...f.deps, agent: request => deliver(request) });
  let index = 1;
  await runWorkflow(f.resume, { ...f.deps, steps: f.definitions, agent: async request => {
    const step = f.definitions[index++];
    assert.equal(request.threadId, undefined);
    assert.equal(request.model, step.model);
    assert.equal(request.effort, 'medium');
    assert.ok(request.prompt.includes(JSON.stringify(join(f.output, 'step01/report.md'))));
    return deliver(request, step);
  } });
  assert.equal(index, 3);
  for (const step of f.definitions) {
    await readFile(join(f.output, step.id, '.completed'));
    await absent(join(f.output, step.id, '.running'));
  }
});

test('残留的旧管线 run.json 不被读取或改写；使用当前环境模型，保留会话、产物与请求历史', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'thread-1' });
    await writeFile(join(f.output, 'step01/accepted-part.png'), 'retained pixels');
    throw new Error('interrupted');
  } }), /interrupted/);
  const file = join(f.output, 'run.json');
  await writeFile(file, JSON.stringify({ version: 2, name: 'test', sourceInput: { directory: '/elsewhere', parts: '/elsewhere/parts' },
    krita: { executable: '/retired/krita' }, models: { step01: { model: 'retired-model', effort: 'obsolete' } } }));
  const before = await readFile(file);
  const environment = loadWorkflowEnvironment({ raster_step01_agent_model: 'gpt-6.1-sol-low' });
  await runWorkflow({ ...f.resume, dryRun: true }, { ...f.deps, environment, agent: forbidden });
  assert.deepEqual(await readFile(file), before);
  await runWorkflow(f.resume, { ...f.deps, environment, agent: async request => {
    assert.equal(request.model, 'gpt-6.1-sol'); assert.equal(request.effort, 'low');
    assert.equal(request.threadId, 'thread-1');
    assert.equal(await readFile(join(f.output, 'step01/accepted-part.png'), 'utf8'), 'retained pixels');
    return deliver(request);
  } });
  assert.deepEqual(await readFile(file), before);
  assert.equal(await threadOf(f.output), 'thread-1');
  const attempts = (await readFile(join(f.output, 'agents/steps/step01/attempts.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].model, 'gpt-6.1-sol');
  assert.equal(attempts[1].model, 'gpt-6.1-sol'); assert.equal(attempts[1].effort, 'low');
});

test('part 终止步骤 occlusion 未完成时拒绝且不动本管线；完成后全部沿用', async t => {
  const f = await fixture(t), occlusion = join(f.input, 'step14_occlusion');
  await mkdir(occlusion);
  await writeFile(join(occlusion, '.completed'), '');
  let index = 0;
  await runWorkflow(f.options, { ...f.deps, steps: f.definitions, agent: request => deliver(request, f.definitions[index++]) });
  await rm(join(occlusion, '.completed'));
  await writeFile(join(occlusion, '.running'), '');
  const before = await readFile(join(f.output, 'step03/.completed'));
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, steps: f.definitions, agent: forbidden }), /上游步骤 part-layering\/step14_occlusion 尚未完成/);
  assert.deepEqual(await readFile(join(f.output, 'step03/.completed')), before);
  await rm(join(occlusion, '.running'));
  await writeFile(join(occlusion, '.completed'), '');
  await runWorkflow(f.resume, { ...f.deps, steps: f.definitions, agent: forbidden });
});

test('模型受阻、缺交付或取消均保留 .running；即使 result.json 写了完成也不能跳过', async t => {
  const f = await fixture(t);
  const start = async (request: AgentRequest) => request.onEvent({ type: 'thread.started', thread_id: 'thread-blocked' });
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    await start(request);
    return { status: 'blocked', summary: 'image tool unavailable' };
  } }), /步骤未完成/);
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, 'thread-blocked');
    return complete;
  } }), /缺少有效交付/);
  await readFile(join(f.output, 'step01/.running'));
  await absent(join(f.output, 'step01/.completed'));
  assert.equal(JSON.parse(await readFile(join(f.output, 'agents/steps/step01/result.json'), 'utf8')).status, 'completed');
  const controller = new AbortController();
  await assert.rejects(runWorkflow({ ...f.resume, signal: controller.signal }, { ...f.deps, agent: async request => {
    await deliver(request);
    controller.abort(new Error('interrupted'));
    return complete;
  } }), /interrupted/);
  await readFile(join(f.output, 'step01/.running'));
  await absent(join(f.output, 'step01/.completed'));
});

test('完成标记保留但交付丢失时明确报错，不悄悄重跑；每次运行使用本次给出的 Krita', async t => {
  const f = await fixture(t);
  await runWorkflow(f.options, { ...f.deps, agent: request => deliver(request) });
  const replacement = join(f.directory, 'explicit-krita');
  await runWorkflow({ ...f.resume, krita: replacement }, { ...f.deps, agent: forbidden, preflight: async path => {
    assert.equal(path, replacement);
    return preflight(path);
  } });
  await assert.rejects(runWorkflow({ name: 'test' }, { ...f.deps, agent: forbidden }), /必须提供 --krita/);
  await rm(join(f.output, 'step01/report.md'));
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: forbidden }), /重试该步骤/);
  await readFile(join(f.output, 'step01/.completed'));
});

test('续跑失败或 SDK 返回不同 thread ID 时保留原会话，不静默新开', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'original' });
    throw new Error('offline');
  } }), /offline/);
  // A resumed session that comes back as another thread is refused, not silently replaced.
  const server = await rasterAppServer(t, JSON.stringify(complete));
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: request => runAgent({ ...request, environment: server.environment }) }), /拒绝替换/);
  const protocol = await server.protocol();
  assert.equal(protocol.filter(message => message.method === 'thread/start').length, 0);
  assert.equal(protocol.find(message => message.method === 'thread/resume').params.threadId, 'original');
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'unexpected' });
    return complete;
  } }), /拒绝替换/);
  assert.equal(await threadOf(f.output), 'original');
  await readFile(join(f.output, 'step01/.running'));
});

test('入口不接受额外输入；符号链接步骤不被递归清理', async t => {
  const f = await fixture(t);
  await runWorkflow(f.options, { ...f.deps, agent: request => deliver(request) });
  const other = join(f.directory, 'other');
  await mkdir(join(other, 'parts'), { recursive: true });
  assert.throws(() => parseRunArguments(['--name', 'test', '--input', other]), /Unknown option/);
  await rm(join(f.output, 'step01'), { recursive: true });
  await symlink(other, join(f.output, 'step01'), 'dir');
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: forbidden }), /步骤路径必须是普通目录/);
  assert.deepEqual(await readdir(other), ['parts']);
});

test('raster 使用指定模型与 reasoning；临时 error 等待 CLI 终态，失败流不冒充成功', async t => {
  const server = await rasterAppServer(t, JSON.stringify(complete), { nativeReconnect: true });
  const received: string[] = [];
  const request: AgentRequest = { prompt: 'test', directory: server.directory, ...stepModels[1], environment: server.environment,
    onEvent: async e => { received.push(e.type); } };
  assert.deepEqual(await runAgent(request), complete);
  const protocol = await server.protocol();
  assert.equal(protocol.find(message => message.method === 'thread/start').params.model, 'gpt-6.1-sol');
  assert.equal(protocol.find(message => message.method === 'turn/start').params.effort, 'xhigh');
  assert.deepEqual(received, ['thread.started', 'item.completed']);
  const failed = await rasterAppServer(t, '', {}, 'failed');
  await assert.rejects(runAgent({ ...request, environment: failed.environment, threadId: 'thread-2' }), /测试回合失败/);
  assert.equal((await failed.protocol()).find(message => message.method === 'thread/resume').params.threadId, 'thread-2');
  const ended = await rasterAppServer(t, '', {}, 'eof');
  await assert.rejects(runAgent({ ...request, environment: ended.environment }), /事件流结束/);
});

test('素体未换装时 step03 不调用 agent，直接沿用 step02 交付并标记完成', async t => {
  const image = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#f00' } }).png().toBuffer();
  const f = await fixture(t), deps = { ...f.deps, steps: f.definitions }, calls: string[] = [];
  await markBaseStep(join(f.directory, 'runs', 'test'), false);
  await runWorkflow(f.options, { ...deps, agent: async request => {
    const step = f.definitions.find(step => request.step === 'raster_' + step.id)!;
    calls.push(step.id); const result = await deliver(request, step);
    // The passthrough copies the PNG through the image converter, so it must be a real image.
    if (step.id === 'step02') await writeFile(join(request.directory, 'step02/character-soft-edges.png'), image);
    return result;
  } });
  assert.deepEqual(calls, ['step01', 'step02']);
  assert.equal(await readFile(join(f.output, 'step03/character-dressup-base.kra'), 'utf8'), 'fixture step02/character-soft-edges.kra');
  assert.deepEqual(await readFile(join(f.output, 'step03/character-dressup-base.png')), image);
  assert.match(await readFile(join(f.output, 'step03/report.md'), 'utf8'), /直接沿用上游结果[\s\S]*raster-layering\/step02\/character-soft-edges\.kra/);
  await readFile(join(f.output, 'step03/.completed'));
  await runWorkflow(f.resume, { ...deps, agent: forbidden });
});
