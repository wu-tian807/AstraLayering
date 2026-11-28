import { validateHeadNineAxis, evaluatePoints } from './studio/nine-axis-model.js';
import { HeadNineAxisRenderer, shownParts, createNineAxisBitmap } from './studio/nine-axis-render.js';
import { authoredPreviewPart, nineAxisPreviewModes, nextPreviewSelection } from './studio/nine-axis-preview.js';
import { constrainHeadPoint, headPreviewAngles, headPointerPosition } from './head-motion.js';

async function previewRequest(url, signal, fallback) {
  const response = await fetch(url, { signal });
  if (response.ok) return response;
  const body = await response.json().catch(() => null);
  const reason = typeof body?.error === 'string' && body.error.trim();
  throw Error(reason || fallback);
}

// One read-only thumbnail, using the same project selection and renderer as
// Studio. The workflow's existing refresh supplies new intermediate products.
export class HeadPreview {
  constructor() {
    this.current = { x: 0, y: 0 }; this.target = { x: 0, y: 0 }; this.epoch = 0;
    document.addEventListener('pointermove', event => {
      if (!this.doc || document.hidden || event.pointerType === 'touch') return;
      const pointer = headPointerPosition(event.clientX, event.clientY, innerWidth, innerHeight);
      this.target = constrainHeadPoint(pointer); this.animate();
    }, { passive: true });
    document.addEventListener('pointerleave', () => { this.target = { x: 0, y: 0 }; this.animate(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = null; } else this.animate(); });
  }
  async update(element, folder) {
    if (this.element !== element || this.folder !== folder) {
      if (this.folder !== folder) this.selection = null;
      this.clear(); this.element = element; this.folder = folder;
      if (!element) return;
      this.canvas = element.querySelector('canvas'); this.label = element.querySelector('[data-head-status]');
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(this.canvas);
      element.onclick = event => {
        const button = event.target.closest('[data-head-level]');
        if (button && !button.disabled) this.selectLevel(button.dataset.headLevel);
      };
    }
    if (!element || this.loading) return;
    const epoch = this.epoch, controller = this.loading = new AbortController();
    try {
      const response = await previewRequest('./api/studio/project?' + new URLSearchParams({ folder }), controller.signal, '无法读取任务信息');
      const project = await response.json(), entry = project.nineAxis;
      if (epoch !== this.epoch) return;
      if (!entry?.available) { this.available = false; element.dataset.model = 'pending'; this.selection = nextPreviewSelection(this.selection, []); this.modes = []; this.syncButtons(); this.label.textContent = '等待素材准备生成九轴模型'; return; }
      const version = `${entry.path}:${entry.version}`;
      if (this.version === version) { this.available = true; element.dataset.model = 'available'; this.loadError = false; this.syncButtons(); this.draw(); return; }
      this.label.textContent = '正在读取最新头部…';
      const result = await previewRequest('./api/studio/nine-axis/materials?' + new URLSearchParams({ folder, path: entry.path }), controller.signal, '无法读取九轴模型');
      const material = await result.json(), doc = validateHeadNineAxis(material.doc);
      const readImage = async (index, id) => {
        const texture = await previewRequest(material.textures[index], controller.signal, `无法读取图层 ${id} 的贴图`);
        return createNineAxisBitmap(await texture.blob());
      };
      const [images, staticLayers] = await Promise.all([
        Promise.all(doc.parts.map((part, index) => readImage(index, part.id))),
        Promise.all((material.studioLayers ?? []).map(async (layer, index) => ({ ...layer, image: await readImage(doc.parts.length + index, layer.uuid) }))),
      ]);
      if (epoch !== this.epoch) { images.forEach(image => image.close()); staticLayers.forEach(layer => layer.image.close()); return; }
      this.renderer ??= new HeadNineAxisRenderer(this.canvas);
      this.renderer.clear(); this.images?.forEach(image => image.close()); this.images = images;
      this.renderer.install(doc, images, material.paintStack); this.renderer.setStaticLayers(staticLayers);
      this.doc = doc; this.version = `${entry.path}:${material.version}`;
      const pitchUnlocked=entry.stage==='headPitch'&&this.stage!==entry.stage;
      this.available = true; element.dataset.model = 'available';
      this.stage = entry.stage; this.loadError = false; this.configureMode();
      if(pitchUnlocked)this.selectLevel('accessory');
      this.draw();
    } catch (error) {
      if (epoch !== this.epoch || error.name === 'AbortError') return;
      this.loadError = true;
      this.available = !!this.doc;
      element.dataset.model = this.available ? 'available' : 'pending';
      const message = this.doc ? '九轴预览暂时无法更新。' : '九轴预览暂时无法显示。';
      this.label.textContent = message + error.message;
    }
    finally { if (this.loading === controller) this.loading = null; }
  }
  configureMode() {
    if (!this.doc) return;
    this.modes = nineAxisPreviewModes(this.doc);
    this.selection = nextPreviewSelection(this.selection, this.modes);
    this.level = this.selection.level;
    const mode = this.modes.find(mode => mode.id === this.level);
    this.axes = mode.axes; this.shown = new Set([...shownParts(this.doc, this.level)].filter(id => mode.scope.has(id) && authoredPreviewPart({id})));
    this.syncButtons();
    // Fit this composition, retaining space for its own available endpoints.
    const doc = this.doc, shown = this.shown, bounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const x of [this.axes.x.min, 0, this.axes.x.max]) for (const y of [this.axes.y.min, 0, this.axes.y.max]) {
      if (!this.axes.plane && x && y) continue;
      for (const part of doc.parts.filter(part => shown.has(part.id))) {
        const points = evaluatePoints(doc, part, x, y, 2);
        for (let i = 0; i < points.length; i += 2) {
          bounds[0] = Math.min(bounds[0], points[i]); bounds[1] = Math.min(bounds[1], points[i + 1]);
          bounds[2] = Math.max(bounds[2], points[i]); bounds[3] = Math.max(bounds[3], points[i + 1]);
        }
      }
    }
    this.view = Number.isFinite(bounds[0]) ? { x: bounds[0], y: bounds[1], width: bounds[2] - bounds[0], height: bounds[3] - bounds[1] } : doc.view;
  }
  selectLevel(level) {
    if (!this.modes?.some(mode => mode.id === level && mode.available)) return;
    this.selection = { ...this.selection, level }; this.configureMode(); this.draw();
  }
  syncButtons() {
    for (const button of this.element?.querySelectorAll('[data-head-level]') ?? []) {
      const mode = this.modes?.find(mode => mode.id === button.dataset.headLevel);
      button.disabled = !mode?.available;
      button.classList.toggle('active', !!mode?.available && mode.id === this.selection?.level);
      button.setAttribute('aria-pressed', String(!!mode?.available && mode.id === this.selection?.level));
      button.title = mode?.available ? mode.title : '尚无此组合的制作数据';
    }
    const link = this.element?.querySelector('a[href*="studio?"]');
    if (link && this.level) { const url = new URL(link.href); url.searchParams.set('nineLevel', this.level); link.href = url.href; }
  }
  resize() {
    if (!this.canvas?.isConnected) return;
    this.canvasSize = this.canvas.getBoundingClientRect(); this.draw();
  }
  draw() {
    if (!this.available || !this.doc || !this.element?.isConnected || document.hidden) return;
    const rect = this.canvasSize; if (!rect?.width || !rect.height) return;
    const renderer = this.renderer.renderer;
    const size = `${rect.width}:${rect.height}:${devicePixelRatio}`;
    if (size !== this.size) { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(rect.width, rect.height, false); this.size = size; }
    const view = this.view ?? { x: 0, y: 0, width: this.doc.canvas[0], height: this.doc.canvas[1] };
    const scale = Math.max(view.width, view.height) * 1.12 / Math.min(rect.width, rect.height);
    const angles = headPreviewAngles(this.current, this.axes);
    this.renderer.draw({ x0: view.x + view.width / 2 - rect.width * scale / 2, y0: view.y + view.height / 2 - rect.height * scale / 2,
      width: rect.width * scale, height: rect.height * scale }, angles.x, angles.y, this.shown, undefined, 0, { reuseXY: true });
    this.element.dataset.angleX = angles.x; this.element.dataset.angleY = angles.y;
    this.element.dataset.motionX = this.current.x; this.element.dataset.motionY = this.current.y;
    if (!this.loadError) this.label.textContent = `${this.modes.find(mode => mode.id === this.level).title} · X ${angles.x.toFixed(1)} / Y ${angles.y.toFixed(1)}`;
  }
  animate() {
    if (this.frame || !this.doc || document.hidden) return;
    let last;
    const tick = time => {
      this.frame = null;
      if (!this.doc || document.hidden) return;
      const amount = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1 - Math.exp(-Math.min(time - (last ?? time - 16), 50) / 85);
      last = time;
      this.current = constrainHeadPoint({ x: this.current.x + (this.target.x - this.current.x) * amount, y: this.current.y + (this.target.y - this.current.y) * amount });
      this.draw();
      if (Math.hypot(this.target.x - this.current.x, this.target.y - this.current.y) > .001) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  clear() {
    this.epoch++; this.loading?.abort(); this.loading = null;
    cancelAnimationFrame(this.frame); this.frame = null; this.observer?.disconnect();
    this.renderer?.clear(); this.renderer?.renderer.dispose(); this.renderer = null;
    this.images?.forEach(image => image.close()); this.images = null; this.doc = null; this.version = null; this.canvasSize = this.size = this.view = null;
    this.available = false; this.loadError = false; this.modes = []; this.current = { x: 0, y: 0 }; this.target = { x: 0, y: 0 };
  }
}
