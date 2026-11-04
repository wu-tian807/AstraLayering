// Head nine-axis v2: artist-owned warp hierarchy, independent of draw order.
// All grids are expressed in the undeformed canvas coordinate system. A node's
// local shape is evaluated first, then carried through its parent and ancestors.
// Group warps have no texture; parts retain their own local editable mesh.
// An axisSources document keeps independent authors intact. Root corrections
// are evaluated before the part-specific continuous axis mapping; source trees
// are never rendered, resampled into root grids, or treated as editable nodes.
// Each part owns a (cols+1)×(rows+1) control lattice in canvas pixels with
// keyforms on ParamAngleX and, once a pitch step has run, keyformsY on ParamAngleY
// sharing the rest form keyforms["0"]; step05 adds the corners as keyformsXY
// keyed "x,y". The art mesh UV is the regular lattice over bbox.
// Masks follow Cubism clipping: a part with clip {by, invert} is drawn only
// where (or, inverted, only where not) the union of its sources' current alpha
// covers it; a part with role "mask" is never drawn itself, only clips others.
export const levelNames = { face: '脖子＋脸＋五官', hair: '头发', accessory: '头饰' };

export function validateHeadNineAxis(doc) {
  if (doc?.version !== 2 || doc.kind !== 'head-nine-axis') throw Error('头部九轴数据须为 version 2');
  if (!Array.isArray(doc.deformers)) throw Error('头部九轴数据缺少 deformers 数组');
  if (!Array.isArray(doc.parts) || !doc.parts.length) throw Error('头部九轴数据没有部件');
  if (!Array.isArray(doc.levels) || !doc.levels.length) throw Error('头部九轴数据没有预览层级');
  const ids = new Set();
  const partIds = new Set(doc.parts.map(p => p.id));
  for (const p of nodes(doc)) {
    if (typeof p.id !== 'string' || ids.has(p.id)) throw Error('部件编号无效或重复：' + p.id);
    ids.add(p.id);
    if (!levelNames[p.level]) throw Error(p.id + '：未知层级 ' + p.level);
    if (partIds.has(p.id) && !/^layers\/[\w-]+\.png$/.test(p.texture)) throw Error(p.id + '：贴图路径无效');
    if (!Number.isInteger(p.cols) || !Number.isInteger(p.rows) || p.cols < 1 || p.rows < 1) throw Error(p.id + '：网格尺寸无效');
    if (!Array.isArray(p.bbox) || p.bbox.length !== 4 || !(p.bbox[2] > p.bbox[0] && p.bbox[3] > p.bbox[1])) throw Error(p.id + '：网格范围无效');
    if (partIds.has(p.id) && (!Array.isArray(p.textureBounds) || p.textureBounds.length !== 4 || !p.textureBounds.every(Number.isFinite) || p.textureBounds[2] <= 0 || p.textureBounds[3] <= 0)) throw Error(p.id + '：贴图范围无效');
    if (!p.bbox.every(Number.isFinite)) throw Error(p.id + '：网格范围须为有限数字');
    if (p.interpolation !== undefined && !['linear', 'smooth'].includes(p.interpolation)) throw Error(p.id + '：interpolation 须为 linear 或 smooth');
    if (p.parameterInterpolation?.x !== undefined && !['linear', 'ellipse'].includes(p.parameterInterpolation.x)) throw Error(p.id + '：X 插值须为 linear 或 ellipse');
    const count = (p.cols + 1) * (p.rows + 1);
    if (!Object.keys(p.keyforms ?? {}).includes('0')) throw Error(p.id + '：缺少静止关键形');
    for (const [forms, name] of [[p.keyforms, 'X'], [p.keyformsY ?? {}, 'Y'], [p.keyformsXY ?? {}, '斜向']]) for (const k of Object.keys(forms)) {
      if (!(name === '斜向' ? k.split(',').length === 2 && k.split(',').every(v => v && Number.isFinite(Number(v))) : Number.isFinite(Number(k)))) throw Error(`${p.id}：${name} 关键形参数无效 ${k}`);
      const pts = forms[k];
      if (!Array.isArray(pts) || pts.length !== count || pts.some(q => !Array.isArray(q) || q.length !== 2 || !q.every(Number.isFinite)))
        throw Error(`${p.id}：${name} 关键形 ${k} 需要 ${count} 个控制点`);
    }
  }
  const parents = new Map(doc.deformers.map(p => [p.id, p]));
  const byId = new Map(nodes(doc).map(p=>[p.id,p]));
  for (const p of nodes(doc)) {
    if (p.mirror !== undefined && (!byId.has(p.mirror) || p.mirror===p.id || partIds.has(p.id)!==partIds.has(p.mirror) || byId.get(p.mirror).mirror!==p.id)) throw Error(p.id+'：mirror 必须与同类节点互相配对');
    const chain = new Set([p.id]); let next = p.parent;
    while (next !== undefined && next !== null) {
      if (!parents.has(next)) throw Error(p.id + '：父变形器不存在 ' + next);
      if (chain.has(next)) throw Error(p.id + '：父子变形器存在循环 ' + next);
      chain.add(next); next = parents.get(next).parent;
    }
    if (p.parameterInterpolation?.x === 'ellipse' && (keyValues(p).length !== 3 || keyValues(p)[1] !== 0)) throw Error(p.id + '：ellipse 需要负值、0、正值三个 X 关键形；增加中间形前改为 linear');
    if (/^neck(?:\/|$)/.test(p.id)) {
      if (p.parent) throw Error(p.id + '：脖子必须保持固定，不能挂到头部变形器');
      const rest = p.keyforms['0'];
      for (const forms of [p.keyforms, p.keyformsY ?? {}, p.keyformsXY ?? {}]) for (const points of Object.values(forms))
        if (points.some((q, i) => Math.abs(q[0] - rest[i][0]) > 1e-5 || Math.abs(q[1] - rest[i][1]) > 1e-5)) throw Error(p.id + '：脖子不能跟随转头移动、拉斜或拉长；修正脸与固定脖子的连接');
    }
  }
  for (const p of doc.parts) {
    if (p.role !== undefined && p.role !== 'mask') throw Error(p.id + '：未知角色 ' + p.role);
    if (p.clip === undefined) continue;
    const by = p.clip?.by;
    if (!Array.isArray(by) || !by.length || by.some(id => !partIds.has(id) || id === p.id)) throw Error(p.id + '：裁切来源无效：须为其他贴图部件，组级 Warp 没有蒙版像素');
    if (p.clip.invert !== undefined && typeof p.clip.invert !== 'boolean') throw Error(p.id + '：裁切反转须为布尔值');
  }
  for (const l of doc.levels) if (!Array.isArray(l.includes) || l.includes.some(x => !levelNames[x])) throw Error('预览层级无效：' + l.id);
  if (doc.axisSources !== undefined) {
    if (!Array.isArray(doc.axisSources) || doc.axisSources.length !== 3) throw Error('axisSources 须包含完整 x/up/down 三份独立作者');
    const axes = new Set(), parts = new Map(doc.parts.map(p => [p.id, p]));
    let originalIds;
    for (const source of doc.axisSources) {
      if (!source || !['x', 'up', 'down'].includes(source.axis) || axes.has(source.axis)) throw Error('axisSources 方向无效或重复');
      axes.add(source.axis);
      if (!/^[a-f0-9]{64}$/.test(source.sha256)) throw Error('axisSources：源作者 SHA256 无效');
      if (!source.doc || Object.hasOwn(source.doc, 'axisSources')) throw Error('axisSources 不允许递归源作者');
      validateHeadNineAxis(source.doc);
      originalIds ??= new Set(source.doc.parts.map(p => p.id));
      if (source.doc.parts.length !== originalIds.size || source.doc.parts.some(p => !originalIds.has(p.id))) throw Error(source.axis + '：三份源部件集合须一致');
      for (const p of source.doc.parts) {
        const root = parts.get(p.id);
        if (!root || ['texture', 'textureBounds', 'bbox', 'cols', 'rows'].some(k => JSON.stringify(p[k]) !== JSON.stringify(root[k])))
          throw Error(source.axis + '/' + p.id + '：原图层、贴图范围或 UV 网格不一致');
        if (p.keyforms['0'].some((q, i) => q.some((v, k) => Math.abs(v - root.keyforms['0'][i][k]) > 1e-5)))
          throw Error(source.axis + '/' + p.id + '：原形不一致');
        const rest = lattice(root), neutral = evaluatePoints(source.doc, p, 0, 0, 2), samples = refine(rest, root.cols, root.rows, 2);
        if (root.keyforms['0'].some((q, i) => q.some((v, k) => Math.abs(v - rest[i * 2 + k]) > 1e-5)) || neutral.some((v, i) => Math.abs(v - samples[i]) > 1e-5))
          throw Error(source.axis + '/' + p.id + '：共同中性原形或源父链静止姿态已改变');
      }
      for (const k of ['source', 'canvas', 'view', 'axis']) if (JSON.stringify(source.doc[k]) !== JSON.stringify(doc[k])) throw Error(source.axis + '：共同中性输入 ' + k + ' 不一致');
      // Source docs are protected snapshots. Drop any previously prepared
      // mapping when an explicit validation occurs, including after reopening.
      sourceMappings.delete(source.doc);
    }
  }
  return doc;
}

// One parameter's forms: X is keyforms; Y is keyformsY plus the shared rest form.
export const axisForms = (part, axis = 'x') => axis === 'x' ? part.keyforms : { '0': part.keyforms['0'], ...part.keyformsY };
export const keyValues = (part, axis = 'x') => Object.keys(axisForms(part, axis)).map(Number).sort((a, b) => a - b);

// The neighbouring keys of a value and its fraction between them; values
// outside the keys hold the end key.
function span(keys, value) {
  if (value <= keys[0]) return [keys[0], keys[0], 0];
  if (value >= keys.at(-1)) return [keys.at(-1), keys.at(-1), 0];
  const i = keys.findIndex((k, n) => value >= k && value <= keys[n + 1]);
  return [keys[i], keys[i + 1], (value - keys[i]) / (keys[i + 1] - keys[i])];
}
// The form at a grid point of the keys: an axis keyform, a corner, or, for a
// corner not made yet, the X and Y offsets from the rest form added up.
function gridForm(part, x, y) {
  if (!y) return part.keyforms[String(x)];
  const Y = axisForms(part, 'y')[String(y)];
  if (!x) return Y;
  const corner = part.keyformsXY?.[`${x},${y}`];
  if (corner) return corner;
  const X = part.keyforms[String(x)], R = part.keyforms['0'];
  return X.map((q, i) => [q[0] + Y[i][0] - R[i][0], q[1] + Y[i][1] - R[i][1]]);
}
// Bilinear blend over the 3×3 grid of keyforms, as Cubism blends two parameters.
export function keyformAt(part, x, y = 0, out = new Float32Array((part.cols + 1) * (part.rows + 1) * 2)) {
  const [x0, x1, s] = span(keyValues(part), x), [y0, y1, t] = part.keyformsY ? span(keyValues(part, 'y'), y) : [0, 0, 0];
  const A = gridForm(part, x0, y0), B = gridForm(part, x1, y0), C = gridForm(part, x0, y1), D = gridForm(part, x1, y1);
  if (part.parameterInterpolation?.x === 'ellipse') {
    const keys = keyValues(part), value = Math.max(-1, Math.min(1, x / (x < 0 ? -keys[0] : keys[2]))), theta = value * Math.PI / 2;
    const rows = [y0, y1].map(Y => keys.map(X => gridForm(part, X, Y)));
    const ellipse = (forms, i, k) => { const [L, M, R] = forms, c = (L[i][k] + R[i][k]) / 2; return c + (M[i][k] - c) * Math.cos(theta) + (R[i][k] - L[i][k]) / 2 * Math.sin(theta); };
    for (let i = 0; i < A.length; i++) for (const k of [0, 1]) out[i * 2 + k] = ellipse(rows[0], i, k) * (1 - t) + ellipse(rows[1], i, k) * t;
  } else for (let i = 0; i < A.length; i++) for (const k of [0, 1])
      out[i * 2 + k] = (A[i][k] * (1 - s) + B[i][k] * s) * (1 - t) + (C[i][k] * (1 - s) + D[i][k] * s) * t;
  return out;
}

export const nodes = doc => [...doc.deformers, ...doc.parts];
export function descendants(doc, id) {
  const found = new Set([id]);
  for (let changed = true; changed;) { changed = false; for (const n of nodes(doc)) if (found.has(n.parent) && !found.has(n.id)) { found.add(n.id); changed = true; } }
  return found;
}

// Interpolate displacement rather than absolute position, so rest grids and
// points outside a parent's rectangle retain identity. Smooth uses a tensor
// cubic curve through the authored handles; rendering subdivisions are separate.
const cubic = (a, b, c, d, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
export function warpPoint(part, points, x, y) {
  const [x0, y0, x1, y1] = part.bbox, { cols, rows } = part;
  const u = Math.max(0, Math.min(cols, (x - x0) / (x1 - x0) * cols)), v = Math.max(0, Math.min(rows, (y - y0) / (y1 - y0) * rows));
  const i = Math.min(cols - 1, Math.floor(u)), j = Math.min(rows - 1, Math.floor(v)), s = u - i, t = v - j;
  const at = (I, J, k) => {
    // Linear extrapolation of edge handles preserves an affine transform at edges.
    const a = Math.max(0, Math.min(cols, I)), b = Math.max(0, Math.min(rows, J));
    const value = (C, R) => points[(R * (cols + 1) + C) * 2 + k] - (k ? y0 + (y1 - y0) * R / rows : x0 + (x1 - x0) * C / cols);
    let q = value(a, b);
    if (I !== a) q += (I - a) * (a === 0 ? value(1, b) - q : q - value(cols - 1, b));
    if (J !== b) q += (J - b) * (b === 0 ? value(a, 1) - value(a, b) : value(a, b) - value(a, rows - 1));
    return q;
  };
  const displacement = k => {
    if (part.interpolation !== 'smooth') return (at(i, j, k) * (1 - s) + at(i + 1, j, k) * s) * (1 - t) + (at(i, j + 1, k) * (1 - s) + at(i + 1, j + 1, k) * s) * t;
    const row = J => cubic(at(i - 1, J, k), at(i, J, k), at(i + 1, J, k), at(i + 2, J, k), s);
    return cubic(row(j - 1), row(j), row(j + 1), row(j + 2), t);
  };
  return [x + displacement(0), y + displacement(1)];
}
export function inversePoint(transform, x, y, label = '变形') {
  // Keep the fast Newton path. If an edge's change of derivative causes a
  // cycle, restart with backtracking rather than accepting a larger residual.
  for (const backtrack of [false, true]) {
    let px = x, py = y;
    for (let i = 0; i < (backtrack ? 80 : 30); i++) {
      const q = transform(px, py), dx = q[0] - x, dy = q[1] - y, error = Math.hypot(dx, dy);
      if (!Number.isFinite(error)) break;
      const h = .01, a = transform(px + h, py), b = transform(px, py + h);
      const ax = (a[0] - q[0]) / h, ay = (a[1] - q[1]) / h, bx = (b[0] - q[0]) / h, by = (b[1] - q[1]) / h, det = ax * by - bx * ay;
      if (!Number.isFinite(det) || Math.abs(det) < 1e-8) break;
      if (error < 1e-5) { if (det > 0) return [px, py]; break; }
      const stepX = (by * dx - bx * dy) / det, stepY = (ax * dy - ay * dx) / det;
      if (!backtrack) { px -= stepX; py -= stepY; continue; }
      let accepted = false;
      for (let step = 1; step >= 1 / 32768; step /= 2) {
        const nx = px - step * stepX, ny = py - step * stepY, next = transform(nx, ny);
        if (Math.hypot(next[0] - x, next[1] - y) < error) { px = nx; py = ny; accepted = true; break; }
      }
      if (!accepted) break;
    }
  }
  throw Error(label + '：无法反解父级变形；先修正折叠或过度压缩的网格');
}
export function inverseWarpPoint(part, points, x, y) {
  return inversePoint((px, py) => warpPoint(part, points, px, py), x, y, part.id);
}

// Float32 control storage must not add a second rounding displacement when an
// identity root carries a source's original function. Detect identity once per
// prepared grid (also important for neutral groups with fractional spacing).
function preparedWarp(node, points) {
  const [x0, y0, x1, y1] = node.bbox;
  let identity = true;
  for (let j = 0; j <= node.rows && identity; j++) for (let i = 0; i <= node.cols; i++) {
    const k = (j * (node.cols + 1) + i) * 2;
    if (points[k] !== Math.fround(x0 + (x1 - x0) * i / node.cols) || points[k + 1] !== Math.fround(y0 + (y1 - y0) * j / node.rows)) { identity = false; break; }
  }
  return [node, points, identity];
}
function parentChain(doc, node, x, y, byId = new Map(doc.deformers.map(n => [n.id, n])), forms) {
  const chain = [];
  for (let id = node.parent; id; id = byId.get(id).parent) {
    const p = byId.get(id); chain.push(preparedWarp(p, forms?.get(id) ?? keyformAt(p, x, y)));
  }
  return chain;
}
const carry = (chain, px, py) => {
  for (const [node, points, identity] of chain) if (!identity) [px, py] = warpPoint(node, points, px, py);
  return [px, py];
};

// One angle entry per protected source doc, not one Map/chain per vertex.
// Mutable root corrections are prepared afresh for every evaluation/edit.
const sourceMappings = new WeakMap();
function sourceMapping(doc, x, y) {
  const old = sourceMappings.get(doc);
  if (old?.x === x && old?.y === y) return old.parts;
  const byId = new Map(doc.deformers.map(n => [n.id, n])), forms = new Map(nodes(doc).map(n => [n.id, keyformAt(n, x, y)]));
  const parts = new Map(doc.parts.map(p => [p.id, [preparedWarp(p, forms.get(p.id)), ...parentChain(doc, p, x, y, byId, forms)]]));
  sourceMappings.set(doc, { x, y, parts });
  return parts;
}
function axisMapping(doc, node, x, y) {
  // Each original leaf enters its independent axis mapping once, before the
  // current author groups. Those groups act on the resulting canvas image.
  const partId = node.id;
  if (!doc.axisSources || (!x && !y) || !doc.parts.some(p => p.id === partId)) return;
  const X = x ? sourceMapping(doc.axisSources.find(s => s.axis === 'x').doc, x, 0).get(partId) : undefined;
  const Y = y ? sourceMapping(doc.axisSources.find(s => s.axis === (y > 0 ? 'up' : 'down')).doc, 0, y).get(partId) : undefined;
  // New root-only artwork (e.g. a later jaw mask) has no original source map.
  // It follows its authored root chain once; never borrow the face's source T.
  if (!X && !Y) return;
  if (!X) return (px, py) => carry(Y, px, py);
  if (!Y) return (px, py) => carry(X, px, py);
  return (px, py) => {
    const a = carry(X, px, py), b = carry(Y, px, py);
    return [a[0] + b[0] - px, a[1] + b[1] - py];
  };
}
export function axisPoint(doc, node, x, y, px, py) {
  const base = axisMapping(doc, node, x, y);
  return base ? base(px, py) : [px, py];
}
function parentTransform(doc, node, x, y) {
  const chain = parentChain(doc, node, x, y), base = axisMapping(doc, node, x, y);
  return (px, py, inverse = false) => {
    if (inverse) {
      for (let i = chain.length - 1; i >= 0; i--) if (!chain[i][2]) [px, py] = inverseWarpPoint(chain[i][0], chain[i][1], px, py);
      if (base) [px, py] = inversePoint(base, px, py, node.id + ' axisSources');
    } else {
      if (base) [px, py] = base(px, py);
      [px, py] = carry(chain, px, py);
    }
    return [px, py];
  };
}
export function parentPoint(doc, node, x, y, px, py, inverse = false) {
  return parentTransform(doc, node, x, y)(px, py, inverse);
}
export function evaluatePoints(doc, node, x, y = 0, subdivision = 1) {
  const local = [preparedWarp(node, keyformAt(node, x, y))], samples = refine(lattice(node), node.cols, node.rows, subdivision), out = new Float32Array(samples.length), transform = parentTransform(doc, node, x, y);
  for (let i = 0; i < samples.length; i += 2) out.set(transform(...carry(local, samples[i], samples[i + 1])), i);
  return out;
}

// Reparenting retains each existing keyed shape in canvas space. It does not
// invent grouping or silently reset an already authored child deformation.
export function reparent(doc, ids, parent) {
  const byId = new Map(nodes(doc).map(n => [n.id, n]));
  if (parent && !doc.deformers.some(n => n.id === parent)) throw Error('父变形器不存在：' + parent);
  if (new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) throw Error('改挂的部件或变形器编号无效');
  for (const id of ids) if (parent && descendants(doc, id).has(parent)) throw Error(id + '：改挂会造成父子循环');
  if (ids.some(id => ids.some(other => other !== id && descendants(doc, other).has(id)))) throw Error('一次改挂不能同时选中祖先和它的子级');
  const forms = n => [['keyforms', n.keyforms], ['keyformsY', n.keyformsY ?? {}], ['keyformsXY', n.keyformsXY ?? {}]];
  const before = ids.map(id => {
    const n = byId.get(id), snapshots = [];
    for (const [field, keys] of forms(n)) for (const key of Object.keys(keys)) {
      const [x, y] = field === 'keyforms' ? [Number(key), 0] : field === 'keyformsY' ? [0, Number(key)] : key.split(',').map(Number);
      snapshots.push({ field, key, x, y, points: keys[key].map(([px, py]) => parentPoint(doc, n, x, y, px, py)) });
    }
    return { n, snapshots };
  });
  for (const { n, snapshots } of before) {
    if (parent) n.parent = parent; else delete n.parent;
    for (const { field, key, x, y, points } of snapshots) n[field][key] = points.map(([px, py]) => parentPoint(doc, n, x, y, px, py, true));
  }
}
export function checkWarpGeometry(node) {
  const forms = [...Object.values(node.keyforms), ...Object.values(node.keyformsY ?? {}), ...Object.values(node.keyformsXY ?? {})];
  for (const pts of forms) for (let j = 0; j < node.rows; j++) for (let i = 0; i < node.cols; i++) {
    const a = pts[j * (node.cols + 1) + i], b = pts[j * (node.cols + 1) + i + 1], c = pts[(j + 1) * (node.cols + 1) + i], d = pts[(j + 1) * (node.cols + 1) + i + 1];
    const cross = (A, B, C) => (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (cross(a, b, c) <= 1e-6 || cross(b, d, c) <= 1e-6) throw Error(`${node.id}：第 ${j} 行第 ${i} 列网格折叠或面积为零`);
  }
}

export function lattice(part) {
  const [x0, y0, x1, y1] = part.bbox, out = new Float32Array((part.cols + 1) * (part.rows + 1) * 2);
  for (let j = 0; j <= part.rows; j++) for (let i = 0; i <= part.cols; i++) {
    const k = (j * (part.cols + 1) + i) * 2;
    out[k] = x0 + (x1 - x0) * i / part.cols; out[k + 1] = y0 + (y1 - y0) * j / part.rows;
  }
  return out;
}

// Bilinear refinement of a control lattice: the art mesh follows the warp
// inside each cell, as a Cubism warp deformer does.
export function refine(points, cols, rows, n, out = new Float32Array((cols * n + 1) * (rows * n + 1) * 2)) {
  const C = cols * n;
  for (let J = 0; J <= rows * n; J++) for (let I = 0; I <= C; I++) {
    const i = Math.min(cols - 1, Math.floor(I / n)), j = Math.min(rows - 1, Math.floor(J / n)), u = I / n - i, v = J / n - j;
    const p = (q, c) => points[(q) * 2 + c], a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1, k = (J * (C + 1) + I) * 2;
    for (const axis of [0, 1]) out[k + axis] = (p(a, axis) * (1 - u) + p(b, axis) * u) * (1 - v) + (p(c, axis) * (1 - u) + p(d, axis) * u) * v;
  }
  return out;
}

export function meshIndices(cols, rows) {
  const out = new Uint32Array(cols * rows * 6);
  let k = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    out.set([a, c, b, b, c, d], k); k += 6;
  }
  return out;
}

export function levelParts(doc, levelId) {
  const level = doc.levels.find(l => l.id === levelId) ?? doc.levels[0];
  return doc.parts.filter(p => level.includes.includes(p.level));
}

// Soft-selection drag: move the grabbed point fully and its neighbours by a
// smooth falloff within `radius` canvas pixels, measured on the start form.
export function dragKeyform(start, index, dx, dy, radius) {
  const [gx, gy] = start[index];
  return start.map(([x, y], i) => {
    if (i === index) return [x + dx, y + dy];
    if (!(radius > 0)) return [x, y];
    const d = Math.hypot(x - gx, y - gy) / radius;
    if (d >= 1) return [x, y];
    const w = (1 - d * d) ** 2;
    return [x + dx * w, y + dy * w];
  });
}

// Tree for the deformer panel: level → group → parts, in top-first draw order.
export function deformerTree(doc) {
  const levels = new Map();
  for (const p of [...doc.parts].reverse()) {
    let level = levels.get(p.level);
    if (!level) levels.set(p.level, level = { id: p.level, name: levelNames[p.level], groups: new Map() });
    const g = p.group ?? p.id;
    if (!level.groups.has(g)) level.groups.set(g, []);
    level.groups.get(g).push(p);
  }
  return ['face', 'hair', 'accessory'].filter(l => levels.has(l)).map(l => ({ ...levels.get(l), groups: [...levels.get(l).groups].map(([id, parts]) => ({ id, parts })) }));
}
