import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, realpath, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, dirname, delimiter } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { parseEnv } from 'node:util';
import sharp from 'sharp';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { modelHarnesses, modelSlotDefaults, stepModelSlots, stepDefaults, imageSteps, parseAgentModel } from '../agents/models.ts';
import { imageGenerationTool, validateImageSelection } from '../agents/images.ts';
import { cliExecutable, runCliTask } from '../agents/cli.ts';
import { CodexAgents } from '../codex/agents.ts';
import { AgentRuntime } from '../codex/agent-runtime.ts';
import { runAgent } from '../raster/agent.ts';
import { pipelineAgentSteps } from '../agents/preflight.ts';

async function fixture(t: { after(callback: () => Promise<unknown>): void }) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'step-models-')));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}

test('model roles are shared by character/clothing, repairs use drawing roles, groups and depth stay independent', async t => {
  for (const [id, harness] of Object.entries(modelHarnesses)) for (const effort of ['low', 'medium', 'high', 'xhigh']) {
    assert.deepEqual(parseAgentModel(`${id}-${effort}`, 'fixture'), { model: id, harness, effort });
  }
  assert.throws(() => parseAgentModel('gemini-4-argon-max', 'fixture'));
  assert.throws(() => parseAgentModel('claude-sonnet-5.5-xhigh', 'fixture'), /claude-sonnet-5-5/);
  assert.throws(() => parseAgentModel('unlisted-high', 'fixture'));
  assert.throws(() => parseAgentModel('constructor-high', 'fixture'));
  const root = await fixture(t);
  await writeFile(join(root, '.env'), 'layering_agent_part_review_model=gemini-4-argon-high\nlayering_agent_part_draw_model=claude-sonnet-5-5-low\nlayering_agent_part_groups_model=gemini-4-argon-high\n');
  const settings = loadWorkflowEnvironment({ layering_agent_part_review_model: 'claude-haiku-5-5-medium',
    layering_agent_raster_step01_model: 'claude-opus-5-5-medium', layering_agent_raster_step01_review_model: 'gemini-4-argon-high' }, root);
  assert.equal(settings.stepModels.part_outline_review.model, 'claude-haiku-5-5');
  assert.deepEqual(settings.stepModels.clothing_outline_review, settings.stepModels.part_outline_review);
  for (const step of ['part_outline', 'part_outline_repair', 'clothing_outline', 'clothing_outline_repair'] as const) {
    assert.deepEqual(settings.stepModels[step], parseAgentModel('claude-sonnet-5-5-low', 'fixture'));
  }
  for (const step of ['part_initial_groups', 'part_children', 'clothing_initial_groups', 'clothing_children'] as const) {
    assert.equal(settings.stepModels[step].model, 'gemini-4-argon');
  }
  assert.equal(settings.stepModels.part_occlusion.model, 'gpt-6.1-sol');
  assert.deepEqual(settings.stepModels.clothing_occlusion, settings.stepModels.part_occlusion);
  for (const step of ['raster_step01', 'raster_step01_repair', 'clothing_raster_step01', 'clothing_raster_step01_repair'] as const) {
    assert.deepEqual(settings.stepModels[step], parseAgentModel('claude-opus-5-5-medium', 'fixture'));
  }
  assert.deepEqual(settings.stepModels.raster_step01_review, parseAgentModel('gemini-4-argon-high', 'fixture'));
  assert.deepEqual(settings.stepModels.clothing_raster_step01_review, settings.stepModels.raster_step01_review);
  for (const [step, role] of Object.entries(stepModelSlots)) if (role === 'preparation') {
    assert.deepEqual(settings.stepModels[step as keyof typeof stepModelSlots], parseAgentModel('gpt-6.1-sol-low', 'fixture'));
  }
  assert.deepEqual(settings.stepModels.raster_step02, parseAgentModel('gpt-6.1-sol-medium', 'fixture'));
  assert.equal(Object.keys(settings.stepModels).length, Object.keys(stepDefaults).length);
  assert.ok(!pipelineAgentSteps('clothing-part-layering').some(step => step.startsWith('clothing_raster_')));
  assert.ok(!pipelineAgentSteps('part-layering').includes('part_standardize'));
  assert.ok(pipelineAgentSteps('part-layering', true).includes('part_standardize'));
});

test('every image-capable agent rejects native imagegen with a different harness; part review stays text-only', async t => {
  const root = await fixture(t);
  for (const step of ['part_completion', 'clothing_completion'] as const) assert.ok(imageSteps.includes(step));
  for (const step of ['part_outline', 'part_outline_repair', 'clothing_outline', 'clothing_outline_repair', 'part_outline_review', 'clothing_outline_review'] as const) {
    assert.ok(!imageSteps.includes(step));
    assert.equal(loadWorkflowEnvironment({}, root).stepImages[step], undefined);
  }
  for (const step of imageSteps) {
    const settings = loadWorkflowEnvironment({ [`layering_agent_${stepModelSlots[step]}_model`]: 'gemini-4-argon-high' }, root);
    assert.throws(() => validateImageSelection(settings, step), /Codex 内置 imagegen.*harness.*agv/, step);
  }
  const settings = loadWorkflowEnvironment({ layering_agent_part_review_model: 'gemini-4-argon-high' }, root);
  validateImageSelection(settings, 'part_outline_review');
  await assert.rejects(cliExecutable(loadWorkflowEnvironment({ PATH: '' }, root), 'claude'), /全局入口.*不会自动安装/);
  const custom = loadWorkflowEnvironment({ layering_part_simplify_image_model: 'gemini-nano-banana-2.1' }, root);
  assert.throws(() => validateImageSelection(custom, 'part_simplify'), /缺少 google/);
});

test('scheme 1 template and code defaults resolve all role efforts and native images without extra providers', async t => {
  const contents = await readFile(new URL('../../example.env', import.meta.url), 'utf8');
  const variables = parseEnv(contents);
  assert.equal(Object.keys(modelSlotDefaults).length, 16);
  for (const role of Object.keys(modelSlotDefaults)) assert.ok(Object.hasOwn(variables, `layering_agent_${role}_model`));
  for (const step of imageSteps) assert.ok(Object.hasOwn(variables, `layering_${step}_image_model`));
  assert.equal(Object.keys(variables).filter(key => key.endsWith('_image_model') && key !== 'layering_default_image_model').length, imageSteps.length);
  const root = await fixture(t);
  await writeFile(join(root, '.env'), contents);
  const settings = loadWorkflowEnvironment({}, root);
  assert.equal(Object.keys(settings.stepModels).length, Object.keys(stepDefaults).length);
  assert.deepEqual(settings.stepModels, loadWorkflowEnvironment({}, await fixture(t)).stepModels);
  const expected: Record<keyof typeof modelSlotDefaults, string> = {
    preparation: 'low', part_draw: 'medium', part_review: 'medium',
    part_groups: 'high', part_reduce: 'high', part_completion: 'high', part_depth: 'high',
    raster_step01: 'xhigh', raster_step01_review: 'xhigh', raster_step02: 'medium',
    raster_step03: 'medium', assembly: 'xhigh', shadow: 'medium',
    physics_analysis: 'high', physics_authoring: 'xhigh', physics_review: 'xhigh',
  };
  for (const [step, role] of Object.entries(stepModelSlots)) {
    assert.deepEqual(settings.stepModels[step as keyof typeof stepModelSlots], parseAgentModel(`gpt-6.1-sol-${expected[role]}`, 'fixture'), step);
  }
  assert.deepEqual(settings.codex.config, {});
  assert.deepEqual(settings.imageApis, {});
  assert.deepEqual(settings.cliPaths, {});
  assert.equal(settings.imageCompactThreshold, undefined);
  assert.ok(imageSteps.every(step => settings.stepImages[step] === 'codex-native'));
});

test('mixed preset assigns shared GPT, Argon and Claude roles and uses Sunburst for simplification', async t => {
  const base = parseEnv(await readFile(new URL('../../example.env', import.meta.url), 'utf8'));
  const overrides = parseEnv(await readFile(new URL('../../presets/optimized.env', import.meta.url), 'utf8'));
  const variables = { ...base, ...overrides, layering_google_image_base_url: 'https://image.example/v1beta', layering_google_image_api_key: 'fixture',
    layering_openai_image_base_url: 'https://image.example/v1', layering_openai_image_api_key: 'fixture' };
  const root = await fixture(t);
  await writeFile(join(root, '.env'), Object.entries(variables).map(([key, value]) => `${key}=${value}\n`).join(''));
  const settings = loadWorkflowEnvironment({}, root);
  const expected: Record<keyof typeof modelSlotDefaults, string> = {
    ...modelSlotDefaults,
    preparation: 'gpt-6.1-sol-low',
    part_draw: 'gpt-6.1-sol-xhigh', part_review: 'gpt-6.1-sol-xhigh', part_completion: 'gemini-4-argon-high',
    part_groups: 'gpt-6.1-sol-xhigh', part_depth: 'gpt-6.1-sol-xhigh', part_reduce: 'gpt-6.1-sol-xhigh',
    raster_step01: 'claude-opus-5-5-xhigh', raster_step01_review: 'claude-sonnet-5-5-xhigh',
    raster_step02: 'claude-sonnet-5-5-xhigh', raster_step03: 'claude-sonnet-5-5-xhigh',
    assembly: 'gemini-4-argon-high', shadow: 'claude-sonnet-5-5-xhigh',
  };
  for (const [step, role] of Object.entries(stepModelSlots)) {
    assert.deepEqual(settings.stepModels[step as keyof typeof stepModelSlots], parseAgentModel(expected[role], 'fixture'), step);
  }
  const nanoSteps = new Set(['part_base_subject', 'part_completion', 'clothing_completion']);
  for (const step of imageSteps) {
    assert.equal(settings.stepImages[step], nanoSteps.has(step) ? 'gemini-nano-banana-2.1' : 'gpt-image-2.5-sunburst', step);
    validateImageSelection(settings, step);
  }
  assert.equal(settings.imageCompactThreshold, undefined);
  assert.deepEqual(settings.codex.config, {});
  const custom = loadWorkflowEnvironment({ layering_agent_part_review_model: 'claude-sonnet-5-5-xhigh', layering_part_simplify_image_model: 'gpt-image-2.5-flare',
    layering_openai_image_base_url: 'https://images.example/v1', layering_openai_image_api_key: 'fixture' }, root);
  assert.equal(custom.stepModels.part_outline_review.model, 'claude-sonnet-5-5');
  assert.deepEqual(custom.stepModels.clothing_outline_review, custom.stepModels.part_outline_review);
  assert.equal(custom.stepImages.part_simplify, 'gpt-image-2.5-flare');
  assert.equal(custom.stepImages.part_base_subject, 'gemini-nano-banana-2.1');
  assert.deepEqual(custom.stepModels.raster_step02, settings.stepModels.raster_step02);
  for (const step of imageSteps) validateImageSelection(custom, step);
});

test('consistent legacy settings are shared, conflicts require an explicit role, and new configuration wins', async t => {
  const root = await fixture(t);
  const consistent = loadWorkflowEnvironment({ layering_part_outline_model: 'claude-sonnet-5-5-high', layering_clothing_outline_model: 'claude-sonnet-5-5-high' }, root);
  assert.deepEqual(consistent.stepModels.part_outline_repair, consistent.stepModels.clothing_outline);
  const conflict = { layering_part_outline_model: 'claude-sonnet-5-5-high', layering_clothing_outline_model: 'gemini-4-argon-high' };
  assert.throws(() => loadWorkflowEnvironment(conflict, root), /不一致.*layering_agent_part_draw_model/);
  assert.throws(() => loadWorkflowEnvironment({ layering_raster_step01_model: 'gpt-6-astra-high', layering_raster_step01_repair_model: 'gpt-6-astra-low' }, root), /不一致.*layering_agent_raster_step01_model/);
  const unified = loadWorkflowEnvironment({ ...conflict, layering_agent_part_draw_model: 'gpt-6.1-sol-xhigh' }, root);
  assert.deepEqual(unified.stepModels.part_outline, unified.stepModels.clothing_outline);
  assert.equal(unified.stepModels.part_outline.model, 'gpt-6.1-sol');
  const oldFile = Object.entries(stepDefaults).map(([step, value]) => `layering_${step}_model=${stepModelSlots[step as keyof typeof stepModelSlots] === 'preparation' ? 'gpt-6.1-sol-xhigh' : value}\n`).join('');
  await writeFile(join(root, '.env'), oldFile);
  assert.equal(loadWorkflowEnvironment({}, root).stepModels.part_simplify.effort, 'xhigh');
  assert.equal(await readFile(join(root, '.env'), 'utf8'), oldFile);
});

test('legacy tier overrides keep their historical roles and explicit role and shell values still win', async t => {
  const root = await fixture(t);
  const file = 'layering_medium_model=gpt-6.1-sol-low\nlayering_high_model=gpt-6-astra-high\n';
  await writeFile(join(root, '.env'), file);
  const settings = loadWorkflowEnvironment({}, root);
  const highRoles = new Set(['raster_step01', 'raster_step01_review', 'raster_step02']);
  for (const [step, role] of Object.entries(stepModelSlots)) {
    const expected = highRoles.has(role) ? 'gpt-6-astra-high' : 'gpt-6.1-sol-low';
    assert.deepEqual(settings.stepModels[step as keyof typeof stepModelSlots], parseAgentModel(expected, 'fixture'), step);
  }
  await writeFile(join(root, '.env'), file + 'layering_agent_raster_step02_model=claude-sonnet-5-5-medium\n');
  const explicit = loadWorkflowEnvironment({}, root);
  assert.equal(explicit.stepModels.clothing_raster_step02.harness, 'claude');
  const shell = loadWorkflowEnvironment({ layering_agent_raster_step02_model: 'gemini-4-argon-high' }, root);
  assert.equal(shell.stepModels.raster_step02.harness, 'agv');
  assert.deepEqual(shell.stepModels.raster_step02, shell.stepModels.clothing_raster_step02);
  assert.equal(shell.stepModels.raster_step01.model, 'gpt-6-astra');
  assert.equal(await readFile(join(root, '.env'), 'utf8'), file + 'layering_agent_raster_step02_model=claude-sonnet-5-5-medium\n');
});

test('custom image edit transports original prompts and images over both protocols and preserves inputs', async t => {
  const root = await fixture(t), source = join(root, 'input.png');
  const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#ff000080' } }).png().toBuffer();
  await writeFile(source, png);
  let protocol = 'openai', expectedBackground = 'transparent', called = 0;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk); const bytes = Buffer.concat(chunks); called++;
    if (protocol === 'gemini') {
      assert.equal(req.url, '/v1beta/models/gemini-nano-banana-2.1:generateContent');
      assert.equal(req.headers['x-goog-api-key'], 'image-test-secret');
      const body = JSON.parse(bytes.toString());
      assert.ok(body.contents[0].parts[0].text.startsWith('原样的绘制提示词\n\n'));
      assert.match(body.contents[0].parts[0].text, /背景使用高纯度纯色 #[0-9A-F]{6}/);
      assert.deepEqual(Buffer.from(body.contents[0].parts[1].inlineData.data, 'base64'), png);
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: png.toString('base64') } }] } }] }));
    } else {
      assert.equal(req.url, '/v1/images/edits'); assert.equal(req.headers.authorization, 'Bearer image-test-secret');
      assert.ok(bytes.includes(Buffer.from('原样的绘制提示词'))); assert.ok(bytes.includes(png));
      const form = await new Request('http://localhost', { method: 'POST', headers: { 'content-type': req.headers['content-type']! }, body: new Uint8Array(bytes) }).formData();
      assert.equal(form.get('background'), expectedBackground);
      if (expectedBackground === 'transparent') assert.equal(form.get('prompt'), '原样的绘制提示词');
      else assert.match(String(form.get('prompt')), /背景使用高纯度纯色 #[0-9A-F]{6}/);
      res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
    }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(done => server.close(() => done())));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let definition: unknown;
  for (const [provider, model, mode] of [
    ['google', 'gemini-nano-banana-2.1', 'openai'],
    ['google', 'gemini-nano-banana-2.1', 'gemini'],
    ['openai', 'gpt-image-2.5-flare', 'openai'],
  ]) {
    protocol = mode;
    expectedBackground = provider === 'google' ? 'opaque' : 'transparent';
    const settings = loadWorkflowEnvironment({ layering_part_simplify_image_model: model, PATH: process.env.PATH,
      [`layering_${provider}_image_base_url`]: base + (mode === 'gemini' ? '/v1beta' : '/v1'),
      [`layering_${provider}_image_api_key`]: 'image-test-secret', [`layering_${provider}_image_protocol`]: mode }, root);
    const outputDirectory = `${provider}-${mode}`;
    const tool = imageGenerationTool(settings, 'part_simplify', join(root, outputDirectory), [root], { krita: process.execPath })!;
    const current = { name: tool.name, description: tool.description, inputSchema: tool.inputSchema };
    if (definition) assert.deepEqual(current, definition);
    else definition = current;
    assert.ok(!Object.hasOwn((tool.inputSchema as { properties: Record<string, unknown> }).properties, 'model'));
    const result = await tool.execute({ prompt: '原样的绘制提示词', input_images: [source] }, new AbortController().signal);
    const output = JSON.parse((result.contentItems[0] as { text: string }).text);
    assert.ok(relative(root, output.savedPath).startsWith(outputDirectory));
    assert.equal((await sharp(output.savedPath).metadata()).format, 'png');
    assert.deepEqual(await readFile(source), png);
    await assert.rejects(tool.execute({ prompt: 'test', input_images: ['/etc/passwd'] }, new AbortController().signal), /允许范围/);
  }
  assert.equal(called, 3);
});

const fakeCli = `#!${process.execPath}
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
const args=process.argv.slice(2), kind=args.includes('--mcp-config')?'claude':'agv';
const resumeFlag=kind==='claude'?'--resume':'--conversation';
const resumed=args.includes(resumeFlag)?args[args.indexOf(resumeFlag)+1]:undefined;
if(resumed==='missing'){console.log(JSON.stringify({type:'result',is_error:true,session_id:resumed,error:'session not found'}));process.exit(1);}
let input='';for await(const chunk of process.stdin)input+=chunk;
const config=kind==='claude'?args[args.indexOf('--mcp-config')+1]:join(process.env.ANTIGRAVITY_GEMINI_DIR,'config/mcp_config.json');
const registry=JSON.parse(await readFile(config,'utf8')).mcpServers.layering.env;
const rpc=async(method,params)=>{const response=await fetch(registry.LAYERING_MCP_URL,{method:'POST',headers:{authorization:'Bearer '+registry.LAYERING_MCP_TOKEN},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return (await response.json()).result;};
const list=await rpc('tools/list',{}), echo=list.tools.find(tool=>tool.name==='fixture_echo');
if(echo)await rpc('tools/call',{name:echo.name,arguments:{}});
const id=resumed||randomUUID();
console.log(JSON.stringify(kind==='claude'?{type:'system',subtype:'init',session_id:id}:{event:'init',conversation_id:id}));
const meta={args,cwd:process.cwd(),data:process.env.CLAUDE_CONFIG_DIR,agvData:process.env.ANTIGRAVITY_APP_DATA_DIR,input:JSON.parse(input),id,resumed};
await writeFile(join(process.cwd(),'invocation.json'),JSON.stringify(meta));
console.log(JSON.stringify(kind==='claude'?{type:'result',session_id:id,result:'完成'}:{event:'result',result:{conversation_id:id,status:'SUCCESS',response:'完成'}}));
`;

test('Claude and agv use isolated request workspaces, original MCP schemas and resumable local session data', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'fake-cli.mjs');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, fakeCli, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agv_path: cli }, root);
  let called = 0;
  for (const [id, wireModel] of [['claude-sonnet-5-5-high', 'claude-sonnet-5-5'],
    ['claude-opus-5-5-xhigh', 'claude-opus-5-5'], ['claude-haiku-5-5-low', 'claude-haiku-5-5'], ['gemini-4-argon-xhigh', 'gemini-4-argon']]) {
    const model = parseAgentModel(id, 'test'), options = { cwd, logDirectory: join(cwd, 'agents') };
    const task = { name: 'fixture', cwd, prompt: '完整任务提示词', tools: [{ name: 'fixture_echo', description: '原始工具说明',
      inputSchema: { type: 'object' }, async execute() { called++; return { success: true, contentItems: [] }; } }] };
    const first = await runCliTask(task, model, settings, options, new AbortController().signal);
    const second = await runCliTask(task, model, settings, options, new AbortController().signal, first.threadId!);
    assert.equal(second.threadId, first.threadId);
    const a = JSON.parse(await readFile(join(first.logDirectory!, 'workspace/invocation.json'), 'utf8'));
    const b = JSON.parse(await readFile(join(second.logDirectory!, 'workspace/invocation.json'), 'utf8'));
    assert.equal(await readFile(join(first.logDirectory!, 'prompt.md'), 'utf8'), a.input.message.content[0].text);
    assert.notEqual(a.cwd, b.cwd); assert.equal(a.data, b.data);
    for (const path of [a.cwd, a.data, a.agvData, b.cwd]) assert.ok(path.startsWith(join(cwd, 'agents')));
    assert.ok(a.input.message.content[0].text.startsWith(task.prompt));
    assert.equal(a.args[a.args.indexOf('--effort') + 1], model.effort);
    assert.equal(a.args[a.args.indexOf('--model') + 1], wireModel);
    assert.equal(b.args[b.args.indexOf('--model') + 1], wireModel);
    const request = JSON.parse(await readFile(join(first.logDirectory!, 'request.json'), 'utf8'));
    assert.equal(request.threadOptions.model, model.model);
    assert.equal((await stat(join(first.logDirectory!, 'mcp.json'))).mode & 0o777, 0o600);
  }
  assert.equal(called, 8);
});

test('Claude and AGV env-node launchers work when the service PATH has no Node, including child tools', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'env-node.mjs');
  await mkdir(cwd, { recursive: true });
  const script = fakeCli.replace(`#!${process.execPath}`, '#!/usr/bin/env node')
    .replace('const meta=', `const {execFileSync}=await import('node:child_process');
const childNode=execFileSync('/usr/bin/env',['node','-p','process.execPath'],{encoding:'utf8'}).trim();
await writeFile(join(process.cwd(),'child-node.json'),JSON.stringify({path:process.env.PATH,childNode}));
const meta=`);
  await writeFile(cli, script, { mode: 0o700 });
  const inheritedPath = join(root, 'service-bin'); await mkdir(inheritedPath);
  const settings = loadWorkflowEnvironment({ PATH: inheritedPath, layering_claude_path: cli, layering_agv_path: cli }, root);
  const hostPath = process.env.PATH;
  for (const id of ['claude-sonnet-5-5-high', 'gemini-4-argon-high']) {
    const result = await runCliTask({ name: 'env-node', cwd, prompt: 'fixture' }, parseAgentModel(id, 'fixture'), settings,
      { cwd, logDirectory: join(cwd, 'agents') }, new AbortController().signal);
    assert.equal(result.text, '完成');
    const child = JSON.parse(await readFile(join(result.logDirectory!, 'workspace/child-node.json'), 'utf8'));
    assert.equal(child.childNode, process.execPath);
    assert.deepEqual(child.path.split(delimiter), [dirname(process.execPath), inheritedPath]);
  }
  assert.equal(settings.codex.env!.PATH, inheritedPath);
  assert.equal(process.env.PATH, hostPath);
});

test('unavailable CLI sessions are replaced once without deleting existing deliveries', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'fake-cli.mjs');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, fakeCli, { mode: 0o700 });
  await writeFile(join(cwd, 'keep.svg'), 'existing');
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agent_part_review_model: 'claude-sonnet-5-5-high' }, root);
  await mkdir(join(cwd, 'agents'), { recursive: true });
  await mkdir(join(cwd, 'agents/old-data'), { recursive: true });
  await mkdir(join(cwd, 'agents/old-workspace'), { recursive: true });
  await writeFile(join(cwd, 'agents/sessions.json'), JSON.stringify({ missing: { harness: 'claude', data: join(cwd, 'agents/old-data'), workspace: join(cwd, 'agents/old-workspace') } }));
  let replacements = 0;
  const agents = new CodexAgents({ environment: settings, cwd, logDirectory: join(cwd, 'agents'),
    onThreadReplacement: async () => { replacements++; } });
  const session = agents.createSession('missing');
  try {
    const result = await session.run({ step: 'part_outline_review', name: 'review', cwd, prompt: '继续任务' });
    assert.notEqual(result.threadId, 'missing'); assert.equal(replacements, 1);
    assert.equal(await readFile(join(cwd, 'keep.svg'), 'utf8'), 'existing');
  } finally { await session.close(); }
});

test('model/effort changes resume within a harness, switching harness creates a recorded session and retains files', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'fake-cli.mjs');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, fakeCli, { mode: 0o700 });
  await writeFile(join(cwd, 'keep.svg'), 'existing');
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agv_path: cli,
    layering_agent_part_draw_model: 'claude-sonnet-5-5-high', layering_agent_part_completion_model: 'claude-opus-5-5-xhigh',
    layering_agent_part_review_model: 'gemini-4-argon-high', layering_default_image_model: 'gemini-nano-banana-2.1',
    layering_google_image_base_url: 'https://image.example/v1beta', layering_google_image_api_key: 'fixture' }, root);
  const replaced: string[] = [];
  const agent = new CodexAgents({ environment: settings, cwd, logDirectory: join(cwd, 'agents'), onThreadReplacement: async id => { replaced.push(id); } });
  const session = agent.createSession();
  try {
    const first = await session.run({ step: 'part_outline', name: 'drawing', cwd, prompt: 'draw' });
    const repair = await session.run({ step: 'part_outline_repair', name: 'repair', cwd, prompt: 'repair' });
    const differentModel = await session.run({ step: 'part_completion', name: 'completion', cwd, prompt: 'complete' });
    const switched = await session.run({ step: 'part_outline_review', name: 'handoff', cwd, prompt: 'continue from file' });
    assert.equal(first.threadId, repair.threadId); assert.notEqual(first.threadId, switched.threadId);
    assert.equal(first.threadId, differentModel.threadId);
    assert.deepEqual(replaced, [first.threadId]);
    const records = JSON.parse(await readFile(join(cwd, 'agents/sessions.json'), 'utf8'));
    assert.equal(records[first.threadId!].harness, 'claude'); assert.equal(records[switched.threadId!].harness, 'agv');
    assert.equal(await readFile(join(cwd, 'keep.svg'), 'utf8'), 'existing');
  } finally { await session.close(); }
});

test('CLI cancellation and early failures finish logs and stop the request process', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case'), cli = join(root, 'waiting.mjs');
  await mkdir(cwd, { recursive: true });
  await writeFile(cli, `#!${process.execPath}\nsetInterval(()=>{},10000);`, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli }, root);
  const options = { cwd, logDirectory: join(cwd, 'agents') };
  let error: any;
  try { await runCliTask({ name: 'cancel', cwd, prompt: 'test' }, parseAgentModel('claude-sonnet-5-5-high', 'fixture'), settings, options, AbortSignal.timeout(200)); }
  catch (failure) { error = failure; }
  assert.match(String(error), /Timeout|abort/i);
  assert.equal(JSON.parse(await readFile(join(error.logDirectory, 'result.json'), 'utf8')).status, 'failed');
  await assert.rejects(cliExecutable(loadWorkflowEnvironment({ layering_claude_path: root }, root), 'claude'), /没有可用/);
});

test('raster CLI service retries retain the session and report retry progress', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/raster-layering'), cli = join(root, 'retry.mjs');
  await mkdir(cwd, { recursive: true });
  const script = fakeCli.replace("const meta=", `const flag=join(process.env.CLAUDE_CONFIG_DIR,'retried');
try { await readFile(flag); } catch {
  await writeFile(flag,'yes');
  console.log(JSON.stringify({type:'result',session_id:id,is_error:true,error:'503 service unavailable'}));process.exit(1);
}
const meta=`).replace("result:'完成'", "result:'{\"status\":\"completed\",\"summary\":\"recovered\"}'");
  await writeFile(cli, script, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agent_raster_step02_model: 'claude-sonnet-5-5-high',
    layering_raster_step02_image_model: 'gemini-nano-banana-2.1', layering_google_image_base_url: 'https://image.example/v1beta', layering_google_image_api_key: 'fixture' }, root);
  const ids: string[] = [], retries: number[] = [];
  const result = await runAgent({ directory: cwd, step: 'raster_step02', model: 'claude-sonnet-5-5', effort: 'high',
    environment: settings, prompt: 'continue', async onEvent(event) {
      if (event.type === 'thread.started') ids.push(event.thread_id);
    }, onRetry: retry => { retries.push(retry.nextAttempt); } }, undefined, new AgentRuntime(1, async () => {}));
  assert.equal(result.summary, 'recovered');
  assert.deepEqual(retries, [2]);
  assert.equal(ids.length, 1);
  const records = JSON.parse(await readFile(join(cwd, 'agents/sessions.json'), 'utf8'));
  assert.deepEqual(Object.keys(records), ids);
});

test('raster custom image tools read sibling upstream references inside the task and reject other tasks', async t => {
  const root = await fixture(t), task = join(root, 'case'), cwd = join(task, 'raster-layering/step01');
  const upstream = join(task, 'part-layering/references'), source = join(upstream, 'base-subject.png'), other = join(root, 'other.png');
  await mkdir(cwd, { recursive: true }); await mkdir(upstream, { recursive: true });
  const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#ff000080' } }).png().toBuffer();
  await writeFile(source, png); await writeFile(other, png);
  let called = 0;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    assert.ok(Buffer.concat(chunks).includes(png)); called++;
    res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(done => server.close(() => done())));
  const cli = join(root, 'image-cli.mjs');
  const script = fakeCli.replace('const id=resumed||randomUUID();', `
const imageTool=list.tools.find(tool=>tool.name==='image_generation');
if(!imageTool)throw new Error('missing image tool');
const generated=await rpc('tools/call',{name:imageTool.name,arguments:{prompt:'fixture',input_images:[process.env.LAYERING_TEST_REFERENCE]}});
if(generated.isError)throw new Error(generated.content[0].text);
const outside=await rpc('tools/call',{name:imageTool.name,arguments:{prompt:'fixture',input_images:[process.env.LAYERING_TEST_OTHER_REFERENCE]}});
if(!outside.isError)throw new Error('outside task was accepted');
const id=resumed||randomUUID();`).replace("result:'完成'", "result:'{\"status\":\"completed\",\"summary\":\"generated\"}'");
  await writeFile(cli, script, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agent_raster_step01_model: 'claude-sonnet-5-5-high',
    layering_raster_step01_image_model: 'gpt-image-2.5-flare', layering_openai_image_base_url: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
    layering_openai_image_api_key: 'fixture', LAYERING_TEST_REFERENCE: source, LAYERING_TEST_OTHER_REFERENCE: other }, root);
  const result = await runAgent({ directory: cwd, imageRoots: [task], step: 'raster_step01', model: 'claude-sonnet-5-5', effort: 'high',
    environment: settings, prompt: 'generate', onEvent: async () => {} }, undefined, new AgentRuntime(1));
  assert.equal(result.summary, 'generated'); assert.equal(called, 1);
  assert.deepEqual(await readFile(source), png);
});
