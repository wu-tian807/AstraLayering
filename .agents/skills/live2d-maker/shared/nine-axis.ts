// Relative to <dir>/<name>. The nine-axis section keeps one directory per step,
// like shadow: step01_views holds the upper body and its generated head-pose views;
// step02_angle-x holds the left/right head warp deformers and the editable KRA
// with the repainted reveal areas; step03_angle-y adds up/down to the same
// deformers, and the workbench reads its deformers.json once it exists. source.json names the KRA it was made from;
// the workbench loads the nine-axis KRA only while that source is unchanged.
export const nineAxisArtifacts = {
  turnUpperBody: 'nine-axis/step01_views/upper-body.png',
  turnLeft: 'nine-axis/step01_views/left.png',
  turnRecord: 'nine-axis/step01_views/views.json',
  headDocument: 'nine-axis/step02_angle-x/character-nine-axis.kra',
  headColor: 'nine-axis/step02_angle-x/character-nine-axis.png',
  headDeformers: 'nine-axis/step02_angle-x/deformers.json',
  headSource: 'nine-axis/step02_angle-x/source.json',
  angleYDeformers: 'nine-axis/step03_angle-y/deformers.json',
} as const;

export type NineAxisSource = { version: 1; sourceDocument: string; sourceColor: string; sourceKraHash: string; sourceColorHash: string };
export function isNineAxisSource(value: unknown): value is NineAxisSource {
  const r = value as NineAxisSource | null;
  return !!r && r.version === 1 && typeof r.sourceDocument === 'string' && typeof r.sourceColor === 'string'
    && [r.sourceKraHash, r.sourceColorHash].every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash));
}
