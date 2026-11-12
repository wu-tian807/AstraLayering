import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { restoreBaseArchive } from '../experiments/nine-axis-hair-left/restore-base.mjs';

test('research restore retains baseline markers and formal products without replacing research results', async t => {
  const root = await mkdtemp(join(tmpdir(), 'restore-demo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'archive'), target = join(root, 'research');
  const files = { 'nine-axis/step07_jaw-line/.completed': '', 'nine-axis/step07_jaw-line/deformers.json': 'original model',
    'nine-axis/step07_jaw-line/layers/face.png': 'texture', 'nine-axis/step08_hair/.completed': '',
    'nine-axis/step08_hair/deformers.json': 'old hair' };
  for (const [path, value] of Object.entries(files)) {
    await mkdir(dirname(join(source, path)), { recursive: true }); await writeFile(join(source, path), value);
  }
  await writeFile(join(source, 'run.json'), JSON.stringify({ archive: true, sections: { 'nine-axis': { status: 'completed' } } }));
  await writeFile(join(source, 'manifest.json'), JSON.stringify({ format: 'live2d-export', files }));
  await mkdir(join(target, 'nine-axis/step08_hair'), { recursive: true });
  await writeFile(join(target, 'nine-axis/step08_hair/deformers.json'), 'research model');
  assert.equal((await restoreBaseArchive(source, target)).copied, 4);
  assert.equal(await readFile(join(target, 'nine-axis/step07_jaw-line/.completed'), 'utf8'), '');
  assert.equal(await readFile(join(target, 'nine-axis/step07_jaw-line/layers/face.png'), 'utf8'), 'texture');
  assert.equal(await readFile(join(target, 'nine-axis/step08_hair/deformers.json'), 'utf8'), 'research model');
  await assert.rejects(readFile(join(target, 'nine-axis/step08_hair/.completed')), { code: 'ENOENT' });
  assert.equal((await restoreBaseArchive(source, target)).copied, 0);
});
