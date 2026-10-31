import * as THREE from 'three';
import { validateHeadNineAxis, keyformAt, keyValues, lattice, refine, meshIndices, levelParts, dragKeyform, deformerTree } from './nine-axis-model.js';
const $ = s => document.querySelector(s);
const SUB = 2, NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const short = id => id.replace(/^(face|hair)\//, '').replace(/^features\//, '');
// Premultiplied texel output without colour conversion keeps the source paint.
const vertexShader = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const fragmentShader = 'uniform sampler2D map;uniform float dim;varying vec2 vUv;void main(){vec4 c=texture2D(map,vUv);if(c.a<0.002)discard;gl_FragColor=vec4(c.rgb*c.a*dim,c.a*dim);}';

export class HeadNineAxisPanel {
  constructor({ error }) {
    Object.assign(this, { error }); this.epoch = 0; this.value = 0; this.level = 'accessory'; this.selected = null; this.hidden = new Set();
    this.radius = 40; this.showGrid = true; this.dirty = new Set(); this.active = false;
    this.canvas = $('#nine-axis-canvas'); this.overlay = $('#nine-axis-overlay'); this.view = $('#nine-axis-view');
    $('#nine-axis-angle').oninput = e => this.setValue(e.target.valueAsNumber);
    $('#nine-axis-angle-number').onchange = e => this.setValue(e.target.valueAsNumber);
    for (const b of document.querySelectorAll('[data-nine-level]')) b.onclick = () => { this.level = b.dataset.nineLevel; this.sync(); };
    $('#nine-axis-swing').onchange = e => e.target.checked ? this.swing() : this.stopSwing();
    $('#nine-axis-grid').onchange = e => { this.showGrid = e.target.checked; this.draw(); };
    $('#nine-axis-radius').oninput = e => { this.radius = e.target.valueAsNumber; $('#nine-axis-radius-value').textContent = this.radius + ' px'; };
    $('#nine-axis-reset').onclick = () => this.resetKeyform();
    $('#nine-axis-restore').onclick = () => this.project && void this.load(this.project, true);
    $('#nine-axis-fit').onclick = () => this.fit();
    this.view.addEventListener('wheel', e => this.wheel(e), { passive: false });
    this.view.addEventListener('pointerdown', e => this.pointerDown(e));
    new ResizeObserver(() => this.resize()).observe(this.view);
  }
  diagnostics() { return { loaded: !!this.doc, value: this.value, level: this.level, selected: this.selected, edited: [...this.dirty] }; }
  async load(project, force = false) {
    const epoch = ++this.epoch, entry = project?.nineAxis;
    this.stopSwing();
    if (!force && this.doc && this.project?.folder === project?.folder && this.version === entry?.version) return;
    this.project = project; this.version = entry?.version; this.clear();
    if (!entry?.available) { this.status(project ? `${project.displayName || project.name} 尚无头部九轴数据（${entry?.path ?? 'nine-axis/step02_head/deformers.json'}）` : '打开含头部九轴数据的项目后预览'); return; }
    this.status('正在读取头部九轴…');
    try {
      const url = path => './studio-artifact?' + new URLSearchParams({ folder: project.folder, path, version: entry.version });
      const r = await fetch(url(entry.path)); if (!r.ok) throw Error('头部九轴数据读取失败');
      const doc = validateHeadNineAxis(await r.json()), base = entry.path.replace(/[^/]+$/, '');
      const images = await Promise.all(doc.parts.map(async p => { const b = await fetch(url(base + p.texture)); if (!b.ok) throw Error(p.id + '：贴图读取失败'); return createImageBitmap(await b.blob(), { premultiplyAlpha: 'none' }); }));
      if (epoch !== this.epoch) return;
      this.install(doc, images);
    } catch (e) { if (epoch === this.epoch) { this.status(e.message); this.error(e.message); } }
  }
  clear() {
    for (const m of this.meshes?.values() ?? []) { m.geometry.dispose(); m.material.uniforms.map.value.dispose(); m.material.dispose(); }
    this.meshes = new Map(); this.scene = null; this.doc = null; this.dirty.clear(); this.selected = null; this.hidden.clear();
    $('#nine-axis-tree').replaceChildren(); $('#nine-axis-controls').hidden = true; this.overlay.replaceChildren(); this.renderer?.clear();
  }
  status(text) { $('#nine-axis-status').textContent = text; }
  install(doc, images) {
    if (!this.renderer) { this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, premultipliedAlpha: true, antialias: true }); this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; }
    this.doc = doc; this.scene = new THREE.Scene(); this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1);
    doc.parts.forEach((p, order) => {
      const [tx, ty, tw, th] = p.textureBounds, uvSource = refine(lattice(p), p.cols, p.rows, SUB), uv = new Float32Array(uvSource.length);
      for (let i = 0; i < uv.length; i += 2) { uv[i] = (uvSource[i] - tx) / tw; uv[i + 1] = (uvSource[i + 1] - ty) / th; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(uv.length / 2 * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(meshIndices(p.cols * SUB, p.rows * SUB), 1));
      const t = new THREE.Texture(images[order]); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = true;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { map: { value: t }, dim: { value: 1 } }, vertexShader, fragmentShader,
        transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, premultipliedAlpha: true }));
      m.renderOrder = order; m.frustumCulled = false; this.scene.add(m); this.meshes.set(p.id, m);
    });
    const ax = doc.parameters?.find(q => q.id === 'ParamAngleX') ?? { min: -30, max: 30, keys: [-30, 0, 30] };
    for (const el of [$('#nine-axis-angle'), $('#nine-axis-angle-number')]) { el.min = ax.min; el.max = ax.max; }
    $('#nine-axis-keys').replaceChildren(...ax.keys.map(k => { const b = document.createElement('button'); b.textContent = (k > 0 ? '+' : '') + k; b.dataset.key = k; b.onclick = () => this.setValue(k); return b; }));
    $('#nine-axis-other-params').textContent = (doc.parameters ?? []).filter(q => q.id !== 'ParamAngleX').map(q => `${q.name}（${q.id}）${q.status ?? ''}`).join(' · ');
    $('#nine-axis-notes').textContent = doc.notes ?? '';
    $('#nine-axis-controls').hidden = false; this.status(`${doc.parts.length} 个变形器 · 网格 ${doc.parts[0].cols}×${doc.parts[0].rows}`);
    this.fit(); this.buildTree(); this.sync();
  }
  buildTree() {
    const root = $('#nine-axis-tree'), items = [];
    for (const level of deformerTree(this.doc)) {
      const details = document.createElement('details'); details.open = true; details.dataset.level = level.id;
      details.innerHTML = `<summary>${esc(level.name)}</summary>`;
      for (const group of level.groups) {
        const parent = group.parts.length > 1 ? Object.assign(document.createElement('details'), { open: level.id !== 'face' }) : details;
        if (parent !== details) { parent.className = 'nine-group'; parent.innerHTML = `<summary>${esc(short(group.id))}</summary>`; details.append(parent); }
        for (const p of group.parts) {
          const row = document.createElement('div'); row.className = 'nine-part'; row.dataset.part = p.id;
          row.innerHTML = `<input type="checkbox" checked title="显示"><span>${esc(short(p.id))}</span>${p.status ? `<em>${esc(p.status)}</em>` : ''}`;
          row.querySelector('input').onchange = e => { e.target.checked ? this.hidden.delete(p.id) : this.hidden.add(p.id); this.draw(); };
          row.onclick = e => { if (e.target.tagName !== 'INPUT') this.select(p.id); };
          parent.append(row);
        }
      }
      items.push(details);
    }
    root.replaceChildren(...items);
  }
  select(id) { this.selected = this.selected === id ? null : id; this.sync(); }
  setValue(v) { if (!Number.isFinite(v) || !this.doc) return; this.value = Math.round(Math.max(-30, Math.min(30, v)) * 10) / 10; this.sync(); }
  onKey() { const p = this.part(); return p ? keyValues(p).find(k => Math.abs(k - this.value) < 1e-6) : undefined; }
  part() { return this.doc?.parts.find(p => p.id === this.selected); }
  sync() {
    if (!this.doc) return;
    $('#nine-axis-angle').value = this.value; $('#nine-axis-angle-number').value = this.value;
    $('#nine-axis-hud').textContent = `ParamAngleX ${this.value > 0 ? '+' : ''}${this.value.toFixed(1)}`;
    for (const b of document.querySelectorAll('[data-nine-level]')) b.classList.toggle('active', b.dataset.nineLevel === this.level);
    for (const b of $('#nine-axis-keys').children) b.classList.toggle('active', Number(b.dataset.key) === this.value);
    const visible = new Set(levelParts(this.doc, this.level).map(p => p.id));
    for (const row of document.querySelectorAll('.nine-part')) { row.classList.toggle('selected', row.dataset.part === this.selected); row.classList.toggle('outside', !visible.has(row.dataset.part)); row.classList.toggle('edited', this.dirty.has(row.dataset.part)); }
    const p = this.part(), key = this.onKey();
    $('#nine-axis-selection').hidden = !p;
    if (p) {
      $('#nine-axis-selected-name').textContent = p.id;
      $('#nine-axis-selected-info').textContent = `变形器 ${p.cols}×${p.rows} · 关键形 ${keyValues(p).map(k => (k > 0 ? '+' : '') + k).join(' / ')}${p.status ? ' · ' + p.status : ''}`;
      $('#nine-axis-edit-hint').textContent = key === undefined ? '停在关键形上（点上方 −30 / 0 / +30）才能拖动控制点' : `正在编辑关键形 ${key > 0 ? '+' : ''}${key}：拖动控制点，软选择半径内的点随之移动`;
      $('#nine-axis-reset').disabled = key === undefined || !this.original?.has(p.id + '@' + key);
    }
    $('#nine-axis-dirty').hidden = !this.dirty.size; $('#nine-axis-dirty').textContent = `已修改 ${this.dirty.size} 个变形器，只在本次会话内保留`;
    this.draw();
  }
  resize() {
    if (!this.renderer) return;
    const r = this.view.getBoundingClientRect(); if (!r.width || !r.height) return;
    this.renderer.setPixelRatio(devicePixelRatio); this.renderer.setSize(r.width, r.height, false); this.draw();
  }
  fit() { if (!this.doc) return; const v = this.doc.view ?? { x: 0, y: 0, width: this.doc.canvas[0], height: this.doc.canvas[1] }; this.cam = { cx: v.x + v.width / 2, cy: v.y + v.height / 2, span: Math.max(v.width, v.height) }; this.draw(); }
  frame() {
    const r = this.view.getBoundingClientRect(), s = this.cam.span / Math.min(r.width, r.height);
    return { r, s, x0: this.cam.cx - r.width * s / 2, y0: this.cam.cy - r.height * s / 2 };
  }
  draw() {
    if (!this.doc || !this.active || !this.renderer) return;
    const { r, s, x0, y0 } = this.frame(); if (!r.width) return;
    Object.assign(this.camera, { left: x0, right: x0 + r.width * s, top: y0, bottom: y0 + r.height * s }); this.camera.updateProjectionMatrix();
    const visible = new Set(levelParts(this.doc, this.level).map(p => p.id)), sel = this.selected;
    for (const p of this.doc.parts) {
      const m = this.meshes.get(p.id); m.visible = visible.has(p.id) && !this.hidden.has(p.id); if (!m.visible) continue;
      const pts = refine(keyformAt(p, this.value), p.cols, p.rows, SUB), pos = m.geometry.attributes.position.array;
      for (let i = 0, k = 0; i < pts.length; i += 2, k += 3) { pos[k] = pts[i]; pos[k + 1] = pts[i + 1]; }
      m.geometry.attributes.position.needsUpdate = true; m.material.uniforms.dim.value = sel && sel !== p.id && $('#nine-axis-isolate').checked ? .35 : 1;
    }
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(x0, y0, s);
  }
  drawOverlay(x0, y0, s) {
    const p = this.part();
    if (!p || !this.showGrid || !this.meshes.get(p.id)?.visible) { this.overlay.replaceChildren(); return; }
    const pts = keyformAt(p, this.value), X = i => (pts[i * 2] - x0) / s, Y = i => (pts[i * 2 + 1] - y0) / s, c = p.cols + 1;
    let d = '';
    for (let j = 0; j <= p.rows; j++) { d += 'M'; for (let i = 0; i < c; i++) d += `${X(j * c + i).toFixed(1)},${Y(j * c + i).toFixed(1)} `; }
    for (let i = 0; i < c; i++) { d += 'M'; for (let j = 0; j <= p.rows; j++) d += `${X(j * c + i).toFixed(1)},${Y(j * c + i).toFixed(1)} `; }
    const editable = this.onKey() !== undefined, path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); path.setAttribute('class', 'nine-grid');
    const dots = document.createElementNS(NS, 'g'); dots.setAttribute('class', editable ? 'nine-points editable' : 'nine-points');
    for (let i = 0; i < pts.length / 2; i++) { const e = document.createElementNS(NS, 'circle'); e.setAttribute('cx', X(i)); e.setAttribute('cy', Y(i)); e.setAttribute('r', 3); e.dataset.index = i; dots.append(e); }
    this.overlay.replaceChildren(path, dots);
  }
  pointerDown(e) {
    if (!this.doc) return;
    const index = e.target.dataset?.index, key = this.onKey(), p = this.part();
    const { s } = this.frame(), start = [e.clientX, e.clientY];
    this.view.setPointerCapture(e.pointerId);
    let move;
    if (index !== undefined && p && key !== undefined) {
      const name = String(key), from = p.keyforms[name].map(q => [...q]);
      this.original ??= new Map(); if (!this.original.has(p.id + '@' + name)) this.original.set(p.id + '@' + name, from);
      move = ev => { p.keyforms[name] = dragKeyform(from, Number(index), (ev.clientX - start[0]) * s, (ev.clientY - start[1]) * s, this.radius); this.dirty.add(p.id); this.draw(); };
    } else {
      if (index !== undefined) this.error('停在关键形上才能编辑控制点');
      const c = { ...this.cam }; move = ev => { this.cam.cx = c.cx - (ev.clientX - start[0]) * s; this.cam.cy = c.cy - (ev.clientY - start[1]) * s; this.draw(); };
    }
    const up = () => { this.view.removeEventListener('pointermove', move); this.view.removeEventListener('pointerup', up); this.view.removeEventListener('pointercancel', up); this.sync(); };
    this.view.addEventListener('pointermove', move); this.view.addEventListener('pointerup', up); this.view.addEventListener('pointercancel', up);
  }
  wheel(e) {
    if (!this.doc) return; e.preventDefault();
    const { r, s, x0, y0 } = this.frame(), px = x0 + (e.clientX - r.left) * s, py = y0 + (e.clientY - r.top) * s, f = Math.exp(e.deltaY * .0015);
    this.cam.span *= f; this.cam.cx = px + (this.cam.cx - px) * f; this.cam.cy = py + (this.cam.cy - py) * f; this.draw();
  }
  resetKeyform() {
    const p = this.part(), key = this.onKey(); if (!p || key === undefined) return;
    const saved = this.original?.get(p.id + '@' + key); if (saved) p.keyforms[String(key)] = saved.map(q => [...q]);
    this.original?.delete(p.id + '@' + key);
    if (![...(this.original?.keys() ?? [])].some(k => k.startsWith(p.id + '@'))) this.dirty.delete(p.id);
    this.sync();
  }
  swing() { cancelAnimationFrame(this.raf); $('#nine-axis-swing').checked = true; const t0 = performance.now(); const tick = t => { this.setValue(30 * Math.sin((t - t0) / 1000 * Math.PI * .5)); this.raf = requestAnimationFrame(tick); }; this.raf = requestAnimationFrame(tick); }
  stopSwing() { cancelAnimationFrame(this.raf); this.raf = 0; $('#nine-axis-swing').checked = false; }
  activate(on) { if (on === this.active) return; this.active = on; this.view.hidden = !on; if (!on) this.stopSwing(); else requestAnimationFrame(() => this.resize()); }
}
