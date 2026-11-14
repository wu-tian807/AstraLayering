import { nodes, type HeadNineAxis, type WarpGrid } from '../shared/nine-axis-model.js';

export type OwnershipScope = { label: string; allows: (partId: string) => boolean };
export const partPath = (partId: string) => partId.replace(/^(?:character|clothing):/, '');
export const withinPart = (partId: string, root: string) => {
  const path = partPath(partId);
  return path === root || path.startsWith(root + '/') || path.startsWith(root + '::');
};

// Node IDs are handles, not semantic identities. Native bindings carry the
// source part; a carrier owns exactly the leaves it actually transforms.
export function nodeOwners(doc: HeadNineAxis, node: WarpGrid): Set<string> {
  const byId = new Map(nodes(doc).map(n => [n.id, n]));
  const visit = (current: WarpGrid, seen: Set<string>): string[] => {
    if (seen.has(current.id)) throw Error('部件归属存在循环：' + current.id);
    const next = new Set([...seen, current.id]);
    const part = doc.parts.find(p => p.id === current.id);
    if (part) {
      if (part.context) return [];
      if (part.partId) return [partPath(part.partId)];
      if (part.shadow) return part.shadow.casters.flatMap(id => {
        const caster = byId.get(id); return caster ? visit(caster, next) : [];
      });
      // Procedural face masks and legacy face drivers have no native paint.
      return part.level === 'face' ? ['face'] : [];
    }
    return nodes(doc).filter(n => n.parent === current.id).flatMap(n => visit(n, next));
  };
  return new Set(visit(node, new Set()));
}

export function ownsNode(doc: HeadNineAxis, node: WarpGrid, scope: OwnershipScope): boolean {
  const owners = [...nodeOwners(doc, node)];
  return owners.length > 0 && owners.every(scope.allows);
}

export function checkOwnedEdit(before: HeadNineAxis, after: HeadNineAxis, scope: OwnershipScope) {
  const previous = new Map(nodes(before).map(n => [n.id, n]));
  for (const node of nodes(after)) {
    const old = previous.get(node.id);
    if (old && JSON.stringify(old) === JSON.stringify(node)) continue;
    if (old && !ownsNode(before, old, scope) || !ownsNode(after, node, scope))
      throw Error(`${scope.label}：不能修改范围外的部件或承载 Warp：${node.id}`);
  }
  for (const node of nodes(before)) if (!nodes(after).some(n => n.id === node.id) && !ownsNode(before, node, scope))
    throw Error(`${scope.label}：不能删除范围外的节点：${node.id}`);
}
