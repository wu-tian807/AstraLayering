import { levelParts, nodes, nineAxisCapabilities } from './nine-axis-model.js';

export const previewLevels = [
  { id: 'face', title: '脸＋五官', label: '脸＋五官' },
  { id: 'hair', title: '脸＋五官＋头发', label: '＋头发' },
  { id: 'accessory', title: '脸＋五官＋头发＋头饰', label: '＋头饰' },
];
export const authoredPreviewPart = part => !/^__(?:kra|shadow)__\//.test(part.id);

// Readiness belongs to the displayed composition, including its actual Warp
// ancestors and clip sources. Hidden, unmade KRA context is never a preview.
export function nineAxisPreviewModes(doc, allowPlane = true) {
  const all = nodes(doc), byId = new Map(all.map(node => [node.id, node]));
  return previewLevels.map(level => {
    const declared = doc.levels.some(item => item.id === level.id);
    const parts = declared ? levelParts(doc, level.id).filter(authoredPreviewPart) : [];
    const available = parts.some(part => part.level === level.id && part.role !== 'mask' && !part.shadow && part.material !== 'transparent');
    const scope = new Set(parts.map(part => part.id)), queue = [...scope];
    while (queue.length) {
      const node = byId.get(queue.pop());
      for (const id of [node?.parent, ...(node?.clip?.by ?? [])].filter(Boolean)) if (!scope.has(id)) { scope.add(id); queue.push(id); }
    }
    const scoped = all.filter(node => scope.has(node.id));
    const parameters = (doc.parameters ?? []).map(parameter => {
      // Horizontal continuation deliberately restricts authoring to Y=0.
      // Its inherited face Y/XY forms remain authored and independently usable.
      if (level.id === 'face' && parameter.id === 'ParamAngleY' && ['hair', 'accessories'].includes(doc.authoring?.stage))
        return { ...parameter, status: undefined, keys: [...new Set([0, ...scoped.flatMap(node => Object.keys(node.keyformsY ?? {}).map(Number))])] };
      return parameter;
    });
    const axes = nineAxisCapabilities({ ...doc, parameters: available ? parameters : [],
      parts: doc.parts.filter(part => scope.has(part.id)), deformers: doc.deformers.filter(node => scope.has(node.id)) }, allowPlane);
    return { ...level, available, axes, scope };
  });
}

// A new available composition becomes the default once. Ordinary saves and
// polling preserve a manual choice; removal falls back to the latest survivor.
export function nextPreviewSelection(previous, modes) {
  const unlocked = modes.filter(mode => mode.available).map(mode => mode.id);
  const added = unlocked.filter(id => !previous?.unlocked.includes(id));
  const level = added.at(-1) ?? (unlocked.includes(previous?.level) ? previous.level : unlocked.at(-1)) ?? 'face';
  return { level, unlocked };
}
