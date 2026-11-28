import * as THREE from 'three';
import { createPointDeformer, rollEvaluatedPoints, refine, lattice, meshIndices, levelParts } from './nine-axis-model.js';

// The head nine-axis drawing, shared by the workbench panel and the agents'
// view_nine_axis tool, so an agent sees exactly what the workbench shows.
export const SUB = 5;
export function renderMeshSamples(part) {
  // Retain the original refinement on coarse artwork. Dense authored cells
  // already sample the surface, so subdivide each axis only where needed.
  const subdivision = cells => Math.min(SUB, Math.max(2, Math.ceil(32 / cells)));
  const x = subdivision(part.cols), y = subdivision(part.rows);
  return { cols: part.cols * x, rows: part.rows * y,
    points: refine(lattice(part), part.cols, part.rows, x, undefined, y) };
}
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
  + 'void main(){vec2 dx=dFdx(vUv),dy=dFdy(vUv);if(any(lessThan(vUv,vec2(0.0)))||any(greaterThan(vUv,vec2(1.0))))discard;if(maskPass>0.5){float a=textureGrad(map,vUv,dx,dy).a;if(a<0.002)discard;gl_FragColor=vec4(a*paintOpacity);return;}vec4 c=samplePaint(vUv,dx,dy);if(c.a<0.002)discard;'
  + 'float opacity=dim*paintOpacity;if(clipMode>0.5){float m=texture2D(clip,gl_FragCoord.xy/res).a;opacity*=clipMode>1.5?1.0-m:m;}'
  + 'gl_FragColor=vec4(mix(c.rgb,vec3(0.25,0.85,1.0)*c.a,tint)*opacity,c.a*opacity);}';
const clipKey = clip => clip.by.join('|');
const blendModes = { normal: 0, multiply: 1, add: 2 };
const compositeFragment = `
  varying vec2 vScreen;
  uniform sampler2D src, dst, mask;
  uniform float opacity, blend, inheritAlpha, useMask;
  void main() {
    vec4 s = texture2D(src, vScreen) * opacity;
    if (useMask > 0.5) s *= texture2D(mask, vScreen).a;
    vec4 d = texture2D(dst, vScreen);
    vec3 cs = s.a > 0.0 ? s.rgb / s.a : vec3(0.0);
    vec3 cd = d.a > 0.0 ? d.rgb / d.a : vec3(0.0);
    vec3 mixed = blend < 0.5 ? cs : blend < 1.5 ? cs * cd : min(cs + cd, vec3(1.0));
    if (inheritAlpha > 0.5) gl_FragColor = vec4(mix(d.rgb, mixed * d.a, s.a), d.a);
    else gl_FragColor = vec4(d.rgb * (1.0 - s.a) + s.rgb * (1.0 - d.a) + mixed * s.a * d.a,
      s.a + d.a * (1.0 - s.a));
  }`;
const screenVertex = 'varying vec2 vScreen;void main(){vScreen=uv;gl_Position=vec4(position.xy,0.0,1.0);}';

function nativeStack(stack, opacity = 1, inheritAlpha = false) {
  return stack.flatMap(layer => {
    if (!layer.visible || !layer.opacity) return [];
    const mergedOpacity = Math.round(layer.opacity * opacity * 255) / 255;
    const mergedInheritAlpha = inheritAlpha || layer.inheritAlpha;
    if (layer.children && layer.passThrough) {
      // Krita projects pass-through children directly and drops group masks.
      return nativeStack(layer.children, mergedOpacity, mergedInheritAlpha);
    }
    if (!Object.hasOwn(blendModes, layer.blend)) throw Error(`${layer.name}：九轴暂不支持 KRA 混合模式 ${layer.blend}`);
    return [{ ...layer, opacity: mergedOpacity, inheritAlpha: mergedInheritAlpha,
      ...(layer.children ? { children: nativeStack(layer.children) } : {}) }];
  });
}

// Flatten only groups whose normal child composition is independent of the
// backdrop. Blend modes and alpha inheritance need the actual sibling buffer.
function drawStack(stack, shadows) {
  return stack.flatMap(layer => {
    if (!layer.children) return [{ ...layer, direct: layer.parts.length === 1 &&
      layer.blend === 'normal' && !layer.inheritAlpha && !shadows.has(layer.parts[0]) }];
    const children = drawStack(layer.children, shadows);
    return layer.opacity === 1 && layer.blend === 'normal' && !layer.inheritAlpha &&
      !layer.masks.length && children.every(child => child.direct) ? children : [{ ...layer, children }];
  });
}

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
  if (mesh.userData.writtenPoints === points) return;
  mesh.userData.writtenPoints = points;
  const position = mesh.geometry.attributes.position, values = position.array;
  for (let i = 0, k = 0; i < points.length; i += 2, k += 3) { values[k] = points[i]; values[k + 1] = points[i + 1]; }
  position.needsUpdate = true;
}

function savedProjectionGeometry([x, y, width, height], caster) {
  const grid = { bbox: [x, y, x + width, y + height], cols: caster.cols, rows: caster.rows };
  const { cols, rows, points: samples } = renderMeshSamples(grid), uv = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 2) { uv[i] = (samples[i] - x) / width; uv[i + 1] = (samples[i + 1] - y) / height; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(samples.length / 2 * 3), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(meshIndices(cols, rows), 1));
  return { geometry, samples };
}

function groupMaskGeometry([x, y, width, height], anchor) {
  // The mask can cover the entire canvas. Include the anchor's grid inside
  // its texture so a small eye or mouth Warp is still sampled at normal density.
  const coordinates = (start, end, from, to, count) => [start,
    ...Array.from({ length: count + 1 }, (_, i) => from + (to - from) * i / count).filter(v => start < v && v < end), end];
  const X = coordinates(x, x + width, anchor.bbox[0], anchor.bbox[2], anchor.cols * SUB);
  const Y = coordinates(y, y + height, anchor.bbox[1], anchor.bbox[3], anchor.rows * SUB);
  const samples = new Float32Array(Y.flatMap(py => X.flatMap(px => [px, py])));
  const uv = samples.map((v, i) => i % 2 ? (v - y) / height : (v - x) / width);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(samples.length / 2 * 3), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(meshIndices(X.length - 1, Y.length - 1), 1));
  return { geometry, samples };
}

// A paint overlay can share the underlying texture's filtering when both
// meshes follow the same affine map. Check the rendered vertices, including
// parent deformation and roll, so independent edits still use their own mesh.
function samePaintTransform(base, overlay, a, b) {
  const positions = a.geometry.attributes.position.array, overlayPositions = b.geometry.attributes.position.array;
  const [x0, y0, x1, y1] = base.bbox, { cols, rows } = a.userData.grid;
  const dx = [0, 1].map(k => (positions[3 * cols + k] - positions[k]) / (x1 - x0));
  const dy = [0, 1].map(k => (positions[3 * rows * (cols + 1) + k] - positions[k]) / (y1 - y0));
  const follows = (part, points, {cols: columns, rows}) => {
    const [left, top, right, bottom] = part.bbox;
    for (let j = 0, i = 0; j <= rows; j++) {
      const y = top + (bottom - top) * j / rows - y0;
      for (let c = 0; c <= columns; c++, i += 3) {
        const x = left + (right - left) * c / columns - x0;
        for (let k = 0; k < 2; k++) if (Math.abs(points[i + k] - positions[k] - dx[k] * x - dy[k] * y) > 1 / 64) return false;
      }
    }
    return true;
  };
  return follows(base, positions, a.userData.grid) && follows(overlay, overlayPositions, b.userData.grid);
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
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1); this.meshes = new Map(); this.targets = new Map(); this.compositionTargets = new Map(); this.paintPairs = []; this.scene = null; this.doc = null;
  }
  clear() {
    this.setStaticLayers([]);
    this.invalidatePose();
    for (const m of this.meshes.values()) { m.geometry.dispose(); m.material.uniforms.map.value.dispose(); m.material.dispose(); }
    for (const target of this.compositionTargets.values()) target.dispose();
    this.compositionTargets.clear();
    if (this.screen) {
      this.screen.quad.geometry.dispose();
      this.screen.composite.dispose(); this.screen.copy.dispose();
      this.screen = undefined;
    }
    for (const pair of this.paintPairs) pair.texture?.dispose();
    this.paintPairs = [];
    this.meshes = new Map(); this.scene = null; this.doc = null; this.renderer.clear();
  }
  setStaticLayers(layers) {
    this.clearMasks();
    for (const m of this.staticLayers) {
      this.scene.remove(m);
      this.meshes.delete(m.userData.id);
      const texture = m.material.uniforms.map.value;
      texture.image.close?.();
      m.geometry.dispose(); texture.dispose(); m.material.dispose();
    }
    const parts = this.doc?.parts ?? [];
    const maskAnchors = new Map();
    const groups = stack => { for (const layer of stack) if (layer.children) {
      for (const mask of layer.masks) maskAnchors.set(mask, layer.maskAnchor);
      groups(layer.children);
    } };
    if (this.native) groups(this.native);
    this.staticLayers = layers.map(layer => {
      const { image, order, bounds: [x, y, width, height], projection } = layer;
      const id = '__studio__/' + layer.uuid;
      const casters = parts.filter(part => !part.role && projection?.casters.includes(part.uuid));
      const caster = layer.groupMask ? parts.find(part => part.id === maskAnchors.get(id))
        : projection?.casters.length === 1 && casters.length === 1 ? casters[0] : null;
      const grid = caster && (layer.groupMask ? groupMaskGeometry(layer.bounds, caster) : savedProjectionGeometry(layer.bounds, caster));
      const m = paintMesh(grid ? grid.geometry : new THREE.PlaneGeometry(width, height), paintTexture(new THREE.Texture(image), false));
      if (!grid) m.position.set(x + width / 2, y + height / 2, 0);
      Object.assign(m.userData, { id, layer, caster, samples: grid?.samples,
        xy: grid && new Float32Array(grid.samples.length) });
      m.renderOrder = this.nativeOrder?.get(m.userData.id) ?? order ?? 0;
      this.meshes.set(m.userData.id, m);
      this.scene.add(m); return m;
    });
    this.meshesByUuid = new Map();
    for (const [id, mesh] of this.meshes) {
      const uuid = mesh.userData.part?.uuid ?? mesh.userData.layer?.uuid;
      if (!uuid || mesh.userData.part?.role === 'mask' || mesh.userData.layer?.groupMask) continue;
      if (!this.meshesByUuid.has(uuid)) this.meshesByUuid.set(uuid, []);
      this.meshesByUuid.get(uuid).push(id);
    }
  }
  install(doc, images, paintStack) {
    this.doc = doc; this.invalidatePose(); this.scene = new THREE.Scene();
    this.native = paintStack === undefined ? undefined : nativeStack(paintStack);
    doc.parts.forEach((p, order) => {
      const [tx, ty, tw, th] = p.textureBounds, grid = renderMeshSamples(p), uvSource = grid.points, uv = new Float32Array(uvSource.length);
      for (let i = 0; i < uv.length; i += 2) { uv[i] = (uvSource[i] - tx) / tw; uv[i + 1] = (uvSource[i + 1] - ty) / th; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(uv.length / 2 * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(meshIndices(grid.cols, grid.rows), 1));
      const t = paintTexture(new THREE.Texture(images[order]), false);
      const m = paintMesh(g, t);
      m.renderOrder = order; Object.assign(m.userData, { part: p, grid });
      this.scene.add(m); this.meshes.set(p.id, m);
    });
    this.fixed = new Set(doc.parts.filter(p => /^neck(?:\/|$)/.test(p.id) || p.material === 'transparent' && !p.role).map(p => p.id));
    const byId = new Map(doc.parts.map((part, i) => [part.id, { part, image: images[i] }]));
    const pair = (baseId, overlayId) => {
      const a = byId.get(baseId), b = byId.get(overlayId);
      if (!a || !b) return [];
      const base = a.part, overlay = b.part, [x, y, w, h] = base.textureBounds;
      if (!rasterPaint(base, a.image) || !rasterPaint(overlay, b.image) || base.parent !== overlay.parent ||
          !inside(overlay.textureBounds, [x, y, x + w, y + h]) ||
          !inside(overlay.textureBounds, base.bbox) || !inside(overlay.textureBounds, overlay.bbox)) return [];
      return [{ base, overlay, texture: null }];
    };
    const opaque = layer => layer?.parts?.length === 1 && layer.blend === 'normal' && layer.opacity === 1 &&
      !layer.inheritAlpha && !layer.masked;
    const pairs = stack => stack.flatMap((layer, i) => {
      if (layer.children) return layer.masks.length ? [] : pairs(layer.children);
      const next = stack[i + 1];
      return opaque(layer) && opaque(next) && layer.parent === next.parent ? pair(layer.parts[0], next.parts[0]) : [];
    });
    this.paintPairs = this.native ? pairs(this.native) : doc.parts.slice(1).flatMap((overlay, i) => pair(doc.parts[i].id, overlay.id));
    this.nativeOpacity = new Map(); this.nativeOrder = new Map();
    const order = stack => { for (const layer of stack) {
      if (layer.children) { order(layer.children); continue; }
      for (const id of layer.parts) {
        this.nativeOpacity.set(id, layer.opacity);
        this.nativeOrder.set(id, this.nativeOrder.size);
        const mesh = this.meshes.get(id);
        if (mesh) mesh.renderOrder = this.nativeOrder.get(id);
      }
    } };
    if (this.native) order(this.native);
  }

  compositionTarget(key, size) {
    let target = this.compositionTargets.get(key);
    if (!target) {
      target = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: false });
      this.compositionTargets.set(key, target);
    } else if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    return target;
  }

  composeNative(stack, shadows, visible, size) {
    const renderer = this.renderer, savedAutoClear = renderer.autoClear;
    const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha();
    renderer.autoClear = false;
    renderer.setClearColor(0, 0);

    const clear = target => { renderer.setRenderTarget(target); renderer.clear(); };
    const paint = (ids, target, replace = false) => {
      if (!ids.length) return;
      const selected = new Set(ids);
      for (const [id, mesh] of this.meshes) {
        mesh.visible = selected.has(id);
        if (!mesh.visible) continue;
        const mat = mesh.material;
        mat.blendSrc = mat.blendSrcAlpha = THREE.OneFactor;
        mat.blendDst = mat.blendDstAlpha = replace ? THREE.ZeroFactor : THREE.OneMinusSrcAlphaFactor;
      }
      renderer.setRenderTarget(target); renderer.render(this.scene, this.camera);
    };
    if (!this.screen) {
      const uniforms = Object.fromEntries(['src', 'dst', 'mask', 'opacity', 'blend', 'inheritAlpha', 'useMask'].map(key => [key, { value: null }]));
      const composite = new THREE.ShaderMaterial({ vertexShader: screenVertex, fragmentShader: compositeFragment,
        uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
      const copy = new THREE.ShaderMaterial({ vertexShader: screenVertex, fragmentShader:
        'varying vec2 vScreen;uniform sampler2D src;void main(){gl_FragColor=texture2D(src,vScreen);}',
        uniforms: { src: { value: null } }, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
      const scene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite);
      quad.frustumCulled = false; scene.add(quad);
      this.screen = { scene, quad, composite, copy, camera: new THREE.Camera() };
    }
    const { scene, quad, composite, copy, camera } = this.screen;
    const target = key => this.compositionTarget(key, size);
    const apply = (out, dst, src, opacity, blend, inheritAlpha, mask) => {
      const values = { dst: dst.texture, src: src.texture, opacity, blend, inheritAlpha: +inheritAlpha,
        mask: mask?.texture ?? src.texture, useMask: +!!mask };
      for (const [key, value] of Object.entries(values)) composite.uniforms[key].value = value;
      quad.material = composite; renderer.setRenderTarget(out); renderer.render(scene, camera);
    };
    const compose = (entries, depth) => {
      let dst = target(depth + ':a'), out = target(depth + ':b');
      clear(dst);
      let direct = [];
      for (const layer of entries) {
        if (layer.direct) {
          if (visible.has(layer.parts[0])) direct.push(layer.parts[0]);
          continue;
        }
        const ids = layer.parts?.filter(id => visible.has(id));
        if (ids && !ids.length) continue;
        paint(direct, dst); direct = [];
        let source;
        if (layer.children) source = compose(layer.children, depth + 1);
        else {
          source = target(depth + ':source'); clear(source);
          for (const id of ids) this.meshes.get(id).material.uniforms.paintOpacity.value = 1;
          // Slices share a native layer. At overlap the later stable id owns
          // the sample, so layer opacity and the blending operation run once.
          paint(ids, source, ids.length > 1);
        }
        let mask;
        for (const id of layer.masks ?? []) {
          if (mask) {
            const empty = target(depth + ':empty'), masked = target(depth + ':masked' + +(source === target(depth + ':masked0')));
            clear(empty); apply(masked, empty, source, 1, 0, false, mask); source = masked;
          }
          mask = target(depth + ':mask'); clear(mask); paint([id], mask);
        }
        apply(out, dst, source, layer.opacity, blendModes[layer.blend],
          layer.inheritAlpha || !!ids?.some(id => shadows.has(id)), mask);
        [dst, out] = [out, dst];
      }
      paint(direct, dst);
      return dst;
    };
    try {
      copy.uniforms.src.value = compose(stack, 0).texture;
      quad.material = copy; renderer.setRenderTarget(null); renderer.render(scene, camera);
    } finally {
      renderer.setRenderTarget(null); renderer.autoClear = savedAutoClear;
      renderer.setClearColor(clearColor, clearAlpha);
    }
  }
  createMask(ids, size) {
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: false });
    const scene = new THREE.Scene();
    const sources = ids.map(id => {
      const original = this.meshes.get(id);
      const proxy = paintMesh(original.geometry, original.material.uniforms.map.value);
      proxy.renderOrder = original.renderOrder;
      proxy.userData.id = id;
      proxy.material.uniforms.maskPass.value = 1;
      Object.assign(proxy.material, { blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
      scene.add(proxy);
      return { original, proxy };
    });
    return { target, scene, sources };
  }
  disposeMask({target, sources}) {
    target.dispose();
    for (const {proxy} of sources) proxy.material.dispose();
  }
  clearMasks() {
    for (const mask of this.targets.values()) this.disposeMask(mask);
    this.targets.clear();
  }
  invalidatePose() {
    this.xyPose = this.neutralPose = null;
  }
  // Draw the canvas-space window [x0, y0, x0 + width, y0 + height] at angles (x, y, z).
  // shown: the part ids drawn; dim(part) scales a drawn part's alpha.
  // A pose-only preview can reuse the grid. Authoring draws always re-evaluate it.
  draw({ x0, y0, width, height }, x, y, shown, dim = () => 1, z = 0,
    { reuseXY = false, opacity = p => p.shadow?.opacity ?? 1, deform = () => true } = {}) {
    if (!this.doc) return;
    if (!reuseXY) this.invalidatePose();
    const pose = (x, y) => ({ x, y, points: new Map(), deform: createPointDeformer(this.doc, x, y) });
    const neutral = this.neutralPose ??= pose(0, 0);
    if (!this.xyPose || this.xyPose.x !== x || this.xyPose.y !== y) this.xyPose = x || y ? pose(x, y) : neutral;
    const pointsAt = (m, node, samples, moves) => {
      const current = moves ? this.xyPose : neutral;
      let base = current.points.get(m);
      if (!base) { base = current.deform(node, samples); current.points.set(m, base); }
      const roll = moves ? z : 0;
      if (m.userData.base !== base || m.userData.roll !== roll) {
        m.userData.base = base; m.userData.roll = roll;
        writePoints(m, roll ? rollEvaluatedPoints(this.doc, node, base, roll) : base);
      }
    };
    Object.assign(this.camera, { left: x0, right: x0 + width, top: y0, bottom: y0 + height }); this.camera.updateProjectionMatrix();
    const visible = new Set([...shown].filter(id => !this.native || this.nativeOpacity.has(id)));
    const clips = new Map(this.doc.parts.filter(p => p.role !== 'mask' && p.clip && visible.has(p.id)).map(p => [p.id, p.clip]));
    for (const m of this.staticLayers) {
      const { id, layer, caster, samples } = m.userData;
      if (layer.groupMask) {
        if (caster) {
          if (!deform(caster)) { m.userData.base = null; writePoints(m, samples); }
          else pointsAt(m, caster, samples, true);
        }
        continue;
      }
      const state = this.native ? { visible: this.nativeOpacity.has(id), opacity: (this.nativeOpacity.get(id) ?? 0) * 255 } : layer;
      m.userData.state = state;
      m.material.uniforms.paintOpacity.value = state.opacity / 255;
      if (state.visible) visible.add(m.userData.id);
    }
    // Unauthored projections follow their caster and clip to posed receivers.
    for (const m of this.staticLayers) {
      const { id, layer, caster, samples } = m.userData;
      if (!layer.projection || !visible.has(id)) continue;
      if (caster && !visible.has(caster.id)) { visible.delete(id); continue; }
      const by = layer.projection.receivers.flatMap(uuid => this.meshesByUuid.get(uuid) ?? []).filter(id => visible.has(id));
      if (!by.length) { visible.delete(id); continue; }
      clips.set(id, { by });
      if (!caster) continue;
      if (!deform(caster)) { m.userData.base = null; writePoints(m, samples); continue; }
      pointsAt(m, caster, samples, true);
    }
    const needed = new Set([...visible, ...[...clips.values()].flatMap(clip => clip.by)]);
    for (const p of this.doc.parts) {
      if (!needed.has(p.id)) continue;
      const m = this.meshes.get(p.id);
      pointsAt(m, p, m.userData.grid.points, !this.fixed.has(p.id) && deform(p));
      const u = m.material.uniforms, mask = p.role === 'mask';
      u.tint.value = mask ? 1 : 0; u.dim.value = (mask ? .55 : 1) * dim(p);
      u.paintOpacity.value = this.native ? (this.nativeOpacity.get(p.id) ?? (mask ? 1 : 0)) : opacity(p);
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2()), keys = new Map([...clips.values()].map(clip => [clipKey(clip), clip.by]));
    const frame = [x0, y0, width, height, size.x, size.y];
    for (const [key, mask] of this.targets) if (!keys.has(key)) {
      this.disposeMask(mask); this.targets.delete(key);
    }
    for (const [key, by] of keys) {
      let mask = this.targets.get(key);
      if (!mask) { mask = this.createMask(by, size); this.targets.set(key, mask); }
      const { target, scene, sources } = mask;
      const inputs = [...frame];
      for (const { original, proxy } of sources) {
        const { map, paintOpacity } = original.material.uniforms;
        proxy.material.uniforms.paintOpacity.value = paintOpacity.value;
        proxy.material.uniforms.map.value = map.value;
        proxy.position.copy(original.position);
        inputs.push(original.geometry.attributes.position.version, paintOpacity.value, map.value.version);
      }
      if (mask.inputs?.every((value, i) => value === inputs[i])) continue;
      mask.inputs = inputs;
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
      this.renderer.setRenderTarget(target); this.renderer.render(scene, this.camera);
    }
    this.renderer.setRenderTarget(null);
    for (const [id, m] of this.meshes) {
      const { part, layer, state } = m.userData, u = m.material.uniforms, clip = clips.get(id);
      const blend = this.native ? undefined : part ? part.shadow?.blendMode : state?.blend;
      const multiply = blend === 'multiply' || blend === 'mul', add = blend === 'add' || blend === 'linear_dodge';
      const preserveAlpha = add || (part ? !!part.shadow : !!layer?.projection || !this.native && multiply);
      m.visible = visible.has(id); u.maskPass.value = 0;
      m.material.blendSrc = multiply ? THREE.DstColorFactor : THREE.OneFactor;
      m.material.blendDst = add ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      // Clipped corrections and shadows modify paint without changing coverage.
      m.material.blendSrcAlpha = preserveAlpha ? THREE.ZeroFactor : THREE.OneFactor;
      m.material.blendDstAlpha = preserveAlpha ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      u.clipMode.value = clip ? (clip.invert ? 2 : 1) : 0;
      if (clip) { u.clip.value = this.targets.get(clipKey(clip)).target.texture; u.res.value.copy(size); }
    }
    const combined = [];
    for (const pair of this.paintPairs) {
      const { base, overlay } = pair, a = this.meshes.get(base.id), b = this.meshes.get(overlay.id);
      const au = a.material.uniforms, bu = b.material.uniforms;
      if (!a.visible || !b.visible || au.dim.value !== 1 || bu.dim.value !== 1 ||
          au.paintOpacity.value !== 1 || bu.paintOpacity.value !== 1 ||
          this.staticLayers.some(layer => layer.visible && a.renderOrder < layer.renderOrder && layer.renderOrder < b.renderOrder) ||
          !samePaintTransform(base, overlay, a, b)) continue;
      const original = au.map.value;
      pair.texture ??= composedPaint(base, overlay, original, bu.map.value);
      au.map.value = pair.texture; b.visible = false;
      combined.push({ uniform: au.map, original, overlay: b });
    }
    try {
      if (!this.native) this.renderer.render(this.scene, this.camera);
      else {
        const shadows = new Set([...this.meshes].filter(([, mesh]) => mesh.userData.part?.shadow || mesh.userData.layer?.projection).map(([id]) => id));
        const stack = drawStack(this.native, shadows);
        if (stack.every(layer => layer.direct)) this.renderer.render(this.scene, this.camera);
        else this.composeNative(stack, shadows, new Set([...this.meshes].filter(([, mesh]) => mesh.visible).map(([id]) => id)), size);
      }
    } finally {
      for (const { uniform, original, overlay } of combined) { uniform.value = original; overlay.visible = true; }
    }
  }
}
