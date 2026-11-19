import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { artifactPath } from '../part/artifact-facts.ts';
import { writeAtomic } from '../part/groups.ts';
import { createPartReferenceTool } from '../tools/prepare_part_reference/index.ts';

const signal = new AbortController().signal;
const svg = (rectWidth: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100" viewBox="0 0 120 100">
<rect x="0" y="12" width="${rectWidth}" height="60" fill="#fff"/></svg>`;

test('prepares an aligned pair from the reduced visible SVG and the completed SVG', async t => {
  const root = await mkdtemp(join(tmpdir(), 'part-reference-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'part-layering'), parts = join(directory, 'parts');
  const source = join(root, 'source.png'), id = 'hair/back';
  await Promise.all([
    writeAtomic(join(directory, 'groups.json'), JSON.stringify({ groups: [{
      id: 'hair', groups: [{ id }, { id: 'hair/hidden', hiddenInReference: true }],
    }] })),
    writeAtomic(artifactPath(directory, id, 'outline'), svg(35)),
    writeAtomic(artifactPath(directory, id, 'reduction'), svg(20)),
    writeAtomic(artifactPath(directory, id, 'completion'), svg(80)),
    writeAtomic(artifactPath(directory, 'hair/hidden', 'completion'), svg(80)),
    sharp({ create: { width: 120, height: 100, channels: 3, background: '#3c5ab4' } }).png().toFile(source),
  ]);
  const tool = createPartReferenceTool({ directory, parts }, source);
  const prepare = async (part_id: string, output_dir: string) => {
    const result = await tool.execute({ part_id, output_dir }, signal);
    const item = result.contentItems[0];
    assert.equal(item.type, 'inputText');
    return JSON.parse(item.text) as { referencePath: string; controlPath: string; crop: number[] };
  };
  async function sample(path: string, points: [number, number][]) {
    const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [94, 70]);
    return points.map(([x, y]) => {
      const i = (y * info.width + x) * info.channels;
      return [...data.subarray(i, i + 3)];
    });
  }
  const points: [number, number][] = [[3, 6], [12, 6], [31, 6]];
  const visibleDirectory = join(root, 'workspace', 'back');
  const result = await prepare(id, visibleDirectory);
  assert.equal(result.referencePath, join(visibleDirectory, 'reference.png'));
  assert.equal(result.controlPath, join(visibleDirectory, 'control.png'));
  assert.deepEqual(result.crop, [-7, 7, 94, 70]);
  assert.deepEqual(await sample(result.controlPath, points), [[0, 255, 0], [255, 0, 0], [255, 255, 0]]);
  assert.deepEqual(await sample(result.referencePath, points), [[128, 128, 128], [60, 90, 180], [128, 128, 128]]);

  const custom = join(root, 'workspace', 'hidden');
  const hidden = await prepare('hair/hidden', custom);
  assert.equal(hidden.referencePath, join(custom, 'reference.png'));
  assert.equal(hidden.controlPath, join(custom, 'control.png'));
  assert.deepEqual(await sample(hidden.controlPath, points), [[0, 255, 0], [255, 255, 0], [255, 255, 0]]);
  assert.deepEqual(await sample(hidden.referencePath, points), Array.from({ length: 3 }, () => [128, 128, 128]));
  await assert.rejects(tool.execute({ part_id: 'hair', output_dir: custom }, signal), /终止部件/);
  await assert.rejects(tool.execute({ part_id: id }, signal), /output_dir/);
  await assert.rejects(tool.execute({ part_id: id, output_dir: 'refs/back' }, signal), /绝对路径/);
});
