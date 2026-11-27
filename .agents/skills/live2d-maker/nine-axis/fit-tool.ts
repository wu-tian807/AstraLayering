import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { fromTaskPath, toAgentPath } from '../shared/task-paths.ts';
import { fitWarpToTraces, type FitFeature } from '../shared/nine-axis-fit.js';
import { initializeEditKeyform } from '../shared/nine-axis-edit.js';
import { nodes, descendants, evaluatePoints, keyValues, kraReferences } from '../shared/nine-axis-model.js';
import { compileHead, writeBuilt, type HeadInput, type FaceLeft, type Part } from './head.ts';
import { kraContents } from '../shadow/delivery.ts';
import { cropUpperBody, type Box } from './turn.ts';
import { angleScale, type AngleScale } from './angles.ts';
import { authorFile, compileContinuation, readUpstream, type AuthoredHead, type PitchStage } from './continuation.ts';
import { editableKra, modelDocument } from './source.ts';
import { ownsNode, type OwnershipScope } from './ownership.ts';
import type { MaterialLoader } from './kra-materials.ts';
import { headCornerControlIds } from './head-corners.ts';

type Curve = { id: string; part: string; source: string; target: string; visibility?: 'visible' | 'occluded'; weight?: number };
type Landmark = Omit<Curve, 'source' | 'target'> & { source: [number, number]; target: [number, number] };
type Trace = { version: 1; space: 'view' | 'canvas'; completion?: { part: string; source: string; target: string }; curves?: Curve[]; landmarks?: Landmark[] };
export type HeadFitStage = 'hair' | 'accessories' | 'head-up' | 'head-down' | 'head-xy';
type FitContinuation = { stage: PitchStage | 'xy' | HeadFitStage; upstreamDirectory: string; ownership?: OwnershipScope; materialize?: MaterialLoader };
type FitArgs = { action?: string; trace?: string; id?: string; features?: string[]; revision?: string; smoothness?: number;
  corner?: string; side?: 'left' | 'right'; x?: number; y?: number; reference?: string };
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const corners = ['left-up', 'left-down', 'right-up', 'right-down'];

function headFitPose(stage: HeadFitStage, args: FitArgs, scale: AngleScale): [number, number] {
  const horizontal = stage === 'hair' || stage === 'accessories';
  const side = args.side ?? 'left';
  const corner = stage === 'head-xy' ? args.corner : undefined;
  if (horizontal && side !== 'left' && side !== 'right') throw Error('side 须为 left 或 right');
  if (corner !== undefined && !corners.includes(corner)) throw Error('corner 须为四角之一');
  const [cornerSide, pitch] = corner?.split('-') ?? [];
  const heading = horizontal ? side : cornerSide;
  const x = args.x ?? (heading ? scale.x[heading === 'right' ? 1 : 0] : 0);
  const y = args.y ?? (stage === 'head-up' || pitch === 'up' ? scale.y[1]
    : stage === 'head-down' || pitch === 'down' ? scale.y[0] : 0);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < scale.x[0] || x > scale.x[1] || y < scale.y[0] || y > scale.y[1])
    throw Error('拟合角度超出工程范围');
  if (horizontal && (!x || y !== 0)) throw Error('左右拟合要求非零 X、Y=0');
  if ((stage === 'head-up' && (x !== 0 || y <= 0)) || (stage === 'head-down' && (x !== 0 || y >= 0)))
    throw Error('头部上下只拟合 X=0 的本方向 Y 关键形');
  if (stage === 'head-xy' && (!x || !y)) throw Error('斜角拟合需要非零 X 和 Y，请指定 x/y 或 corner');
  return [x, y];
}

async function headReference(task: string, directory: string, explicit: string | undefined, x: number, y: number) {
  const direction = y > 0 ? 'up' : 'down', suffix = y ? '-' + direction : '';
  const frame = x ? (x > 0 ? 'right' : 'left') + suffix : direction;
  const path = explicit === undefined ? join(directory, frame + '.png') : fromTaskPath(task, explicit);
  const image = await readFile(path).catch(error => {
    if (error.code === 'ENOENT') throw Error(`缺少目标参考图 ${path}，请传入真实的 reference PNG 路径`, { cause: error });
    throw error;
  });
  const format = (await sharp(image).metadata().catch(() => undefined))?.format;
  if (format !== 'png') throw Error(`目标参考图不是有效的 PNG：${path}，请传入真实的 reference PNG 路径`);
  return { path, image, source: explicit === undefined ? 'frame' : 'explicit' };
}

function nearbyKeys(keys: number[], angle: number) {
  const before = keys.findLast(key => key < angle), after = keys.find(key => key > angle);
  return [angle, ...[before, after].flatMap(key => key === undefined ? [] : [key, (key + angle) / 2])];
}

// This tool only derives geometry from the pipeline agent's trace. It never
// supplies an anatomical rig or silently imports a previous character fit.
export function createNineAxisFitTool(directory: string, input: HeadInput, box: Box, scale: AngleScale = angleScale(), continuation?: FitContinuation, paths?: { taskRoot: string; referenceDirectory: string }): FunctionTool {
  const task = paths?.taskRoot ?? dirname(dirname(directory)), author = join(directory, continuation ? authorFile(continuation.stage) : 'face-left.json');
  return { ...toolDefinition('fit_nine_axis'), async execute(value, signal, context) {
    const args = value as FitArgs;
    if (!args || !['inspect', 'fit'].includes(args.action ?? '') || typeof args.trace !== 'string') throw Error('action 须为 inspect 或 fit，并提供 trace JSON 路径');
    const stage = continuation?.stage, xy = stage === 'xy';
    const headStage = stage && stage !== 'up' && stage !== 'down' && stage !== 'xy' ? stage : undefined;
    if (xy && !['left-up', 'left-down'].includes(args.corner ?? '')) throw Error('xy 阶段 corner 必须为 left-up 或 left-down；右侧由组合形变镜像');
    const frameDirectory = paths?.referenceDirectory ?? join(task, headStage === 'head-xy' ? 'nine-axis/step05_frames' : 'nine-axis/step03_frames');
    const reference = xy ? join(paths?.referenceDirectory ?? directory, `${args.corner}.png`)
      : join(frameDirectory, `${stage ?? 'left'}.png`);
    const [x, y] = headStage ? headFitPose(headStage, args, scale) : [
      !continuation || xy ? scale.x[0] : 0,
      xy ? scale.y[args.corner === 'left-up' ? 1 : 0] : continuation ? scale.y[stage === 'up' ? 1 : 0] : 0,
    ];
    if (!headStage && (args.x !== undefined && args.x !== x || args.y !== undefined && args.y !== y)) throw Error('脸部拟合角度由当前方向决定');
    const side = headStage && !y ? x < 0 ? 'left' : 'right' : undefined;
    const tracePath = fromTaskPath(task, args.trace), text = await readFile(tracePath, 'utf8');
    if (text.length > 1_000_000) throw Error('trace 文件过大');
    const trace = JSON.parse(text) as Trace;
    const curves = headStage && trace.curves === undefined ? [] : trace.curves, completion = trace.completion;
    if (trace.version !== 1 || !['view', 'canvas'].includes(trace.space) || !Array.isArray(curves) || curves.length > 128 ||
        !(curves.length || headStage && trace.landmarks?.length)) throw Error(headStage
      ? 'trace 需要 version:1、space:view/canvas，及曲线或参考点，curves 最多 128 条'
      : 'trace 需要 version:1、space:view/canvas 和 1 至 128 条 curves');
    if ((!headStage || completion !== undefined) && (!completion || typeof completion.part !== 'string' ||
        ![completion.source, completion.target].every(d => typeof d === 'string' && d.length < 32000 && /z\s*$/i.test(d)))) throw Error(headStage
      ? 'completion 需要 part、source 和 target 两条闭合 SVG path'
      : '先补全完整脸型：completion 需要 part、source 和 target 两条闭合 SVG path；不能仅凭露出的皮肤边界拟合');
    const ids = new Set<string>(), partIds = new Set<string>();
    const weight = (f: Curve | Landmark) => f.weight ?? (f.visibility === 'occluded' ? 0.03 : 1);
    const check = (f: Curve | Landmark) => {
      if (typeof f.id !== 'string' || !f.id || ids.has(f.id) || typeof f.part !== 'string') throw Error('描线/参考点 id 重复或缺少原画 part');
      if (f.visibility !== undefined && !['visible', 'occluded'].includes(f.visibility)) throw Error(f.id + '：visibility 须为 visible/occluded');
      if (!Number.isFinite(weight(f)) || weight(f) <= 0 || weight(f) > 1000) throw Error(f.id + '：weight 无效');
      ids.add(f.id); partIds.add(f.part);
    };
    for (const f of curves) { check(f); if (![f.source, f.target].every(s => typeof s === 'string' && s.length > 0 && s.length < 32000)) throw Error(f.id + '：source/target 须为 SVG path d'); }
    for (const f of trace.landmarks ?? []) { check(f); if (![f.source, f.target].every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) throw Error(f.id + '：参考点须为 [x,y]'); }
    const original = await readFile(author, 'utf8'), raw = JSON.parse(original) as FaceLeft | AuthoredHead;
    const targetImage = headStage ? undefined : await readFile(reference).catch(error => {
      if (xy && (error as NodeJS.ErrnoException).code === 'ENOENT') throw Error(`xy 阶段缺少 ${args.corner} 的所选参考帧：${reference}；先从对应视频选帧并保存为 ${args.corner}.png`);
      throw error;
    });
    const revisionFor = (authorText: string) => xy && targetImage ? hash(JSON.stringify({ corner: args.corner, referenceSha256: hash(targetImage), traceSha256: hash(text), authorSha256: hash(authorText) })) : hash(authorText);
    if (args.revision !== undefined && args.revision !== revisionFor(original)) throw Error(xy ? 'corner、所选参考帧、描线或作者数据已变化，请重新 inspect 读取最新 revision' : '作者数据已变化，请读取最新 revision');
    const doc = continuation ? raw as AuthoredHead : { version: 2 as const, kind: 'head-nine-axis' as const, levels: [{ id: 'face', includes: ['face' as const] }], deformers: raw.deformers, parts: raw.parts.toReversed().map(p => ({ level: 'face' as const, ...p })) };
    for (const id of partIds) if (!doc.parts.some(p => p.id === id)) throw Error('描线 part 不存在：' + id);
    if (completion && !doc.parts.some(p => p.id === completion.part)) throw Error('completion.part 不存在');
    if (args.action === 'fit' && typeof args.id !== 'string') throw Error('fit 需要你选择的变形器或部件 id');
    const selected = headStage && args.id !== undefined ? nodes(doc).find(n => n.id === args.id) : undefined;
    if (headStage && args.id !== undefined && !selected) throw Error('拟合节点不存在：' + args.id);
    if (selected && continuation?.ownership && !ownsNode(doc, selected, continuation.ownership))
      throw Error(`${continuation.ownership.label}：不能拟合范围外的部件或承载 Warp：${selected.id}`);
    if (selected && continuation?.stage === 'head-xy' &&
        !headCornerControlIds((await readUpstream(continuation.upstreamDirectory)).doc, doc as AuthoredHead).has(selected.id))
      throw Error('请拟合程序准备的斜角修正承载');
    const selectedIds = args.features ?? [...ids];
    if (!Array.isArray(selectedIds) || !selectedIds.length || selectedIds.some(id => !ids.has(id))) throw Error('features 须为 trace 中的 id');
    signal.throwIfAborted();
    const preview = !headStage ? { path: reference, image: targetImage!, source: undefined }
      : args.action === 'inspect' || args.reference !== undefined
        ? await headReference(task, frameDirectory, args.reference, x, y) : undefined;
    let sampled: { id: string; points: { from: [number, number]; to: [number, number] }[] }[] = [];
    let completionMismatch: { id: string; sourcePixels: number; targetPixels: number }[] = [];
    const browser = curves.length || completion ? await chromium.launch() : undefined;
    if (browser) try {
      const tab = await browser.newPage();
      sampled = await tab.evaluate(curves => curves.map(f => {
        const path = (d: string) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); return p; };
        const from = path(f.source), to = path(f.target), a = from.getTotalLength(), b = to.getTotalLength();
        if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) throw Error(f.id + '：描线路径无效或长度为零');
        const count = Math.max(16, Math.min(128, Math.ceil(Math.max(a, b) / 2)));
        const closed = /z\s*$/i.test(f.source) && /z\s*$/i.test(f.target);
        return { id: f.id, points: Array.from({ length: count }, (_, i) => { const t = i / (closed ? count : count - 1), p = from.getPointAtLength(a * t), q = to.getPointAtLength(b * t); return { from: [p.x, p.y] as [number, number], to: [q.x, q.y] as [number, number] }; }) };
      }), curves);
      if (completion) completionMismatch = await tab.evaluate(({ completion, sampled }) => {
        const contour = (d: string) => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); const length = p.getTotalLength();
          if (!(length > 0)) throw Error('完整脸型闭合路径无效');
          const count = Math.min(8192, Math.ceil(length * 4)); return Array.from({ length: count }, (_, i) => { const q = p.getPointAtLength(length * i / count); return [q.x, q.y]; });
        };
        const source = contour(completion.source), target = contour(completion.target);
        const distance = (p: number[], line: number[][]) => Math.sqrt(Math.min(...line.map(q => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2)));
        return sampled.map(f => ({ id: f.id, sourcePixels: Math.max(...f.points.map(p => distance(p.from, source))), targetPixels: Math.max(...f.points.map(p => distance(p.to, target))) })).filter(f => f.sourcePixels > 2 || f.targetPixels > 2);
      }, { completion, sampled });
    } finally { await browser.close(); }
    const toCanvas = (p: [number, number]): [number, number] => trace.space === 'view' ? [p[0] + box.x, p[1] + box.y] : p;
    const features: FitFeature[] = [
      ...curves.map(f => ({ id: f.id, part: f.part, visibility: f.visibility, weight: weight(f), samples: sampled.find(s => s.id === f.id)!.points.map(p => ({ from: toCanvas(p.from), to: toCanvas(p.to) })) })),
      ...(trace.landmarks ?? []).map(f => ({ id: f.id, part: f.part, visibility: f.visibility, weight: weight(f), samples: [{ from: toCanvas(f.source), to: toCanvas(f.target) }] })),
    ].filter(f => selectedIds.includes(f.id));
    const images: { type: 'inputImage'; imageUrl: string }[] = [];
    let inspection: { traceCheck: string; completionCheck?: string; reference: string; referenceSource?: string } | undefined;
    if (preview) {
      const destination = context ? join(context.workspace, 'bitmaps') : join(directory, 'observations');
      await mkdir(destination, { recursive: true });
      const sourceDocument = headStage ? modelDocument(task, raw as AuthoredHead) ?? editableKra(directory) : input.document;
      const sourcePixels = await readFile(sourceDocument).then(bytes => kraContents(bytes).merged, error => {
        if (!headStage && error.code === 'ENOENT') return readFile(input.color);
        throw error;
      });
      const sourceImage = await cropUpperBody(Buffer.from(sourcePixels), box);
      const size = box.size * 2, viewBox = trace.space === 'view' ? `0 0 ${box.size} ${box.size}` : `${box.x} ${box.y} ${box.size} ${box.size}`;
      const overlay = (side: 'source' | 'target') => Buffer.from(`<svg width="${size}" height="${size}" viewBox="${viewBox}">${curves.map(f => `<path d="${esc(f[side])}" fill="none" stroke="${f.visibility === 'occluded' ? '#54c9ff' : '#ff315d'}" stroke-width="0.7"${f.visibility === 'occluded' ? ' stroke-dasharray="3 2"' : ''}/>`).join('')}${(trace.landmarks ?? []).map(f => `<circle cx="${f[side][0]}" cy="${f[side][1]}" r="1.5" fill="#ffeb55"/>`).join('')}</svg>`);
      const panels = await Promise.all([sourceImage, preview.image].map((image, i) =>
        sharp(image).resize(size, size).composite([{ input: overlay(i ? 'target' : 'source') }]).png().toBuffer()));
      const joinPanels = (panels: Buffer[], background: string) => sharp({ create: { width: size * panels.length, height: size, channels: 4, background } })
        .composite(panels.map((input, i) => ({ input, left: size * i, top: 0 }))).png().toBuffer();
      const save = async (name: string, image: Buffer) => {
        const path = join(destination, `${randomUUID()}-${name}.png`);
        await writeFile(path, image);
        return toAgentPath(task, path);
      };
      let completionImage: Buffer | undefined, completionCheck: string | undefined;
      if (completion) {
        const completed = await Promise.all((['source', 'target'] as const).map(side => {
          const contour = Buffer.from(`<svg width="${size}" height="${size}" viewBox="${viewBox}"><path d="${esc(completion[side])}" fill="#ffe6d7" stroke="#cf9d91" stroke-width="0.7"/></svg>`);
          return sharp({ create: { width: size, height: size, channels: 4, background: '#2b2e35' } })
            .composite([{ input: contour }, { input: overlay(side) }]).png().toBuffer();
        }));
        panels.push(completed[1]);
        completionImage = await joinPanels(completed, '#2b2e35');
        completionCheck = await save('completion', completionImage);
      }
      const traceImage = await joinPanels(panels, '#20242b');
      inspection = { traceCheck: await save('trace', traceImage), completionCheck, reference: await toAgentPath(task, preview.path),
        referenceSource: preview.source };
      images.push({ type: 'inputImage', imageUrl: `data:image/png;base64,${traceImage.toString('base64')}` });
      if (completionImage) images.push({ type: 'inputImage', imageUrl: `data:image/png;base64,${completionImage.toString('base64')}` });
    }
    let revision = revisionFor(original), report: unknown, reportPath: string | undefined;
    if (args.action === 'fit' && typeof args.id === 'string') {
      if (completionMismatch.length) throw Error(headStage ? '描线与补全轮廓不一致，未拟合：' + JSON.stringify(completionMismatch)
        : '描线与完整脸型不一致，未拟合：' + JSON.stringify(completionMismatch) + '。先修正完整脸缘；皮肤与头发的交界不能作为脸外轮廓。');
      if (selected) initializeEditKeyform(doc, selected, x, y);
      const fitted = fitWarpToTraces(doc, { id: args.id, x, y, features, smoothness: args.smoothness });
      const edited = continuation ? { ...raw, deformers: fitted.doc.deformers, parts: fitted.doc.parts } as AuthoredHead : { ...raw, deformers: fitted.doc.deformers, parts: fitted.doc.parts.toReversed() as Part[] } as FaceLeft;
      const built = continuation
        ? await compileContinuation(directory, continuation.upstreamDirectory, edited as AuthoredHead, continuation.stage, scale,
          headStage ? continuation.materialize : undefined, headStage ? signal : undefined)
        : await compileHead(directory, input, box, edited as FaceLeft, scale, task);
      // Endpoint validity alone cannot prove composed parent/child meshes safe.
      const xs = [scale.x[0], scale.x[0] / 2, 0, scale.x[1] / 2, scale.x[1]];
      // Only this corner and its mirror change. The opposite Y corner may
      // still be an unfitted initial form and must not block independent fitting.
      const pitchPoses = continuation && !headStage
        ? (continuation.stage === 'up' ? [scale.y[1] / 2, scale.y[1]] : [scale.y[0], scale.y[0] / 2, scale.y[1] / 2, scale.y[1]]).map(a => [0, a])
        : [];
      const affected = headStage ? descendants(built.doc, args.id) : undefined;
      const gridNodes = nodes(built.doc).filter(n => !affected || affected.has(n.id));
      const fittedNode = selected && gridNodes.find(n => n.id === selected.id)!;
      const poses = fittedNode
        ? (x ? nearbyKeys(keyValues(fittedNode), x) : [0]).flatMap(a => (y ? nearbyKeys(keyValues(fittedNode, 'y'), y) : [0]).map(b => [a, b]))
        : xy ? xs.flatMap(a => [0, y / 2, y].map(b => [a, b])) : [...xs.map(a => [a, 0]), ...pitchPoses];
      for (const [angleX, angleY] of poses) for (const n of gridNodes) {
        const p = evaluatePoints(built.doc, n, angleX, angleY, 4), cols = n.cols * 4, rows = n.rows * 4;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
          for (const [i, j, k] of [[a, b, d], [b, e, d]]) if ((p[j * 2] - p[i * 2]) * (p[k * 2 + 1] - p[i * 2 + 1]) - (p[j * 2 + 1] - p[i * 2 + 1]) * (p[k * 2] - p[i * 2]) <= 1e-6) throw Error(`拟合未保存：${n.id} 在 X=${angleX},Y=${angleY} 的组合网格翻折；检查对应关系或增加局部控制`);
        }
      }
      signal.throwIfAborted();
      if (await readFile(author, 'utf8') !== original || await readFile(tracePath, 'utf8') !== text) throw Error('拟合期间作者数据或描线改变，未保存，请重试');
      if (xy && targetImage && !(await readFile(reference).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw Error('拟合期间所选参考帧被删除，未保存，请重新选帧并 inspect');
        throw error;
      })).equals(targetImage)) throw Error('拟合期间所选参考帧改变，未保存，请重新 inspect');
      const next = JSON.stringify(kraReferences(edited)) + '\n', tmp = author + '.' + randomUUID() + '.tmp'; await writeFile(tmp, next); await rename(tmp, author); revision = revisionFor(next);
      await writeBuilt(directory, built);
      report = { ...fitted.report, ...((xy || stage === 'head-xy') && args.corner ? { corner: args.corner } : {}), ...(side ? { side } : {}),
        trace: args.trace, visibility: curves.map(f => ({ id: f.id, visibility: f.visibility ?? 'visible' })) };
      reportPath = join(directory, headStage ? `x${x}-y${y}-${hash(args.id).slice(0, 16)}-fit-report.json` : xy ? `${args.corner}-fit-report.json` : 'fit-report.json');
      await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    }
    return { success: true, contentItems: [
      { type: 'inputText', text: JSON.stringify({ revision, x, y, ...((xy || stage === 'head-xy') && args.corner ? { corner: args.corner } : {}),
        ...(side ? { side } : {}), ...inspection, completionMismatch, space: trace.space,
        features: features.map(f => ({ id: f.id, samples: f.samples.length, weight: f.weight })), ...(report ? { report } : {}),
        ...(headStage && reportPath ? { reportPath: await toAgentPath(task, reportPath) } : {}) }) },
      ...images,
    ] };
  } };
}
