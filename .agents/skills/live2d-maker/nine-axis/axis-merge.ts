import { createHash, randomUUID } from 'node:crypto';
import { copyFile, link, lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import sharp from 'sharp';
import { fromTaskPath, toTaskPath } from '../shared/task-paths.ts';
import { angleParameter, angleScale, type AngleScale } from './angles.ts';
import type { Built } from './head.ts';
import { checkWarpGeometry, evaluatePoints, keyValues, lattice, nodes, refine, validateHeadNineAxis,
  type HeadNineAxis, type IndependentAxis, type WarpGrid } from '../shared/nine-axis-model.js';

export type AxesDirectories = { left: string; up: string; down: string };
export type AxisMergeManifest = {
  version: 1; kind: 'nine-axis-independent-sources';
  baseline: { sha256: string; exportRecordSha256: string; source: NonNullable<HeadNineAxis['source']> };
  sources: { axis: IndependentAxis; sha256: string; embeddedDocumentSha256: string; file: string }[];
  textures: { texture: string; sha256: string }[];
  checks: { neutral: true; sourceFilesUnchanged: true; samples: { axis: IndependentAxis; angle: number; maxError: number }[] };
};
export type MergedAxes = Built & { manifest: AxisMergeManifest };
type Snapshot = { doc: HeadNineAxis; path: string; sha256: string };
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const same = (a: unknown, b: unknown, label: string) => { if (!isDeepStrictEqual(a, b)) throw new Error(label + ' 不一致'); };
const close = (a: ArrayLike<number>, b: ArrayLike<number>, label: string, tolerance = 1e-5) => {
  if (a.length !== b.length) throw new Error(label + ' 点数不一致');
  let error = 0;
  for (let i = 0; i < a.length; i++) error = Math.max(error, Math.abs(a[i] - b[i]));
  if (!Number.isFinite(error) || error > tolerance) throw new Error(`${label} 偏差 ${error}`);
  return error;
};
async function snapshot(directory: string): Promise<Snapshot> {
  const path = join(directory, 'deformers.json'), bytes = await readFile(path);
  const doc = validateHeadNineAxis(JSON.parse(bytes.toString('utf8')));
  if (doc.axisSources !== undefined) throw new Error(path + '：合并输入须为独立作者，不允许 axisSources');
  return { doc, path, sha256: hash(bytes) };
}
async function destinationPath(path: string): Promise<string> {
  for (let at = path;; at = dirname(at)) {
    try { return resolve(await realpath(at), relative(at, path)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(at) === at) throw error; }
  }
}
async function sourcePath(directory: string, path: string, taskRoot?: string): Promise<string> {
  if (taskRoot) return fromTaskPath(taskRoot, path);
  if (isAbsolute(path)) return path;
  if (path.split(/[\\/]/).includes('..')) throw new Error('原 KRA 路径不能越出任务目录');
  for (let at = resolve(directory);; at = dirname(at)) {
    const candidate = join(at, path);
    if (await stat(candidate).then(s => s.isFile(), () => false)) return candidate;
    if (dirname(at) === at) break;
  }
  throw new Error('找不到共同原 KRA：' + path);
}
function identity(node: WarpGrid, label: string) {
  const rest = lattice(node);
  for (const forms of [node.keyforms, node.keyformsY ?? {}, node.keyformsXY ?? {}])
    for (const points of Object.values(forms)) close(points.flat(), rest, label);
}
function checkDirection(doc: HeadNineAxis, axis: IndependentAxis, scale: AngleScale) {
  const endpoints = axis === 'x' ? scale.x : axis === 'up' ? [scale.y[1]] : [scale.y[0]];
  const keys = new Set(nodes(doc).flatMap(n => keyValues(n, axis === 'x' ? 'x' : 'y')));
  for (const end of endpoints) if (!keys.has(end)) throw new Error(axis + '：缺少单轴端点 ' + end);
  const parameter = doc.parameters?.find(p => p.id === (axis === 'x' ? 'ParamAngleX' : 'ParamAngleY'));
  if (!parameter || !Array.isArray(parameter.keys) || endpoints.some(k => !parameter.keys.includes(k))) throw new Error(axis + '：单轴参数未声明完整端点');
  for (const n of nodes(doc)) {
    const rest = n.keyforms['0'].flat();
    for (const [field, forms] of [['x', n.keyforms], ['y', n.keyformsY ?? {}], ['xy', n.keyformsXY ?? {}]] as const) {
      for (const [key, points] of Object.entries(forms)) {
        const value = Number(key);
        const allowed = field === 'x' ? axis === 'x' : field === 'y' && (axis === 'up' ? value > 0 : axis === 'down' && value < 0);
        if (!allowed) close(points.flat(), rest, `${axis}/${n.id}：非本方向 ${field}=${key} 不能变形`);
        if (field === 'x' && (value < scale.x[0] || value > scale.x[1]) || field === 'y' && (value < scale.y[0] || value > scale.y[1])) throw new Error(axis + '/' + n.id + '：关键形超出共同角度范围');
      }
    }
    checkWarpGeometry(n);
  }
}
function angularSamples(doc: HeadNineAxis, axis: IndependentAxis, scale: AngleScale) {
  const axisKeys = nodes(doc).flatMap(n => keyValues(n, axis === 'x' ? 'x' : 'y'));
  const keys = [...new Set([0, ...(axis === 'x' ? scale.x : axis === 'up' ? [scale.y[1]] : [scale.y[0]]), ...axisKeys])]
    .filter(k => axis === 'x' || (axis === 'up' ? k >= 0 : k <= 0)).sort((a, b) => a - b);
  return [...new Set([...keys, ...keys.slice(1).flatMap((k, i) => [.25, .5, .75].map(t => keys[i] + (k - keys[i]) * t))])].sort((a, b) => a - b);
}

// Program-only composition of immutable independent authors. This deliberately
// creates no anatomical/shared group: root groups belong to the future XY agent.
// export-record.json is the native, static KRA export prepared with the baseline;
// its part count (24 for pink-doll) and per-texture hashes are the authority.
export async function mergeAxes(directory: string, baselineDirectory: string, axesDirectories: AxesDirectories, scale: AngleScale = angleScale(), taskRoot?: string): Promise<MergedAxes> {
  if (![...scale.x, ...scale.y].every(Number.isFinite) || !(scale.x[0] < 0 && scale.x[1] > 0 && scale.y[0] < 0 && scale.y[1] > 0)) throw new Error('合并角度范围须含负/正 X/Y');
  const inputs = [baselineDirectory, axesDirectories.left, axesDirectories.up, axesDirectories.down].map(dir => resolve(dir));
  const output = resolve(directory), canonicalOutput = await destinationPath(output);
  for (const input of inputs) {
    const canonical = await realpath(input);
    // Never write into an author or inside its layers/workspace tree.
    if (output === input || output.startsWith(input + sep) || canonicalOutput === canonical || canonicalOutput.startsWith(canonical + sep)) throw new Error('联合输出目录不能位于任何输入作者目录内');
  }
  const [baseline, ...sources] = await Promise.all(inputs.map(snapshot));
  const axes: IndependentAxis[] = ['x', 'up', 'down'];
  if (baseline.doc.deformers.length) throw new Error('shared-neutral baseline 不能预建 Warp');
  if (!baseline.doc.source?.document || !/^[a-f0-9]{64}$/.test(baseline.doc.source.sha256)) throw new Error('中性输入缺少原 KRA 来源 SHA');
  if (!baseline.doc.canvas || !Number.isFinite(baseline.doc.axis)) throw new Error('中性输入缺少原画布/中轴');
  const exportBytes = await readFile(join(baselineDirectory, 'export-record.json'));
  const record = JSON.parse(exportBytes.toString('utf8'));
  if (record.sourceKraSha256 !== baseline.doc.source.sha256 || !Array.isArray(record.parts)) throw new Error('静止导层记录与原 KRA 不一致');
  same(record.canvas, baseline.doc.canvas, '静止导层画布');
  const kra = await sourcePath(baselineDirectory, record.sourceKra ?? baseline.doc.source.document, taskRoot);
  if (hash(await readFile(kra)) !== baseline.doc.source.sha256) throw new Error('原 KRA 字节 SHA 已改变');
  const exported = new Map<string, any>(record.parts.map((p: any) => [p.id, p]));
  if (exported.size !== record.parts.length || exported.size !== baseline.doc.parts.length) throw new Error('原 KRA 图层集合不完整');
  for (const p of baseline.doc.parts) {
    if (p.parent) throw new Error('中性输入部件不能预挂 Warp：' + p.id);
    identity(p, '中性原形 ' + p.id);
    const original = exported.get(p.id);
    if (!original || !/^[a-f0-9]{64}$/.test(original.sha256)) throw new Error('原 KRA 图层缺少贴图 SHA：' + p.id);
    for (const k of ['texture', 'textureBounds', 'bbox', 'cols', 'rows']) same((p as any)[k], original[k], '原 KRA ' + p.id + '/' + k);
  }
  for (const [i, s] of sources.entries()) {
    for (const k of ['source', 'canvas', 'axis', 'view', 'levels'] as const) same(s.doc[k], baseline.doc[k], axes[i] + '/' + k);
    same(s.doc.parts.map(p => p.id), baseline.doc.parts.map(p => p.id), axes[i] + '：原图层顺序');
    checkDirection(s.doc, axes[i], scale);
    for (const p of s.doc.parts) {
      const base = baseline.doc.parts.find(n => n.id === p.id)!;
      for (const k of ['texture', 'textureBounds', 'bbox', 'cols', 'rows', 'level', 'role', 'clip'] as const) same(p[k], base[k], axes[i] + '/' + p.id + '/' + k);
      close(p.keyforms['0'].flat(), base.keyforms['0'].flat(), axes[i] + '/' + p.id + ' 原形');
      close(evaluatePoints(s.doc, p, 0, 0, 4), refine(lattice(base), base.cols, base.rows, 4), axes[i] + '/' + p.id + ' 父链中性姿态');
    }
  }
  const textureHashes = new Map<string, string>();
  for (const p of baseline.doc.parts) {
    const bytes = await readFile(join(baselineDirectory, p.texture)), sha256 = hash(bytes);
    if (sha256 !== exported.get(p.id).sha256) throw new Error(p.id + '：中性贴图不是原 KRA 静止导出字节');
    const meta = await sharp(bytes).metadata();
    if (meta.width !== p.textureBounds[2] || meta.height !== p.textureBounds[3]) throw new Error(p.id + '：原贴图尺寸不一致');
    textureHashes.set(p.texture, sha256);
    for (const [i, dir] of inputs.slice(1).entries()) if (hash(await readFile(join(dir, p.texture))) !== sha256) throw new Error(axes[i] + '/' + p.id + '：原贴图字节改变');
  }
  const doc = structuredClone(baseline.doc);
  // Retain baseline presentation/UV, remove stale author-specific metadata.
  delete (doc as any).authoring;
  doc.deformers = [];
  doc.parts = doc.parts.map(p => {
    const rest = p.keyforms['0'];
    delete p.parent; delete p.status; delete p.parameterInterpolation;
    p.keyforms = Object.fromEntries([scale.x[0], 0, scale.x[1]].map(k => [String(k), structuredClone(rest)]));
    p.keyformsY = Object.fromEntries([scale.y[0], 0, scale.y[1]].map(k => [String(k), structuredClone(rest)]));
    p.keyformsXY = Object.fromEntries(scale.x.flatMap(x => scale.y.map(y => [`${x},${y}`, structuredClone(rest)])));
    return p;
  });
  doc.parameters = [angleParameter('ParamAngleX', '角度 X', scale.x), angleParameter('ParamAngleY', '角度 Y', scale.y)];
  doc.axisSources = sources.map((s, i) => ({ axis: axes[i], sha256: s.sha256, doc: structuredClone(s.doc) }));
  validateHeadNineAxis(doc);
  const samples: AxisMergeManifest['checks']['samples'] = [];
  for (const [i, s] of sources.entries()) for (const angle of angularSamples(s.doc, axes[i], scale)) {
    const [x, y] = axes[i] === 'x' ? [angle, 0] : [0, angle];
    let maxError = 0;
    for (const p of doc.parts) maxError = Math.max(maxError, close(evaluatePoints(doc, p, x, y, 4), evaluatePoints(s.doc, s.doc.parts.find(q => q.id === p.id)!, x, y, 4), `${axes[i]}/${p.id} 连续函数 ${angle}`));
    samples.push({ axis: axes[i], angle, maxError });
  }
  const manifest: AxisMergeManifest = { version: 1, kind: 'nine-axis-independent-sources',
    baseline: { sha256: baseline.sha256, exportRecordSha256: hash(exportBytes), source: structuredClone(baseline.doc.source) },
    sources: sources.map((s, i) => ({ axis: axes[i], sha256: s.sha256, embeddedDocumentSha256: hash(JSON.stringify(s.doc)), file: taskRoot ? toTaskPath(taskRoot, s.path) : relative(output, s.path).split(sep).join('/') })),
    textures: [...textureHashes].map(([texture, sha256]) => ({ texture, sha256 })),
    checks: { neutral: true, sourceFilesUnchanged: true, samples } };
  // A scheduled parent may already contain the independent author folders.
  // Only new root projection names may be installed; none can be replaced.
  const existing = await lstat(output).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return undefined; });
  if (existing && !existing.isDirectory()) throw new Error('联合输出路径已存在且不是目录：' + output);
  for (const name of ['layers', 'deformers.json', 'axis-sources.json']) if (await lstat(join(output, name)).then(() => true, error => { if (error.code !== 'ENOENT') throw error; return false; })) throw new Error('联合输出产物已存在：' + join(output, name));
  await mkdir(dirname(output), { recursive: true });
  const staging = output + '.' + randomUUID() + '.tmp';
  const installed: string[] = [];
  try {
    await mkdir(join(staging, 'layers'), { recursive: true });
    for (const [texture, sha256] of textureHashes) {
      await copyFile(join(baselineDirectory, texture), join(staging, texture));
      if (hash(await readFile(join(staging, texture))) !== sha256) throw new Error('暂存贴图 SHA 改变：' + texture);
    }
    for (const s of [baseline, ...sources]) if (hash(await readFile(s.path)) !== s.sha256) throw new Error('合并期间独立作者已变化：' + s.path);
    if (hash(await readFile(kra)) !== baseline.doc.source.sha256 || hash(await readFile(join(baselineDirectory, 'export-record.json'))) !== hash(exportBytes)) throw new Error('合并期间中性来源已变化');
    for (const dir of inputs) for (const [texture, sha256] of textureHashes) if (hash(await readFile(join(dir, texture))) !== sha256) throw new Error('合并期间原贴图已变化：' + texture);
    await writeFile(join(staging, 'deformers.json'), JSON.stringify(doc) + '\n', { flag: 'wx' });
    await writeFile(join(staging, 'axis-sources.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    if (!existing) await rename(staging, output);
    else {
      // Reserve the new layers namespace exclusively; rename installs the
      // verified textures. JSON hard links cannot replace a raced-in file.
      const layers = join(output, 'layers'); await mkdir(layers); installed.push(layers);
      await rename(join(staging, 'layers'), layers);
      for (const name of ['axis-sources.json', 'deformers.json']) {
        const path = join(output, name); await link(join(staging, name), path); installed.push(path);
      }
      // deformers.json is the last visible commit point for existing parents.
      await rm(staging, { recursive: true, force: true });
    }
  } catch (error) {
    for (const path of installed.reverse()) await rm(path, { recursive: true, force: true });
    await rm(staging, { recursive: true, force: true }); throw error;
  }
  return { doc, textures: new Map(doc.parts.map(p => [p.texture, join(output, p.texture)])), manifest };
}
