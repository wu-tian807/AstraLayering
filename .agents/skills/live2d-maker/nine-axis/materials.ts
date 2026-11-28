import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { kraContents, kraLayers } from '../shadow/delivery.ts';
import { layerPartName, matchLayerPart } from '../shared/layer-names.ts';
import { partPath } from './ownership.ts';

type Scope = 'face' | 'hair' | 'accessory';
export type ProjectionBinding = { casters: string[]; receivers: string[] };
export type MaterialSelection = {
  uuid: string; id: string; partId: string; scope: Scope; role?: 'shadow';
  casterPartId?: string; receiverPartIds?: string[]; receiverLayerUuids?: string[]; follow?: string;
};
const uuid = (value: string) => value.replace(/[{}]/g, '').toLowerCase();
export function savedLayerVisible(layers: Map<string, Record<string, string>>, layerId: string): boolean {
  for (let at = layerId; at; at = layers.get(at)?.parent ?? '') if (layers.get(at)?.visible === '0') return false;
  return true;
}
const scopeOf = (id: string): Scope | undefined => {
  const path = partPath(id);
  if (path === 'face' || path.startsWith('face/') || path === 'neck' || path.startsWith('neck/')) return 'face';
  if (path === 'hair' || path.startsWith('hair/')) return 'hair';
  if (path === 'head_accessories' || path.startsWith('head_accessories/') || path.startsWith('head_accessories::')) return 'accessory';
};

// Shadow production already identifies the real source and receiver layers.
// Prefer those UUIDs to a receiver container's name. Name matching remains a
// fallback for artwork that has not gone through shadow production.
export function selectHeadMaterials(layers: Map<string, Record<string, string>>, partIds: string[], shadows: any[], includeHidden = false): MaterialSelection[] {
  const selected = new Map<string, MaterialSelection>(), shadowIds = new Set(shadows.map(s => uuid(s.shadowLayerUuid ?? '')));
  for (const shadow of shadows) {
    for (const [ids, parts] of [[shadow.casterLayerUuids, [shadow.casterPartId]], [shadow.receiverLayerUuids, shadow.receiverPartIds]] as const) {
      for (const [i, layerId] of (ids ?? []).entries()) {
        const partId = parts?.length === 1 ? parts[0] : parts?.[i], scope = typeof partId === 'string' ? scopeOf(partId) : undefined;
        if (scope && layers.has(uuid(layerId))) selected.set(uuid(layerId), { uuid: uuid(layerId), id: partPath(partId), partId, scope });
      }
    }
  }
  for (const [layerId, layer] of layers) {
    if (selected.has(layerId) || shadowIds.has(layerId) || layer.nodetype.endsWith('mask') || !includeHidden && !savedLayerVisible(layers, layerId)) continue;
    const name = layerPartName(layer.name ?? '').name, partId = matchLayerPart(layer.name ?? '', partIds);
    const scope = partId ? scopeOf(partId) : undefined;
    if (partId && scope) selected.set(layerId, { uuid: layerId, id: name, partId, scope });
  }
  const descendant = (child: string, parent: string) => {
    for (let at = layers.get(child)?.parent; at; at = layers.get(at)?.parent) if (at === parent) return true;
    return false;
  };
  // Never export the same part twice through its receiver group and paint layer.
  for (const layerId of selected.keys()) {
    if (layers.get(layerId)?.nodetype !== 'grouplayer') continue;
    if ([...selected.values()].some(other => other.uuid !== layerId && descendant(other.uuid, layerId))) selected.delete(layerId);
  }
  // A shadow belongs to its caster even when physically stored under a receiver.
  for (const shadow of shadows) {
    const scope = scopeOf(shadow.casterPartId ?? ''), layerId = uuid(shadow.shadowLayerUuid ?? '');
    if (!scope || !layers.has(layerId)) continue;
    selected.set(layerId, { uuid: layerId, id: shadow.id ?? layerId, partId: shadow.casterPartId, scope, role: 'shadow',
      casterPartId: shadow.casterPartId, receiverPartIds: shadow.receiverPartIds ?? [],
      receiverLayerUuids: (shadow.receiverLayerUuids ?? []).map(uuid), follow: shadow.follow });
  }
  const values = [...selected.values()];
  for (const [id, paints] of Map.groupBy(values.filter(row => !row.role), row => row.id)) {
    if (paints.length > 1) for (const paint of paints) paint.id = `${id}::${paint.uuid}`;
  }
  return values;
}

export async function headMaterialSelection(document: string, taskRoot: string,
  options: { layers?: ReturnType<typeof kraLayers>; includeHidden?: boolean } = {}) {
  const layers = options.layers ?? kraLayers(kraContents(await readFile(document)).xml), partIds: string[] = [];
  const walk = (groups: any[]) => { for (const group of groups) { partIds.push('character:' + group.id); walk(group.groups ?? []); } };
  const optional = async (path: string) => {
    try { return JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  };
  walk((await optional(join(taskRoot, 'part-layering/groups.json')))?.groups ?? []);
  // Old materials still have semantic layer names, even without a groups file.
  if (!partIds.length) for (const layer of layers.values()) {
    const name = layerPartName(layer.name ?? '').name;
    if (scopeOf(name)) partIds.push('character:' + name);
  }
  const shadows = (await optional(join(taskRoot, 'shadow/step01_mask/shadows.json')))?.shadows ?? [];
  const selected = new Map(selectHeadMaterials(layers, [...new Set(partIds)], shadows, options.includeHidden).map(row=>[row.uuid,row]));
  // Preparation already resolved semantic parts to native UUIDs. That binding
  // survives later display-name changes and regrouping in editable KRA files.
  const manifest = await optional(join(taskRoot,'nine-axis/step01_preparation/head_parts_manifest.json'));
  for(const row of [...manifest?.parts??[],...manifest?.referenceLayers??[],...manifest?.shadowLayers??[]]) {
    const key=uuid(row.uuid??'');if(!layers.has(key)||!row.partId||!row.scope)continue;
    const previous=selected.get(key);
    selected.set(key,{...previous,uuid:key,id:row.id,partId:row.partId,scope:row.scope,
      ...(row.materialRole==='shadow'?{role:'shadow',casterPartId:row.casterPartId,receiverPartIds:row.receiverPartIds??[],receiverLayerUuids:row.receiverLayerUuids??[],follow:row.follow}:{})});
  }
  const selections = [...selected.values()];
  const projectionBindings = new Map<string, ProjectionBinding>();
  for (const shadow of shadows) {
    if (!shadow.shadowLayerUuid) continue;
    projectionBindings.set(uuid(shadow.shadowLayerUuid), {
      casters: (shadow.casterLayerUuids ?? []).map(uuid),
      receivers: (shadow.receiverLayerUuids ?? []).map(uuid),
    });
  }
  for (const row of selections) if (row.role === 'shadow' && !projectionBindings.has(row.uuid)) {
    projectionBindings.set(row.uuid, {
      casters: selections.filter(part => !part.role && part.partId === row.casterPartId).map(part => part.uuid),
      receivers: (row.receiverLayerUuids ?? []).map(uuid),
    });
  }
  return { selections, shadowLayerUuids: [...projectionBindings.keys()], projectionBindings };
}
