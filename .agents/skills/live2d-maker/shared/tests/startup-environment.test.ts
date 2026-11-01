import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { withNodePath } from '../process-environment.ts';
import { loadWorkflowEnvironment, workflowCodexOptions } from '../codex/environment.ts';
import { checkAgentCli, preflightAgentSteps } from '../agents/preflight.ts';
import { checkKrita } from '../raster/krita.ts';

async function fixture(t: { after(callback: () => Promise<unknown>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'layering fresh install '));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('Codex and CLI child environments retain settings and add the current Node without changing host or source', () => {
  const host = process.env.PATH, source = { PATH: '/custom/bin', CODEX_HOME: '/existing/home' };
  const result = withNodePath(source);
  assert.deepEqual(result.PATH!.split(delimiter), [dirname(process.execPath), '/custom/bin']);
  assert.equal(result.CODEX_HOME, source.CODEX_HOME);
  assert.deepEqual(withNodePath(result), result);
  assert.equal(source.PATH, '/custom/bin');
  assert.equal(process.env.PATH, host);
  const settings = loadWorkflowEnvironment(source, join(tmpdir(), 'no-layering-env'));
  const codex = workflowCodexOptions(settings, { env: { PATH: '', LOCAL_OPTION: 'retained' } });
  assert.equal(codex.env!.PATH, dirname(process.execPath));
  assert.equal(codex.env!.LOCAL_OPTION, 'retained');
  assert.equal(codex.env!.CODEX_HOME, source.CODEX_HOME);
  assert.equal(settings.codex.env!.PATH, source.PATH);
});

test('fresh non-Git install probes Codex, Claude and AGV with env-node and never starts model turns', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t), executable = join(root, 'cli.mjs'), calls = join(root, 'versions.jsonl');
  await writeFile(executable, `#!/usr/bin/env node
import {appendFileSync} from 'node:fs';
if(process.argv.slice(2).join(' ')!=='--version')process.exit(9);
appendFileSync(${JSON.stringify(calls)},JSON.stringify({args:process.argv.slice(2),path:process.env.PATH})+'\\n');
console.log('fixture CLI 1.2.3');\n`, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ PATH: '', layering_codex_path: executable, layering_claude_path: executable,
    layering_agv_path: executable }, root);
  for (const harness of ['codex', 'claude', 'agv'] as const) assert.equal(await checkAgentCli(settings, harness), 'fixture CLI 1.2.3');
  const records = (await readFile(calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records.length, 3);
  for (const record of records) { assert.deepEqual(record.args, ['--version']); assert.equal(record.path, dirname(process.execPath)); }
});

test('preflight checks only selected harnesses once, and reports missing interpreters before drawing', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t), executable = join(root, 'claude'), calls = join(root, 'calls');
  await writeFile(executable, `#!${process.execPath}\nrequire('node:fs').appendFileSync(${JSON.stringify(calls)},'version\\n');console.log('1.2.3');\n`, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ PATH: '', layering_claude_path: executable, layering_agv_path: join(root, 'absent-agv'),
    part_review_agent_model: 'claude-sonnet-5-5-high' }, root);
  await preflightAgentSteps(settings, ['part_outline_review', 'clothing_outline_review']);
  assert.equal(await readFile(calls, 'utf8'), 'version\n');
  await writeFile(executable, '#!/usr/bin/env missing-layering-interpreter\n', { mode: 0o700 });
  await assert.rejects(preflightAgentSteps(settings, ['part_outline_review']), error => {
    assert.match(String(error), /claude CLI 无法在工作流环境启动/);
    assert.match(String(error), /missing-layering-interpreter/);
    assert.match(String(error), /未发起模型请求/);
    return true;
  });
  assert.equal(await readFile(calls, 'utf8'), 'version\n');
  await assert.rejects(checkAgentCli(settings, 'agv'), /没有可用的全局入口/);
});

test('Krita preflight rejects a missing installation without starting Krita', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t), executable = join(root, 'krita'), started = join(root, 'started');
  await writeFile(executable, `#!/bin/sh\ntouch ${JSON.stringify(started)}\n`, { mode: 0o700 });
  assert.deepEqual(await checkKrita(executable, { PATH: '', DISPLAY: ':1' }), { executable });
  await assert.rejects(readFile(started), /ENOENT/);
  await assert.rejects(checkKrita(join(root, 'missing')), /不存在或不可执行/);
});

test('Linux Krita routes reject missing display configuration before drawing and accept explicit desktop/headless settings', { skip: process.platform !== 'linux' }, async t => {
  const root = await fixture(t), executable = join(root, 'krita');
  await writeFile(executable, '#!/bin/sh\n', { mode: 0o700 });
  await assert.rejects(checkKrita(executable, { PATH: '' }), /找不到虚拟桌面 Xvfb（Xvfb）.*apt install xvfb.*「继续」/);
  const xvfb = join(root, 'Xvfb');
  await writeFile(xvfb, '#!/bin/sh\n', { mode: 0o700 });
  assert.equal((await checkKrita(executable, { PATH: root })).executable, executable);
  await assert.rejects(checkKrita(executable, { PATH: root, ASTRA_STUDIO_XVFB: join(root, 'missing-xvfb') }), /missing-xvfb/);
  for (const display of [{ DISPLAY: ':1' }, { WAYLAND_DISPLAY: 'wayland-0' }, { QT_QPA_PLATFORM: 'offscreen' }]) {
    assert.equal((await checkKrita(executable, { PATH: '', ...display })).executable, executable);
  }
});
