import { withCodex } from './fake-codex.ts';
import { readStepSession } from '../agents/step-session.ts';
import { rasterAppServer } from './raster-app-server.ts';
import {deliverRasterStep, isRasterReview} from './raster-delivery.ts';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadWorkflowEnvironment, checkCodexCapabilities } from '../codex/environment.ts';
import { formatAgentError } from '../codex/diagnostics.ts';
import { runAgent } from '../raster/agent.ts';
import { runWorkflow } from '../raster/workflow.ts';
import { section as character } from '../../raster-layering/run.ts';
import { section as clothing } from '../../clothing-raster-layering/run.ts';
import { seedUpstream } from './upstream-fixture.ts';
import { fakePatchedCodex } from './fake-codex.ts';
import { appServerCommand } from '../codex/tool-agent.ts';

async function fixture(t: { after(callback: () => Promise<unknown>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'layering-env-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('配置解析保留认证来源，.env 模型后缀是力度，.env 优先且不会改写进程环境', async t => {
  const root = await fixture(t);
  const baseline = loadWorkflowEnvironment({ CODEX_HOME: '/existing/codex' }, root);
  assert.deepEqual(baseline.codex.config, {});
  assert.equal(baseline.codex.env!.CODEX_HOME, '/existing/codex');
  assert.deepEqual(baseline.models.medium, { model: 'gpt-6.1-sol', effort: 'medium' });
  assert.deepEqual(baseline.models.high, { model: 'gpt-6.1-sol', effort: 'xhigh' });
  assert.equal(baseline.imageCompactThreshold, undefined);
  await writeFile(join(root, '.env'), 'medium_model=gpt-6.1-sol-low\nhigh_model=gpt-6-astra-high\ncodex_path=bin/codex\n');
  const settings = loadWorkflowEnvironment({ medium_model: 'gpt-6.1-sol-medium' }, root);
  assert.deepEqual(settings.models.medium, { model: 'gpt-6.1-sol', effort: 'low' });
  assert.deepEqual(settings.models.high, { model: 'gpt-6-astra', effort: 'high' });
  assert.equal(settings.codex.codexPathOverride, undefined);
  assert.equal(settings.cliPaths.codex, undefined);
  assert.equal(settings.codex.env!.codex_path, undefined);
  assert.equal(process.env.high_model, undefined);
});

test('removed layering_ configuration aliases cannot override current runtime settings', async t => {
  const root = await fixture(t);
  await writeFile(join(root, '.env'), [
    'layering_image_compact_threshold=49',
    'layering_codex_api_key=old-secret',
    'layering_codex_base_url=https://old.example/v1',
    'layering_agent_preparation_model=claude-haiku-5-5-low',
    'layering_part_pose_judgment_model=claude-haiku-5-5-low',
    'layering_default_image_model=gemini-nano-banana-2.1',
    'layering_part_standardize_image_model=gemini-nano-banana-2.1',
  ].join('\n'));
  const ignored = loadWorkflowEnvironment({layering_codex_image_compact_threshold:'12'}, root);
  assert.equal(ignored.imageCompactThreshold, undefined);
  assert.equal(ignored.codex.env!.LAYERING_IMAGE_COMPACT_THRESHOLD, undefined);
  assert.equal(ignored.providers!.codex.connection, 'inherited');
  assert.equal(ignored.stepModels.part_pose_judgment.model, 'gpt-6.1-sol');
  assert.equal(ignored.stepImages.part_standardize, 'codex-native');
  const configured = loadWorkflowEnvironment({codex_image_compact_threshold:'49', codex_api_key:'new-secret', codex_base_url:'https://new.example/v1',
    preparation_agent_model:'claude-haiku-5-5-low', default_image_model:'gpt-image-2.5-flare'}, root);
  assert.equal(configured.codex.env!.LAYERING_IMAGE_COMPACT_THRESHOLD, '49');
  assert.equal(configured.providers!.codex.baseUrl, 'https://new.example/v1');
  assert.equal(configured.stepModels.part_pose_judgment.model, 'claude-haiku-5-5');
  assert.equal(configured.stepImages.part_standardize, 'gpt-image-2.5-flare');
});

test('本机 Krita 并发上限来自 .env，默认取 example.env，非正整数直接报错', async t => {
  const root = await fixture(t);
  assert.equal(loadWorkflowEnvironment({}, root).codex.env!.krita_max_instances, '4');
  await writeFile(join(root, '.env'), 'krita_max_instances=2\n');
  assert.equal(loadWorkflowEnvironment({}, root).codex.env!.krita_max_instances, '2');
  assert.equal(loadWorkflowEnvironment({ krita_max_instances: '6' }, root).codex.env!.krita_max_instances, '2');
  await writeFile(join(root, '.env'), 'krita_max_instances=0\n');
  assert.throws(() => loadWorkflowEnvironment({}, root), /krita_max_instances 须为正整数/);
});

test('Codex ignores executable environment fields and selects only the managed preparation result', async t => {
  const root = await fixture(t), executable = await fakePatchedCodex(root);
  const settings = loadWorkflowEnvironment({ codex_path: '/must-not-run', layering_codex_path: '/also-must-not-run' }, root);
  assert.equal(settings.codex.codexPathOverride, undefined);
  assert.equal(settings.cliPaths.codex, undefined);
  assert.equal(settings.codex.env!.codex_path, undefined);
  assert.equal(settings.codex.env!.layering_codex_path, undefined);
  let prepared = 0;
  await checkCodexCapabilities(settings, settings.codex, {}, async () => { prepared++; return executable; });
  assert.equal(prepared, 1); assert.equal(settings.codex.codexPathOverride, executable);
  assert.deepEqual(appServerCommand(executable), { command: executable, args: ['app-server'] });
  assert.throws(() => appServerCommand(), /尚未准备/);
});

test('主模型与生图分别鉴权；只填生图模型不启用，按需准备补丁失败时保留原因', async t => {
  const root = await fixture(t);
  const onlyModel = loadWorkflowEnvironment({ image_model: 'another-image-model' }, root);
  assert.equal(onlyModel.stepImages.part_simplify, 'codex-native');
  assert.deepEqual(onlyModel.imageApis, {});
  const settings = loadWorkflowEnvironment({ custom_provider: 'true', provider_base_url: 'https://chat.example/v1',
    provider_api_key: 'chat-secret', image_base_url: 'https://images.example/v1', image_api_key: 'image-secret',
    image_compact_threshold: '49' }, root);
  const provider = (settings.codex.config!.model_providers as any).custom;
  assert.equal(provider.base_url, 'https://chat.example/v1');
  assert.equal(provider.env_key, 'provider_api_key');
  assert.equal(settings.codex.env!.LAYERING_IMAGE_BASE_URL, undefined);
  assert.equal(settings.codex.env!.LAYERING_IMAGE_API_KEY, undefined);
  assert.equal(settings.stepImages.part_simplify, 'gpt-image-2.5-sunburst');
  assert.equal(settings.imageApis.openai!.baseUrl, 'https://images.example/v1');
  assert.equal(settings.imageApis.openai!.apiKey, 'image-secret');
  assert.equal(settings.codex.env!.LAYERING_IMAGE_COMPACT_THRESHOLD, '49');
  assert.ok(!JSON.stringify(settings.codex.config).includes('secret'));
  await assert.rejects(checkCodexCapabilities(settings, settings.codex, {}, async () => { throw new Error('fixture build failure'); }), /fixture build failure/);
  assert.throws(() => loadWorkflowEnvironment({agv_unlimited_response_header_timeout: 'yes'}, root), /agv_unlimited_response_header_timeout/);
  assert.throws(() => loadWorkflowEnvironment({agv_patch: 'true'}, root), /已改名为 agv_unlimited_response_header_timeout/);
  assert.throws(() => loadWorkflowEnvironment({ custom_provider: 'true' }, root), /需要填写/);
  assert.throws(() => loadWorkflowEnvironment({ image_api_key: 'secret' }, root), /同时填写/);
  for (const invalid of ['0', '-1', '49.2', 'NaN']) assert.throws(() => loadWorkflowEnvironment({ image_compact_threshold: invalid }, root), /正整数/);
  assert.throws(() => loadWorkflowEnvironment({ medium_model: 'model-invalid-effort' }, root), /思考力度/);
});

test('图片压缩拒绝旧去图补丁，生图能力缓存不能绕过 v2 检查', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t);
  const executable = join(root, 'codex-fixture');
  const capabilities = { version: 1, image_provider: true, image_provider_version: 2, image_compaction: true, failed_error_event_version: 1 };
  const install = async (value: object) => {
    await writeFile(executable, `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify(value))});\n`);
    await chmod(executable, 0o755);
  };
  await install(capabilities);
  const provider = withCodex(loadWorkflowEnvironment({
    image_base_url: 'https://images.example/v1', image_api_key: 'fixture' }, root), executable);
  await checkCodexCapabilities(provider, provider.codex, { image: true });
  const compact = withCodex(loadWorkflowEnvironment({ image_compact_threshold: '49' }, root), executable);
  await assert.rejects(checkCodexCapabilities(compact), /补丁能力检查/);
  await install({ ...capabilities, image_compaction_version: 2 });
  await checkCodexCapabilities(compact);
});

test('独立字节预算保留 env 控制权，Codex 明确拒绝缺少字节保护能力的旧补丁', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t), executable = join(root, 'codex-budget-fixture');
  await writeFile(join(root, '.env'), 'image_compact_threshold=49\nagv_request_compact_mib=80\nclaude_image_compact_threshold=90\n');
  const settings = withCodex(loadWorkflowEnvironment({ codex_request_compact_mib: '28' }, root), executable);
  assert.equal(settings.imageCompactThreshold, 49);
  assert.equal(settings.codex.env!.LAYERING_REQUEST_COMPACT_BYTES, String(28 * 1048576));
  assert.deepEqual(settings.imageBudgets!.agv, { bytes: 80 * 1048576 });
  assert.deepEqual(settings.imageBudgets!.claude, { images: 90 });
  const install = async (version?: number) => {
    await writeFile(executable, `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify({ version: 1, image_compaction: true, image_compaction_version: 2, request_compaction_version: version, failed_error_event_version: 1 }))});\n`);
    await chmod(executable, 0o755);
  };
  await install(); await assert.rejects(checkCodexCapabilities(settings), /补丁能力检查/);
  await install(1); await checkCodexCapabilities(settings);
  const disabled = loadWorkflowEnvironment({ LAYERING_IMAGE_COMPACT_THRESHOLD: '49', LAYERING_REQUEST_COMPACT_BYTES: '100' }, await fixture(t));
  assert.equal(disabled.codex.env!.LAYERING_IMAGE_COMPACT_THRESHOLD, undefined);
  assert.equal(disabled.codex.env!.LAYERING_REQUEST_COMPACT_BYTES, undefined);
});

test('两套 raster 缺产物先返修两次，仍失败则保留该会话；继续时接回同一线程并读取当前环境模型，诊断带最后消息', async t => {
  for (const section of [character, clothing]) await t.test(section.id, async t => {
    const root = await fixture(t); await seedUpstream('case', section.inputSection, root);
    const environment = loadWorkflowEnvironment({ high_model: 'gpt-6-astra-high' }, root);
    const directory = join(root, 'case', section.id);
    const deps = { runsDirectory: root, steps: [section.steps[0]], environment,
      preflight: async (executable: string) => ({ executable }) };
    let failure: unknown, turns = 0;
    try {
      await runWorkflow(section, { name: 'case', krita: process.execPath }, { ...deps, agent: async request => {
        turns++;
        assert.equal(request.model, 'gpt-6-astra'); assert.equal(request.effort, 'high');
        await request.onEvent({ type: 'thread.started', thread_id: 'persistent-thread' });
        await request.onEvent({ type: 'item.completed', item: { type: 'agent_message', id: 'message', text: '当前没有 image_generation 工具，无法绘制。' } });
        return { status: 'completed', summary: '回合已结束' };
      } });
    } catch (error) { failure = error; }
    assert.ok(failure);
    assert.equal(turns, 3); // the draw and two repairs
    assert.equal((await readStepSession(directory, 'step01'))?.threadId, 'persistent-thread');
    assert.match(formatAgentError(failure), /缺少有效交付/);
    assert.match(formatAgentError(failure), /没有 image_generation 工具/);
    assert.match(formatAgentError(failure), /persistent-thread/);
    assert.match(await readFile(join(directory, 'agents/steps/step01/error.txt'), 'utf8'), /模型最后消息/);
    await assert.rejects(readFile(join(directory, 'step01/.completed')), { code: 'ENOENT' });
    const changed = loadWorkflowEnvironment({ high_model: 'gpt-6.1-sol-low' }, root);
    await runWorkflow(section, { name: 'case', krita: process.execPath }, { ...deps, environment: changed, agent: async request => {
      if (isRasterReview(request)) return deliverRasterStep(request, section.steps[0]);
      assert.equal(request.threadId, 'persistent-thread');
      assert.equal(request.model, 'gpt-6.1-sol'); assert.equal(request.effort, 'low');
      return deliverRasterStep(request, section.steps[0], 'persistent-thread');
    } });
    assert.equal((await readStepSession(directory, 'step01'))?.threadId, 'persistent-thread');
    await assert.rejects(readFile(join(directory, 'run.json')), { code: 'ENOENT' });
    const attempts = (await readFile(join(directory,'agents/steps/step01/attempts.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    const draw = attempts.filter(attempt=>attempt.phase==='draw').at(-1);
    assert.equal(draw.model,'gpt-6.1-sol'); assert.equal(draw.effort,'low');
  });
});

test('raster 正常退出却只返回自然语言时报告原文，不变成晦涩 JSON 错误或重试', async t => {
  const server = await rasterAppServer(t, '没有可用的 image_generation。');
  await assert.rejects(runAgent({ prompt: 'test', directory: server.directory, model: 'gpt-6.1-sol', effort: 'xhigh',
    environment: server.environment, onEvent: async () => {} }), error => {
    assert.match(formatAgentError(error), /没有返回有效的步骤结果 JSON/);
    assert.match(formatAgentError(error), /没有可用的 image_generation/);
    assert.match(formatAgentError(error), /native-thread/); return true;
  });
});
