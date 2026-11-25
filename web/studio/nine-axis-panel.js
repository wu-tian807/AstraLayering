import { validateHeadNineAxis, nineAxisCapabilities, headRollLimit, keyformAt, keyValues, levelParts, nodes, descendants, evaluatePoints, parentPoint, dragKeyform } from './nine-axis-model.js';
import { HeadNineAxisRenderer, createNineAxisBitmap } from './nine-axis-render.js';
import { authoredPreviewPart, nineAxisPreviewModes, nextPreviewSelection } from './nine-axis-preview.js';
import { constrainHeadPoint, followHeadPointer, headPointerPosition, headPreviewAngles, headSideLimit } from '../head-motion.js';
import { layerTree } from './layer-model.js';
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sign = k => (k > 0 ? '+' : '') + k;
const clipLabel = p => p.clip ? `${p.clip.invert ? '反向裁切' : '裁切'} ← ${p.clip.by.map(id => short(id)).join('、')}` : '';
const short = id => id.replace(/^(face|hair)\//, '').replace(/^features\//, '');
export { nineAxisCapabilities };
const normalizedAngles = (axes, x, y) => ({
  x: x ? x / (x < 0 ? -axes.x.min : axes.x.max) : 0,
  y: y ? y / (y < 0 ? -axes.y.min : axes.y.max) : 0,
});
export function projectNineAxisAngles(axes, x, y, preferredAxis) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const clamp = (v, a) => Math.max(a.min, Math.min(a.max, v)) || 0;
  x = clamp(x, axes.x); y = clamp(y, axes.y);
  if (axes.plane) return headPreviewAngles(constrainHeadPoint(normalizedAngles(axes, x, y)), axes);
  if (!axes.plane && x && y) {
    const normalized = (v, a) => Math.abs(v / (v < 0 ? a.min : a.max));
    const keep = preferredAxis ?? (normalized(x, axes.x) >= normalized(y, axes.y) ? 'x' : 'y');
    if (keep === 'x') y = 0; else x = 0;
  }
  return { x, y };
}
export class HeadNineAxisPanel {
  constructor({ error, stage, layers, reloadProject }) {
    Object.assign(this, { error, stage, layers, reloadProject }); this.epoch = 0; this.value = 0; this.valueY = 0; this.valueZ = 0; this.level = 'face'; this.selected = null; this.shownMasks = new Set();
    this.radius = 40; this.showGrid = true; this.dirty = new Set(); this.active = false;
    this.rollKeys = new Set();
    this.canvas = stage.canvas; this.overlay = $('#nine-axis-overlay'); this.view = stage.canvas.parentElement;
    this.view3 = new HeadNineAxisRenderer(this.canvas, stage.renderer);
    stage.layerPreview = () => this.present();
    $('#nine-axis-angle-number').onchange = e => this.setValue(e.target.valueAsNumber, this.valueY, 'x');
    $('#nine-axis-angle-y-number').onchange = e => this.setValue(this.value, e.target.valueAsNumber, 'y');
    $('#nine-axis-angle-z').oninput = e => this.setRoll(e.target.valueAsNumber);
    $('#nine-axis-follow').onchange = e => {
      this.following = e.target.checked;
      this.resetPointerFollow();
      this.sync();
    };
    this.pad = $('#nine-axis-pad');
    this.pad.addEventListener('pointerdown', e => this.padPointerDown(e));
    this.pad.addEventListener('pointermove', e => this.padPointerMove(e));
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.pad.addEventListener(event, e => {
      if (this.padDrag?.id === e.pointerId) this.endPadDrag();
    });
    this.pad.addEventListener('keydown', e => this.padKeyDown(e));
    for (const b of document.querySelectorAll('[data-nine-level]')) b.onclick = () => this.selectLevel(b.dataset.nineLevel);
    $('#nine-axis-grid').onchange = e => { this.showGrid = e.target.checked; this.draw(); };
    $('#nine-axis-radius').oninput = e => { this.radius = e.target.valueAsNumber; $('#nine-axis-radius-value').textContent = this.radius + ' px'; };
    $('#nine-axis-reset').onclick = () => this.resetKeyform();
    $('#nine-axis-restore').onclick = () => this.project && void this.load(this.project, true);
    $('#nine-axis-save').onclick = () => void this.save();
    $('#nine-axis-focus-hide').onchange = e => this.layers.setFocus(e.target.checked ? this.focus?.keep : null);
    this.view.addEventListener('pointerdown', e => this.pointerDown(e));
    this.view.addEventListener('pointermove', e => this.trackPointer(e), { passive: true });
    this.view.addEventListener('pointerleave', e => {
      if (!this.following || !this.active || !this.doc || this.viewDrag || e.pointerType === 'touch') return;
      this.resetPointerFollow();
      this.setValue(0, 0);
    });
    document.addEventListener('keydown', e => this.rollKeyDown(e));
    document.addEventListener('keyup', e => this.rollKeyUp(e));
    window.addEventListener('blur', () => this.stopKeyboardRoll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopKeyboardRoll(); });
  }
  diagnostics() { return { loaded: !!this.doc, value: this.value, valueY: this.valueY, valueZ: this.valueZ, level: this.level, selected: this.selected, edited: [...this.dirty],
    focused: !!this.focus, movingCamera: !!this.cameraMove,
    modes: this.modes?.map(({id, available, axes}) => ({id, available, ...axes})),
    matrix: this.doc ? { region: this.axes.region, x: this.axes.x, y: this.axes.y, completeCorners: this.axes.plane, dragging: !!this.padDrag } : null }; }
  async load(project, force = false) {
    const entry = project?.nineAxis;
    if (!force && entry?.available && (this.doc || this.loading) && this.project?.folder === project?.folder &&
        this.project?.nineAxis?.path === entry.path && this.version === entry.version) return;
    const epoch = ++this.epoch;
    if (this.project?.folder !== project?.folder) this.levelSelection = null;
    const pitchUnlocked=entry?.stage==='headPitch'&&this.project?.nineAxis?.stage!==entry.stage;
    this.project = project; this.version = entry?.version; this.clear();
    this.loading = !!entry?.available;
    if (!entry?.available) { this.status(project ? `${project.displayName || project.name} 尚无头部九轴数据（${entry?.path ?? 'nine-axis/step01_preparation/deformers.json'}）` : '打开含头部九轴数据的项目后预览'); return; }
    this.status('正在读取头部九轴…');
    try {
      const r = await fetch('./api/studio/nine-axis/materials?' + new URLSearchParams({ folder: project.folder, path: entry.path, scene: 'studio' })); if (!r.ok) throw Error((await r.json()).error ?? '头部九轴数据读取失败');
      const material = await r.json(), doc = validateHeadNineAxis(material.doc);
      if (!Array.isArray(material.studioLayers)) throw Error('当前工作台服务版本较旧，无法读取共用图层。');
      const readImage = async (index, label) => {
        const b = await fetch(material.textures[index]);
        if (!b.ok) throw Error(label + '：贴图读取失败');
        return b.blob();
      };
      const [images, staticLayers] = await Promise.all([
        Promise.all(doc.parts.map(async (p, index) => createNineAxisBitmap(await readImage(index, p.id)))),
        Promise.all(material.studioLayers.map(async (layer, index) => ({ ...layer,
          image: await createNineAxisBitmap(await readImage(doc.parts.length + index, layer.uuid)) }))),
      ]);
      if (epoch !== this.epoch) {
        for (const image of images) image.close();
        for (const layer of staticLayers) layer.image.close();
        return;
      }
      // Preview availability follows each composition's delivered axes.
      this.install(doc, images, true, staticLayers);
      if(pitchUnlocked&&!new URLSearchParams(location.search).has('nineLevel'))this.selectLevel('accessory');
      this.author = material.author; this.version = material.version;
    } catch (e) { if (epoch === this.epoch) { this.status(e.message); this.error(e.message); } }
    finally { if (epoch === this.epoch) this.loading = false; }
  }
  clear() {
    this.author = null;
    this.resetPointerFollow();
    this.stopKeyboardRoll();
    this.exitFocus(false);
    this.nativeRows = null;
    this.viewDrag?.();
    this.endPadDrag();
    this.view3?.clear(); this.doc = null; this.original = new Map(); this.dirty.clear(); this.selected = null; this.shownMasks.clear();
    $('#nine-axis-tree').replaceChildren(); $('#nine-axis-controls').hidden = true; this.overlay.replaceChildren();
    this.syncFocus(); this.draw();
  }
  status(text) { $('#nine-axis-status').textContent = text; }
  install(doc, images, allowPlane = true, staticLayers = []) {
    this.doc = doc; this.view3.install(doc, images);
    this.view3.setStaticLayers(staticLayers);
    this.projections = staticLayers.filter(layer => layer.projection);
    this.allowPlane = allowPlane;
    this.modes = nineAxisPreviewModes(doc, allowPlane);
    const selection = nextPreviewSelection(this.levelSelection, this.modes);
    const requested = new URLSearchParams(location.search).get('nineLevel');
    if (!this.levelSelection && this.modes.some(mode => mode.id === requested && mode.available)) selection.level = requested;
    this.levelSelection = selection; this.level = selection.level;
    this.value = 0; this.valueY = 0; this.valueZ = 0;
    this.configureLevel();
    $('#nine-axis-notes').textContent = doc.notes ?? '';
    $('#nine-axis-controls').hidden = false; this.status(`${doc.deformers.length} 个组变形器 · ${doc.parts.length} 个部件`);
    this.buildTree(); this.sync(); this.updateLayers();
  }
  selectLevel(level) {
    if (!this.modes?.some(mode => mode.id === level && mode.available)) return;
    this.endPadDrag();
    this.levelSelection = { ...this.levelSelection, level }; this.level = level;
    this.configureLevel(); this.sync(); this.updateLayers();
  }
  configureLevel() {
    this.resetPointerFollow();
    this.mode = this.modes.find(mode => mode.id === this.level); this.axes = this.mode.axes;
    const ax = this.axes.x, ay = this.axes.y.min || this.axes.y.max ? this.axes.y : null;
    const keyButton = (k, set) => { const b = document.createElement('button'); b.textContent = (k > 0 ? '+' : '') + k; b.dataset.key = k; b.onclick = set; return b; };
    const configure = (el, axis) => { el.min = axis.min; el.max = axis.max; el.disabled = axis.min === axis.max; };
    configure($('#nine-axis-angle-number'), ax); configure($('#nine-axis-angle-y-number'), this.axes.y);
    $('#nine-axis-keys').replaceChildren(...ax.keys.map(k => keyButton(k, () => this.setValue(k, 0))));
    $('#nine-axis-y').hidden = !ay;
    if (ay) {
      $('#nine-axis-keys-y').replaceChildren(...ay.keys.map(k => keyButton(k, () => this.setValue(0, k))));
    } else $('#nine-axis-keys-y').replaceChildren();
    this.installPad();
    const roll = headRollLimit(this.doc);
    $('#nine-axis-z').hidden = !roll;
    configure($('#nine-axis-angle-z'), { min: -roll, max: roll });
    const rollKeys = roll ? [-roll, 0, roll] : [];
    $('#nine-axis-keys-z').replaceChildren(...rollKeys.map(k => keyButton(k, () => this.setRoll(k))));
    const shown = new Set(['ParamAngleX', ...(ay ? ['ParamAngleY'] : []), ...(roll ? ['ParamAngleZ'] : [])]);
    $('#nine-axis-other-params').textContent = (this.doc.parameters ?? []).filter(q => !shown.has(q.id)).map(q => `${q.name}（${q.id}）${q.status ?? ''}`).join(' · ');
    const point = projectNineAxisAngles(this.axes, this.value, this.valueY);
    this.value = point.x; this.valueY = point.y;
  }
  buildTree() {
    const all = nodes(this.doc), warps = new Set(this.doc.deformers.map(n => n.id));
    const make = p => {
      const row = document.createElement('div'); row.className = 'nine-part'; row.dataset.part = p.id;
      const tag = [warps.has(p.id) ? '父变形器' : '', p.role === 'mask' ? '蒙版' : '', clipLabel(p)].filter(Boolean).join(' · ');
      row.innerHTML = `${p.role === 'mask' ? '<input type="checkbox" title="预览变形蒙版">' : ''}<span>${esc(p.name ?? short(p.id))}</span><em>${esc(tag)}</em>`;
      row.onclick = e => { if (e.target.tagName !== 'INPUT') this.select(p.id); };
      const mask = row.querySelector('input');
      if (mask) mask.onchange = e => {
        e.target.checked ? this.shownMasks.add(p.id) : this.shownMasks.delete(p.id);
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
  setRoll(value) {
    if (this.changeRoll(value)) this.syncPose();
  }
  changeRoll(value) {
    const limit = headRollLimit(this.doc);
    const next = Math.max(-limit, Math.min(limit, value));
    if (next === this.valueZ) return false;
    this.valueZ = next;
    return true;
  }
  setValue(x, y = this.valueY, preferredAxis) {
    if (!this.doc) return;
    const point = projectNineAxisAngles(this.axes, x, y, preferredAxis);
    if (point) { this.value = point.x; this.valueY = point.y; }
    this.sync();
  }
  trackPointer(e) {
    if (!this.following || !this.active || !this.doc || e.pointerType === 'touch' || e.buttons || this.viewDrag) return;
    const { left, top, width, height } = this.view.getBoundingClientRect();
    if (!width || !height) return;
    const pointer = headPointerPosition(e.clientX - left, e.clientY - top, width, height);
    const target = this.axes.plane ? constrainHeadPoint(pointer) : pointer;
    const { x, y } = headPreviewAngles(target, this.axes);
    if (x === this.value && y === this.valueY) return;
    this.value = x; this.valueY = y;
    this.pointerChanged = true;
    this.schedulePoseFrame();
  }
  resetPointerFollow() {
    this.pointerChanged = false;
    this.cancelIdlePoseFrame();
  }
  rollInputBlocked(target) {
    return !this.active || this.viewDrag || this.padDrag || target?.isContentEditable ||
      target?.closest?.('textarea, select, input:not([type="checkbox"]):not([type="radio"])') || $('dialog[open]');
  }
  rollKeyDown(e) {
    const key = e.key.toLowerCase();
    if (key === 'shift') this.rollFast = true;
    if ((key !== 'a' && key !== 'd') || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey ||
        this.rollInputBlocked(e.target) || !headRollLimit(this.doc)) return;
    e.preventDefault();
    if (e.repeat) return;
    this.rollKeys.add(key);
    this.rollFast = e.shiftKey;
    if (this.rollKeys.size === 1) this.setRoll(this.valueZ + (key === 'a' ? -1 : 1) * (this.rollFast ? 5 : 1));
    this.schedulePoseFrame();
  }
  rollKeyUp(e) {
    const key = e.key.toLowerCase();
    if (key === 'shift') this.rollFast = false;
    if (this.rollKeys.delete(key) && !this.rollKeys.size) this.stopKeyboardRoll();
  }
  schedulePoseFrame() {
    this.poseFrame ??= requestAnimationFrame(time => this.updatePoseFrame(time));
  }
  updatePoseFrame(time) {
    this.poseFrame = undefined;
    const roll = this.valueZ, pointerChanged = this.pointerChanged;
    this.pointerChanged = false;
    if (this.rollKeys.size && (this.rollInputBlocked(document.activeElement) || !headRollLimit(this.doc))) this.stopKeyboardRoll();
    if (this.rollKeys.size) {
      const seconds = Math.min(time - (this.rollTime ?? time), 50) / 1000;
      this.rollTime = time;
      const direction = Number(this.rollKeys.has('d')) - Number(this.rollKeys.has('a'));
      this.changeRoll(roll + direction * seconds * (this.rollFast ? 72 : 36));
    }
    const cameraChanged = this.moveCamera(time);
    if (pointerChanged || roll !== this.valueZ || cameraChanged) this.syncPose();
    if (this.rollKeys.size || this.cameraMove) this.schedulePoseFrame();
  }
  cancelIdlePoseFrame() {
    if (this.rollKeys?.size || this.pointerChanged || this.cameraMove || this.poseFrame === undefined) return;
    cancelAnimationFrame(this.poseFrame);
    this.poseFrame = undefined;
  }
  stopKeyboardRoll() {
    this.rollKeys.clear();
    this.rollTime = undefined;
    this.cancelIdlePoseFrame();
  }
  installPad() {
    const a = this.axes;
    this.pad.dataset.region = a.region;
    const edge = side => Array.from({ length: 41 }, (_, i) => {
      const y = side * (i / 20 - 1);
      return `${50 + side * 40 * headSideLimit(y)},${50 - 40 * y}`;
    });
    $('#nine-axis-pad-plane').setAttribute('d', a.plane ? 'M' + [...edge(-1), ...edge(1)].join(' L') + ' Z' : '');
    // CSS shows the plane once this composition has both complete single axes.
    $('#nine-axis-pad-axis-y').setAttribute('d', `M50 ${a.y.max ? 10 : 50} V${a.y.min ? 90 : 50}`);
    const dots = [];
    const positions = [...a.x.keys.map(x => [x, 0]), ...a.y.keys.filter(Boolean).map(y => [0, y]), ...a.cornerKeys.map(k => k.split(',').map(Number))];
    for (const [x, y] of positions) {
      const dot = document.createElementNS(NS, 'circle'), p = this.padPosition(x, y);
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', 1); dots.push(dot);
    }
    $('#nine-axis-pad-keys').replaceChildren(...dots);
    const directions = { horizontal: '沿横线转头', 'horizontal-plus-positive-y': '沿横线转头，沿上半轴抬头', 'horizontal-plus-negative-y': '沿横线转头，沿下半轴低头', cross: '沿横线转头，沿纵线抬头或低头', plane: '在曲线范围内转头和俯仰，触边后沿边界滑动' };
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
    e.preventDefault(); e.stopPropagation(); this.pad.focus({ preventScroll: true });
    this.padDrag = { id: e.pointerId, axis: null }; this.pad.setPointerCapture(e.pointerId); this.padPointerMove(e);
  }
  padPointerMove(e) {
    if (!this.padDrag || this.padDrag.id !== e.pointerId) return;
    const p = this.padCoordinates(e), drag = this.padDrag;
    if (this.axes.plane) {
      const pointer = normalizedAngles(this.axes, p.x, p.y);
      const point = followHeadPointer(pointer, normalizedAngles(this.axes, this.value, this.valueY), drag.previous);
      drag.previous = pointer;
      const angles = headPreviewAngles(point, this.axes);
      this.setValue(angles.x, angles.y);
      return;
    }
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
    if (e.key === 'Home') { this.valueZ = 0; this.setValue(0, 0); }
    else if (e.key === 'Escape') this.endPadDrag();
    else if (arrows[e.key]) { const [x, y, axis] = arrows[e.key]; this.setValue(this.value + x, this.valueY + y, axis); }
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  // The keyform being edited: an X key while Y is 0, a Y key while X is 0, or a corner both are on.
  onKey() {
    if (this.following || this.valueZ) return undefined;
    const p = this.part(); if (!p) return undefined;
    if (this.mode && !this.mode.scope.has(p.id)) return undefined;
    if (p.id.startsWith('__kra__/')) return undefined;
    if (/^neck(?:\/|$)/.test(p.id)) return undefined;
    const on = (axis, v) => keyValues(p, axis).find(k => Math.abs(k - v) < 1e-6);
    if (!this.valueY) { const key = on('x', this.value); return key === undefined ? undefined : { forms: p.keyforms, key, label: 'X ' + sign(key) }; }
    if (!this.value) { const key = on('y', this.valueY); return key === undefined ? undefined : { forms: p.keyformsY, key, label: 'Y ' + sign(key) }; }
    const x = on('x', this.value), y = on('y', this.valueY), key = `${x},${y}`;
    return p.keyformsXY?.[key] ? { forms: p.keyformsXY, key, label: `XY ${sign(x)} ${sign(y)}` } : undefined;
  }
  part() { return this.doc && nodes(this.doc).find(p => p.id === this.selected); }
  syncPose() {
    if (!this.doc) return;
    this.syncAngles(); this.syncSelection(); this.draw({ reuseXY: true });
  }
  syncAngles() {
    if (!this.doc) return;
    $('#nine-axis-angle-number').value = this.value;
    $('#nine-axis-angle-y-number').value = this.valueY;
    $('#nine-axis-angle-z').value = this.valueZ;
    $('#nine-axis-angle-z-value').value = sign(Number(this.valueZ.toFixed(1))) + '°';
    const handle = this.padPosition(this.value, this.valueY);
    $('#nine-axis-pad-handle').style.left = handle.x + '%'; $('#nine-axis-pad-handle').style.top = handle.y + '%';
    this.pad.setAttribute('aria-label', `头部角度：X ${this.value}，Y ${this.valueY}`);
    const hud = (id, v) => `${id} ${v > 0 ? '+' : ''}${v.toFixed(1)}`;
    $('#nine-axis-hud').textContent = hud('ParamAngleX', this.value) + ($('#nine-axis-y').hidden ? '' : ' · ' + hud('ParamAngleY', this.valueY))
      + ($('#nine-axis-z').hidden ? '' : ' · ' + hud('ParamAngleZ', this.valueZ));
    for (const b of $('#nine-axis-keys').children) b.classList.toggle('active', !this.valueY && Number(b.dataset.key) === this.value);
    for (const b of $('#nine-axis-keys-y').children) b.classList.toggle('active', !this.value && Number(b.dataset.key) === this.valueY);
    for (const b of $('#nine-axis-keys-z').children) {
      const active = Number(b.dataset.key) === this.valueZ;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    }
  }
  syncSelection() {
    const p = this.part(), key = this.onKey();
    $('#nine-axis-selection').hidden = !p;
    if (p) {
      $('#nine-axis-selected-name').textContent = p.id;
      const ys = (p.keyformsY ? ` · Y ${keyValues(p, 'y').map(sign).join(' / ')}` : '') + (p.keyformsXY ? ` · 斜向 ${Object.keys(p.keyformsXY).length} 角` : '');
      const extra = [p.role === 'mask' ? '蒙版（不绘制，只裁切其他部件）' : '', clipLabel(p), p.status ?? ''].filter(Boolean).map(t => ' · ' + t).join('');
      $('#nine-axis-selected-info').textContent = `变形器 ${p.cols}×${p.rows} · 关键形 X ${keyValues(p).map(sign).join(' / ')}${ys}${extra}`;
      $('#nine-axis-edit-hint').textContent = this.following ? '关闭鼠标跟随后可编辑网格' : this.valueZ ? '将角度 Z 归零后可编辑变形网格' : key === undefined ? /^neck(?:\/|$)/.test(p.id) ? '脖子保持固定；调整脸与它的覆盖衔接' : '停在关键形上（点上方的度数按钮，另一角度为 0；或两个角度都在关键形上的斜向角）才能拖动控制点' : `正在编辑关键形 ${key.label}：拖动控制点，软选择半径内的点随之移动`;
      $('#nine-axis-reset').disabled = key === undefined || !this.original?.has(p.id + '@' + key.label);
    }
  }
  sync() {
    if (!this.doc) return;
    this.syncFocus();
    this.syncAngles(); this.syncSelection();
    for (const b of document.querySelectorAll('[data-nine-level]')) {
      const mode = this.modes.find(mode => mode.id === b.dataset.nineLevel);
      b.disabled = !mode?.available;
      b.classList.toggle('active', mode?.available && mode.id === this.level);
      b.setAttribute('aria-pressed', String(!!mode?.available && mode.id === this.level));
      b.title = mode?.available ? mode.title : '尚无此组合的制作数据';
    }
    const visible = new Set(levelParts(this.doc, this.level).map(p => p.id));
    for (const row of document.querySelectorAll('.nine-part')) { row.classList.toggle('selected', row.dataset.part === this.selected); row.classList.toggle('outside', ![...descendants(this.doc, row.dataset.part)].some(id => visible.has(id))); row.classList.toggle('edited', this.dirty.has(row.dataset.part)); }
    $('#nine-axis-dirty').hidden = !this.dirty.size; $('#nine-axis-dirty').textContent = `已修改 ${this.dirty.size} 个变形器，尚未保存`;
    $('#nine-axis-save').disabled = !this.dirty.size;
    this.draw();
  }
  updateLayers() {
    this.syncFocus();
    if (!this.inSharedPreview || !this.doc) return;
    const rows = this.layers.previewLayers();
    const owner = this.layers.owner?.project;
    this.nativeRows = owner?.folder === this.project?.folder && owner?.files?.document?.path === this.doc.source?.document
      ? new Map(layerTree(rows).map(row => [row.uuid || row.id, row])) : null;
    this.draw({ reuseXY: true });
  }
  get canFocus() { return this.active && !!this.doc && !!this.stage.source; }
  syncFocus() {
    const button = $('#fit'), canFocus = this.canFocus;
    button.textContent = canFocus ? (this.focus ? '退出聚焦' : this.selected ? '聚焦选中部件' : '聚焦头部') : '适应';
    if (canFocus) button.setAttribute('aria-pressed', String(!!this.focus));
    else button.removeAttribute('aria-pressed');
    $('#nine-axis-focus-layers').hidden = !canFocus || !this.focus || !this.layers.session;
    $('#nine-axis-focus-hide').checked = !!this.layers.focus;
  }
  toggleFocus() {
    if (!this.canFocus) return;
    if (this.focus) { this.exitFocus(); return; }
    const selected = this.selected ? descendants(this.doc, this.selected) : this.mode.scope;
    const parts = this.doc.parts.filter(part => selected.has(part.id) && (this.selected || authoredPreviewPart(part)));
    const keep = new Set(parts.flatMap(part => [part.uuid, ...(part.clip?.by ?? []).map(id => this.doc.parts.find(p => p.id === id)?.uuid)]).filter(Boolean));
    for (const { uuid, projection } of this.projections ?? []) {
      if (projection.casters.some(id => keep.has(id)) && projection.receivers.some(id => keep.has(id))) keep.add(uuid);
    }
    let rect = this.doc.view ?? { x: 0, y: 0, width: this.doc.canvas[0], height: this.doc.canvas[1] };
    if (this.selected && parts.length) {
      let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
      for (const part of parts) {
        const points = evaluatePoints(this.doc, part, this.value, this.valueY, 1, this.valueZ);
        for (let i = 0; i < points.length; i += 2) {
          x = Math.min(x, points[i]); y = Math.min(y, points[i + 1]);
          right = Math.max(right, points[i]); bottom = Math.max(bottom, points[i + 1]);
        }
      }
      rect = { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
    }
    this.focus = { home: this.cameraMove?.to ?? { zoom: this.stage.zoom, pan: [...this.stage.pan] }, keep };
    this.animateCamera(this.stage.focusCamera(rect));
    this.syncFocus();
  }
  exitFocus(animate = true) {
    const target = this.focus?.home ?? this.cameraMove?.to;
    this.focus = null; this.cameraMove = null;
    if (!target) return;
    if (this.layers.focus) this.layers.setFocus(null);
    if (animate) this.animateCamera(target);
    else { this.stage.zoom = target.zoom; this.stage.pan = target.pan; this.cancelIdlePoseFrame(); }
    this.syncFocus();
  }
  animateCamera(to) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.stage.zoom = to.zoom; this.stage.pan = to.pan; this.draw({ reuseXY: true });
      return;
    }
    this.cameraMove = { from: { zoom: this.stage.zoom, pan: [...this.stage.pan] }, to };
    this.schedulePoseFrame();
  }
  interruptCamera() {
    this.cameraMove = null;
    this.cancelIdlePoseFrame();
  }
  moveCamera(now) {
    const move = this.cameraMove;
    if (!move) return false;
    move.start ??= now;
    const t = Math.min(1, (now - move.start) / 260), ease = t * t * (3 - 2 * t);
    this.stage.zoom = Math.exp(Math.log(move.from.zoom) * (1 - ease) + Math.log(move.to.zoom) * ease);
    this.stage.pan = move.from.pan.map((value, i) => value + (move.to.pan[i] - value) * ease);
    if (t === 1) { this.stage.zoom = move.to.zoom; this.stage.pan = move.to.pan; this.cameraMove = null; }
    return true;
  }
  draw({ reuseXY = false } = {}) {
    if (!this.inSharedPreview) return;
    this.reuseXY = reuseXY;
    this.stage.render();
  }
  present() {
    if (!this.inSharedPreview || !this.doc) return false;
    const frame = this.stage.canvasFrame(), { width } = this.view.getBoundingClientRect();
    if (this.active && width) this.drawOverlay(frame.x0, frame.y0, frame.width / width);
    const reuseXY = this.reuseXY ?? true; this.reuseXY = undefined;
    if (!this.active && !(this.value || this.valueY || this.valueZ || this.layers.focus)) return false;
    const shown = new Set(this.doc.parts.filter(part => part.role === 'mask'
      ? this.active && (part.id === this.selected || this.shownMasks.has(part.id))
      : this.mode.scope.has(part.id) && this.layerVisible(part)).map(part => part.id));
    this.view3.draw(frame, this.value, this.valueY, shown, undefined, this.valueZ, { reuseXY,
      opacity: part => (this.nativeRows?.get(part.uuid)?.opacity ?? (part.shadow?.opacity ?? 1) * 255) / 255,
      deform: part => this.mode.scope.has(part.id) && authoredPreviewPart(part),
      layerState: layer => {
        const row = this.nativeRows?.get(layer.uuid);
        return row ? { visible: row.visible && !row.inheritedHidden, opacity: row.opacity, blend: row.blend } : layer;
      } });
    return true;
  }
  layerVisible(part) {
    const row = this.nativeRows?.get(part.uuid);
    return part.role === 'mask' || !row || (row.visible && !row.inheritedHidden);
  }
  drawOverlay(x0, y0, s) {
    const p = this.part();
    if (!p || this.following || this.valueZ || !this.showGrid || !this.layerVisible(p) || !this.mode.scope.has(p.id)) {
      if (this.overlay.firstChild) this.overlay.replaceChildren();
      return;
    }
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
    if (!this.doc || !this.active || e.button !== 0 || this.viewDrag || e.target.dataset?.index === undefined) return;
    const index = e.target.dataset?.index, key = this.onKey(), p = this.part();
    if (!p || key === undefined) return;
    this.resetPointerFollow();
    e.preventDefault();
    const s = this.stage.canvasFrame().width / this.view.getBoundingClientRect().width, start = [e.clientX, e.clientY];
    this.view.setPointerCapture(e.pointerId);
    const name = String(key.key), from = key.forms[name].map(q => [...q]), id = p.id + '@' + key.label;
    this.original ??= new Map(); if (!this.original.has(id)) this.original.set(id, from);
    const world = from.map(([px, py]) => parentPoint(this.doc, p, this.value, this.valueY, px, py));
    const move = ev => { const moved = dragKeyform(world, Number(index), (ev.clientX - start[0]) * s, (ev.clientY - start[1]) * s, this.radius);
      key.forms[name] = moved.map(([px, py]) => parentPoint(this.doc, p, this.value, this.valueY, px, py, true)); this.dirty.add(p.id); this.draw(); };
    const endEvents = ['pointerup', 'pointercancel', 'lostpointercapture'];
    const up = () => {
      this.view.removeEventListener('pointermove', move);
      for (const event of endEvents) this.view.removeEventListener(event, up);
      this.viewDrag = null;
      if (this.view.hasPointerCapture(e.pointerId)) this.view.releasePointerCapture(e.pointerId);
      this.sync();
    };
    this.viewDrag = up;
    this.view.addEventListener('pointermove', move);
    for (const event of endEvents) this.view.addEventListener(event, up);
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
      const geometry = new Map(nodes(this.doc).map(node => [node.id, node]));
      const apply = node => { const rendered = geometry.get(node.id); return { ...node, keyforms: rendered.keyforms, ...(rendered.keyformsY ? { keyformsY: rendered.keyformsY } : {}), ...(rendered.keyformsXY ? { keyformsXY: rendered.keyformsXY } : {}) }; };
      const document = this.author ? { ...this.author, parts: this.author.parts.map(apply), deformers: this.author.deformers.map(apply) } : this.doc;
      const response = await fetch('./api/studio/nine-axis/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        folder: this.project.folder, dir: this.project.dir, path: this.project.nineAxis.path, version: this.version, document,
      }) });
      const saved = await response.json(); if (!response.ok) throw Error(saved.error ?? '九轴保存失败');
      this.version = saved.version; this.project.nineAxis.version = saved.version; this.dirty.clear(); this.original.clear(); this.sync(); this.status('九轴变形已保存');
    } catch (error) { this.error(error.message); }
  }
  async refresh() {
    if (!this.active || this.loading || this.refreshing || !this.project?.folder || this.dirty.size || this.padDrag || this.viewDrag || this.layers?.pending) return;
    const project = this.project;
    this.refreshing = true;
    try {
      const selected = new URLSearchParams(location.search).get('nineStage');
      const query = new URLSearchParams({ folder: project.folder, ...(selected ? { nineStage: selected } : {}) });
      const response = await fetch('./api/studio/project?' + query);
      if (!response.ok) return;
      const next = await response.json();
      if (this.project !== project || !this.active || this.dirty.size || this.padDrag || this.viewDrag) return;
      const previousKra = this.layers?.owner?.project?.files?.document, nextKra = next.files?.document;
      if (previousKra && nextKra && (previousKra.path !== nextKra.path || previousKra.version !== nextKra.version)) {
        if (this.layers.undo.length || this.focus || this.layers.pending) this.status('KRA 有新版本，已保留当前视图和图层改动');
        else await this.reloadProject(next);
        return;
      }
      if (this.doc && next.nineAxis?.path === project.nineAxis?.path && next.nineAxis?.version === project.nineAxis?.version) return;
      const x = this.value, y = this.valueY, z = this.valueZ ?? 0;
      await this.load(next);
      const limit = headRollLimit(this.doc);
      this.valueZ = Math.max(-limit, Math.min(limit, z));
      this.setValue(x, y);
    } catch (error) { if (this.project === project) this.status('动态预览更新失败：' + error.message); }
    finally { this.refreshing = false; }
  }
  activate(on, inSharedPreview = on) {
    if (on === this.active && inSharedPreview === this.inSharedPreview) return;
    this.active = on; this.inSharedPreview = inSharedPreview;
    $('#nine-axis-view').hidden = !on;
    clearInterval(this.refreshTimer);
    if (!on) {
      this.resetPointerFollow(); this.stopKeyboardRoll(); this.viewDrag?.(); this.endPadDrag();
      this.exitFocus(false);
    } else this.refreshTimer = setInterval(() => void this.refresh(), 4000);
    this.updateLayers(); this.stage.render();
  }
}
