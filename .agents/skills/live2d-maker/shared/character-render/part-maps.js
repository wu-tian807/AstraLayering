// Source algorithm: ai-weapon-spirit character-studio; source-UV attribution and seeded harmonic completion.
import { harmonicFill } from "./harmonic-fill.js";
import { shareShallowSurfaceMaps } from './surface-lighting.js';
function extractPartMaps(width, height, layers, normal, depth, surfaces = []) {
  const transmission = new Float32Array(width * height).fill(1), maps = /* @__PURE__ */ new Map();
  const means = /* @__PURE__ */ new Map();
  const surfaceEnds = surfaces.map((surface) => ({ ...surface, index: layers.findIndex((layer) => surface.layerIds.includes(layer.id)) }));
  for (let l = layers.length - 1; l >= 0; l--) {
    const layer = layers[l], { x, y, width: w, height: h } = layer.bounds;
    const map = { data: new Uint8Array(w * h * 4), confidence: new Uint8Array(w * h), known: 0, inferred: 0 };
    maps.set(layer.id, map);
    let mean = means.get(layer.partId);
    if (!mean) {
      mean = { n: 0, channels: [0, 0, 0, 0] };
      means.set(layer.partId, mean);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const local = j * w + i, global = (y + j) * width + x + i, a = layer.rgba[local * 4 + 3] / 255;
      if (!a) continue;
      const coverage = layer.maskedRgba ? layer.maskedRgba[local * 4 + 3] / 255 : a;
      if (coverage >= 0.65 && transmission[global] >= 0.8) {
        const p = local * 4, q = global * 4;
        map.data[p] = normal[q];
        map.data[p + 1] = normal[q + 1];
        map.data[p + 2] = normal[q + 2];
        map.data[p + 3] = depth[q];
        map.confidence[local] = 255;
        map.known++;
        mean.n++;
        for (let c = 0; c < 4; c++) mean.channels[c] += map.data[p + c];
      } else map.inferred++;
      transmission[global] *= 1 - coverage;
    }
    for (const surface of surfaceEnds) if (surface.index === l) {
      const b = surface.bounds;
      for (let sy = Math.max(0, b.y); sy < Math.min(height, b.y + b.height); sy++)
        for (let sx = Math.max(0, b.x); sx < Math.min(width, b.x + b.width); sx++) {
          const p = sy * width + sx, coverage = surface.coverage[(sy - b.y) * b.width + sx - b.x] / 255;
          transmission[p] = Math.min(transmission[p], 1 - coverage);
        }
    }
  }
  for (const layer of layers) {
    const map = maps.get(layer.id), { width: w, height: h } = layer.bounds, count = w * h;
    const visited = new Uint8Array(count), queue = new Uint32Array(count);
    let start = 0, end = 0;
    for (let i = 0; i < count; i++) if (map.confidence[i]) {
      visited[i] = 1;
      queue[end++] = i;
    }
    const knownEnd = end;
    while (start < end) {
      const p = queue[start++], x = p % w;
      for (let dir = 0; dir < 4; dir++) {
        if (dir === 0 && x === 0 || dir === 1 && x === w - 1) continue;
        const q = p + (dir === 0 ? -1 : dir === 1 ? 1 : dir === 2 ? -w : w);
        if (q < 0 || q >= count || visited[q] || layer.rgba[q * 4 + 3] < 4) continue;
        visited[q] = 1;
        queue[end++] = q;
        for (let c = 0; c < 4; c++) map.data[q * 4 + c] = map.data[p * 4 + c];
      }
    }
    const mean = means.get(layer.partId), fallback = mean.n ? mean.channels.map((c) => c / mean.n) : [128, 128, 255, 112];
    for (let i = 0; i < count; i++) if (!visited[i]) for (let c = 0; c < 4; c++) map.data[i * 4 + c] = fallback[c];
    harmonicFill(map.data, w, visited, queue.subarray(knownEnd, end));
  }
  shareShallowSurfaceMaps(layers, maps);
  return maps;
}
export {
  extractPartMaps
};
