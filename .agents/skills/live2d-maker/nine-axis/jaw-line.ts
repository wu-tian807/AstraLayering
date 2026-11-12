import { angleScale, type AngleScale } from './angles.ts';
import { writeBuilt, type Built } from './head.ts';
import { buildContinuation } from './continuation.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { kraReferences } from '../shared/nine-axis-model.js';
import type { MaterialLoader } from './kra-materials.ts';
// The jaw continuation keeps the full authored hierarchy. Existing line/mask
// layers from the earlier turns may be refined; no mandatory rig is introduced.
export async function buildJawLine(directory:string,angleXY:string,scale:AngleScale=angleScale(),materialize?:MaterialLoader):Promise<Built>{return buildContinuation(directory,angleXY,'jaw',scale,materialize);}
export async function finishJawLine(directory:string,angleXY:string,scale:AngleScale=angleScale(),materialize?:MaterialLoader):Promise<number>{
  const built=await buildJawLine(directory,angleXY,scale,materialize); await writeBuilt(directory,built);
  const path=join(directory,'jaw.json'), author=JSON.parse(await readFile(path,'utf8'));
  author.source=built.doc.source;
  for(const part of author.parts) { const binding=built.doc.parts.find(p=>p.id===part.id); if(binding?.uuid)part.uuid=binding.uuid; if(binding?.material)part.material=binding.material; }
  await writeFile(path,JSON.stringify(kraReferences(author))+'\n');
  await writeFile(join(directory,'export-record.json'),JSON.stringify({version:2,document:built.doc.source?.document,parts:built.doc.parts.map(({id,uuid,material,textureBounds})=>({id,uuid,material,textureBounds}))},null,2)+'\n');
  return built.doc.parts.length;
}
