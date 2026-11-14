import { nodes, lattice, keyformAt, evaluatePoints, parentPoint, reparent, validateHeadNineAxis, checkWarpGeometry, dragKeyform } from './nine-axis-model.js';

const pairs = a => Array.from({ length: a.length / 2 }, (_, i) => [a[i * 2], a[i * 2 + 1]]);
const number = (v, name) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw Error(name + ' 须为有限数字'); return v; };
const vector = (v, name) => { if (!Array.isArray(v) || v.length !== 2) throw Error(name + ' 须为两个数字'); return v.map(q => number(q, name)); };
function grid(id, bbox, cols = 2, rows = 2) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite) || bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) throw Error(id + '：bbox 须为 [x0,y0,x1,y1]');
  if (![cols, rows].every(n => Number.isInteger(n) && n >= 1 && n <= 32)) throw Error(id + '：cols、rows 须为 1 至 32');
  const n = { id, bbox, cols, rows }, rest = pairs(lattice(n));
  return { ...n, interpolation: 'smooth', keyforms: { '0': rest } };
}
const formKey = (x, y) => !y ? ['keyforms', String(x)] : !x ? ['keyformsY', String(y)] : ['keyformsXY', `${x},${y}`];

// Both stage setup and interactive edits sample one unchanged input. Fill only
// missing forms, so initialization order cannot overwrite an authored pose.
export function initializeKeyforms(node, poses) {
  const missing = [];
  for (const [x,y] of poses) {
    const [field,key] = formKey(x,y);
    if (!node[field]?.[key]) missing.push([field,key,pairs(keyformAt(node,x,y))]);
  }
  for (const [field,key,points] of missing) {
    node[field] ??= {};
    node[field][key] = points;
  }
}

// Registration and parenting do not author poses. Seed an interpolation range
// only when an operation actually edits that axis on this node.
function ensureKey(doc, n, x = 0, y = 0) {
  number(x, 'x'); number(y, 'y');
  const ends = (parameter, value) => {
    if (!value) return [];
    const keys = [0, value, ...(doc.parameters?.find(p => p.id === parameter)?.keys ?? [])];
    return [...new Set([Math.min(...keys), Math.max(...keys)])].filter(key => key !== 0);
  };
  const X = ends('ParamAngleX',x), Y = ends('ParamAngleY',y);
  const newX = x && !n.keyforms[String(x)];
  initializeKeyforms(n,[...X.map(a => [a,0]), ...Y.map(b => [0,b]), [x,0], [0,y],
    ...(x && y ? X.flatMap(a => Y.map(b => [a,b])) : []), [x,y]]);
  if (newX && n.parameterInterpolation?.x === 'ellipse') n.parameterInterpolation.x = 'linear';
  return formKey(x,y);
}

// The author chooses all targets and hierarchy. No anatomical group is inferred.
// A batch is applied to a clone and validated before the caller writes anything.
export function editNineAxis(document, operations) {
  if (!Array.isArray(operations) || !operations.length) throw Error('operations 须为非空数组');
  const doc = structuredClone(document), get = id => { const n = nodes(doc).find(q => q.id === id); if (!n) throw Error('部件或变形器不存在：' + id); return n; };
  for (const op of operations) {
    if (!op || typeof op !== 'object') throw Error('编辑操作须为对象');
    if (op.action === 'add_part') {
      const p = op.part;
      if (!p || typeof p.id !== 'string' || !p.id || nodes(doc).some(n => n.id === p.id)) throw Error('新部件 id 无效或重复');
      const n = { ...grid(p.id, p.bbox, p.cols ?? 4, p.rows ?? 4), textureBounds: [p.bbox[0],p.bbox[1],p.bbox[2]-p.bbox[0],p.bbox[3]-p.bbox[1]], ...p, level: p.level ?? 'face' };
      if (op.before !== undefined && op.after !== undefined) throw Error('before 与 after 只能指定一个');
      const anchor = op.before ?? op.after;
      const at = anchor === undefined ? doc.parts.length : doc.parts.findIndex(q => q.id === anchor);
      if (at < 0) throw Error('绘制顺序参照部件不存在：' + anchor);
      doc.parts.splice(at + (op.after === undefined ? 0 : 1), 0, n);
    } else if (op.action === 'create_warp') {
      if (typeof op.id !== 'string' || !op.id || nodes(doc).some(n => n.id === op.id)) throw Error('新变形器 id 无效或重复');
      const targets = op.targets ?? [];
      const children = targets.map(get), all = children.flatMap(n => {
        const poses = [...Object.keys(n.keyforms).map(k => [Number(k), 0]),
          ...Object.keys(n.keyformsY ?? {}).map(k => [0, Number(k)]),
          ...Object.keys(n.keyformsXY ?? {}).map(k => k.split(',').map(Number))];
        return poses.flatMap(([x, y]) => pairs(evaluatePoints(doc, n, x, y)));
      });
      const bbox = op.bbox ?? (all.length ? [Math.min(...all.map(q => q[0])) - 8, Math.min(...all.map(q => q[1])) - 8, Math.max(...all.map(q => q[0])) + 8, Math.max(...all.map(q => q[1])) + 8] : undefined);
      const n = { ...grid(op.id, bbox, op.cols, op.rows), level: op.level ?? children[0]?.level ?? 'face', ...(op.name ? { name: op.name } : {}) };
      if (op.parent) n.parent = op.parent;
      doc.deformers.push(n); reparent(doc, targets, n.id);
    } else if (op.action === 'reparent') {
      reparent(doc, op.targets, op.parent ?? undefined);
    } else if (op.action === 'remove_warp') {
      const n = doc.deformers.find(n => n.id === op.id); if (!n) throw Error('变形器不存在：' + op.id);
      reparent(doc, nodes(doc).filter(q => q.parent === n.id).map(q => q.id), n.parent);
      doc.deformers = doc.deformers.filter(q => q.id !== n.id);
      for (const q of nodes(doc)) if(q.mirror===n.id) delete q.mirror;
    } else if (op.action === 'mirror_pair') {
      if (!Array.isArray(op.targets) || op.targets.length!==2 || op.targets[0]===op.targets[1]) throw Error('mirror_pair 需要两个不同节点');
      const [a,b]=op.targets.map(get);
      for (const n of [a,b]) if(n.mirror && get(n.mirror).mirror===n.id) delete get(n.mirror).mirror;
      a.mirror=b.id;b.mirror=a.id;
    } else if (op.action === 'interpolation') {
      const n = get(op.id); if (op.spatial !== undefined) n.interpolation = op.spatial;
      if (op.x !== undefined) n.parameterInterpolation = { ...n.parameterInterpolation, x: op.x };
    } else if (op.action === 'clip') {
      const n = doc.parts.find(p => p.id === op.id); if (!n) throw Error('裁切对象须为贴图部件');
      if (op.by === null) delete n.clip; else n.clip = { by: op.by, ...(op.invert ? { invert: true } : {}) };
    } else if (['points', 'drag', 'transform'].includes(op.action)) {
      const n = get(op.id), x = op.x ?? 0, y = op.y ?? 0, [field, key] = ensureKey(doc, n, x, y);
      let points = pairs(evaluatePoints(doc, n, x, y));
      if (op.action === 'points') {
        if (!Array.isArray(op.points) || !op.points.length) throw Error('points 须为非空的 {row,col,to} 数组');
        for (const q of op.points) {
          if (!Number.isInteger(q.row) || !Number.isInteger(q.col) || q.row < 0 || q.row > n.rows || q.col < 0 || q.col > n.cols) throw Error(n.id + '：控制点行列越界');
          points[q.row * (n.cols + 1) + q.col] = vector(q.to, 'to');
        }
      } else if (op.action === 'drag') {
        if (!Number.isInteger(op.row) || !Number.isInteger(op.col) || op.row < 0 || op.row > n.rows || op.col < 0 || op.col > n.cols) throw Error(n.id + '：控制点行列越界');
        const delta = vector(op.delta, 'delta'), radius = number(op.radius ?? 0, 'radius');
        if (radius < 0) throw Error('radius 不能为负数');
        points = dragKeyform(points, op.row * (n.cols + 1) + op.col, ...delta, radius);
      } else {
        const delta = vector(op.translate ?? [0, 0], 'translate'), scale = vector(op.scale ?? [1, 1], 'scale');
        if (scale.some(n => n <= 0)) throw Error('scale 须为正数');
        const origin = op.origin ? vector(op.origin, 'origin') : [(Math.min(...points.map(q => q[0])) + Math.max(...points.map(q => q[0]))) / 2, (Math.min(...points.map(q => q[1])) + Math.max(...points.map(q => q[1]))) / 2];
        points = points.map(q => q.map((v, k) => origin[k] + (v - origin[k]) * scale[k] + delta[k]));
      }
      n[field][key] = points.map(([px, py]) => parentPoint(doc, n, x, y, px, py, true));
    } else throw Error('未知九轴编辑操作：' + op.action);
  }
  validateHeadNineAxis(doc);
  for (const n of nodes(doc)) checkWarpGeometry(n);
  return doc;
}
