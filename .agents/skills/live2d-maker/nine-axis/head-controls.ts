import { editNineAxis } from '../shared/nine-axis-edit.js';
import { nodes, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { ownsNode, partVisible, withinPart, type OwnershipScope } from './ownership.ts';
import { pairId } from './head.ts';

export const wholeHeadPart = (id: string) => ['face', 'hair', 'head_accessories'].some(root => withinPart(id, root));
export const wholeHeadScope: OwnershipScope = {
  label: '完整头部', allows: wholeHeadPart,
  includes: (part, doc) => partVisible(part, doc, id => wholeHeadPart(id) || withinPart(id, 'neck')),
};

// Identity controls share each leaf's native parent, leaving fixed neck/body
// leaves outside the editable head groups. No upstream pose is resampled.
export function prepareHeadControls(document: HeadNineAxis, prefix: string, name: string, saved?: HeadNineAxis): HeadNineAxis {
  let doc = structuredClone(document);
  const byId = new Map(nodes(doc).map(node => [node.id, node]));
  const paired = (id: string) => byId.get(id)?.mirror ?? pairId(id);
  const parts = doc.parts.filter(part => !part.context && ownsNode(doc, part, wholeHeadScope));
  const paint = new Map(parts.filter(part => !part.shadow && part.role !== 'mask').map(part => [part.id, part]));
  const savedParents = new Map(saved?.parts.map(part => [part.id, part.parent]));
  const separate = new Set<string>();
  for (const [id, part] of paint) {
    const peer = paint.get(paired(id)), oldParent = savedParents.get(id);
    if (!peer || peer.id === id || paired(peer.id) !== id || peer.parent !== part.parent) continue;
    // Preserve an existing author's shared carrier when resuming old work.
    if (oldParent?.startsWith(prefix + '/') && oldParent === savedParents.get(peer.id)) continue;
    separate.add(id);
  }
  const groups = new Map<string, { parentId: string; targets: string[] }>();
  const groupByPart = new Map<string, string>();
  for (const part of parts) {
    const parent = part.parent ?? '';
    const caster = part.shadow?.casters.length === 1 ? paint.get(part.shadow.casters[0]) : undefined;
    const tiedToCaster = caster && separate.has(caster.id) && caster.parent === part.parent;
    const group = separate.has(part.id) ? part.id : tiedToCaster ? caster.id : parent;
    const entry = groups.get(group) ?? { parentId: parent, targets: [] };
    entry.targets.push(part.id);
    groups.set(group, entry);
    groupByPart.set(part.id, group);
  }
  const controls = new Map<string, string>();
  let serial = 0;
  for (const [group, { parentId, targets }] of groups) {
    let id: string; do { id = `${prefix}/${serial++}`; } while (byId.has(id));
    const parent = byId.get(parentId), leaves = targets.map(target => doc.parts.find(part => part.id === target)!);
    const bbox = (group === parentId ? parent?.bbox : undefined) ?? [Math.min(...leaves.map(part => part.bbox[0])), Math.min(...leaves.map(part => part.bbox[1])),
      Math.max(...leaves.map(part => part.bbox[2])), Math.max(...leaves.map(part => part.bbox[3]))];
    const inheritedCols = parent?.cols ?? 4, inheritedRows = parent?.rows ?? 4;
    const existing = saved?.deformers.find(node => node.id === id);
    // Saved authors can still have the previous parent-sized lattice.
    const legacy = existing?.cols === inheritedCols && existing.rows === inheritedRows;
    doc = editNineAxis(doc, [{ action: 'create_warp', id, name, level: leaves[0].level, bbox,
      cols: legacy ? inheritedCols : Math.max(2, Math.min(inheritedCols, 4)),
      rows: legacy ? inheritedRows : Math.max(2, Math.min(inheritedRows, 4)),
      parent: parentId || undefined, targets: [] }]);
    for (const part of doc.parts) if (targets.includes(part.id)) part.parent = id;
    controls.set(group, id);
  }
  const pairs = new Map<string, string>();
  for (const [group, { parentId, targets }] of groups) {
    const peer = paired(parentId);
    if (group === parentId && peer !== parentId && controls.has(peer)) { pairs.set(group, peer); continue; }
    const matches = targets.filter(id => paint.has(id)).map(id => groupByPart.get(paired(id)));
    const match = matches[0];
    if (match !== undefined && match !== group && matches.every(id => id === match)) pairs.set(group, match);
  }
  const warps = new Map(doc.deformers.map(node => [node.id, node]));
  for (const [group, peer] of pairs) {
    if (pairs.get(peer) === group) warps.get(controls.get(group)!)!.mirror = controls.get(peer)!;
  }
  return doc;
}
