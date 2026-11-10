import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { mergeAxes } from '../axis-merge.ts';
import { evaluatePoints, type HeadNineAxis } from '../../shared/nine-axis-model.js';
import { baseline, independentAxes, scale, pts } from './axis-fixtures.ts';
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'astra-axis-merge-')); t.after(() => rm(root, { recursive: true, force: true }));
  const neutral = baseline(), axes = independentAxes();
  // Exercise the real character's count without assuming anatomical grouping.
  for (let i = 4; i < 24; i++) for (const doc of [neutral, ...Object.values(axes)]) {
    const p = structuredClone(neutral.parts[0]); p.id = `face/native_${i}`; p.texture = `layers/p${i}.png`; doc.parts.push(p);
  }
  const directories = { baseline: join(root, 'neutral'), left: join(root, 'left'), up: join(root, 'up'), down: join(root, 'down') };
  const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#ffe2df' } }).png().toBuffer();
  const docs: Record<string, HeadNineAxis> = { baseline: neutral, left: axes.x, up: axes.up, down: axes.down };
  for (const [name, dir] of Object.entries(directories)) {
    await mkdir(join(dir, 'layers'), { recursive: true });
    for (const p of docs[name].parts) await writeFile(join(dir, p.texture), png);
    await writeFile(join(dir, 'deformers.json'), JSON.stringify(docs[name], null, 2) + '\n');
  }
  await writeFile(join(directories.baseline, 'export-record.json'), JSON.stringify({ version: 1, sourceKra: 'original.kra', canvas: neutral.canvas,
    method: 'native static fixture', parts: neutral.parts.map(p => ({ id: p.id, texture: p.texture, textureBounds: p.textureBounds, bbox: p.bbox, cols: p.cols, rows: p.rows })) }));
  return { root, directories, docs, output: join(root, 'merged'), png };
}
async function update(dir: string, mutate: (doc: HeadNineAxis) => void) {
  const path = join(dir, 'deformers.json'), doc = JSON.parse(await readFile(path, 'utf8')); mutate(doc); await writeFile(path, JSON.stringify(doc));
}

test('merge 24 original textures and intact independent trees; own-direction pitch authors and continuous source functions survive', async t => {
  const f = await fixture(t), { directories: d } = f;
  const originals = new Map<string, Buffer>();
  for (const dir of Object.values(d)) { originals.set(join(dir, 'deformers.json'), await readFile(join(dir, 'deformers.json'))); for (const p of f.docs.baseline.parts) originals.set(join(dir, p.texture), await readFile(join(dir, p.texture))); }
  const result = await mergeAxes(f.output, d.baseline, d, scale, f.root);
  const doc = JSON.parse(await readFile(join(f.output, 'deformers.json'), 'utf8')) as HeadNineAxis;
  assert.deepEqual(doc, result.doc);
  assert.equal(doc.deformers.length, 0);
  assert.equal(doc.parts.length, 24);
  assert.equal(result.textures.size, 24);
  assert.ok(!Object.hasOwn(doc, 'authoring'));
  assert.deepEqual(doc.parameters!.map(p => p.keys), [[-30, 0, 30], [-25, 0, 25]]);
  for (const p of doc.parts) {
    assert.equal(p.parent, undefined);
    for (const forms of [p.keyforms, p.keyformsY!, p.keyformsXY!]) for (const form of Object.values(forms)) assert.deepEqual(form, p.keyforms['0']);
  }
  for (const s of doc.axisSources!) {
    assert.deepEqual(s.doc, f.docs[s.axis === 'x' ? 'left' : s.axis]);
    assert.equal(s.doc.deformers.length, 2, 'full original hierarchy remains inside each source');
  }
  const manifest = JSON.parse(await readFile(join(f.output, 'axis-sources.json'), 'utf8'));
  assert.deepEqual(manifest, result.manifest);
  assert.ok(manifest.checks.samples.length > 20);
  assert.ok(manifest.checks.samples.every((s: any) => s.maxError <= 1e-5));
  assert.deepEqual(manifest.sources.map((s: any) => s.file), ['left/deformers.json', 'up/deformers.json', 'down/deformers.json']);
  for (const [path, bytes] of originals) assert.deepEqual(await readFile(path), bytes, path + ' remains byte-for-byte unchanged');
  for (const [x, y] of [[-30, 0], [-7.42, 0], [0, 18.23], [0, -14.42]]) {
    const source = doc.axisSources!.find(s => s.axis === (x ? 'x' : y > 0 ? 'up' : 'down'))!.doc;
    assert.deepEqual(evaluatePoints(doc, doc.parts[0], x, y, 4), evaluatePoints(source, source.parts[0], x, y, 4));
  }
  await assert.rejects(mergeAxes(f.output, d.baseline, d, scale), /已存在/);
});

test('reject modified texture/UV/rest/neutral hierarchy, missing endpoint and edits outside own direction', async t => {
  const cases: [string, (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>, RegExp][] = [
    ['texture', async f => { await writeFile(join(f.directories.up, 'layers/p0.png'), f.png.subarray(0, 20)); }, /原贴图与 neutral 不同/],
    ['UV', async f => update(f.directories.left, d => { d.parts[0].bbox[2]++; }), /bbox/],
    ['rest', async f => update(f.directories.up, d => { d.parts[0].keyforms['0'][0][0]++; }), /原形/],
    ['neutral chain', async f => update(f.directories.down, d => { d.deformers[0].keyforms['0'][0][0]++; }), /中性姿态/],
    ['up cannot edit X', async f => update(f.directories.up, d => { d.parts[0].keyforms['-30'] = pts(d.parts[0], (x, y) => [x + 1, y]); }), /非本方向/],
    ['down cannot edit up', async f => update(f.directories.down, d => { d.parts[0].keyformsY!['25'] = pts(d.parts[0], (x, y) => [x, y - 1]); }), /非本方向/],
    ['missing endpoint', async f => update(f.directories.up, d => { for (const n of [...d.deformers, ...d.parts]) delete n.keyformsY?.['25']; }), /端点/],
    ['recursive source', async f => update(f.directories.left, d => { d.axisSources = []; }), /完整|独立/],
  ];
  for (const [name, mutate, error] of cases) await t.test(name, async t => {
    const f = await fixture(t); await mutate(f);
    await assert.rejects(mergeAxes(f.output, f.directories.baseline, f.directories, scale, f.root), error);
    assert.equal(await stat(f.output).then(() => true, () => false), false, 'no partial output');
  });
});

test('reject writing into original author; allow direction-neutral placeholders without sharing group structures', async t => {
  const f = await fixture(t), d = f.directories;
  await assert.rejects(mergeAxes(d.left, d.baseline, d, scale), /输入作者/);
  await update(d.up, doc => { for (const n of [...doc.deformers, ...doc.parts]) { n.keyforms['-30'] = structuredClone(n.keyforms['0']); n.keyforms['30'] = structuredClone(n.keyforms['0']); } });
  const made = await mergeAxes(f.output, d.baseline, d, scale);
  assert.equal(made.doc.deformers.length, 0);
  assert.notEqual(made.doc.axisSources![0].doc.parts[1].parent, made.doc.axisSources![1].doc.parts[1].parent);
});

test('existing scheduled parent keeps its axis authors and other files; only new root projection names are installed', async t => {
  const f = await fixture(t), d = f.directories;
  // All four immutable input dirs live below this already-created parent.
  const marker = join(f.root, 'scheduling.json'); await writeFile(marker, 'protected parent scheduler');
  const before = await readFile(join(d.left, 'deformers.json'));
  const made = await mergeAxes(f.root, d.baseline, d, scale, f.root);
  assert.equal(await readFile(marker, 'utf8'), 'protected parent scheduler');
  assert.deepEqual(await readFile(join(d.left, 'deformers.json')), before);
  assert.equal(made.doc.parts.length, 24);
  assert.equal(made.manifest.sources[0].file, 'left/deformers.json');
  await assert.rejects(mergeAxes(f.root, d.baseline, d, scale, f.root), /已存在/);
});
