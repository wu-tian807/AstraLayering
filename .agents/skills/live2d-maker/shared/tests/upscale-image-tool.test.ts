import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { createUpscaleImageTool } from '../tools/upscale_image/index.ts';

test('超分工具为不同尺寸的文件和目录使用同一倍率，保留透明通道和单张错误', async t => {
  const root = await mkdtemp(join(tmpdir(), 'astra-batch-test-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  const folder = join(root, '输入 部件');
  await mkdir(folder);
  const png = await sharp({ create: { width: 33, height: 17, channels: 4, background: '#ed875e80' } }).png().toBuffer();
  await writeFile(join(folder, '发片.png'), png);
  await sharp({ create: { width: 51, height: 21, channels: 3, background: '#ed875e' } }).jpeg().toFile(join(folder, '配饰.jpg'));
  await writeFile(join(folder, '说明.txt'), 'ignored');
  await mkdir(join(folder, '子目录.png'));
  const single = join(root, '原图.png');
  await writeFile(single, png);
  const batchScales: number[] = [];
  const native = process.env.ASTRA_TEST_NATIVE_UPSCALE === '1';
  const tool = createUpscaleImageTool(native ? undefined : async (input, output, scale) => {
    batchScales.push(scale);
    const names = (await readdir(input)).sort();
    assert.deepEqual(names, ['0.png', '1.png', '2.png']);
    for (const name of names) {
      const image = sharp(join(input, name));
      const { width, height } = await image.metadata();
      await image.resize(width * scale, height * scale).png().toFile(join(output, name));
    }
  });
  const signal = AbortSignal.timeout(120_000);
  for (const scale of ['2x', '3x', '4x']) {
    const factor = Number.parseInt(scale, 10);
    const output = join(root, '输出 部件 ' + scale);
    const mappedFile = join(root, '单图输出 ' + scale + '.png');
    const response = await tool.execute({ scale, items: [
      { input_path: folder, output_path: output },
      { input_path: single, output_path: mappedFile },
      { input_path: join(root, 'missing.png'), output_path: join(output, 'missing.png') },
    ] }, signal);
    assert.equal(response.success, true);
    const content = response.contentItems[0];
    assert.equal(content.type, 'inputText');
    const { results } = JSON.parse(content.text) as { results: { status: string; width?: number; height?: number }[] };
    assert.deepEqual(results.slice(0, 3).map(({ status, width, height }) => [status, width, height]),
      [['upscaled', 33 * factor, 17 * factor], ['upscaled', 51 * factor, 21 * factor], ['upscaled', 33 * factor, 17 * factor]],
      JSON.stringify(results));
    assert.equal(results[3].status, 'failed');
    assert.deepEqual((await readdir(output)).sort(), ['发片.png', '配饰.png'].sort());
    assert.equal((await sharp(join(output, '发片.png')).metadata()).hasAlpha, true);
    assert.equal((await sharp(join(output, '配饰.png')).metadata()).hasAlpha, false);
  }
  if (!native) assert.deepEqual(batchScales, [2, 3, 4]);
  assert.deepEqual(await readFile(single), png);
  const items = [{ input_path: single, output_path: single }];
  await assert.rejects(tool.execute({ scale: '2x', items }, signal), /冲突/);
  await assert.rejects(tool.execute({ scale: '2K', items }, signal), /scale 必须/);
});
