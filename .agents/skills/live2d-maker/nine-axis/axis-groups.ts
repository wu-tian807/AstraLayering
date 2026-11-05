import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runWorkflow as runGroups } from '../shared/part/workflow.ts';
import { beginStep, completeStep, readStep } from '../shared/step-chain.ts';
import { readUpstream, startContinuation } from './continuation.ts';
import { angleScale, type AngleScale } from './angles.ts';
import { type FaceLeft, type Built } from './head.ts';

export const axisGroups = ['left', 'up', 'down'] as const;
export type AxisGroup = typeof axisGroups[number];

// Each group owns its author, session, workspace and markers. It starts from
// the same neutral document, never from another group's fitted result.
export async function seedAxis(directory: string, neutral: string, group: AxisGroup, scale: AngleScale = angleScale()) {
  const upstream = await readUpstream(neutral);
  await mkdir(join(directory, 'layers'), { recursive: true });
  for (const p of upstream.doc.parts) await copyFile(join(neutral, p.texture), join(directory, p.texture));
  const name = `face-${group}.json`;
  const value = group === 'left'
    ? { version: 2, axis: upstream.doc.axis, deformers: [], parts: upstream.doc.parts.toReversed() } as FaceLeft
    : startContinuation(upstream.doc, upstream.hash, group, scale);
  await writeFile(join(directory, name), JSON.stringify(value) + '\n', { flag: 'wx' });
  await writeFile(join(directory, 'source.json'), await readFile(join(neutral, 'source.json')));
}

export type GroupHooks<G extends string> = {
  prepare(): Promise<void>;
  run(group: G, directory: string): Promise<void>;
  seed?(group: G, directory: string): Promise<void>;
  keep?(group: G, directory: string): Promise<void>;
};
export const runAxisGroups = (directory: string, hooks: GroupHooks<AxisGroup>, options: { group?: AxisGroup; signal?: AbortSignal } = {}) =>
  runStepGroups(directory, axisGroups, hooks, options);
// Children of one step run as concurrent independent sessions; the parent
// only combines them once every child is completed.
export async function runStepGroups<G extends string>(directory: string, groups: readonly G[], hooks: GroupHooks<G>, options: { group?: G; signal?: AbortSignal } = {}) {
  const selected = options.group ? [options.group] : groups;
  await runGroups([...selected], {
    preparation: hooks.prepare,
    async initialize() {},
    async ready() {
      options.signal?.throwIfAborted();
      const ready = [];
      for (const group of selected) {
        const output = join(directory, group);
        if ((await readStep(output)).status === 'completed') await hooks.keep?.(group, output);
        else ready.push({ id: group, group, depth: 0 });
      }
      return ready;
    },
    async runRound(group) {
      const output = join(directory, group), { status } = await readStep(output);
      await beginStep(output, status);
      if (status !== 'running') await hooks.seed?.(group, output);
      await hooks.run(group, output);
      options.signal?.throwIfAborted();
      await completeStep(output);
    },
  });
  return (await Promise.all(groups.map(async group => (await readStep(join(directory, group))).status === 'completed'))).every(Boolean);
}

// Source layer geometry and pixels are shared; fitting may freely choose
// Warp groups and local keyforms, but cannot quietly replace the neutral art.
export async function checkAxisSource(neutral: string, built: Built) {
  const upstream = await readUpstream(neutral);
  if (built.doc.axis !== upstream.doc.axis || JSON.stringify(built.doc.source) !== JSON.stringify(upstream.doc.source)) throw Error('单轴不能替换共享原画来源或中轴');
  if (built.doc.parts.length !== upstream.doc.parts.length) throw Error('单轴需保留共享原图层；局部控制可使用独立 Warp');
  for (const p of upstream.doc.parts) {
    const target = built.doc.parts.find(n => n.id === p.id);
    if (!target) throw Error(`单轴缺少共享原图层 ${p.id}`);
    for (const field of ['bbox', 'cols', 'rows', 'texture', 'textureBounds', 'level', 'role', 'clip'] as const) if (JSON.stringify(target[field]) !== JSON.stringify(p[field])) throw Error(`${p.id}：不能替换共享原图层的 ${field}；保留 neutral 的静态图层配置，使用独立 Warp 和局部关键形拟合本方向`);
    if (JSON.stringify(target.keyforms['0']) !== JSON.stringify(p.keyforms['0'])) throw Error(`${p.id}：不能替换共享静止形`);
    const source = built.textures.get(target.texture);
    if (!source || !(await readFile(source)).equals(await readFile(join(neutral, p.texture)))) throw Error(`${p.id}：原贴图已变化`);
  }
}
