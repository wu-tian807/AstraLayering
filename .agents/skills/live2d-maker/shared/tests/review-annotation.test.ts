import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createReviewAnnotationTool } from '../raster/review-annotation.ts';
import { toTaskPaths } from '../task-paths.ts';

async function fixture(t: any) {
  const base = await mkdtemp(join(tmpdir(), 'review-annotation-')), task = join(base, 'case'), cwd = join(task, 'raster-layering');
  await mkdir(cwd, { recursive: true }); t.after(() => rm(base, { recursive: true, force: true }));
  const image = Buffer.alloc(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    image[(y * 32 + x) * 4] = x * 7; image[(y * 32 + x) * 4 + 1] = y * 7; image[(y * 32 + x) * 4 + 3] = 255;
  }
  const png = await sharp(image, { raw: { width: 32, height: 32, channels: 4 } }).png().toBuffer();
  await writeFile(join(cwd, 'current.png'), png); await writeFile(join(cwd, 'reference.png'), png);
  const output = join(cwd, 'step01/review-evidence'), tool = createReviewAnnotationTool(cwd, task, output);
  // Agents name files relative to the task root.
  const at = (args: any) => ({ ...args, ...Object.fromEntries(['image', 'reference'].filter(k => args[k]).map(k => [k, 'raster-layering/' + args[k]])) });
  const call = async (args: any) => JSON.parse(((await tool.execute(at(args), new AbortController().signal)).contentItems[0] as { text: string }).text);
  return { base, task, cwd, output, png, call, at };
}
const region = { id: 'R1', bounds: [8, 9, 5, 6], layers: ['side_hair'], description: '头发与脸部衔接不自然' };

test('框选完全保留 reviewer 的问题与坐标；同图仍可标记，局部对照保留上下文与原像素', async t => {
  const f = await fixture(t);
  const result = await f.call({ image: 'current.png', reference: 'reference.png', regions: [region], padding: 2 });
  assert.equal(result.image, join(f.cwd, 'current.png')); assert.ok(result.manifest.startsWith(join(f.output) + '/') && result.manifest.endsWith('/regions.json'));
  assert.deepEqual(result.regions[0].bounds, region.bounds);
  assert.deepEqual(result.regions[0].layers, region.layers); assert.equal(result.regions[0].description, region.description);
  assert.deepEqual(result.regions[0].crop, [6, 7, 9, 10]);
  const expected = await sharp(f.png).extract({ left: 6, top: 7, width: 9, height: 10 }).raw().toBuffer();
  assert.deepEqual(await sharp(result.regions[0].files.current).raw().toBuffer(), expected);
  assert.deepEqual(await sharp(result.regions[0].files.reference).raw().toBuffer(), expected);
  assert.equal((await sharp(result.regions[0].files.comparison).metadata()).width, 18);
  assert.deepEqual(await readFile(join(f.cwd, 'current.png')), f.png);
  assert.deepEqual(await readFile(join(f.cwd, 'reference.png')), f.png);
  assert.notDeepEqual(await readFile(result.marked), f.png);
  // The manifest keeps task-relative paths; the agent sees them absolute.
  assert.deepEqual(JSON.parse(await readFile(result.manifest, 'utf8')), toTaskPaths(f.task, result));
  const second = await f.call({ image: 'current.png', regions: [{ ...region, bounds: [0, 0, 1, 2] }], padding: 16 });
  assert.deepEqual(second.regions[0].bounds, [0, 0, 1, 2]);
  assert.deepEqual(second.regions[0].crop, [0, 0, 17, 18]);
  assert.equal(second.regions[0].files.comparison, undefined);
  assert.notEqual(second.marked, result.marked);
});

test('无效框、重复编号或缺少图层说明先报错，不发布证据；参考尺寸须匹配', async t => {
  const f = await fixture(t);
  for (const regions of [[{ ...region, bounds: [30, 0, 5, 2] }], [{ ...region, bounds: [0, 0, 0, 2] }],
    [region, region], [{ ...region, id: '../escape' }], [{ ...region, layers: [] }], [{ ...region, description: '' }]]) {
    await assert.rejects(f.call({ image: 'current.png', regions }));
  }
  await sharp({ create: { width: 4, height: 4, channels: 4, background: '#ffffff' } }).png().toFile(join(f.cwd, 'small.png'));
  await assert.rejects(f.call({ image: 'current.png', reference: 'small.png', regions: [region] }), /画布尺寸不同/);
  await assert.rejects(readdir(f.output), { code: 'ENOENT' });
});

test('框选证据支持外部输入、输出及符号链接，取消仍停止执行', async t => {
  const f = await fixture(t), outside = join(f.base, 'outside.png');
  await writeFile(outside, f.png); await symlink(outside, join(f.cwd, 'escaped.png'));
  await f.call({ image: 'escaped.png', regions: [region] });
  const tool = createReviewAnnotationTool(f.cwd, f.task, join(f.base, 'outside-output'));
  assert.equal((await tool.execute(f.at({ image: 'current.png', regions: [region] }), new AbortController().signal)).success, true);
  const controller = new AbortController(); controller.abort(new Error('cancelled'));
  await assert.rejects(tool.execute(f.at({ image: 'current.png', regions: [region] }), controller.signal), /cancelled/);
});
