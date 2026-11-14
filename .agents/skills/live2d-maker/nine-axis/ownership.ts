import { nodes, descendants, type HeadNineAxis, type WarpGrid, type HeadDeformer } from '../shared/nine-axis-model.js';

export type OwnershipScope = { label: string; allows: (partId: string) => boolean;
  includes?: (part: HeadDeformer, doc: HeadNineAxis) => boolean };
export const partPath = (partId: string) => partId.replace(/^(?:character|clothing):/, '');
export const withinPart = (partId: string, root: string) => {
  const path = partPath(partId);
  return path === root || path.startsWith(root + '/') || path.startsWith(root + '::');
};
const bodyOwner=(part:{partId?:string;level:string})=>part.partId?partPath(part.partId)
  :part.level==='face'?'face':part.level==='hair'?'hair':part.level==='accessory'?'head_accessories':undefined;

export function partVisible(part:Pick<HeadDeformer,'id'|'partId'|'context'|'shadow'>&{level:string},doc:HeadNineAxis|undefined,allows:(partId:string)=>boolean,seen=new Set<string>()):boolean {
  if(part.context||seen.has(part.id))return false;
  if(!part.shadow){const owner=bodyOwner(part);return !!owner&&allows(owner);}
  if(!doc)return false;
  const next=new Set([...seen,part.id]);
  return [...part.shadow.casters,...part.shadow.receivers].every(id=>{
    const dependency=doc.parts.find(p=>p.id===id);return !!dependency&&partVisible(dependency,doc,allows,next);
  });
}

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
      if (part.shadow) return [...part.shadow.casters,...part.shadow.receivers].flatMap(id => {
        const caster = byId.get(id); return caster ? visit(caster, next) : [];
      });
      if (part.partId) return [partPath(part.partId)];
      // Procedural drivers have a domain but no native paint identity. A hair
      // domain alone cannot grant a narrower front/side/back round.
      const owner=bodyOwner(part);return owner?[owner]:[];
    }
    return nodes(doc).filter(n => n.parent === current.id).flatMap(n => visit(n, next));
  };
  return new Set(visit(node, new Set()));
}

export function ownsNode(doc: HeadNineAxis, node: WarpGrid, scope: OwnershipScope): boolean {
  const part=doc.parts.find(p=>p.id===node.id);
  if(!part) {
    const ids=descendants(doc,node.id),leaves=doc.parts.filter(p=>ids.has(p.id));
    return leaves.length>0&&leaves.every(p=>ownsNode(doc,p,scope));
  }
  const owners = [...nodeOwners(doc, node)];
  // A projection is produced when both endpoints are available, by the round
  // currently making either endpoint. A carrier must own every painted leaf.
  if(part.shadow&&scope.includes) return owners.some(scope.allows)&&scope.includes(part,doc);
  return owners.length > 0 && owners.every(scope.allows);
}

export function previewAvailability(doc:HeadNineAxis,node:WarpGrid,includes:NonNullable<OwnershipScope['includes']>) {
  const part=doc.parts.find(p=>p.id===node.id);
  if(!part) {
    const ids=descendants(doc,node.id);
    return {available:doc.parts.some(p=>ids.has(p.id)&&includes(p,doc)),waitingFor:[] as string[]};
  }
  const waitingFor=part.shadow?[...new Set([...part.shadow.casters,...part.shadow.receivers])].filter(id=>{
    const dependency=doc.parts.find(p=>p.id===id);return !dependency||!includes(dependency,doc);
  }):[];
  return {available:includes(part,doc),waitingFor};
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
