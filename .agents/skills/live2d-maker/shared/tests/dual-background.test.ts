import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { counterpartBackground, recoverDualBackground } from '../agents/dual-background.ts';

const samples = [
  { rgb: [200, 210, 240], alpha: 64 }, { rgb: [200, 210, 240], alpha: 128 },
  { rgb: [200, 210, 240], alpha: 191 }, { rgb: [200, 210, 240], alpha: 230 },
  { rgb: [200, 210, 240], alpha: 242 }, { rgb: [255, 255, 255], alpha: 255 },
  { rgb: [11, 245, 5], alpha: 255 }, { rgb: [0, 0, 0], alpha: 255 },
];
async function composite(background: number[], width = 64, height = 64) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let p = 0; p < width * height; p++) {
    const x = p % width, y = Math.floor(p / width);
    const sample = x >= 8 && x < 56 && y >= 8 && y < 56 ? samples[Math.floor((y - 8) / 6)] : undefined;
    const alpha = (sample?.alpha ?? 0) / 255;
    for (let c = 0; c < 3; c++) rgb[p * 3 + c] = Math.round(alpha * (sample?.rgb[c] ?? 0) + (1 - alpha) * background[c]);
  }
  return sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

test('known two-background pairs retain opaque same-colour foreground and fractional 25–95% alpha', async () => {
  for (const bg of [[11, 245, 5], [3, 5, 251], [249, 5, 3], [0, 0, 0]]) {
    const recovered = await recoverDualBackground(await composite(bg), await composite([254, 255, 254]), new AbortController().signal);
    const { data, info } = await sharp(recovered.png).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [64, 64, 4]);
    assert.equal(data[3], 0);
    for (const [row, sample] of samples.entries()) {
      const p = ((8 + row * 6 + 2) * 64 + 20) * 4;
      assert.ok(Math.abs(data[p + 3] - sample.alpha) <= 1, `alpha ${sample.alpha}: ${data[p + 3]}`);
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(data[p + c] - sample.rgb[c]) <= 3);
    }
    assert.deepEqual(recovered.report.backgrounds, [bg, [254, 255, 254]]);
    const alpha = await sharp(recovered.alpha).extractChannel(0).raw().toBuffer();
    assert.deepEqual(alpha, Buffer.from(Array.from({ length: 4096 }, (_, p) => data[p * 4 + 3])));
  }
});

test('counterpart selection uses actual borders and chooses black for a white first background', async () => {
  assert.equal(await counterpartBackground(await composite([11, 245, 5])), '#FFFFFF');
  assert.equal(await counterpartBackground(await composite([254, 255, 254])), '#000000');
  const reversed = await recoverDualBackground(await composite([254, 255, 254]), await composite([0, 0, 0]), new AbortController().signal);
  const data = await sharp(reversed.png).raw().toBuffer();
  assert.equal(data[((8 + 5 * 6 + 2) * 64 + 20) * 4 + 3], 255);
  // Real background-only edits may have a one-pixel grey frame on the bottom.
  const framed = await sharp(await composite([254, 255, 254])).composite([
    { input: Buffer.from('<svg width="64" height="64"><rect y="63" width="64" height="1" fill="#dddddd"/></svg>') },
  ]).png().toBuffer();
  assert.equal(await counterpartBackground(framed), '#000000');
});

test('reference-guided despill removes key-colour disagreement at translucent edges for red, green and blue backgrounds', async () => {
  const width = 32, height = 32, foreground = [90, 70, 110], alpha = 128 / 255;
  for (const firstBackground of [[12, 248, 4], [248, 12, 4], [12, 4, 248]]) {
    const secondBackground = [255, 255, 255], minimum = Math.min(...firstBackground);
    const make = async (bg: number[], spill: boolean) => {
      const data = Buffer.alloc(width * height * 3);
      for (let p = 0; p < width * height; p++) {
        const inside = p % width >= 8 && p % width < 24 && Math.floor(p / width) >= 8 && Math.floor(p / width) < 24;
        for (let c = 0; c < 3; c++) data[p * 3 + c] = Math.round(inside
          ? alpha * foreground[c] + (1 - alpha) * bg[c] + (spill ? 0.08 * (bg[c] - minimum) : 0) : bg[c]);
      }
      return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
    };
    const recovered = await recoverDualBackground(await make(firstBackground, true), await make(secondBackground, false), new AbortController().signal);
    const rgba = await sharp(recovered.png).raw().toBuffer(), pixel = (16 * width + 16) * 4;
    assert.ok(Math.abs(rgba[pixel + 3] - 128) <= 2);
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(rgba[pixel + c] - foreground[c]) <= 3, `${firstBackground}: channel ${c} = ${rgba[pixel + c]}`);
    assert.ok(recovered.report.despilledPixels > 0);
  }
});

test('clean faint material stays translucent without raising the clear-alpha threshold', async () => {
  for (const alpha of [4, 8, 16]) {
    const make = async (bg: number[]) => {
      const data = Buffer.alloc(32 * 32 * 3);
      for (let p = 0; p < 32 * 32; p++) for (let c = 0; c < 3; c++) {
        const inside = p % 32 >= 8 && p % 32 < 24 && Math.floor(p / 32) >= 8 && Math.floor(p / 32) < 24;
        data[p * 3 + c] = Math.round(inside ? alpha / 255 * [80, 160, 220][c] + (1 - alpha / 255) * bg[c] : bg[c]);
      }
      return sharp(data, { raw: { width: 32, height: 32, channels: 3 } }).png().toBuffer();
    };
    const recovered = await recoverDualBackground(await make([11, 245, 5]), await make([255, 255, 255]), new AbortController().signal);
    const rgba = await sharp(recovered.png).raw().toBuffer();
    assert.ok(Math.abs(rgba[(16 * 32 + 16) * 4 + 3] - alpha) <= 1);
  }
});

test('opaque interiors retain first-image RGB when the background edit changes foreground brightness or colour', async () => {
  const first = await composite([11, 245, 5]);
  const second = await sharp(await composite([254, 255, 254])).composite([
    { input: Buffer.from('<svg width="64" height="64"><rect x="8" y="38" width="48" height="6" fill="#f0edf1"/></svg>') },
  ]).png().toBuffer();
  const recovered = await recoverDualBackground(first, second, new AbortController().signal);
  const rgba = await sharp(recovered.png).raw().toBuffer();
  const pixel = (40 * 64 + 20) * 4;
  assert.deepEqual([...rgba.subarray(pixel, pixel + 4)], [255, 255, 255, 255]);
  assert.ok(recovered.report.preservedOpaquePixels > 0);
});

test('inconsistent edge observations are fitted to a feasible alpha instead of channel-clipped into coloured fringes', async () => {
  const first = await composite([0, 0, 0]), second = await composite([255, 255, 255]);
  const changePixel = async (image: Buffer, colour: number[]) => {
    const data = await sharp(image).raw().toBuffer();
    for (let c = 0; c < 3; c++) data[(7 * 64 + 20) * 3 + c] = colour[c];
    return sharp(data, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer();
  };
  // This inconsistent pair gives a negative blue foreground in the old fit.
  const observations = [[0, 100, 0], [255, 100, 0]];
  const recovered = await recoverDualBackground(await changePixel(first, observations[0]),
    await changePixel(second, observations[1]), new AbortController().signal);
  const rgba = await sharp(recovered.png).raw().toBuffer(), pixel = (7 * 64 + 20) * 4;
  const loss = (alpha: number, foreground: number[]) => observations.reduce((total, rgb, j) => total
    + rgb.reduce((sum, v, c) => sum + (v - alpha * foreground[c] - (1 - alpha) * (j ? 255 : 0)) ** 2, 0), 0);
  const fit = (alpha: number) => [0, 1, 2].map(c => Math.max(0, Math.min(255,
    ((observations[0][c] + observations[1][c]) / 2 - (1 - alpha) * 127.5) / alpha)));
  const actualLoss = loss(rgba[pixel + 3] / 255, [...rgba.subarray(pixel, pixel + 3)]);
  const gridMinimum = Math.min(...Array.from({ length: 4096 }, (_, i) => { const alpha = (i + 1) / 4096; return loss(alpha, fit(alpha)); }));
  assert.ok(actualLoss < loss(2 / 3, fit(2 / 3)));
  assert.ok(actualLoss <= gridMinimum + 10, `${actualLoss} vs ${gridMinimum}`);
  assert.ok(recovered.report.constrainedPixels > 0);
});

test('invalid pairs and cancellation fail explicitly instead of resizing or inventing an alpha', async () => {
  const first = await composite([11, 245, 5]), signal = new AbortController().signal;
  await assert.rejects(recoverDualBackground(first, await composite([0, 255, 0]), signal), Error);
  await assert.rejects(recoverDualBackground(first, await composite([255, 255, 255], 80), signal), Error);
  const striped = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#00ff00' } })
    .composite([{ input: Buffer.from('<svg width="32" height="32"><rect x="16" width="16" height="32" fill="#0000ff"/></svg>') }]).png().toBuffer();
  await assert.rejects(counterpartBackground(striped), Error);
  const cancelled = new AbortController(); cancelled.abort(new Error('cancelled'));
  await assert.rejects(recoverDualBackground(first, first, cancelled.signal), Error);
});
