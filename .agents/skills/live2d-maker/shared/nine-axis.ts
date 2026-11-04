// Task-relative paths for the seven-step nine-axis pipeline. The workbench
// reads the newest completed deformers.json; a repaired KRA is used only when
// source.json still matches the selected upstream KRA/PNG.
export const nineAxisArtifacts = {
  turnUpperBody: 'nine-axis/step01_video/upper-body.png',
  turnLeft: 'nine-axis/step01_video/left.png',
  turnRecord: 'nine-axis/step01_video/views.json',
  headDocument: 'nine-axis/step02_angle-x/character-nine-axis.kra',
  headColor: 'nine-axis/step02_angle-x/character-nine-axis.png',
  headDeformers: 'nine-axis/step02_angle-x/deformers.json',
  headSource: 'nine-axis/step02_angle-x/source.json',
  angleUpDeformers: 'nine-axis/step04_angle-up/deformers.json',
  angleDownDeformers: 'nine-axis/step05_angle-down/deformers.json',
  angleXYDeformers: 'nine-axis/step06_angle-xy/deformers.json',
  jawLineDeformers: 'nine-axis/step07_jaw-line/deformers.json',
} as const;

export type NineAxisSource = { version: 1; sourceDocument: string; sourceColor: string; sourceKraHash: string; sourceColorHash: string };
export function isNineAxisSource(value: unknown): value is NineAxisSource {
  const r = value as NineAxisSource | null;
  return !!r && r.version === 1 && typeof r.sourceDocument === 'string' && typeof r.sourceColor === 'string'
    && [r.sourceKraHash, r.sourceColorHash].every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash));
}
