// Relative to <dir>/<name>. The nine-axis section keeps one directory per step,
// like shadow: step01_video holds the upper body and every video; step02_views
// the left head-turn frame; step03_angle-x the left/right head warp deformers
// and the editable KRA with the repainted reveal areas; step04_views-y the up/down
// camera frames; step05_angle-y adds up/down to the same deformers and
// step06_angle-xy the four corners; step07_jaw-line the jaw line, neck and their clip masks; the workbench reads the newest step's deformers.json. source.json names the KRA it was made from;
// the workbench loads the nine-axis KRA only while that source is unchanged.
export const nineAxisArtifacts = {
  turnUpperBody: 'nine-axis/step01_video/upper-body.png',
  turnLeft: 'nine-axis/step02_views/left.png',
  turnRecord: 'nine-axis/step02_views/views.json',
  headDocument: 'nine-axis/step03_angle-x/character-nine-axis.kra',
  headColor: 'nine-axis/step03_angle-x/character-nine-axis.png',
  headDeformers: 'nine-axis/step03_angle-x/deformers.json',
  headSource: 'nine-axis/step03_angle-x/source.json',
  angleYDeformers: 'nine-axis/step05_angle-y/deformers.json',
  angleXYDeformers: 'nine-axis/step06_angle-xy/deformers.json',
  jawLineDeformers: 'nine-axis/step07_jaw-line/deformers.json',
} as const;

export type NineAxisSource = { version: 1; sourceDocument: string; sourceColor: string; sourceKraHash: string; sourceColorHash: string };
export function isNineAxisSource(value: unknown): value is NineAxisSource {
  const r = value as NineAxisSource | null;
  return !!r && r.version === 1 && typeof r.sourceDocument === 'string' && typeof r.sourceColor === 'string'
    && [r.sourceKraHash, r.sourceColorHash].every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash));
}
