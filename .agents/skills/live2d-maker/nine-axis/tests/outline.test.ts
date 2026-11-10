import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outlineFiles, runOutline } from '../outline.ts';

async function scratch(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'outline-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('描边只画一次，已交付时续跑不重画', async t => {
  const directory = await scratch(t);
  let calls = 0;
  const draw = async () => { calls++; for (const file of outlineFiles) await writeFile(join(directory, file), 'x'); };
  await runOutline(directory, draw);
  await runOutline(directory, draw);
  assert.equal(calls, 1);
});

test('描边缺少交付时报错', async t => {
  const directory = await scratch(t);
  await assert.rejects(runOutline(directory, async () => { await writeFile(join(directory, 'source-face.svg'), 'x'); }), /描边缺少交付/);
});
