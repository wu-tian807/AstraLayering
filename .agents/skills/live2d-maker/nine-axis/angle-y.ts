import { angleScale, type AngleScale } from './angles.ts';
import { writeBuilt, type Built } from './head.ts';
import { buildContinuation } from './continuation.ts';
export const cornersPending = '斜向（四角）未制作。';
export async function buildAngleY(directory:string, angleX:string, scale:AngleScale=angleScale()):Promise<Built> {
  return buildContinuation(directory, angleX, 'y', scale);
}
export async function finishAngleY(directory:string, angleX:string, scale:AngleScale=angleScale()):Promise<number> {
  const built=await buildAngleY(directory,angleX,scale);await writeBuilt(directory,built);return built.doc.parts.length;
}
