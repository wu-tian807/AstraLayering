import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readStep, type ChainStep } from '../step-chain.ts';
import type { GroupProgress, GroupSeed } from './layering-types.ts';
import { groupDepth, groupStepId, layerStepId, parentGroupId, partSteps } from '../step-paths.js';
export { groupDepth, groupStepId, layerStepId, parentGroupId } from '../step-paths.js';

// Part section step graph after the preparation steps. Every node is a step
// directory with the shared .running/.completed markers (see step-chain.ts):
//   step08_initial                     first grouping -> groups.json
//   step09_outline/<group>             outline + review -> outline.svg
//   step10_reduce/depthNN              same-depth reduction -> <id>.svg per group
//   step11_completion/<group>          completion + check -> ../../parts/<id>.svg
//   step12_children/<group>            children split -> children.json
//   step13_merge                       -> ../preview.svg
//   step14_occlusion                   -> ../occlusion.json
// A child group's item nests as <parent>/children/<name>. Step ids are these
// relative directory paths; groups.json is only the tree with editable notes.
const readPartStep = (directory: string, id: string) => readStep(join(directory, id));
export type GroupStep = 'outline' | 'completion' | 'children';
export const groupSteps: readonly GroupStep[] = ['outline', 'completion', 'children'];

export function groupStep(directory: string, id: string, step: GroupStep): ChainStep {
  const stepId = groupStepId(id, step);
  return { id: stepId, directory: join(directory, stepId) };
}
export function layerStep(directory: string, depth: number): ChainStep {
  const id = layerStepId(depth);
  return { id, directory: join(directory, id) };
}

export const copiedOutlineNote = '轮廓经工具验证来自当前父组完成稿：跳过轮廓 review';
type ChildrenFile = { groupId: string; groups: GroupSeed[]; note?: string };
export async function readChildren(directory: string, id: string): Promise<ChildrenFile> {
  const value = JSON.parse(await readFile(join(directory, groupStepId(id, 'children'), 'children.json'), 'utf8')) as ChildrenFile;
  if (value?.groupId !== id || !Array.isArray(value.groups)) throw new Error(`子组记录损坏：${groupStepId(id, 'children')}/children.json`);
  return value;
}
export async function readInitialGroups(directory: string): Promise<{ groups: GroupSeed[] }> {
  const value = JSON.parse(await readFile(join(directory, partSteps.initial, 'groups.json'), 'utf8'));
  if (!value || !Array.isArray(value.groups)) throw new Error(`首次分组记录损坏：${partSteps.initial}/groups.json`);
  // Older runs also saved an unused subject field; only the groups are read.
  return { groups: value.groups };
}

type LayerCache = Map<number, boolean>;
async function present(path: string): Promise<boolean> {
  try { await readFile(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
// One group and its subtree, as the completed step markers describe it.
// Notes and names edited in groups.json are kept.
export async function readGroupTree(directory: string, seed: GroupSeed, saved: Map<string, GroupSeed>, layers: LayerCache = new Map()): Promise<unknown> {
  const { readReviewReport, reviewedArtifact, readJson, readSvg, artifactPath, reportPath } = await import('./artifact-facts.ts');
  const id = seed.id, kept = saved.get(id), depth = groupDepth(id);
  const steps: Partial<GroupProgress> = {};
  let groups: unknown[] = [];
  if (!layers.has(depth)) {
    layers.set(depth, (await readPartStep(directory, layerStepId(depth))).status === 'completed');
  }
  const prepared = await readPartStep(directory, groupStepId(id, 'outline'));
  const outline = artifactPath(directory, id, 'outline');
  if (prepared.status === 'completed' && await present(outline)) {
    const path = outline, bytes = await readSvg(path);
    const skipped = seed.hiddenInReference ? { note: '原图不可见：跳过描边和轮廓 review' } : {};
    steps.outline = { status: 'completed', output: { path, ...skipped } };
    steps.review = { status: 'completed', output: (bytes && reviewedArtifact(bytes, path,
      await readReviewReport(reportPath(directory, id, 'review'), id))) || { path, ...skipped } };
    const reduced = artifactPath(directory, id, 'reduction');
    if (layers.get(depth) && await present(reduced)) steps.reduction = { status: 'completed', output: { path: artifactPath(directory, id, 'reduction') } };
  }
  const finished = await readPartStep(directory, groupStepId(id, 'completion')), part = artifactPath(directory, id, 'completion');
  if (steps.reduction && finished.status === 'completed' && await present(part)) {
    const check = await readJson(reportPath(directory, id, 'completion-check'));
    steps.completion = { status: 'completed', output: { path: artifactPath(directory, id, 'completion') } };
    steps.completionCheck = { status: 'completed', output: { passed: true, ...(check?.note ? { note: check.note } : {}) } };
  }
  if ((await readPartStep(directory, groupStepId(id, 'children'))).status === 'completed') {
    groups = await Promise.all((await readChildren(directory, id)).groups.map(child => readGroupTree(directory, child, saved, layers)));
    if (steps.completion) steps.children = { status: 'completed', output: { ids: groups.map(child => (child as GroupSeed).id) } };
  }
  const edited = kept ? Object.fromEntries((['name', 'note', 'metadata', 'allowOutsideParent', 'hiddenInReference'] as const).filter(key => key in kept).map(key => [key, kept[key]])) : {};
  return { ...seed, ...edited, groups, steps };
}

// Rebuilds the whole tree: the initial seeds, then each completed children split.
export async function readStepTree(directory: string, saved: Map<string, GroupSeed>): Promise<{ groups: unknown[]; merged: boolean }> {
  if ((await readPartStep(directory, partSteps.initial)).status !== 'completed') return { groups: [], merged: false };
  const initial = await readInitialGroups(directory), layers: LayerCache = new Map();
  const groups = await Promise.all(initial.groups.map(seed => readGroupTree(directory, seed, saved, layers)));
  const merged = (await readPartStep(directory, partSteps.merge)).status === 'completed';
  return { groups, merged };
}
