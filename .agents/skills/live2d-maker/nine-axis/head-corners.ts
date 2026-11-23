import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { initializeKeyforms } from '../shared/nine-axis-edit.js';
import { checkWarpGeometry, kraReferences, nodes, validateHeadNineAxis, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { toTaskPath } from '../shared/task-paths.ts';
import { angleScale } from './angles.ts';
import { authorFile, buildContinuation, readUpstream, type AuthoredHead } from './continuation.ts';
import { prepareHeadControls, wholeHeadScope } from './head-controls.ts';
import { writeBuilt } from './head.ts';
import type { MaterialLoader } from './kra-materials.ts';
import { modelDocument } from './source.ts';

export const headCornerScope = { ...wholeHeadScope, label: '完整头部斜角' };
export const headCornerPoses = (scale = angleScale()) => scale.x.flatMap(x => scale.y.map(y => [x, y] as const));

export function initializeHeadCorners(upstream: HeadNineAxis & { axis: number }, scale = angleScale()): AuthoredHead {
  const doc = prepareHeadControls(upstream, 'corners', '头部斜角修正') as AuthoredHead;
  doc.authoring = { stage: 'head-xy' };
  const original = new Set(nodes(upstream).map(node => node.id));
  for (const node of doc.deformers.filter(node => !original.has(node.id))) {
    initializeKeyforms(node, [...scale.x.map(x => [x, 0] as const), ...scale.y.map(y => [0, y] as const)]);
    initializeKeyforms(node, headCornerPoses(scale));
  }
  return doc;
}

export const headCornerControlIds = (upstream: HeadNineAxis, doc: HeadNineAxis) => {
  const original = new Set(nodes(upstream).map(node => node.id));
  return new Set(doc.deformers.filter(node => !original.has(node.id)).map(node => node.id));
};

export function checkHeadCorners(value: unknown, upstream: HeadNineAxis & { axis: number }, scale = angleScale()): AuthoredHead {
  const doc = kraReferences(validateHeadNineAxis(value)) as AuthoredHead;
  const baseline = kraReferences(initializeHeadCorners(upstream, scale));
  const same = (a: unknown, b: unknown, label: string) => { if (!isDeepStrictEqual(a, b)) throw Error(label); };
  same(doc.authoring?.stage, 'head-xy', '完整头部斜角作者阶段不匹配');
  for (const field of ['source', 'canvas', 'view', 'axis', 'axisSources', 'levels', 'parameters'] as const)
    same(doc[field], baseline[field], `完整头部斜角不能替换 ${field}`);
  same(doc.parts, baseline.parts, '完整头部斜角保留原有部件、画稿绑定和顺序');
  same(doc.deformers.map(node => node.id), baseline.deformers.map(node => node.id), '请使用程序准备的斜角修正承载');
  const controls = headCornerControlIds(upstream, baseline);
  const authored = new Map(nodes(doc).map(node => [node.id, node]));
  for (const before of nodes(baseline)) {
    const after = authored.get(before.id)!;
    checkWarpGeometry(after);
    if (!controls.has(before.id)) { same(after, before, `${before.id}：保留上游头部、脖子和身体数据`); continue; }
    const { keyforms: _x, keyformsY: _y, keyformsXY: _xy, ...properties } = after;
    const { keyforms: _bx, keyformsY: _by, keyformsXY: _bxy, ...beforeProperties } = before;
    same(properties, beforeProperties, `${before.id}：不能更换修正承载的结构`);
    for (const [field, min, max] of [['keyforms', scale.x[0], scale.x[1]], ['keyformsY', scale.y[0], scale.y[1]]] as const) {
      for (const key of Object.keys(before[field] ?? {})) if (!after[field]?.[key]) throw Error(`${before.id}：缺少单轴静止键 ${key}`);
      for (const [key, points] of Object.entries(after[field] ?? {})) {
        if (!Number.isFinite(Number(key)) || Number(key) < min || Number(key) > max) throw Error(`${before.id}：单轴键超出范围`);
        same(points, before.keyforms['0'], `${before.id}：斜角修正不能改变单轴效果`);
      }
    }
    for (const [x, y] of headCornerPoses(scale)) if (!after.keyformsXY?.[`${x},${y}`]) throw Error(`${before.id}：缺少斜角 ${x},${y}`);
    for (const key of Object.keys(after.keyformsXY ?? {})) {
      const [x, y] = key.split(',').map(Number);
      if (!x || !y || x < scale.x[0] || x > scale.x[1] || y < scale.y[0] || y > scale.y[1]) throw Error(`${before.id}：只编辑有效斜角及中间组合`);
    }
  }
  return doc;
}

export async function seedHeadCorners(directory: string, upstreamDirectory: string, root: string, scale = angleScale()) {
  const { doc: upstream } = await readUpstream(upstreamDirectory), document = modelDocument(root, upstream);
  if (!document) throw Error('完整头部斜角缺少最新 KRA 来源');
  const doc = initializeHeadCorners(upstream, scale);
  await mkdir(directory, { recursive: true });
  let created = false;
  try {
    await writeFile(join(directory, authorFile('head-xy')), JSON.stringify(kraReferences(doc)) + '\n', { flag: 'wx' });
    created = true;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  await writeFile(join(directory, 'source.json'), JSON.stringify({ version: 1, sourceDocument: toTaskPath(root, document),
    upstreamModel: toTaskPath(root, join(upstreamDirectory, 'deformers.json')) }) + '\n');
  if (created) await writeBuilt(directory, { doc, textures: new Map() });
}

export const buildHeadCorners = (directory: string, upstream: string, scale = angleScale(), materialize?: MaterialLoader) =>
  buildContinuation(directory, upstream, 'head-xy', scale, materialize);

export async function finishHeadCorners(directory: string, upstream: string, scale = angleScale(), materialize?: MaterialLoader) {
  const built = await buildHeadCorners(directory, upstream, scale, materialize);
  if (!(await readFile(join(directory, 'notes.md'), 'utf8')).trim()) throw Error('完整头部斜角缺少制作说明');
  await writeBuilt(directory, built);
  return built;
}
