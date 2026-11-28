import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { cliExecutable } from '../agents/cli.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';

const entry = (name: string) => process.platform === 'win32' ? name + '.exe' : name;

test('AGV resolves the explicit path or the installed agy on PATH even with old switch values', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-native-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installed = join(root, entry('agy'));
  const explicit = join(root, entry('custom-agy'));
  await writeFile(installed, '', { mode: 0o700 });
  await writeFile(explicit, '', { mode: 0o700 });
  await writeFile(join(root, '.env'), 'agv_unlimited_response_header_timeout=true\n');
  const env = { PATH: root, agv_patch: 'true' };

  assert.equal(await cliExecutable(loadWorkflowEnvironment(env, root), 'agv'), await realpath(installed));
  const settings = loadWorkflowEnvironment({ ...env, agv_path: explicit }, root);
  assert.equal(await cliExecutable(settings, 'agv'), await realpath(explicit));
  assert.equal(settings.codex.env?.agv_unlimited_response_header_timeout, undefined);
  assert.equal(settings.codex.env?.agv_patch, undefined);
});

test('AGV reports a legacy managed copy without launching it or ignoring the configured path', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agv-legacy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installed = join(root, entry('agy'));
  await writeFile(installed, '', { mode: 0o700 });
  const parent = join(root, '.runtime', 'agv', 'fixture', 'v2');
  await mkdir(parent, { recursive: true });
  const old = join(parent, entry('antigravity'));
  await writeFile(old, '', { mode: 0o700 });

  const settings = loadWorkflowEnvironment({ PATH: root, agv_path: old }, root);
  await assert.rejects(cliExecutable(settings, 'agv'), Error);
});
