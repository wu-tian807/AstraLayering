import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { createSoftwareScan, defaultPlan, scan, softwareName, type ScanPlan, type Software } from '../software-scan.ts';

async function waitFor(check: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < deadline, 'scan did not finish within five seconds'); await delay(20); }
}
const filename = (software: Software) => software + (process.platform === 'win32' ? '.exe' : '');
async function binary(directory: string, name: string) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, name); await writeFile(path, ''); await chmod(path, 0o755); return path;
}

test('software names and default locations cover Windows, macOS and Linux without mixing tools', () => {
  for (const software of ['krita', 'ffmpeg'] as const) {
    assert.equal(softwareName(software, software.toUpperCase() + '.EXE', 'win32'), true);
    assert.equal(softwareName(software, software, 'win32'), false);
    assert.equal(softwareName(software, software, 'linux'), true);
    assert.equal(softwareName(software, software + '.exe', 'darwin'), false);
    assert.equal(softwareName(software, filename(software === 'krita' ? 'ffmpeg' : 'krita')), false);
    assert.equal(softwareName(software, software + '-helper'), false);
  }
  assert.equal(softwareName('krita', 'krita-5.2.AppImage', 'linux'), true);
  const windows = defaultPlan('ffmpeg', { platform: 'win32', home: 'C:\\Users\\Artist', env: { Path: 'D:\\Tools;C:\\bin', SystemDrive: 'C:' } });
  assert.deepEqual(windows.known.slice(0, 2), ['D:\\Tools', 'C:\\bin']);
  for (const directory of ['C:\\ffmpeg\\bin', 'C:\\Users\\Artist\\scoop\\shims', 'C:\\Users\\Artist\\AppData\\Local\\Microsoft\\WinGet\\Links', 'C:\\ProgramData\\chocolatey\\bin']) assert.ok(windows.known.includes(directory));
  assert.ok(windows.roots.includes('D:\\')); assert.ok(!windows.known.some(path => path.includes('Krita')));
  const krita = defaultPlan('krita', { platform: 'win32', home: 'C:\\Users\\Artist', env: {} });
  assert.ok(krita.known.includes('C:\\Program Files\\Krita (x64)\\bin'));
  const mac = defaultPlan('ffmpeg', { platform: 'darwin', home: '/Users/artist', env: {} });
  assert.ok(mac.known.includes('/opt/homebrew/bin')); assert.ok(mac.known.includes('/usr/local/bin'));
  assert.ok(defaultPlan('krita', { platform: 'darwin', home: '/Users/artist', env: {} }).known.includes('/Applications/krita.app/Contents/MacOS'));
  const linux = defaultPlan('ffmpeg', { platform: 'linux', home: '/home/artist', env: { PATH: '/custom/bin:/usr/bin' } });
  assert.equal(linux.known[0], '/custom/bin'); assert.equal(linux.known.filter(path => path === '/usr/bin').length, 1);
  assert.ok(linux.known.includes('/home/artist/.local/bin')); assert.deepEqual(linux.roots, ['/']);
});

test('the shared walker keeps known-first results, software isolation, permissions and Krita AppImages', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'software-scan-')));
  const outside = await mkdtemp(join(tmpdir(), 'software-scan-outside-'));
  try {
    const known = join(base, 'bin'), deep = join(base, 'a', 'b'), hidden = join(base, '.cache'), excluded = join(base, 'node_modules');
    const expected = new Map<Software, string[]>();
    for (const software of ['krita', 'ffmpeg'] as const) {
      expected.set(software, [await binary(known, filename(software)), await binary(deep, filename(software))]);
      await binary(hidden, filename(software)); await binary(excluded, filename(software));
      if (process.platform !== 'win32') { const blocked = await binary(join(base, 'a'), filename(software)); await chmod(blocked, 0o644); }
    }
    if (process.platform !== 'win32') {
      expected.get('krita')!.push(await binary(deep, 'krita-5.2.appimage'));
      await mkdir(join(base, 'alias')); await symlink(expected.get('ffmpeg')![0]!, join(base, 'alias', 'ffmpeg'));
      await symlink(base, join(deep, 'loop'), 'dir');
      await binary(outside, 'ffmpeg'); await symlink(outside, join(base, 'external'), 'dir');
    }
    for (const software of ['krita', 'ffmpeg'] as const) {
      const found: string[] = [];
      const final = await scan(software, { known: [known, known], roots: [base], depth: 5 }, message => { if ('found' in message) found.push(message.found); });
      assert.equal(found[0], expected.get(software)![0]); assert.deepEqual(new Set(found), new Set(expected.get(software))); assert.equal(found.length, expected.get(software)!.length);
      assert.ok('scanned' in final && final.scanned > 0 && final.current === '');
    }
  } finally { await rm(base, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test('real scan children support repeated start, stop and restart with independent final states', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'software-scan-child-')));
  const plan: ScanPlan = { known: [base], roots: [base], depth: 3 };
  const krita = createSoftwareScan('krita', () => plan), ffmpeg = createSoftwareScan('ffmpeg', () => plan);
  try {
    const kritaPath = await binary(base, filename('krita')), ffmpegPath = await binary(base, filename('ffmpeg'));
    const first = krita.start(); assert.equal(krita.start(), first);
    ffmpeg.start(); krita.stop(); await waitFor(() => !krita.state().running);
    assert.equal(krita.state().error, undefined); assert.ok(krita.state().finishedAt);
    krita.start(); await waitFor(() => !krita.state().running && !ffmpeg.state().running);
    assert.deepEqual(krita.state().found, [kritaPath]); assert.deepEqual(ffmpeg.state().found, [ffmpegPath]);
    assert.ok(krita.state().scanned > 0); assert.equal(krita.state().current, '');
    await rm(ffmpegPath); ffmpeg.start(); await waitFor(() => !ffmpeg.state().running);
    assert.deepEqual(ffmpeg.state().found, []); assert.deepEqual(krita.state().found, [kritaPath]);
    assert.equal(ffmpeg.state().error, undefined);
  } finally {
    krita.stop(); ffmpeg.stop(); await waitFor(() => !krita.state().running && !ffmpeg.state().running);
    await rm(base, { recursive: true, force: true });
  }
});
