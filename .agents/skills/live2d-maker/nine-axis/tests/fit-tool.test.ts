import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { fitWarpToTraces } from '../../shared/nine-axis-fit.js';
import { lattice, keyformAt, warpPoint, parentPoint, type HeadNineAxis } from '../../shared/nine-axis-model.js';
import { createNineAxisFitTool } from '../fit-tool.ts';
import { createHeadEditTool } from '../edit-tool.ts';
import { finishHead } from '../head.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { finishAngleY } from '../angle-y.ts';

const node = (id: string, bbox: number[], cols = 3, rows = 3): any => {
  const p: any = { id, level: 'face', bbox, cols, rows, interpolation: 'smooth' }, rest = [...lattice(p)];
  p.keyforms = { '0': Array.from({ length: rest.length / 2 }, (_, i) => rest.slice(i * 2, i * 2 + 2)), '-30': Array.from({ length: rest.length / 2 }, (_, i) => rest.slice(i * 2, i * 2 + 2)) }; return p;
};
const position = (doc: HeadNineAxis, id: string, p: [number, number]) => {
  const n = [...doc.deformers, ...doc.parts].find(n => n.id === id)!;
  return parentPoint(doc, n, -30, 0, ...warpPoint(n, keyformAt(n, -30), ...p));
};

test('trace fitting respects composed ancestors and descendants and preserves unrelated authoring', () => {
  const parent = node('parent', [0, 0, 200, 200]), fitted = { ...node('chosen', [10, 10, 110, 110]), parent: 'parent' };
  parent.keyforms['-30'] = parent.keyforms['-30'].map(([x, y]: number[]) => [x * 1.1 + 20, y * 0.9 + 5]);
  const part = { ...node('art', [20, 20, 100, 100]), parent: 'chosen', texture: 'layers/a.png', textureBounds: [20, 20, 80, 80] };
  part.keyforms['-30'] = part.keyforms['-30'].map(([x, y]: number[]) => [x + 2, y + 3]);
  const unrelated = { ...node('other', [120, 20, 180, 80]), texture: 'layers/b.png', textureBounds: [120, 20, 60, 60] };
  const doc: HeadNineAxis = { version: 2, kind: 'head-nine-axis', levels: [{ id: 'face', includes: ['face'] }], deformers: [parent, fitted], parts: [part, unrelated] };
  const before = structuredClone(doc), samples: {from: [number, number]; to: [number, number]}[] = [];
  for (let y = 20; y <= 100; y += 20) for (let x = 20; x <= 100; x += 20) {
    const p: [number, number] = [x, y], [px, py] = position(doc, 'art', p); samples.push({ from: p, to: [px - 8, py + 4] });
  }
  const result = fitWarpToTraces(doc, { id: 'chosen', features: [{ id: 'outline', part: 'art', samples }] });
  assert.ok(result.report.after[0].maxPixels < 0.01, JSON.stringify(result.report));
  const withCompletion = fitWarpToTraces(doc, { id: 'chosen', features: [{ id: 'outline', part: 'art', samples }, { id: 'conflicting-completion', part: 'art', visibility: 'occluded', weight: 100, samples: [{ from: [60, 60], to: [180, 180] }] }] });
  assert.ok(withCompletion.report.after[0].maxPixels < 0.11, 'hidden completion cannot pull visible points away');
  assert.ok(withCompletion.report.occludedWeightScale < 1);
  assert.deepEqual(doc, before, 'input document never mutates');
  assert.deepEqual(result.doc.deformers[0], before.deformers[0]);
  assert.deepEqual(result.doc.parts, before.parts);
  assert.deepEqual(result.doc.deformers[1].keyforms['0'], before.deformers[1].keyforms['0']);
  assert.throws(() => fitWarpToTraces(doc, { id: 'chosen', features: [{ id: 'wrong', part: 'other', samples }] }), /不属于/);
  const crossed = samples.map(s => ({ from: s.from, to: [200 - s.from[0], s.from[1]] as [number, number] }));
  assert.throws(() => fitWarpToTraces(doc, { id: 'chosen', features: [{ id: 'crossed', part: 'art', samples: crossed }] }), /拟合未保存/);
});

test('trace inspection is read-only; SVG fitting persists real left geometry and reports curve residuals', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-fit-')); t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'nine-axis/step02_angle-x'); await mkdir(join(directory, 'layers'), { recursive: true }); await mkdir(join(root, 'nine-axis/step01_video'), { recursive: true });
  const color = join(root, 'source.png'), document = join(root, 'source.kra'), reference = join(root, 'nine-axis/step01_video/left.png');
  await writeFile(document, 'source'); await sharp({ create: { width: 200, height: 200, channels: 4, background: '#fff' } }).png().toFile(color);
  await sharp({ create: { width: 100, height: 100, channels: 4, background: '#888' } }).png().toFile(reference);
  await sharp({ create: { width: 80, height: 80, channels: 4, background: '#ffe4d2' } }).png().toFile(join(directory, 'layers/base.png'));
  const input: any = { color, document }, box = { x: 50, y: 40, size: 100 }, signal = new AbortController().signal;
  await createHeadEditTool(directory, input, box).execute({ importParts: [{ id: 'face/face_base', group: 'face', texture: 'layers/base.png', textureBounds: [60, 50, 80, 80], bbox: [60, 50, 140, 130], cols: 3, rows: 3 }] }, signal);
  const trace = join(directory, 'face-trace.json');
  const complete = { part: 'face/face_base', source: 'M10 10L90 10L90 90L10 90Z', target: 'M5 10L85 10L85 90L5 90Z' };
  await writeFile(trace, JSON.stringify({ version: 1, space: 'view', completion: complete, curves: [{ id: 'visible-face', ...complete, visibility: 'visible' }] }));
  const tool = createNineAxisFitTool(directory, input, box), author = join(directory, 'face-left.json'), original = await readFile(author, 'utf8');
  const inspected: any = await tool.execute({ action: 'inspect', trace }, signal);
  assert.equal(await readFile(author, 'utf8'), original);
  const inspectInfo = JSON.parse(inspected.contentItems[0].text), imageInfo = await sharp(inspectInfo.traceCheck).metadata(); assert.equal(imageInfo.width, 600);
  const { data, info: completedInfo } = await sharp(inspectInfo.completionCheck).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(completedInfo.width, 400);
  assert.deepEqual([...data.subarray((100 * 400 + 100) * 3, (100 * 400 + 100) * 3 + 3)], [255, 230, 215], 'complete source face occupies the first panel without centering over the target');
  assert.deepEqual([...data.subarray((100 * 400 + 300) * 3, (100 * 400 + 300) * 3 + 3)], [255, 230, 215], 'complete target face remains visible without reference hair');
  const validTrace = await readFile(trace, 'utf8');
  await writeFile(trace, JSON.stringify({ ...JSON.parse(validTrace), curves: [{ id: 'hair-seam', part: complete.part, source: 'M10 10L10 90', target: 'M45 30L45 70', visibility: 'visible' }] }));
  const mismatch: any = await tool.execute({ action: 'inspect', trace }, signal);
  assert.equal(JSON.parse(mismatch.contentItems[0].text).completionMismatch[0].id, 'hair-seam');
  await assert.rejects(tool.execute({ action: 'fit', trace, id: complete.part }, signal), /描线与完整脸型不一致/);
  assert.equal(await readFile(author, 'utf8'), original, 'interior hair/skin seam cannot deform the outer face');
  await writeFile(trace, validTrace);
  const fitted: any = await tool.execute({ action: 'fit', trace, id: 'face/face_base', revision: inspectInfo.revision }, signal), info = JSON.parse(fitted.contentItems[0].text);
  assert.ok(info.report.after[0].maxPixels < 0.01);
  const raw = JSON.parse(await readFile(author, 'utf8'));
  assert.equal(raw.deformers.length, 0); assert.deepEqual(raw.parts[0].keyforms['0'], JSON.parse(original).parts[0].keyforms['0']);
  assert.ok(Math.abs(raw.parts[0].keyforms['-30'][0][0] - 55) < 0.01, 'view coordinates add crop origin exactly once');
  await assert.rejects(tool.execute({ action: 'fit', trace, id: 'face/face_base', revision: inspectInfo.revision }, signal), /revision/);
});

test('up and down trace fitting saves independent Y endpoints and preserves completed up and X', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-pitch-fit-')); t.after(() => rm(root, { recursive: true, force: true }));
  const xdir = join(root, 'nine-axis/step02_angle-x'); await mkdir(join(xdir, 'layers'), { recursive: true });
  await mkdir(join(root, 'nine-axis/step03_video-y'), { recursive: true });
  const color = join(root, 'source.png'), document = join(root, 'source.kra'); await writeFile(document, 'source');
  await sharp({ create: { width: 200, height: 200, channels: 4, background: '#fff' } }).png().toFile(color);
  for (const direction of ['up', 'down']) await sharp({ create: { width: 100, height: 100, channels: 4, background: '#888' } }).png().toFile(join(root, `nine-axis/step03_video-y/${direction}.png`));
  await sharp({ create: { width: 80, height: 80, channels: 4, background: '#ffe4d2' } }).png().toFile(join(xdir, 'layers/base.png'));
  const input: any = { color, document }, box = { x: 50, y: 40, size: 100 }, signal = new AbortController().signal;
  await createHeadEditTool(xdir, input, box).execute({ importParts: [{ id: 'face/face_base', group: 'face', texture: 'layers/base.png', textureBounds: [60, 50, 80, 80], bbox: [60, 50, 140, 130], cols: 3, rows: 3 }] }, signal);
  await finishHead(xdir, input, box);
  let upstreamDirectory = xdir;
  for (const [stage, offset] of [['up', -5], ['down', 8]] as const) {
    const directory = join(root, `nine-axis/${stage === 'up' ? 'step04_angle-up' : 'step05_angle-down'}`);
    const edit = createContinuationEditTool(directory, upstreamDirectory, stage); await edit.execute({}, signal);
    const author = join(directory, `face-${stage}.json`), original = JSON.parse(await readFile(author, 'utf8'));
    const trace = join(directory, 'face-trace.json'), source = 'M10 10L90 10L90 90L10 90Z', target = `M10 ${10+offset}L90 ${10+offset}L90 ${90+offset}L10 ${90+offset}Z`;
    await writeFile(trace, JSON.stringify({ version: 1, space: 'view', completion: { part: 'face/face_base', source, target }, curves: [{ id: 'face', part: 'face/face_base', source, target, visibility: 'visible' }] }));
    const tool = createNineAxisFitTool(directory, input, box, undefined, { stage, upstreamDirectory });
    const inspected: any = await tool.execute({ action: 'inspect', trace }, signal); const info = JSON.parse(inspected.contentItems[0].text);
    assert.equal(info.y, stage === 'up' ? 25 : -25); assert.equal(info.x, 0); assert.match(info.reference, new RegExp(`${stage}\\.png$`));
    const fitted: any = await tool.execute({ action: 'fit', trace, id: 'face/face_base', revision: info.revision }, signal);
    const report = JSON.parse(fitted.contentItems[0].text).report; assert.ok(report.after[0].maxPixels < .01);
    const saved = JSON.parse(await readFile(author, 'utf8'));
    assert.deepEqual(saved.parts[0].keyforms, original.parts[0].keyforms, 'X stays unchanged');
    if (stage === 'down') assert.deepEqual(saved.parts[0].keyformsY['25'], original.parts[0].keyformsY['25'], 'up stays unchanged');
    assert.ok(Math.abs(saved.parts[0].keyformsY[String(info.y)][0][1] - (50+offset)) < .01);
    await finishAngleY(directory, upstreamDirectory, stage); upstreamDirectory = directory;
  }
});
