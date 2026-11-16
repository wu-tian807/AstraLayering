import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { angleParameter, angleScale, type AngleScale } from './angles.ts';
import { authorFile, buildContinuation, readUpstream, type AuthoredHead } from './continuation.ts';
import { writeBuilt, type Built } from './head.ts';
import { modelDocument } from './source.ts';
import { ownsNode, type OwnershipScope } from './ownership.ts';
import { initializeKeyforms } from '../shared/nine-axis-edit.js';
import { prepareHeadControls, wholeHeadPart, wholeHeadScope } from './head-controls.ts';
import { nodes, validateHeadNineAxis, checkWarpGeometry, kraReferences, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { toTaskPath } from '../shared/task-paths.ts';
import type { MaterialLoader } from './kra-materials.ts';

export const headPitchDirections = ['up', 'down'] as const;
export type HeadPitchDirection = typeof headPitchDirections[number];
export type HeadPitchStage = 'head-up' | 'head-down';
export const isHeadPitchStage = (stage: string): stage is HeadPitchStage => stage === 'head-up' || stage === 'head-down';
export const headPitchStage = (direction: HeadPitchDirection): HeadPitchStage => direction === 'up' ? 'head-up' : 'head-down';
export const headPitchAngle = (direction: HeadPitchDirection, scale: AngleScale) => scale.y[direction === 'up' ? 1 : 0];
export const headPitchScope: OwnershipScope = { ...wholeHeadScope, label: '头部上下' };
export const headPitchPreviewScope = (direction: HeadPitchDirection) => ({
  includes: headPitchScope.includes!, label: `${direction}：预览本方向上下或已有左右`,
  allowsPose: (x: number, y: number) => y === 0 || x === 0 && (direction === 'up' ? y >= 0 : y <= 0),
});

/** Both authors get the same topology. Identity carriers follow native parents,
 * separating editable head leaves from fixed neck/body leaves when necessary. */
export function initializeHeadPitch(upstream: HeadNineAxis & { axis: number }, stage: HeadPitchStage, scale = angleScale()): AuthoredHead {
  const doc = structuredClone(upstream) as AuthoredHead;
  doc.authoring = { stage };
  const range: [number, number] = stage === 'head-up' ? [0, scale.y[1]] : [scale.y[0], 0];
  doc.parameters = doc.parameters!.map(p => p.id === 'ParamAngleY' ? { ...angleParameter('ParamAngleY', '角度 Y', range), keys: [...new Set([range[0], 0, range[1]])] } : p);
  return prepareHeadControls(doc, 'pitch', '头部上下承载') as AuthoredHead;
}

/** Direction authors change only their Y half-axis on the prepared graph.
 * This lets the program merge exact keyforms without resampling or double motion. */
export function checkHeadPitch(value: unknown, upstream: HeadNineAxis & { axis: number }, stage: HeadPitchStage, scale = angleScale()): AuthoredHead {
  const doc = kraReferences(validateHeadNineAxis(value)) as AuthoredHead, baseline = kraReferences(initializeHeadPitch(upstream, stage, scale));
  const same = (a: unknown, b: unknown, label: string) => { if (!isDeepStrictEqual(a, b)) throw Error(label); };
  same(doc.authoring?.stage, stage, '头部上下作者阶段不匹配');
  for (const field of ['source', 'canvas', 'view', 'axis', 'axisSources', 'levels', 'parameters'] as const)
    same(doc[field], baseline[field], `头部上下不能替换 ${field}`);
  same(doc.parts.map(p => p.id), baseline.parts.map(p => p.id), '头部上下保留已有图层和顺序');
  same(doc.deformers.map(p => p.id), baseline.deformers.map(p => p.id), '请使用程序已准备的头部上下承载');
  const authored = new Map(nodes(doc).map(n => [n.id, n]));
  for (const before of nodes(baseline)) {
    const after = authored.get(before.id)!;
    checkWarpGeometry(after);
    const { keyformsY: _a, ...a } = after, { keyformsY: _b, ...b } = before;
    same(a, b, `${before.id}：本阶段仅编辑本方向 Y 关键形，保留原有结构、绑定和左右`);
    if (!ownsNode(baseline, before, headPitchScope)) {
      same(after.keyformsY, before.keyformsY, `${before.id}：头部上下不能修改脖子、身体或其他范围外部件`);
      continue;
    }
    const permitted = (key: string) => Number.isFinite(Number(key)) && (stage === 'head-up'
      ? Number(key) > 0 && Number(key) <= scale.y[1] : Number(key) < 0 && Number(key) >= scale.y[0]);
    for (const key of new Set([...Object.keys(before.keyformsY ?? {}), ...Object.keys(after.keyformsY ?? {})]))
      if (!permitted(key)) same(after.keyformsY?.[key], before.keyformsY?.[key], `${before.id}：不能修改另一方向或正面 Y=${key}`);
  }
  return doc;
}

export function checkHeadPitchDelivery(doc: HeadNineAxis, direction: HeadPitchDirection, scale = angleScale()) {
  const byId = new Map(nodes(doc).map(n => [n.id, n])), angle = String(headPitchAngle(direction, scale));
  for (const part of doc.parts.filter(p => !p.context && !p.shadow && p.role !== 'mask' && p.material !== 'transparent' && p.partId && wholeHeadPart(p.partId))) {
    let node = byId.get(part.id), ready = false;
    while (node) {
      if (node.keyformsY?.[angle]) { ready = true; break; }
      node = node.parent ? byId.get(node.parent) : undefined;
    }
    if (!ready) throw Error(`${part.id}：尚未交付 Y=${angle} 的关键形或承载`);
  }
}

export async function seedHeadPitch(directory: string, upstreamDirectory: string, root: string, direction: HeadPitchDirection, scale = angleScale()) {
  const { doc } = await readUpstream(upstreamDirectory), document = await modelDocument(root, upstreamDirectory, doc);
  if (!document) throw Error('头部上下缺少上游 KRA');
  const initial = initializeHeadPitch(doc, headPitchStage(direction), scale);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, authorFile(headPitchStage(direction))), JSON.stringify(kraReferences(initial)) + '\n', { flag: 'wx' });
  await writeFile(join(directory, 'source.json'), JSON.stringify({ version: 1, sourceDocument: toTaskPath(root, document), upstreamModel: toTaskPath(root, join(upstreamDirectory, 'deformers.json')) }) + '\n');
  await writeBuilt(directory, { doc: initial, textures: new Map() });
}

export const buildHeadPitch = (directory: string, upstream: string, direction: HeadPitchDirection, scale = angleScale(), materialize?: MaterialLoader): Promise<Built> =>
  buildContinuation(directory, upstream, headPitchStage(direction), scale, materialize);

export async function mergeHeadPitch(directory: string, upstreamDirectory: string, scale = angleScale()): Promise<Built> {
  const { doc: upstream } = await readUpstream(upstreamDirectory);
  const authors = await Promise.all(headPitchDirections.map(async direction => {
    const { doc } = await readUpstream(join(directory, direction));
    checkHeadPitch(doc, upstream, headPitchStage(direction), scale); checkHeadPitchDelivery(doc, direction, scale);
    return doc;
  }));
  const merged = initializeHeadPitch(upstream, 'head-up', scale);
  merged.authoring = { stage: 'head-pitch' };
  merged.parameters = merged.parameters!.map(p => p.id === 'ParamAngleY' ? angleParameter('ParamAngleY', '角度 Y', scale.y) : p);
  const indexes = authors.map(doc => new Map(nodes(doc).map(n => [n.id, n])));
  const inheritedIds = new Set(nodes(upstream).map(n => n.id));
  for (const node of nodes(merged)) {
    const forms = { ...node.keyformsY };
    for (const [i, direction] of headPitchDirections.entries()) {
      for (const key of Object.keys(forms)) if (direction === 'up' ? Number(key) > 0 : Number(key) < 0) delete forms[key];
      for (const [key, points] of Object.entries(indexes[i].get(node.id)!.keyformsY ?? {}))
        if (direction === 'up' ? Number(key) > 0 : Number(key) < 0) forms[key] = structuredClone(points);
    }
    if (Object.keys(forms).length) node.keyformsY = forms; else delete node.keyformsY;
    // An independently authored carrier may only contribute on one half-axis.
    // After both deliveries pass, expose its unchanged opposite half explicitly
    // so readiness does not mistake a neutral correction for missing work.
    if (!inheritedIds.has(node.id)) initializeKeyforms(node, scale.y.map(y => [0,y]));
  }
  validateHeadNineAxis(merged);
  for (const direction of headPitchDirections) checkHeadPitchDelivery(merged, direction, scale);
  await mkdir(directory, { recursive: true });
  const root = dirname(dirname(directory));
  await writeFile(join(directory, 'source.json'), JSON.stringify({ version: 1, sourceDocument: merged.source?.document,
    upstreamModel: toTaskPath(root, join(upstreamDirectory, 'deformers.json')), authors: headPitchDirections.map(d => toTaskPath(root, join(directory, d, 'deformers.json'))) }) + '\n');
  await writeFile(join(directory, 'notes.md'), (await Promise.all(headPitchDirections.map(async d => `## ${d}\n\n${await readFile(join(directory, d, 'notes.md'), 'utf8')}`))).join('\n\n'));
  const built = { doc: merged, textures: new Map<string, string>() };
  await writeBuilt(directory, built);
  return built;
}
