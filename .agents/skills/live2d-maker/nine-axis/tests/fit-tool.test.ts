import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { fitWarpToTraces } from '../../shared/nine-axis-fit.js';
import { lattice, keyformAt, warpPoint, parentPoint, evaluatePoints, nodes, type HeadNineAxis } from '../../shared/nine-axis-model.js';
import { createNineAxisFitTool } from '../fit-tool.ts';
import { createHeadEditTool } from '../edit-tool.ts';
import { finishHead } from '../head.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { finishAngleY } from '../angle-y.ts';
import { buildAngleXY, finishAngleXY } from '../angle-xy.ts';

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
  const directory = join(root, 'nine-axis/step02_angles'); await mkdir(join(directory, 'layers'), { recursive: true }); await mkdir(join(root, 'nine-axis/step01_video'), { recursive: true });
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
  assert.equal(inspectInfo.revision, sha256(original), 'left revision remains the author hash');
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
  const xdir = join(root, 'nine-axis/step02_angles'); await mkdir(join(xdir, 'layers'), { recursive: true });
  await mkdir(join(root, 'nine-axis/step01_video'), { recursive: true });
  const color = join(root, 'source.png'), document = join(root, 'source.kra'); await writeFile(document, 'source');
  await sharp({ create: { width: 200, height: 200, channels: 4, background: '#fff' } }).png().toFile(color);
  for (const direction of ['up', 'down']) await sharp({ create: { width: 100, height: 100, channels: 4, background: '#888' } }).png().toFile(join(root, `nine-axis/step01_video/${direction}.png`));
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
    assert.equal(info.revision, sha256(await readFile(author, 'utf8')), 'single-axis revision remains the author hash');
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
  const directory = join(root, 'nine-axis/step03_angle-xy'), upstreamDirectory = join(root, 'nine-axis/step05_angle-down');
  await mkdir(join(upstreamDirectory, 'layers'), { recursive: true });
  const color = join(root, 'source.png'), document = join(root, 'source.kra'); await writeFile(document, 'source');
  await sharp({ create: { width: 200, height: 200, channels: 4, background: '#fff' } }).png().toFile(color);
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
    await assert.rejects(f.tool.execute({ action: 'inspect', corner, trace }, f.signal), /corner 必须为 left-up 或 left-down/);
  }
  await rm(join(f.directory, 'left-up.png'));
  await assert.rejects(inspect(), /缺少 left-up 的所选参考帧/);
  await writeFile(join(f.directory, 'left-up.png'), f.references.get('left-up')!);
  const initial = await inspect();
  await writeFile(join(f.directory, 'left-down.png'), f.references.get('left-up')!);
  assert.equal((await inspect()).revision, initial.revision, 'the other corner reference is independent');
  await assert.rejects(fit(initial.revision, 'left-down'), /revision/, 'switching corners rejects even the same trace and identical reference bytes');
  await writeFile(join(f.directory, 'left-up.png'), f.references.get('left-down')!);
  await assert.rejects(fit(initial.revision), /所选参考帧.*revision/);
  assert.notEqual((await inspect()).revision, initial.revision, 'selected frame replacement invalidates its revision');
  await writeFile(join(f.directory, 'left-up.png'), f.references.get('left-up')!);
  await writeFile(trace, originalTrace + '\n');
  await assert.rejects(fit(initial.revision), /描线.*revision/);
  assert.notEqual((await inspect()).revision, initial.revision, 'trace changes invalidate XY inspection');
  await writeFile(trace, originalTrace);
  await writeFile(f.author, JSON.stringify({ ...JSON.parse(originalAuthor), notes: 'author changed' }));
  await assert.rejects(fit(initial.revision), /作者数据.*revision/);
  await writeFile(f.author, originalAuthor);
  assert.equal((await inspect()).revision, initial.revision);
  assert.equal(await readFile(f.author, 'utf8'), originalAuthor, 'failed requests never save a fit');
  for (const corner of ['left-up', 'left-down']) await assert.rejects(readFile(join(f.directory, `${corner}-fit-report.json`)), { code: 'ENOENT' });
});

test('XY rejects folded corner transitions even when the fitted endpoint has positive-area local cells', async t => {
  const f = await xyFixture(t);
  for (const corner of ['left-up', 'left-down'] as const) {
    const trace = f.traces.get(corner)!, source = 'M10 10L90 10L90 90L10 90Z', target = 'M90 90L10 90L10 10L90 10Z';
    await writeFile(trace, JSON.stringify({ version: 1, space: 'view', completion: { part: 'face/face_base', source, target }, curves: [{ id: 'rotated-face', part: 'face/face_base', source, target }] }));
    const before = await readFile(f.author, 'utf8'), info = result(await f.tool.execute({ action: 'inspect', corner, trace }, f.signal));
    await assert.rejects(f.tool.execute({ action: 'fit', corner, trace, id: 'chosen', revision: info.revision }, f.signal), /X=-40,Y=(17\.5|-10) 的组合网格翻折/);
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
