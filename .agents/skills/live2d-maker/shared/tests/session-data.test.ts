import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { codexSessionEnvironment, productionCodexConfig } from '../codex/session-data.ts';
import { readSessions, rememberSession, resolveSession } from '../agents/session-data.ts';

test('Codex profile copies authentication only, keeps refreshed credentials, and never mutates the caller environment', async t => {
  const root = await mkdtemp(join(tmpdir(), 'codex-profile-')); t.after(() => rm(root, { recursive: true, force: true }));
  const native = join(root, 'native'), data = join(root, 'agents/session/cli-data'); await mkdir(native);
  for (const [name, content] of Object.entries({ 'auth.json': '{"token":"fixture"}', 'AGENTS.md': 'private instruction', 'config.toml': 'developer_instructions="private"', 'memory.md': 'private history' }))
    await writeFile(join(native, name), content);
  const source = { CODEX_HOME: native, PATH: '/fixture', CODEX_API_KEY: 'fixture-key', LAYERING_IMAGE_MODEL: 'fixture-image' };
  const env = await codexSessionEnvironment(data, source);
  assert.equal(source.CODEX_HOME, native); assert.equal(env.CODEX_HOME, join(data, 'codex'));
  assert.equal(env.CODEX_API_KEY, source.CODEX_API_KEY); assert.equal(env.LAYERING_IMAGE_MODEL, source.LAYERING_IMAGE_MODEL);
  assert.deepEqual((await readdir(env.CODEX_HOME!)).sort(), ['auth.json', 'config.toml']);
  assert.equal(await readFile(join(env.CODEX_HOME!, 'auth.json'), 'utf8'), '{"token":"fixture"}');
  assert.doesNotMatch(await readFile(join(env.CODEX_HOME!, 'config.toml'), 'utf8'), /private/);
  assert.equal(productionCodexConfig.project_doc_max_bytes, 0);
  assert.equal(productionCodexConfig['features.hooks'], false);
  if (process.platform !== 'win32') assert.equal((await stat(join(env.CODEX_HOME!, 'auth.json'))).mode & 0o777, 0o600);
  await writeFile(join(env.CODEX_HOME!, 'auth.json'), 'refreshed');
  assert.equal((await codexSessionEnvironment(data, source)).CODEX_HOME, env.CODEX_HOME);
  assert.equal(await readFile(join(env.CODEX_HOME!, 'auth.json'), 'utf8'), 'refreshed');
  assert.equal(await readFile(join(native, 'auth.json'), 'utf8'), '{"token":"fixture"}');
});

test('all harnesses share a relative session registry that survives moving a task', async t => {
  const root = await mkdtemp(join(tmpdir(), 'session-paths-')); t.after(() => rm(root, { recursive: true, force: true }));
  const task = join(root, 'before'), agents = join(task, 'nine-axis/agents');
  await mkdir(join(task, 'nine-axis/step08/workspace'), { recursive: true });
  await Promise.all(['codex', 'claude', 'agv'].map(async harness => {
    await mkdir(join(agents, harness, 'cli-data'), { recursive: true });
    await rememberSession(agents, harness, { harness: harness as 'codex'|'claude'|'agv', data: `nine-axis/agents/${harness}/cli-data`, workspace: 'nine-axis/step08/workspace' });
  }));
  const next = join(root, 'after'); await rename(task, next);
  const records = await readSessions(join(next, 'nine-axis/agents'));
  assert.equal(Object.keys(records).length, 3);
  for (const record of Object.values(records)) {
    const resolved = await resolveSession(join(next, 'nine-axis/agents'), next, record);
    assert.ok(resolved.data.startsWith(next)); assert.ok(resolved.workspace.startsWith(next));
  }
  await writeFile(join(next, records.codex.data, 'rollout.jsonl'), 'saved history');
  const resolved = await resolveSession(join(next, 'nine-axis/agents'), next, { ...records.codex, rollout: records.codex.data + '/rollout.jsonl' });
  assert.equal(resolved.rollout, await realpath(join(next, records.codex.data, 'rollout.jsonl')));
});

test('session paths reject lexical and symlink escapes for native data and workspaces', async t => {
  const root = await mkdtemp(join(tmpdir(), 'session-escape-')); t.after(() => rm(root, { recursive: true, force: true }));
  const task = join(root, 'task'), agents = join(task, 'agents'), data = join(agents, 'data'), work = join(task, 'workspace'), outside = join(root, 'outside');
  for (const path of [data, work, outside]) await mkdir(path, { recursive: true });
  const record = { harness: 'codex' as const, data, workspace: work };
  await assert.rejects(resolveSession(agents, task, { ...record, data: outside }), /会话目录/);
  await assert.rejects(resolveSession(agents, task, { ...record, workspace: outside }), /工作目录/);
  await assert.rejects(resolveSession(agents, task, { ...record, data: '../outside' }), /不能越出/);
  await writeFile(join(outside, 'history.jsonl'), 'outside history');
  await assert.rejects(resolveSession(agents, task, { ...record, rollout: join(outside, 'history.jsonl') }), /历史文件/);
  if (process.platform !== 'win32') {
    await symlink(outside, join(agents, 'escape')); await symlink(outside, join(task, 'escape'));
    await assert.rejects(resolveSession(agents, task, { ...record, data: join(agents, 'escape') }), /会话目录/);
    await assert.rejects(resolveSession(agents, task, { ...record, workspace: join(task, 'escape') }), /工作目录/);
  }
});

test('Codex refuses a redirected profile or config file before touching host configuration', { skip: process.platform === 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'profile-redirect-')); t.after(() => rm(root, { recursive: true, force: true }));
  const data = join(root, 'cli-data'), native = join(root, 'native');
  await mkdir(data); await mkdir(native); await writeFile(join(native, 'config.toml'), 'host configuration');
  await symlink(native, join(data, 'codex'));
  await assert.rejects(codexSessionEnvironment(data, {}), /配置目录/);
  await rm(join(data, 'codex')); await mkdir(join(data, 'codex'));
  await symlink(join(native, 'config.toml'), join(data, 'codex/config.toml'));
  await assert.rejects(codexSessionEnvironment(data, {}), /普通文件/);
  assert.equal(await readFile(join(native, 'config.toml'), 'utf8'), 'host configuration');
});
