// Task-relative paths for the four-step nine-axis pipeline. The workbench
// reads the newest completed deformers.json; a repaired KRA is used only when
// source.json still matches the selected upstream KRA/PNG.
export const nineAxisArtifacts = {
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
export const nineAxisStages = {
  x: nineAxisArtifacts.angleXDeformers, up: nineAxisArtifacts.angleUpDeformers,
  down: nineAxisArtifacts.angleDownDeformers, y: nineAxisArtifacts.headDeformers,
  xy: nineAxisArtifacts.angleXYDeformers, jaw: nineAxisArtifacts.jawLineDeformers,
} as const;
export type NineAxisStage = keyof typeof nineAxisStages;
export const nineAxisGroups = ['left', 'up', 'down'] as const;
export const nineAxisSteps = ['step01_video', 'step02_angles', 'step03_angle-xy', 'step04_jaw-line'] as const;
export const nineAxisGroupSteps = nineAxisGroups.map(group => `step02_angles/${group}`);
export const nineAxisDeformerPaths = new Set<string>([...Object.values(nineAxisStages), ...Object.values(legacyNineAxisArtifacts).filter(path => path.endsWith('/deformers.json'))]);

export type NineAxisSource = { version: 1; sourceDocument: string; sourceColor: string; sourceKraHash: string; sourceColorHash: string };
export function isNineAxisSource(value: unknown): value is NineAxisSource {
  const r = value as NineAxisSource | null;
  return !!r && r.version === 1 && typeof r.sourceDocument === 'string' && typeof r.sourceColor === 'string'
    && [r.sourceKraHash, r.sourceColorHash].every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash));
}
