import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import { dressupDecisionPath, readDressup } from '../part/dressup.ts';
import { markBaseStep } from './dressup-fixture.ts';
import { resolveShadowInput } from '../../shadow/input.ts';

async function fixture(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dressup-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, task: join(root, 'case') };
}
const png = (red: number) => sharp({ create: { width: 2, height: 2, channels: 4, background: { r: red, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();

test('换装判断在素体步骤完成后才生效，按记录读取', async t => {
  const f = await fixture(t);
  assert.equal(await readDressup(f.task), undefined);
  await markBaseStep(f.task, false);
  assert.equal(await readDressup(f.task), false);
  await markBaseStep(f.task, true);
  assert.equal(await readDressup(f.task), true);
  await writeFile(dressupDecisionPath(f.task), JSON.stringify({ version: 1, dressed: 'no' }));
  await assert.rejects(readDressup(f.task), /素体换装判断记录无效/);
});

test('旧任务没有判断记录时，按素体参考是否与简化参考像素一致推断', async t => {
  const f = await fixture(t), references = join(f.task, 'part-layering', 'references');
  await markBaseStep(f.task);
  assert.equal(await readDressup(f.task), undefined);
  await mkdir(references, { recursive: true });
  await writeFile(join(references, 'simplified-subject.png'), await png(200));
  await writeFile(join(references, 'base-subject.png'), await png(200));
  assert.equal(await readDressup(f.task), false);
  await writeFile(join(references, 'base-subject.png'), await png(10));
  assert.equal(await readDressup(f.task), true);
});

test('未换装时阴影只读取人物结构；旧任务已有衣服结构则继续沿用', async t => {
  const f = await fixture(t);
  for (const path of ['character-assembly/step01/character-assembled.kra', 'character-assembly/step01/character-assembled.png',
    'part-layering/references/simplified-subject.png', 'part-layering/groups.json', 'part-layering/occlusion.json']) {
    await mkdir(join(f.task, path, '..'), { recursive: true }); await writeFile(join(f.task, path), 'x');
  }
  await markBaseStep(f.task, false);
  const files = async () => (await resolveShadowInput('case', f.root)).structureFiles.map(path => path.slice(f.task.length + 1));
  assert.deepEqual(await files(), ['part-layering/groups.json', 'part-layering/occlusion.json']);
  for (const name of ['groups.json', 'occlusion.json']) {
    await mkdir(join(f.task, 'clothing-part-layering'), { recursive: true }); await writeFile(join(f.task, 'clothing-part-layering', name), 'x');
  }
  assert.equal((await files()).length, 4);
});
