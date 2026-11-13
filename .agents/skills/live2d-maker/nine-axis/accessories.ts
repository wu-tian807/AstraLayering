import { constants } from 'node:fs';
import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { kraReferences, nodes, validateHeadNineAxis } from '../shared/nine-axis-model.js';
import { toTaskPath } from '../shared/task-paths.ts';
import { kraContents } from '../shadow/delivery.ts';
import { angleScale, type AngleScale } from './angles.ts';
import { buildContinuation, isAccessoryNode, readUpstream, startContinuation, type AuthoredHead } from './continuation.ts';
import { writeBuilt, type Built } from './head.ts';
import { bindKraDocument, type MaterialLoader } from './kra-materials.ts';
import { editableKra, modelDocument, withDocument } from './source.ts';

export const isAccessoryId = (id:string) => /^head_accessories(?:\/|::|$)/.test(id);
export const accessoryPreviewScope = {
  includes:(part:{id:string;level:string})=>part.level==='face'||part.level==='hair'&&/^hair(?:\/|$)/.test(part.id)||isAccessoryNode(part),
  allowsPose:(_x:number,y:number)=>y===0,
  label:'头部饰品 left/right 预览只允许 Y=0',
};

/** The next editable stage owns one KRA, copied from the actual hair source.
 * Preparation binds UUIDs only; the maker selects and registers accessories. */
export async function prepareAccessories(directory:string,upstreamDirectory:string,root:string,materialize:MaterialLoader,
  scale:AngleScale=angleScale(),signal?:AbortSignal) {
  const document=editableKra(directory),author=join(directory,'accessories.json');
  if(await access(author).then(()=>true,()=>false)) {
    await access(document).catch(error=>{throw Error('饰品作者文件已存在，但本步 KRA 缺失；不能覆盖已修改画稿',{cause:error});});return;
  }
  const upstream=await readUpstream(upstreamDirectory),source=await modelDocument(root,upstreamDirectory,upstream.doc);
  if(!source)throw Error('头部饰品阶段缺少上游 KRA 来源');
  await mkdir(directory,{recursive:true});
  if(!await access(document).then(()=>true,()=>false))await copyFile(source,document,constants.COPYFILE_EXCL).catch(error=>{if(error.code!=='EEXIST')throw error;});
  signal?.throwIfAborted();
  const inherited=await bindKraDocument(root,upstreamDirectory,upstream.doc);
  const doc=kraReferences(startContinuation(withDocument(inherited,root,document) as AuthoredHead,'accessories',scale));
  validateHeadNineAxis(doc);
  await writeFile(join(directory,'character-nine-axis.png'),kraContents(await readFile(document)).merged);
  await writeFile(join(directory,'source.json'),JSON.stringify({version:1,sourceDocument:toTaskPath(root,document),upstreamDocument:toTaskPath(root,source),upstreamModel:toTaskPath(root,join(upstreamDirectory,'deformers.json'))},null,2)+'\n');
  const temporary=author+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(doc)+'\n');await rename(temporary,author);
  await writeBuilt(directory,{doc,textures:new Map()});
}

export const buildAccessories=(directory:string,upstream:string,scale:AngleScale=angleScale(),materialize?:MaterialLoader):Promise<Built>=>
  buildContinuation(directory,upstream,'accessories',scale,materialize);

export async function checkAccessories(before:Built,after:Built) {
  for(const part of before.doc.parts.filter(p=>p.level==='accessory'&&p.id.startsWith('__kra__/')&&p.uuid))
    if(!after.doc.parts.some(p=>isAccessoryNode(p)&&!p.shadow&&p.uuid===part.uuid))throw Error(`尚未注册剩余 KRA 头部饰品 ${part.uuid}`);
  const editable=new Set(after.doc.parts.filter(isAccessoryNode).map(p=>p.uuid));
  const current=(n:any)=>isAccessoryNode(n)||n.level==='accessory'&&n.id.startsWith('__kra__/')&&!!n.uuid&&editable.has(n.uuid);
  const find=(list:any[],n:any)=>list.find(p=>p.id===n.id)??(n.uuid?list.find(p=>p.uuid===n.uuid):undefined);
  for(const node of nodes(before.doc).filter(n=>!current(n))) {
    const next=find(nodes(after.doc),node);
    if(!next||JSON.stringify(kraReferences({parts:[next]}))!==JSON.stringify(kraReferences({parts:[node]})))throw Error(`${node.id}：头部饰品阶段不能修改其他已有节点`);
  }
  for(const node of nodes(after.doc))if(!nodes(before.doc).some(p=>p.id===node.id)&&!isAccessoryNode(node))throw Error('头部饰品阶段新增节点须属于 head_accessories/');
  await Promise.all(before.doc.parts.filter(p=>!current(p)).map(async p=>{
    const next=find(after.doc.parts,p),rgba=(file:string)=>sharp(file).ensureAlpha().raw().toBuffer();
    const [a,b]=await Promise.all([rgba(before.textures.get(p.texture!)!),rgba(after.textures.get(next.texture!)!)]);
    if(!a.equals(b))throw Error(`${p.id}：头部饰品阶段修改了其他图层画稿`);
  }));
}

/** Ready native shadow dependencies must not be silently left behind. Other
 * body/clothing dependencies stay deferred until their real parts exist. */
export async function checkAccessoryShadows(root:string,doc:Built['doc']) {
  let value:any;
  try{value=JSON.parse(await readFile(join(root,'shadow/step01_mask/shadows.json'),'utf8'));}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  const uuid=(v:string)=>v.replace(/[{}]/g,'').toLowerCase(),parts=doc.parts.filter(p=>p.uuid&&!p.shadow);
  for(const shadow of value.shadows??[]) {
    const casters=(shadow.casterLayerUuids??[]).map(uuid),receivers=(shadow.receiverLayerUuids??[]).map(uuid);
    if(!casters.length||!receivers.length)continue;
    const dependencies=[...casters,...receivers];
    if(!dependencies.every(id=>parts.some(p=>p.uuid===id))||!parts.some(p=>isAccessoryNode(p)&&dependencies.includes(p.uuid!)))continue;
    if(!doc.parts.some(p=>p.shadow&&p.uuid===uuid(shadow.shadowLayerUuid)))throw Error(`头部饰品投影 ${shadow.id} 的依赖已齐全，但尚未注册独立阴影`);
  }
}

export async function finishAccessories(directory:string,upstream:string,scale:AngleScale=angleScale(),materialize?:MaterialLoader) {
  const built=await buildAccessories(directory,upstream,scale,materialize);await writeBuilt(directory,built);
  const path=join(directory,'accessories.json'),author=JSON.parse(await readFile(path,'utf8'));author.source=built.doc.source;
  for(const part of author.parts) {
    const bound=built.doc.parts.find(p=>p.id===part.id)!;
    if(bound.uuid)part.uuid=bound.uuid;if(bound.material)part.material=bound.material;if(bound.shadow)part.shadow=bound.shadow;
  }
  await writeFile(path,JSON.stringify(kraReferences(author))+'\n');
  await writeFile(join(directory,'export-record.json'),JSON.stringify({version:2,document:built.doc.source?.document,parts:built.doc.parts.map(({id,uuid,material,textureBounds,shadow})=>({id,uuid,material,textureBounds,...shadow?{shadow}:{}}))},null,2)+'\n');
  return built.doc.parts.filter(p=>isAccessoryNode(p)&&!p.shadow).length;
}
