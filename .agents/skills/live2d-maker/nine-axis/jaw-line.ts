import { angleScale, type AngleScale } from './angles.ts';
import { writeBuilt, type Built } from './head.ts';
import { buildContinuation } from './continuation.ts';
// The jaw continuation keeps the full authored hierarchy. Existing line/mask
// layers from the earlier turns may be refined; no mandatory rig is introduced.
export async function buildJawLine(directory:string,angleXY:string,scale:AngleScale=angleScale()):Promise<Built>{return buildContinuation(directory,angleXY,'jaw',scale);}
export async function finishJawLine(directory:string,angleXY:string,scale:AngleScale=angleScale()):Promise<number>{const built=await buildJawLine(directory,angleXY,scale);await writeBuilt(directory,built);return built.doc.parts.length;}
