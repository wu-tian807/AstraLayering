// A paint layer is not necessarily another geometric surface. Small, shallow
// details enclosed by a larger source surface share its completed light field.
// Source UUIDs and paths establish ownership; no character names or face boxes.
function sourcePaths(layer) {
  return [...new Set([layer.partPath, ...(layer.projection?.shadows || []).flatMap(s => s.receiverPartIds)].filter(Boolean))];
}
function at(layer, x, y) {
  const b = layer.bounds, px = x - b.x, py = y - b.y;
  return px < 0 || py < 0 || px >= b.width || py >= b.height ? -1 : py * b.width + px;
}
export function shareShallowSurfaceMaps(layers, maps) {
  for (let i = 0; i < layers.length; i++) {
    const detail = layers[i], path = detail.partPath;
    if (!path || detail.projection) continue;
    const b = detail.bounds, map = maps.get(detail.id);
    for (let j = i - 1; j >= 0; j--) {
      const owner = layers[j], ob = owner.bounds;
      if (ob.width * ob.height < b.width * b.height * 4) continue;
      const related = sourcePaths(owner).some(p => {
        const branch = p.slice(0, p.lastIndexOf('/'));
        return branch.includes(':') && path.startsWith(branch + '/');
      });
      if (!related) continue;
      const parent = maps.get(owner.id); let count = 0, enclosed = 0, shallow = 0;
      for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
        const p = y * b.width + x;
        if (detail.rgba[p * 4 + 3] < 40) continue;
        count++;
        const q = at(owner, b.x + x, b.y + y);
        if (q < 0 || owner.rgba[q * 4 + 3] < 100) continue;
        enclosed++;
        if (Math.abs(map.data[p * 4 + 3] - parent.data[q * 4 + 3]) > 12) continue;
        const offset=p*4,parentOffset=q*4,nx=map.data[offset]-127.5,ny=map.data[offset+1]-127.5,nz=map.data[offset+2]-127.5,
          px=parent.data[parentOffset]-127.5,py=parent.data[parentOffset+1]-127.5,pz=parent.data[parentOffset+2]-127.5;
        if((nx*px+ny*py+nz*pz)/Math.max(1e-6,Math.hypot(nx,ny,nz)*Math.hypot(px,py,pz))>=.94)shallow++;
      }
      if (!count || enclosed / count < .95 || shallow / count < .9) continue;
      for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
        const p = y * b.width + x, q = at(owner, b.x + x, b.y + y);
        if (q >= 0 && owner.rgba[q * 4 + 3] >= 100)
          map.data.set(parent.data.subarray(q * 4, q * 4 + 4), p * 4);
      }
      map.surfaceOwner = owner.id;
      break;
    }
  }
}
export function surfaceLightingMaps(width, height, layers, maps, normal, depth) {
  const inherited = layers.filter(l => maps.get(l.id)?.surfaceOwner);
  if (!inherited.length) return null;
  const n = new Uint8ClampedArray(normal), d = new Uint8ClampedArray(depth);
  const transmission = new Float32Array(width * height).fill(1);
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i], b = l.bounds, rgba = l.maskedRgba || l.rgba, map = maps.get(l.id);
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
      const gx = b.x + x, gy = b.y + y;
      if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;
      const p = y * b.width + x, q = gy * width + gx, a = rgba[p * 4 + 3] / 255, weight = a * transmission[q];
      if (map.surfaceOwner && weight) {
        for (let c = 0; c < 3; c++) n[q * 4 + c] += (map.data[p * 4 + c] - normal[q * 4 + c]) * weight;
        for (let c = 0; c < 3; c++) d[q * 4 + c] += (map.data[p * 4 + 3] - depth[q * 4 + c]) * weight;
      }
      transmission[q] *= 1 - a;
    }
  }
  return { normal: n, depth: d, inherited: inherited.map(l => ({ id: l.id, owner: maps.get(l.id).surfaceOwner })) };
}
