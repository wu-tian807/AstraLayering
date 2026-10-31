// Head nine-axis document: one Cubism-style warp deformer per head layer.
// Each part owns a (cols+1)×(rows+1) control lattice in canvas pixels with
// keyforms on ParamAngleX and, once step03 has run, keyformsY on ParamAngleY
// sharing the rest form keyforms["0"]; the art mesh UV is the regular lattice over bbox.
export const levelNames = { face: '脸＋五官', hair: '头发', accessory: '头饰' };

export function validateHeadNineAxis(doc) {
  if (doc?.version !== 1 || doc.kind !== 'head-nine-axis') throw Error('头部九轴数据版本无效');
  if (!Array.isArray(doc.parts) || !doc.parts.length) throw Error('头部九轴数据没有部件');
  if (!Array.isArray(doc.levels) || !doc.levels.length) throw Error('头部九轴数据没有预览层级');
  const ids = new Set();
  for (const p of doc.parts) {
    if (typeof p.id !== 'string' || ids.has(p.id)) throw Error('部件编号无效或重复：' + p.id);
    ids.add(p.id);
    if (!levelNames[p.level]) throw Error(p.id + '：未知层级 ' + p.level);
    if (!/^layers\/[\w-]+\.png$/.test(p.texture)) throw Error(p.id + '：贴图路径无效');
    if (!Number.isInteger(p.cols) || !Number.isInteger(p.rows) || p.cols < 1 || p.rows < 1) throw Error(p.id + '：网格尺寸无效');
    if (!Array.isArray(p.bbox) || p.bbox.length !== 4 || !(p.bbox[2] > p.bbox[0] && p.bbox[3] > p.bbox[1])) throw Error(p.id + '：网格范围无效');
    if (!Array.isArray(p.textureBounds) || p.textureBounds.length !== 4) throw Error(p.id + '：贴图范围无效');
    const count = (p.cols + 1) * (p.rows + 1);
    if (!Object.keys(p.keyforms ?? {}).includes('0')) throw Error(p.id + '：缺少静止关键形');
    for (const [forms, name] of [[p.keyforms, 'X'], [p.keyformsY ?? {}, 'Y']]) for (const k of Object.keys(forms)) {
      if (!Number.isFinite(Number(k))) throw Error(`${p.id}：${name} 关键形参数无效 ${k}`);
      const pts = forms[k];
      if (!Array.isArray(pts) || pts.length !== count || pts.some(q => !Array.isArray(q) || q.length !== 2 || !q.every(Number.isFinite)))
        throw Error(`${p.id}：${name} 关键形 ${k} 需要 ${count} 个控制点`);
    }
  }
  for (const l of doc.levels) if (!Array.isArray(l.includes) || l.includes.some(x => !levelNames[x])) throw Error('预览层级无效：' + l.id);
  return doc;
}

// One parameter's forms: X is keyforms; Y is keyformsY plus the shared rest form.
export const axisForms = (part, axis = 'x') => axis === 'x' ? part.keyforms : { '0': part.keyforms['0'], ...part.keyformsY };
export const keyValues = (part, axis = 'x') => Object.keys(axisForms(part, axis)).map(Number).sort((a, b) => a - b);

// Linear blend between neighbouring keyforms; values outside the keys hold the end form.
function blend(forms, value, out, add) {
  const keys = Object.keys(forms).map(Number).sort((a, b) => a - b);
  let a = keys[0], b = keys[0];
  if (value >= keys.at(-1)) a = b = keys.at(-1);
  else for (let i = 0; i < keys.length - 1; i++) if (value >= keys[i] && value <= keys[i + 1]) { a = keys[i]; b = keys[i + 1]; break; }
  const t = a === b ? 0 : (value - a) / (b - a), A = forms[String(a)], B = forms[String(b)], R = forms['0'];
  for (let i = 0; i < A.length; i++) for (const k of [0, 1]) {
    const v = A[i][k] + (B[i][k] - A[i][k]) * t;
    out[i * 2 + k] = add ? out[i * 2 + k] + v - R[i][k] : v;
  }
}
// X and Y offsets from the rest form add up; the diagonal corners are not made yet.
export function keyformAt(part, x, y = 0, out = new Float32Array((part.cols + 1) * (part.rows + 1) * 2)) {
  blend(part.keyforms, x, out, false);
  if (y && part.keyformsY) blend(axisForms(part, 'y'), y, out, true);
  return out;
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
