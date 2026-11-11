import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { createWorkbench } from '../server.ts';
import { snapshot } from '../snapshot.ts';
import { reportPreview } from '../report.ts';
import { reportTargets } from '../../.agents/skills/live2d-maker/shared/report-paths.ts';
import { renderReport, reportReferences } from '../report-markdown.js';

test('任务目录经软链接打开时，按真实路径书写的绝对图片链接仍可解析', async t => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'report-alias-'))), real = join(base, 'real-case'), root = join(base, 'case');
  t.after(() => rm(base, { recursive: true, force: true }));
  const image = 'part-layering/step01/evidence/marked.png';
  await mkdir(join(real, 'part-layering/step01/evidence'), { recursive: true });
  await writeFile(join(real, image), 'image');
  await symlink(real, root, process.platform === 'win32' ? 'junction' : 'dir');
  const report = await reportPreview(root, 'part-layering/step01/review.md', '`' + join(real, image) + '`', new Set([image]));
  assert.deepEqual(report.images.map(item => item.path), [image]);
});

test('报告图片定位路径本身：标签同名、行中反引号与全角括号不影响解析', () => {
  const text = '[a.png](a.png) 行中 ``` 不是代码块 b.png\n见（evidence/c.png）与《d.png》';
  const refs = reportReferences(text);
  assert.deepEqual(refs.map(ref => ref.target), ['a.png', 'b.png', 'evidence/c.png', 'd.png']);
  for (const ref of refs) assert.equal(text.slice(ref.targetStart, ref.targetEnd), ref.target);
  assert.equal(refs[0].targetStart, '[a.png]('.length);
});

test('报告图片兼容 Markdown、行内代码与纯路径，代码块不被当作证据', () => {
  const text = '![标注](<evidence/有 空格.png>)\n[对照](evidence/fold(1).png)\n`/run/case/zoom.png`\nevidence/plain.webp\n```python\nopen("not-evidence.png")\n```';
  const refs = reportReferences(text);
  assert.deepEqual(refs.map(ref => ref.target), ['evidence/有 空格.png', 'evidence/fold(1).png', '/run/case/zoom.png', 'evidence/plain.webp']);
  for (const ref of refs) assert.ok(text.slice(ref.start, ref.end).includes(ref.target));
});

test('中文顿号、冒号分隔的图片名各自成为一个引用', () => {
  const text = '链接均相对本报告：a.png、b_zoom.png、c.webp！见 d.png？';
  assert.deepEqual(reportReferences(text).map(ref => ref.target), ['a.png', 'b_zoom.png', 'c.webp', 'd.png']);
});

test('报告图片只解析实际任务内的文件，拒绝外部路径与符号链接', async t => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'report-paths-'))), root = join(base, 'case');
  t.after(() => rm(base, { recursive: true, force: true }));
  const image = 'clothing-raster-layering/step01/evidence/marked.png';
  await mkdir(join(root, 'clothing-raster-layering/step01/evidence'), { recursive: true });
  await writeFile(join(root, image), 'image');
  await writeFile(join(base, 'outside.png'), 'private');
  const alias = 'clothing-raster-layering/step01/linked/outside.png';
  await symlink(base, join(root, 'clothing-raster-layering/step01/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const text = ['结论：需要修复', '![标注](evidence/marked.png)', '`' + image + '`', '`step01/evidence/marked.png`', '`' + join(root, image) + '`',
    '`' + join(base, 'outside.png') + '`', '`../../../outside.png`', '`linked/outside.png`', '![remote](https://example.com/image.png)', '`missing.png`'].join('\n');
  const report = await reportPreview(root, 'clothing-raster-layering/step01/review-01.md', text, new Set([image, alias]));
  assert.equal(report.summary, '结论：需要修复');
  // Report-relative, task-root-relative, legacy section-relative (last-resort ancestor) and absolute all resolve.
  assert.equal(report.images.length, 4);
  assert.ok(report.images.every(item => item.path === image));
  const html = renderReport(text + '\n<script>alert(1)</script>', report.images, path => '/artifact?' + new URLSearchParams({ path }));
  assert.equal((html.match(/<img /g) ?? []).length, 4);
  assert.match(html, /alt="标注"/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|src="https:|src="[^"]*outside/);
});

test('review 草稿展示引用图片，经 HTTP 可读，发布后采用正式报告但不提前标完成', async t => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'report-http-'))), root = join(base, 'case'), step = 'clothing-raster-layering/step01';
  t.after(() => rm(base, { recursive: true, force: true }));
  await mkdir(join(root, step, 'evidence'), { recursive: true });
  const image = step + '/evidence/marked.png', draft = step + '/review-01.md.tmp';
  await writeFile(join(root, image), await sharp({ create: { width: 20, height: 20, channels: 4, background: '#ff0088' } }).png().toBuffer());
  await writeFile(join(root, step, 'report.md'), '结论：完成绘制');
  await writeFile(join(root, draft), '结论：需要修复\n![标注](evidence/marked.png)');
  let value = await snapshot(root, 'case', base), report = value.sections[3].reports['review-01'];
  assert.equal(report.path, draft); assert.equal(report.draft, true);
  assert.equal(report.images[0].path, image); assert.ok(value.fileVersions[draft]);
  assert.notEqual(value.sections[3].states['review-01'], 'done');
  const server = await createWorkbench({ defaultDir: base, settingsPath: join(base, 'settings.json') });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise<void>(done => server.close(() => done())));
  const url = `http://127.0.0.1:${(server.address() as any).port}/artifact?`;
  const module = await fetch(url.replace('/artifact?', '/report-markdown.js'));
  assert.equal(module.status, 200); assert.match(await module.text(), /export function renderReport/);
  const response = await fetch(url + new URLSearchParams({ name: 'case', dir: base, path: draft }));
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type')!, /text\/plain/);
  assert.match(await response.text(), /标注/);
  const picture = await fetch(url + new URLSearchParams({ name: 'case', dir: base, path: image }));
  assert.equal(picture.status, 200); assert.equal((await sharp(Buffer.from(await picture.arrayBuffer())).metadata()).width, 20);
  await writeFile(join(root, draft.replace('.tmp', '')), '结论：通过\n![标注](evidence/marked.png)');
  value = await snapshot(root, 'case', base); report = value.sections[3].reports['review-01'];
  assert.equal(report.draft, false); assert.equal(report.summary, '结论：通过');
  assert.equal(value.sections[3].states['review-01'], 'pending', 'a report without an execution marker is only an artifact');
});

test('report links try the report directory, then the task root, and only then legacy ancestors', () => {
  const root = resolve('/task'), report = 'part-layering/step09_outline/face/review.md';
  assert.deepEqual(reportTargets(root, report, 'evidence/a.png'), ['part-layering/step09_outline/face/evidence/a.png',
    'evidence/a.png', 'part-layering/step09_outline/evidence/a.png', 'part-layering/evidence/a.png'].map(path => join(root, path)));
  assert.deepEqual(reportTargets(root, 'report.md', '../x.png'), []);
});
