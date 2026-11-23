// Task-relative paths for the current pipeline.
// Models name their saved KRA source; PNG snapshots are derived data.
export const headRollStep = 'step12_head-roll';
export const nineAxisSteps = ['step01_preparation', 'step02_video', 'step03_frames', 'step04_angles', 'step05_frames', 'step06_angle-xy', 'step07_jaw-line', 'step08_hair', 'step09_head-accessories', 'step10_head-pitch', 'step11_head-angle-xy', headRollStep] as const;
export const nineAxisGroups = ['left', 'up', 'down'] as const;
export const nineAxisBranches = ['model', 'video'] as const;
export const nineAxisHairRounds = ['front', 'side', 'back', 'remaining'] as const;
export const nineAxisGroupSteps = nineAxisGroups.map(group => `step04_angles/model/${group}`);
export const nineAxisBranchSteps = nineAxisBranches.map(branch => `step04_angles/${branch}`);
export const nineAxisPitchSteps = ['up', 'down'].map(direction => `step10_head-pitch/${direction}`);
export const nineAxisChildSteps = [...nineAxisBranchSteps, ...nineAxisGroupSteps, ...nineAxisPitchSteps];
export const nineAxisProgressSteps = nineAxisSteps.flatMap(id => id === 'step04_angles'
  ? [id, nineAxisBranchSteps[0], ...nineAxisGroupSteps, nineAxisBranchSteps[1]]
  : id === 'step10_head-pitch' ? [id, ...nineAxisPitchSteps] : [id]);
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
  headPitchDeformers: 'nine-axis/step10_head-pitch/deformers.json', headPitchSource: 'nine-axis/step10_head-pitch/source.json', headPitchNotes: 'nine-axis/step10_head-pitch/notes.md',
  headUpAuthor: 'nine-axis/step10_head-pitch/up/head-up.json', headUpDeformers: 'nine-axis/step10_head-pitch/up/deformers.json', headUpNotes: 'nine-axis/step10_head-pitch/up/notes.md',
  headDownAuthor: 'nine-axis/step10_head-pitch/down/head-down.json', headDownDeformers: 'nine-axis/step10_head-pitch/down/deformers.json', headDownNotes: 'nine-axis/step10_head-pitch/down/notes.md',
  headCornersAuthor: 'nine-axis/step11_head-angle-xy/head-xy.json', headCornersDeformers: 'nine-axis/step11_head-angle-xy/deformers.json',
  headCornersSource: 'nine-axis/step11_head-angle-xy/source.json', headCornersNotes: 'nine-axis/step11_head-angle-xy/notes.md',
  headRollDeformers: `nine-axis/${headRollStep}/deformers.json`,
} as const;
export const nineAxisStages = {
  neutral: nineAxisArtifacts.preparationDeformers,
  x: nineAxisArtifacts.angleXDeformers, up: nineAxisArtifacts.angleUpDeformers, down: nineAxisArtifacts.angleDownDeformers,
  y: nineAxisArtifacts.headDeformers, xy: nineAxisArtifacts.angleXYDeformers, jaw: nineAxisArtifacts.jawLineDeformers, hair: nineAxisArtifacts.hairDeformers,
  accessories: nineAxisArtifacts.accessoriesDeformers,
  headPitch: nineAxisArtifacts.headPitchDeformers,
  headCorners: nineAxisArtifacts.headCornersDeformers,
  headRoll: nineAxisArtifacts.headRollDeformers,
} as const;
export type NineAxisStage = keyof typeof nineAxisStages;
export const nineAxisDeformerPaths = new Set<string>([...Object.values(nineAxisStages), ...nineAxisPitchSteps.map(step => `nine-axis/${step}/deformers.json`)]);
