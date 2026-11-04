import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ToolCatalog, toolsDirectory } from '../codex/tool-config.ts';
import { profile as clothing } from '../../clothing-part-layering/profile.ts';
const characterTools = fileURLToPath(new URL('../../part-layering/tools/', import.meta.url));
import { CodexAgents } from '../codex/agents.ts';
import { stepKnowledge } from '../knowledge.ts';
import { textResult } from '../codex/function-tools.ts';
import { fakeAppServer } from '../../part-layering/tests/fake-app-server.ts';
import { nodeExecutables } from '../../part-layering/tests/node-executables.ts';
import { createSvgPreviewTool } from '../part/svg-tools.ts';

test('人物与衣服共用 write_groups；管线自有工具不污染共享定义', () => {
  const shared = new ToolCatalog(), character = new ToolCatalog(toolsDirectory, characterTools), clothingCatalog = new ToolCatalog(toolsDirectory, clothing.toolsDirectory);
  assert.deepEqual(character.get('write_groups'), shared.get('write_groups'));
  assert.deepEqual(clothingCatalog.get('write_groups'), shared.get('write_groups'));
  assert.ok(!('subject' in (shared.get('write_groups').inputSchema.properties as object)));
  assert.ok(character.names().includes('copy_parent_region') && !shared.names().includes('copy_parent_region'));
});

test('管线自有工具只出现在该管线的 catalog；缺文件明确报错', async t => {
  const own = fileURLToPath(new URL('../../shadow/tools/', import.meta.url));
  assert.ok(new ToolCatalog(toolsDirectory, own).names().includes('inspect_shadow_mask'));
  assert.ok(!new ToolCatalog().names().includes('inspect_shadow_mask'));
  // Which tools an agent sees is decided by its agent.json, not the catalog.
  assert.ok(!stepKnowledge('clothing-part-layering', 'step01_preparation').tools('main', [{ ...new ToolCatalog(toolsDirectory, fileURLToPath(new URL('../../part-layering/tools/', import.meta.url))).get('reuse_reference'), execute: async () => textResult('') }]).length);
  const root = await mkdtemp(join(tmpdir(), 'tool-own-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'only_description'));
  await writeFile(join(root, 'only_description/description.md'), '说明');
  assert.throws(() => new ToolCatalog(toolsDirectory, root), /only_description 缺少 schema.json/);
});

test('修改本地配置在新 catalog 生效；已加载定义不被文件或调用者修改', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tool-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, 'tools', 'update_group_note'), knowledge = join(root, 'knowledge'), described = join(knowledge, 'shared', 'tools', 'update_group_note');
  await mkdir(dir, { recursive: true });
  await mkdir(described, { recursive: true });
  await writeFile(join(described, 'description.md'), '初始说明');
  const schema = await readFile(join(toolsDirectory, 'update_group_note/schema.json'));
  await writeFile(join(dir, 'schema.json'), schema);
  const catalog = () => new ToolCatalog(join(root, 'tools'), undefined, knowledge);
  const before = catalog();
  await writeFile(join(described, 'description.md'), '修改后的工具说明');
  assert.equal(catalog().get('update_group_note').description, '修改后的工具说明');
  assert.equal(before.get('update_group_note').description, '初始说明');
  before.get('update_group_note').inputSchema.required = [];
  assert.deepEqual(before.get('update_group_note').inputSchema.required, ['oldText', 'newText']);
  await writeFile(join(dir, 'schema.json'), '{ broken');
  assert.throws(catalog, /update_group_note.*schema.json/);
});

test('本地工具定义实际注册到 App Server，续轮保留定义并使用本轮回调', async t => {
  nodeExecutables(t);
  const root = await mkdtemp(join(tmpdir(), 'tool-registration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const overrides = join(root, 'tools'), dir = join(overrides, 'update_group_note');
  const knowledge = join(root, 'knowledge'), described = join(knowledge, 'shared', 'tools', 'update_group_note');
  await mkdir(dir, { recursive: true });
  await mkdir(described, { recursive: true });
  const schema = { type: 'object', properties: { oldText: { type: 'string', const: 'before' }, newText: { type: 'string' } },
    required: ['oldText', 'newText'], additionalProperties: false };
  await writeFile(join(described, 'description.md'), '本地编辑的说明');
  await writeFile(join(dir, 'schema.json'), JSON.stringify(schema));
  const catalog = new ToolCatalog(toolsDirectory, overrides, knowledge);
  const server = await fakeAppServer(root, [{ tool: 'update_group_note', arguments: { oldText: 'before', newText: 'after' } }]);
  const agents = new CodexAgents({ cwd: root, codexPathOverride: server.executable, logDirectory: join(root, 'logs') });
  const session = agents.createSession(), calls: string[] = [];
  try {
    for (const phase of ['draw', 'repair']) {
      await session.run({ name: phase, prompt: phase, tools: [{ ...catalog.get('update_group_note'),
        async execute(value) { assert.deepEqual(value, { oldText: 'before', newText: 'after' }); calls.push(phase); return textResult(phase); },
      }] });
      await writeFile(join(described, 'description.md'), '下一次进程启动后才生效');
    }
  } finally { await session.close(); }
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const starts = protocol.filter(message => message.method === 'thread/start');
  assert.equal(starts.length, 1);
  assert.equal(starts[0].params.cwd, join(root, 'workspace'));
  assert.deepEqual(starts[0].params.dynamicTools, [{ type: 'function', name: 'update_group_note', description: '本地编辑的说明', inputSchema: schema }]);
  assert.equal(protocol.filter(message => message.method === 'turn/start').length, 2);
  assert.deepEqual(calls, ['draw', 'repair']);
});

test('阶段限制随工具定义注册，普通预览只注册原图参数', async t => {
  nodeExecutables(t);
  const root = await mkdtemp(join(tmpdir(), 'preview-tool-registration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = await fakeAppServer(root, []);
  const tool = createSvgPreviewTool({ directory: root, reference: join(root, 'reference.png'),
    canvas: { width: 100, height: 100 }, observationDirectory: join(root, 'observations') });
  const agents = new CodexAgents({ cwd: root,
    codexPathOverride: server.executable, logDirectory: join(root, 'logs') });
  await agents.run({ name: 'ordinary-preview', prompt: 'fixture', tools: [tool] });
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const start = protocol.find(message => message.method === 'thread/start');
  const properties = start.params.dynamicTools[0].inputSchema.properties;
  assert.ok(properties.crop);
  assert.equal(properties.reference, undefined);
  assert.equal(properties.referenceRegion, undefined);
  assert.equal(properties.referenceOffset, undefined);
  const completion = createSvgPreviewTool({ directory: root, reference: join(root, 'reference.png'),
    canvas: { width: 100, height: 100 }, observationDirectory: root, allowGeneratedReference: true });
  assert.ok((completion.inputSchema.properties as Record<string, unknown>).referenceRegion);
});
