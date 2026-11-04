import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { createStructureTools, validateRasterStructure } from '../raster/structure-tools.ts';
import { validateOcclusionDocument, type OcclusionLayer } from '../part/occlusion-plan.ts';
import { section as character } from '../../raster-layering/run.ts';
import { section as clothing } from '../../clothing-raster-layering/run.ts';
import { runWorkflow } from '../raster/workflow.ts';
import { seedUpstream } from './upstream-fixture.ts';
import { deliverRasterStep } from './raster-delivery.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { buildReviewPrompt } from '../raster/review.ts';
import { CodexAgents } from '../codex/agents.ts';
import { fakeAppServer } from '../../part-layering/tests/fake-app-server.ts';
import { nodeExecutables } from '../../part-layering/tests/node-executables.ts';
import { createMcpBridge } from '../agents/mcp.ts';
import { prepareGenaiTools } from '../agents/agv-gateway.ts';

const signal = new AbortController().signal;
const row = (id: string, level: number): OcclusionLayer => ({ id, level, note: '按当前工程确认层序', check: { passed: true, note: '已独显检查' } });
async function fixture(t: TestContext, section: typeof character | typeof clothing = character) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'structure-tools-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = await seedUpstream('case', section.inputSection, root);
  const input = { directory, parts: join(directory, 'parts'), ...(section === clothing ? { originalCharacter: join(directory, 'references/clothing.png') } : {}) };
  const tools = createStructureTools(input);
  const tool = (name: string) => tools.find(tool => tool.name === name)!;
  const json = async (file: string) => JSON.parse(await readFile(join(directory, file), 'utf8'));
  const snapshot = async () => Promise.all(['groups.json', 'occlusion.json', 'parts/fixture.svg'].map(file => readFile(join(directory, file), 'utf8')));
  return { root, directory, input, tool, tools, json, snapshot };
}

test('两套 step01 绘制与两轮返修提供编辑工具；reviewer 和后续阶段保持原工具边界', async t => {
  for (const section of [character, clothing]) {
    const f = await fixture(t, section), step = section.steps[0];
    const output = join(f.root, 'case', section.id, 'step01');
    for (const phase of ['draw', 'repair-01', 'repair-02']) {
      assert.deepEqual(section.tools!(output, f.input, step, phase).map(tool => tool.name), ['edit_groups', 'edit_occlusion']);
    }
    for (const phase of ['review-01', 'review-02']) {
      assert.deepEqual(section.tools!(output, f.input, step, phase).map(tool => tool.name), ['annotate_review_regions']);
    }
    assert.deepEqual(section.tools!(output, f.input, section.steps[1], 'draw'), []);
    if (section.id === character.id) assert.deepEqual(section.tools!(output, f.input, section.steps[2], 'draw'), []);
    const draw = await section.buildPrompt(step, f.input, output, []);
    const repair = await buildReviewPrompt(step, { kind: 'repair', filename: 'repair-01.md', index: 1 });
    assert.ok(draw.includes('修改 groups.json 用 edit_groups，修改 occlusion.json 用 edit_occlusion'));
    assert.ok(!draw.includes('直接编辑上游 groups.json'));
    // Repairs continue the drawing thread, or get the drawing prompt prepended in a new one.
    assert.ok(!repair.includes('你负责当前阶段的绘画质量和分层结构'));
  }
});

test('深度工具保存多深度及逐区域依据，保留 sourceHash、分组和 SVG', async t => {
  const f = await fixture(t), before = await f.snapshot();
  const layers: OcclusionLayer[] = [{ id: 'fixture', note: '同一部件的前后片', levels: [
    { level: 0.5, region: '后片' }, { level: 2.5, region: '前片，与后片连续' },
  ], check: { passed: true, note: '同一运动部件', regions: [{ level: 0.5, note: '位于后方' }, { level: 2.5, note: '位于前方' }] } }];
  await f.tool('edit_occlusion').execute({ layers }, signal);
  const plan = validateOcclusionDocument(await f.json('occlusion.json'));
  assert.equal(plan.version, 3); assert.equal(plan.sourceHash, 'fixture');
  assert.deepEqual(plan.layers, layers);
  const after = await f.snapshot();
  assert.equal(after[0], before[0]); assert.equal(after[2], before[2]);
  await validateRasterStructure(f.input);
});

test('未知字段、重复深度、缺失区域或检查返回具体错误；失败不落盘，可在原工具中修正', async t => {
  const f = await fixture(t), before = await f.snapshot();
  const multi: any = { id: 'fixture', note: '依据', levels: [{ level: 0, region: '后' }, { level: 1, region: '前' }],
    check: { passed: true, note: '检查', regions: [{ level: 0, note: '后' }, { level: 1, note: '前' }] } };
  const cases: [unknown, RegExp][] = [
    [{ layers: [{ ...row('fixture', 0), layer: '051 | fixture' }] }, /layers\[0\]\.layer：不支持的字段/],
    [{ layers: [{ ...multi, levels: [{ ...multi.levels[0], layer: '051 | fixture' }, multi.levels[1]] }] }, /levels\[0\]\.layer：不支持的字段/],
    [{ layers: [{ ...multi, levels: [{ level: 0, region: '后' }, { level: 0, region: '前' }] }] }, /levels\[1\]\.level：深度值重复/],
    [{ layers: [{ ...multi, levels: [{ level: 0, region: '' }, multi.levels[1]] }] }, /levels\[0\]\.region：缺少区域描述/],
    [{ layers: [{ ...multi, check: { passed: true, note: '未逐片检查' } }] }, /全部深度区域/],
    [{ layers: [row('unknown', 0)] }, /不是当前终止部件/],
    [{ layers: [row('fixture', -1)] }, /level：深度必须/],
    [{ layers: [row('fixture', NaN)] }, /level：深度必须/],
    [{ layers: [row('fixture', 0)], path: '../other/occlusion.json' }, /edit_occlusion.path：不支持的字段/],
  ];
  for (const [args, error] of cases) {
    await assert.rejects(f.tool('edit_occlusion').execute(args, signal), error);
    assert.deepEqual(await f.snapshot(), before);
  }
  await f.tool('edit_occlusion').execute({ layers: [row('fixture', 0.25)] }, signal);
  await validateRasterStructure(f.input);
});

test('分组工具保留 metadata 和未调整节点，旧记录中的 subject 读取时丢弃，终止 group 也参与深度覆盖', async t => {
  const f = await fixture(t);
  const groups = { groups: [{ id: 'fixture', kind: 'group', name: '原名称', note: '原说明', metadata: { control: 'face' }, groups: [] }] };
  await writeFile(join(f.directory, 'groups.json'), JSON.stringify({ subject: 'character', ...groups }));
  groups.groups[0].note = '已修正职责';
  await f.tool('edit_groups').execute({ groups: groups.groups }, signal);
  assert.deepEqual(await f.json('groups.json'), groups);
  await validateRasterStructure(f.input);
  const before = await f.snapshot();
  for (const [nodes, error] of [
    [[{ id: '../other', groups: [] }], /安全的部件 ID/],
    [[...groups.groups, ...groups.groups], /重复 ID/],
    [[{ id: 'fixture', groups: [], steps: {} }], /steps：不支持的字段/],
    [[{ id: 'fixture', kind: 'part', groups: [{ id: 'fixture/child', groups: [] }] }], /part 不能包含子节点/],
  ] as const) {
    await assert.rejects(f.tool('edit_groups').execute({ groups: nodes }, signal), error);
    assert.deepEqual(await f.snapshot(), before);
  }
});

test('raster 结构写回保留可选显隐标签，错误类型返回当前 agent 且原文件保持完整', async t => {
  const f = await fixture(t);
  const group = { id: 'fixture', kind: 'part', hiddenInReference: true, allowOutsideParent: true, groups: [] };
  await f.tool('edit_groups').execute({ groups: [group] }, signal);
  assert.deepEqual((await f.json('groups.json')).groups, [group]);
  await validateRasterStructure(f.input);
  const before = await f.snapshot();
  for (const field of ['hiddenInReference', 'allowOutsideParent']) {
    await assert.rejects(f.tool('edit_groups').execute({ groups: [{ ...group, [field]: 'true' }] }, signal), /must be a boolean/);
    assert.deepEqual(await f.snapshot(), before);
  }
});

test('拆分必须联动完整深度表与已有 SVG；所有校验通过后才保存两个文件', async t => {
  const f = await fixture(t), before = await f.snapshot();
  const groups = [{ id: 'fixture', kind: 'group', groups: [{ id: 'fixture/left', kind: 'part', groups: [] }, { id: 'fixture/right', kind: 'part', groups: [] }] }];
  const layers = [row('fixture/left', 0), row('fixture/right', 1)];
  await assert.rejects(f.tool('edit_groups').execute({ groups }, signal), /一并提供 layers/);
  await assert.rejects(f.tool('edit_groups').execute({ groups, layers }, signal), /缺少有效 SVG/);
  assert.deepEqual(await f.snapshot(), before);
  await mkdir(join(f.input.parts, 'fixture'));
  for (const side of ['left', 'right']) await writeFile(join(f.input.parts, `fixture/${side}.svg`), `<svg>${side}</svg>`);
  await f.tool('edit_groups').execute({ groups, layers }, signal);
  assert.deepEqual((await f.json('groups.json')).groups, groups);
  assert.deepEqual((await f.json('occlusion.json')).layers, layers);
  assert.equal(await readFile(join(f.input.parts, 'fixture.svg'), 'utf8'), before[2]);
  await validateRasterStructure(f.input);
  // Recreated tools (including after a CLI switch) use the saved tree, not a
  // snapshot of its old leaves or an old grouping step.
  const fresh = createStructureTools(f.input);
  await fresh[1].execute({ layers: layers.map((r, i) => ({ ...r, level: i + 0.5 })) }, signal);
  await validateRasterStructure(f.input);
});

test('取消保留结构文件；SVG 支持指向外部文件的符号链接', async t => {
  const f = await fixture(t), before = await f.snapshot();
  const canceled = AbortSignal.abort(new Error('用户取消'));
  await assert.rejects(f.tool('edit_occlusion').execute({ layers: [row('fixture', 0)] }, canceled), /用户取消/);
  assert.deepEqual(await f.snapshot(), before);
  await writeFile(join(f.root, 'outside.svg'), 'other task');
  await rm(join(f.input.parts, 'fixture.svg'));
  await symlink(join(f.root, 'outside.svg'), join(f.input.parts, 'fixture.svg'));
  await f.tool('edit_occlusion').execute({ layers: [row('fixture', 0)] }, signal);
  assert.deepEqual((await f.snapshot())[0], before[0]);
  assert.deepEqual((await f.json('occlusion.json')).layers, [row('fixture', 0)]);
});

test('两套 step01 结束时结构诊断仅记日志，保留完成状态并推进下一步', async t => {
  for (const section of [character, clothing]) {
    const f = await fixture(t, section), step = { ...section.steps[0], review: undefined };
    const original = await f.json('occlusion.json');
    const next = section.steps[1];
    const deps = { runsDirectory: f.root, environment: loadWorkflowEnvironment({}, f.root), steps: [step, next],
      preflight: async (executable: string) => ({ executable }) };
    const output = join(f.root, 'case', section.id, 'step01');
    const messages: string[] = [], calls: string[] = [];
    await runWorkflow(section, { name: 'case', krita: process.execPath, progress: message => messages.push(message) }, { ...deps, agent: async request => {
      const isFirst = request.step === step.modelStep;
      calls.push(isFirst ? 'step01' : 'step02');
      if (isFirst) {
        const bad = structuredClone(original); bad.layers[0].layer = '051 | fixture';
        await writeFile(join(f.directory, 'occlusion.json'), JSON.stringify(bad));
      }
      return deliverRasterStep(request, isFirst ? step : next, 'original-drawing');
    } });
    assert.deepEqual(calls, ['step01', 'step02']);
    assert.ok(messages.some(message => message.includes('结构检查提示') && message.includes('layers[0].layer：不支持的字段')));
    await readFile(join(output, '.completed'));
    await readFile(join(output, '../step02/.completed'));
    await assert.rejects(readFile(join(output, 'error.txt')), { code: 'ENOENT' });
    assert.equal((await f.json('occlusion.json')).layers[0].layer, '051 | fixture');
    // A retained completed step diagnoses the same issue without rerunning it.
    await runWorkflow(section, { name: 'case', krita: process.execPath }, { ...deps, agent: async () => assert.fail('already completed') });
  }
});

test('编辑工具真实注册到 Codex App Server 并执行校验写入', async t => {
  nodeExecutables(t);
  const f = await fixture(t);
  const server = await fakeAppServer(f.root, [{ tool: 'edit_occlusion', arguments: { layers: [row('fixture', 0.75)] } }]);
  const agents = new CodexAgents({ cwd: f.root, codexPathOverride: server.executable, logDirectory: join(f.root, 'logs') });
  await agents.run({ name: 'controlled edit', prompt: '保存深度', tools: f.tools });
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(protocol.find(message => message.method === 'thread/start').params.dynamicTools.map((tool: any) => tool.name), ['edit_groups', 'edit_occlusion']);
  assert.equal((await f.json('occlusion.json')).layers[0].level, 0.75);
});

test('Claude 共用 MCP 与 AGV 注册同一 schema；错误反馈后可再次提交', async t => {
  const f = await fixture(t), bridge = await createMcpBridge(f.tools, signal);
  try {
    let id = 0;
    const call = async (method: string, params: unknown = {}) => {
      const response = await fetch(bridge.env.LAYERING_MCP_URL, { method: 'POST',
        headers: { authorization: `Bearer ${bridge.env.LAYERING_MCP_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
      return (await response.json()).result;
    };
    const listed = (await call('tools/list')).tools;
    assert.deepEqual(listed.map((tool: any) => tool.name), ['edit_groups', 'edit_occlusion']);
    const failed = await call('tools/call', { name: 'edit_occlusion', arguments: { layers: [{ ...row('fixture', 0), layer: 'bad' }] } });
    assert.equal(failed.isError, true); assert.match(failed.content[0].text, /layers\[0\]\.layer：不支持的字段/);
    assert.equal((await call('tools/call', { name: 'edit_occlusion', arguments: { layers: [row('fixture', 0.8)] } })).isError, false);
    assert.equal((await f.json('occlusion.json')).layers[0].level, 0.8);
    const body: any = {};
    await prepareGenaiTools(body, f.tools, f.root);
    assert.deepEqual(body.tools[0].functionDeclarations.map((tool: any) => ({ name: tool.name, inputSchema: tool.parametersJsonSchema })),
      listed.map((tool: any) => ({ name: tool.name, inputSchema: tool.inputSchema })));
  } finally { await bridge.close(); }
});
