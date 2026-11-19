export const layerFields = [
  "visible",
  "opacity",
  "blend",
  "inheritAlpha",
  "passThrough",
];
export function layerState(layers) {
  return layers.map((l) =>
    Object.fromEntries([["id", l.id], ...layerFields.map((k) => [k, l[k]])]),
  );
}
export function stateKey(layers) {
  return JSON.stringify(layerState(layers));
}

export function focusSuppression(layers, keep) {
  const byId = new Map(layers.map(layer => [layer.id, layer])), shown = new Set(keep);
  for (const id of keep) {
    for (let row = byId.get(id); row?.parentId; row = byId.get(row.parentId)) shown.add(row.parentId);
  }
  return new Set(layers.filter(row => !row.mask && !shown.has(row.id)).map(row => row.id));
}

export function revealFocusedLayer(layers, suppressed, id) {
  const byId = new Map(layers.map(layer => [layer.id, layer]));
  for (let row = byId.get(id); row; row = byId.get(row.parentId)) suppressed.delete(row.id);
  if (!byId.get(id)?.group) return;
  for (const row of layers) {
    for (let parent = row.parentId; parent; parent = byId.get(parent)?.parentId) {
      if (parent === id) { suppressed.delete(row.id); break; }
    }
  }
}

export function layerTree(layers, collapsed = new Set(), query = "") {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const matched = new Set();
  const parents = new Set(layers.map((l) => l.parentId));
  if (query)
    for (const l of layers)
      if (l.name.toLowerCase().includes(query.toLowerCase())) {
        let n = l;
        while (n) {
          matched.add(n.id);
          n = byId.get(n.parentId);
        }
      }
  return layers.map((l) => {
    let parent = byId.get(l.parentId),
      inheritedHidden = false,
      folded = false;
    while (parent) {
      inheritedHidden ||= !parent.visible;
      folded ||= collapsed.has(parent.id);
      parent = byId.get(parent.parentId);
    }
    return {
      ...l,
      inheritedHidden,
      shown: query ? matched.has(l.id) : !folded,
      hasChildren: parents.has(l.id),
    };
  });
}
export const layerTypes = {
  paintlayer: "绘画层",
  grouplayer: "组",
  vectorlayer: "矢量层",
  clonelayer: "克隆层",
  filterlayer: "调整层",
  filllayer: "填充层",
  transparencymask: "透明蒙版",
  filtermask: "滤镜蒙版",
  transformmask: "变形蒙版",
  selectionmask: "选区蒙版",
  colorizemask: "着色蒙版",
};
export const blends = {
  normal: "正常",
  multiply: "正片叠底",
  screen: "滤色",
  overlay: "叠加",
  darken: "变暗",
  lighten: "变亮",
};
