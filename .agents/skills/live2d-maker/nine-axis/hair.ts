import { constants } from 'node:fs';
import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { lattice, validateHeadNineAxis, kraReferences, type HeadDeformer } from '../shared/nine-axis-model.js';
import { toTaskPath } from '../shared/task-paths.ts';
import { angleScale, type AngleScale } from './angles.ts';
import { buildContinuation, isHairNode, readUpstream, startContinuation, type AuthoredHead } from './continuation.ts';
import { writeBuilt, type Built } from './head.ts';
import { headMaterialSelection } from './materials.ts';
import { bindKraDocument, type MaterialLoader } from './kra-materials.ts';
import { editableKra, modelDocument, withDocument } from './source.ts';
import { kraContents, kraLayers } from '../shadow/delivery.ts';
import { nodes } from '../shared/nine-axis-model.js';
import sharp from 'sharp';
import { completeHairRound, hairRoundLabel, type HairRound } from './hair-progress.ts';
export { hairRounds, hairRoundLabel, readHairProgress, completeHairRound, upgradeHairProgress, type HairRound, type HairProgress } from './hair-progress.ts';

export const isFrontHair = (id: string) => /^hair\/(?:bangs|front_hair)(?:\/|::|$)/.test(id);
export const isSideHair = (id: string) => /^hair\/side_hair(?:\/|::|$)/.test(id);
export const isBackHair = (id: string) => /^hair\/back_hair(?:\/|::|$)/.test(id);
export const isHeadHair = (id: string) => isFrontHair(id) || isSideHair(id) || isBackHair(id);
export const isHairId = (id:string) => /^hair(?:\/|$)/.test(id);
// Remaining hair is selected from the actual document, not a fixed list of styles.
export const hairRoundAllows = (round: HairRound) => round === 'front' ? isFrontHair : round === 'side' ? isSideHair : round === 'back' ? isHeadHair : isHairId;
export const hairPreviewScope = (round: HairRound) => ({
  includes: (part: { id: string; level: string }) => part.level === 'face' || (round === 'remaining' ? part.level==='hair' && isHairId(part.id) : isFrontHair(part.id) || round !== 'front' && isSideHair(part.id) || round === 'back' && isBackHair(part.id)),
  allowsPose: (_x: number, y: number) => y === 0,
  label: `${hairRoundLabel(round)} left/right 预览只允许 Y=0`,
});
export const frontPreviewScope = hairPreviewScope('front');
export const completeFrontRound = (directory: string) => completeHairRound(directory,'front');

/** Front/side preserve earlier rounds. Back coordinates the three head-hair
 * regions; remaining may coordinate all hair while protecting non-hair nodes. */
export async function checkHairRound(before: Built, after: Built, round: HairRound) {
  const allows=hairRoundAllows(round),label=hairRoundLabel(round)+'轮次';
  const current=round==='back'?isBackHair:allows;
  if(round==='remaining') {
    // Static KRA context exposes visible, unbound hair. It must be explicitly
    // registered rather than silently left unmoving or omitted from previews.
    for(const part of before.doc.parts.filter(p=>p.level==='hair'&&p.id.startsWith('__kra__/')&&p.uuid))
      if(!after.doc.parts.some(p=>isHairId(p.id)&&!p.shadow&&p.uuid===part.uuid))throw Error(`${label}尚未注册剩余 KRA 发片 ${part.uuid}`);
  } else if(!after.doc.parts.some(part=>current(part.id)&&!part.shadow))throw Error(`${label}尚未注册制作发片`);
  const editableUuids=new Set(after.doc.parts.filter(part=>allows(part.id)).map(part=>part.uuid));
  const isCurrent=(node: any)=>allows(node.id)||node.id.startsWith('__kra__/')&&node.level==='hair'&&!!node.uuid&&editableUuids.has(node.uuid);
  // A single KRA layer can supply several independently cropped model parts.
  // Preserve each exact node identity before falling back to a layer binding.
  const samePart=<T extends {id:string;uuid?:string}>(candidates:T[],node:{id:string;uuid?:string})=>
    candidates.find(candidate=>candidate.id===node.id)??(node.uuid?candidates.find(candidate=>candidate.uuid===node.uuid):undefined);
  const protectedNodes=nodes(before.doc).filter(node=>!isCurrent(node));
  for(const node of protectedNodes) {
    const next=samePart(nodes(after.doc),node);
    if(!next || JSON.stringify(kraReferences({parts:[next]}))!==JSON.stringify(kraReferences({parts:[node]}))) throw Error(`${node.id}：${label}不能修改其他已有节点`);
  }
  for(const node of nodes(after.doc)) if(!nodes(before.doc).some(previous=>previous.id===node.id) && !allows(node.id)) throw Error(`${label}新增节点须属于当前发片`);
  await Promise.all(before.doc.parts.filter(part=>!isCurrent(part)).map(async part=>{
    const next=samePart(after.doc.parts,part)!;
    const pixels=(file: string)=>sharp(file).ensureAlpha().raw().toBuffer();
    const [a,b]=await Promise.all([pixels(before.textures.get(part.texture!)!),pixels(after.textures.get(next.texture!)!)]);
    if(!a.equals(b)) throw Error(`${part.id}：${label}修改了其他图层画稿`);
  }));
}
export const checkFrontRound = (before: Built, after: Built) => checkHairRound(before,after,'front');

/** One owned KRA and cumulative author for the entire hair step. Continue
 * preserves both, even if the upstream KRA subsequently receives another save. */
export async function prepareHair(directory: string, upstreamDirectory: string, root: string, materialize: MaterialLoader,
  scale: AngleScale = angleScale(), signal?: AbortSignal) {
  const document = editableKra(directory),author=join(directory,'hair.json');
  if (await access(author).then(()=>true,()=>false)) {
    await access(document).catch(error=>{throw Error('头发作者文件已存在，但本步 KRA 缺失；不能用上游工程替代已修改画稿',{cause:error});});
    return;
  }
  const upstream = await readUpstream(upstreamDirectory);
  const source = await modelDocument(root,upstreamDirectory,upstream.doc);
  if (!source) throw Error('头发阶段缺少上游 KRA 来源');
  await mkdir(directory,{recursive:true});
  if(!await access(document).then(()=>true,()=>false))
    await copyFile(source,document,constants.COPYFILE_EXCL).catch(error => { if (error.code !== 'EEXIST') throw error; });
  signal?.throwIfAborted();
  // Only native bindings and inherited geometry are prepared. The maker
  // inspects the owned KRA and explicitly registers the parts it will edit.
  const inherited=await bindKraDocument(root,upstreamDirectory,upstream.doc);
  const doc=kraReferences(startContinuation(withDocument(inherited,root,document) as AuthoredHead,'hair',scale));
  validateHeadNineAxis(doc);
  await writeFile(join(directory,'character-nine-axis.png'),kraContents(await readFile(document)).merged);
  await writeFile(join(directory,'source.json'),JSON.stringify({version:1,sourceDocument:toTaskPath(root,document),upstreamDocument:toTaskPath(root,source),upstreamModel:toTaskPath(root,join(upstreamDirectory,'deformers.json'))},null,2)+'\n');
  const temporary=author+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(doc)+'\n');await rename(temporary,author);
  await writeBuilt(directory,{doc,textures:new Map()});
}

export const buildHair = (directory: string, upstream: string, scale: AngleScale = angleScale(), materialize?: MaterialLoader): Promise<Built> =>
  buildContinuation(directory,upstream,'hair',scale,materialize);

export async function finishHair(directory: string, upstream: string, scale: AngleScale = angleScale(), materialize?: MaterialLoader) {
  const built=await buildHair(directory,upstream,scale,materialize);
  if(!built.doc.parts.some(isHairNode))throw Error('尚未注册本轮制作部件');
  await writeBuilt(directory,built);
  const path=join(directory,'hair.json'), author=JSON.parse(await readFile(path,'utf8'));
  author.source=built.doc.source;
  for(const part of author.parts) { const bound=built.doc.parts.find(p=>p.id===part.id)!; if(bound.uuid)part.uuid=bound.uuid; if(bound.material)part.material=bound.material; if(bound.shadow)part.shadow=bound.shadow; }
  await writeFile(path,JSON.stringify(kraReferences(author))+'\n');
  await writeFile(join(directory,'export-record.json'),JSON.stringify({version:2,document:built.doc.source?.document,parts:built.doc.parts.map(({id,uuid,material,texture,textureBounds,shadow})=>({id,uuid,material,textureBounds,...(shadow?{shadow}:{})}))},null,2)+'\n');
  return built.doc.parts.filter(isHairNode).length;
}
