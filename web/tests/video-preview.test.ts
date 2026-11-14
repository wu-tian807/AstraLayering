import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createWorkbench } from '../server.ts';

// A 12-second, 96px H.264/yuv420p moving test pattern; no external codec or
// video service is needed to exercise cover decoding and actual playback.
const fixtureVideo = fileURLToPath(new URL('./fixtures/video-preview.mp4', import.meta.url));
function assertPattern(pixels: number[]) {
  const colours = new Set<string>();
  for (let i = 0; i < pixels.length; i += 4) {
    assert.equal(pixels[i + 3], 255);
    colours.add(pixels.slice(i, i + 3).map(value => Math.floor(value / 32)).join(','));
  }
  assert.ok(colours.size > 8, 'decoded frames contain a varied test pattern');
}

test('video covers decode real frames, and unscaled output playback survives zoom and progress polling', { timeout: 30_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'video-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [step, name] of [['step02_video', 'left'], ['step02_video', 'up'], ['step04_angles/video', 'left-up']]) {
    const directory = join(root, 'case/nine-axis', step);
    await mkdir(directory, { recursive: true });
    await copyFile(fixtureVideo, join(directory, name + '.mp4'));
    await writeFile(join(directory, '.completed'), '');
  }
  const server = await createWorkbench({ defaultDir: root, settingsPath: join(root, 'settings.json') });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const browser = await chromium.launch({ headless: true }).catch(error => {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    t.skip('Install Playwright Chromium to check video playback.'); return null;
  });
  if (!browser) return;
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/version', route => route.fulfill({ json: { label: 'test' } }));
  await page.route('**/api/studio/project?*', route => route.fulfill({ json: { nineAxis: { available: false } } }));
  await page.goto(`http://127.0.0.1:${(server.address() as any).port}/?name=case&page=preview&stage=6`);
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll<HTMLImageElement>('[data-video-cover]')];
    return images.length === 3 && images.every(image => image.complete && image.naturalWidth > 0);
  });
  assert.equal(await page.locator('.flow-world video').count(), 0);
  const cover = page.locator('[data-node="6:step02_video"] [data-video-cover]').first();
  const coverPixels = await cover.evaluate(image => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
    const context = canvas.getContext('2d')!;
    context.drawImage(image as HTMLImageElement, 0, 0, 8, 8);
    return [...context.getImageData(0, 0, 8, 8).data];
  });
  assertPattern(coverPixels);
  await page.getByRole('button', { name: '播放左右转头视频', exact: true }).click();
  const player = page.locator('.output-inspector video');
  await player.evaluate(async video => {
    const media = video as HTMLVideoElement & { playbackToken: string };
    media.playbackToken = 'same-player'; media.muted = true; await media.play();
  });
  await page.waitForFunction(() => (document.querySelector('.output-inspector video') as HTMLVideoElement)?.currentTime > .2);
  const before = await player.evaluate(video => (video as HTMLVideoElement).currentTime);
  await page.getByRole('button', { name: '缩小画布', exact: true }).click();
  const workspace = join(root, 'case/nine-axis/step02_video/workspace');
  await mkdir(workspace, { recursive: true }); await writeFile(join(workspace, 'poll.md'), 'Saved progress');
  await page.waitForFunction(() => document.querySelector('[data-details="process:6:step02_video"]')?.textContent?.includes('1 个过程文件'));
  const playback = await player.evaluate(video => {
    const media = video as HTMLVideoElement & { playbackToken: string };
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
    const context = canvas.getContext('2d')!; context.drawImage(media, 0, 0, 8, 8);
    return { token: media.playbackToken, time: media.currentTime, paused: media.paused, error: media.error?.message,
      pixels: [...context.getImageData(0, 0, 8, 8).data] };
  });
  assert.equal(playback.token, 'same-player'); assert.equal(playback.paused, false);
  assert.ok(playback.time > before + 1); assert.equal(playback.error, undefined);
  assertPattern(playback.pixels);
  await page.getByRole('button', { name: '关闭产物面板', exact: true }).click();
  await page.locator('[data-step="6:step04_angles/video"]').click();
  await page.waitForFunction(() => (document.querySelector('.output-inspector video') as HTMLVideoElement)?.readyState >= 2);
  assert.match(await player.getAttribute('src') ?? '', /left-up\.mp4/);
  assert.equal(await page.locator('.output-inspector .artifact-text').count(), 0, 'step navigation opens the video player');
  assert.deepEqual(errors, []);
});
