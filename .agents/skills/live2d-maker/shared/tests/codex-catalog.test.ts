import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { catalogSignature, prepareRunCatalog, resolveCatalog, sharedCatalogVariable } from '../codex/catalog.ts';

test('one startup catalog is shared across calls and config changes get a fresh catalog', async t => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-run-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, 'home'), task = join(root, 'task'), executableFile = join(root, 'mock.mjs'), count = join(root, 'count');
  await Promise.all([mkdir(home), mkdir(task)]);
  await writeFile(executableFile, `import {appendFile} from 'node:fs/promises'; await appendFile(${JSON.stringify(count)}, 'called\\n'); console.log(JSON.stringify({models:[{slug:'one',tool_mode:'code_mode_only'}]}));`);
  const executable = { command: process.execPath, args: [executableFile, 'app-server'] };
  const options = { env: { ...process.env, CODEX_HOME: home }, config: {} };
  const initialSignature = (await catalogSignature(executable, options)).signature;
  const routeOptions = { ...options, env: { ...options.env, ASTRA_AGENT_SLOTS: 'ipc', LAYERING_IMAGE_API_KEY: 'ephemeral', LAYERING_IMAGE_BASE_URL: 'http://localhost:12345' } };
  assert.equal((await catalogSignature(executable, routeOptions)).signature, initialSignature);
  const changedCredential = { ...options, env: { ...options.env, CUSTOM_PROVIDER_KEY: 'different-secret' } };
  assert.notEqual((await catalogSignature(executable, changedCredential)).signature, initialSignature);
  const shared = await prepareRunCatalog(executable, options, task); assert.ok(shared);
  const old = process.env[sharedCatalogVariable]; process.env[sharedCatalogVariable] = JSON.stringify(shared);
  t.after(() => { if (old === undefined) delete process.env[sharedCatalogVariable]; else process.env[sharedCatalogVariable] = old; });
  const logs = Array.from({ length: 8 }, (_, i) => join(task, 'logs', String(i)));
  await Promise.all(logs.map(directory => mkdir(directory, { recursive: true })));
  const paths = await Promise.all(logs.map(log => resolveCatalog(executable, options, options.env, task, log)));
  assert.ok(paths.every(path => path === shared.path));
  const module = pathToFileURL(join(process.cwd(), 'shared/codex/catalog.ts')).href;
  const childCode = `import {resolveCatalog} from ${JSON.stringify(module)};const [command,script,task,log,home] = process.argv.slice(1);const opts={env:{...process.env,CODEX_HOME:home},config:{}};console.log(await resolveCatalog({command,args:[script,'app-server']},opts,opts.env,task,log));`;
  const children = await Promise.all(logs.slice(0, 4).map(log => promisify(execFile)(process.execPath, ['--input-type=module', '-e', childCode, process.execPath, executableFile, task, log, home], { env: process.env })));
  assert.ok(children.every(child => child.stdout.trim() === shared.path));
  assert.equal((await readFile(count, 'utf8')).trim().split('\n').length, 1);
  assert.equal(JSON.parse(await readFile(shared.path, 'utf8')).models[0].tool_mode, null);
  const changed = { ...options, config: { model_provider: 'another' } };
  const changedPaths = await Promise.all(logs.map(log => resolveCatalog(executable, changed, options.env, task, log)));
  assert.equal(new Set(changedPaths).size, 1); assert.notEqual(changedPaths[0], shared.path);
  assert.equal((await readFile(count, 'utf8')).trim().split('\n').length, 2);
  await writeFile(join(home, 'auth.json'), '{"tokens":{"access_token":"changed"}}');
  const refreshedLogs = join(task, 'refreshed'); await mkdir(refreshedLogs);
  const refreshed = await resolveCatalog(executable, options, options.env, task, refreshedLogs);
  assert.notEqual(refreshed, shared.path);
  assert.equal((await readFile(count, 'utf8')).trim().split('\n').length, 3);
  // A standalone section has no supervisor descriptor; concurrent sessions share one worker-local file.
  delete process.env[sharedCatalogVariable];
  const standalone = join(root, 'standalone'); await mkdir(standalone);
  const localLogs = Array.from({ length: 4 }, (_, i) => join(standalone, String(i)));
  await Promise.all(localLogs.map(log => mkdir(log)));
  const localPaths = await Promise.all(localLogs.map(log => resolveCatalog(executable, options, options.env, standalone, log)));
  assert.equal(new Set(localPaths).size, 1);
  assert.equal((await readFile(count, 'utf8')).trim().split('\n').length, 4);


});


test('dynamic provider authentication does not reuse a potentially stale catalog', async t => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-dynamic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, 'home'), task = join(root, 'task'); await mkdir(home); await mkdir(task);
  await writeFile(join(home, 'config.toml'), 'model_provider = "dynamic"\n[model_providers.dynamic]\nname = "Dynamic"\n[model_providers.dynamic.auth]\ncommand = "auth-helper"\n');
  const script = join(root, 'mock.mjs'); await writeFile(script, "console.log(JSON.stringify({models:[{tool_mode:'code_mode'}]}));");
  const executable = { command: process.execPath, args: [script, 'app-server'] }, options = { env: { ...process.env, CODEX_HOME: home }, config: {} };
  assert.equal(await prepareRunCatalog(executable, options, task), undefined);
  const logs = [join(task, 'a'), join(task, 'b')]; await Promise.all(logs.map(log => mkdir(log)));
  const paths = await Promise.all(logs.map(log => resolveCatalog(executable, options, options.env, task, log)));
  assert.notEqual(paths[0], paths[1]);
});
