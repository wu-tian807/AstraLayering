import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { angleScale } from '../angles.ts';
import { checkFaceCoverage } from '../face-coverage.ts';
import type { Built } from '../head.ts';

const signal = new AbortController().signal, scale = angleScale(), box = { x: 0, y: 0, size: 100 };
const grid = (dx = 0, dy = 0): [number, number][] => [[30 + dx, 30 + dy], [70 + dx, 30 + dy], [30 + dx, 70 + dy], [70 + dx, 70 + dy]];
const mask = (x: number, y: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="${x}" y="${y}" width="5" height="5" fill="white"/></svg>`;
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'nine-face-coverage-')); t.after(() => rm(root, { recursive: true, force: true }));
  const texture = join(root, 'skin.png');
  await sharp({ create: { width: 40, height: 40, channels: 4, background: '#ffd9ca' } }).png().toFile(texture);
  const doc: Built['doc'] & { axis: number } = { version: 2, kind: 'head-nine-axis', axis: 50, canvas: [100, 100],
    levels: [{ id: 'face', includes: ['face'] }], deformers: [],
    parameters: [{ id: 'ParamAngleX', min: -30, max: 30, keys: [-30, 0, 30] }, { id: 'ParamAngleY', min: -25, max: 25, keys: [-25, 0, 25] }],
    parts: [{ id: 'face/face_base', level: 'face', group: 'face', texture: 'layers/skin.png', textureBounds: [30, 30, 40, 40], bbox: [30, 30, 70, 70], cols: 1, rows: 1,
      keyforms: { '0': grid(), '-30': grid(-10), '30': grid(10) }, keyformsY: { '25': grid(0, -10), '-25': grid(0, 10) },
      keyformsXY: { '-30,25': grid(-10, -10), '-30,-25': grid(-10, 10), '30,25': grid(10, -10), '30,-25': grid(10, 10) } }] };
  const built: Built = { doc, textures: new Map([['layers/skin.png', texture]]) };
  const picture = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#000' } }).png().toBuffer();
  for (const path of ['step01_video/left.png', 'step01_video/up.png', 'step01_video/down.png', 'xy/left-up.png', 'xy/left-down.png']) {
    const target = join(root, path); await mkdir(join(target, '..'), { recursive: true }); await writeFile(target, picture);
  }
  for (const stage of ['left', 'up', 'down', 'xy']) { await mkdir(join(root, stage), { recursive: true }); await writeFile(join(root, stage, `face-${stage}.json`), JSON.stringify(doc) + '\n'); }
  return { root, built };
}

test('all five targets use their own angle and reference to check actual alpha', async t => {
  const { root, built } = await fixture(t);
  for (const [stage, prefix, x, y, angleX, angleY] of [
    ['left', '', 20, 45, -30, 0], ['up', '', 45, 20, 0, 25], ['down', '', 45, 75, 0, -25],
    ['xy', 'left-up-', 20, 20, -30, 25], ['xy', 'left-down-', 20, 75, -30, -25],
  ] as const) await writeFile(join(root, stage, `${prefix}face-coverage.svg`), mask(x, y));
  for (const stage of ['left', 'up', 'down', 'xy'] as const) await checkFaceCoverage(join(root, stage), root, stage, built, box, scale, signal);
  for (const [stage, prefix, angleX, angleY] of [['left', '', -30, 0], ['up', '', 0, 25], ['down', '', 0, -25], ['xy', 'left-up-', -30, 25], ['xy', 'left-down-', -30, -25]] as const) {
    const report = JSON.parse(await readFile(join(root, stage, `${prefix}face-coverage-report.json`), 'utf8'));
    assert.equal(report.x, angleX); assert.equal(report.y, angleY); assert.equal(report.satisfied, true);
    assert.equal(report.requiredPixels, 25); assert.equal(report.uncoveredPixels, 0);
    assert.equal(report.finalAuthorSha256, hash(await readFile(join(root, stage, `face-${stage}.json`))));
  }
});

test('up/down and the second corner reject gaps despite valid meshes and opaque references', async t => {
  const { root, built } = await fixture(t);
  for (const stage of ['up', 'down', 'xy'] as const) {
    const prefix = stage === 'xy' ? 'left-down-' : '';
    if (stage === 'xy') await writeFile(join(root, stage, 'left-up-face-coverage.svg'), mask(20, 20));
    await writeFile(join(root, stage, `${prefix}face-coverage.svg`), mask(90, 90));
    await assert.rejects(checkFaceCoverage(join(root, stage), root, stage, built, box, scale, signal), /可见皮肤覆盖不足/);
    const report = JSON.parse(await readFile(join(root, stage, `${prefix}face-coverage-report.json`), 'utf8'));
    assert.equal(report.satisfied, false); assert.equal(report.uncoveredPixels, 25);
  }
});

test('missing masks are rejected for every face stage', async t => {
  const { root, built } = await fixture(t);
  for (const stage of ['left', 'up', 'down', 'xy'] as const) await assert.rejects(checkFaceCoverage(join(root, stage), root, stage, built, box, scale, signal), /缺少 .*face-coverage.svg/);
});
