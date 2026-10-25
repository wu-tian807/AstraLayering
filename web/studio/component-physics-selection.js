const alphaAt = (layer, x, y) => {
  const b = layer.bounds, ix = Math.floor(x - b.x), iy = Math.floor(y - b.y);
  if (ix < 0 || iy < 0 || ix >= b.width || iy >= b.height) return 0;
  return (layer.maskedRgba || layer.rgba)?.[(iy * b.width + ix) * 4 + 3] || 0;
};

// Pick the pixels actually drawn, in front-to-back order. Static and disabled
// components follow the source pose; enabled components use their deformed UVs.
export function physicsComponentsAt(layers, assignments, bodies, point, size, pose = {}) {
  const [x, y] = point, a = -(pose.angle || 0), dx = x - size[0] / 2 - (pose.x || 0), dy = y - size[1] / 2 - (pose.y || 0);
  const restX = size[0] / 2 + Math.cos(a) * dx - Math.sin(a) * dy;
  const restY = size[1] / 2 + Math.sin(a) * dx + Math.cos(a) * dy;
  const found = [], seen = new Set(); let transmission = 1;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i], id = assignments.get(layer.id), body = bodies.get(id);
    const alpha = (body?.sampleAlpha ? body.sampleAlpha(x, y, [layer]) : body?.hit ? (body.hit(x, y, [layer]) ? 255 : 0) : alphaAt(layer, restX, restY)) / 255;
    if (id && alpha * transmission > .08 && !seen.has(id)) { found.push(id); seen.add(id); }
    transmission *= 1 - alpha;
    if (transmission < .05) break;
  }
  return found;
}
