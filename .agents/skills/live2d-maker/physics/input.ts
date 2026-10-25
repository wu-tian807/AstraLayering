import { readFile, mkdir, copyFile, stat, rm } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { taskDirectory } from '../shared/paths.ts';
import { LayerCompositor } from '../shared/krita/layer-compositor.ts';
import { studioProject } from '../shared/character-render/project-inputs.ts';

export type PhysicsInput = { task: string; document: string; color: string; profile: 'primary'|'all'; structures: string[]; referencePhysics?:string };
export const hash = (v: Uint8Array | string) => createHash('sha256').update(v).digest('hex');
export const json = async (p: string) => JSON.parse(await readFile(p, 'utf8'));
export async function put(p: string, v: unknown) { await mkdir(dirname(p), {recursive:true}); await (await import('../shared/artifact-files.ts')).atomicJSON(p,v); }
export async function optional(p: string) { try { return await json(p); } catch(e) { if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e; } }
export async function resolveInput(name: string, root: string, profile: 'primary'|'all'): Promise<PhysicsInput> {
  const task=taskDirectory(name,root), document=join(task,'character-assembly/step01/character-assembled.kra'), color=join(task,'character-assembly/step01/character-assembled.png');
  await Promise.all([document,color].map(p=>readFile(p)));
  const structures=[join(task,'part-layering/groups.json'),join(task,'clothing-part-layering/groups.json')];
  for(const p of structures) await json(p);
  return {task,document,color,profile,structures};
}
export const rulePaths=['guide.md','prompts/analysis.md','prompts/authoring.md','prompts/review.md','coverage.ts','images.ts','tools.ts','calibration.ts','motion-targets.ts','reference.ts','../shared/physics-core/motion-presets.js','feedback.ts','steps.ts','review-observations.ts'] as const;
export type RuleBaseline={version:1;rules:{path:string;hash:string}[]};
export async function ruleBaseline():Promise<RuleBaseline>{
  return {version:1,rules:await Promise.all(rulePaths.map(async path=>({path,hash:hash(await readFile(new URL(path,import.meta.url)))})))};
}
export async function fingerprint(input: PhysicsInput, baseline?:RuleBaseline) {
  const rules=(baseline??await ruleBaseline()).rules;
  // The previous version had the exact first thirteen paths. Its explicit
  // baseline still proves the old input digest during the scoped-review upgrade.
  const legacyBaseline=!!baseline&&rules.length===13;
  if(baseline?.version!==undefined&&baseline.version!==1||rules.length!==rulePaths.length&&!legacyBaseline||rules.some((r,i)=>r.path!==rulePaths[i]||!/^[a-f0-9]{64}$/.test(r.hash)))throw Error('无效的物理规则基线');
  return hash(JSON.stringify({version:3,rules:rules.map(r=>r.hash),reference:input.referencePhysics?hash(await readFile(input.referencePhysics)):null,profile:input.profile,source:hash(await readFile(input.color)),document:hash(await readFile(input.document)),structures:await Promise.all(input.structures.map(p=>json(p)))}));
}
export async function prepareSource(input: PhysicsInput, directory: string, krita: string) {
  const source=join(directory,'source'), digest=hash(await readFile(input.document));
  const existing=await optional(join(source,'catalog.json'));
  await mkdir(source,{recursive:true});
  const project=await studioProject(input.task,basename(input.task),dirname(input.task),'normal-depth');
  await (await import('./surface-inputs.ts')).prepareSurfaceInputs(input,source,project.files);
  if(existing?.documentHash===digest) return existing;
  const native=await nativeExtractor(krita);
  try {
    const session=await native.create(Readable.from([await readFile(input.document)]) as IncomingMessage,'kra');
    const packet=await native.surfaces(session);
    await copySurfaceFiles(native,session,packet,source);
    await copyFile(input.color,join(source,'color.png'));
    const leaves:any[]=[];
    for(const [i,path] of input.structures.entries()) {
      const walk=(nodes:any[])=>{for(const n of nodes) {if(n.groups?.length)walk(n.groups);else leaves.push({id:(i?'clothing:':'character:')+n.id,name:n.name??n.label??n.id});}};
      walk((await json(path)).groups);
    }
    const catalog={version:1,documentHash:digest,colorHash:hash(await readFile(input.color)),canvas:{width:packet.width,height:packet.height},layers:packet.layers,parts:leaves};
    await put(join(source,'catalog.json'),catalog); return catalog;
  } finally { await native.dispose(); }
}
async function nativeExtractor(krita:string){
  const environment:NodeJS.ProcessEnv={...process.env,ASTRA_STUDIO_KRITA:krita};
  // Extracted AppImages need their own embedded Python for the native plugin.
  // Use the installed bundle when present, retaining explicit host settings.
  const usr=join(dirname(krita),'usr');
  if(await stat(join(usr,'share/krita/pykrita')).then(()=>true,()=>false)) {
    environment.ASTRA_STUDIO_KRITA_PYTHONHOME ||= usr;
    environment.ASTRA_STUDIO_KRITA_PYTHONPATH ||= [join(usr,'share/krita/pykrita'),join(usr,'lib/krita-python-libs')].join(':');
  }
  return new LayerCompositor(environment);
}
async function copySurfaceFiles(native:LayerCompositor,session:any,packet:any,source:string){
  await mkdir(source,{recursive:true});
  for(const l of packet.layers){const files=[l.original,l.masked,...(l.projection?[l.projection.base,...l.projection.shadows.map((s:any)=>s.original)]:[])];for(const file of files)await copyFile(await native.surfaceAsset(session.session,session.revision,file),join(source,file));}
}
export async function prepareProjectionPreview(input:PhysicsInput,directory:string,krita:string){
  await prepareSource(input,directory,krita);
  const source=join(directory,'source'),preview=join(directory,'preview'),project=await studioProject(input.task,basename(input.task),dirname(input.task),'normal-depth');
  if(!project.previewModes.mask){await rm(preview,{recursive:true,force:true});return;}
  const mask=await studioProject(input.task,basename(input.task),dirname(input.task),'mask'),document=join(input.task,mask.files.document.path),color=join(input.task,mask.files.color.path),bindings=await json(join(input.task,mask.files.bindings.path));
  const digest=hash(await readFile(document)),existing=await optional(join(preview,'catalog.json'));
  const base=await json(join(source,'catalog.json'));
  await mkdir(preview,{recursive:true});await copyFile(join(source,'surface-inputs.json'),join(preview,'surface-inputs.json'));
  if(existing?.documentHash===digest&&existing?.extractorVersion===2){for(const kind of ['normal','depth']){try{await copyFile(join(source,kind+'.png'),join(preview,kind+'.png'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await rm(join(preview,kind+'.png'),{force:true});}}return;}
  const native=await nativeExtractor(krita);
  try {
    const session=await native.create(Readable.from([await readFile(document)]) as IncomingMessage,'kra'),packet=await native.surfaces({...session,projections:bindings.shadows});
    await copySurfaceFiles(native,session,packet,preview);await copyFile(color,join(preview,'color.png'));
    for(const kind of ['normal','depth']) {
      try { await copyFile(join(source,kind+'.png'),join(preview,kind+'.png')); }
      catch(e) { if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e; }
    }
    await put(join(preview,'catalog.json'),{...base,extractorVersion:2,documentHash:digest,colorHash:hash(await readFile(color)),previewMode:'mask',layers:packet.layers});
  } finally { await native.dispose(); }
}
