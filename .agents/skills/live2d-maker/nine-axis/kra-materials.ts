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
export type MaterialRow = { id: string; uuid?: string; partId?: string; bounds?: Bounds; transparent?: boolean; raw?: boolean; texture: string; scope?: 'face' | 'hair' | 'accessory'; shadowSource?: MaterialSelection; studio?: boolean; groupMask?: boolean; fingerprint?: boolean };
export type ShadowContextPart = HeadDeformer & { shadowSource?: MaterialSelection };
type Exported = MaterialRow & { bounds: Bounds; paintDigest?: string };
export type MaterialExport = (document: string, directory: string, rows: MaterialRow[], shadows: string[], signal?: AbortSignal) => Promise<Exported[]>;
type PaintStyle = { id: string; name: string; parent: string; visible: boolean; opacity: number; blend: string; inheritAlpha: boolean };
export type PaintLayer = PaintStyle & { parts: string[]; masked?: boolean };
export type PaintGroup = PaintStyle & { children: PaintStack; passThrough: boolean; masks: string[]; maskAnchor?: string };
export type PaintStack = (PaintLayer | PaintGroup)[];
export type StudioPaintLayer = { uuid: string; texture: string; bounds: Bounds; projection?: ProjectionBinding; groupMask?: boolean };
type NativeProtection = { order: string[]; digests: Record<string, string>; parents?: Record<string, string> };
export type MaterialBuilt = Built & { sourceDocument?: string; sourceRevision?: string; studioLayers?: StudioPaintLayer[]; paintStack?: PaintStack; nativeProtection?: NativeProtection };
export type MaterialLoader = (directory: string, built: Built, signal?: AbortSignal, context?: boolean | 'shadows', protect?: boolean) => Promise<MaterialBuilt>;
export const KRA_MATERIAL_CACHE_VERSION = 3;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const uuid = (value: string) => value.replace(/[{}]/g, '').toLowerCase();
const optional = async (path: string) => {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
};

async function readKraSnapshot(root: string, input: Built['doc']) {
  const document = modelDocument(root, input);
  if (!document) throw Error('九轴模型缺少 source.document');
  const bytes = await readFile(document), layers = kraLayers(kraContents(bytes).xml);
  return { document, layers, revision: hash(bytes), selection: await headMaterialSelection(document, root, { layers, includeHidden: true }) };
}

/** Resolve native layer identities without reading or exporting any pixels. */
export async function bindKraDocument(root: string, input: Built['doc'], snapshot?: Awaited<ReturnType<typeof readKraSnapshot>>) {
  const { document, layers, selection } = snapshot ?? await readKraSnapshot(root, input);
  const doc=structuredClone(withDocument(input,root,document));
  for(const part of doc.parts){
    let id=part.uuid;
    if(!id&&part.material!=='transparent'){
      const candidates=selection.selections.filter(row=>row.id===part.id&&row.role!=='shadow'&&savedLayerVisible(layers,row.uuid));
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
      if (part.shadow) part.shadow = { casters: part.shadow.casters, receivers: part.shadow.receivers };
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
  const { document, layers, revision, selection } = await readKraSnapshot(root, doc);
  return {document,revision,layers:[...layers].map(([uuid,layer])=>({uuid,name:layer.name,type:layer.nodetype,parent:layer.parent??null,order:Number(layer.order),visible:layer.visible!=='0',opacity:Number(layer.opacity??255)/255,blendMode:layer.compositeop??'normal',partId:selection.selections.find(row=>row.uuid===uuid)?.partId,binding:doc.parts.filter(p=>p.uuid===uuid).map(p=>p.id)})),relations:selection.selections.filter(row=>row.role==='shadow')};
}

export function buildPaintStack(layers: ReturnType<typeof kraLayers>, doc: Built['doc'], staticLayers: StudioPaintLayer[]): PaintStack {
  const bound = Map.groupBy(doc.parts.filter(p => p.uuid && p.material !== 'transparent'), p => p.uuid!);
  const byId = new Map(doc.parts.map(part => [part.id, part]));
  const staticById = new Map(staticLayers.map(layer => [layer.uuid, layer]));
  const siblings = Map.groupBy([...layers.keys()].reverse(), id => layers.get(id)!.parent);
  function walk(parent: string): PaintStack {
    const stack: PaintStack = [];
    for (const id of siblings.get(parent) ?? []) {
      const layer = layers.get(id)!;
      const boundParts = bound.get(id);
      const style = { id, name: layer.name ?? id, parent, visible: layer.visible !== '0' ||
        !!boundParts?.every(part => part.role === 'mask'),
        opacity: Number(layer.opacity ?? 255) / 255, blend: layer.compositeop ?? 'normal',
        inheritAlpha: layer.alphainherit === '1' || layer.colorspacename === 'RGBA' && layer.channelflags === '1110' };
      const parts = boundParts?.map(part => part.id).sort();
      const asset = staticById.get(id);
      if (parts?.length) {
        const masked = (siblings.get(id) ?? []).some(child => {
          const node = layers.get(child)!;
          return node.visible !== '0' && node.nodetype.endsWith('mask') && node.nodetype !== 'selectionmask';
        });
        stack.push({ ...style, parts, ...(masked ? { masked } : {}) });
      }
      else if (asset && !asset.groupMask) stack.push({ ...style, parts: ['__studio__/' + id] });
      else if (layer.nodetype === 'grouplayer') {
        const children = walk(id);
        if (children.length) {
          const masks = (siblings.get(id) ?? []).filter(mask => staticById.get(mask)?.groupMask).map(mask => '__studio__/' + mask);
          const unsupported = (siblings.get(id) ?? []).map(child => layers.get(child)!).find(child =>
            child.visible !== '0' && ['filtermask', 'transformmask', 'colorizemask'].includes(child.nodetype));
          if (unsupported && style.visible && layer.passthrough !== '1') throw Error(`${style.name}：九轴暂不支持 KRA 组蒙版 ${unsupported.nodetype}`);
          let back = children[0];
          while ('children' in back) back = back.children[0];
          const maskAnchor = masks.length && back.parts.length === 1 ? byId.get(back.parts[0]) : undefined;
          stack.push({ ...style, children, passThrough: layer.passthrough === '1', masks,
            ...(maskAnchor && !maskAnchor.context && !maskAnchor.shadow && !maskAnchor.role ? { maskAnchor: maskAnchor.id } : {}) });
        }
      }
    }
    return stack;
  }
  return walk('');
}

export function checkNativeProtection(before: MaterialBuilt, after: MaterialBuilt, editable: ReadonlySet<string>) {
  const a = before.nativeProtection, b = after.nativeProtection;
  if (!a || !b) return;
  const protectedOrder = a.order.filter(id => {
    for (let at = id; at; at = a.parents?.[at] ?? '') if (editable.has(at)) return false;
    return true;
  }), ids = new Set(protectedOrder);
  if (b.order.filter(id => ids.has(id)).join() !== protectedOrder.join()) throw Error('KRA 受保护图层的相对顺序或绑定已变化');
  for (const id of protectedOrder) {
    if (a.digests[id] !== b.digests[id]) throw Error(`KRA 受保护图层 ${id} 的原始像素已变化`);
  }
}

/** Native export is read-only. Never reuse a user's open, possibly unsaved,
 * document: the saved KRA revision is the reproducible source of this preview. */
export function nativeMaterialExport(krita: () => Promise<SectionKrita>): MaterialExport {
  return async (document, directory, rows, shadows, signal) => {
    const instance = await krita(); await prepareNeutralBridge(instance, signal);
    const script = join(directory, 'export.py');
    await writeFile(script, `from krita import Krita
from PyQt5.QtGui import QImage
import hashlib, json, os
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
            key = node.uniqueId().toString().strip('{}').lower()
            nodes[key] = node
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
        if row.get('fingerprint'):
            b = node.bounds()
            x, y = min(0, b.x()), min(0, b.y())
            bounds = [x, y, max(doc.width(), b.x() + b.width()) - x, max(doc.height(), b.y() + b.height()) - y]
            raw = bytes(node.pixelData(*bounds))
            digest = hashlib.sha256(str(bounds).encode() + raw).hexdigest()
            exported.append(dict(row, bounds=bounds, paintDigest=digest))
            continue
        if row.get('groupMask'):
            bounds = [0, 0, doc.width(), doc.height()]
        elif bounds is None:
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
            if row.get('groupMask'):
                alpha = bytes(node.pixelData(*rect))
                if len(alpha) != w*h:
                    raise RuntimeError('Invalid transparency mask: ' + row['id'])
                data = bytearray(w*h*4)
                data[3::4] = alpha
                raw = bytes(data)
            else:
                raw = node.pixelData(*rect) if row.get('raw') else node.projectionPixelData(*rect)
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

  async resolve(root: string, directory: string, built: Built, signal?: AbortSignal, context: boolean | 'shadows' | 'studio' = true, protect = false): Promise<MaterialBuilt> {
    signal?.throwIfAborted();
    const snapshot = await readKraSnapshot(root, built.doc), { document, revision, layers, selection } = snapshot;
    const doc = await bindKraDocument(root, built.doc, snapshot);
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
    const groups = new Set<string>();
    for (const row of rows) for (let id = layers.get(row.uuid ?? '')?.parent; id; id = layers.get(id)?.parent) {
      if (bound.has(id)) {
        if (row.bounds) throw Error(`${row.id}：不能同时绑定原生组和组内画层`);
        break;
      }
      groups.add(id);
    }
    for (const [id, layer] of layers) {
      if (layer.nodetype === 'transparencymask' && layer.visible !== '0' && groups.has(layer.parent) && layers.get(layer.parent)?.passthrough !== '1') {
        rows.push({ id: '__studio__/' + id, uuid: id, studio: true, groupMask: true, texture: `${rows.length}.png` });
      }
      if (protect && (layer.nodetype === 'paintlayer' || layer.nodetype === 'transparencymask')) {
        rows.push({ id: '__fingerprint__/' + id, uuid: id, fingerprint: true, texture: '' });
      }
    }
    if(hash(await readFile(document))!==revision)throw Error('KRA 在解析期间已变化，请重试');
    const key = hash(JSON.stringify({ version: KRA_MATERIAL_CACHE_VERSION, revision, rows, shadows: selection.shadowLayerUuids }));
    const cache = join(root, '.cache/nine-axis-materials', key);
    let request = this.pending.get(cache);
    if (!request) {
      request = (async () => {
        const cached = await optional(join(cache, 'materials.json'));
        if (cached) {
          const complete = await Promise.all((cached as Exported[]).map(row => row.fingerprint ? !!row.paintDigest : readFile(join(cache, row.texture)).then(() => true, () => false)));
          if (complete.every(Boolean)) return cached as Exported[];
          await rm(cache, { recursive: true, force: true });
        }
        const temporary = cache + '.' + randomUUID(); await mkdir(temporary, { recursive: true });
        try {
          const exported = await this.exportLayers(document, temporary, rows, selection.shadowLayerUuids, signal);
          if (hash(await readFile(document)) !== revision) throw Error('KRA 在导出期间已变化，请重新预览');
          for (const row of rows.filter(row => row.bounds || row.groupMask || row.fingerprint)) {
            if (!exported.some(result => result.id === row.id)) throw Error('KRA 导出缺少部件：' + row.id);
          }
          for (const row of exported) {
            if (row.fingerprint) continue;
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
    const digests: Record<string, string> = {};
    for (const row of exported) {
      if (row.fingerprint) { digests[row.uuid!] = row.paintDigest!; continue; }
      if (row.studio && row.uuid) {
        const texture = 'studio/' + row.texture;
        textures.set(texture, join(cache, row.texture));
        const projection = selection.projectionBindings.get(row.uuid);
        studioLayers.push({ uuid: row.uuid, texture, bounds: row.bounds,
          ...(projection ? { projection } : {}), ...(row.groupMask ? { groupMask: true } : {}) });
        continue;
      }
      let part = doc.parts.find(part => part.id === row.id);
      if (!part) {
        const [x,y,w,h] = row.bounds, bbox = [x,y,x+w,y+h];
        const base = { id: row.id, level: row.scope!, texture: `layers/context-${row.uuid}.png`, textureBounds: row.bounds, bbox, cols: 1, rows: 1, keyforms: {} };
        const points = lattice(base), rest = Array.from({ length: 4 }, (_, i) => [points[i*2], points[i*2+1]]);
        part = { ...base, uuid: row.uuid, partId: row.partId, context: true, keyforms: { '0': rest }, ...(row.shadowSource?{shadowSource:row.shadowSource}:{}) } as ShadowContextPart;
        doc.parts.push(part);
      }
      textures.set(part.texture!, join(cache, row.texture));
    }
    if (context && rows.some(r => r.scope)) for (const id of ['hair', 'accessory'] as const) {
      if (!doc.levels.some(level => level.id === id)) doc.levels.push({ id, includes: id === 'hair' ? ['face', 'hair'] : ['face', 'hair', 'accessory'] });
    }
    validateHeadNineAxis(doc);
    return { doc, textures, sourceDocument: document, sourceRevision: revision, studioLayers,
      paintStack: buildPaintStack(layers, doc, studioLayers), ...(protect ? { nativeProtection: {
        order: Object.keys(digests), digests, parents: Object.fromEntries([...layers].map(([id, layer]) => [id, layer.parent])),
      } } : {}) };
  }
}
