import { editNineAxis } from '../shared/nine-axis-edit.js';
import { nodes, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { ownsNode, partVisible, withinPart, type OwnershipScope } from './ownership.ts';

export const wholeHeadPart = (id: string) => ['face', 'hair', 'head_accessories'].some(root => withinPart(id, root));
export const wholeHeadScope: OwnershipScope = {
  label: '完整头部', allows: wholeHeadPart,
  includes: (part, doc) => partVisible(part, doc, id => wholeHeadPart(id) || withinPart(id, 'neck')),
};

// Identity controls share each leaf's native parent, leaving fixed neck/body
// leaves outside the editable head groups. No upstream pose is resampled.
export function prepareHeadControls(document: HeadNineAxis, prefix: string, name: string): HeadNineAxis {
  let doc = structuredClone(document);
  const groups = new Map<string, string[]>(), byId = new Map(nodes(doc).map(node => [node.id, node]));
  for (const part of doc.parts.filter(part => !part.context && ownsNode(doc, part, wholeHeadScope))) {
    const parent = part.parent ?? '';
    groups.set(parent, [...(groups.get(parent) ?? []), part.id]);
  }
  let serial = 0;
  for (const [parentId, targets] of groups) {
    let id: string; do { id = `${prefix}/${serial++}`; } while (byId.has(id));
    const parent = byId.get(parentId), parts = targets.map(target => doc.parts.find(part => part.id === target)!);
    const bbox = parent?.bbox ?? [Math.min(...parts.map(part => part.bbox[0])), Math.min(...parts.map(part => part.bbox[1])),
      Math.max(...parts.map(part => part.bbox[2])), Math.max(...parts.map(part => part.bbox[3]))];
    doc = editNineAxis(doc, [{ action: 'create_warp', id, name, level: parts[0].level, bbox,
      cols: parent?.cols ?? 4, rows: parent?.rows ?? 4, parent: parentId || undefined, targets: [] }]);
    for (const part of doc.parts) if (targets.includes(part.id)) part.parent = id;
  }
  return doc;
}
