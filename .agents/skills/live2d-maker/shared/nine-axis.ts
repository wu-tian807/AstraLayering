// Relative to <dir>/<name>. The nine-axis section keeps one directory per step,
// like shadow: step01_turn holds the upper body and its generated head-pose views;
// step02_head holds the head warp deformers and the editable KRA
// with the repainted reveal areas. source.json names the KRA it was made from;
// the workbench loads the nine-axis KRA only while that source is unchanged.
export const nineAxisArtifacts = {
  turnUpperBody: 'nine-axis/step01_turn/upper-body.png',
  turnLeft: 'nine-axis/step01_turn/left.png',
  turnRecord: 'nine-axis/step01_turn/views.json',
  headDocument: 'nine-axis/step02_head/character-nine-axis.kra',
  headColor: 'nine-axis/step02_head/character-nine-axis.png',
  headDeformers: 'nine-axis/step02_head/deformers.json',
  headSource: 'nine-axis/step02_head/source.json',
} as const;

export type NineAxisSource = { version: 1; sourceDocument: string; sourceColor: string; sourceKraHash: string; sourceColorHash: string };
export function isNineAxisSource(value: unknown): value is NineAxisSource {
  const r = value as NineAxisSource | null;
  return !!r && r.version === 1 && typeof r.sourceDocument === 'string' && typeof r.sourceColor === 'string'
    && [r.sourceKraHash, r.sourceColorHash].every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash));
}
