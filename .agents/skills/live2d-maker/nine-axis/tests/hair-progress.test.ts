import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHairProgress, completeHairRound } from '../hair-progress.ts';

test('unsupported hair progress is rejected without rewriting existing files', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'hair-progress-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const progress = JSON.stringify({ version: 1, completed: ['front', 'side', 'back'], next: 'done' });
  const files = { 'hair-progress.json': progress, '.completed': '', 'artwork.kra': 'saved artwork', 'session.json': 'saved session' };
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
  await assert.rejects(readHairProgress(dir), Error);
  await assert.rejects(completeHairRound(dir, 'remaining'), Error);
  for (const [name, content] of Object.entries(files)) assert.equal(await readFile(join(dir, name), 'utf8'), content);
});
