import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, realpath, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, dirname, delimiter, isAbsolute, sep } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { parseEnv } from 'node:util';
import sharp from 'sharp';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { modelHarnesses, modelSlotDefaults, stepModelSlots, stepDefaults, imageSteps, parseAgentModel } from '../agents/models.ts';
import { imageGenerationTool, validateImageSelection } from '../agents/images.ts';
import { cliExecutable, runCliTask } from '../agents/cli.ts';
import { CodexAgents } from '../codex/agents.ts';
import { AgentCallError, AgentRuntime } from '../codex/agent-runtime.ts';
import { runAgent } from '../raster/agent.ts';
import { sectionAgentSteps } from '../agents/preflight.ts';

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
  assert.ok(!sectionAgentSteps('clothing-part-layering').some(step => step.startsWith('clothing_raster_')));
  assert.ok(!sectionAgentSteps('part-layering').includes('part_standardize'));
  assert.ok(sectionAgentSteps('part-layering', true).includes('part_standardize'));
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
  assert.equal(Object.keys(modelSlotDefaults).length, 14);
  for (const role of Object.keys(modelSlotDefaults)) assert.ok(Object.hasOwn(variables, `layering_agent_${role}_model`));
  for (const step of imageSteps) assert.ok(Object.hasOwn(variables, `layering_${step}_image_model`));
  assert.equal(Object.keys(variables).filter(key => key.endsWith('_image_model') && !['layering_default_image_model', 'layering_image_model'].includes(key)).length, imageSteps.length);
  const root = await fixture(t);
  await writeFile(join(root, '.env'), contents);
  const settings = loadWorkflowEnvironment({}, root);
  assert.equal(Object.keys(settings.stepModels).length, Object.keys(stepDefaults).length);
  assert.deepEqual(settings.stepModels, loadWorkflowEnvironment({}, await fixture(t)).stepModels);
  const expected: Record<keyof typeof modelSlotDefaults, string> = {
    preparation: 'low', part_draw: 'medium', part_review: 'medium',
    part_groups: 'high', part_reduce: 'high', part_completion: 'high', part_depth: 'high',
    raster_step01: 'xhigh', raster_step01_review: 'xhigh', raster_step02: 'medium',
    raster_step03: 'medium', assembly: 'xhigh', shadow: 'medium', nine_axis_head: 'xhigh',
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

test('mixed preset assigns shared GPT and Claude roles and uses Sunburst for simplification', async t => {
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
    part_draw: 'gpt-6.1-sol-xhigh', part_review: 'gpt-6.1-sol-xhigh', part_completion: 'claude-sonnet-5-5-xhigh',
    part_groups: 'gpt-6.1-sol-xhigh', part_depth: 'gpt-6.1-sol-xhigh', part_reduce: 'gpt-6.1-sol-xhigh',
    raster_step01: 'claude-opus-5-5-xhigh', raster_step01_review: 'claude-sonnet-5-5-xhigh',
    raster_step02: 'claude-sonnet-5-5-xhigh', raster_step03: 'claude-sonnet-5-5-xhigh',
    assembly: 'claude-sonnet-5-5-xhigh', shadow: 'claude-sonnet-5-5-xhigh', nine_axis_head: 'claude-sonnet-5-5-xhigh',
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
  const notImage = join(root, 'not-image.txt'); await writeFile(notImage, 'not an image');
  let protocol = 'openai', expectedBackground = 'transparent', called = 0;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk); const bytes = Buffer.concat(chunks); called++;
    if (protocol === 'gemini') {
      assert.equal(req.url, '/v1beta/models/gemini-nano-banana-2.1:generateContent');
      assert.equal(req.headers['x-goog-api-key'], 'image-test-secret');
      const body = JSON.parse(bytes.toString());
      assert.ok(body.contents[0].parts[0].text.replace(/\r\n/g, '\n').startsWith('原样的绘制提示词\n\n'));
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
      [`layering_${provider}_image_api_key`]: 'image-test-secret', ...(provider === 'google' ? { layering_google_image_protocol: mode } : {}) }, root);
    const outputDirectory = `${provider}-${mode}`;
    const tool = imageGenerationTool(settings, 'part_simplify', join(root, outputDirectory))!;
    const current = { name: tool.name, description: tool.description, inputSchema: tool.inputSchema };
    if (definition) assert.deepEqual(current, definition);
    else definition = current;
    assert.ok(!Object.hasOwn((tool.inputSchema as { properties: Record<string, unknown> }).properties, 'model'));
    const result = await tool.execute({ prompt: '原样的绘制提示词', input_images: [source] }, new AbortController().signal);
    const output = JSON.parse((result.contentItems[0] as { text: string }).text);
    assert.ok(isAbsolute(output.savedPath) && output.savedPath.startsWith(join(root, outputDirectory) + sep));
    assert.equal((await sharp(output.savedPath).metadata()).format, 'png');
    assert.deepEqual(await readFile(source), png);
    const custom = join(await fixture(t), `${provider}-${mode}.png`);
    const requested = await tool.execute({ prompt: '原样的绘制提示词', input_images: [source], output_path: custom },
      new AbortController().signal, { root, directory: root, outputDirectory: root, workspace: root });
    assert.equal(JSON.parse((requested.contentItems[0] as { text: string }).text).savedPath, custom);
    assert.equal((await sharp(custom).metadata()).format, 'png');
    // Like Codex native imagegen, the tool takes absolute paths only.
    await assert.rejects(tool.execute({ prompt: 'test', input_images: [relative(root, source)] }, new AbortController().signal), /input_images 中的路径 必须是绝对路径/);
    await assert.rejects(tool.execute({ prompt: 'test', input_images: [source], output_path: 'relative.png' }, new AbortController().signal), /output_path 必须是绝对路径/);
    await assert.rejects(tool.execute({ prompt: 'test', input_images: [notImage] }, new AbortController().signal), /unsupported image|Input buffer|Unsupported image/i);
  }
  assert.equal(called, 6);
});

const fakeCli = `#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
const args=process.argv.slice(2), kind=args.includes('--mcp-config')?'claude':'agv';
const resumeFlag=kind==='claude'?'--resume':'--conversation';
const resumed=args.includes(resumeFlag)?args[args.indexOf(resumeFlag)+1]:undefined;
if(resumed==='missing'){console.log(JSON.stringify({type:'result',is_error:true,session_id:resumed,error:'session not found'}));process.exit(1);}
const refuse=(turns=1)=>{console.log(JSON.stringify({type:'system',subtype:'model_refusal_no_fallback',session_id:resumed||'r',api_refusal_category:'reasoning_extraction'}));console.log(JSON.stringify({type:'result',subtype:'success',is_error:true,stop_reason:'refusal',stop_details:{type:'refusal',category:'reasoning_extraction'},api_error_status:null,num_turns:turns,session_id:resumed||'r',result:"API Error: Opus 5.5's safeguards flagged this message. Try rephrasing the request in a new session or change your model."}));process.exit(1);}
if(resumed==='refused')refuse();
// Claude reports tool_use items and "Prompt is too long"; AGV reports tool steps after its user input and Gemini's token count text.
const overflow=(tools,id=randomUUID())=>{if(kind==='claude'){for(let i=0;i<tools;i++)console.log(JSON.stringify({type:'assistant',session_id:id,message:{content:[{type:'tool_use',id:'t'+i,name:'Read',input:{}}]}}));console.log(JSON.stringify({type:'result',is_error:true,session_id:id,error:'Prompt is too long'}));}
else{const step=(i,type)=>console.log(JSON.stringify({event:'step_update',step_update:{conversation_id:id,step_index:i,step_type:type,state:'DONE',text_delta:''}}));step(0,'user_input');step(1,'system_message');step(2,'checkpoint');for(let i=0;i<tools;i++)step(i+3,'tool');console.log(JSON.stringify({event:'result',result:{conversation_id:id,status:'ERROR',error:'The input token count (1200000) exceeds the maximum number of tokens allowed (1048576)'}}));}
process.exit(1);};
if(resumed==='full')overflow(0,resumed);
let input='';for await(const chunk of process.stdin)input+=chunk;
if(input.includes('总是拒绝'))refuse();
if(input.includes('总是超窗'))overflow(0);
if(input.includes('用工具后超窗')){const count=join(process.cwd(),'overflows');let n=0;try{n=Number(await readFile(count,'utf8'));}catch{}if(n<2){await writeFile(count,String(n+1));overflow(3);}}
if(input.includes('跑一阵被拒')){const count=join(process.cwd(),'refusals');let n=0;try{n=Number(await readFile(count,'utf8'));}catch{}if(n<2){await writeFile(count,String(n+1));refuse(40);}}
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

test('Claude and agv run in the step workspace with original MCP schemas and resumable local session data', async t => {
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
    const a = JSON.parse(await readFile(join(cwd, 'workspace', 'invocation.json'), 'utf8'));
    const second = await runCliTask(task, model, settings, options, new AbortController().signal, first.threadId!);
    assert.equal(second.threadId, first.threadId);
    const b = JSON.parse(await readFile(join(cwd, 'workspace', 'invocation.json'), 'utf8'));
    assert.equal(await readFile(join(first.logDirectory!, 'prompt.md'), 'utf8'), a.input.message.content[0].text);
    assert.equal(a.cwd, b.cwd); assert.equal(a.cwd, join(cwd, 'workspace')); assert.equal(a.data, b.data);
    assert.notEqual(first.logDirectory, second.logDirectory);
    for (const path of [a.data, a.agvData]) assert.ok(path.startsWith(join(cwd, 'agents')));
    assert.ok(a.input.message.content[0].text.startsWith(task.prompt));
    assert.equal(a.args[a.args.indexOf('--effort') + 1], model.effort);
    assert.equal(a.args[a.args.indexOf('--model') + 1], wireModel);
    assert.equal(b.args[b.args.indexOf('--model') + 1], wireModel);
    const request = JSON.parse(await readFile(join(first.logDirectory!, 'request.json'), 'utf8'));
    assert.equal(request.threadOptions.model, model.model);
    if (process.platform !== 'win32') assert.equal((await stat(join(first.logDirectory!, 'mcp.json'))).mode & 0o777, 0o600);
  }
  assert.equal(called, 8);
});

test('Claude and AGV env-node launchers work when the service PATH has no Node, including child tools', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'env-node.mjs');
  await mkdir(cwd, { recursive: true });
  const script = fakeCli.replace('const meta=', `const {execFileSync}=await import('node:child_process');
const childNode=process.platform==='win32'
  ? execFileSync('node',['-p','process.execPath'],{encoding:'utf8'}).trim()
  : execFileSync('/usr/bin/env',['node','-p','process.execPath'],{encoding:'utf8'}).trim();
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
    const child = JSON.parse(await readFile(join(cwd, 'workspace', 'child-node.json'), 'utf8'));
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

test('a CLI session over its context window is replaced once from the recovery prompt', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'fake-cli.mjs');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, fakeCli, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agent_part_review_model: 'claude-sonnet-5-5-high' }, root);
  await mkdir(join(cwd, 'agents/old-data'), { recursive: true });
  await mkdir(join(cwd, 'agents/old-workspace'), { recursive: true });
  await writeFile(join(cwd, 'agents/sessions.json'), JSON.stringify({ full: { harness: 'claude', data: join(cwd, 'agents/old-data'), workspace: join(cwd, 'agents/old-workspace') } }));
  const reasons: string[] = [];
  const agents = new CodexAgents({ environment: settings, cwd, logDirectory: join(cwd, 'agents'),
    runtime: new AgentRuntime(1, async () => assert.fail('a known error must not wait')),
    onThreadReplacement: async (_id, reason) => { reasons.push(reason); } });
  const session = agents.createSession('full');
  try {
    const result = await session.run({ step: 'part_outline_review', name: 'review', cwd, prompt: '继续任务', recoveryPrompt: '从头完成任务' });
    assert.notEqual(result.threadId, 'full'); assert.deepEqual(reasons, ['上下文超出模型窗口']);
    const invocation = JSON.parse(await readFile(join(cwd, 'workspace', 'invocation.json'), 'utf8'));
    assert.match(JSON.stringify(invocation.input), /从头完成任务/);
  } finally { await session.close(); }
});

for (const [harness, model, overflowed] of [['claude', 'claude-sonnet-5-5-high', /Prompt is too long/], ['agv', 'gemini-4-argon-high', /input token count/]] as const)
test(`a new ${harness} session over its context window on its first turn fails; one that called tools is replaced again`, async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'fake-cli.mjs');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, fakeCli, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agv_path: cli, layering_agent_part_review_model: model }, root);
  await mkdir(join(cwd, 'agents/old-data'), { recursive: true });
  await mkdir(join(cwd, 'agents/old-workspace'), { recursive: true });
  await writeFile(join(cwd, 'agents/sessions.json'), JSON.stringify({ full: { harness, data: join(cwd, 'agents/old-data'), workspace: join(cwd, 'agents/old-workspace') } }));
  const reasons: string[] = [];
  const agents = new CodexAgents({ environment: settings, cwd, logDirectory: join(cwd, 'agents'),
    runtime: new AgentRuntime(1, async () => assert.fail('a known error must not wait')),
    onThreadReplacement: async (_id, reason) => { reasons.push(reason); } });
  // The original session is replaced; the new one overflows before any tool call, so the call fails.
  const failing = agents.createSession('full');
  try {
    await assert.rejects(failing.run({ step: 'part_outline_review', name: 'review', cwd, prompt: '继续任务', recoveryPrompt: '从头完成任务，总是超窗' }),
      overflowed);
    assert.deepEqual(reasons, ['上下文超出模型窗口']);
  } finally { await failing.close(); }
  // Sessions that overflow after tool calls accumulated history; each is replaced and the third finishes.
  reasons.length = 0;
  const session = agents.createSession();
  try {
    const result = await session.run({ step: 'part_outline_review', name: 'review', cwd, prompt: '用工具后超窗', recoveryPrompt: '从头完成任务，用工具后超窗' });
    assert.equal(result.text, '完成');
    assert.deepEqual(reasons, ['上下文超出模型窗口', '上下文超出模型窗口']);
  } finally { await session.close(); }
});

test('a CLI session refused by model safeguards is replaced once from the recovery prompt, then fails without waiting', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'fake-cli.mjs');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, fakeCli, { mode: 0o700 });
  await writeFile(join(cwd, 'keep.svg'), 'existing');
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agent_part_review_model: 'claude-sonnet-5-5-high' }, root);
  await mkdir(join(cwd, 'agents/old-data'), { recursive: true });
  await mkdir(join(cwd, 'agents/old-workspace'), { recursive: true });
  await writeFile(join(cwd, 'agents/sessions.json'), JSON.stringify({ refused: { harness: 'claude', data: join(cwd, 'agents/old-data'), workspace: join(cwd, 'agents/old-workspace') } }));
  const reasons: string[] = [];
  const agents = new CodexAgents({ environment: settings, cwd, logDirectory: join(cwd, 'agents'),
    runtime: new AgentRuntime(1, async () => assert.fail('a refusal must not wait')),
    onThreadReplacement: async (_id, reason) => { reasons.push(reason); } });
  const session = agents.createSession('refused');
  try {
    const result = await session.run({ step: 'part_outline_review', name: 'review', cwd, prompt: '继续任务', recoveryPrompt: '从头完成任务' });
    assert.notEqual(result.threadId, 'refused'); assert.deepEqual(reasons, ['模型安全过滤拒绝了本会话']);
    const invocation = JSON.parse(await readFile(join(cwd, 'workspace', 'invocation.json'), 'utf8'));
    assert.match(JSON.stringify(invocation.input), /从头完成任务/);
    assert.equal(await readFile(join(cwd, 'keep.svg'), 'utf8'), 'existing');
  } finally { await session.close(); }

  // The new session is refused on its first turn: the recovery prompt itself is refused, so it fails at once with the CLI's own text.
  const again: string[] = [];
  const retrying = new CodexAgents({ environment: settings, cwd, logDirectory: join(cwd, 'agents'),
    runtime: new AgentRuntime(1, async () => assert.fail('a refusal must not wait')),
    onThreadReplacement: async (_id, reason) => { again.push(reason); } }).createSession('refused');
  try {
    await assert.rejects(retrying.run({ step: 'part_outline_review', name: 'review', cwd, prompt: '继续任务', recoveryPrompt: '从头完成任务，总是拒绝' }),
      (error: AgentCallError) => /safeguards flagged/.test(error.message) && JSON.stringify(error.info) === JSON.stringify({ refusal: { category: 'reasoning_extraction', turns: 1 } }));
    assert.deepEqual(again, ['模型安全过滤拒绝了本会话']);
  } finally { await retrying.close(); }
});

test('a new session refused after working for a while is replaced again', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'fake-cli.mjs');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, fakeCli, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agent_part_review_model: 'claude-sonnet-5-5-high' }, root);
  const reasons: string[] = [];
  const agents = new CodexAgents({ environment: settings, cwd, logDirectory: join(cwd, 'agents'),
    runtime: new AgentRuntime(1, async () => assert.fail('a refusal must not wait')),
    onThreadReplacement: async (_id, reason) => { reasons.push(reason); } });
  const session = agents.createSession();
  try {
    // The first two sessions each run 40 turns before a refusal; the third finishes.
    const result = await session.run({ step: 'part_outline_review', name: 'review', cwd, prompt: '跑一阵被拒', recoveryPrompt: '从头完成任务，跑一阵被拒' });
    assert.equal(result.text, '完成');
    assert.deepEqual(reasons, ['模型安全过滤拒绝了本会话', '模型安全过滤拒绝了本会话']);
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
    const switched = await session.run({ step: 'part_outline_review', name: 'switched', cwd, prompt: 'continue from file' });
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
  console.log(JSON.stringify({type:'result',session_id:id,is_error:true,api_error_status:503,error:'503 service unavailable'}));process.exit(1);
}
const meta=`).replace("result:'完成'", "result:'{\"status\":\"completed\",\"summary\":\"recovered\"}'");
  await writeFile(cli, script, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agent_raster_step02_model: 'claude-sonnet-5-5-high',
    layering_raster_step02_image_model: 'gemini-nano-banana-2.1', layering_google_image_base_url: 'https://image.example/v1beta', layering_google_image_api_key: 'fixture' }, root);
  const ids: string[] = [], retries: number[] = [];
  const result = await runAgent({ directory: cwd, step: 'raster_step02', model: 'claude-sonnet-5-5', effort: 'high',
    environment: settings, prompt: 'continue', async onEvent(event) {
      if (event.type === 'thread.started') ids.push(event.thread_id);
    }, onRetry: retry => { retries.push(retry.nextAttempt); } }, new AgentRuntime(1, async () => {}));
  assert.equal(result.summary, 'recovered');
  assert.deepEqual(retries, [2]);
  assert.equal(ids.length, 1);
  const records = JSON.parse(await readFile(join(cwd, 'agents/sessions.json'), 'utf8'));
  assert.deepEqual(Object.keys(records), ids);
});

test('raster custom image tools accept upstream and other local reference paths', async t => {
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
const imageTool=list.tools.find(tool=>tool.name==='imagegen');
if(!imageTool)throw new Error('missing image tool');
const generated=await rpc('tools/call',{name:imageTool.name,arguments:{prompt:'fixture',input_images:[process.env.LAYERING_TEST_REFERENCE]}});
if(generated.isError)throw new Error(generated.content[0].text);
const outside=await rpc('tools/call',{name:imageTool.name,arguments:{prompt:'fixture',input_images:[process.env.LAYERING_TEST_OTHER_REFERENCE]}});
if(outside.isError)throw new Error(outside.content[0].text);
const id=resumed||randomUUID();`).replace("result:'完成'", "result:'{\"status\":\"completed\",\"summary\":\"generated\"}'");
  await writeFile(cli, script, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_agent_raster_step01_model: 'claude-sonnet-5-5-high',
    layering_raster_step01_image_model: 'gpt-image-2.5-flare', layering_openai_image_base_url: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
    layering_openai_image_api_key: 'fixture', LAYERING_TEST_REFERENCE: source, LAYERING_TEST_OTHER_REFERENCE: other }, root);
  const result = await runAgent({ directory: cwd, step: 'raster_step01', model: 'claude-sonnet-5-5', effort: 'high',
    environment: settings, prompt: 'generate', onEvent: async () => {} }, new AgentRuntime(1));
  assert.equal(result.summary, 'generated'); assert.equal(called, 2);
  assert.deepEqual(await readFile(source), png);
});
