// Current task-relative paths and compatibility with earlier pipeline layouts.
// Models name their saved KRA source; PNG snapshots are derived data.
export const previousNineAxisArtifacts = {
  turnUpperBody: 'nine-axis/step01_video/upper-body.png',
  turnLeft: 'nine-axis/step01_video/left.png',
  turnUp: 'nine-axis/step01_video/up.png',
  turnDown: 'nine-axis/step01_video/down.png',
  turnLeftVideo: 'nine-axis/step01_video/left.mp4',
  turnUpVideo: 'nine-axis/step01_video/up.mp4',
  turnDownVideo: 'nine-axis/step01_video/down.mp4',
  turnRecord: 'nine-axis/step01_video/views.json',
  headDocument: 'nine-axis/step02_angles/character-nine-axis.kra',
  headColor: 'nine-axis/step02_angles/character-nine-axis.png',
  headDeformers: 'nine-axis/step02_angles/deformers.json',
  headSource: 'nine-axis/step02_angles/source.json',
  angleXDeformers: 'nine-axis/step02_angles/left/deformers.json',
  angleUpDeformers: 'nine-axis/step02_angles/up/deformers.json',
  angleDownDeformers: 'nine-axis/step02_angles/down/deformers.json',
  neutralDeformers: 'nine-axis/step02_angles/neutral/deformers.json',
  mergedDeformers: 'nine-axis/step02_angles/merged/deformers.json',
  angleXYDeformers: 'nine-axis/step03_angle-xy/deformers.json',
  jawLineDeformers: 'nine-axis/step04_jaw-line/deformers.json',
  jawLineDocument: 'nine-axis/step04_jaw-line/character-nine-axis.kra',
  jawLineColor: 'nine-axis/step04_jaw-line/character-nine-axis.png',
} as const;

// Read/save compatibility for existing model folders; these are not steps in
// the new pipeline and must never be presented as sequential up/down work.
export const legacyNineAxisArtifacts = {
  headDocument: 'nine-axis/step02_angle-x/character-nine-axis.kra',
  headColor: 'nine-axis/step02_angle-x/character-nine-axis.png',
  headDeformers: 'nine-axis/step02_angle-x/deformers.json',
  headSource: 'nine-axis/step02_angle-x/source.json',
  angleUpDeformers: 'nine-axis/step04_angle-up/deformers.json',
  angleDownDeformers: 'nine-axis/step05_angle-down/deformers.json',
  angleXYDeformers: 'nine-axis/step06_angle-xy/deformers.json',
  jawLineDeformers: 'nine-axis/step07_jaw-line/deformers.json',
} as const;
export const nineAxisSteps = ['step01_preparation', 'step02_video', 'step03_frames', 'step04_angles', 'step05_frames', 'step06_angle-xy', 'step07_jaw-line', 'step08_hair', 'step09_head-accessories'] as const;
export const previousNineAxisSteps = ['step01_video', 'step02_angles', 'step03_angle-xy', 'step04_jaw-line'] as const;
export const nineAxisGroups = ['left', 'up', 'down'] as const;
export const nineAxisBranches = ['model', 'video'] as const;
export const nineAxisGroupSteps = nineAxisGroups.map(group => `step04_angles/model/${group}`);
export const nineAxisBranchSteps = nineAxisBranches.map(branch => `step04_angles/${branch}`);
export const nineAxisChildSteps = [...nineAxisBranchSteps, ...nineAxisGroupSteps];
export const previousNineAxisGroupSteps = nineAxisGroups.map(group => `step02_angles/${group}`);
export const nineAxisProgressSteps = [...nineAxisSteps.slice(0, 4), ...nineAxisBranchSteps.slice(0, 1), ...nineAxisGroupSteps,
  ...nineAxisBranchSteps.slice(1), ...nineAxisSteps.slice(4)];
export const nineAxisArtifacts = {
  preparationDeformers: 'nine-axis/step01_preparation/deformers.json',
  preparationManifest: 'nine-axis/step01_preparation/head_parts_manifest.json',
  preparationPreview: 'nine-axis/step01_preparation/original-full-face.png',
  turnUpperBody: 'nine-axis/step02_video/upper-body.png',
  turnLeft: 'nine-axis/step03_frames/left.png', turnUp: 'nine-axis/step03_frames/up.png', turnDown: 'nine-axis/step03_frames/down.png',
  turnLeftVideo: 'nine-axis/step02_video/left.mp4', turnUpVideo: 'nine-axis/step02_video/up.mp4', turnDownVideo: 'nine-axis/step02_video/down.mp4',
  turnRecord: 'nine-axis/step03_frames/views.json',
  headDocument: 'nine-axis/step01_preparation/character-nine-axis.kra', headColor: 'nine-axis/step01_preparation/character-nine-axis.png',
  headDeformers: 'nine-axis/step04_angles/model/deformers.json', headSource: 'nine-axis/step01_preparation/source.json',
  angleXDeformers: 'nine-axis/step04_angles/model/left/deformers.json',
  angleUpDeformers: 'nine-axis/step04_angles/model/up/deformers.json', angleDownDeformers: 'nine-axis/step04_angles/model/down/deformers.json',
  neutralDeformers: 'nine-axis/step01_preparation/deformers.json', mergedDeformers: 'nine-axis/step04_angles/model/merged/deformers.json',
  cornerUpVideo: 'nine-axis/step04_angles/video/left-up.mp4', cornerDownVideo: 'nine-axis/step04_angles/video/left-down.mp4',
  cornerVideoRecord: 'nine-axis/step04_angles/video/videos.json',
  cornerUp: 'nine-axis/step05_frames/left-up.png', cornerDown: 'nine-axis/step05_frames/left-down.png',
  angleXYDeformers: 'nine-axis/step06_angle-xy/deformers.json', jawLineDeformers: 'nine-axis/step07_jaw-line/deformers.json',
  jawLineDocument: 'nine-axis/step07_jaw-line/character-nine-axis.kra', jawLineColor: 'nine-axis/step07_jaw-line/character-nine-axis.png',
  hairAuthor: 'nine-axis/step08_hair/hair.json', hairDeformers: 'nine-axis/step08_hair/deformers.json',
  hairDocument: 'nine-axis/step08_hair/character-nine-axis.kra', hairColor: 'nine-axis/step08_hair/character-nine-axis.png',
  hairSource: 'nine-axis/step08_hair/source.json', hairExportRecord: 'nine-axis/step08_hair/export-record.json', hairNotes: 'nine-axis/step08_hair/notes.md',
  accessoriesAuthor: 'nine-axis/step09_head-accessories/accessories.json', accessoriesDeformers: 'nine-axis/step09_head-accessories/deformers.json',
  accessoriesDocument: 'nine-axis/step09_head-accessories/character-nine-axis.kra', accessoriesColor: 'nine-axis/step09_head-accessories/character-nine-axis.png',
  accessoriesSource: 'nine-axis/step09_head-accessories/source.json', accessoriesExportRecord: 'nine-axis/step09_head-accessories/export-record.json', accessoriesNotes: 'nine-axis/step09_head-accessories/notes.md',
} as const;
export const nineAxisStages = {
  neutral: nineAxisArtifacts.preparationDeformers,
  x: nineAxisArtifacts.angleXDeformers, up: nineAxisArtifacts.angleUpDeformers, down: nineAxisArtifacts.angleDownDeformers,
  y: nineAxisArtifacts.headDeformers, xy: nineAxisArtifacts.angleXYDeformers, jaw: nineAxisArtifacts.jawLineDeformers, hair: nineAxisArtifacts.hairDeformers,
  accessories: nineAxisArtifacts.accessoriesDeformers,
} as const;
export const previousNineAxisStages = {
  x: previousNineAxisArtifacts.angleXDeformers, up: previousNineAxisArtifacts.angleUpDeformers,
  down: previousNineAxisArtifacts.angleDownDeformers, y: previousNineAxisArtifacts.headDeformers,
  xy: previousNineAxisArtifacts.angleXYDeformers, jaw: previousNineAxisArtifacts.jawLineDeformers,
} as const;
export type NineAxisStage = keyof typeof nineAxisStages;
export const nineAxisDeformerPaths = new Set<string>([...Object.values(nineAxisStages), ...Object.values(previousNineAxisStages),
  ...Object.values(legacyNineAxisArtifacts).filter(path => path.endsWith('/deformers.json'))]);
