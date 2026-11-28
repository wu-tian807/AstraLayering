import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enableKritaPlugin, ensureWindowsKritaPlugin, prepareWindowsKritaApplication, windowsKritaConfigDirectory } from '../krita/windows-launch.ts';

test('Windows bridge enablement preserves shared preferences, comments and CRLF, and never changes ResourceDirectory', async t => {
  const root = await mkdtemp(join(tmpdir(), 'windows-krita-settings-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = '# user preferences\r\nResourceDirectory=D:/my-assets\r\n[python]\r\nenable_other=true\r\nenable_astra_bridge=false\r\n[RecentFiles]\r\nFile1=D:/my.kra\r\n';
  await writeFile(join(root, 'kritarc'), original);
  await Promise.all([ensureWindowsKritaPlugin(root, 'astra_bridge'), ensureWindowsKritaPlugin(root, 'astra_bridge')]);
  const actual = await readFile(join(root, 'kritarc'), 'utf8');
  assert.equal(actual, original.replace('enable_astra_bridge=false', 'enable_astra_bridge=true'));
  assert.equal(enableKritaPlugin(actual, 'astra_bridge'), actual);
  assert.deepEqual(await readdir(root), ['kritarc']);
});

test('enabling a missing bridge key leaves other groups and enabled plugins intact', () => {
  const original = '[General]\nName=保留\n[python]\nenable_other=true\n[RecentFiles]\nFile1=one.kra\n';
  const next = enableKritaPlugin(original, 'astra_bridge');
  assert.equal(next, original.replace('[python]\n', '[python]\nenable_astra_bridge=true\n'));
  assert.equal(enableKritaPlugin('ResourceDirectory=D:/mine\n', 'astra_bridge'), 'ResourceDirectory=D:/mine\n[python]\nenable_astra_bridge=true\n');
  assert.throws(() => enableKritaPlugin(original, '../escape'), Error);
});

test('Windows launch view exposes only the private Python bridge and cleanup does not follow installation junctions', async t => {
  const root = await mkdtemp(join(tmpdir(), 'windows-krita-view-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installed = join(root, 'installed'), profile = join(root, 'profile'), resource = join(profile, 'share/krita');
  for (const path of ['bin', 'lib', 'python', 'share/icons', 'share/krita/brushes', 'share/krita/pykrita/user_plugin']) await mkdir(join(installed, path), { recursive: true });
  await writeFile(join(installed, 'bin/krita.exe'), 'binary');
  await writeFile(join(installed, 'share/krita/brushes/preset'), 'original');
  await mkdir(join(resource, 'pykrita/astra_bridge'), { recursive: true });
  await writeFile(join(resource, 'pykrita/astra_bridge/__init__.py'), '# private');
  await writeFile(join(resource, 'pykrita/astra_bridge.desktop'), 'descriptor');
  const executable = await prepareWindowsKritaApplication(profile, join(installed, 'bin/krita.exe'), resource);
  assert.equal(await readFile(executable, 'utf8'), 'binary');
  const scripts = join(profile, 'application/share/krita/pykrita');
  assert.deepEqual((await readdir(scripts)).sort(), ['astra_bridge', 'astra_bridge.desktop']);
  assert.equal(await readFile(join(scripts, 'astra_bridge/__init__.py'), 'utf8'), '# private');
  assert.equal(await readFile(join(profile, 'application/share/krita/brushes/preset'), 'utf8'), 'original');
  await rm(profile, { recursive: true, force: true });
  assert.equal(await readFile(join(installed, 'bin/krita.exe'), 'utf8'), 'binary');
  assert.equal(await readFile(join(installed, 'share/krita/brushes/preset'), 'utf8'), 'original');
});

test('enabling the bridge edits only the real [python] group, not nested groups, and drops modified duplicates', () => {
  const nested = '[python]\nenable_other=true\n[python][sub]\nenable_astra_bridge=false\n';
  assert.equal(enableKritaPlugin(nested, 'astra_bridge'), '[python]\nenable_astra_bridge=true\nenable_other=true\n[python][sub]\nenable_astra_bridge=false\n');
  const modified = '[python]\nenable_astra_bridge[$i]=false\nenable_other=true\nenable_astra_bridge = false\n';
  assert.equal(enableKritaPlugin(modified, 'astra_bridge'), '[python]\nenable_astra_bridge=true\nenable_other=true\n');
  assert.equal(enableKritaPlugin('[python]\nenable_astra_bridge_extra=false\n', 'astra_bridge'), '[python]\nenable_astra_bridge=true\nenable_astra_bridge_extra=false\n');
});

test('Windows config lookup runs PowerShell once, falls back to LOCALAPPDATA and reports the failure otherwise', async () => {
  let calls = 0;
  const failing = async () => { calls++; throw Object.assign(new Error('spawn failed'), { stderr: 'blocked by policy' }); };
  await assert.rejects(windowsKritaConfigDirectory(failing, {}), Error);
  // A failed lookup is not cached; the next one succeeds and is reused.
  const local = join(tmpdir(), 'local-app-data');
  assert.equal(await windowsKritaConfigDirectory(failing, { LOCALAPPDATA: local }), local);
  assert.equal(await windowsKritaConfigDirectory(async () => { calls++; return { stdout: 'other' }; }, {}), local);
  assert.equal(calls, 2);
});

test('Windows launch view names a missing installation part and relinks entries that are junctions', async t => {
  const root = await mkdtemp(join(tmpdir(), 'windows-krita-layout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installed = join(root, 'installed'), resource = join(root, 'resource');
  await mkdir(join(installed, 'bin'), { recursive: true });
  await writeFile(join(installed, 'bin/krita.exe'), 'binary');
  await mkdir(join(resource, 'pykrita'), { recursive: true });
  await assert.rejects(prepareWindowsKritaApplication(join(root, 'a'), join(installed, 'krita.exe'), resource), Error);
  await assert.rejects(prepareWindowsKritaApplication(join(root, 'b'), join(installed, 'bin/krita.exe'), resource), Error);
  await mkdir(join(installed, 'lib'));
  await assert.rejects(prepareWindowsKritaApplication(join(root, 'c'), join(installed, 'bin/krita.exe'), resource), Error);
  await writeFile(join(installed, 'krita.exe'), 'binary');
  await assert.rejects(prepareWindowsKritaApplication(join(root, 'd'), join(installed, 'krita.exe'), resource), Error);
  // A share entry that is itself a link to a directory is linked, not copied as a file.
  await mkdir(join(installed, 'share/krita'), { recursive: true });
  await mkdir(join(root, 'elsewhere/icons'), { recursive: true });
  await writeFile(join(root, 'elsewhere/icons/icon'), 'icon');
  await symlink(join(root, 'elsewhere/icons'), join(installed, 'share/icons'), 'junction');
  await prepareWindowsKritaApplication(join(root, 'e'), join(installed, 'bin/krita.exe'), resource);
  assert.equal(await readFile(join(root, 'e/application/share/icons/icon'), 'utf8'), 'icon');
  await rm(join(root, 'e'), { recursive: true, force: true });
  assert.equal(await readFile(join(root, 'elsewhere/icons/icon'), 'utf8'), 'icon');
});
