// Pure step identities shared by runners, conversion and browser previews.
// A section is a directory of steps named stepNN or stepNN_<note>; the number
// orders the chain and the note only describes the step. Steps sharing a
// number are alternatives: a run takes one of them.
export const stepPattern = /^step(\d{2})(?:_([a-z0-9][a-z0-9-]*))?$/;
export const stepNumber = name => {
  const match = stepPattern.exec(name);
  return match ? Number(match[1]) : undefined;
};
export const stepName = (number, note) => `step${String(number).padStart(2, '0')}${note ? `_${note}` : ''}`;
// A step that holds one record per item, such as one per group or per depth.
export const stepPath = (name, ...items) => [name, ...items].join('/');

// The part sections' steps. Clothing parts use the same numbers; their single
// preparation step leaves 02–07 unused.
export const partSteps = {
  original: 'step01_original', options: 'step02_options', pose: 'step03_pose', standard: 'step04_standard',
  cutout: 'step04_cutout', passthrough: 'step04_passthrough',
  simplified: 'step05_simplified', base: 'step06_base', ready: 'step07_ready',
  initial: 'step08_initial', outline: 'step09_outline', reduce: 'step10_reduce', completion: 'step11_completion',
  children: 'step12_children', merge: 'step13_merge', occlusion: 'step14_occlusion',
};
export const standardReferenceSteps = [partSteps.standard, partSteps.cutout, partSteps.passthrough];
export const clothingPreparationStep = 'step01_preparation';
// The shadow section runs one of these, as --shadow-mode chooses.
export const shadowStep = mode => stepName(1, mode);

// Group items: a child group nests as <parent>/children/<name>.
export const groupDepth = id => id.split('/').length - 1;
export const groupItem = id => id.split('/').flatMap((segment, index) => index ? ['children', segment] : [segment]).join('/');
export const layerItem = depth => `depth${String(depth + 1).padStart(2, '0')}`;
export const parentGroupId = id => id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : undefined;
// A group's own step and a depth's reduction step, as task-section-relative ids.
export const groupStepId = (id, step) => stepPath(partSteps[step], groupItem(id));
export const layerStepId = depth => stepPath(partSteps.reduce, layerItem(depth));
