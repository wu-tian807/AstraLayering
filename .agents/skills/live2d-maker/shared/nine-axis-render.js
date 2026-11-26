import * as THREE from 'three';
import { deformPoints, evaluatePoints, rollEvaluatedPoints, refine, lattice, meshIndices, levelParts } from './nine-axis-model.js';

// The head nine-axis drawing, shared by the workbench panel and the agents'
// view_nine_axis tool, so an agent sees exactly what the workbench shows.
export const SUB = 5;
// Premultiply before filtering so transparent black texels cannot darken the
// painted edge. ImageBitmap ignores Texture.premultiplyAlpha on GPU upload.
export const createNineAxisBitmap = blob => createImageBitmap(blob, { premultiplyAlpha: 'premultiply' });
// Premultiplied texel output without colour conversion keeps the source paint.
// The grid (bbox) is larger than the texture; outside it clamp-to-edge would
// smear the border texels into blocks, so those fragments are dropped.
const vertexShader = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
// Clipping (Cubism clip masks): the sources' alpha is first drawn into an
// offscreen target of the canvas size; a clipped part multiplies its alpha by
// that coverage, or by 1 − coverage when inverted. In the mask pass a part writes
// only its alpha, so overlapping sources add up to their union.
const samplePaint = `
vec4 cubicPaint(vec2 texel, vec2 size) {
  vec2 f = fract(texel);
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 a = -0.5 * f + f2 - 0.5 * f3;
  vec2 b = 1.0 - 2.5 * f2 + 1.5 * f3;
  vec2 c = 0.5 * f + 2.0 * f2 - 1.5 * f3;
  vec2 d = -0.5 * f2 + 0.5 * f3;
  vec2 mid = b + c;
  // Hardware linear filtering combines the two middle Catmull–Rom taps.
  vec2 i = floor(texel) + 0.5;
  vec3 wx = vec3(a.x, mid.x, d.x), wy = vec3(a.y, mid.y, d.y);
  vec3 x = (i.x + vec3(-1.0, c.x / mid.x, 2.0)) / size.x;
  vec3 y = (i.y + vec3(-1.0, c.y / mid.y, 2.0)) / size.y;
  vec4 paint = vec4(0.0);
  for (int j = 0; j < 3; ++j) {
    for (int k = 0; k < 3; ++k) {
      paint += textureLod(map, vec2(x[k], y[j]), 0.0) * wx[k] * wy[j];
    }
  }
  // The negative kernel lobes can overshoot the premultiplied colour range.
  paint.a = clamp(paint.a, 0.0, 1.0);
  paint.rgb = clamp(paint.rgb, vec3(0.0), vec3(paint.a));
  return paint;
}
vec4 samplePaint(vec2 uv, vec2 dx, vec2 dy) {
  vec2 size = vec2(textureSize(map, 0));
  vec2 u = dx * size, v = dy * size;
  vec2 footprint = sqrt(u * u + v * v);
  // Near native size keep the original line art. At minification use the
  // original gradients so anisotropic mipmaps can remove subpixel detail.
  float reduce = smoothstep(1.0, 1.45, max(footprint.x, footprint.y));
  if (reduce >= 1.0) return textureGrad(map, uv, dx, dy);
  vec4 paint = cubicPaint(uv * size - 0.5, size);
  if (reduce <= 0.0) return paint;
  return mix(paint, textureGrad(map, uv, dx, dy), reduce);
}
`;
const fragmentShader = 'uniform sampler2D map;uniform sampler2D clip;uniform float dim;uniform float paintOpacity;uniform float clipMode;uniform float maskPass;uniform float tint;uniform vec2 res;varying vec2 vUv;'
  + samplePaint
  + 'void main(){vec2 dx=dFdx(vUv),dy=dFdy(vUv);if(any(lessThan(vUv,vec2(0.0)))||any(greaterThan(vUv,vec2(1.0))))discard;vec4 c=samplePaint(vUv,dx,dy);if(c.a<0.002)discard;'
  + 'if(maskPass>0.5){gl_FragColor=vec4(c.a*paintOpacity);return;}float opacity=dim*paintOpacity;if(clipMode>0.5){float m=texture2D(clip,gl_FragCoord.xy/res).a;opacity*=clipMode>1.5?1.0-m:m;}'
  + 'gl_FragColor=vec4(mix(c.rgb,vec3(0.25,0.85,1.0)*c.a,tint)*opacity,c.a*opacity);}';
const clipKey = clip => clip.by.join('|');
function paintMesh(geometry, texture) {
  const uniforms = { map: { value: texture }, dim: { value: 1 }, paintOpacity: { value: 1 }, clip: { value: null },
    clipMode: { value: 0 }, maskPass: { value: 0 }, tint: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } };
  const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false,
    side: THREE.DoubleSide, forceSinglePass: true, blending: THREE.CustomBlending, premultipliedAlpha: true,
  }));
  mesh.frustumCulled = false;
  return mesh;
}
const paintTexture = (texture, premultiplyAlpha) => {
  texture.flipY = false; texture.colorSpace = THREE.NoColorSpace; texture.premultiplyAlpha = premultiplyAlpha;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.anisotropy = 8; texture.needsUpdate = true;
  return texture;
};
function writePoints(mesh, points) {
  const position = mesh.geometry.attributes.position, values = position.array;
  for (let i = 0, k = 0; i < points.length; i += 2, k += 3) { values[k] = points[i]; values[k + 1] = points[i + 1]; }
  position.needsUpdate = true;
}

function savedProjectionGeometry([x, y, width, height], caster) {
  const grid = { bbox: [x, y, x + width, y + height], cols: caster.cols, rows: caster.rows };
  const samples = refine(lattice(grid), grid.cols, grid.rows, SUB), uv = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 2) { uv[i] = (samples[i] - x) / width; uv[i + 1] = (samples[i + 1] - y) / height; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(samples.length / 2 * 3), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(meshIndices(grid.cols * SUB, grid.rows * SUB), 1));
  return { geometry, samples };
}

// A paint overlay can share the underlying texture's filtering when both
// meshes follow the same affine map. Check the rendered vertices, including
// parent deformation and roll, so independent edits still use their own mesh.
function samePaintTransform(base, overlay, positions, overlayPositions) {
  const [x0, y0, x1, y1] = base.bbox, cols = base.cols * SUB, rows = base.rows * SUB;
  const dx = [0, 1].map(k => (positions[3 * cols + k] - positions[k]) / (x1 - x0));
  const dy = [0, 1].map(k => (positions[3 * rows * (cols + 1) + k] - positions[k]) / (y1 - y0));
  const follows = (part, points) => {
    const [left, top, right, bottom] = part.bbox, columns = part.cols * SUB, rows = part.rows * SUB;
    for (let j = 0, i = 0; j <= rows; j++) {
      const y = top + (bottom - top) * j / rows - y0;
      for (let c = 0; c <= columns; c++, i += 3) {
        const x = left + (right - left) * c / columns - x0;
        for (let k = 0; k < 2; k++) if (Math.abs(points[i + k] - positions[k] - dx[k] * x - dy[k] * y) > 1 / 64) return false;
      }
    }
    return true;
  };
  return follows(base, positions) && follows(overlay, overlayPositions);
}

const rasterPaint = (p, image) => !p.role && !p.shadow && !p.clip && p.material !== 'transparent' &&
  p.textureBounds.every(Number.isSafeInteger) && p.textureBounds[2] === image.width && p.textureBounds[3] === image.height;
const inside = ([x, y, w, h], [left, top, right, bottom]) => x >= left && y >= top && x + w <= right && y + h <= bottom;

// Filter the composed paint, so partially covered pixels in an overlay and
// its underlying paint don't turn into separate pale fringes on magnification.
function composedPaint(base, overlay, map, overlayMap) {
  const [x, y, w, h] = base.textureBounds, [ox, oy] = overlay.textureBounds;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(map.image, 0, 0);
  ctx.drawImage(overlayMap.image, ox - x, oy - y);
  return paintTexture(new THREE.CanvasTexture(canvas), true);
}

// Parts the workbench draws at a level: the level's parts minus hidden ones,
// and a mask only when it is selected or shown (tinted).
export function shownParts(doc, level, { hidden = new Set(), masks = new Set(), selected = null } = {}) {
  const visible = new Set(levelParts(doc, level).map(p => p.id));
  return new Set(doc.parts.filter(p => p.role === 'mask' ? selected === p.id || masks.has(p.id) : visible.has(p.id) && !hidden.has(p.id)).map(p => p.id));
}

export class HeadNineAxisRenderer {
  staticLayers = [];
  constructor(canvas, renderer) {
    this.renderer = renderer ?? new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: true });
    if (!renderer) this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1); this.meshes = new Map(); this.targets = new Map(); this.paintPairs = []; this.scene = null; this.doc = null;
  }
  clear() {
    this.setStaticLayers([]);
    this.xyPose = null;
    for (const m of this.meshes.values()) { m.geometry.dispose(); m.material.uniforms.map.value.dispose(); m.material.dispose(); }
    for (const t of this.targets.values()) t.dispose();
    for (const pair of this.paintPairs) pair.texture?.dispose();
    this.paintPairs = [];
    this.meshes = new Map(); this.targets.clear(); this.scene = null; this.doc = null; this.renderer.clear();
  }
  setStaticLayers(layers) {
    for (const m of this.staticLayers) {
      this.scene.remove(m);
      this.meshes.delete(m.userData.id);
      const texture = m.material.uniforms.map.value;
      texture.image.close?.();
      m.geometry.dispose(); texture.dispose(); m.material.dispose();
    }
    const parts = this.doc?.parts ?? [];
    this.staticLayers = layers.map(layer => {
      const { image, order, bounds: [x, y, width, height], projection } = layer;
      const casters = parts.filter(part => !part.role && projection?.casters.includes(part.uuid));
      const caster = projection?.casters.length === 1 && casters.length === 1 ? casters[0] : null;
      const grid = caster && savedProjectionGeometry(layer.bounds, caster);
      const m = paintMesh(grid ? grid.geometry : new THREE.PlaneGeometry(width, height), paintTexture(new THREE.Texture(image), false));
      if (!grid) m.position.set(x + width / 2, y + height / 2, 0);
      m.renderOrder = order;
      Object.assign(m.userData, { id: '__studio__/' + layer.uuid, layer, caster, samples: grid?.samples });
      this.meshes.set(m.userData.id, m);
      this.scene.add(m); return m;
    });
    this.meshesByUuid = new Map();
    for (const [id, mesh] of this.meshes) {
      const uuid = mesh.userData.part?.uuid ?? mesh.userData.layer?.uuid;
      if (!uuid || mesh.userData.part?.role === 'mask') continue;
      if (!this.meshesByUuid.has(uuid)) this.meshesByUuid.set(uuid, []);
      this.meshesByUuid.get(uuid).push(id);
    }
  }
  install(doc, images) {
    this.doc = doc; this.scene = new THREE.Scene();
    doc.parts.forEach((p, order) => {
      const [tx, ty, tw, th] = p.textureBounds, uvSource = refine(lattice(p), p.cols, p.rows, SUB), uv = new Float32Array(uvSource.length);
      for (let i = 0; i < uv.length; i += 2) { uv[i] = (uvSource[i] - tx) / tw; uv[i + 1] = (uvSource[i + 1] - ty) / th; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(uv.length / 2 * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(meshIndices(p.cols * SUB, p.rows * SUB), 1));
      const t = paintTexture(new THREE.Texture(images[order]), false);
      const m = paintMesh(g, t);
      m.renderOrder = order; m.userData.part = p; this.scene.add(m); this.meshes.set(p.id, m);
    });
    this.paintPairs = doc.parts.slice(1).flatMap((overlay, i) => {
      const base = doc.parts[i], [x, y, w, h] = base.textureBounds;
      if (!rasterPaint(base, images[i]) || !rasterPaint(overlay, images[i + 1]) || base.parent !== overlay.parent ||
          !inside(overlay.textureBounds, [x, y, x + w, y + h]) ||
          !inside(overlay.textureBounds, base.bbox) || !inside(overlay.textureBounds, overlay.bbox)) return [];
      return [{ base, overlay, texture: null }];
    });
  }
  // Draw the canvas-space window [x0, y0, x0 + width, y0 + height] at angles (x, y, z).
  // shown: the part ids drawn; dim(part) scales a drawn part's alpha.
  // A pose-only preview can reuse the grid. Authoring draws always re-evaluate it.
  draw({ x0, y0, width, height }, x, y, shown, dim = () => 1, z = 0,
    { reuseXY = false, opacity = p => p.shadow?.opacity ?? 1, deform = () => true, layerState = layer => layer } = {}) {
    if (!this.doc) return;
    if (!reuseXY || !this.xyPose || this.xyPose.x !== x || this.xyPose.y !== y) this.xyPose = { x, y, points: new Map() };
    const { points } = this.xyPose;
    Object.assign(this.camera, { left: x0, right: x0 + width, top: y0, bottom: y0 + height }); this.camera.updateProjectionMatrix();
    const visible = new Set(shown);
    const clips = new Map(this.doc.parts.filter(p => p.role !== 'mask' && p.clip && shown.has(p.id)).map(p => [p.id, p.clip]));
    for (const m of this.staticLayers) {
      const state = layerState(m.userData.layer);
      m.userData.state = state;
      m.material.uniforms.paintOpacity.value = state.opacity / 255;
      if (state.visible) visible.add(m.userData.id);
    }
    // Saved alpha inheritance clips to lower layers in the same KRA group.
    // Unauthored projections still follow their caster and clip to posed receivers.
    for (const m of this.staticLayers) {
      const { id, layer, caster, samples } = m.userData;
      const receivers = layer.projection?.receivers ?? layer.inheritAlpha;
      if (!receivers || !visible.has(id)) continue;
      const by = receivers.flatMap(uuid => this.meshesByUuid.get(uuid) ?? []).filter(id => visible.has(id));
      if (!by.length) { visible.delete(id); continue; }
      clips.set(id, { by });
      if (!caster) continue;
      if (!deform(caster)) { writePoints(m, samples); continue; }
      let base = points.get(id);
      if (!base) { base = deformPoints(this.doc, caster, samples, x, y); points.set(id, base); }
      writePoints(m, rollEvaluatedPoints(this.doc, caster, base, z));
    }
    const needed = new Set([...visible, ...[...clips.values()].flatMap(clip => clip.by)]);
    for (const p of this.doc.parts) {
      if (!needed.has(p.id)) continue;
      const moves = deform(p);
      let base = points.get(p.id);
      if (!base) { base = evaluatePoints(this.doc, p, moves ? x : 0, moves ? y : 0, SUB); points.set(p.id, base); }
      const m = this.meshes.get(p.id);
      writePoints(m, rollEvaluatedPoints(this.doc, p, base, moves ? z : 0));
      const u = m.material.uniforms, mask = p.role === 'mask';
      u.tint.value = mask ? 1 : 0; u.dim.value = (mask ? .55 : 1) * dim(p);
      u.paintOpacity.value = opacity(p);
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2()), keys = new Map([...clips.values()].map(clip => [clipKey(clip), clip.by]));
    for (const [key, t] of this.targets) if (!keys.has(key)) { t.dispose(); this.targets.delete(key); }
    for (const [key, by] of keys) {
      let t = this.targets.get(key);
      if (!t) this.targets.set(key, t = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: false }));
      else if (t.width !== size.x || t.height !== size.y) t.setSize(size.x, size.y);
      for (const [id, m] of this.meshes) {
        m.visible = by.includes(id); m.material.uniforms.maskPass.value = 1;
        m.material.blendSrc = THREE.OneFactor; m.material.blendDst = THREE.OneMinusSrcAlphaFactor;
        m.material.blendSrcAlpha = THREE.OneFactor; m.material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      }
      this.renderer.setRenderTarget(t); this.renderer.render(this.scene, this.camera);
    }
    this.renderer.setRenderTarget(null);
    for (const [id, m] of this.meshes) {
      const { part, layer, state } = m.userData, u = m.material.uniforms, clip = clips.get(id);
      const blend = part ? part.shadow?.blendMode : state.blend;
      const multiply = blend === 'multiply' || blend === 'mul', add = blend === 'add' || blend === 'linear_dodge';
      const preserveAlpha = add || (part ? !!part.shadow : !!layer.projection || !!layer.inheritAlpha || multiply);
      m.visible = visible.has(id); u.maskPass.value = 0;
      m.material.blendSrc = multiply ? THREE.DstColorFactor : THREE.OneFactor;
      m.material.blendDst = add ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      // Clipped corrections and shadows modify paint without changing coverage.
      m.material.blendSrcAlpha = preserveAlpha ? THREE.ZeroFactor : THREE.OneFactor;
      m.material.blendDstAlpha = preserveAlpha ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      u.clipMode.value = clip ? (clip.invert ? 2 : 1) : 0;
      if (clip) { u.clip.value = this.targets.get(clipKey(clip)).texture; u.res.value.copy(size); }
    }
    const combined = [];
    for (const pair of this.paintPairs) {
      const { base, overlay } = pair, a = this.meshes.get(base.id), b = this.meshes.get(overlay.id);
      const au = a.material.uniforms, bu = b.material.uniforms;
      if (!a.visible || !b.visible || au.dim.value !== 1 || bu.dim.value !== 1 ||
          au.paintOpacity.value !== 1 || bu.paintOpacity.value !== 1 ||
          this.staticLayers.some(layer => layer.visible && a.renderOrder < layer.renderOrder && layer.renderOrder < b.renderOrder) ||
          !samePaintTransform(base, overlay, a.geometry.attributes.position.array, b.geometry.attributes.position.array)) continue;
      const original = au.map.value;
      pair.texture ??= composedPaint(base, overlay, original, bu.map.value);
      au.map.value = pair.texture; b.visible = false;
      combined.push({ uniform: au.map, original, overlay: b });
    }
    try {
      this.renderer.render(this.scene, this.camera);
    } finally {
      for (const { uniform, original, overlay } of combined) { uniform.value = original; overlay.visible = true; }
    }
  }
}
