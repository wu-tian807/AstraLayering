import { withCodex } from './fake-codex.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import sharp from 'sharp';
import { temporaryKnowledge } from './knowledge-fixture.ts';
import { checkKnowledge, stepKnowledge } from '../knowledge.ts';
import { agentImageGeneration } from '../agent-knowledge.ts';
import { imageSteps, stepModelSlots } from '../agents/models.ts';
import { imageGenerationTool } from '../agents/images.ts';
import { createCodexImageRoute, usesPatchedImageTool } from '../agents/codex-images.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { CodexAgents } from '../codex/agents.ts';
import { fakeAppServer } from '../../part-layering/tests/fake-app-server.ts';

async function setImages(directory: string, enabled: boolean) {
  const path = join(directory, 'raster-layering/step02/agent.json');
  const config = JSON.parse(await readFile(path, 'utf8'));
  config.main.tools = config.main.tools.filter((name: string) => name !== 'imagegen');
  if (enabled) config.main.tools.push('imagegen');
  await writeFile(path, JSON.stringify(config));
}

test('nine-axis steps use their own agent.json while sharing a model slot', async t => {
  const knowledge = await temporaryKnowledge(t);
  const entries = [['step03_frames', ['nine_axis_view_frames']], ['step04_outline', ['nine_axis_outline']], ['step04_angles', ['nine_axis_head', 'nine_axis_head_y', 'nine_axis_head_down']],
    ['step05_frames', ['nine_axis_frames']], ['step06_angle-xy', ['nine_axis_head_xy']], ['step07_jaw-line', ['nine_axis_head_jaw']], ['step08_hair',['nine_axis_head_hair']], ['step09_head-accessories',['nine_axis_head_accessories']]] as const;
  for (const [directory, identities] of entries) {
    const path = join(knowledge, 'head-nine-axis', directory, 'agent.json');
    const config = JSON.parse(await readFile(path, 'utf8'));
    config.main.tools.push('imagegen');
    await writeFile(path, JSON.stringify(config));
    for (const [, others] of entries) for (const other of others) assert.equal(agentImageGeneration(other), (identities as readonly string[]).includes(other));
    config.main.tools.pop();
    await writeFile(path, JSON.stringify(config));
  }
});

test('all named agents read capability from their role; main and repair share tools', async t => {
  const knowledge = await temporaryKnowledge(t);
  for (const step of Object.keys(stepModelSlots)) assert.equal(typeof agentImageGeneration(step as keyof typeof stepModelSlots), 'boolean');
  for (const step of ['raster_step02', 'raster_step03', 'raster_step01_review', 'clothing_raster_step02', 'clothing_raster_step01_review', 'assembly'] as const) {
    assert.equal(agentImageGeneration(step), false, step);
  }
  for (const section of ['part-layering', 'clothing-part-layering', 'raster-layering', 'clothing-raster-layering']) {
    const step = stepKnowledge(section, section.endsWith('raster-layering') ? 'step01' : 'step09_outline');
    assert.deepEqual(step.toolNames('repair'), step.toolNames('main'), section);
    assert.equal(step.imageGeneration('repair'), step.imageGeneration('main'), section);
  }
  assert.equal(agentImageGeneration('raster_step01_repair'), true, 'repair uses main tools');
  const path = join(knowledge, 'raster-layering/step01/agent.json');
  const config = JSON.parse(await readFile(path, 'utf8'));
  config.main.tools = config.main.tools.filter((name: string) => name !== 'imagegen');
  await writeFile(path, JSON.stringify(config));
  checkKnowledge(knowledge);
  assert.equal(agentImageGeneration('raster_step01'), false);
  assert.equal(agentImageGeneration('raster_step01_review'), false);
  assert.equal(agentImageGeneration('raster_step01_repair'), false);
  assert.throws(() => stepKnowledge('raster-layering', 'step01').tools('repair', [{ name: 'imagegen' } as any]), /没有提供执行实现/);
  config.main.tools.push('imagegen');
  await writeFile(path, JSON.stringify(config));
  assert.equal(agentImageGeneration('raster_step01'), true);
  assert.equal(agentImageGeneration('raster_step01_repair'), true);
  assert.equal(agentImageGeneration('raster_step01_review'), false);
  await setImages(knowledge, true);
  assert.ok(imageSteps().includes('raster_step02'), 'custom knowledge can enable a formerly manual step');
  config.main.tools.push('missing-tool');
  await writeFile(path, JSON.stringify(config));
  assert.throws(() => checkKnowledge(knowledge), /未注册的工具/);
});

test('new imagegen capabilities inherit global defaults without changing the selected knowledge', async t => {
  const knowledge=await temporaryKnowledge(t);
  await setImages(knowledge,true);
  const native=loadWorkflowEnvironment({},knowledge);
  assert.equal(native.stepImages.raster_step02,native.stepImages.raster_step01);
  const custom=loadWorkflowEnvironment({default_image_model:'gpt-image-2.6-flare'},knowledge);
  assert.equal(custom.stepImages.raster_step02,'gpt-image-2.6-flare');
  assert.equal(agentImageGeneration('raster_step02'),true);
});

for (const model of ['codex-native', 'gpt-image-2.5-flare', 'gemini-nano-banana-2.1'] as const) {
  test(`Codex ${model}: agent.json controls start/resume and closes custom image routes`, async t => {
    const knowledge = await temporaryKnowledge(t);
    await setImages(knowledge, true);
    const server = await fakeAppServer(knowledge, [], 'completed', [], { finalText: 'done' });
    const settings = withCodex(loadWorkflowEnvironment({
      raster_step02_image_model: model,
      openai_image_base_url: 'http://127.0.0.1:1/v1', openai_image_api_key: 'fixture',
      google_image_base_url: 'http://127.0.0.1:1/v1', google_image_api_key: 'fixture',
    }, knowledge), server.executable);
    settings.codex.config = { 'features.image_generation': true, features: { image_generation: true } };
    const agents = new CodexAgents({ environment: settings, cwd: knowledge });
    const session = agents.createSession();
    try {
      await session.run({ step: 'raster_step02', name: 'declared', prompt: 'done' });
      await setImages(knowledge, false); // settings deliberately retain the old model selection.
      assert.equal(imageGenerationTool(settings, 'raster_step02', knowledge), undefined);
      assert.equal(usesPatchedImageTool(settings, 'raster_step02'), false);
      await assert.rejects(createCodexImageRoute(settings, 'raster_step02', knowledge), /不使用自定义 Codex 生图补丁/);
      await session.run({ step: 'raster_step02', name: 'manual', prompt: 'done', imageGeneration: true,
        tools: [{ name: 'imagegen', description: 'stale', inputSchema: { type: 'object' }, execute: async () => assert.fail('removed tool ran') }] });
    } finally { await session.close(); }
    const calls = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(calls.find(call => call.method === 'thread/start').params.config['features.image_generation'], true);
    const resumed = calls.find(call => call.method === 'thread/resume');
    assert.equal(resumed.params.config['features.image_generation'], false);
    assert.ok(!resumed.params.dynamicTools.some((tool: any) => tool.name === 'imagegen'));
  });
}

const cli = `#!${process.execPath}
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const args=process.argv.slice(2),claude=args.includes('--mcp-config');
for await(const chunk of process.stdin){}
const config=claude?args[args.indexOf('--mcp-config')+1]:join(process.env.ANTIGRAVITY_GEMINI_DIR,'config/mcp_config.json');
const env=JSON.parse(await readFile(config,'utf8')).mcpServers.layering.env;
async function rpc(method,params){const response=await fetch(env.LAYERING_MCP_URL,{method:'POST',headers:{authorization:'Bearer '+env.LAYERING_MCP_TOKEN},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return response.json();}
const list=await rpc('tools/list',{}),enabled=process.env.EXPECT_IMAGEGEN==='true';
assert.equal(list.result.tools.some(tool=>tool.name==='imagegen'),enabled);
if(enabled){const result=await rpc('tools/call',{name:'imagegen',arguments:{prompt:'fixture',input_images:[],background:'auto'}});assert.ok(!result.error&&!result.result.isError,JSON.stringify(result));}
else{const result=await rpc('tools/call',{name:'imagegen',arguments:{}});assert.ok(result.error||result.result.isError,'undeclared imagegen must not execute');}
console.log(JSON.stringify(claude?{type:'system',subtype:'init',session_id:'fixture-session'}:{event:'init',conversation_id:'fixture-session'}));
console.log(JSON.stringify(claude?{type:'result',session_id:'fixture-session',result:'done'}:{event:'result',result:{conversation_id:'fixture-session',status:'SUCCESS',response:'done'}}));
`;
for (const harness of ['claude', 'agv'] as const) test(`${harness}: only declared imagegen reaches the custom service; stale tools are removed`, async t => {
  const knowledge = await temporaryKnowledge(t), executable = join(knowledge, 'fixture.mjs');
  await writeFile(executable, cli, { mode: 0o700 });
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } }).png().toBuffer();
  let requests = 0;
  const server = createServer(async (req, res) => { for await (const chunk of req) {} requests++; res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] })); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise<void>(done => server.close(() => done())); });
  await setImages(knowledge, true);
  const settings = loadWorkflowEnvironment({ [`${harness}_path`]: executable,
    raster_step02_agent_model: harness === 'claude' ? 'claude-sonnet-5-5-medium' : 'gemini-4-argon-medium',
    raster_step02_image_model: 'gpt-image-2.5-flare', openai_image_base_url: `http://127.0.0.1:${(server.address() as any).port}/v1`, openai_image_api_key: 'fixture', EXPECT_IMAGEGEN: 'true',
  }, knowledge);
  const session = new CodexAgents({ environment: settings, cwd: knowledge }).createSession();
  try {
    await session.run({ step: 'raster_step02', name: 'declared', prompt: 'fixture' });
    assert.equal(requests, 1);
    await setImages(knowledge, false);
    settings.codex.env!.EXPECT_IMAGEGEN = 'false';
    await session.run({ step: 'raster_step02', name: 'manual', prompt: 'fixture', imageGeneration: true,
      tools: [{ name: 'imagegen', description: 'stale', inputSchema: {}, execute: async () => assert.fail('removed tool ran') }] });
    assert.equal(requests, 1, 'disabled turn made no image API calls');
  } finally { await session.close(); }
});
