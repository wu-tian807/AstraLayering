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
import { nineAxisGroups, previousNineAxisSteps as nineAxisSteps } from './nine-axis.ts';

// The files a completed step must still hold. A run refuses to keep a completed
// step that lost one; retry is how such a step is redone. Paths are absolute;
// some part products live outside the step directory.
const rasterSteps: Partial<Record<SectionId, readonly { id: string; requiredFiles: readonly string[] }[]>> = {
  'raster-layering': personSteps, 'clothing-raster-layering': clothingSteps,
  'character-assembly': assemblySteps, shadow: [...maskSteps, ...mapSteps],
};
const references = (root: string, name: string) => join(root, 'references', name);
const itemGroup = (item: string) => item.split('/children/').join('/');
const present = (path: string) => lstat(path).then(info => info.isFile() && info.size > 0, () => false);

// These are recoverable file contracts, not visual acceptance; the user still reviews the art.
const axisFiles = (group: string) => [`face-${group}.json`, 'deformers.json', 'source.json', 'face-trace.json', 'fit-report.json'];
async function textureDeliveries(directory: string): Promise<string[]> {
  let document;
  try { document = JSON.parse(await readFile(join(directory, 'deformers.json'), 'utf8')); }
  catch { return []; } // The document itself is already a required delivery.
  return [...new Set<string>((Array.isArray(document.parts) ? document.parts : [])
    .flatMap((part: { texture?: unknown; uuid?: unknown; material?: unknown }) => !part?.uuid && part?.material !== 'transparent' && typeof part?.texture === 'string' ? [join(directory, part.texture)] : []))];
}
async function previousNineAxisDeliveries(root: string, id: string): Promise<string[]> {
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
    for (const view of nineAxisGroups) files.push(...await previousNineAxisDeliveries(root, `${step}/${view}`));
    for (const output of [directory, join(directory, 'neutral'), join(directory, 'merged')]) files.push(...await textureDeliveries(output));
    return [...new Set(files)];
  }
  if (step === nineAxisSteps[2] && !group) return [
    ...['face-xy.json', 'linear.json', 'deformers.json', 'videos.json', 'selected-frames.json',
      ...['left-up', 'left-down'].flatMap(corner => [`${corner}.mp4`, `${corner}.png`, `frames/${corner}.png`,
        `${corner}-face-trace.json`, `${corner}-fit-report.json`])]
      .map(file => join(directory, file)), ...await textureDeliveries(directory),
  ];
  if (step === nineAxisSteps[3] && !group) return [
    join(directory, 'jaw.json'), join(directory, 'deformers.json'), ...await textureDeliveries(directory),
  ];
  return [];
}

async function nineAxisDeliveries(root: string, id: string): Promise<string[]> {
  const directory = join(root, id), files = (names: string[]) => names.map(name => join(directory, name));
  if (id === 'step01_preparation') return [...files(['crop.json', 'deformers.json', 'source.json', 'export-record.json', 'head_parts_manifest.json']), ...await textureDeliveries(directory)];
  if (id === 'step02_video') return files(['upper-body.png', 'crop.json', ...nineAxisGroups.map(g => `${g}.mp4`)]);
  if (id === 'step03_frames' || id === 'step05_frames') return files(['selected-frames.json', ...id === 'step03_frames' ? ['views.json'] : [],
    ...(id === 'step03_frames' ? nineAxisGroups : ['left-up', 'left-down']).flatMap(g => [`${g}.png`, `frames/${g}.png`])]);
  if (id === 'step04_angles/video') return files(['left-up.mp4', 'left-down.mp4']);
  if (id.startsWith('step04_angles/model/')) {
    const group = id.split('/')[2];
    if ((nineAxisGroups as readonly string[]).includes(group)) return [...files(axisFiles(group)), ...await textureDeliveries(directory)];
  }
  if (id === 'step04_angles/model') {
    const result = [...files(['deformers.json', 'axis-sources.json', 'source.json', 'merged/deformers.json', 'merged/axis-sources.json']), ...await textureDeliveries(directory), ...await textureDeliveries(join(directory, 'merged'))];
    for (const group of nineAxisGroups) result.push(...await nineAxisDeliveries(root, id + '/' + group));
    return [...new Set(result)];
  }
  if (id === 'step04_angles') return [...await nineAxisDeliveries(root, id + '/model'), ...await nineAxisDeliveries(root, id + '/video')];
  if (id === 'step06_angle-xy') return [...files(['face-xy.json', 'linear.json', 'deformers.json', ...['left-up', 'left-down'].flatMap(c => [`${c}-face-trace.json`, `${c}-fit-report.json`])]), ...await textureDeliveries(directory)];
  if (id === 'step07_jaw-line') return [...files(['jaw.json', 'deformers.json', 'character-nine-axis.kra', 'character-nine-axis.png', 'export-record.json']), ...await textureDeliveries(directory)];
  if (id === 'step08_hair') return [...files(['hair.json', 'deformers.json', 'character-nine-axis.kra', 'character-nine-axis.png', 'source.json', 'export-record.json', 'notes.md']), ...await textureDeliveries(directory)];
  if (id === 'step09_head-accessories') return [...files(['accessories.json', 'deformers.json', 'character-nine-axis.kra', 'character-nine-axis.png', 'source.json', 'export-record.json', 'notes.md']), ...await textureDeliveries(directory)];
  return previousNineAxisDeliveries(root, id);
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
