import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { fromTaskPath, toAgentPath } from '../shared/task-paths.ts';
import { fitWarpToTraces, type FitFeature } from '../shared/nine-axis-fit.js';
import { nodes, evaluatePoints } from '../shared/nine-axis-model.js';
import { compileHead, type HeadInput, type FaceLeft, type Part } from './head.ts';
import { cropUpperBody, type Box } from './turn.ts';
import { angleScale, type AngleScale } from './angles.ts';
import { authorFile, compileContinuation, type AuthoredHead, type PitchStage } from './continuation.ts';

type Curve = { id: string; part: string; source: string; target: string; visibility?: 'visible' | 'occluded'; weight?: number };
type Landmark = Omit<Curve, 'source' | 'target'> & { source: [number, number]; target: [number, number] };
type Trace = { version: 1; space: 'view' | 'canvas'; completion: { part: string; source: string; target: string }; curves: Curve[]; landmarks?: Landmark[] };
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// This tool only derives geometry from the pipeline agent's trace. It never
// supplies an anatomical rig or silently imports a previous character fit.
export function createNineAxisFitTool(directory: string, input: HeadInput, box: Box, scale: AngleScale = angleScale(), continuation?: { stage: PitchStage | 'xy'; upstreamDirectory: string }, paths?: { taskRoot: string; referenceDirectory: string }): FunctionTool {
  const task = paths?.taskRoot ?? dirname(dirname(directory)), author = join(directory, continuation ? authorFile(continuation.stage) : 'face-left.json');
  return { ...toolDefinition('fit_nine_axis'), async execute(value, signal, context) {
    const args = value as { action?: string; trace?: string; id?: string; features?: string[]; revision?: string; smoothness?: number; corner?: string };
    if (!args || !['inspect', 'fit'].includes(args.action ?? '') || typeof args.trace !== 'string') throw Error('action 须为 inspect 或 fit，并提供 trace JSON 路径');
    const xy = continuation?.stage === 'xy';
    if (xy && !['left-up', 'left-down'].includes(args.corner ?? '')) throw Error('xy 阶段 corner 必须为 left-up 或 left-down；右侧由组合形变镜像');
    const reference = xy ? join(directory, `${args.corner}.png`) : paths ? join(paths.referenceDirectory, `${continuation?.stage ?? 'left'}.png`) : join(task, continuation ? `nine-axis/step01_video/${continuation.stage}.png` : 'nine-axis/step01_video/left.png');
    const x = !continuation || xy ? scale.x[0] : 0, y = xy ? (args.corner === 'left-up' ? scale.y[1] : scale.y[0]) : continuation ? (continuation.stage === 'up' ? scale.y[1] : scale.y[0]) : 0;
    const tracePath = fromTaskPath(task, args.trace), text = await readFile(tracePath, 'utf8');
    if (text.length > 1_000_000) throw Error('trace 文件过大');
    const trace = JSON.parse(text) as Trace;
    if (trace.version !== 1 || !['view', 'canvas'].includes(trace.space) || !Array.isArray(trace.curves) || !trace.curves.length || trace.curves.length > 128) throw Error('trace 需要 version:1、space:view/canvas 和 1 至 128 条 curves');
    if (!trace.completion || typeof trace.completion.part !== 'string' || ![trace.completion.source, trace.completion.target].every(d => typeof d === 'string' && d.length < 32000 && /z\s*$/i.test(d))) throw Error('先补全完整脸型：completion 需要 part、source 和 target 两条闭合 SVG path；不能仅凭露出的皮肤边界拟合');
    const ids = new Set<string>(), partIds = new Set<string>();
    const weight = (f: Curve | Landmark) => f.weight ?? (f.visibility === 'occluded' ? 0.03 : 1);
    const check = (f: Curve | Landmark) => {
      if (typeof f.id !== 'string' || !f.id || ids.has(f.id) || typeof f.part !== 'string') throw Error('描线/参考点 id 重复或缺少原画 part');
      if (f.visibility !== undefined && !['visible', 'occluded'].includes(f.visibility)) throw Error(f.id + '：visibility 须为 visible/occluded');
      if (!Number.isFinite(weight(f)) || weight(f) <= 0 || weight(f) > 1000) throw Error(f.id + '：weight 无效');
      ids.add(f.id); partIds.add(f.part);
    };
    for (const f of trace.curves) { check(f); if (![f.source, f.target].every(s => typeof s === 'string' && s.length > 0 && s.length < 32000)) throw Error(f.id + '：source/target 须为 SVG path d'); }
    for (const f of trace.landmarks ?? []) { check(f); if (![f.source, f.target].every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) throw Error(f.id + '：参考点须为 [x,y]'); }
    const original = await readFile(author, 'utf8'), raw = JSON.parse(original) as FaceLeft | AuthoredHead;
    const targetImage = await readFile(reference).catch(error => {
      if (xy && (error as NodeJS.ErrnoException).code === 'ENOENT') throw Error(`xy 阶段缺少 ${args.corner} 的所选参考帧：${reference}；先从对应视频选帧并保存为 ${args.corner}.png`);
      throw error;
    });
    const revisionFor = (authorText: string) => xy ? hash(JSON.stringify({ corner: args.corner, referenceSha256: hash(targetImage), traceSha256: hash(text), authorSha256: hash(authorText) })) : hash(authorText);
    if (args.revision !== undefined && args.revision !== revisionFor(original)) throw Error(xy ? 'corner、所选参考帧、描线或作者数据已变化，请重新 inspect 读取最新 revision' : '作者数据已变化，请读取最新 revision');
    const doc = continuation ? raw as AuthoredHead : { version: 2 as const, kind: 'head-nine-axis' as const, levels: [{ id: 'face', includes: ['face' as const] }], deformers: raw.deformers, parts: raw.parts.toReversed().map(p => ({ level: 'face' as const, ...p })) };
    for (const id of partIds) if (!doc.parts.some(p => p.id === id)) throw Error('描线 part 不存在：' + id);
    if (!doc.parts.some(p => p.id === trace.completion.part)) throw Error('completion.part 不存在');
    const selectedIds = args.features ?? [...ids];
    if (!Array.isArray(selectedIds) || !selectedIds.length || selectedIds.some(id => !ids.has(id))) throw Error('features 须为 trace 中的 id');
    signal.throwIfAborted();
    const browser = await chromium.launch();
    let sampled: { id: string; points: { from: [number, number]; to: [number, number] }[] }[];
    let completionMismatch: { id: string; sourcePixels: number; targetPixels: number }[];
    try {
      const tab = await browser.newPage();
      sampled = await tab.evaluate(curves => curves.map(f => {
        const path = (d: string) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); return p; };
        const from = path(f.source), to = path(f.target), a = from.getTotalLength(), b = to.getTotalLength();
        if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) throw Error(f.id + '：描线路径无效或长度为零');
        const count = Math.max(16, Math.min(128, Math.ceil(Math.max(a, b) / 2)));
        const closed = /z\s*$/i.test(f.source) && /z\s*$/i.test(f.target);
        return { id: f.id, points: Array.from({ length: count }, (_, i) => { const t = i / (closed ? count : count - 1), p = from.getPointAtLength(a * t), q = to.getPointAtLength(b * t); return { from: [p.x, p.y] as [number, number], to: [q.x, q.y] as [number, number] }; }) };
      }), trace.curves);
      completionMismatch = await tab.evaluate(({ completion, sampled }) => {
        const contour = (d: string) => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); const length = p.getTotalLength();
          if (!(length > 0)) throw Error('完整脸型闭合路径无效');
          const count = Math.min(8192, Math.ceil(length * 4)); return Array.from({ length: count }, (_, i) => { const q = p.getPointAtLength(length * i / count); return [q.x, q.y]; });
        };
        const source = contour(completion.source), target = contour(completion.target);
        const distance = (p: number[], line: number[][]) => Math.sqrt(Math.min(...line.map(q => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2)));
        return sampled.map(f => ({ id: f.id, sourcePixels: Math.max(...f.points.map(p => distance(p.from, source))), targetPixels: Math.max(...f.points.map(p => distance(p.to, target))) })).filter(f => f.sourcePixels > 2 || f.targetPixels > 2);
      }, { completion: trace.completion, sampled });
    } finally { await browser.close(); }
    const toCanvas = (p: [number, number]): [number, number] => trace.space === 'view' ? [p[0] + box.x, p[1] + box.y] : p;
    const features: FitFeature[] = [
      ...trace.curves.map(f => ({ id: f.id, part: f.part, visibility: f.visibility, weight: weight(f), samples: sampled.find(s => s.id === f.id)!.points.map(p => ({ from: toCanvas(p.from), to: toCanvas(p.to) })) })),
      ...(trace.landmarks ?? []).map(f => ({ id: f.id, part: f.part, visibility: f.visibility, weight: weight(f), samples: [{ from: toCanvas(f.source), to: toCanvas(f.target) }] })),
    ].filter(f => selectedIds.includes(f.id));
    const destination = context ? join(context.workspace, 'bitmaps') : join(directory, 'observations'); await mkdir(destination, { recursive: true });
    const sourceImage = await cropUpperBody(input.color, box);
    const overlay = (side: 'source' | 'target') => Buffer.from(`<svg width="${box.size * 2}" height="${box.size * 2}" viewBox="${trace.space === 'view' ? `0 0 ${box.size} ${box.size}` : `${box.x} ${box.y} ${box.size} ${box.size}`}">${trace.curves.map(f => `<path d="${esc(f[side])}" fill="none" stroke="${f.visibility === 'occluded' ? '#54c9ff' : '#ff315d'}" stroke-width="0.7"${f.visibility === 'occluded' ? ' stroke-dasharray="3 2"' : ''}/>`).join('')}${(trace.landmarks ?? []).map(f => `<circle cx="${f[side][0]}" cy="${f[side][1]}" r="1.5" fill="#ffeb55"/>`).join('')}</svg>`);
    const panels = await Promise.all(([sourceImage, targetImage] as const).map((image, i) => sharp(image).resize(box.size * 2, box.size * 2).composite([{ input: overlay(i ? 'target' : 'source') }]).png().toBuffer()));
    const viewBox = trace.space === 'view' ? `0 0 ${box.size} ${box.size}` : `${box.x} ${box.y} ${box.size} ${box.size}`;
    const complete = Buffer.from(`<svg width="${box.size * 2}" height="${box.size * 2}" viewBox="${viewBox}"><path d="${esc(trace.completion.target)}" fill="#ffe6d7" stroke="#cf9d91" stroke-width="0.7"/></svg>`);
    const completionImage = await sharp({ create: { width: box.size * 2, height: box.size * 2, channels: 4, background: '#2b2e35' } }).composite([{ input: complete }, { input: overlay('target') }]).png().toBuffer();
    const completedSource = Buffer.from(`<svg width="${box.size * 2}" height="${box.size * 2}" viewBox="${viewBox}"><path d="${esc(trace.completion.source)}" fill="#ffe6d7" stroke="#cf9d91" stroke-width="0.7"/></svg>`);
    const sourceCompletionImage = await sharp({ create: { width: box.size * 2, height: box.size * 2, channels: 4, background: '#2b2e35' } }).composite([{ input: completedSource }, { input: overlay('source') }]).png().toBuffer();
    const completionCheckImage = await sharp({ create: { width: box.size * 4, height: box.size * 2, channels: 4, background: '#2b2e35' } }).composite([{ input: sourceCompletionImage, left: 0, top: 0 }, { input: completionImage, left: box.size * 2, top: 0 }]).png().toBuffer();
    panels.push(completionImage);
    const traceImage = await sharp({ create: { width: box.size * 6, height: box.size * 2, channels: 4, background: '#20242b' } }).composite(panels.map((input, i) => ({ input, left: box.size * 2 * i, top: 0 }))).png().toBuffer();
    const traceCheck = join(destination, `${randomUUID()}-trace.png`); await writeFile(traceCheck, traceImage);
    const completionCheck = join(destination, `${randomUUID()}-completion.png`); await writeFile(completionCheck, completionCheckImage);
    let revision = revisionFor(original), report: unknown;
    if (args.action === 'fit') {
      if (typeof args.id !== 'string') throw Error('fit 需要你选择的变形器或部件 id');
      if (completionMismatch.length) throw Error('描线与完整脸型不一致，未拟合：' + JSON.stringify(completionMismatch) + '。先修正完整脸缘；皮肤与头发的交界不能作为脸外轮廓。');
      const fitted = fitWarpToTraces(doc, { id: args.id, x, y, features, smoothness: args.smoothness });
      const edited = continuation ? { ...raw, deformers: fitted.doc.deformers, parts: fitted.doc.parts } as AuthoredHead : { ...raw, deformers: fitted.doc.deformers, parts: fitted.doc.parts.toReversed() as Part[] } as FaceLeft;
      const built = continuation ? await compileContinuation(directory, continuation.upstreamDirectory, edited as AuthoredHead, continuation.stage, scale) : await compileHead(directory, input, box, edited as FaceLeft, scale, task);
      // Endpoint validity alone cannot prove composed parent/child meshes safe.
      const xs = [scale.x[0], scale.x[0] / 2, 0, scale.x[1] / 2, scale.x[1]];
      // Only this corner and its mirror change. The opposite Y corner may
      // still be an unfitted initial form and must not block independent fitting.
      const poses = xy ? xs.flatMap(a => [0, y / 2, y].map(b => [a, b])) : [...xs.map(a => [a, 0]), ...(continuation ? (continuation.stage === 'up' ? [scale.y[1] / 2, scale.y[1]] : [scale.y[0], scale.y[0] / 2, scale.y[1] / 2, scale.y[1]]).map(a => [0, a]) : [])];
      for (const [angleX, angleY] of poses) for (const n of nodes(built.doc)) {
        const p = evaluatePoints(built.doc, n, angleX, angleY, 4), cols = n.cols * 4, rows = n.rows * 4;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
          for (const [i, j, k] of [[a, b, d], [b, e, d]]) if ((p[j * 2] - p[i * 2]) * (p[k * 2 + 1] - p[i * 2 + 1]) - (p[j * 2 + 1] - p[i * 2 + 1]) * (p[k * 2] - p[i * 2]) <= 1e-6) throw Error(`拟合未保存：${n.id} 在 X=${angleX},Y=${angleY} 的组合网格翻折；检查对应关系或增加局部控制`);
        }
      }
      signal.throwIfAborted();
      if (await readFile(author, 'utf8') !== original || await readFile(tracePath, 'utf8') !== text) throw Error('拟合期间作者数据或描线改变，未保存，请重试');
      if (xy && !(await readFile(reference).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw Error('拟合期间所选参考帧被删除，未保存，请重新选帧并 inspect');
        throw error;
      })).equals(targetImage)) throw Error('拟合期间所选参考帧改变，未保存，请重新 inspect');
      const next = JSON.stringify(edited) + '\n', tmp = author + '.' + randomUUID() + '.tmp'; await writeFile(tmp, next); await rename(tmp, author); revision = revisionFor(next);
      report = { ...fitted.report, ...(xy ? { corner: args.corner } : {}), trace: args.trace, traceSha256: hash(text), referenceSha256: hash(targetImage), visibility: trace.curves.map(f => ({ id: f.id, visibility: f.visibility ?? 'visible' })) };
      await writeFile(join(directory, xy ? `${args.corner}-fit-report.json` : 'fit-report.json'), JSON.stringify(report, null, 2) + '\n');
    }
    return { success: true, contentItems: [
      { type: 'inputText', text: JSON.stringify({ revision, x, y, ...(xy ? { corner: args.corner, referenceSha256: hash(targetImage) } : {}), traceCheck: await toAgentPath(task, traceCheck), completionCheck: await toAgentPath(task, completionCheck), completionMismatch, reference: await toAgentPath(task, reference), space: trace.space, features: features.map(f => ({ id: f.id, samples: f.samples.length, weight: f.weight })), ...(report ? { report } : {}) }) },
      { type: 'inputImage', imageUrl: `data:image/png;base64,${traceImage.toString('base64')}` },
      { type: 'inputImage', imageUrl: `data:image/png;base64,${completionCheckImage.toString('base64')}` },
    ] };
  } };
}
