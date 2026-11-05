import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { fromTaskPath, taskRootOf, toAgentPath } from '../shared/task-paths.ts';
import sharp from 'sharp';
import { validateHeadNineAxis, keyformAt, evaluatePoints, nodes, descendants } from '../shared/nine-axis-model.js';
import type { Built } from './head.ts';

// view_nine_axis: the step's current delivery, built as the program will build
// it, drawn by the workbench's own renderer (shared/nine-axis-render.js) in a
// headless browser on the workbench background, so the agent sees what the
// workbench shows at those angles and that level. grid overlays the chosen
// parts' control grids as the workbench's grid toggle does, and returns their
// control points at those angles.

const shared = join(dirname(fileURLToPath(import.meta.url)), '..', 'shared');
const three = dirname(fileURLToPath(import.meta.resolve('three')));
const origin = 'http://nine-axis.local';
const checker = 'background:#2b2e35;background-image:linear-gradient(45deg,#30333a 25%,transparent 25%,transparent 75%,#30333a 75%),linear-gradient(45deg,#30333a 25%,transparent 25%,transparent 75%,#30333a 75%);background-size:24px 24px;background-position:0 0,12px 12px';
const page = (width: number, height: number, overlay: string) => `<!doctype html><html><head><style>html,body{margin:0}#view{position:relative;overflow:hidden;width:${width}px;height:${height}px;${checker}}canvas,svg{position:absolute;inset:0}#reference{position:absolute;display:none}.nine-grid{fill:none;stroke:#6fd1ff;stroke-width:1;opacity:.75}.nine-points circle{fill:#1d3a4a;stroke:#6fd1ff;stroke-width:1}</style>
<script type="importmap">{"imports":{"three":"/three.module.js"}}</script></head><body><div id="view"><img id="reference"/><canvas></canvas>${overlay}</div><script type="module">
import { HeadNineAxisRenderer, shownParts } from '/nine-axis-render.js';
try {
  const { doc, x, y, level, masks, only, hidden, frame } = await (await fetch('/args.json')).json();
  const images = await Promise.all(doc.parts.map(async (p, i) => createImageBitmap(await (await fetch('/texture/' + i)).blob(), { premultiplyAlpha: 'none' })));
  const view = new HeadNineAxisRenderer(document.querySelector('canvas'));
  view.renderer.setPixelRatio(1); view.renderer.setSize(${width}, ${height}, false);
  view.install(doc, images); const shown = shownParts(doc, level, { masks: new Set(masks), hidden: new Set(hidden) });
  view.draw(frame, x, y, only.length ? new Set([...shown].filter(id => only.includes(id))) : shown);
  await new Promise(requestAnimationFrame); window.rendered = 'ok';
} catch (error) { window.rendered = String(error?.message ?? error); }
</script></body></html>`;

type Args = { x?: unknown; y?: unknown; level?: unknown; crop?: unknown; scale?: unknown; masks?: unknown; grid?: unknown; only?: unknown; hidden?: unknown; reference?: unknown };
type Parameter = { id: string; min?: number; max?: number; keys?: number[]; status?: string };

export function createNineAxisViewTool(directory: string, observationDirectory: string, build: () => Promise<Built>): FunctionTool {
  return {
    ...toolDefinition('view_nine_axis'),
    async execute(value, signal, context) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('参数须为对象');
      const args = value as Args, built = await build(), doc = validateHeadNineAxis(structuredClone(built.doc)) as Built['doc'] & {
        parameters?: Parameter[]; levels: { id: string }[]; view?: { x: number; y: number; width: number; height: number }; canvas: [number, number] };
      const angle = (v: unknown, id: string, name: string) => {
        const q = doc.parameters?.find(p => p.id === id && !p.status && (p.keys?.length ?? 0) > 1), n = v ?? 0;
        if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${name} 须为数字`);
        if (!q) { if (n) throw new Error(`本步尚无 ${id}，${name} 只能为 0`); return 0; }
        if (n < q.min! || n > q.max!) throw new Error(`${name} 须在 ${q.min} 至 ${q.max} 之间`);
        return n;
      };
      const x = angle(args.x, 'ParamAngleX', 'x'), y = angle(args.y, 'ParamAngleY', 'y');
      const level = args.level ?? 'accessory', ids = doc.levels.map(l => l.id);
      if (typeof level !== 'string' || (args.level !== undefined && !ids.includes(level))) throw new Error(`level 须为 ${ids.join('、')} 之一`);
      const maskIds = new Set(doc.parts.filter(p => (p as { role?: string }).role === 'mask').map(p => p.id)), masks = args.masks ?? [];
      if (!Array.isArray(masks) || masks.some(m => !maskIds.has(m))) throw new Error(`masks 须为蒙版部件 id：${[...maskIds].join('、') || '本步没有蒙版'}`);
      const v = doc.view ?? { x: 0, y: 0, width: doc.canvas[0], height: doc.canvas[1] }, crop = args.crop ?? [v.x, v.y, v.width, v.height];
      if (!Array.isArray(crop) || crop.length !== 4 || crop.some(n => typeof n !== 'number' || !Number.isFinite(n)) || !(crop[2] > 0 && crop[3] > 0)) throw new Error('crop 须为 [x,y,width,height]，宽高大于零');
      const scale = args.scale ?? 1;
      if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 0.25 || scale > 8) throw new Error('scale 须为 0.25 至 8');
      const [x0, y0, cw, ch] = crop as number[], width = Math.round(cw * scale), height = Math.round(ch * scale);
      if (width < 1 || height < 1 || width * height > 16_000_000) throw new Error('预览过大或过小，请调整选框或 scale');
      const root = context?.root ?? taskRootOf(directory);
      let reference: { path: string; bounds: number[]; bytes: Buffer } | undefined;
      if (args.reference !== undefined) {
        const r = args.reference as { path?: unknown; bounds?: unknown };
        if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.path !== 'string' || !r.path.trim()) throw new Error('reference 须含图片 path');
        const bounds = r.bounds ?? [v.x, v.y, v.width, v.height];
        if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some(n => typeof n !== 'number' || !Number.isFinite(n)) || bounds[2] <= 0 || bounds[3] <= 0) throw new Error('reference.bounds 须为原画布 [x,y,width,height]');
        const path = fromTaskPath(root, r.path), bytes = await readFile(path), metadata = await sharp(bytes).metadata();
        if (!metadata.width || !metadata.height) throw new Error('reference 图片无效');
        reference = { path, bounds, bytes };
      }
      const allNodes = nodes(doc), partIds = new Set(allNodes.map(p => p.id)), gridIds = args.grid ?? [];
      if (!Array.isArray(gridIds) || gridIds.some(g => !partIds.has(g))) throw new Error('grid 须为部件 id 列表');
      const curves = new Map<string, Float32Array>();
      const grids = (gridIds as string[]).map(id => {
        const p = allNodes.find(q => q.id === id)!, pts = evaluatePoints(doc, p, x, y), points: number[][] = [];
        for (let i = 0; i < pts.length; i += 2) points.push([Math.round(pts[i] * 10) / 10, Math.round(pts[i + 1] * 10) / 10]);
        curves.set(id, evaluatePoints(doc, p, x, y, 5));
        const local = keyformAt(p, x, y), localPoints = points.map((_, i) => [local[i * 2], local[i * 2 + 1]]);
        return { id, cols: p.cols, rows: p.rows, points, ...(p.parent ? { parent: p.parent, localPoints } : {}) };
      });
      const selection = (value: unknown, name: string) => {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.some(id => !partIds.has(id))) throw Error(`${name} 须为部件/变形器 id 数组`);
        return [...new Set(value.flatMap(id => [...descendants(doc, id)]))];
      };
      const only = selection(args.only, 'only'), hidden = selection(args.hidden, 'hidden');
      const sx = (v: number) => ((v - x0) * scale).toFixed(1), sy = (v: number) => ((v - y0) * scale).toFixed(1);
      const overlay = grids.length ? `<svg width="${width}" height="${height}">${grids.map(({ id, cols, rows, points }) => {
        const curve = curves.get(id)!, c = cols * 5 + 1, at = (i: number) => `${sx(curve[i * 2])},${sy(curve[i * 2 + 1])}`;
        let d = '';
        for (let j = 0; j <= rows; j++) { d += 'M'; for (let i = 0; i < c; i++) d += at(j * 5 * c + i) + ' '; }
        for (let i = 0; i <= cols; i++) { d += 'M'; for (let j = 0; j <= rows * 5; j++) d += at(j * c + i * 5) + ' '; }
        return `<path class="nine-grid" d="${d}"/><g class="nine-points">${points.map(([px, py]) => `<circle cx="${sx(px)}" cy="${sy(py)}" r="3"/>`).join('')}</g>`;
      }).join('')}</svg>` : '';
      const textures = doc.parts.map(p => built.textures.get(p.texture)!);
      signal.throwIfAborted();
      const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
      let data: Buffer;
      let comparison: Buffer | undefined;
      try {
        const tab = await browser.newPage({ viewport: { width, height } });
        await tab.route(origin + '/**', async route => {
          const path = new URL(route.request().url()).pathname, js = 'text/javascript';
          if (path === '/') return route.fulfill({ contentType: 'text/html', body: page(width, height, overlay) });
          if (path === '/args.json') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ doc, x, y, level, masks, only, hidden, frame: { x0, y0, width: cw, height: ch } }) });
          if (path === '/reference.png' && reference) return route.fulfill({ contentType: 'image/png', body: reference.bytes });
          if (path.startsWith('/texture/')) return route.fulfill({ contentType: 'image/png', body: await readFile(textures[Number(path.slice(9))]) });
          if (path === '/three.module.js' || path === '/three.core.js') return route.fulfill({ contentType: js, body: await readFile(join(three, path)) });
          if (path === '/nine-axis-render.js' || path === '/nine-axis-model.js') return route.fulfill({ contentType: js, body: await readFile(join(shared, path)) });
          return route.fulfill({ status: 404 });
        });
        await tab.goto(origin + '/');
        await tab.waitForFunction(() => (globalThis as { rendered?: string }).rendered, undefined, { timeout: 60_000 });
        const rendered = await tab.evaluate(() => (globalThis as { rendered?: string }).rendered);
        if (rendered !== 'ok') throw new Error('渲染失败：' + rendered);
        data = await tab.locator('#view').screenshot({ type: 'png' });
        if (reference) {
          // Three full-frame views in the same canvas coordinates. No fitting,
          // recentering or feature-based registration is performed here.
          await tab.evaluate(async ({ bounds, crop, scale }) => {
            const ref = document.querySelector<HTMLImageElement>('#reference')!;
            Object.assign(ref.style, { display: 'block', left: (bounds[0] - crop[0]) * scale + 'px', top: (bounds[1] - crop[1]) * scale + 'px', width: bounds[2] * scale + 'px', height: bounds[3] * scale + 'px' });
            ref.src = '/reference.png'; await ref.decode();
            document.querySelectorAll<HTMLElement>('canvas,svg').forEach(el => { el.style.visibility = 'hidden'; });
          }, { bounds: reference.bounds, crop: [x0, y0], scale });
          const target = await tab.locator('#view').screenshot({ type: 'png' });
          await tab.evaluate(() => { const canvas = document.querySelector('canvas')!; canvas.style.visibility = 'visible'; canvas.style.opacity = '0.5'; });
          const blended = await tab.locator('#view').screenshot({ type: 'png' });
          const axis = (doc as { axis?: number }).axis, guideX = axis === undefined ? undefined : (axis - x0) * scale;
          const guide = guideX !== undefined && guideX >= 0 && guideX < width ? `<path d="M ${guideX} 28 V ${height + 28}" stroke="#35c9ff" stroke-dasharray="5 5"/>` : '';
          const labels = Buffer.from(`<svg width="${width * 3}" height="${height + 28}"><g fill="white" font-family="sans-serif" font-size="14"><text x="8" y="19">Reference</text><text x="${width + 8}" y="19">Current X=${x}</text><text x="${width * 2 + 8}" y="19">Overlay 50% / fixed front axis</text></g><g>${[0, width, width * 2].map(offset => `<g transform="translate(${offset},0)">${guide}</g>`).join('')}</g></svg>`);
          comparison = await sharp({ create: { width: width * 3, height: height + 28, channels: 4, background: '#20242b' } }).composite([
            { input: target, left: 0, top: 28 }, { input: data, left: width, top: 28 }, { input: blended, left: width * 2, top: 28 }, { input: labels, left: 0, top: 0 },
          ]).png().toBuffer();
        }
      } finally { await browser.close(); }
      signal.throwIfAborted();
      const destination = context ? join(context.workspace, 'bitmaps') : observationDirectory;
      await mkdir(destination, { recursive: true });
      const savedPath = join(destination, `${randomUUID()}.png`);
      await writeFile(savedPath, data);
      const comparisonPath = comparison ? join(destination, `${randomUUID()}-comparison.png`) : undefined;
      if (comparisonPath) await writeFile(comparisonPath, comparison!);
      return { success: true, contentItems: [
        { type: 'inputText', text: JSON.stringify({ x, y, level: ids.includes(level) ? level : ids[0], crop, scale, width, height, savedPath: await toAgentPath(root, savedPath), ...(grids.length ? { grid: grids } : {}), ...(reference && comparisonPath ? { comparison: { savedPath: await toAgentPath(root, comparisonPath), reference: await toAgentPath(root, reference.path), bounds: reference.bounds, registration: 'none; same canvas coordinates', axis: (doc as { axis?: number }).axis } } : {}) }) },
        { type: 'inputImage', imageUrl: `data:image/png;base64,${data.toString('base64')}` },
        ...(comparison ? [{ type: 'inputImage' as const, imageUrl: `data:image/png;base64,${comparison.toString('base64')}` }] : []),
      ] };
    },
  };
}
