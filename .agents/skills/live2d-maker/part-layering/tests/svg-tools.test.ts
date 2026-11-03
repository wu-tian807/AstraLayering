import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import { checkParentBounds, createSvgPreviewTool, createSvgReadTool, taskObservation, validateGroupSvg, type SvgObservation } from '../../shared/part/svg-tools.ts';
import { createBitmapTool } from '../../shared/part/bitmap-tool.ts';
import type { ToolResult } from '../../shared/codex/function-tools.ts';

const signal = new AbortController().signal;
const canvas = { width: 100, height: 100 };
function svg(id: string, shape: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g id="shape" data-group-path="${id}">${shape}</g></svg>`;
}
function info(result: ToolResult) {
  const item = result.contentItems[0];
  assert.equal(item.type, 'inputText');
  return JSON.parse(item.text);
}
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'part-layering-svg-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const reference = join(directory, 'reference.png');
  await sharp({ create: { ...canvas, channels: 4, background: '#0000ff' } }).png().toFile(reference);
  const path = join(directory, 'candidate.svg');
  await writeFile(path, svg('face', '<path fill="red" d="M20 20H80V80H20Z"/>'));
  const observationDirectory = join(directory, 'observations');
  return { directory, reference, path, observationDirectory, tool: createSvgPreviewTool({ directory, reference, canvas, observationDirectory }) };
}

test('九轴复用 SVG 预览时，同画布参考保持原坐标、局部矢量边缘和输入文件', async t => {
  const f = await fixture(t);
  const source = await readFile(f.path), originalReference = await readFile(f.reference);
  const supplied = join(f.directory, 'source-face.png');
  await sharp({ create: { ...canvas, channels: 4, background: '#00ff00' } }).png().toFile(supplied);
  const suppliedBytes = await readFile(supplied);
  const tool = createSvgPreviewTool({ ...f, canvas, referenceAlignment: 'canvas' });
  const properties = tool.inputSchema.properties as Record<string, unknown>;
  assert.ok(properties.reference); assert.ok(!properties.referenceRegion); assert.ok(!properties.referenceOffset);
  for (const [reference, background] of [[undefined, [0, 0, 255]], [supplied, [0, 255, 0]]] as const) {
    const result = await tool.execute({ path: f.path, mode: 'edge', crop: [10, 10, 80, 80], scale: 4, ...(reference ? { reference } : {}) }, signal);
    const metadata = info(result);
    assert.equal(metadata.referenceAlignment, 'canvas');
    assert.equal(metadata.alignment, undefined);
    assert.deepEqual([metadata.width, metadata.height], [320, 320]);
    const { data, info: pixels } = await sharp(metadata.savedPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * pixels.width + x) * 3, (y * pixels.width + x) * 3 + 3)];
    assert.deepEqual(pixel(40, 100), [235, 35, 55], 'x=20 stays at (20-10)*4, rather than centering reference to the SVG');
    assert.deepEqual(pixel(44, 100), background, 'edge is the fill boundary; interior remains the reference');
    assert.deepEqual(pixel(20, 100), background);
  }
  const wrongSize = join(f.directory, 'wrong-size.png');
  await sharp({ create: { width: 60, height: 60, channels: 4, background: '#fff' } }).png().toFile(wrongSize);
  await assert.rejects(tool.execute({ path: f.path, mode: 'edge', reference: wrongSize }, signal), /同坐标参考尺寸/);
  await assert.rejects(tool.execute({ path: f.path, mode: 'edge', reference: supplied, referenceRegion: [0, 0, 100, 100] }, signal), /schema/);
  assert.deepEqual(await readFile(f.path), source);
  assert.deepEqual(await readFile(f.reference), originalReference);
  assert.deepEqual(await readFile(supplied), suppliedBytes);
});

test('真实 root 和 g 属性中的 > 不影响绑定、范围检查和裁剪，实体和组 ID 按属性值比较', async t => {
  const f = await fixture(t);
  const id = 'hair/a.b';
  const source = svg('hair/a&#46;b', '<path fill="red" d="M20 20H80V80H20Z"/>')
    .replace('<svg ', '<svg data-note="a > b" ').replace('<g ', '<g data-note="a > b" ');
  await writeFile(f.path, source);
  assert.deepEqual(await validateGroupSvg(f.path, id, canvas), Buffer.from(source));
  assert.equal((await checkParentBounds(f.path, f.path, canvas)).status, 'pass');
  const preview = info(await f.tool.execute({ path: f.path, crop: [10, 10, 80, 80], scale: 2 }, signal));
  assert.deepEqual([preview.width, preview.height], [160, 160]);
  assert.equal(await readFile(f.path, 'utf8'), source);
  await assert.rejects(validateGroupSvg(f.path, 'hair/axb', canvas), /仅绑定当前组/);
});

test('SVG 源码可按本地路径读取、跨目录及符号链接访问，分页保留原文', async t => {
  const f = await fixture(t), before = await readFile(f.path);
  const tool = createSvgReadTool(f.directory);
  const result = info(await tool.execute({ path: 'candidate.svg' }, signal));
  assert.equal(result.svg, before.toString('utf8'));
  assert.equal(result.bytes, before.length);
  assert.equal(result.complete, true);
  assert.equal(result.nextOffset, null);
  assert.deepEqual(await readFile(f.path), before);
  assert.ok(!(await readdir(f.directory)).includes('observations'));
  const other = join(f.directory, 'other.svg');
  await writeFile(other, before);
  assert.equal(info(await tool.execute({ path: other }, signal)).svg, before.toString());
  await assert.rejects(tool.execute({ path: f.path, output: other }, signal), /提交 SVG/);
  const outside = await mkdtemp(join(tmpdir(), 'part-layering-read-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'outside.svg'), before);
  await symlink(outside, join(f.directory, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  const escaped = join(f.directory, 'escape', 'outside.svg');
  assert.equal(info(await tool.execute({ path: escaped }, signal)).svg, before.toString());
  const large = before.toString() + ' '.repeat(300000);
  await writeFile(f.path, large);
  let offset: number | null = 0, reconstructed = '', version: string | undefined;
  do {
    const page = info(await tool.execute({ path: f.path, offset, limit: 65536 }, signal));
    assert.equal(page.offset, offset);
    assert.equal(page.totalCharacters, large.length);
    assert.equal(page.complete, false);
    version ??= page.sha256; assert.equal(page.sha256, version);
    reconstructed += page.svg; offset = page.nextOffset;
  } while (offset !== null);
  assert.equal(reconstructed, large);
  assert.equal(await readFile(f.path, 'utf8'), large);
  for (const args of [{ offset: -1 }, { limit: 65537 }, { offset: large.length + 1 }]) {
    await assert.rejects(tool.execute({ path: f.path, ...args }, signal));
  }
  await writeFile(f.path, ' '.repeat(8 * 1024 * 1024 + 1));
  assert.equal(info(await tool.execute({ path: f.path, limit: 100 }, signal)).svg.length, 100);
});

test('SVG 裁剪直接放大矢量，混合和边缘叠加与参考共用坐标；预览落盘且输入不变', async t => {
  const f = await fixture(t);
  const source = await readFile(f.path), reference = await readFile(f.reference);
  for (const mode of ['svg', 'blend', 'edge']) {
    const result = await f.tool.execute({ path: f.path, mode, crop: [10, 10, 80, 80], scale: 2 }, signal);
    const metadata = info(result);
    assert.deepEqual([metadata.width, metadata.height], [160, 160]);
    const image = result.contentItems[1];
    assert.equal(image.type, 'inputImage');
    assert.equal(metadata.source, f.path);
    assert.ok(metadata.savedPath.startsWith(join(f.directory, 'observations') + '/'));
    assert.deepEqual(await readFile(metadata.savedPath), Buffer.from(image.imageUrl.split(',')[1], 'base64'));
    const raw = await sharp(metadata.savedPath).ensureAlpha().raw().toBuffer();
    const center = [...raw.subarray((80 * 160 + 80) * 4, (80 * 160 + 80) * 4 + 4)];
    assert.deepEqual(center, mode === 'svg' ? [255, 0, 0, 255] : mode === 'blend' ? [128, 0, 126, 255] : [0, 0, 255, 255]);
  }
  assert.deepEqual(await readFile(f.path), source);
  assert.deepEqual(await readFile(f.reference), reference);
});

test('子组的实际渲染形状必须在父范围内，尺寸、绑定、空图和嵌图均不能冒充完成', async t => {
  const f = await fixture(t);
  const parent = join(f.directory, 'parent.svg');
  await writeFile(parent, svg('face', '<rect x="10" y="10" width="80" height="80" fill="red"/>'));
  await validateGroupSvg(f.path, 'face', canvas, parent);
  assert.equal((await checkParentBounds(f.path, parent, canvas)).status, 'pass');
  await writeFile(f.path, svg('face', '<rect x="0" y="20" width="30" height="30" fill="red"/>'));
  const bounds = await checkParentBounds(f.path, parent, canvas);
  assert.equal(bounds.status, 'fail');
  assert.deepEqual(bounds.outsideBox, [0, 20, 10, 30]);
  await assert.rejects(validateGroupSvg(f.path, 'face', canvas, parent), /超出父轮廓/);
  for (const [content, error] of [
    [svg('other', '<rect width="20" height="20"/>'), /仅绑定当前组/],
    [svg('face', ''), /没有可见/],
    [svg('face', '<image href="reference.png"/>'), /可编辑矢量/],
    [svg('face', '<rect width="20" height="20"/>').replace('0 0 100 100', '0 0 50 50'), /viewBox/],
  ] as const) {
    await writeFile(f.path, content);
    await assert.rejects(validateGroupSvg(f.path, 'face', canvas), error);
  }
});

test('允许共用完整边界、贴边和等价变换，检查采用固定四倍原图坐标网格', async t => {
  const f = await fixture(t);
  const parent = join(f.directory, 'parent.svg');
  const rectangle = '<rect x="10.125" y="10.125" width="79.75" height="79.75"/>';
  for (const [parentShape, childShape] of [
    ['<rect width="100" height="100"/>', '<rect width="100" height="100"/>'],
    [rectangle, rectangle],
    [rectangle, '<rect x="10.126" y="10.126" width="79.748" height="79.748"/>'],
    [rectangle, '<g transform="translate(10.125 10.125)"><path d="M0 0H79.75V79.75H0Z"/></g>'],
  ]) {
    await writeFile(parent, svg('face', parentShape));
    await writeFile(f.path, svg('face', childShape));
    const bounds = await checkParentBounds(f.path, parent, canvas);
    assert.equal(bounds.status, 'pass');
    assert.equal(bounds.scale, 4);
    assert.equal(bounds.alphaThreshold, 128);
    assert.equal(bounds.outsideSamples, 0);
    assert.equal(bounds.outsideBox, null);
  }
});

test('同一贝塞尔曲线精确细分后不因抗锯齿误判；真实向外偏移仍拒绝', async t => {
  const f = await fixture(t);
  const parent = join(f.directory, 'parent.svg');
  type Point = [number, number];
  const p: Point[] = [[10.13, 40.19], [30.27, 10.2], [60.37, 30.3], [90.23, 50.17]];
  const mix = (a: Point, b: Point): Point => [a[0] * .63 + b[0] * .37, a[1] * .63 + b[1] * .37];
  const a = mix(p[0], p[1]), b = mix(p[1], p[2]), c = mix(p[2], p[3]);
  const d = mix(a, b), end = mix(d, mix(b, c));
  const child: Point[] = [p[0], a, d, end];
  const shape = (points: Point[]) => `<path d="M${points[0]} C${points[1]} ${points[2]} ${points[3]} L${points[3][0]},90.17 L${points[0][0]},90.17Z"/>`;
  await writeFile(parent, svg('face', shape(p)));
  await writeFile(f.path, svg('face', shape(child)));
  const before = await Promise.all([readFile(parent), readFile(f.path)]);
  const raster = (bytes: Buffer) => sharp(bytes, { density: 288 }).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  const [parentMask, childMask] = await Promise.all(before.map(raster));
  assert.ok(childMask.some((alpha, i) => alpha >= 128 && parentMask[i] < 128), '此真实共边案例须复现旧二值化方法的误判');
  assert.equal((await checkParentBounds(f.path, parent, canvas)).status, 'pass');
  await validateGroupSvg(f.path, 'face', canvas, parent);
  assert.deepEqual(await Promise.all([readFile(parent), readFile(f.path)]), before);
  await writeFile(f.path, svg('face', shape(child.map(([x, y]) => [x, y - .25]))));
  assert.equal((await checkParentBounds(f.path, parent, canvas)).status, 'fail');
});

test('原分辨率漏掉的四分之一像素越界被识别，报告位置和面积仍使用原图单位', async t => {
  const f = await fixture(t);
  const parent = join(f.directory, 'parent.svg');
  await writeFile(parent, svg('face', '<rect x="10" y="10" width="70" height="80"/>'));
  await writeFile(f.path, svg('face', '<rect x="20" y="20" width="60.25" height="30"/>'));
  const raster = async (path: string) => sharp(await readFile(path)).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  const [parentMask, childMask] = await Promise.all([raster(parent), raster(f.path)]);
  assert.ok(!childMask.some((alpha, i) => alpha >= 128 && parentMask[i] < 128), '旧原分辨率检查不能识别本例');
  const bounds = await checkParentBounds(f.path, parent, canvas);
  assert.equal(bounds.status, 'fail');
  assert.equal(bounds.outsideSamples, 120);
  assert.equal(bounds.outsidePixels, 7.5);
  assert.deepEqual(bounds.outsideBox, [80, 20, .25, 30]);
  await assert.rejects(validateGroupSvg(f.path, 'face', canvas, parent), /超出父轮廓/);
  const tool = createSvgPreviewTool({ ...f, canvas, parent });
  const preview = info(await tool.execute({ path: f.path, mode: 'edge', crop: [70, 10, 25, 50], scale: 2 }, signal));
  assert.deepEqual(preview.bounds, { ...bounds, parent }, '预览倍率和裁剪不改变父范围判断');
  await writeFile(f.path, svg('face', '<rect x="20" y="20" width="30" height="30"/><rect x="20" y="20" width="60.25" height=".25"/>'));
  const tip = await checkParentBounds(f.path, parent, canvas);
  assert.equal(tip.status, 'fail');
  assert.equal(tip.outsideSamples, 1, '仅一个真实越界采样也不得按数量豁免');
  assert.deepEqual(tip.outsideBox, [80, 20, .25, .25]);
});

test('父轮廓孔洞与分离区域继续约束子组，不用扩边或填洞掩盖越界', async t => {
  const f = await fixture(t);
  const parent = join(f.directory, 'parent.svg');
  await writeFile(parent, svg('face', '<path fill-rule="evenodd" d="M10 10H90V90H10Z M40 40H60V60H40Z"/>'));
  await writeFile(f.path, svg('face', '<rect x="40" y="40" width="20" height="20"/>'));
  const hole = await checkParentBounds(f.path, parent, canvas);
  assert.equal(hole.status, 'fail');
  assert.deepEqual(hole.outsideBox, [40, 40, 20, 20]);
  await writeFile(parent, svg('face', '<rect x="10" y="10" width="20" height="80"/><rect x="70" y="10" width="20" height="80"/>'));
  await writeFile(f.path, svg('face', '<rect x="20" y="20" width="10" height="10"/><rect x="70" y="20" width="10" height="10"/>'));
  assert.equal((await checkParentBounds(f.path, parent, canvas)).status, 'pass');
  await writeFile(f.path, svg('face', '<rect x="30" y="20" width="40" height="10"/>'));
  assert.equal((await checkParentBounds(f.path, parent, canvas)).status, 'fail');
});

test('预览校验选框和倍率，并支持外部 SVG 与符号链接', async t => {
  const f = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'part-layering-svg-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const path = join(outside, 'outside.svg');
  await writeFile(path, await readFile(f.path));
  await symlink(outside, join(f.directory, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const args of [{ path: f.path, crop: [99, 0, 2, 2] }, { path: f.path, scale: 9 }]) {
    await assert.rejects(f.tool.execute(args, signal));
  }
  assert.ok(!(await readdir(f.directory)).includes('observations'));
  for (const path of [join(outside, 'outside.svg'), 'escape/outside.svg']) assert.equal((await f.tool.execute({ path }, signal)).success, true);
});

test('生成图选区对齐 SVG 实际内容，保留宽高比例；crop 和 scale 只影响显示', async t => {
  const f = await fixture(t);
  await writeFile(f.path, svg('face', '<rect x="20" y="30" width="60" height="20" fill="red"/>'));
  const generated = join(f.directory, 'generated.png');
  await sharp({ create: { width: 200, height: 100, channels: 4, background: 'blue' } }).png().toFile(generated);
  const before = await Promise.all([readFile(f.path), readFile(f.reference), readFile(generated)]);
  const tool = createSvgPreviewTool({ ...f, canvas, allowGeneratedReference: true });
  const args = { path: f.path, mode: 'edge', reference: generated, referenceRegion: [100, 20, 80, 40] };
  const automatic = info(await tool.execute(args, signal));
  assert.deepEqual(automatic.alignment, { svgBounds: [20, 30, 60, 20], scale: .5, offset: [0, 0], translation: [30, 30] });
  assert.deepEqual(automatic.crop, [8, 26, 84, 28]);
  const zoom = info(await tool.execute({ ...args, crop: [10, 20, 80, 40], scale: 2 }, signal));
  assert.deepEqual(zoom.alignment, automatic.alignment, '查看选框和倍率保持对齐变换');
  assert.deepEqual([zoom.width, zoom.height], [160, 80]);
  assert.equal(zoom.reference, generated);
  const raw = await sharp(zoom.savedPath).ensureAlpha().raw().toBuffer();
  const pixel = (x: number, y: number) => [...raw.subarray(((y - 20) * 2 * 160 + (x - 10) * 2) * 4, ((y - 20) * 2 * 160 + (x - 10) * 2) * 4 + 4)];
  assert.deepEqual(pixel(25, 40), [255, 255, 255, 255], '长宽比差异保留为留白，生成图没有被横向拉满');
  assert.deepEqual(pixel(35, 40), [0, 0, 255, 255], '只对齐所选生成图区域');
  assert.deepEqual(pixel(20, 40), [235, 35, 55, 255], 'SVG 红色轮廓仍位于原图坐标');
  const shifted = info(await tool.execute({ ...args, referenceOffset: [3, -1] }, signal));
  assert.deepEqual(shifted.alignment.translation, [33, 29]);
  assert.deepEqual(shifted.alignment.offset, [3, -1]);
  const original = info(await tool.execute({ path: f.path, mode: 'blend' }, signal));
  assert.deepEqual(original.crop, [0, 0, 100, 100]);
  assert.equal(original.reference, undefined);
  assert.equal(original.alignment, undefined);
  assert.deepEqual(await Promise.all([readFile(f.path), readFile(f.reference), readFile(generated)]), before);
});

test('生成图参数仅向补全开放，定义快照互不影响；错误坐标和偏移返回校验错误，外部参考可直接对照', async t => {
  const f = await fixture(t);
  const generated = join(f.directory, 'generated.png');
  await sharp({ create: { width: 200, height: 100, channels: 4, background: 'blue' } }).png().toFile(generated);
  assert.equal((f.tool.inputSchema.properties as object).hasOwnProperty('reference'), false);
  await assert.rejects(f.tool.execute({ path: f.path, mode: 'edge', reference: generated }, signal), /schema/);
  const tool = createSvgPreviewTool({ ...f, canvas, allowGeneratedReference: true });
  assert.ok((tool.inputSchema.properties as object).hasOwnProperty('referenceRegion'));
  const base = { path: f.path, mode: 'edge', reference: generated };
  const outside = await mkdtemp(join(tmpdir(), 'part-layering-reference-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'outside.png'), await readFile(generated));
  await symlink(outside, join(f.directory, 'escape-reference'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const args of [
    { ...base, referenceRegion: [190, 0, 20, 20] }, { ...base, referenceRegion: [0, 0, 0, 20] },
    { ...base, referenceRegion: [.5, 0, 20, 20] }, { ...base, referenceOffset: [7, 0] },
    { ...base, referenceOffset: [0, NaN] }, { ...base, referenceOffset: [0] },
    { path: f.path, mode: 'edge', referenceRegion: [0, 0, 20, 20] },
    { path: f.path, mode: 'edge', referenceOffset: [0, 0] }, { ...base, mode: 'svg' },
    { ...base, referenceCrop: [0, 0, 20, 20] },
  ]) await assert.rejects(tool.execute(args, signal));
  assert.ok(!(await readdir(f.directory)).includes('observations'));
  await writeFile(f.path, svg('face', ''));
  await assert.rejects(tool.execute(base, signal), /没有可见部件/);
  await writeFile(f.path, svg('face', '<rect x="20" y="20" width="60" height="60"/>'));
  for (const reference of [join(outside, 'outside.png'), 'escape-reference/outside.png']) assert.equal((await tool.execute({ ...base, reference }, signal)).success, true);
});

test('工具相对参数以任务根目录为基准、结果为绝对路径、记录相对任务根：相对路径不按管线目录解析，越出任务根被拒绝', async t => {
  const root = await mkdtemp(join(tmpdir(), 'part-layering-task-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'part-layering'), groupDirectory = join(directory, 'groups', 'face');
  await mkdir(groupDirectory, { recursive: true });
  const reference = join(directory, 'references', 'base.png');
  await mkdir(dirname(reference));
  await sharp({ create: { ...canvas, channels: 4, background: '#0000ff' } }).png().toFile(reference);
  await writeFile(join(groupDirectory, 'outline.svg'), svg('face', '<path fill="red" d="M20 20H80V80H20Z"/>'));
  const observed: SvgObservation[] = [];
  const tool = createSvgPreviewTool({ directory, reference, canvas, observationDirectory: join(directory, 'observations'), observed: entry => observed.push(entry) });
  const preview = info(await tool.execute({ path: 'part-layering/groups/face/outline.svg', mode: 'blend' }, signal));
  assert.equal(preview.source, join(groupDirectory, 'outline.svg'));
  assert.ok(preview.savedPath.startsWith(join(directory, 'observations') + '/'));
  assert.ok(isAbsolute(observed[0].source), '内部观察记录保持绝对路径供比对');
  assert.deepEqual(await taskObservation(root, observed[0]), { ...observed[0], source: 'part-layering/groups/face/outline.svg', savedPath: relative(root, preview.savedPath) });
  await assert.rejects(tool.execute({ path: 'groups/face/outline.svg' }, signal), /ENOENT/);
  await assert.rejects(tool.execute({ path: '../outside.svg' }, signal), /任务根/);
  const read = info(await createSvgReadTool(directory).execute({ path: 'part-layering/groups/face/outline.svg' }, signal));
  assert.equal(read.source, join(groupDirectory, 'outline.svg'));
  const viewed = info(await createBitmapTool(directory, join(directory, 'bitmaps')).execute({ path: 'part-layering/references/base.png' }, signal));
  assert.equal(viewed.path, reference);
  assert.ok(viewed.savedPath.startsWith(join(directory, 'bitmaps') + '/'));
});
