import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, realpath, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { zipSync } from 'fflate';
import sharp from 'sharp';
import { KRAPreviews } from '../kra-preview.ts';
import { startWorkbench } from './workbench-server.ts';
import { snapshot } from '../snapshot.ts';
import { sectionSteps } from '../progress.js';

test('阴影蒙版显示最新 KRA，首次保存前等待；法线方式不显示蒙版预览', async () => {
  const { latestKraPreview } = await import(new URL('../progress.js', import.meta.url).href);
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const helpers = source.slice(source.indexOf('const isRasterSection ='), source.indexOf('async function post('));
  const renderer = source.slice(source.indexOf('function kraPreviewPanel('), source.indexOf('function reportEvidence('));
  const section: { mode: string; previews: Record<string, { path: string; savedAt: string }> } = { mode: 'mask', previews: {} };
  const context = {
    stages: [{ id: 'shadow', name: '阴影制作' }], data: { sections: [section] }, sectionSteps: [sectionSteps[5]],
    latestKraPreview, esc: String, icon: () => '',
    artifacts: (items: { path: string; kind: string; sharedPreview: boolean }[]) => {
      assert.equal(items[0].kind, 'image'); assert.equal(items[0].sharedPreview, true);
      return items[0].path;
    },
  };
  const render = () => runInNewContext(helpers + renderer + '\nkraPreviewPanel(0);', { ...context }) as string;
  section.previews.step01 = { path: 'shadow/step01_mask/working.kra', savedAt: '2026-10-24T00:00:00Z' };
  const saved = render();
  assert.match(saved, /data-kra-preview="0"/);
  assert.match(saved, /shadow\/step01_mask\/working\.kra/);
  assert.doesNotMatch(saved, /selection\.json/);
  section.mode = 'normal-depth';
  assert.equal(render(), '');
});

test('共用 KRA 预览按最近保存选择跨步骤的新画面', async () => {
  const { latestKraPreview } = await import(new URL('../progress.js', import.meta.url).href);
  assert.equal(latestKraPreview({}), undefined);
  const previews = { step01: { path: 'step01/character-depth.kra', savedAt: '2026-10-23T00:00:00Z' },
    step02: { path: 'step02/working.kra', savedAt: '2026-10-23T00:01:00Z' } };
  assert.equal(latestKraPreview(previews).path, 'step02/working.kra');
  previews.step01.savedAt = '2026-10-23T00:02:00Z';
  assert.equal(latestKraPreview(previews).path, 'step01/character-depth.kra');
});

test('raster review 位于 step01，step02 只有边缘精修', () => {
  for (const i of [1, 3]) {
    assert.deepEqual(sectionSteps[i][0].children.map(step => step.id), ['draw', 'review-01', 'repair-01', 'review-02', 'repair-02']);
    assert.equal(sectionSteps[i][1].children.length, 0);
  }
});

test('最新 KRA 保存画面通过真实 HTTP 预览，不采用过期导出或控制图；重写后刷新', async t => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'kra-workbench-'))), task = join(base, 'case'), step = join(task, 'raster-layering/step02');
  await mkdir(step, { recursive: true });
  t.after(() => rm(base, { recursive: true, force: true }));
  const png = async (color: string) => sharp({ create: { width: 16, height: 20, channels: 4, background: color } }).png().toBuffer();
  const old = await png('#ff0000'), current = await png('#00ff00');
  const main = join(step, 'character-soft-edges.kra'), draft = join(step, 'working.kra');
  await writeFile(main, zipSync({ 'mergedimage.png': old })); await utimes(main, 1, 1);
  await writeFile(draft, zipSync({ 'mergedimage.png': current, 'huge-unused-entry': new Uint8Array(1024) }));
  await writeFile(join(step, 'old-export.png'), old);
  const before = await readFile(draft), value = await snapshot(task, 'case', base);
  assert.equal(value.sections[1].previews.step02.path, 'raster-layering/step02/working.kra');
  assert.ok(value.fileVersions['raster-layering/step02/working.kra']);
  const { url: origin } = await startWorkbench(t, { defaultDir: base, settingsPath: join(base, 'settings.json') });
  const url = `${origin}/artifact?` + new URLSearchParams({ name: 'case', dir: base,
    path: value.sections[1].previews.step02.path, preview: 'kra' });
  const first = await fetch(url);
  assert.equal(first.status, 200); assert.equal(first.headers.get('content-type'), 'image/png');
  assert.deepEqual(await sharp(Buffer.from(await first.arrayBuffer())).raw().toBuffer(), await sharp(current).raw().toBuffer());
  assert.deepEqual(await readFile(draft), before);
  await writeFile(draft, zipSync({ 'mergedimage.png': old }));
  const changed = await fetch(url);
  assert.deepEqual(await sharp(Buffer.from(await changed.arrayBuffer())).raw().toBuffer(), await sharp(old).raw().toBuffer());
  const after = await snapshot(task, 'case', base);
  assert.notEqual(after.fileVersions[value.sections[1].previews.step02.path], value.fileVersions[value.sections[1].previews.step02.path]);
});

test('损坏或缺少合成图的 KRA 明确报错，不伪装为其他图片', async t => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'kra-preview-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const file = join(base, 'draft.kra'), previews = new KRAPreviews();
  await writeFile(file, zipSync({ 'preview.png': new Uint8Array(0) }));
  await assert.rejects(previews.get(file, 'first'), Error);
  await writeFile(file, 'incomplete zip');
  await assert.rejects(previews.get(file, 'second'));
});

test('KRA 略缩图按实际透明内容适配，完整预览保留画布和半透明像素', async t => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'kra-content-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const file = join(base, 'clothing.kra'), previews = new KRAPreviews();
  const patch = await sharp({ create: { width: 20, height: 40, channels: 4, background: { r: 255, g: 0, b: 0, alpha: .2 } } }).png().toBuffer();
  const projection = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: patch, left: 80, top: 140 }]).png().toBuffer();
  await writeFile(file, zipSync({ 'mergedimage.png': projection }));
  const full = await previews.get(file, '1'), thumbnail = await previews.get(file, '1', true);
  assert.deepEqual(await sharp(full).raw().toBuffer(), await sharp(projection).raw().toBuffer());
  const info = await sharp(thumbnail).metadata();
  assert.ok(info.height! > info.width! * 1.8);
  const { data, info: raw } = await sharp(thumbnail).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[(Math.floor(raw.height / 2) * raw.width + Math.floor(raw.width / 2)) * raw.channels + 3] < 255);
});
