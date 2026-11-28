import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { ensureUpscayl } from '../upscayl.ts';
import type { PreparationProgress } from '../preparation-progress.ts';

test('Upscayl 校验后只缓存需要的成品，并发和续跑复用缓存', async t => {
  const root = await mkdtemp(join(tmpdir(), 'upscayl-cache-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = zipSync({ 'upscayl-bin-20251207-174704-macos': {
    'upscayl-bin': strToU8('executable'), LICENSE: strToU8('license'), 'README.md': strToU8('readme'),
    'unused.txt': strToU8('extra'),
  } });
  const asset = { platform: 'macos', binary: 'upscayl-bin', bytes: archive.length,
    digest: createHash('sha256').update(archive).digest('hex') };
  let attempts = 0, corrupted = true;
  const events: PreparationProgress[] = [];
  const options = { report: (event: PreparationProgress) => events.push(event) };
  const services = { root, platform: 'darwin-arm64', asset,
    download: async () => { attempts++; return Buffer.from(corrupted ? archive.subarray(1) : archive); } };
  await assert.rejects(ensureUpscayl({ installedOnly: true }, services), Error);
  assert.equal(attempts, 0);
  assert.deepEqual(await readdir(root), []);
  await assert.rejects(ensureUpscayl(options, services), Error);
  assert.equal(events.at(-1)?.state, 'failed');
  assert.deepEqual(await readdir(root), []);

  corrupted = false;
  const [first, second] = await Promise.all([ensureUpscayl(options, services), ensureUpscayl(options, services)]);
  assert.equal(first, second);
  assert.equal(await readFile(first, 'utf8'), 'executable');
  assert.deepEqual((await readdir(dirname(first))).sort(), ['LICENSE', 'README.md', 'ready.json', 'upscayl-bin']);
  assert.deepEqual(await readdir(root), ['darwin-arm64']);
  assert.equal(await ensureUpscayl(options, services), first);
  assert.equal(await ensureUpscayl({ installedOnly: true }, services), first);
  await writeFile(first, 'corrupted');
  await assert.rejects(ensureUpscayl({ installedOnly: true }, services), Error);
  assert.equal(attempts, 2);
});
