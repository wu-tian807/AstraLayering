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
const fragmentShader = 'uniform sampler2D map;uniform sampler2D clip;uniform float dim;uniform float clipMode;uniform float maskPass;uniform float tint;uniform vec2 res;varying vec2 vUv;'
  + 'void main(){if(any(lessThan(vUv,vec2(0.0)))||any(greaterThan(vUv,vec2(1.0))))discard;vec4 c=texture2D(map,vUv);if(c.a<0.002)discard;'
  + 'if(maskPass>0.5){gl_FragColor=vec4(c.a);return;}float opacity=dim;if(clipMode>0.5){float m=texture2D(clip,gl_FragCoord.xy/res).a;opacity*=clipMode>1.5?1.0-m:m;}'
  + 'gl_FragColor=vec4(mix(c.rgb,vec3(0.25,0.85,1.0)*c.a,tint)*opacity,c.a*opacity);}';
const clipKey = p => p.clip.by.join('|');

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
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1); this.meshes = new Map(); this.targets = new Map(); this.scene = null; this.doc = null;
  }
  clear() {
    for (const m of this.meshes.values()) { m.geometry.dispose(); m.material.uniforms.map.value.dispose(); m.material.dispose(); }
    for (const t of this.targets.values()) t.dispose();
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
      const t = new THREE.Texture(images[order]); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = false;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { map: { value: t }, dim: { value: 1 }, clip: { value: null }, clipMode: { value: 0 }, maskPass: { value: 0 }, tint: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } }, vertexShader, fragmentShader,
        transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, premultipliedAlpha: true }));
      m.renderOrder = order; m.frustumCulled = false; this.scene.add(m); this.meshes.set(p.id, m);
    });
  }
  // Draw the canvas-space window [x0, y0, x0 + width, y0 + height] at angles (x, y).
  // shown: the part ids drawn; dim(part) scales a drawn part's alpha.
  draw({ x0, y0, width, height }, x, y, shown, dim = () => 1) {
    if (!this.doc) return;
    Object.assign(this.camera, { left: x0, right: x0 + width, top: y0, bottom: y0 + height }); this.camera.updateProjectionMatrix();
    // Clip sources take effect whether or not they are shown or in the level.
    const clipped = this.doc.parts.filter(p => p.clip && shown.has(p.id)), needed = new Set([...shown, ...clipped.flatMap(p => p.clip.by)]);
    for (const p of this.doc.parts) {
      if (!needed.has(p.id)) continue;
      const m = this.meshes.get(p.id), pts = evaluatePoints(this.doc, p, x, y, SUB), pos = m.geometry.attributes.position.array;
      for (let i = 0, k = 0; i < pts.length; i += 2, k += 3) { pos[k] = pts[i]; pos[k + 1] = pts[i + 1]; }
      m.geometry.attributes.position.needsUpdate = true;
      const u = m.material.uniforms, mask = p.role === 'mask';
      u.tint.value = mask ? 1 : 0; u.dim.value = (mask ? .55 : 1) * dim(p);
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2()), keys = new Map(clipped.map(p => [clipKey(p), p.clip.by]));
    for (const [key, t] of this.targets) if (!keys.has(key)) { t.dispose(); this.targets.delete(key); }
    for (const [key, by] of keys) {
      let t = this.targets.get(key);
      if (!t) this.targets.set(key, t = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: false }));
      else if (t.width !== size.x || t.height !== size.y) t.setSize(size.x, size.y);
      for (const [id, m] of this.meshes) { m.visible = by.includes(id); m.material.uniforms.maskPass.value = 1; }
      this.renderer.setRenderTarget(t); this.renderer.render(this.scene, this.camera);
    }
    this.renderer.setRenderTarget(null);
    for (const p of this.doc.parts) {
      const m = this.meshes.get(p.id), u = m.material.uniforms; m.visible = shown.has(p.id); u.maskPass.value = 0;
      u.clipMode.value = shown.has(p.id) && p.clip && !(p.role === 'mask') ? (p.clip.invert ? 2 : 1) : 0;
      if (u.clipMode.value) { u.clip.value = this.targets.get(clipKey(p)).texture; u.res.value.copy(size); }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
