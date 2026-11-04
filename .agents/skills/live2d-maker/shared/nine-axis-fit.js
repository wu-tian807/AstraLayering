import { nodes, lattice, keyformAt, warpPoint, axisPoint, parentPoint, checkWarpGeometry, validateHeadNineAxis } from './nine-axis-model.js';

// Fit the author's chosen node to points on its descendants' original artwork.
// Ancestors and descendants remain fixed. The same Warp evaluator as rendering
// supplies the basis, including smooth interpolation and edge extrapolation.
const point = (p, label) => {
  if (!Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v))) throw Error(label + '：需要 [x,y]');
  return p;
};
function cholesky(matrix, rhs) {
  const n = rhs.length, L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let v = matrix[i][j]; for (let k = 0; k < j; k++) v -= L[i][k] * L[j][k];
    if (i === j) { if (!(v > 1e-12)) throw Error('拟合约束不足，请增加轮廓覆盖或参考点'); L[i][j] = Math.sqrt(v); }
    else L[i][j] = v / L[j][j];
  }
  const y = new Float64Array(n), x = new Float64Array(n);
  for (let i = 0; i < n; i++) { let v = rhs[i]; for (let j = 0; j < i; j++) v -= L[i][j] * y[j]; y[i] = v / L[i][i]; }
  for (let i = n - 1; i >= 0; i--) { let v = y[i]; for (let j = i + 1; j < n; j++) v -= L[j][i] * x[j]; x[i] = v / L[i][i]; }
  return x;
}

export function fitWarpToTraces(document, options) {
  const doc = structuredClone(document), { id, x = -30, y = 0, features, smoothness = 0.02 } = options;
  const byId = new Map(nodes(doc).map(n => [n.id, n])), selected = byId.get(id);
  if (!selected) throw Error('拟合节点不存在：' + id);
  if (!Number.isFinite(x) || !Number.isFinite(y) || (!x && !y)) throw Error('拟合需要非静止的目标角度');
  if (!Number.isFinite(smoothness) || smoothness < 0 || smoothness > 10) throw Error('smoothness 须为 0 至 10');
  const field = !y ? 'keyforms' : !x ? 'keyformsY' : 'keyformsXY', key = !y ? String(x) : !x ? String(y) : `${x},${y}`;
  if (!selected[field]?.[key]) throw Error('先建立目标关键形：' + key);
  if (!Array.isArray(features) || !features.length) throw Error('拟合需要描线或对应点');
  const rest = lattice(selected), current = [...keyformAt(selected, x, y)], count = rest.length / 2;
  if (count > 256) throw Error('拟合控制点超过 256；先用较少控制点拟合大形，再补局部');
  const localSource = (partId, p) => {
    let n = doc.parts.find(n => n.id === partId); if (!n) throw Error('描线的原画部件不存在：' + partId);
    let q = [...p];
    for (let i = 0; n && i <= byId.size; i++) {
      if (n.id === id) return q;
      q = warpPoint(n, keyformAt(n, x, y), ...q);
      if (n.id === partId) q = axisPoint(doc, n, x, y, ...q);
      n = byId.get(n.parent);
    }
    throw Error(partId + ' 不属于拟合节点 ' + id + '；请选择它实际所属的 Warp 或单独部件');
  };
  const rows = [], summaries = [], featureIds = new Set();
  for (const f of features) {
    if (typeof f.id !== 'string' || !f.id || featureIds.has(f.id)) throw Error('描线 id 无效或重复');
    featureIds.add(f.id);
    if (!Array.isArray(f.samples) || !f.samples.length || f.samples.length > 512) throw Error(f.id + '：samples 需要 1 至 512 个对应点');
    const weight = f.weight ?? 1;
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) throw Error(f.id + '：weight 须为正数且不超过 1000');
    const start = rows.length;
    for (const sample of f.samples) {
      const source = localSource(f.part, point(sample.from, f.id + '.from')), target = point(sample.to, f.id + '.to');
      // Descendant leaves enter their own source pose before current canvas
      // groups. Finish/invert only the parents above the selected node.
      const wanted = parentPoint(doc, selected, x, y, ...target, true), baseline = warpPoint(selected, current, ...source);
      const basis = new Float64Array(count);
      for (let i = 0; i < count; i++) { const unit = [...rest]; unit[i * 2] += 1; basis[i] = warpPoint(selected, unit, ...source)[0] - source[0]; }
      rows.push({ basis, residual: wanted.map((v, k) => v - baseline[k]), source, target, part: f.part, weight: weight * Math.max(1, 64 / f.samples.length), occluded: f.visibility === 'occluded' });
    }
    summaries.push({ id: f.id, start, count: rows.length - start, weight });
  }
  if (rows.length > 8192) throw Error('拟合点过多，请按区域分轮拟合');
  const solve = (occludedScale = 1) => {
    const matrix = Array.from({ length: count }, () => new Float64Array(count)), rhs = [new Float64Array(count), new Float64Array(count)];
    const add = (a, weight, values = [0, 0]) => {
      for (let i = 0; i < count; i++) if (a[i]) {
        for (let k = 0; k < 2; k++) rhs[k][i] += a[i] * values[k] * weight;
        for (let j = 0; j <= i; j++) if (a[j]) matrix[i][j] += a[i] * a[j] * weight;
      }
  };
  for (const row of rows) add(row.basis, row.weight * (row.occluded ? occludedScale : 1), row.residual);
  // Penalize changes in curvature, rather than opposing translation/scale.
  for (let r = 0; r <= selected.rows; r++) for (let c = 0; c <= selected.cols; c++) {
    const middle = r * (selected.cols + 1) + c;
    for (const step of [c > 0 && c < selected.cols ? 1 : 0, r > 0 && r < selected.rows ? selected.cols + 1 : 0]) if (step) {
      const a = new Float64Array(count); a[middle - step] = 1; a[middle] = -2; a[middle + step] = 1; add(a, smoothness);
    }
  }
  for (let i = 0; i < count; i++) { matrix[i][i] += 1e-5; for (let j = 0; j < i; j++) matrix[j][i] = matrix[i][j]; }
  const delta = rhs.map(b => cholesky(matrix, b));
  return current.map((v, i) => v + delta[i % 2][Math.floor(i / 2)]);
  };
  if (!rows.some(row => !row.occluded)) throw Error('拟合至少需要一段可见轮廓，不能只靠遮挡补全');
  let fitted = solve(), occludedWeightScale = 1;
  if (rows.some(row => row.occluded)) {
    const visibleOnly = solve(0);
    const visibleShift = (values) => Math.max(...rows.filter(row => !row.occluded).map(row => {
      const a = parentPoint(doc, selected, x, y, ...warpPoint(selected, values, ...row.source));
      const b = parentPoint(doc, selected, x, y, ...warpPoint(selected, visibleOnly, ...row.source));
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }));
    // Completion may fill unconstrained regions, but cannot move a fitted
    // visible contour by more than a subpixel. Conflicting priors weaken.
    while (visibleShift(fitted) > 0.1 && occludedWeightScale > 1e-8) { occludedWeightScale *= 0.1; fitted = solve(occludedWeightScale); }
    if (visibleShift(fitted) > 0.1) { occludedWeightScale = 0; fitted = visibleOnly; }
  }
  selected[field][key] = Array.from({ length: count }, (_, i) => fitted.slice(i * 2, i * 2 + 2));
  try { validateHeadNineAxis(doc); for (const n of nodes(doc)) checkWarpGeometry(n); }
  catch (error) { throw Error('拟合未保存：' + error.message + '。请检查描线对应关系，增加局部控制或参考点。'); }
  const measure = values => summaries.map(f => {
    const errors = rows.slice(f.start, f.start + f.count).map(row => {
      const q = parentPoint(doc, selected, x, y, ...warpPoint(selected, values, ...row.source));
      return Math.hypot(q[0] - row.target[0], q[1] - row.target[1]);
    });
    return { id: f.id, samples: f.count, weight: f.weight, meanPixels: errors.reduce((a, b) => a + b, 0) / errors.length, maxPixels: Math.max(...errors) };
  });
  return { doc, report: { id, x, y, units: 'original canvas pixels', before: measure(current), after: measure(fitted), controls: count, smoothness, occludedWeightScale } };
}
