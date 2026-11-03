import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUpdateCheck, newestTag, updateCheckEnabled } from '../update-check.ts';
import { compareVersions, parseDescribe, type InstalledVersion } from '../../.agents/skills/live2d-maker/shared/version.ts';

const local = (version: string, source: InstalledVersion['source'] = 'git'): InstalledVersion =>
  ({ version, label: 'v' + version, exact: true, source });

test('release tags decide the version; commits after a tag keep its number', () => {
  assert.deepEqual(parseDescribe('v0.1.0\n'), { version: '0.1.0', label: 'v0.1.0', exact: true, source: 'git' });
  assert.deepEqual(parseDescribe('v0.1.0-3-gabc1234'), { version: '0.1.0', label: 'v0.1.0+3', exact: false, source: 'git' });
  assert.equal(parseDescribe('v0.1'), undefined);
  assert.ok(compareVersions('0.10.0', '0.9.9') > 0);
  assert.equal(newestTag([{ name: 'v0.9.0' }, { name: 'v0.10.0' }, { name: 'v1.0.0-rc1' }, { name: 'latest' }]), '0.10.0');
  assert.equal(newestTag({ message: 'rate limited' }), undefined);
});

test('the newest tag is looked up at most once a day, failures stay silent, and it can be switched off', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'update-check-')), cachePath = join(dir, 'update-check.json');
  try {
    let calls = 0, now = 1_000_000, tags: unknown = [{ name: 'v0.2.0' }];
    const fetchTags = async () => { calls++; if (tags instanceof Error) throw tags; return tags; };
    const check = createUpdateCheck({ cachePath, enabled: async () => true, fetchTags, installed: async () => local('0.1.0'), clock: () => now });
    const first = await check();
    assert.equal(first.updateAvailable, true);
    assert.equal(first.releaseUrl, 'https://github.com/wu-tian807/AstraLayering/releases/tag/v0.2.0');
    await check();
    assert.equal(calls, 1);
    assert.equal(JSON.parse(await readFile(cachePath, 'utf8')).latest, '0.2.0');
    // A restarted workbench reuses the saved result within the day.
    await createUpdateCheck({ cachePath, enabled: async () => true, fetchTags, installed: async () => local('0.2.0'), clock: () => now })()
      .then(state => assert.equal(state.updateAvailable, false));
    assert.equal(calls, 1);
    now += 25 * 60 * 60 * 1000; tags = new Error('offline');
    const offline = await check();
    assert.equal(calls, 2);
    assert.equal(offline.latest, '0.2.0');
    await check();
    assert.equal(calls, 2, 'a failed lookup waits before retrying');
    const off = await createUpdateCheck({ cachePath, enabled: async () => false, fetchTags, installed: async () => local('0.1.0') })();
    assert.equal(off.check, 'off');
    assert.equal(calls, 2);
    const unknown = await createUpdateCheck({ cachePath, enabled: async () => true, fetchTags, installed: async () => local('0.0.0', 'unknown'), clock: () => now })();
    assert.equal(unknown.updateAvailable, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the switch lives in the skill .env and the shell overrides it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'update-switch-')), envFile = join(dir, '.env');
  try {
    assert.equal(await updateCheckEnabled({}, envFile), true, 'on without a .env');
    await writeFile(envFile, 'update_check=false\n');
    assert.equal(await updateCheckEnabled({}, envFile), false);
    assert.equal(await updateCheckEnabled({ update_check: 'true' }, envFile), true);
    await writeFile(envFile, 'update_check=\n');
    assert.equal(await updateCheckEnabled({}, envFile), true, 'empty keeps the default');
    assert.equal(await updateCheckEnabled({ update_check: 'off' }, envFile), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
