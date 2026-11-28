import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { startWorkbench } from './workbench-server.ts';
import { renderSVGThumbnail } from '../svg-thumbnail.ts';

const svg = (paint: string, width = 1200, height = 1200) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${paint}</svg>`);
async function pixels(image: Buffer) {
  return sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}
function coverage({ data, info }: Awaited<ReturnType<typeof pixels>>) {
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

test('low legs and tiny accessories fill the preview, centered with padding and preserved proportions', async () => {
  for (const [x, y, width, height] of [[550, 650, 80, 400], [1070, 25, 30, 20]]) {
    const image = await pixels(await renderSVGThumbnail(svg(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="pink"/>`)));
    const bounds = coverage(image);
    assert.ok(Math.abs(bounds.width / bounds.height - width / height) < .01);
    assert.ok(Math.abs(bounds.left - (image.info.width - 1 - bounds.right)) <= 1);
    assert.ok(Math.abs(bounds.top - (image.info.height - 1 - bounds.bottom)) <= 1);
    assert.ok(bounds.width / image.info.width > .86);
    assert.ok(bounds.height / image.info.height > .86);
    assert.ok(bounds.left > 0 && bounds.top > 0);
  }
});

test('visible strokes and translucent white paint survive; hidden geometry does not widen framing', async () => {
  const image = await pixels(await renderSVGThumbnail(svg(
    '<path d="M 0 0 L 1199 1199" stroke="red" opacity="0"/>'
    + '<g transform="translate(500 900)"><rect width="60" height="60" fill="white" opacity="0.35"/>'
    + '<path d="M -30 30 L 90 30" stroke="blue" stroke-width="2"/></g>')));
  const bounds = coverage(image);
  assert.ok(Math.abs(bounds.width / bounds.height - 2) < .03);
  const at = ((Math.floor(image.info.height / 3) * image.info.width) + Math.floor(image.info.width / 2)) * 4;
  assert.equal(image.data[at], 255);
  assert.ok(image.data[at + 3] >= 88 && image.data[at + 3] <= 90);
});

test('multiple separated shapes keep their arrangement; clipping determines the visible bounds', async () => {
  const image = await pixels(await renderSVGThumbnail(svg(
    '<defs><clipPath id="clip"><rect x="400" y="900" width="180" height="60"/></clipPath></defs>'
    + '<g clip-path="url(#clip)"><rect x="400" y="880" width="60" height="100" fill="red"/>'
    + '<rect x="520" y="880" width="60" height="100" fill="blue"/></g>')));
  const bounds = coverage(image);
  assert.ok(Math.abs(bounds.width / bounds.height - 3) < .04);
  const middle = (Math.floor(image.info.height / 2) * image.info.width + Math.floor(image.info.width / 2)) * 4;
  assert.equal(image.data[middle + 3], 0, 'the gap between separate shapes remains transparent');
});

test('empty SVG stays transparent and oversized canvases are bounded', async () => {
  const empty = await pixels(await renderSVGThumbnail(svg('<rect width="1200" height="1200" opacity="0"/>')));
  assert.equal(empty.data.some(value => value !== 0), false);
  await assert.rejects(renderSVGThumbnail(svg('', 100000, 100000)), Error);
});

test('thumbnail endpoint preserves source and path protections, refreshes rewritten drafts, falls back for incomplete SVG', async t => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'layering-svg-thumbnail-')));
  const dir = join(base, 'runs'), task = join(dir, 'test');
  await mkdir(task, { recursive: true });
  const source = svg('<rect x="500" y="900" width="100" height="100" fill="red"/>');
  const file = join(task, 'legs.draft.svg');
  await writeFile(file, source);
  const { url: origin } = await startWorkbench(t, { defaultDir: dir, settingsPath: join(base, 'settings.json') });
  t.after(() => rm(base, { recursive: true, force: true }));
  const url = (path: string, preview = true) => origin + '/artifact?' + new URLSearchParams({ name: 'test', dir, path, v: 'unchanged-client-version', ...(preview ? { preview: 'content' } : {}) });
  const raw = await fetch(url('legs.draft.svg', false));
  assert.match(raw.headers.get('content-type')!, /image\/svg\+xml/);
  assert.match(raw.headers.get('content-security-policy')!, /sandbox/);
  assert.equal(Buffer.from(await raw.arrayBuffer()).equals(source), true);
  const preview = await fetch(url('legs.draft.svg'));
  assert.equal(preview.headers.get('content-type'), 'image/png');
  const before = Buffer.from(await preview.arrayBuffer());
  const same = await Promise.all(Array.from({ length: 4 }, async () => Buffer.from(await (await fetch(url('legs.draft.svg'))).arrayBuffer())));
  assert.ok(same.every(bytes => bytes.equals(before)));
  assert.equal((await readFile(file)).equals(source), true);
  await writeFile(file, svg('<rect x="500" y="900" width="100" height="100" fill="blue"/>'));
  const after = Buffer.from(await (await fetch(url('legs.draft.svg'))).arrayBuffer());
  assert.equal(after.equals(before), false, 'server file version invalidates cached draft even with a stale client version');
  const broken = '<svg><path';
  await writeFile(file, broken);
  assert.equal(await (await fetch(url('legs.draft.svg'))).text(), broken);
  await mkdir(join(base, 'private'));
  await writeFile(join(base, 'private', 'image.svg'), source);
  await symlink(join(base, 'private'), join(task, 'leak'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await fetch(url('leak/image.svg'))).status, 400);
  assert.equal((await fetch(url('../private/image.svg'))).status, 400);
});
