// Source algorithm: ai-weapon-spirit character-studio; source-UV attribution and seeded harmonic completion.
const defaultContourCoverage = { fillInterior: true, sealGapPixels: 1, paddingPixels: 2 };
function buildMapSurface(layers, options = {}) {
  if (!layers.length) throw Error("\u5149\u7167\u8868\u9762\u9700\u8981\u81F3\u5C11\u4E00\u4E2A\u56FE\u5C42\u3002");
  const gap = options.sealGapPixels ?? 0, padding = options.paddingPixels ?? 0;
  if (![gap, padding].every((n) => Number.isInteger(n) && n >= 0 && n <= 4)) throw Error("\u8868\u9762\u8F6E\u5ED3\u4FEE\u8865\u8303\u56F4\u5FC5\u987B\u662F 0\u20134 \u4E2A\u539F\u56FE\u50CF\u7D20\u3002");
  const margin = gap + padding + 1;
  const x = Math.min(...layers.map((l) => l.bounds.x)) - margin, y = Math.min(...layers.map((l) => l.bounds.y)) - margin;
  const width = Math.max(...layers.map((l) => l.bounds.x + l.bounds.width)) - x + margin;
  const height = Math.max(...layers.map((l) => l.bounds.y + l.bounds.height)) - y + margin;
  const coverage = new Uint8Array(width * height), excluded = new Uint8Array(coverage.length);
  for (const layer of layers) {
    const b = layer.bounds, rgba = layer.maskedRgba ?? layer.rgba;
    for (let row = 0; row < b.height; row++) for (let col = 0; col < b.width; col++) {
      const q = (row * b.width + col) * 4 + 3, p = (b.y - y + row) * width + b.x - x + col;
      const a = rgba[q];
      coverage[p] = 255 - Math.round((255 - coverage[p]) * (255 - a) / 255);
      if (layer.maskedRgba && layer.rgba[q] > 40 && a < 4) excluded[p] = 1;
    }
  }
  if (!options.fillInterior && !gap && !padding) return { layerIds: layers.map((l) => l.id), bounds: { x, y, width, height }, coverage };
  let contour = Uint8Array.from(coverage, (a) => a > 40 ? 255 : 0);
  if (gap) contour = morph(morph(contour, width, height, gap, true), width, height, gap, false);
  if (options.fillInterior) fillEnclosed(contour, width, height);
  if (padding) contour = morph(contour, width, height, padding, true);
  for (let p = 0; p < coverage.length; p++) {
    if (!excluded[p] || coverage[p] > 40) coverage[p] = Math.max(coverage[p], contour[p]);
  }
  return { layerIds: layers.map((l) => l.id), bounds: { x, y, width, height }, coverage };
}
function morph(input, width, height, radius, dilate) {
  const output = new Uint8Array(input.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = dilate ? 0 : 255;
    outer: for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const sx = x + dx, sy = y + dy, a = sx >= 0 && sy >= 0 && sx < width && sy < height ? input[sy * width + sx] : 0;
      if (dilate ? a > 0 : a === 0) {
        value = dilate ? 255 : 0;
        break outer;
      }
    }
    output[y * width + x] = value;
  }
  return output;
}
function fillEnclosed(coverage, width, height) {
  const exterior = new Uint8Array(coverage.length), queue = new Uint32Array(coverage.length);
  let start = 0, end = 0;
  const visit = (p) => {
    if (!coverage[p] && !exterior[p]) {
      exterior[p] = 1;
      queue[end++] = p;
    }
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (start < end) {
    const p = queue[start++], x = p % width;
    if (x > 0) visit(p - 1);
    if (x + 1 < width) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p + width < coverage.length) visit(p + width);
  }
  for (let p = 0; p < coverage.length; p++) if (!exterior[p]) coverage[p] = 255;
}
export {
  buildMapSurface,
  defaultContourCoverage
};
