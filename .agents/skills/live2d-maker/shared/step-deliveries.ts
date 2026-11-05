import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readStep } from './step-chain.ts';
import { clothingPreparationStep, groupStepId, partSteps } from './step-paths.js';
import { artifactPath, reportPath } from './part/artifact-facts.ts';
import { occlusionPath } from './part/occlusion-plan.ts';
import { preparationOptionsPath } from './part/preparation-cache.ts';
import type { SectionId } from './paths.ts';
import { steps as personSteps } from '../raster-layering/steps.ts';
import { steps as clothingSteps } from '../clothing-raster-layering/steps.ts';
import { steps as assemblySteps } from '../character-assembly/steps.ts';
import { maskSteps, mapSteps } from '../shadow/steps.ts';
import { nineAxisCorners, nineAxisGroups, nineAxisSteps } from './nine-axis.ts';

// The files a completed step must still hold. A run refuses to keep a completed
// step that lost one; retry is how such a step is redone. Paths are absolute;
// some part products live outside the step directory.
const rasterSteps: Partial<Record<SectionId, readonly { id: string; requiredFiles: readonly string[] }[]>> = {
  'raster-layering': personSteps, 'clothing-raster-layering': clothingSteps,
  'character-assembly': assemblySteps, shadow: [...maskSteps, ...mapSteps],
};
const references = (root: string, name: string) => join(root, 'references', name);
const itemGroup = (item: string) => item.split('/children/').join('/');
const present = (path: string) => lstat(path).then(info => info.isFile(), () => false);

// These are recoverable file contracts, not visual acceptance; the user still reviews the art.
const axisFiles = (group: string) => [`face-${group}.json`, 'deformers.json', 'source.json', 'face-trace.json', 'fit-report.json'];
async function textureDeliveries(directory: string): Promise<string[]> {
  let document;
  try { document = JSON.parse(await readFile(join(directory, 'deformers.json'), 'utf8')); }
  catch { return []; } // The document itself is already a required delivery.
  return [...new Set<string>((Array.isArray(document.parts) ? document.parts : [])
    .flatMap((part: { texture?: unknown }) => typeof part?.texture === 'string' ? [join(directory, part.texture)] : []))];
}
async function nineAxisDeliveries(root: string, id: string): Promise<string[]> {
  const [step, group] = id.split('/'), directory = join(root, id);
  if (step === nineAxisSteps[0] && !group) return [
    'upper-body.png', 'crop.json', 'videos.json', 'views.json',
    ...nineAxisGroups.flatMap(view => [`${view}.mp4`, `${view}.png`, `frames/${view}.png`]),
  ].map(file => join(directory, file));
  if (step === nineAxisSteps[1]) {
    if (group && (nineAxisGroups as readonly string[]).includes(group)) {
      return [...axisFiles(group).map(file => join(directory, file)), ...await textureDeliveries(directory)];
    }
    if (group) return [];
    const files = ['deformers.json', 'axis-sources.json', 'source.json',
      'neutral/deformers.json', 'neutral/source.json', 'neutral/export-record.json', 'neutral/head_parts_manifest.json',
      'merged/deformers.json', 'merged/axis-sources.json'].map(file => join(directory, file));
    for (const view of nineAxisGroups) files.push(...await nineAxisDeliveries(root, `${step}/${view}`));
    for (const output of [directory, join(directory, 'neutral'), join(directory, 'merged')]) files.push(...await textureDeliveries(output));
    return [...new Set(files)];
  }
  if (step === nineAxisSteps[2]) {
    const cornerFiles = (corner: string) => [`${corner}.mp4`, `${corner}.png`, `frames/${corner}.png`, `${corner}-face-trace.json`, `${corner}-fit-report.json`];
    if (group && (nineAxisCorners as readonly string[]).includes(group)) return [
      ...['face-xy.json', 'deformers.json', 'selected-frames.json', ...cornerFiles(group)].map(file => join(directory, file)), ...await textureDeliveries(directory),
    ];
    if (group) return [];
    const files = ['face-xy.json', 'linear.json', 'deformers.json', 'videos.json', 'selected-frames.json', ...nineAxisCorners.flatMap(cornerFiles)].map(file => join(directory, file));
    for (const corner of nineAxisCorners) files.push(...await nineAxisDeliveries(root, `${step}/${corner}`));
    return [...new Set([...files, ...await textureDeliveries(directory)])];
  }
  if (step === nineAxisSteps[3] && !group) return [
    join(directory, 'jaw.json'), join(directory, 'deformers.json'), ...await textureDeliveries(directory),
  ];
  return [];
}

export async function stepDeliveries(root: string, section: SectionId, id: string): Promise<string[]> {
  if (section === 'nine-axis') return nineAxisDeliveries(root, id);
  const raster = rasterSteps[section];
  if (raster) return raster.find(step => step.id === id)?.requiredFiles.map(file => join(root, id, file)) ?? [];
  const [step, ...items] = id.split('/'), item = items.join('/');
  if (section === 'clothing-part-layering' && step === clothingPreparationStep) return [references(root, 'clothing.png')];
  if (section === 'part-layering') {
    if (step === partSteps.options) return [preparationOptionsPath(join(root, 'references'))];
    if (step === partSteps.standard) return [references(root, 'standard.png')];
    if (step === partSteps.simplified) return [references(root, 'simplified-subject.png')];
    if (step === partSteps.base) return [references(root, 'base-subject.png')];
  }
  if (step === partSteps.outline && item) return [artifactPath(root, itemGroup(item), 'outline')];
  if (step === partSteps.completion && item) {
    const group = itemGroup(item);
    return [artifactPath(root, group, 'completion'), reportPath(root, group, 'completion-check')];
  }
  if (step === partSteps.reduce && item) {
    // A group split off later (drawing-stage edit_groups) had no outline when its layer was reduced.
    const depth = Number(item.slice('depth'.length)) - 1, groups: string[] = [];
    let document;
    try { document = JSON.parse(await readFile(join(root, 'groups.json'), 'utf8')); } catch { return []; }
    const walk = (nodes: any[], level: number): void => {
      for (const node of Array.isArray(nodes) ? nodes : []) {
        if (typeof node?.id === 'string' && level === depth) groups.push(node.id);
        walk(node?.groups, level + 1);
      }
    };
    walk(document?.groups, 0);
    const delivered: string[] = [];
    for (const group of groups) {
      if ((await readStep(join(root, groupStepId(group, 'outline')))).status === 'completed') delivered.push(artifactPath(root, group, 'reduction'));
    }
    return delivered;
  }
  if (step === partSteps.merge) return [join(root, 'preview.svg')];
  if (step === partSteps.occlusion) return [occlusionPath(root)];
  return [];
}

export async function missingDeliveries(root: string, section: SectionId, id: string): Promise<string[]> {
  const missing: string[] = [];
  for (const path of await stepDeliveries(root, section, id)) if (!await present(path)) missing.push(path);
  return missing;
}
