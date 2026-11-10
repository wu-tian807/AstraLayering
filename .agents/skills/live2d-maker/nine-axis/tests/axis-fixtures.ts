import { lattice, nodes, validateHeadNineAxis, type HeadNineAxis, type WarpGrid, type Point } from '../../shared/nine-axis-model.js';
export const scale = { x: [-30, 30] as [number, number], y: [-25, 25] as [number, number] };
export const pts = (n: WarpGrid, f: (x: number, y: number) => Point = (x, y) => [x, y]) => {
  const p = lattice(n); return Array.from({ length: p.length / 2 }, (_, i) => f(p[i * 2], p[i * 2 + 1]));
};
export const grid = (id: string, bbox = [0, 0, 100, 100]): WarpGrid => {
  const n: WarpGrid = { id, level: 'face', bbox, cols: 3, rows: 3, interpolation: 'smooth', keyforms: {} };
  n.keyforms['0'] = pts(n); return n;
};
export function baseline(): HeadNineAxis {
  return { version: 2, kind: 'head-nine-axis', axis: 50, canvas: [100, 100], view: { x: 0, y: 0, width: 100, height: 100 },
    source: { document: 'original.kra' }, levels: [{ id: 'face', includes: ['face'] }],
    parameters: [{ id: 'ParamAngleX', keys: [0] }, { id: 'ParamAngleY', keys: [0] }], deformers: [],
    parts: ['face/face_base', 'face/eye_left', 'face/eye_right', 'neck'].map((id, i) => ({ ...grid(id), texture: `layers/p${i}.png`, textureBounds: [0, 0, 100, 100] })) };
}
export function independentAxes() {
  const x = baseline(), up = baseline(), down = baseline();
  // The same group IDs intentionally mean different target selections in
  // each author. Parent shapes and the part itself are spatially nonlinear.
  for (const [doc, direction] of [[x, 'x'], [up, 'up'], [down, 'down']] as const) {
    const a = grid('independent-outer'), b = grid('independent-inner'); b.parent = a.id;
    doc.deformers = [a, b];
    doc.parts[0].parent = b.id;
    doc.parts[direction === 'up' ? 2 : 1].parent = a.id;
    for (const n of nodes(doc)) {
      if (direction === 'x') {
        n.keyforms['-30'] = pts(n, (px, py) => n.id === 'neck' ? [px, py] : [px - 4 + py * py * .0001, py + px * py * .00015]);
        n.keyforms['30'] = pts(n, (px, py) => n.id === 'neck' ? [px, py] : [px + 4 - py * py * .0001, py - px * py * .00015]);
        // Parent ellipse plus an independently authored local intermediate key.
        if (n.id === a.id) n.parameterInterpolation = { x: 'ellipse' };
        if (n.id === 'face/face_base') n.keyforms['-12'] = pts(n, (px, py) => [px - 2.6 + py * .003, py + .35]);
      } else {
        const value = direction === 'up' ? 25 : -25;
        n.keyformsY = { [value]: pts(n, (px, py) => n.id === 'neck' ? [px, py] : [px + px * py * .00008, py + (value > 0 ? -3 : 5) + px * px * .00012]) };
        if (n.id === b.id) n.keyformsY[String(value / 2)] = pts(n, (px, py) => [px + .3, py + (value > 0 ? -1.9 : 1.7)]);
      }
    }
    doc.parameters = [{ id: 'ParamAngleX', keys: direction === 'x' ? [-30, 0, 30] : [0] }, { id: 'ParamAngleY', keys: direction === 'x' ? [0] : [0, direction === 'up' ? 25 : -25] }];
    validateHeadNineAxis(doc);
  }
  return { x, up, down };
}
export function joint(axes = independentAxes()): HeadNineAxis {
  const doc = baseline();
  for (const n of doc.parts) {
    n.keyforms = Object.fromEntries([-30, 0, 30].map(k => [String(k), pts(n)]));
    n.keyformsY = Object.fromEntries([-25, 0, 25].map(k => [String(k), pts(n)]));
    n.keyformsXY = Object.fromEntries([-30, 30].flatMap(x => [-25, 25].map(y => [`${x},${y}`, pts(n)])));
  }
  doc.axisSources = Object.entries(axes).map(([axis, doc]) => ({ axis: axis as 'x' | 'up' | 'down', doc }));
  return validateHeadNineAxis(doc);
}
