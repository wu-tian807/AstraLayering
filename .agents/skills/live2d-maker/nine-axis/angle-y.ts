import { angleScale, type AngleScale } from './angles.ts';
import { writeBuilt, type Built } from './head.ts';
import { buildContinuation } from './continuation.ts';
import type { PitchStage } from './continuation.ts';
export const cornersPending = '斜向（四角）未制作。';
export async function buildAngleY(directory:string, upstream:string, stage:PitchStage, scale:AngleScale=angleScale()):Promise<Built> {
  return buildContinuation(directory, upstream, stage, scale);
}
export async function finishAngleY(directory:string, upstream:string, stage:PitchStage, scale:AngleScale=angleScale()):Promise<number> {
  const built=await buildAngleY(directory,upstream,stage,scale);await writeBuilt(directory,built);return built.doc.parts.length;
}
