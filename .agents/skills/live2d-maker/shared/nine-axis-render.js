import * as THREE from 'three';
import { evaluatePoints, refine, lattice, meshIndices, levelParts } from './nine-axis-model.js';

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
const fragmentShader = 'uniform sampler2D map;uniform sampler2D clip;uniform float dim;uniform float paintOpacity;uniform float clipMode;uniform float maskPass;uniform float tint;uniform vec2 res;varying vec2 vUv;'
  + 'void main(){if(any(lessThan(vUv,vec2(0.0)))||any(greaterThan(vUv,vec2(1.0))))discard;vec4 c=texture2D(map,vUv);if(c.a<0.002)discard;'
  + 'if(maskPass>0.5){gl_FragColor=vec4(c.a*paintOpacity);return;}float opacity=dim*paintOpacity;if(clipMode>0.5){float m=texture2D(clip,gl_FragCoord.xy/res).a;opacity*=clipMode>1.5?1.0-m:m;}'
  + 'gl_FragColor=vec4(mix(c.rgb,vec3(0.25,0.85,1.0)*c.a,tint)*opacity,c.a*opacity);}';
const clipKey = p => p.clip.by.join('|');
const paintTexture = (texture, premultiplyAlpha) => {
  texture.flipY = false; texture.colorSpace = THREE.NoColorSpace; texture.premultiplyAlpha = premultiplyAlpha;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
};

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
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1); this.meshes = new Map(); this.targets = new Map(); this.paintPairs = []; this.scene = null; this.doc = null;
  }
  clear() {
    for (const m of this.meshes.values()) { m.geometry.dispose(); m.material.uniforms.map.value.dispose(); m.material.dispose(); }
    for (const t of this.targets.values()) t.dispose();
    for (const pair of this.paintPairs) pair.texture?.dispose();
    this.paintPairs = [];
    this.meshes = new Map(); this.targets.clear(); this.scene = null; this.doc = null; this.renderer.clear();
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
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { map: { value: t }, dim: { value: 1 }, paintOpacity: { value: p.shadow?.opacity ?? 1 }, clip: { value: null }, clipMode: { value: 0 }, maskPass: { value: 0 }, tint: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } }, vertexShader, fragmentShader,
        transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, premultipliedAlpha: true }));
      m.renderOrder = order; m.frustumCulled = false; this.scene.add(m); this.meshes.set(p.id, m);
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
  draw({ x0, y0, width, height }, x, y, shown, dim = () => 1, z = 0) {
    if (!this.doc) return;
    Object.assign(this.camera, { left: x0, right: x0 + width, top: y0, bottom: y0 + height }); this.camera.updateProjectionMatrix();
    // Clip sources take effect whether or not they are shown or in the level.
    const clipped = this.doc.parts.filter(p => p.clip && shown.has(p.id)), needed = new Set([...shown, ...clipped.flatMap(p => p.clip.by)]);
    for (const p of this.doc.parts) {
      if (!needed.has(p.id)) continue;
      const m = this.meshes.get(p.id), pts = evaluatePoints(this.doc, p, x, y, SUB, z), pos = m.geometry.attributes.position.array;
      for (let i = 0, k = 0; i < pts.length; i += 2, k += 3) { pos[k] = pts[i]; pos[k + 1] = pts[i + 1]; }
      m.geometry.attributes.position.needsUpdate = true;
      const u = m.material.uniforms, mask = p.role === 'mask';
      u.tint.value = mask ? 1 : 0; u.dim.value = (mask ? .55 : 1) * dim(p);
      u.paintOpacity.value = p.shadow?.opacity ?? 1;
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2()), keys = new Map(clipped.map(p => [clipKey(p), p.clip.by]));
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
    for (const p of this.doc.parts) {
      const m = this.meshes.get(p.id), u = m.material.uniforms; m.visible = shown.has(p.id); u.maskPass.value = 0;
      m.material.blendSrc = p.shadow?.blendMode === 'multiply' ? THREE.DstColorFactor : THREE.OneFactor;
      m.material.blendDst = THREE.OneMinusSrcAlphaFactor;
      // A receiver-clipped shadow shades existing paint without changing its silhouette.
      m.material.blendSrcAlpha = p.shadow ? THREE.ZeroFactor : THREE.OneFactor;
      m.material.blendDstAlpha = p.shadow ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      u.clipMode.value = shown.has(p.id) && p.clip && !(p.role === 'mask') ? (p.clip.invert ? 2 : 1) : 0;
      if (u.clipMode.value) { u.clip.value = this.targets.get(clipKey(p)).texture; u.res.value.copy(size); }
    }
    const combined = [];
    for (const pair of this.paintPairs) {
      const { base, overlay } = pair, a = this.meshes.get(base.id), b = this.meshes.get(overlay.id);
      const au = a.material.uniforms, bu = b.material.uniforms;
      if (!a.visible || !b.visible || au.dim.value !== 1 || bu.dim.value !== 1 ||
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
