/* SVG geometry utilities shared by boundary authoring and source inspection.
 * Path normalization is pure; DOM transform reads never consolidate/mutate the
 * original SVGTransformList. No expression, preset, variant or deformer DSL.
 */
(function (host) {
  'use strict';
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  // Keep normalization diagnostics compatible with existing source preparation.
  const normalizeCheck = (ok, message) => check(ok, `SVG deformer: ${message}`);
  const finite = (value, label) => { normalizeCheck(typeof value === 'number' && Number.isFinite(value), `${label} must be a finite number`); return value; };
  const mix = (a, b, t) => a + (b - a) * t;
  const identity = () => new DOMMatrix();
  const array = matrix => [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
  const arity = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };
  const sourceArity = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, S: 4, T: 2, Z: 0 };
  function tokens(d) {
    normalizeCheck(typeof d === 'string' && d.trim(), 'path data must be a nonempty string');
    const pattern = /[a-zA-Z]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
    const out = []; let end = 0, m;
    while ((m = pattern.exec(d))) {
      normalizeCheck(/^[\s,]*$/.test(d.slice(end, m.index)), `invalid path syntax near ${d.slice(end, m.index + 1)}`);
      const value = /^[a-zA-Z]$/.test(m[0]) ? m[0] : finite(Number(m[0]), 'path coordinate');
      out.push(value); end = pattern.lastIndex;
    }
    normalizeCheck(/^[\s,]*$/.test(d.slice(end)), 'invalid path suffix');
    return out;
  }

  // Expand SVG's implicit, relative and reflected commands before subdividing.
  // Elliptical arcs require a separate, explicit arc-to-cubic preparation step.
  function absoluteSegments(d) {
    const ts = tokens(d), segments = [];
    let i = 0, cmd = '', cursor = [0, 0], start = [0, 0], previous = '', control = null;
    while (i < ts.length) {
      if (typeof ts[i] === 'string') cmd = ts[i++];
      else normalizeCheck(cmd && cmd.toUpperCase() !== 'Z', 'path coordinates need a drawing command');
      const type = cmd.toUpperCase(), relative = cmd !== type;
      normalizeCheck(type !== 'A', 'elliptical arc A/a is not supported; convert arcs to cubic curves before binding');
      normalizeCheck(own(sourceArity, type), `unsupported path command ${cmd}`);
      normalizeCheck(segments.length || type === 'M', 'path must start with M/m');
      if (type === 'Z') {
        segments.push({ command: 'Z', values: [] }); cursor = start.slice(); previous = type; control = null; cmd = ''; continue;
      }
      const count = sourceArity[type], numbers = ts.slice(i, i + count);
      normalizeCheck(numbers.length === count && numbers.every(n => typeof n === 'number'), `${cmd} has missing coordinates`);
      i += count;
      const xy = (a, b) => [a + (relative ? cursor[0] : 0), b + (relative ? cursor[1] : 0)];
      let next, out;
      if (type === 'M' || type === 'L') {
        next = xy(numbers[0], numbers[1]); out = { command: type, values: next };
        if (type === 'M') { start = next.slice(); cmd = relative ? 'l' : 'L'; }
        control = null;
      } else if (type === 'H' || type === 'V') {
        next = type === 'H' ? [numbers[0] + (relative ? cursor[0] : 0), cursor[1]] : [cursor[0], numbers[0] + (relative ? cursor[1] : 0)];
        out = { command: 'L', values: next }; control = null;
      } else if (type === 'C' || type === 'S') {
        const first = type === 'C' ? xy(numbers[0], numbers[1]) : (previous === 'C' || previous === 'S') ? [2 * cursor[0] - control[0], 2 * cursor[1] - control[1]] : cursor.slice();
        const at = type === 'C' ? 2 : 0, second = xy(numbers[at], numbers[at + 1]); next = xy(numbers[at + 2], numbers[at + 3]);
        out = { command: 'C', values: [...first, ...second, ...next] }; control = second;
      } else {
        const first = type === 'Q' ? xy(numbers[0], numbers[1]) : (previous === 'Q' || previous === 'T') ? [2 * cursor[0] - control[0], 2 * cursor[1] - control[1]] : cursor.slice();
        next = type === 'Q' ? xy(numbers[2], numbers[3]) : xy(numbers[0], numbers[1]);
        out = { command: 'Q', values: [...first, ...next] }; control = first;
      }
      segments.push(out); cursor = next; previous = type;
    }
    normalizeCheck(segments.length, 'path must start with M/m');
    return segments;
  }

  function serialize(segments) {
    return segments.map(s => s.command + (s.values.length ? ' ' + s.values.map(n => String(finite(n, 'result coordinate') === 0 ? 0 : n)).join(' ') : '')).join(' ');
  }

  function splitCurve(points, t) {
    const left = [points[0]], right = [points[points.length - 1]];
    let row = points;
    while (row.length > 1) {
      row = row.slice(0, -1).map((p, i) => [mix(p[0], row[i + 1][0], t), mix(p[1], row[i + 1][1], t)]);
      left.push(row[0]); right.unshift(row[row.length - 1]);
    }
    return [left, right];
  }

  function normalizePath(d, subdivisions = 4) {
    normalizeCheck(Number.isInteger(subdivisions) && subdivisions >= 1 && subdivisions <= 64, 'subdivisions must be an integer in [1,64]');
    const result = []; let cursor = [0, 0], start = [0, 0];
    for (const s of absoluteSegments(d)) {
      if (s.command === 'M') { result.push(s); cursor = s.values.slice(); start = cursor.slice(); continue; }
      if (s.command === 'Z') {
        // A close segment also needs fixed samples under nonlinear deformation.
        for (let j = 1; j < subdivisions; j++) result.push({ command: 'L', values: [mix(cursor[0], start[0], j / subdivisions), mix(cursor[1], start[1], j / subdivisions)] });
        result.push(s); cursor = start.slice(); continue;
      }
      let remaining = [cursor];
      for (let j = 0; j < s.values.length; j += 2) remaining.push(s.values.slice(j, j + 2));
      for (let j = 0; j < subdivisions; j++) {
        const [part, rest] = j === subdivisions - 1 ? [remaining, null] : splitCurve(remaining, 1 / (subdivisions - j));
        result.push({ command: s.command, values: part.slice(1).flat() }); remaining = rest;
      }
      cursor = s.values.slice(-2);
    }
    return serialize(result);
  }

  function pathData(d) {
    const pattern = /[MLCQZ]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
    check(!d.replace(pattern, '').replace(/[\s,]/g, ''), '路径只支持显式绝对 M/L/C/Q/Z');
    const tokens = d.match(pattern) || [], commands = [], values = [], ends = [];
    for (let i = 0; i < tokens.length;) {
      const c = tokens[i++]; check(own(arity, c), '路径命令必须显式写出'); commands.push(c);
      for (let j = 0; j < arity[c]; j++) { const n = Number(tokens[i++]); check(Number.isFinite(n), '路径坐标缺失'); values.push(n); }
      ends.push(values.length);
    }
    check(commands[0] === 'M', '路径必须以 M 开始'); return { commands, values, ends };
  }
  function readTransform(node, property = 'transform') {
    const list = node[property]?.baseVal; let result = identity();
    if (list) for (let i = 0; i < list.numberOfItems; i++) result = result.multiply(new DOMMatrix(array(list.getItem(i).matrix)));
    return result;
  }
  function authorMatrix(node, svg) {
    let m = identity();
    for (let n = node; n && n !== svg; n = n.parentElement) {
      check(n.localName !== 'svg', '绑定范围暂不支持嵌套 SVG viewBox：' + node.id);
      check(!n.style?.transform, '请在准备阶段将 CSS transform 转为 SVG transform：' + n.id);
      // consolidate() mutates an SVGTransformList. Read the list without
      // rewriting the author's transform attribute, especially in source mode.
      m = readTransform(n).multiply(m);
    }
    return m;
  }
  const api = { normalizePath, pathData, authorMatrix, array };
  host.AstraSvgGeometry = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);
