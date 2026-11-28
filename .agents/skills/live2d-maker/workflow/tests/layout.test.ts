import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { LayoutError } from '../layout.ts';
import { readRun } from '../state.ts';

test('old layouts are detected without editing the task', async t => {
  const root = await mkdtemp(join(tmpdir(), 'old-layout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const run = join(root, 'run.json'), content = '{"version":1,"pipelines":{}}';
  await writeFile(run, content);
  await assert.rejects(readRun(root), LayoutError);
  assert.equal(await readFile(run, 'utf8'), content);
  assert.deepEqual(await readdir(root), ['run.json']);

  const references = join(root, 'part-layering', 'references');
  await mkdir(references, { recursive: true });
  await writeFile(join(references, 'preparation.json'), '{}');
  await assert.rejects(readRun(root), Error);
});
