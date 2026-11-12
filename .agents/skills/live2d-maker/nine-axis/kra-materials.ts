import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fromTaskPath } from '../shared/task-paths.ts';
import sharp from 'sharp';
import { kraContents, kraLayers } from '../shadow/delivery.ts';
import { submitJob } from '../shared/krita/bridge/client.mjs';
import type { SectionKrita } from '../shared/krita/section-krita.ts';
import { lattice, validateHeadNineAxis, type HeadDeformer } from '../shared/nine-axis-model.js';
import { headMaterialSelection, type MaterialSelection } from './materials.ts';
import { modelDocument, withDocument } from './source.ts';
import { prepareNeutralBridge } from './neutral.ts';
import type { Built } from './head.ts';

type Bounds = [number, number, number, number];
export type MaterialRow = { id: string; uuid?: string; bounds?: Bounds; transparent?: boolean; raw?: boolean; texture: string; scope?: 'face' | 'hair' | 'accessory'; shadowSource?: MaterialSelection };
export type ShadowContextPart = HeadDeformer & { shadowSource?: MaterialSelection };
type Exported = MaterialRow & { bounds: Bounds };
export type MaterialExport = (document: string, directory: string, rows: MaterialRow[], shadows: string[], signal?: AbortSignal) => Promise<Exported[]>;
export type MaterialBuilt = Built & { sourceDocument?: string; sourceRevision?: string };
export type MaterialLoader = (directory: string, built: Built, signal?: AbortSignal, context?: boolean | 'shadows') => Promise<MaterialBuilt>;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const uuid = (value: string) => value.replace(/[{}]/g, '').toLowerCase();
const optional = async (path: string) => {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
};

/** Resolve native layer identities without reading or exporting any pixels. */
export async function bindKraDocument(root: string, directory: string, input: Built['doc']) {
  const document = await modelDocument(root,directory,input);
  if (!document) throw Error('九轴模型缺少 source.document');
  const bytes=await readFile(document),layers=kraLayers(kraContents(bytes).xml),selection=await headMaterialSelection(document,root);
  const receipt=await optional(join(directory,'export-record.json')),doc=structuredClone(withDocument(input,root,document));
  const bind=(value: Built['doc'], primary: boolean)=>{
    for(const part of value.parts){
      const legacy=primary&&!input.source?.geometryDocument&&receipt?.document?receipt.parts?.find((p:any)=>p.id===part.id):undefined;
      let id=legacy?.uuid??part.uuid;
      if(!id&&part.material!=='transparent'){
        const candidates=selection.selections.filter(row=>row.id===part.id&&row.role!=='shadow');
        if(candidates.length===1)id=candidates[0].uuid;
        else{const candidates=[...layers].filter(([,layer])=>(layer.name??'').split(' | ').at(-1)===part.id);if(candidates.length===1)id=candidates[0][0];}
      }
      if(part.material==='transparent'||!id&&part.texture==='layers/mirror-grid-transparent.png'){part.material='transparent';delete part.uuid;}
      else{
        if(!id||!layers.has(uuid(id)))throw Error(`${part.id}：没有有效的 KRA 图层 UUID；请绑定保存后的图层`);
        part.uuid=uuid(id);
        if(part.shadow){const layer=layers.get(part.uuid)!,blendMode=layer.compositeop??'normal';
          if(blendMode!=='normal'&&blendMode!=='multiply')throw Error(`${part.id}：暂不支持 ${blendMode} 混合模式`);
          part.shadow={...part.shadow,blendMode,opacity:Number(layer.opacity??255)/255};}
      }
    }

  };
  bind(doc,true);
  // Source trees supply geometry only. Their known UUIDs refer to historical
  // artwork and need not still exist in the edited document being rendered.
  for(const axis of doc.axisSources??[])if(axis.doc.parts.some(p=>!p.uuid&&p.material!=='transparent')){
    const source=axis.doc.source?.document;
    const path=source?fromTaskPath(root,source):undefined;
    if(path&&await readFile(path).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;}))
      axis.doc=await bindKraDocument(root,dirname(path),axis.doc);
    else bind(axis.doc,false); // Legacy bundles may keep only the final KRA.
  }
  return doc;
}

/** Saved document inventory; relations are candidates from upstream metadata,
 * never a selection or an implicit edit. Pixel inspection stays in Krita. */
export async function kraCatalog(root: string,directory: string,doc: Built['doc']){
  const document=await modelDocument(root,directory,doc);if(!document)throw Error('缺少 KRA 来源');
  const bytes=await readFile(document),layers=kraLayers(kraContents(bytes).xml),selection=await headMaterialSelection(document,root);
  return {document,revision:hash(bytes),layers:[...layers].map(([uuid,layer])=>({uuid,name:layer.name,type:layer.nodetype,parent:layer.parent??null,visible:layer.visible!=='0',opacity:Number(layer.opacity??255)/255,blendMode:layer.compositeop??'normal',binding:doc.parts.filter(p=>p.uuid===uuid).map(p=>p.id)})),relations:selection.selections.filter(row=>row.role==='shadow')};
}

/** Native export is read-only. Never reuse a user's open, possibly unsaved,
 * document: the saved KRA revision is the reproducible source of this preview. */
export function nativeMaterialExport(krita: () => Promise<SectionKrita>): MaterialExport {
  return async (document, directory, rows, shadows, signal) => {
    const instance = await krita(); await prepareNeutralBridge(instance, signal);
    const script = join(directory, 'export.py');
    await writeFile(script, `from krita import Krita
from PyQt5.QtGui import QImage
import json, os
config = json.loads(${JSON.stringify(JSON.stringify({ document, directory, rows, shadows }))})
doc = Krita.instance().openDocument(config['document'])
if doc is None:
    raise RuntimeError('Cannot open KRA: ' + config['document'])
try:
    doc.setBatchmode(True)
    doc.waitForDone()
    if doc.colorModel() != 'RGBA' or doc.colorDepth() != 'U8':
        raise RuntimeError('KRA must be RGBA/U8')
    nodes = {}
    def collect(parent):
        for node in parent.childNodes():
            nodes[node.uniqueId().toString().strip('{}').lower()] = node
            collect(node)
    collect(doc.rootNode())
    for key in config['shadows']:
        if key in nodes:
            nodes[key].setVisible(False)
    doc.refreshProjection()
    doc.waitForDone()
    exported = []
    for row in config['rows']:
        node = nodes.get(row.get('uuid'))
        if not row.get('transparent') and node is None:
            raise RuntimeError('Missing KRA layer: ' + row['id'])
        bounds = row.get('bounds')
        if bounds is None:
            b = node.bounds()
            bounds = [b.x(), b.y(), b.width(), b.height()]
        x, y, w, h = bounds
        if w <= 0 or h <= 0:
            continue
        if row.get('transparent'):
            image = QImage(w, h, QImage.Format_ARGB32)
            image.fill(0)
        else:
            raw = node.pixelData(x,y,w,h) if row.get('raw') else node.projectionPixelData(x,y,w,h)
            if len(raw) != w*h*4:
                raise RuntimeError('Invalid pixels: ' + row['id'])
            image = QImage(raw,w,h,QImage.Format_ARGB32).copy()
        if not image.save(os.path.join(config['directory'], row['texture']), 'PNG'):
            raise RuntimeError('Export failed: ' + row['id'])
        exported.append(dict(row, bounds=bounds))
finally:
    # Visibility changes belong only to this derived read. Discard them before
    # closing so Krita never asks to save the source document.
    doc.setModified(False)
    doc.close()
result = exported
`);
    const reply = await submitJob(instance.bridge!, script, { signal });
    if (!reply.ok || !Array.isArray(reply.result)) throw Error('九轴 KRA 图层导出失败：' + (reply.error || reply.stderr || JSON.stringify(reply.hints)));
    return reply.result as Exported[];
  };
}

/** A content-addressed derived cache shared by agent tools and the workbench.
 * JSON describes geometry/UUID bindings; PNG never selects the source artwork. */
export class KraMaterials {
  private pending = new Map<string, Promise<Exported[]>>();
  private exportLayers: MaterialExport;
  constructor(exportLayers: MaterialExport) { this.exportLayers = exportLayers; }

  async resolve(root: string, directory: string, built: Built, signal?: AbortSignal, context: boolean | 'shadows' = true): Promise<MaterialBuilt> {
    const document = await modelDocument(root, directory, built.doc);
    if (!document) throw Error('九轴模型缺少 source.document；请指定实际 KRA 来源');
    signal?.throwIfAborted();
    const bytes = await readFile(document), revision = hash(bytes), layers = kraLayers(kraContents(bytes).xml);
    const selection = await headMaterialSelection(document, root), receipt = await optional(join(directory, 'export-record.json'));
    const doc = await bindKraDocument(root,directory,built.doc);
    const bound = new Set<string>(), rows: MaterialRow[] = [], textureBindings = new Map<string,string>();
    for (const [index,part] of doc.parts.entries()) {
      part.texture ??= `layers/material-${index}.png`;
      const id=part.uuid,transparent=part.material==='transparent';
      if(id)bound.add(id);
      const bounds = part.textureBounds as Bounds;
      if (bounds.some(n => !Number.isSafeInteger(n))) throw Error(`${part.id}：KRA 导出范围须为整数像素`);
      const binding = transparent ? 'transparent' : JSON.stringify([part.uuid, bounds]);
      if (textureBindings.has(part.texture!) && textureBindings.get(part.texture!) !== binding) throw Error(`${part.id}：不同 KRA 图层或导出范围须使用不同 texture 路径`);
      textureBindings.set(part.texture!,binding);
      rows.push({ id: part.id, ...(id ? { uuid: uuid(id) } : {}), bounds, transparent,
        ...(part.shadow ? {raw:true}:{}), texture: `${rows.length}.png` });
    }
    if (context) for (const material of selection.selections) {
      if (bound.has(material.uuid)) continue;
      if (material.role==='shadow') {
        if(context==='shadows') rows.push({id:`__shadow__/${material.uuid}`,uuid:material.uuid,scope:material.scope,raw:true,shadowSource:material,texture:`${rows.length}.png`});
        continue;
      }
      if (material.scope === 'face') continue;
      const layer = layers.get(material.uuid)!;
      // Honour saved visibility through all ancestors, including hidden backups.
      let visible = true;
      for (let at: string = material.uuid; at; at = layers.get(at)?.parent ?? '') if (layers.get(at)?.visible === '0') visible = false;
      if (visible) rows.push({ id: `__kra__/${material.uuid}`, uuid: material.uuid, scope: material.scope, texture: `${rows.length}.png` });
    }
    if(hash(await readFile(document))!==revision)throw Error('KRA 在解析期间已变化，请重试');
    const key = hash(JSON.stringify({ version: 1, revision, rows, shadows: selection.shadowLayerUuids }));
    const cache = join(root, '.cache/nine-axis-materials', key);
    let request = this.pending.get(cache);
    if (!request) {
      request = (async () => {
        const cached = await optional(join(cache, 'materials.json'));
        if (cached) {
          const complete = await Promise.all((cached as Exported[]).map(row => readFile(join(cache, row.texture)).then(() => true, () => false)));
          if (complete.every(Boolean)) return cached as Exported[];
          await rm(cache, { recursive: true, force: true });
        }
        const temporary = cache + '.' + randomUUID(); await mkdir(temporary, { recursive: true });
        try {
          const exported = await this.exportLayers(document, temporary, rows, selection.shadowLayerUuids, signal);
          if (hash(await readFile(document)) !== revision) throw Error('KRA 在导出期间已变化，请重新预览');
          for (const row of rows.filter(row => row.bounds)) if (!exported.some(result => result.id === row.id)) throw Error('KRA 导出缺少部件：' + row.id);
          for (const row of exported) {
            const meta = await sharp(join(temporary, row.texture)).metadata();
            if (meta.width !== row.bounds[2] || meta.height !== row.bounds[3]) throw Error('KRA 导出范围不符：' + row.id);
          }
          await writeFile(join(temporary, 'materials.json'), JSON.stringify(exported));
          await rename(temporary, cache).catch(error => {
            // Another process may have exported the same immutable revision.
            // Never delete a complete cache still used by an in-flight preview.
            if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
          });
          return exported;
        } finally { await rm(temporary, { recursive: true, force: true }); }
      })();
      this.pending.set(cache, request);
    }
    let exported: Exported[];
    try { exported = await request; } finally { if (this.pending.get(cache) === request) this.pending.delete(cache); }
    const textures = new Map<string, string>();
    for (const row of exported) {
      let part = doc.parts.find(part => part.id === row.id);
      if (!part) {
        const [x,y,w,h] = row.bounds, bbox = [x,y,x+w,y+h];
        const base = { id: row.id, level: row.scope!, texture: `layers/context-${row.uuid}.png`, textureBounds: row.bounds, bbox, cols: 1, rows: 1, keyforms: {} };
        const points = lattice(base), rest = Array.from({ length: 4 }, (_, i) => [points[i*2], points[i*2+1]]);
        part = { ...base, uuid: row.uuid, keyforms: { '0': rest }, ...(row.shadowSource?{shadowSource:row.shadowSource}:{}) } as ShadowContextPart;
        // Insert static artwork around the KRA-backed parts without changing
        // the author's explicit face/jaw draw order.
        const order = Number(layers.get(row.uuid!)?.order);
        const above = doc.parts.findIndex(p => p.uuid && Number(layers.get(p.uuid)?.order) < order);
        doc.parts.splice(above < 0 ? doc.parts.length : above, 0, part);
      }
      textures.set(part.texture!, join(cache, row.texture));
    }
    if (context && rows.some(r => r.scope)) for (const id of ['hair', 'accessory'] as const) {
      if (!doc.levels.some(level => level.id === id)) doc.levels.push({ id, includes: id === 'hair' ? ['face', 'hair'] : ['face', 'hair', 'accessory'] });
    }
    validateHeadNineAxis(doc);
    return { doc, textures, sourceDocument: document, sourceRevision: revision };
  }
}
