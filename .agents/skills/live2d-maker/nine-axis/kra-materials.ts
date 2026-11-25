import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { kraContents, kraLayers } from '../shadow/delivery.ts';
import { layerPartName } from '../shared/layer-names.ts';
import { submitJob } from '../shared/krita/bridge/client.mjs';
import type { SectionKrita } from '../shared/krita/section-krita.ts';
import { lattice, validateHeadNineAxis, type HeadDeformer } from '../shared/nine-axis-model.js';
import { headMaterialSelection, savedLayerVisible, type MaterialSelection, type ProjectionBinding } from './materials.ts';
import { modelDocument, withDocument } from './source.ts';
import { prepareNeutralBridge } from './neutral.ts';
import type { Built } from './head.ts';

type Bounds = [number, number, number, number];
export type MaterialRow = { id: string; uuid?: string; partId?: string; bounds?: Bounds; transparent?: boolean; raw?: boolean; texture: string; scope?: 'face' | 'hair' | 'accessory'; shadowSource?: MaterialSelection; studio?: boolean };
export type ShadowContextPart = HeadDeformer & { shadowSource?: MaterialSelection };
type Exported = MaterialRow & { bounds: Bounds };
export type MaterialExport = (document: string, directory: string, rows: MaterialRow[], shadows: string[], signal?: AbortSignal) => Promise<Exported[]>;
export type StudioPaintLayer = { uuid: string; texture: string; bounds: Bounds; order: number; visible: boolean; opacity: number; blend: string; projection?: ProjectionBinding };
export type MaterialBuilt = Built & { sourceDocument?: string; sourceRevision?: string; studioLayers?: StudioPaintLayer[] };
export type MaterialLoader = (directory: string, built: Built, signal?: AbortSignal, context?: boolean | 'shadows') => Promise<MaterialBuilt>;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const uuid = (value: string) => value.replace(/[{}]/g, '').toLowerCase();
const optional = async (path: string) => {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
};

/** Resolve native layer identities without reading or exporting any pixels. */
export async function bindKraDocument(root: string, input: Built['doc']) {
  const document = modelDocument(root, input);
  if (!document) throw Error('九轴模型缺少 source.document');
  const bytes=await readFile(document),layers=kraLayers(kraContents(bytes).xml),selection=await headMaterialSelection(document,root);
  const doc=structuredClone(withDocument(input,root,document));
  for(const part of doc.parts){
    let id=part.uuid;
    if(!id&&part.material!=='transparent'){
      const candidates=selection.selections.filter(row=>row.id===part.id&&row.role!=='shadow');
      if(candidates.length===1)id=candidates[0].uuid;
      else{const candidates=[...layers].filter(([,layer])=>layerPartName(layer.name??'').name===part.id);if(candidates.length===1)id=candidates[0][0];}
    }
    if(part.material==='transparent'){part.material='transparent';delete part.uuid;}
    else{
      if(!id||!layers.has(uuid(id)))throw Error(`${part.id}：没有有效的 KRA 图层 UUID；请绑定保存后的图层`);
      part.uuid=uuid(id);
      const native = selection.selections.find(row => row.uuid === part.uuid);
      if (native) { part.partId = native.partId; part.level = native.scope; }
      else if (part.level !== 'face' && !part.partId) throw Error(`${part.id}：新画层须指定原部件 partId`);
      if (part.partId && !selection.selections.some(row => row.partId === part.partId))
        throw Error(`${part.id}：partId 不属于当前 KRA 部件目录`);
      if (!native && part.partId) part.level = selection.selections.find(row => row.partId === part.partId)!.scope;
      if(part.shadow){const layer=layers.get(part.uuid)!,blendMode=layer.compositeop??'normal';
        if(blendMode!=='normal'&&blendMode!=='multiply')throw Error(`${part.id}：暂不支持 ${blendMode} 混合模式`);
        part.shadow={...part.shadow,blendMode,opacity:Number(layer.opacity??255)/255};}
    }
  }
  // Source trees supply geometry only. Their known UUIDs refer to historical
  // artwork and need not still exist in the edited document being rendered.
  for(const axis of doc.axisSources??[])if(axis.doc.parts.some(p=>!p.uuid&&p.material!=='transparent')){
    axis.doc=await bindKraDocument(root, axis.doc);
  }
  return doc;
}

/** Saved document inventory; relations are candidates from upstream metadata,
 * never a selection or an implicit edit. Pixel inspection stays in Krita. */
export async function kraCatalog(root: string,doc: Built['doc']){
  const document=modelDocument(root, doc);if(!document)throw Error('缺少 KRA 来源');
  const bytes=await readFile(document),layers=kraLayers(kraContents(bytes).xml),selection=await headMaterialSelection(document,root);
  return {document,revision:hash(bytes),layers:[...layers].map(([uuid,layer])=>({uuid,name:layer.name,type:layer.nodetype,parent:layer.parent??null,visible:layer.visible!=='0',opacity:Number(layer.opacity??255)/255,blendMode:layer.compositeop??'normal',partId:selection.selections.find(row=>row.uuid===uuid)?.partId,binding:doc.parts.filter(p=>p.uuid===uuid).map(p=>p.id)})),relations:selection.selections.filter(row=>row.role==='shadow')};
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
    nodes, parents, children, masked_groups = {}, {}, {}, set()
    def collect(parent, parent_id=''):
        children[parent_id] = []
        for node in parent.childNodes():
            key = node.uniqueId().toString().strip('{}').lower()
            nodes[key] = node
            parents[key] = parent_id
            children[parent_id].append(key)
            if parent_id and parent.type() == 'grouplayer' and node.type() == 'transparencymask' and node.visible():
                masked_groups.add(parent_id)
            collect(node, key)
    collect(doc.rootNode())
    for key in config['shadows']:
        if key in nodes:
            nodes[key].setVisible(False)
    doc.refreshProjection()
    doc.waitForDone()

    def projected(key, rect):
        # Child projections omit masks attached to ancestor groups. Read the
        # outermost masked group with just this branch and its masks visible.
        branch, group = [], None
        at = key
        while parents[at]:
            parent = parents[at]
            branch.append((parent, at))
            if parent in masked_groups:
                group = parent
            at = parent
        if group is None:
            return nodes[key].projectionPixelData(*rect)
        hidden = []
        try:
            for parent, child in branch:
                for sibling in children[parent]:
                    node = nodes[sibling]
                    if sibling != child and not node.type().endswith('mask') and node.visible():
                        hidden.append(node)
                        node.setVisible(False)
                if parent == group:
                    break
            if hidden:
                doc.refreshProjection()
                doc.waitForDone()
            return nodes[group].projectionPixelData(*rect)
        finally:
            for node in hidden:
                node.setVisible(True)
            if hidden:
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
            rect = (x, y, w, h)
            raw = node.pixelData(*rect) if row.get('raw') else projected(row['uuid'], rect)
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

  async resolve(root: string, directory: string, built: Built, signal?: AbortSignal, context: boolean | 'shadows' | 'studio' = true): Promise<MaterialBuilt> {
    const document = modelDocument(root, built.doc);
    if (!document) throw Error('九轴模型缺少 source.document；请指定实际 KRA 来源');
    signal?.throwIfAborted();
    const bytes = await readFile(document), revision = hash(bytes), layers = kraLayers(kraContents(bytes).xml);
    const selection = await headMaterialSelection(document, root);
    const doc = await bindKraDocument(root, built.doc);
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
    if (context === 'studio') {
      const shadows = new Set(selection.shadowLayerUuids);
      for (const [id, layer] of layers) if (!bound.has(id) && layer.nodetype === 'paintlayer') {
        rows.push({ id: '__studio__/' + id, uuid: id, texture: `${rows.length}.png`, studio: true, raw: shadows.has(id) });
      }
    } else if (context) for (const material of selection.selections) {
      if (bound.has(material.uuid)) continue;
      if (material.role==='shadow') {
        if(context==='shadows') rows.push({id:`__shadow__/${material.uuid}`,uuid:material.uuid,scope:material.scope,raw:true,shadowSource:material,texture:`${rows.length}.png`});
        continue;
      }
      if (material.scope === 'face') continue;
      if (savedLayerVisible(layers, material.uuid)) rows.push({ id: `__kra__/${material.uuid}`, uuid: material.uuid, partId: material.partId, scope: material.scope, texture: `${rows.length}.png` });
    }
    if(hash(await readFile(document))!==revision)throw Error('KRA 在解析期间已变化，请重试');
    const key = hash(JSON.stringify({ version: 2, revision, rows, shadows: selection.shadowLayerUuids }));
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
    const textures = new Map<string, string>(), studioLayers: StudioPaintLayer[] = [];
    const nativeOrder = new Map<string, number>();
    if (context === 'studio') {
      const orderByUuid = new Map(doc.parts.flatMap((part, index) => part.uuid && !part.role ? [[part.uuid, index] as const] : []));
      let foregroundLimit = doc.parts.length, index = 0;
      for (const [id] of layers) {
        // KRA layers come in front-to-back order. An authored layer can move
        // ahead of an earlier anchor, but static paint must stay behind both.
        foregroundLimit = Math.min(foregroundLimit, orderByUuid.get(id) ?? foregroundLimit);
        nativeOrder.set(id, foregroundLimit - .25 - .5 * index++ / layers.size);
      }
    }
    for (const row of exported) {
      if (row.studio && row.uuid) {
        const layer = layers.get(row.uuid)!;
        const texture = 'studio/' + row.texture;
        textures.set(texture, join(cache, row.texture));
        const projection = selection.projectionBindings.get(row.uuid);
        studioLayers.push({ uuid: row.uuid, texture, bounds: row.bounds, order: nativeOrder.get(row.uuid)!,
          visible: savedLayerVisible(layers, row.uuid), opacity: Number(layer.opacity ?? 255), blend: layer.compositeop ?? 'normal',
          ...(projection ? { projection } : {}) });
        continue;
      }
      let part = doc.parts.find(part => part.id === row.id);
      if (!part) {
        const [x,y,w,h] = row.bounds, bbox = [x,y,x+w,y+h];
        const base = { id: row.id, level: row.scope!, texture: `layers/context-${row.uuid}.png`, textureBounds: row.bounds, bbox, cols: 1, rows: 1, keyforms: {} };
        const points = lattice(base), rest = Array.from({ length: 4 }, (_, i) => [points[i*2], points[i*2+1]]);
        part = { ...base, uuid: row.uuid, partId: row.partId, context: true, keyforms: { '0': rest }, ...(row.shadowSource?{shadowSource:row.shadowSource}:{}) } as ShadowContextPart;
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
    return { doc, textures, sourceDocument: document, sourceRevision: revision, ...(context === 'studio' ? { studioLayers } : {}) };
  }
}
