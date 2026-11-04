import { validateHeadNineAxis, keyformAt, keyValues, levelParts, nodes, descendants, evaluatePoints, parentPoint, dragKeyform } from './nine-axis-model.js';
import { HeadNineAxisRenderer, shownParts } from './nine-axis-render.js';
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sign = k => (k > 0 ? '+' : '') + k;
const clipLabel = p => p.clip ? `${p.clip.invert ? '反向裁切' : '裁切'} ← ${p.clip.by.map(id => short(id)).join('、')}` : '';
const short = id => id.replace(/^(face|hair)\//, '').replace(/^features\//, '');
// Only authored keys grant preview directions. Every node must have the Y
// endpoint/corners, including additional local keys the renderer interpolates.
export function nineAxisCapabilities(doc, allowPlane = true) {
  const keys = id => [...new Set(doc.parameters?.find(p => p.id === id && !p.status)?.keys?.filter(Number.isFinite) ?? [0])].sort((a, b) => a - b);
  const all = nodes(doc), form = (n, field, key) => {
    const p = n[field]?.[String(key)];
    return Array.isArray(p) && p.length === (n.cols + 1) * (n.rows + 1) && p.every(q => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite));
  };
  const xKeys = keys('ParamAngleX'), yKeys = keys('ParamAngleY').filter(k => k === 0 || all.every(n => form(n, 'keyformsY', k)));
  const axis = k => ({ keys: [...new Set([0, ...k])].sort((a, b) => a - b), min: Math.min(0, ...k), max: Math.max(0, ...k) });
  const x = axis(xKeys), y = axis(yKeys);
  const cornerKeys = [x.min, x.max].flatMap(a => [y.min, y.max].map(b => `${a},${b}`));
  // Keep neighbouring local keys too: a parameter endpoint may lie between
  // node keys, and the renderer evaluates both neighbours before blending.
  const relevant = (ks, a) => ks.filter((k, i) => k && (k >= a.min && k <= a.max || k < a.min && (ks[i + 1] ?? Infinity) >= a.min || k > a.max && (ks[i - 1] ?? -Infinity) <= a.max));
  const plane = allowPlane && x.min < 0 && x.max > 0 && y.min < 0 && y.max > 0 && all.every(n => {
    const xs = [...new Set([...x.keys.filter(Boolean), ...relevant(keyValues(n), x)])];
    const ys = [...new Set([...y.keys.filter(Boolean), ...relevant(keyValues(n, 'y'), y)])];
    return xs.every(a => ys.every(b => form(n, 'keyformsXY', `${a},${b}`)));
  });
  const region = plane ? 'plane' : y.min < 0 && y.max > 0 ? 'cross' : y.max > 0 ? 'horizontal-plus-positive-y' : y.min < 0 ? 'horizontal-plus-negative-y' : 'horizontal';
  return { x, y, plane, region, cornerKeys: plane ? cornerKeys : [] };
}
export function projectNineAxisAngles(axes, x, y, preferredAxis) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const clamp = (v, a) => Math.max(a.min, Math.min(a.max, v)) || 0;
  x = clamp(x, axes.x); y = clamp(y, axes.y);
  if (!axes.plane && x && y) {
    const normalized = (v, a) => Math.abs(v / (v < 0 ? a.min : a.max));
    const keep = preferredAxis ?? (normalized(x, axes.x) >= normalized(y, axes.y) ? 'x' : 'y');
    if (keep === 'x') y = 0; else x = 0;
  }
  return { x, y };
}
export class HeadNineAxisPanel {
  constructor({ error }) {
    Object.assign(this, { error }); this.epoch = 0; this.value = 0; this.valueY = 0; this.level = 'accessory'; this.selected = null; this.hidden = new Set(); this.shownMasks = new Set();
    this.radius = 40; this.showGrid = true; this.dirty = new Set(); this.active = false;
    this.canvas = $('#nine-axis-canvas'); this.overlay = $('#nine-axis-overlay'); this.view = $('#nine-axis-view');
    $('#nine-axis-angle-number').onchange = e => this.setValue(e.target.valueAsNumber, this.valueY, 'x');
    $('#nine-axis-angle-y-number').onchange = e => this.setValue(this.value, e.target.valueAsNumber, 'y');
    for (const input of [$('#nine-axis-angle-number'), $('#nine-axis-angle-y-number')]) {
      // Stop before typing/pasting begins; unfinished numbers commit on change.
      for (const event of ['focus', 'input']) input.addEventListener(event, () => this.stopSwing());
    }
    this.pad = $('#nine-axis-pad');
    this.pad.addEventListener('pointerdown', e => this.padPointerDown(e));
    this.pad.addEventListener('pointermove', e => this.padPointerMove(e));
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.pad.addEventListener(event, e => {
      if (this.padDrag?.id === e.pointerId) this.endPadDrag();
    });
    this.pad.addEventListener('keydown', e => this.padKeyDown(e));
    for (const event of ['pointerdown', 'keydown', 'click', 'input']) $('#nine-axis-controls').addEventListener(event, e => {
      if (e.target.id !== 'nine-axis-swing' && !e.target.closest('label')?.querySelector('#nine-axis-swing')) this.stopSwing();
    });
    for (const b of document.querySelectorAll('[data-nine-level]')) b.onclick = () => { this.level = b.dataset.nineLevel; this.sync(); };
    $('#nine-axis-swing').onchange = e => e.target.checked ? this.swing() : this.stopSwing();
    $('#nine-axis-grid').onchange = e => { this.showGrid = e.target.checked; this.draw(); };
    $('#nine-axis-radius').oninput = e => { this.radius = e.target.valueAsNumber; $('#nine-axis-radius-value').textContent = this.radius + ' px'; };
    $('#nine-axis-reset').onclick = () => this.resetKeyform();
    $('#nine-axis-restore').onclick = () => this.project && void this.load(this.project, true);
    $('#nine-axis-save').onclick = () => void this.save();
    $('#nine-axis-fit').onclick = () => this.fit();
    this.view.addEventListener('wheel', e => this.wheel(e), { passive: false });
    this.view.addEventListener('pointerdown', e => this.pointerDown(e));
    new ResizeObserver(() => this.resize()).observe(this.view);
  }
  diagnostics() { return { loaded: !!this.doc, value: this.value, valueY: this.valueY, level: this.level, selected: this.selected, edited: [...this.dirty],
    matrix: this.doc ? { region: this.axes.region, x: this.axes.x, y: this.axes.y, completeCorners: this.axes.plane, dragging: !!this.padDrag } : null, swinging: !!this.raf }; }
  async load(project, force = false) {
    const epoch = ++this.epoch, entry = project?.nineAxis;
    this.stopSwing();
    if (!force && entry?.available && this.doc && this.project?.folder === project?.folder && this.project?.nineAxis?.path === entry?.path && this.version === entry?.version) return;
    this.project = project; this.version = entry?.version; this.clear();
    if (!entry?.available) { this.status(project ? `${project.displayName || project.name} 尚无头部九轴数据（${entry?.path ?? 'nine-axis/step02_angles/deformers.json'}）` : '打开含头部九轴数据的项目后预览'); return; }
    this.status('正在读取头部九轴…');
    try {
      const url = path => './studio-artifact?' + new URLSearchParams({ folder: project.folder, path, version: entry.version });
      const r = await fetch(url(entry.path)); if (!r.ok) throw Error('头部九轴数据读取失败');
      const doc = validateHeadNineAxis(await r.json()), base = entry.path.replace(/[^/]+$/, '');
      const images = await Promise.all(doc.parts.map(async p => { const b = await fetch(url(base + p.texture)); if (!b.ok) throw Error(p.id + '：贴图读取失败'); return createImageBitmap(await b.blob(), { premultiplyAlpha: 'none' }); }));
      if (epoch !== this.epoch) return;
      // Source composition belongs to the shared model/renderer. The merge's
      // neutral XY correction grids do not announce a completed corner stage.
      this.install(doc, images, !['x', 'up', 'down', 'y'].includes(entry.stage));
    } catch (e) { if (epoch === this.epoch) { this.status(e.message); this.error(e.message); } }
  }
  clear() {
    this.endPadDrag();
    this.view3?.clear(); this.doc = null; this.original = new Map(); this.dirty.clear(); this.selected = null; this.hidden.clear(); this.shownMasks.clear();
    $('#nine-axis-tree').replaceChildren(); $('#nine-axis-controls').hidden = true; this.overlay.replaceChildren();
  }
  status(text) { $('#nine-axis-status').textContent = text; }
  install(doc, images, allowPlane = true) {
    this.view3 ??= new HeadNineAxisRenderer(this.canvas);
    this.doc = doc; this.view3.install(doc, images);
    this.axes = nineAxisCapabilities(doc, allowPlane);
    const ax = this.axes.x, ay = this.axes.y.min || this.axes.y.max ? this.axes.y : null;
    const keyButton = (k, set) => { const b = document.createElement('button'); b.textContent = (k > 0 ? '+' : '') + k; b.dataset.key = k; b.onclick = set; return b; };
    const configure = (el, axis) => { el.min = axis.min; el.max = axis.max; el.disabled = axis.min === axis.max; };
    configure($('#nine-axis-angle-number'), ax); configure($('#nine-axis-angle-y-number'), this.axes.y);
    $('#nine-axis-keys').replaceChildren(...ax.keys.map(k => keyButton(k, () => this.setValue(k, 0))));
    this.value = 0; this.valueY = 0; $('#nine-axis-y').hidden = !ay;
    if (ay) {
      $('#nine-axis-keys-y').replaceChildren(...ay.keys.map(k => keyButton(k, () => this.setValue(0, k))));
    } else $('#nine-axis-keys-y').replaceChildren();
    $('#nine-axis-xy').hidden = !this.axes.plane;
    $('#nine-axis-keys-xy').replaceChildren(...this.axes.cornerKeys.map(key => {
      const [x, y] = key.split(',').map(Number), b = document.createElement('button');
      b.textContent = (x < 0 ? '左' : '右') + (y > 0 ? '上' : '下'); b.dataset.x = x; b.dataset.y = y;
      b.onclick = () => this.setValue(x, y); return b;
    }));
    this.installPad();
    const shown = new Set(['ParamAngleX', ...(ay ? ['ParamAngleY'] : [])]);
    $('#nine-axis-other-params').textContent = (doc.parameters ?? []).filter(q => !shown.has(q.id)).map(q => `${q.name}（${q.id}）${q.status ?? ''}`).join(' · ');
    $('#nine-axis-notes').textContent = doc.notes ?? '';
    $('#nine-axis-controls').hidden = false; this.status(`${doc.deformers.length} 个组变形器 · ${doc.parts.length} 个部件`);
    this.fit(); this.buildTree(); this.sync();
  }
  buildTree() {
    const all = nodes(this.doc), warps = new Set(this.doc.deformers.map(n => n.id));
    const make = p => {
      const row = document.createElement('div'); row.className = 'nine-part'; row.dataset.part = p.id;
      const tag = [warps.has(p.id) ? '父变形器' : '', p.role === 'mask' ? '蒙版' : '', clipLabel(p)].filter(Boolean).join(' · ');
      row.innerHTML = `<input type="checkbox" ${p.role === 'mask' ? 'title="显示蒙版"' : 'checked title="显示"'}><span>${esc(p.name ?? short(p.id))}</span><em>${esc(tag)}</em>`;
      row.onclick = e => { if (e.target.tagName !== 'INPUT') this.select(p.id); };
      row.querySelector('input').onchange = e => {
        if (p.role === 'mask') e.target.checked ? this.shownMasks.add(p.id) : this.shownMasks.delete(p.id);
        else for (const id of descendants(this.doc, p.id)) e.target.checked ? this.hidden.delete(id) : this.hidden.add(id);
        this.draw();
      };
      const children = all.filter(n => n.parent === p.id);
      if (!children.length) return row;
      const branch = document.createElement('div'); branch.className = 'nine-branch'; branch.append(row);
      const nest = document.createElement('div'); nest.style.marginLeft = '14px'; nest.append(...children.map(make)); branch.append(nest); return branch;
    };
    $('#nine-axis-tree').replaceChildren(...all.filter(n => !n.parent).map(make));
  }
  select(id) { this.selected = this.selected === id ? null : id; this.sync(); }
  setValue(x, y = this.valueY, preferredAxis, automatic = false) {
    if (!automatic) this.stopSwing();
    if (!this.doc) return;
    const point = projectNineAxisAngles(this.axes, x, y, preferredAxis);
    if (point) { this.value = point.x; this.valueY = point.y; }
    this.sync();
  }
  installPad() {
    const a = this.axes;
    this.pad.dataset.region = a.region;
    // CSS shows the plane only after every required corner is authored.
    $('#nine-axis-pad-axis-y').setAttribute('d', `M50 ${a.y.max ? 10 : 50} V${a.y.min ? 90 : 50}`);
    const dots = [];
    const positions = [...a.x.keys.map(x => [x, 0]), ...a.y.keys.filter(Boolean).map(y => [0, y]), ...a.cornerKeys.map(k => k.split(',').map(Number))];
    for (const [x, y] of positions) {
      const dot = document.createElementNS(NS, 'circle'), p = this.padPosition(x, y);
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', 1); dots.push(dot);
    }
    $('#nine-axis-pad-keys').replaceChildren(...dots);
    const directions = { horizontal: '沿横线转头', 'horizontal-plus-positive-y': '沿横线转头，沿上半轴抬头', 'horizontal-plus-negative-y': '沿横线转头，沿下半轴低头', cross: '沿横线转头，沿纵线抬头或低头', plane: '在面板内转头和俯仰' };
    $('#nine-axis-pad-hint').textContent = directions[a.region] + '；方向键调整，Shift 加快，Home 回到正面';
    this.pad.setAttribute('aria-label', '头部角度：' + directions[a.region]);
  }
  padPosition(x, y) {
    const offset = (v, a) => v ? 40 * v / (v < 0 ? -a.min : a.max) : 0;
    return { x: 50 + offset(x, this.axes.x), y: 50 - offset(y, this.axes.y) };
  }
  padCoordinates(e) {
    const r = this.pad.getBoundingClientRect();
    const delta = (p, start, size) => Math.abs(p - start - size / 2) <= 3 ? 0 : (p - start - size / 2) / (size * .4);
    const x = delta(e.clientX, r.left, r.width), y = -delta(e.clientY, r.top, r.height);
    return { x: x * (x < 0 ? -this.axes.x.min : this.axes.x.max), y: y * (y < 0 ? -this.axes.y.min : this.axes.y.max) };
  }
  padPointerDown(e) {
    if (!this.doc || e.button !== 0 || this.padDrag) return;
    e.preventDefault(); e.stopPropagation(); this.stopSwing(); this.pad.focus({ preventScroll: true });
    this.padDrag = { id: e.pointerId, axis: null }; this.pad.setPointerCapture(e.pointerId); this.padPointerMove(e);
  }
  padPointerMove(e) {
    if (!this.padDrag || this.padDrag.id !== e.pointerId) return;
    const p = this.padCoordinates(e), drag = this.padDrag;
    if (!this.axes.plane && !drag.axis) {
      const point = projectNineAxisAngles(this.axes, p.x, p.y);
      if (point.x || point.y) drag.axis = point.y ? 'y' : 'x';
    }
    this.setValue(drag.axis === 'y' ? 0 : p.x, drag.axis === 'x' ? 0 : p.y, drag.axis);
  }
  endPadDrag() {
    const drag = this.padDrag; this.padDrag = null;
    if (drag && this.pad.hasPointerCapture(drag.id)) this.pad.releasePointerCapture(drag.id);
  }
  padKeyDown(e) {
    const step = e.altKey ? .1 : e.shiftKey ? 5 : 1;
    const arrows = { ArrowLeft: [-step, 0, 'x'], ArrowRight: [step, 0, 'x'], ArrowUp: [0, step, 'y'], ArrowDown: [0, -step, 'y'] };
    if (e.key === 'Home') this.setValue(0, 0);
    else if (e.key === 'Escape') { this.stopSwing(); this.endPadDrag(); }
    else if (arrows[e.key]) { const [x, y, axis] = arrows[e.key]; this.setValue(this.value + x, this.valueY + y, axis); }
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  // The keyform being edited: an X key while Y is 0, a Y key while X is 0, or a corner both are on.
  onKey() {
    const p = this.part(); if (!p) return undefined;
    if (/^neck(?:\/|$)/.test(p.id)) return undefined;
    const on = (axis, v) => keyValues(p, axis).find(k => Math.abs(k - v) < 1e-6);
    if (!this.valueY) { const key = on('x', this.value); return key === undefined ? undefined : { forms: p.keyforms, key, label: 'X ' + sign(key) }; }
    if (!this.value) { const key = on('y', this.valueY); return key === undefined ? undefined : { forms: p.keyformsY, key, label: 'Y ' + sign(key) }; }
    const x = on('x', this.value), y = on('y', this.valueY), key = `${x},${y}`;
    return p.keyformsXY?.[key] ? { forms: p.keyformsXY, key, label: `XY ${sign(x)} ${sign(y)}` } : undefined;
  }
  part() { return this.doc && nodes(this.doc).find(p => p.id === this.selected); }
  sync() {
    if (!this.doc) return;
    $('#nine-axis-angle-number').value = this.value;
    $('#nine-axis-angle-y-number').value = this.valueY;
    const handle = this.padPosition(this.value, this.valueY);
    $('#nine-axis-pad-handle').style.left = handle.x + '%'; $('#nine-axis-pad-handle').style.top = handle.y + '%';
    this.pad.setAttribute('aria-label', `头部角度：X ${this.value}，Y ${this.valueY}`);
    const hud = (id, v) => `${id} ${v > 0 ? '+' : ''}${v.toFixed(1)}`;
    $('#nine-axis-hud').textContent = hud('ParamAngleX', this.value) + ($('#nine-axis-y').hidden ? '' : ' · ' + hud('ParamAngleY', this.valueY));
    for (const b of document.querySelectorAll('[data-nine-level]')) b.classList.toggle('active', b.dataset.nineLevel === this.level);
    for (const b of $('#nine-axis-keys').children) b.classList.toggle('active', !this.valueY && Number(b.dataset.key) === this.value);
    for (const b of $('#nine-axis-keys-y').children) b.classList.toggle('active', !this.value && Number(b.dataset.key) === this.valueY);
    for (const b of $('#nine-axis-keys-xy').children) b.classList.toggle('active', Number(b.dataset.x) === this.value && Number(b.dataset.y) === this.valueY);
    const visible = new Set(levelParts(this.doc, this.level).map(p => p.id));
    for (const row of document.querySelectorAll('.nine-part')) { row.classList.toggle('selected', row.dataset.part === this.selected); row.classList.toggle('outside', ![...descendants(this.doc, row.dataset.part)].some(id => visible.has(id))); row.classList.toggle('edited', this.dirty.has(row.dataset.part)); }
    const p = this.part(), key = this.onKey();
    $('#nine-axis-selection').hidden = !p;
    if (p) {
      $('#nine-axis-selected-name').textContent = p.id;
      const ys = (p.keyformsY ? ` · Y ${keyValues(p, 'y').map(sign).join(' / ')}` : '') + (p.keyformsXY ? ` · 斜向 ${Object.keys(p.keyformsXY).length} 角` : '');
      const extra = [p.role === 'mask' ? '蒙版（不绘制，只裁切其他部件）' : '', clipLabel(p), p.status ?? ''].filter(Boolean).map(t => ' · ' + t).join('');
      $('#nine-axis-selected-info').textContent = `变形器 ${p.cols}×${p.rows} · 关键形 X ${keyValues(p).map(sign).join(' / ')}${ys}${extra}`;
      $('#nine-axis-edit-hint').textContent = key === undefined ? /^neck(?:\/|$)/.test(p.id) ? '脖子保持固定；调整脸与它的覆盖衔接' : '停在关键形上（点上方的度数按钮，另一角度为 0；或两个角度都在关键形上的斜向角）才能拖动控制点' : `正在编辑关键形 ${key.label}：拖动控制点，软选择半径内的点随之移动`;
      $('#nine-axis-reset').disabled = key === undefined || !this.original?.has(p.id + '@' + key.label);
    }
    $('#nine-axis-dirty').hidden = !this.dirty.size; $('#nine-axis-dirty').textContent = `已修改 ${this.dirty.size} 个变形器，尚未保存`;
    $('#nine-axis-save').disabled = !this.dirty.size;
    this.draw();
  }
  resize() {
    if (!this.view3) return;
    const r = this.view.getBoundingClientRect(); if (!r.width || !r.height) return;
    this.view3.renderer.setPixelRatio(devicePixelRatio); this.view3.renderer.setSize(r.width, r.height, false); this.draw();
  }
  fit() { if (!this.doc) return; const v = this.doc.view ?? { x: 0, y: 0, width: this.doc.canvas[0], height: this.doc.canvas[1] }; this.cam = { cx: v.x + v.width / 2, cy: v.y + v.height / 2, span: Math.max(v.width, v.height) }; this.draw(); }
  frame() {
    const r = this.view.getBoundingClientRect(), s = this.cam.span / Math.min(r.width, r.height);
    return { r, s, x0: this.cam.cx - r.width * s / 2, y0: this.cam.cy - r.height * s / 2 };
  }
  draw() {
    if (!this.doc || !this.active || !this.view3) return;
    const { r, s, x0, y0 } = this.frame(); if (!r.width) return;
    const sel = this.selected, isolate = $('#nine-axis-isolate').checked, affected = sel ? descendants(this.doc, sel) : new Set();
    const shown = shownParts(this.doc, this.level, { hidden: this.hidden, masks: this.shownMasks, selected: sel });
    this.view3.draw({ x0, y0, width: r.width * s, height: r.height * s }, this.value, this.valueY, shown, p => sel && !affected.has(p.id) && isolate ? .35 : 1);
    this.drawOverlay(x0, y0, s);
  }
  drawOverlay(x0, y0, s) {
    const p = this.part();
    if (!p || !this.showGrid || this.hidden.has(p.id)) { this.overlay.replaceChildren(); return; }
    const pts = evaluatePoints(this.doc, p, this.value, this.valueY), curve = evaluatePoints(this.doc, p, this.value, this.valueY, 5), X = i => (pts[i * 2] - x0) / s, Y = i => (pts[i * 2 + 1] - y0) / s, c = p.cols * 5 + 1, at = i => `${((curve[i * 2] - x0) / s).toFixed(1)},${((curve[i * 2 + 1] - y0) / s).toFixed(1)} `;
    let d = '';
    for (let j = 0; j <= p.rows; j++) { d += 'M'; for (let i = 0; i < c; i++) d += at(j * 5 * c + i); }
    for (let i = 0; i <= p.cols; i++) { d += 'M'; for (let j = 0; j <= p.rows * 5; j++) d += at(j * c + i * 5); }
    const editable = this.onKey() !== undefined, path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); path.setAttribute('class', 'nine-grid');
    const dots = document.createElementNS(NS, 'g'); dots.setAttribute('class', editable ? 'nine-points editable' : 'nine-points');
    for (let i = 0; i < pts.length / 2; i++) { const e = document.createElementNS(NS, 'circle'); e.setAttribute('cx', X(i)); e.setAttribute('cy', Y(i)); e.setAttribute('r', 3); e.dataset.index = i; dots.append(e); }
    this.overlay.replaceChildren(path, dots);
  }
  pointerDown(e) {
    this.stopSwing();
    if (!this.doc) return;
    const index = e.target.dataset?.index, key = this.onKey(), p = this.part();
    const { s } = this.frame(), start = [e.clientX, e.clientY];
    this.view.setPointerCapture(e.pointerId);
    let move;
    if (index !== undefined && p && key !== undefined) {
      const name = String(key.key), from = key.forms[name].map(q => [...q]), id = p.id + '@' + key.label;
      this.original ??= new Map(); if (!this.original.has(id)) this.original.set(id, from);
      const world = from.map(([px, py]) => parentPoint(this.doc, p, this.value, this.valueY, px, py));
      move = ev => { const moved = dragKeyform(world, Number(index), (ev.clientX - start[0]) * s, (ev.clientY - start[1]) * s, this.radius);
        key.forms[name] = moved.map(([px, py]) => parentPoint(this.doc, p, this.value, this.valueY, px, py, true)); this.dirty.add(p.id); this.draw(); };
    } else {
      if (index !== undefined) this.error('停在关键形上才能编辑控制点');
      const c = { ...this.cam }; move = ev => { this.cam.cx = c.cx - (ev.clientX - start[0]) * s; this.cam.cy = c.cy - (ev.clientY - start[1]) * s; this.draw(); };
    }
    const up = () => { this.view.removeEventListener('pointermove', move); this.view.removeEventListener('pointerup', up); this.view.removeEventListener('pointercancel', up); this.sync(); };
    this.view.addEventListener('pointermove', move); this.view.addEventListener('pointerup', up); this.view.addEventListener('pointercancel', up);
  }
  wheel(e) {
    this.stopSwing();
    if (!this.doc) return; e.preventDefault();
    const { r, s, x0, y0 } = this.frame(), px = x0 + (e.clientX - r.left) * s, py = y0 + (e.clientY - r.top) * s, f = Math.exp(e.deltaY * .0015);
    this.cam.span *= f; this.cam.cx = px + (this.cam.cx - px) * f; this.cam.cy = py + (this.cam.cy - py) * f; this.draw();
  }
  resetKeyform() {
    const p = this.part(), key = this.onKey(); if (!p || key === undefined) return;
    const id = p.id + '@' + key.label, saved = this.original?.get(id); if (saved) key.forms[String(key.key)] = saved.map(q => [...q]);
    this.original?.delete(id);
    if (![...(this.original?.keys() ?? [])].some(k => k.startsWith(p.id + '@'))) this.dirty.delete(p.id);
    this.sync();
  }
  async save() {
    if (!this.project || !this.dirty.size) return;
    try {
      validateHeadNineAxis(this.doc);
      const response = await fetch('./api/studio/nine-axis/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        folder: this.project.folder, dir: this.project.dir, path: this.project.nineAxis.path, version: this.version, document: this.doc,
      }) });
      const saved = await response.json(); if (!response.ok) throw Error(saved.error ?? '九轴保存失败');
      this.version = saved.version; this.project.nineAxis.version = saved.version; this.dirty.clear(); this.original.clear(); this.sync(); this.status('九轴变形已保存');
    } catch (error) { this.error(error.message); }
  }
  swing() { cancelAnimationFrame(this.raf); $('#nine-axis-swing').checked = true; const t0 = performance.now(); const tick = t => { const wave = Math.sin((t - t0) / 1000 * Math.PI * .5); this.setValue(wave * (wave < 0 ? -this.axes.x.min : this.axes.x.max), 0, 'x', true); this.raf = requestAnimationFrame(tick); }; this.raf = requestAnimationFrame(tick); }
  stopSwing() { cancelAnimationFrame(this.raf); this.raf = 0; $('#nine-axis-swing').checked = false; }
  activate(on) { if (on === this.active) return; this.active = on; this.view.hidden = !on; if (!on) { this.stopSwing(); this.endPadDrag(); } else requestAnimationFrame(() => this.resize()); }
}
