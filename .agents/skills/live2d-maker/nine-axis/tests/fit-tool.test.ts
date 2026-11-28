import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {zipSync,strToU8} from 'fflate';
import { fitWarpToTraces } from '../../shared/nine-axis-fit.js';
import { lattice, keyformAt, warpPoint, parentPoint, evaluatePoints, nodes, kraReferences, type HeadNineAxis } from '../../shared/nine-axis-model.js';
import { createNineAxisFitTool, type HeadFitStage } from '../fit-tool.ts';
import { createHeadEditTool } from '../edit-tool.ts';
import { finishHead } from '../head.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { finishAngleY } from '../angle-y.ts';
import { buildAngleXY, finishAngleXY } from '../angle-xy.ts';
import { authorFile, startContinuation } from '../continuation.ts';
import { hairPreviewScope } from '../hair.ts';
import { accessoryPreviewScope } from '../accessories.ts';
import { headPitchScope } from '../head-pitch.ts';
import { headCornerScope } from '../head-corners.ts';
import type { MaterialLoader } from '../kra-materials.ts';
import { withDocument } from '../source.ts';
import { baseline, grid, pts } from './axis-fixtures.ts';

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const result = (value: any) => JSON.parse(value.contentItems[0].text);

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
  // Consistent occluded completion in an unconstrained region must not be
  // annealed into a folded visible-only extrapolation.
  const scaleAtY = (y: number) => y === 20 ? 0.35 : y === 40 ? 0.35 : y === 60 ? 0.5 : y === 80 ? 0.9 : 1.3;
  const tapered = (s: { from: [number, number]; to: [number, number] }) => {
    const cx = position(doc, 'art', [60, s.from[1]])[0] - 8;
    return { from: s.from, to: [cx + (s.to[0] - cx) * scaleAtY(s.from[1]), s.to[1]] as [number, number] };
  };
  const foldedLowerVisible = samples.filter(s => s.from[1] >= 60).map(tapered);
  const upperOccluded = samples.filter(s => s.from[1] <= 40).map(tapered);
  assert.throws(() => fitWarpToTraces(doc, {
    id: 'chosen',
    smoothness: 0.02,
    features: [{ id: 'lower-visible', part: 'art', visibility: 'visible', samples: foldedLowerVisible }],
  }), /拟合未保存/);
  const consistent = fitWarpToTraces(doc, {
    id: 'chosen',
    smoothness: 0.02,
    features: [
      { id: 'lower-visible', part: 'art', visibility: 'visible', samples: foldedLowerVisible },
      { id: 'upper-occluded', part: 'art', visibility: 'occluded', weight: 0.5, samples: upperOccluded },
    ],
  });
  assert.ok(consistent.report.occludedWeightScale > 0, JSON.stringify(consistent.report));
  assert.ok(consistent.report.after[0].maxPixels < 2.5, JSON.stringify(consistent.report));
  assert.ok(consistent.report.after[1].maxPixels < 4, JSON.stringify(consistent.report));
  assert.deepEqual(doc, before, 'input document never mutates');
  assert.deepEqual(result.doc.deformers[0], before.deformers[0]);
  assert.deepEqual(result.doc.parts, before.parts);
  assert.deepEqual(result.doc.deformers[1].keyforms['0'], before.deformers[1].keyforms['0']);
  assert.throws(() => fitWarpToTraces(doc, { id: 'chosen', features: [{ id: 'wrong', part: 'other', samples }] }), Error);
  const crossed = samples.map(s => ({ from: s.from, to: [200 - s.from[0], s.from[1]] as [number, number] }));
  assert.throws(() => fitWarpToTraces(doc, { id: 'chosen', features: [{ id: 'crossed', part: 'art', samples: crossed }] }), Error);
});

test('trace inspection is read-only; SVG fitting persists real left geometry and reports curve residuals', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-fit-')); t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'nine-axis/step04_angles'); await mkdir(join(directory, 'layers'), { recursive: true }); await mkdir(join(root, 'nine-axis/step03_frames'), { recursive: true });
  const color = join(root, 'source.png'), document = join(root, 'source.kra'), reference = join(root, 'nine-axis/step03_frames/left.png');
  await writeFile(document, 'source'); await sharp({ create: { width: 200, height: 200, channels: 4, background: '#fff' } }).png().toFile(color);
  await writeFile(document,zipSync({'maindoc.xml':strToU8('<DOC/>'),'mergedimage.png':await readFile(color)}));
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
  assert.equal(inspectInfo.kraRevision, sha256(await readFile(document)));
  const { data, info: completedInfo } = await sharp(inspectInfo.completionCheck).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(completedInfo.width, 400);
  assert.deepEqual([...data.subarray((100 * 400 + 100) * 3, (100 * 400 + 100) * 3 + 3)], [255, 230, 215], 'complete source face occupies the first panel without centering over the target');
  assert.deepEqual([...data.subarray((100 * 400 + 300) * 3, (100 * 400 + 300) * 3 + 3)], [255, 230, 215], 'complete target face remains visible without reference hair');
  const validTrace = await readFile(trace, 'utf8');
  const { completion: _completion, ...incomplete } = JSON.parse(validTrace);
  await writeFile(trace, JSON.stringify(incomplete));
  await assert.rejects(tool.execute({ action: 'inspect', trace }, signal), /先补全完整脸型/);
  await writeFile(trace, JSON.stringify({ ...JSON.parse(validTrace), curves: [{ id: 'hair-seam', part: complete.part, source: 'M10 10L10 90', target: 'M45 30L45 70', visibility: 'visible' }] }));
  const mismatch: any = await tool.execute({ action: 'inspect', trace }, signal);
  assert.equal(JSON.parse(mismatch.contentItems[0].text).completionMismatch[0].id, 'hair-seam');
  await assert.rejects(tool.execute({ action: 'fit', trace, id: complete.part }, signal), Error);
  assert.equal(await readFile(author, 'utf8'), original, 'interior hair/skin seam cannot deform the outer face');
  await writeFile(trace, validTrace);
  const fitted: any = await tool.execute({ action: 'fit', trace, id: 'face/face_base', revision: inspectInfo.revision }, signal), info = JSON.parse(fitted.contentItems[0].text);
  assert.ok(info.report.after[0].maxPixels < 0.01);
  const raw = JSON.parse(await readFile(author, 'utf8'));
  assert.equal(raw.deformers.length, 0); assert.deepEqual(raw.parts[0].keyforms['0'], JSON.parse(original).parts[0].keyforms['0']);
  assert.ok(Math.abs(raw.parts[0].keyforms['-30'][0][0] - 55) < 0.01, 'view coordinates add crop origin exactly once');
  await assert.rejects(tool.execute({ action: 'fit', trace, id: 'face/face_base', revision: inspectInfo.revision }, signal), Error);
});

async function hairFitFixture(t: TestContext) {
  const taskRoot = await mkdtemp(join(tmpdir(), 'nine-hair-fit-'));
  t.after(() => rm(taskRoot, { recursive: true, force: true }));
  const upstreamDirectory = join(taskRoot, 'nine-axis/step07_jaw-line');
  const directory = join(taskRoot, 'nine-axis/step08_hair'), referenceDirectory = join(taskRoot, 'nine-axis/step03_frames');
  await Promise.all([upstreamDirectory, directory, referenceDirectory].map(path => mkdir(path, { recursive: true })));
  const document = join(taskRoot, 'original.kra'), editable = join(directory, 'character-nine-axis.kra');
  const color = join(taskRoot, 'original.png'), left = join(referenceDirectory, 'left.png'), right = join(referenceDirectory, 'right.png');
  const makePng = (background: string) => sharp({ create: { width: 100, height: 100, channels: 4, background } }).png().toBuffer();
  const names = ['face/face_base', 'hair/bangs', 'hair/front_hair/wisp', 'hair/side_hair/right'];
  const uuid = (index: number) => `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`;
  const saveKra = async (path: string, shade: string) => writeFile(path, zipSync({
    'maindoc.xml': strToU8('<DOC><IMAGE><layers>' + names.map((name, i) =>
      `<layer uuid="${uuid(i)}" name="${name}" nodetype="paintlayer" visible="1"/>`).join('') + '</layers></IMAGE></DOC>'),
    'mergedimage.png': await makePng(shade),
  }));
  await saveKra(document, '#101020');
  await saveKra(editable, '#236046');
  await writeFile(color, await makePng('#101020'));
  await writeFile(left, await makePng('#bb472c'));
  const upstream = baseline() as HeadNineAxis & { axis: number };
  upstream.parts = [{ ...upstream.parts[0], uuid: uuid(0), partId: 'character:' + names[0] }];
  const scale = { x: [-28, 36] as [number, number], y: [-20, 24] as [number, number] };
  upstream.parameters = [{ id: 'ParamAngleX', keys: [scale.x[0], 0, scale.x[1]] }, { id: 'ParamAngleY', keys: [0] }];
  await writeFile(join(upstreamDirectory, 'deformers.json'), JSON.stringify(upstream));
  const doc = kraReferences(startContinuation(withDocument(upstream, taskRoot, editable) as typeof upstream, 'hair', scale));
  for (const [index, id] of names.entries()) {
    if (!index) continue;
    doc.parts.push({ ...grid(id, [12, 12, 80, 80]), level: 'hair', uuid: uuid(index), partId: 'character:' + id, textureBounds: [12, 12, 68, 68] });
  }
  const author = join(directory, 'hair.json'), trace = join(directory, 'hair-trace.json');
  await writeFile(author, JSON.stringify(doc));
  const calls: { directory: string; signal?: AbortSignal; context?: boolean | 'shadows' }[] = [];
  const materialize: MaterialLoader = async (directory, built, signal, context) => {
    calls.push({ directory, signal, context });
    const loaded = structuredClone(built.doc);
    const textures = new Map(loaded.parts.map((p, i) => [p.texture ??= `layers/${i}.png`, color]));
    return { doc: loaded, textures };
  };
  const tool = createNineAxisFitTool(directory, { document, color, parts: [] }, { x: 0, y: 0, size: 100 }, scale,
    { stage: 'hair', upstreamDirectory, ownership: hairPreviewScope('front'), materialize }, { taskRoot, referenceDirectory });
  const signal = new AbortController().signal;
  const inspect = (args: object = {}) => tool.execute({ action: 'inspect', trace, ...args }, signal);
  const fit = (id = names[1], args: object = {}) => tool.execute({ action: 'fit', trace, id, ...args }, signal);
  const contour = (part = names[1], dx = -3) => ({
    id: 'edge', part, source: 'M15 15L75 15L75 75L15 75L15 15', target: `M${15+dx} 15L${75+dx} 15L${75+dx} 75L${15+dx} 75L${15+dx} 15`,
  });
  const saveTrace = (value: object) => writeFile(trace, JSON.stringify({ version: 1, space: 'view', ...value }));
  return { names, author, trace, directory, upstreamDirectory, editable, saveKra, makePng, left, right, doc, calls, inspect, fit, contour, saveTrace, signal };
}

test('hair inspect reads the saved editable KRA and requires an explicit or bound reference', async t => {
  const f = await hairFitFixture(t), edge = f.contour(), original = await readFile(f.author, 'utf8');
  await f.saveTrace({ curves: [edge] });
  const inspect = await f.inspect(), left = result(inspect);
  assert.deepEqual([left.side, left.x, left.y, left.reference, left.referenceSource], ['left', -28, 0, f.left, 'frame']);
  assert.equal(inspect.contentItems.length, 2);
  assert.equal(left.completionCheck, undefined);
  assert.deepEqual(left.completionMismatch, []);
  const pixel = (path: string, x: number) => sharp(path).extract({ left:x, top:2, width:1, height:1 }).removeAlpha().raw().toBuffer().then(bytes=>[...bytes]);
  assert.equal((await sharp(left.traceCheck).metadata()).width, 400);
  assert.deepEqual(await pixel(left.traceCheck, 2), [0x23, 0x60, 0x46]);
  assert.deepEqual(await pixel(left.traceCheck, 202), [0xbb, 0x47, 0x2c]);

  await assert.rejects(f.inspect({ side: 'right' }), /right\.png.*请传入真实的 reference PNG 路径/);
  await f.saveKra(f.editable, '#4871ae');
  await assert.rejects(f.fit(undefined, { revision: left.revision }), /KRA 已变化.*revision/);
  const prepared = join(f.directory, 'prepared-right.png');
  await writeFile(prepared, await f.makePng('#4455cc'));
  const explicit = result(await f.inspect({ side: 'right', reference: prepared }));
  assert.deepEqual([explicit.side, explicit.x, explicit.y, explicit.reference, explicit.referenceSource], ['right', 36, 0, prepared, 'explicit']);
  assert.deepEqual(await pixel(explicit.traceCheck, 2), [0x48, 0x71, 0xae]);
  assert.deepEqual(await pixel(explicit.traceCheck, 202), [0x44, 0x55, 0xcc]);

  await writeFile(f.right, await f.makePng('#aa44ee'));
  const closed = { ...edge, source: edge.source + 'Z', target: edge.target + 'Z' };
  await f.saveTrace({ curves: [closed], completion: closed });
  const right = result(await f.inspect({ side: 'right' }));
  assert.deepEqual([right.reference, right.referenceSource], [f.right, 'frame']);
  assert.deepEqual(await pixel(right.traceCheck, 202), [0xaa, 0x44, 0xee]);
  assert.equal((await sharp(right.traceCheck).metadata()).width, 600);
  assert.ok(right.completionCheck);
  assert.equal(await readFile(f.author, 'utf8'), original);
  assert.deepEqual(f.calls, []);
});

test('hair fit seeds horizontal keys, preserves other nodes and directions, and saves separate reports', async t => {
  const f = await hairFitFixture(t), [face, bangs, wisp] = f.names;
  await f.saveTrace({ curves: [f.contour()] });
  const left = result(await f.fit());
  assert.equal(left.report.x, -28);
  assert.equal(left.report.y, 0);
  assert.ok(left.report.after[0].maxPixels < .01);
  const leftAuthor = JSON.parse(await readFile(f.author, 'utf8'));
  const leftReport = await readFile(left.reportPath, 'utf8');
  assert.deepEqual(leftAuthor.parts.find((p: any) => p.id === face), f.doc.parts[0]);
  assert.deepEqual(leftAuthor.parts.find((p: any) => p.id === bangs).keyforms['36'], f.doc.parts[1].keyforms['0']);
  assert.deepEqual(leftAuthor.parts.slice(2), f.doc.parts.slice(2));

  const landmarks = [[15, 15], [75, 15], [15, 75], [75, 75]].map(([x, y], i) => ({
    id: 'mark-' + i, part: bangs, source: [x, y], target: [x + 4, y],
  }));
  await f.saveTrace({ landmarks });
  const right = result(await f.fit(bangs, { side: 'right', revision: left.revision }));
  assert.ok(right.report.after.every((entry: { maxPixels: number }) => entry.maxPixels < .01));
  assert.deepEqual([right.report.side, right.report.x, right.report.y, right.referenceSource], ['right', 36, 0, undefined]);
  assert.notEqual(right.reportPath, left.reportPath);
  const afterRight = JSON.parse(await readFile(f.author, 'utf8'));
  assert.deepEqual(afterRight.parts[1].keyforms['-28'], leftAuthor.parts[1].keyforms['-28']);
  assert.deepEqual(afterRight.parts[1].keyforms['0'], f.doc.parts[1].keyforms['0']);

  await f.saveTrace({ curves: [f.contour(wisp)] });
  const other = result(await f.fit(wisp));
  assert.notEqual(other.reportPath, left.reportPath);
  assert.equal(await readFile(left.reportPath, 'utf8'), leftReport);
  assert.deepEqual(JSON.parse(await readFile(right.reportPath, 'utf8')), right.report);
  const saved = JSON.parse(await readFile(f.author, 'utf8'));
  assert.deepEqual(saved.parts[1], afterRight.parts[1]);
  assert.deepEqual(JSON.parse(await readFile(join(f.directory, 'deformers.json'), 'utf8')), saved);
  assert.deepEqual(f.calls.map(call => call.directory), [f.directory, f.upstreamDirectory, f.directory, f.upstreamDirectory, f.directory, f.upstreamDirectory]);
  assert.ok(f.calls.every(call => call.signal === f.signal && call.context === false));
});

test('front-round fit rejects side hair, face, and a carrier shared with side hair', async t => {
  const f = await hairFitFixture(t), [face, bangs, , side] = f.names;
  const parent = { ...grid('mixed-carrier'), level: 'hair' as const };
  f.doc.deformers.push(parent);
  for (const part of f.doc.parts.filter(p => p.id === bangs || p.id === side)) part.parent = parent.id;
  const original = JSON.stringify(f.doc);
  await writeFile(f.author, original);
  await f.saveTrace({ curves: [f.contour()] });
  for (const id of [face, side, parent.id]) await assert.rejects(f.fit(id), /不能拟合范围外/);
  assert.equal(await readFile(f.author, 'utf8'), original);
  assert.deepEqual(f.calls, []);
});

async function headFitFixture(t: TestContext, stage: HeadFitStage) {
  const taskRoot = await mkdtemp(join(tmpdir(), 'head-fit-'));
  t.after(() => rm(taskRoot, { recursive: true, force: true }));
  const upstreamDirectory = join(taskRoot, 'nine-axis/upstream'), directory = join(taskRoot, 'nine-axis/fit');
  const referenceDirectory = join(taskRoot, 'nine-axis/frames');
  await Promise.all([upstreamDirectory, directory, referenceDirectory].map(d => mkdir(d, { recursive: true })));
  const upstream = baseline() as HeadNineAxis & { axis: number };
  upstream.axis = 54;
  upstream.parts = [upstream.parts[0], upstream.parts.at(-1)!].map(p => ({ ...p, material: 'transparent' }));
  upstream.parameters = [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [-25, 0, 25] }];
  const doc = kraReferences(startContinuation(upstream, stage));
  const part = stage === 'accessories' ? 'head_accessories/clip' : doc.parts[0].id;
  if (stage === 'accessories') doc.parts.push({ ...grid(part, [10, 10, 80, 80]), level: 'accessory', partId: 'character:' + part,
    material: 'transparent', textureBounds: [10, 10, 70, 70] });
  const target = stage === 'accessories' ? part : doc.parts[0].parent!;
  const author = join(directory, authorFile(stage)), trace = join(directory, 'trace.json');
  await writeFile(join(upstreamDirectory, 'deformers.json'), JSON.stringify(kraReferences(upstream)));
  await writeFile(author, JSON.stringify(doc));
  await writeFile(trace, JSON.stringify({
    version: 1, space: 'canvas', curves: [{ id: 'line', part, source: 'M15 15L75 15L75 75L15 75L15 15',
      target: 'M17 14L77 14L77 74L17 74L17 14' }],
  }));
  const document = join(taskRoot, 'original.kra');
  const tool = createNineAxisFitTool(directory, { document, color: join(taskRoot, 'unused.png'), parts: [] }, { x: 8, y: 4, size: 84 }, undefined,
    { stage, upstreamDirectory, ownership: stage === 'accessories' ? accessoryPreviewScope : stage === 'head-xy' ? headCornerScope : headPitchScope },
    { taskRoot, referenceDirectory });
  const signal = new AbortController().signal;
  const execute = (args: object) => tool.execute({ trace, id: target, ...args }, signal);
  return { document, author, referenceDirectory, execute, part, target, doc };
}

for (const [stage, pose, expected, invalid] of [
  ['accessories', { x: 17, y: 0 }, [17, 0], { y: 5 }],
  ['head-up', { x: 0, y: 13 }, [0, 13], { y: -10 }],
  ['head-down', {}, [0, -25], { x: 8 }],
  ['head-xy', { corner: 'right-down' }, [30, -25], { x: 0, y: 25 }],
] as const) {
  test(`${stage} fits without PNGs and rejects edits outside its node and angle scope`, async t => {
    const f = await headFitFixture(t, stage);
    const original = await readFile(f.author, 'utf8');
    await assert.rejects(f.execute({ action: 'fit', ...invalid }), /只拟合|拟合要求|需要非零/);
    await assert.rejects(f.execute({ action: 'fit', ...pose, x: 80 }), /超出工程范围/);
    const blocked = stage === 'head-xy' || stage === 'accessories' ? 'face/face_base' : 'neck';
    await assert.rejects(f.execute({ action: 'fit', ...pose, id: blocked }), /范围外|斜角修正承载/);
    assert.equal(await readFile(f.author, 'utf8'), original);

    const reply = await f.execute({ action: 'fit', ...pose });
    assert.equal(reply.contentItems.length, 1, 'fit does not load a reference or emit overlays');
    const info = result(reply);
    assert.deepEqual([info.x, info.y], expected);
    assert.equal(info.reference, undefined);
    assert.ok(info.report.after[0].maxPixels < .01);
    assert.deepEqual(JSON.parse(await readFile(info.reportPath, 'utf8')), info.report);
    const saved = JSON.parse(await readFile(f.author, 'utf8')) as HeadNineAxis;
    const field = info.x && info.y ? 'keyformsXY' : info.y ? 'keyformsY' : 'keyforms';
    const key = info.x && info.y ? `${info.x},${info.y}` : String(info.y || info.x);
    assert.ok(nodes(saved).find(n => n.id === f.target)![field]?.[key]);
    assert.deepEqual(saved.parts.find(p => p.id === 'neck'), f.doc.parts.find(p => p.id === 'neck'));
  });
}

test('right-corner inspection requires its own PNG and leaves the supplied image in place', async t => {
  const f = await headFitFixture(t, 'head-xy'), path = join(f.referenceDirectory, 'left-up.png');
  const paint = (size: number, background: string) => sharp({ create: { width: size, height: size, channels: 3, background } });
  await writeFile(f.document, zipSync({ 'maindoc.xml': strToU8('<DOC/>'), 'mergedimage.png': await paint(100, '#346').png().toBuffer() }));
  await paint(84, '#000000').composite([{ input: await paint(6, '#ff0000').png().toBuffer(), left: 18, top: 0 }]).png().toFile(path);
  await assert.rejects(f.execute({ action: 'inspect', corner: 'right-up' }), /right-up\.png.*请传入真实的 reference PNG 路径/);
  const inspect = result(await f.execute({ action: 'inspect', corner: 'right-up', reference: path }));
  assert.deepEqual([inspect.reference, inspect.referenceSource, inspect.x, inspect.y], [path, 'explicit', 30, 25]);
  const top = await sharp(inspect.traceCheck).extract({ left: 168, top: 3, width: 168, height: 1 }).removeAlpha().raw().toBuffer();
  assert.deepEqual([...top.subarray(42 * 3, 42 * 3 + 3)], [255, 0, 0]);
  assert.deepEqual([...top.subarray(142 * 3, 142 * 3 + 3)], [0, 0, 0]);
  await assert.rejects(f.execute({ action: 'inspect', corner: 'left-up', reference: 'missing.png' }), /missing\.png.*请传入真实的 reference PNG 路径/);
  const fit = await f.execute({ action: 'fit', x: 12, y: 9, reference: path });
  const info = result(fit);
  assert.deepEqual([info.referenceSource, info.x, info.y], ['explicit', 12, 9]);
  assert.equal(fit.contentItems.length, 2);
  assert.ok(info.report.after[0].maxPixels < .01);
});

test('up and down trace fitting saves independent Y endpoints and preserves completed up and X', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-pitch-fit-')); t.after(() => rm(root, { recursive: true, force: true }));
  const xdir = join(root, 'nine-axis/step04_angles'); await mkdir(join(xdir, 'layers'), { recursive: true });
  await mkdir(join(root, 'nine-axis/step03_frames'), { recursive: true });
  const color = join(root, 'source.png'), document = join(root, 'source.kra'); await writeFile(document, 'source');
  await sharp({ create: { width: 200, height: 200, channels: 4, background: '#fff' } }).png().toFile(color);
  await writeFile(document,zipSync({'maindoc.xml':strToU8('<DOC/>'),'mergedimage.png':await readFile(color)}));
  for (const direction of ['up', 'down']) await sharp({ create: { width: 100, height: 100, channels: 4, background: '#888' } }).png().toFile(join(root, `nine-axis/step03_frames/${direction}.png`));
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
    assert.equal(info.kraRevision, sha256(await readFile(document)));
    const fitted: any = await tool.execute({ action: 'fit', trace, id: 'face/face_base', revision: info.revision }, signal);
    const report = JSON.parse(fitted.contentItems[0].text).report; assert.ok(report.after[0].maxPixels < .01);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'fit-report.json'), 'utf8')), report, 'single-axis report retains its filename');
    const saved = JSON.parse(await readFile(author, 'utf8'));
    assert.deepEqual(saved.parts[0].keyforms, original.parts[0].keyforms, 'X stays unchanged');
    if (stage === 'down') assert.deepEqual(saved.parts[0].keyformsY['25'], original.parts[0].keyformsY['25'], 'up stays unchanged');
    assert.ok(Math.abs(saved.parts[0].keyformsY[String(info.y)][0][1] - (50+offset)) < .01);
    await finishAngleY(directory, upstreamDirectory, stage); upstreamDirectory = directory;
  }
});

const xyFixture = async (t: TestContext) => {
  const root = await mkdtemp(join(tmpdir(), 'nine-xy-fit-')); t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'nine-axis/step06_angle-xy'), upstreamDirectory = join(root, 'nine-axis/step05_angle-down');
  await mkdir(join(upstreamDirectory, 'layers'), { recursive: true });
  const color = join(root, 'source.png'), document = join(root, 'source.kra'); await writeFile(document, 'source');
  await sharp({ create: { width: 200, height: 200, channels: 4, background: '#fff' } }).png().toFile(color);
  await writeFile(document,zipSync({'maindoc.xml':strToU8('<DOC/>'),'mergedimage.png':await readFile(color)}));
  const scale: { x: [number, number]; y: [number, number] } = { x: [-40, 40], y: [-20, 35] };
  const grid = (id: string, bbox: number[], x: [number, number] = [0, 0], up: [number, number] = [0, 0], down: [number, number] = [0, 0]) => {
    const n = node(id, bbox), rest = n.keyforms['0'];
    const translated = ([dx, dy]: [number, number]) => rest.map(([px, py]: number[]) => [px + dx, py + dy]);
    n.keyforms = { '0': rest, '-40': translated(x), '40': translated([-x[0], x[1]]) };
    n.keyformsY = { '-20': translated(down), '35': translated(up) };
    return n;
  };
  const ancestor = grid('ancestor', [40, 30, 160, 150], [-3, 2], [2, -5], [1, 8]);
  const chosen = { ...grid('chosen', [50, 40, 150, 140]), parent: 'ancestor' };
  const face = { ...grid('face/face_base', [60, 50, 140, 130], [-2, 1], [1, -1], [-1, 2]), parent: 'chosen', group: 'face', texture: 'layers/base.png', textureBounds: [60, 50, 80, 80] };
  const other = { ...grid('face/other', [80, 70, 120, 90], [1, 0], [0, -2], [0, 3]), group: 'feature', texture: 'layers/base.png', textureBounds: [60, 50, 80, 80] };
  const neck = { ...grid('neck', [80, 125, 120, 165]), group: 'neck', texture: 'layers/base.png', textureBounds: [60, 50, 80, 80] };
  const upstream: any = { version: 2, kind: 'head-nine-axis', axis: 100, canvas: [200, 200], source: { document, sha256: sha256('source') },
    parameters: [{ id: 'ParamAngleX', keys: [-40, 0, 40] }, { id: 'ParamAngleY', keys: [-20, 0, 35] }],
    levels: [{ id: 'face', includes: ['face'] }], deformers: [ancestor, chosen], parts: [neck, face, other], notes: 'retain authored hierarchy and features' };
  const upstreamText = JSON.stringify(upstream) + '\n'; await writeFile(join(upstreamDirectory, 'deformers.json'), upstreamText);
  const texture = await sharp({ create: { width: 80, height: 80, channels: 4, background: '#ffe4d2' } }).png().toBuffer();
  await writeFile(join(upstreamDirectory, 'layers/base.png'), texture);
  const input: any = { color, document }, box = { x: 50, y: 40, size: 100 }, signal = new AbortController().signal;
  await createContinuationEditTool(directory, upstreamDirectory, 'xy', scale).execute({}, signal);
  const corners = ['left-up', 'left-down'] as const;
  const references = new Map<string, Buffer>(), traces = new Map<string, string>();
  for (const corner of corners) {
    const image = await sharp({ create: { width: 100, height: 100, channels: 4, background: corner === 'left-up' ? '#888' : '#abc' } }).png().toBuffer();
    references.set(corner, image); await writeFile(join(directory, `${corner}.png`), image);
    const [dx, dy] = corner === 'left-up' ? [-7, -9] : [-5, 13];
    const source = 'M10 10L90 10L90 90L10 90Z', target = `M${10 + dx} ${10 + dy}L${90 + dx} ${10 + dy}L${90 + dx} ${90 + dy}L${10 + dx} ${90 + dy}Z`;
    const path = join(directory, `${corner}-face-trace.json`); traces.set(corner, path);
    await writeFile(path, JSON.stringify({ version: 1, space: 'view', completion: { part: face.id, source, target }, curves: [{ id: 'face', part: face.id, source, target, visibility: 'visible' }] }));
  }
  return { directory, upstreamDirectory, upstream, upstreamText, texture, scale, signal, references, traces,
    author: join(directory, 'face-xy.json'), tool: createNineAxisFitTool(directory, input, box, scale, { stage: 'xy', upstreamDirectory }) };
};

test('XY fits each selected frame into a saved corner, protects axes and the other corner, and compiles mirrored geometry with original textures', async t => {
  const f = await xyFixture(t);
  let upReport = '';
  for (const corner of ['left-up', 'left-down'] as const) {
    const trace = f.traces.get(corner)!, beforeText = await readFile(f.author, 'utf8'), before = JSON.parse(beforeText);
    const inspected = result(await f.tool.execute({ action: 'inspect', corner, trace }, f.signal));
    assert.equal(await readFile(f.author, 'utf8'), beforeText, 'inspection does not write a keyform');
    assert.equal(inspected.corner, corner); assert.equal(inspected.x, -40); assert.equal(inspected.y, corner === 'left-up' ? 35 : -20);
    assert.equal(inspected.reference, join(f.directory, `${corner}.png`));
    const { data, info } = await sharp(inspected.traceCheck).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    assert.deepEqual(pixel(300, 100), corner === 'left-up' ? [136, 136, 136] : [170, 187, 204], 'overlay shows this corner\'s selected frame');
    const fitted = result(await f.tool.execute({ action: 'fit', corner, trace, id: 'chosen', revision: inspected.revision }, f.signal));
    assert.ok(fitted.report.after[0].maxPixels < .01, JSON.stringify(fitted.report));
    const saved = JSON.parse(await readFile(f.author, 'utf8')), key = `${inspected.x},${inspected.y}`;
    const expected = structuredClone(before);
    expected.deformers.find((n: any) => n.id === 'chosen').keyformsXY[key] = saved.deformers.find((n: any) => n.id === 'chosen').keyformsXY[key];
    assert.notDeepEqual(saved.deformers[1].keyformsXY[key], before.deformers[1].keyformsXY[key], 'fit persists a real combined keyform');
    assert.deepEqual(saved, expected, 'only the selected node and corner change; other corners, axes, hierarchy and features stay intact');
    const otherY = corner === 'left-up' ? -20 : 35;
    for (const n of nodes(saved)) {
      const old = nodes(before).find((p: any) => p.id === n.id)!;
      assert.deepEqual([...evaluatePoints(saved, n, -40, otherY, 2)], [...evaluatePoints(before, old, -40, otherY, 2)], 'completed other left corner is preserved in canvas space');
      for (const [x, y] of [[-40, 0], [-20, 0], [0, 0], [20, 0], [40, 0], [0, -20], [0, -10], [0, 17.5], [0, 35]]) {
        assert.deepEqual([...evaluatePoints(saved, n, x, y, 2)], [...evaluatePoints(before, old, x, y, 2)], 'single-axis endpoints and transitions are unchanged');
      }
    }
    const built = await buildAngleXY(f.directory, f.upstreamDirectory, f.scale), face = built.doc.parts.find(p => p.id === 'face/face_base')!;
    const rest = evaluatePoints(built.doc, face, 0, 0, 2), [dx, dy] = corner === 'left-up' ? [-7, -9] : [-5, 13];
    for (const x of [-40, 40]) {
      const posed = evaluatePoints(built.doc, face, x, inspected.y, 2);
      for (let i = 0; i < rest.length; i += 2) {
        assert.ok(Math.abs(posed[i] - rest[i] - (x < 0 ? dx : -dx)) < .01, 'right corner reflects the composed left result');
        assert.ok(Math.abs(posed[i + 1] - rest[i + 1] - dy) < .01);
      }
    }
    const reportPath = join(f.directory, `${corner}-fit-report.json`), reportText = await readFile(reportPath, 'utf8'), report = JSON.parse(reportText);
    assert.deepEqual(report, fitted.report); assert.equal(report.corner, corner); assert.equal(report.x, -40); assert.equal(report.y, inspected.y);
    assert.equal(report.trace, trace);
    if (corner === 'left-up') upReport = reportText;
    else assert.equal(await readFile(join(f.directory, 'left-up-fit-report.json'), 'utf8'), upReport, 'down fitting retains the up report');
    assert.equal(result(await f.tool.execute({ action: 'inspect', corner, trace }, f.signal)).revision, fitted.revision, 'saved revision is usable for the same corner and inputs');
  }
  await mkdir(join(f.directory, 'frames'), { recursive: true });
  const frames: Record<string, unknown> = {}, videos: Record<string, unknown> = {};
  for (const corner of ['left-up', 'left-down']) {
    const video = Buffer.from(`test video ${corner}`), image = f.references.get(corner)!;
    await writeFile(join(f.directory, `${corner}.mp4`), video);
    await writeFile(join(f.directory, 'frames', `${corner}.png`), image);
    videos[corner] = { path: `${corner}.mp4` };
    frames[corner] = { video: `${corner}.mp4`, path: `${corner}.png`, frameIndex: 1, reason: 'fixture frame' };
  }
  await writeFile(join(f.directory, 'selected-frames.json'), JSON.stringify({ version: 1, frames }));
  await writeFile(join(f.directory, 'videos.json'), JSON.stringify({ version: 1, ...videos }));
  await finishAngleXY(f.directory, f.upstreamDirectory, f.scale);
  assert.deepEqual(await readFile(join(f.directory, 'layers/base.png')), f.texture, 'published texture is copied unchanged from the upstream');
  assert.deepEqual(await readFile(join(f.upstreamDirectory, 'layers/base.png')), f.texture);
  assert.equal(await readFile(join(f.upstreamDirectory, 'deformers.json'), 'utf8'), f.upstreamText);
  await assert.rejects(readFile(join(f.directory, 'fit-report.json')), { code: 'ENOENT' }, 'corner reports never use the shared report filename');
});

test('XY revisions bind corner, the selected reference, trace and author independently; invalid corners or missing frames fail before saving', async t => {
  const f = await xyFixture(t), trace = f.traces.get('left-up')!, originalTrace = await readFile(trace, 'utf8'), originalAuthor = await readFile(f.author, 'utf8');
  const inspect = () => f.tool.execute({ action: 'inspect', corner: 'left-up', trace }, f.signal).then(result);
  const fit = (revision: string, corner = 'left-up') => f.tool.execute({ action: 'fit', corner, trace, id: 'chosen', revision }, f.signal);
  for (const corner of [undefined, 'right-up', 'up', '../left-up']) {
    await assert.rejects(f.tool.execute({ action: 'inspect', corner, trace }, f.signal), Error);
  }
  await rm(join(f.directory, 'left-up.png'));
  await assert.rejects(inspect(), Error);
  await writeFile(join(f.directory, 'left-up.png'), f.references.get('left-up')!);
  const initial = await inspect();
  await writeFile(join(f.directory, 'left-down.png'), f.references.get('left-up')!);
  assert.equal((await inspect()).revision, initial.revision, 'the other corner reference is independent');
  await assert.rejects(fit(initial.revision, 'left-down'), Error, 'switching corners rejects even the same trace and identical reference bytes');
  await writeFile(join(f.directory, 'left-up.png'), f.references.get('left-down')!);
  await assert.rejects(fit(initial.revision), Error);
  assert.notEqual((await inspect()).revision, initial.revision, 'selected frame replacement invalidates its revision');
  await writeFile(join(f.directory, 'left-up.png'), f.references.get('left-up')!);
  await writeFile(trace, originalTrace + '\n');
  await assert.rejects(fit(initial.revision), Error);
  assert.notEqual((await inspect()).revision, initial.revision, 'trace changes invalidate XY inspection');
  await writeFile(trace, originalTrace);
  await writeFile(f.author, JSON.stringify({ ...JSON.parse(originalAuthor), notes: 'author changed' }));
  await assert.rejects(fit(initial.revision), Error);
  await writeFile(f.author, originalAuthor);
  assert.equal((await inspect()).revision, initial.revision);
  assert.equal(await readFile(f.author, 'utf8'), originalAuthor, 'failed requests never save a fit');
  for (const corner of ['left-up', 'left-down']) await assert.rejects(readFile(join(f.directory, `${corner}-fit-report.json`)), { code: 'ENOENT' });
});

test('XY fits a facial feature without completion and preserves the corner face fit report', async t => {
  const f = await xyFixture(t), corner = 'left-up', trace = f.traces.get(corner)!;
  const run = (action: 'fit' | 'inspect', id: string, path: string, revision?: string) =>
    f.tool.execute({ action, corner, trace: path, id, revision }, f.signal).then(result);
  await run('fit', 'chosen', trace);
  const faceReport = join(f.directory, 'left-up-fit-report.json'), savedReport = await readFile(faceReport, 'utf8');
  const before = JSON.parse(await readFile(f.author, 'utf8')) as HeadNineAxis;
  const eye = before.parts.find(p => p.id === 'face/other')!;
  delete eye.keyformsXY;
  await writeFile(f.author, JSON.stringify(before) + '\n');
  const featureTrace = join(f.directory, 'left-up-eye-trace.json');
  const landmarks = ([[30, 30], [70, 30], [30, 50], [70, 50]] as const)
    .map(([x, y], i) => ({ id: `eye-${i}`, part: eye.id, source: [x, y], target: [x + 3, y - 2] }));
  await writeFile(featureTrace, JSON.stringify({ version: 1, space: 'view', landmarks }));
  await assert.rejects(run('inspect', 'face/face_base', featureTrace), /completion/);
  await assert.rejects(run('fit', 'chosen', featureTrace), /completion/);
  const inspected = await run('inspect', eye.id, featureTrace);
  assert.equal(inspected.completionCheck, undefined);
  assert.ok(inspected.traceCheck);
  const fitted = await run('fit', eye.id, featureTrace, inspected.revision);
  assert.ok(fitted.report.after.every((entry: { maxPixels: number }) => entry.maxPixels < .01));
  assert.match(fitted.reportPath, /left-up-[a-f0-9]{12}-fit-report\.json$/);
  assert.deepEqual(JSON.parse(await readFile(fitted.reportPath, 'utf8')), fitted.report);
  assert.equal(await readFile(faceReport, 'utf8'), savedReport);
  const after = JSON.parse(await readFile(f.author, 'utf8')) as HeadNineAxis;
  assert.ok(after.parts.find(p => p.id === eye.id)!.keyformsXY?.['-40,35']);
  assert.deepEqual(after.parts.filter(p => p.id !== eye.id), before.parts.filter(p => p.id !== eye.id));
  assert.deepEqual(after.deformers, before.deformers);
});

test('XY rejects folded corner transitions even when the fitted endpoint has positive-area local cells', async t => {
  const f = await xyFixture(t);
  for (const corner of ['left-up', 'left-down'] as const) {
    const trace = f.traces.get(corner)!, source = 'M10 10L90 10L90 90L10 90Z', target = 'M90 90L10 90L10 10L90 10Z';
    await writeFile(trace, JSON.stringify({ version: 1, space: 'view', completion: { part: 'face/face_base', source, target }, curves: [{ id: 'rotated-face', part: 'face/face_base', source, target }] }));
    const before = await readFile(f.author, 'utf8'), info = result(await f.tool.execute({ action: 'inspect', corner, trace }, f.signal));
    await assert.rejects(f.tool.execute({ action: 'fit', corner, trace, id: 'chosen', revision: info.revision }, f.signal), Error);
    assert.equal(await readFile(f.author, 'utf8'), before, 'unsafe transition leaves the author unchanged');
    await assert.rejects(readFile(join(f.directory, `${corner}-fit-report.json`)), { code: 'ENOENT' });
  }
});

test('XY validates the affected corner independently of the other corner\'s unfinished transition', async t => {
  const f = await xyFixture(t), raw = JSON.parse(await readFile(f.author, 'utf8'));
  const chosen = raw.deformers.find((n: any) => n.id === 'chosen');
  chosen.keyformsXY['-40,-20'] = chosen.keyforms['0'].map(([x, y]: number[]) => [200 - x, 180 - y]);
  await writeFile(f.author, JSON.stringify(raw) + '\n');
  const trace = f.traces.get('left-up')!, inspected = result(await f.tool.execute({ action: 'inspect', corner: 'left-up', trace }, f.signal));
  const fitted = result(await f.tool.execute({ action: 'fit', corner: 'left-up', trace, id: 'chosen', revision: inspected.revision }, f.signal));
  assert.ok(fitted.report.after[0].maxPixels < .01);
  const saved = JSON.parse(await readFile(f.author, 'utf8'));
  assert.deepEqual(saved.deformers.find((n: any) => n.id === 'chosen').keyformsXY['-40,-20'], chosen.keyformsXY['-40,-20'], 'opposite corner stays available for its own fitting pass');
});
