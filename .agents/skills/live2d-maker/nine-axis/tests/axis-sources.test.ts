import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPointDeformer, deformPoints, evaluatePoints, inversePoint, keyformAt, lattice, nodes, parentPoint, reparent, validateHeadNineAxis, warpPoint,
  type HeadNineAxis, type WarpGrid, type Point } from '../../shared/nine-axis-model.js';

import { scale, pts, grid, baseline, independentAxes, joint } from './axis-fixtures.ts';
import { mirrorDocument } from '../head.ts';
import { fitWarpToTraces, type FitFeature } from '../../shared/nine-axis-fit.js';
import { editNineAxis } from '../../shared/nine-axis-edit.js';
const close = (a: ArrayLike<number>, b: ArrayLike<number>, epsilon = 1e-5) => {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < epsilon, `${i}: ${a[i]} vs ${b[i]}`);
};
// Independent reference uses the existing public Warp primitives, including
// all source ancestors, at arbitrary points rather than root control samples.
const sourcePoint = (doc: HeadNineAxis, id: string, x: number, y: number, p: Point): Point => {
  let n = doc.parts.find(n => n.id === id)!;
  let q = warpPoint(n, keyformAt(n, x, y), ...p);
  while (n.parent) { n = doc.deformers.find(g => g.id === n.parent)! as typeof n; q = warpPoint(n, keyformAt(n, x, y), ...q); }
  return q;
};

test('prepared pose sampling preserves linear and cubic edge extrapolation with a reusable output buffer', () => {
  for (const interpolation of ['linear', 'smooth'] as const) {
    const p: any = { id: 'leaf', level: 'face', bbox: [1.25, -2.75, 17.375, 9.125], cols: 1, rows: 3, interpolation, keyforms: {} };
    const flat = lattice(p), rest = Array.from({ length: flat.length / 2 }, (_, i) => [flat[i * 2], flat[i * 2 + 1]]);
    p.keyforms = { '-30': rest.map(([x, y], i) => [x + Math.sin(i + .3), y + Math.cos(i + .2)]), '0': rest,
      '30': rest.map(([x, y], i) => [x + Math.cos(i + .4), y - Math.sin(i + .1)]) };
    const doc: any = { deformers: [], parts: [p] };
    const points = [[-8, -9], [1.25, -2.75], [17.375, -2.75], [17.375, 9.125], [1.25, 9.125], [24, 15], [9.2, 4.1]].flat();
    for (const count of [1, 20]) for (const x of [-30, -17.25, 13.5, 30]) {
      const samples = Float32Array.from(Array.from({ length: count }, () => points).flat());
      const controls = keyformAt(p, x), expected = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i += 2) expected.set(warpPoint(p, controls, samples[i], samples[i + 1]), i);
      const out = new Float32Array(samples.length), frame = createPointDeformer(doc, x, 0);
      assert.equal(frame(p, samples, out), out);
      assert.deepEqual(out, expected);
    }
  }
});

test('bulk meshes preserve independent axis composition, edits and output ownership across arena growth', () => {
  const doc = joint(), group = grid('bulk-parent');
  group.keyforms['-30'] = pts(group, (x, y) => [x + Math.sin(y / 7), y - 2]);
  doc.deformers.push(group); doc.parts[0].parent = group.id;
  const part = doc.parts[0], pair = Float32Array.from([12.3, 24.8]), samples = new Float32Array(300000);
  for (let i = 0; i < samples.length; i += 2) samples.set(pair, i);
  for (const [x, y] of [[-19, 12], [0, -13], [-21, 0], [0, 0]]) {
    const expected = deformPoints(doc, part, pair, x, y), out = new Float32Array(samples.length);
    assert.equal(createPointDeformer(doc, x, y)(part, samples, out), out);
    for (let i = 0; i < out.length; i += 2) { assert.equal(out[i], expected[0]); assert.equal(out[i + 1], expected[1]); }
    createPointDeformer(doc, -7, -9)(part, samples);
    assert.deepEqual(out.slice(0, 2), expected, 'later frames do not overwrite returned outputs');
  }
  const before = deformPoints(doc, part, samples, -19, 12);
  group.keyforms['-30'] = pts(group, (x, y) => [x + 9, y]);
  assert.notDeepEqual(createPointDeformer(doc, -19, 12)(part, samples).slice(0, 2), before.slice(0, 2));
});

test('one pose shares parent preparation without caching mutable author edits across frames', () => {
  const doc = joint(), group = grid('shared-parent');
  group.keyforms['-30'] = pts(group, (x, y) => [x + y * .03, y - 2]);
  doc.deformers.push(group); doc.parts.slice(0, 2).forEach(p => p.parent = group.id);
  const samples = Float32Array.from([12.3, 24.8, -4, 103, 50, 40]), frame = createPointDeformer(doc, -19, 12);
  for (const part of doc.parts) assert.deepEqual(frame(part, samples), deformPoints(doc, part, samples, -19, 12));
  const before = frame(doc.parts[0], samples);
  group.keyforms['-30'] = pts(group, (x, y) => [x + 5, y + x * .02]);
  const after = createPointDeformer(doc, -19, 12)(doc.parts[0], samples);
  assert.notDeepEqual(after, before);
  assert.deepEqual(after, deformPoints(doc, doc.parts[0], samples, -19, 12));
});

test('whole-feature corner translation and scale act on the rendered image after independent axis warps', () => {
  const imported = joint();
  imported.parameters = [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [-25, 0, 25] }];
  const doc = editNineAxis(imported, [{ action: 'create_warp', id: 'feature-group',
    targets: imported.parts.slice(0, 3).map(p => p.id), cols: 3, rows: 3 }]);
  for (const operation of [{ translate: [10, 0] }, { scale: [1.07, .93], origin: [50, 50] }]) {
    const edited = editNineAxis(doc, [{ action: 'transform', id: 'feature-group', x: -30, y: 25, ...operation }]);
    for (const part of doc.parts.slice(0, 3)) {
      const before = evaluatePoints(doc, part, -30, 25, 5);
      const after = evaluatePoints(edited, edited.parts.find(p => p.id === part.id)!, -30, 25, 5);
      const expected = Array.from(before, (value, i) => operation.translate
        ? value + operation.translate[i % 2]
        : 50 + (value - 50) * operation.scale![i % 2]);
      close(after, expected, .0001);
    }
    assert.deepEqual(edited.axisSources, doc.axisSources);
    close(evaluatePoints(edited, edited.parts[3], -30, 25, 5), evaluatePoints(doc, doc.parts[3], -30, 25, 5));
    for (const [x, y] of [[-30, 0], [0, 25], [0, -25]]) for (const part of doc.parts)
      close(evaluatePoints(edited, edited.parts.find(p => p.id === part.id)!, x, y, 5), evaluatePoints(doc, part, x, y, 5));
  }
});

test('independent nonlinear parent trees, ellipse and authored intermediate functions survive every single-axis pose', () => {
  const axes = independentAxes(), doc = joint(axes);
  assert.equal(nodes(doc).length, doc.parts.length, 'nested sources are not rendered/editable root nodes');
  assert.equal(doc.deformers.length, 0);
  for (const [axis, values] of [['x', [-30, -22.75, -12, -7.3, 0, 9.6, 30]], ['up', [0, 4.7, 12.5, 21.8, 25]], ['down', [0, -5.8, -12.5, -21.2, -25]]] as const) {
    const source = axes[axis];
    for (const value of values) for (const p of doc.parts) {
      const [x, y] = axis === 'x' ? [value, 0] : [0, value];
      close(evaluatePoints(doc, p, x, y, 5), evaluatePoints(source, source.parts.find(n => n.id === p.id)!, x, y, 5));
    }
  }
  assert.notEqual(axes.x.parts[1].parent, axes.up.parts[1].parent, 'independent group selections conflict without being merged');
});

test('root leaf enters exact source pose before canvas parents; inverse undoes parents before source pose', () => {
  const axes = independentAxes(), doc = joint(axes), p = doc.parts[0];
  const g = grid('xy-author-group'), outer = grid('xy-outer'); g.parent = outer.id;
  for (const n of [g, outer]) {
    n.keyforms = Object.fromEntries([-30, 0, 30].map(k => [String(k), pts(n)]));
    n.keyformsY = Object.fromEntries([-25, 0, 25].map(k => [String(k), pts(n)]));
    n.keyformsXY = { '-30,25': pts(n, (x, y) => [x + y * .007, y - 1]) };
  }
  doc.deformers = [g, outer]; p.parent = g.id;
  p.keyformsXY!['-30,25'] = pts(p, (x, y) => [x + 1, y + x * .005]);
  validateHeadNineAxis(doc);
  const originals = JSON.stringify(doc.axisSources);
  for (const [x, y] of [[-30, 25], [-19.7, 16.3], [30, -25], [0, 12.5]]) {
    const q0: Point = [38.73, 48.26];
    const a = x ? sourcePoint(axes.x, p.id, x, 0, q0) : q0;
    const b = y ? sourcePoint(y > 0 ? axes.up : axes.down, p.id, 0, y, q0) : q0;
    const q: Point = [a[0] + b[0] - q0[0], a[1] + b[1] - q0[1]];
    const expected = warpPoint(outer, keyformAt(outer, x, y), ...warpPoint(g, keyformAt(g, x, y), ...q));
    close(parentPoint(doc, p, x, y, ...q0), expected);
    close(parentPoint(doc, p, x, y, ...expected, true), q0, 2e-5);
  }
  const expected = parentPoint(doc, p, -30, 25, ...warpPoint(p, keyformAt(p, -30, 25), 0, 0));
  close(evaluatePoints(doc, p, -30, 25).slice(0, 2), expected);
  // Group handles are canvas coordinates; leaves enter source T before them.
  close(parentPoint(doc, g, -30, 25, 20, 30), warpPoint(outer, keyformAt(outer, -30, 25), 20, 30));
  const before = evaluatePoints(doc, p, -30, 25, 3);
  reparent(doc, [p.id], undefined);
  // Reparent promises keyed control-point preservation, not nonlinear baking.
  close(evaluatePoints(doc, p, -30, 25), Array.from(before).filter((_, i) => { const vertex = Math.floor(i / 2); return vertex % 10 % 3 === 0 && Math.floor(vertex / 10) % 3 === 0; }), .0001);
  assert.equal(JSON.stringify(doc.axisSources), originals);
});

test('mutable root correction at same angle does not reuse stale cached parents; fixed neck stays fixed', () => {
  const doc = joint(), p = doc.parts[0];
  const before = evaluatePoints(doc, p, -30, 25);
  p.keyformsXY!['-30,25'] = pts(p, (x, y) => [x + 1, y]);
  assert.notDeepEqual(evaluatePoints(doc, p, -30, 25), before);
  for (const x of [-30, -17, 0, 12, 30]) for (const y of [-25, -9, 0, 18, 25]) close(evaluatePoints(doc, doc.parts[3], x, y, 3), evaluatePoints(doc, doc.parts[3], 0, 0, 3));
});

test('reject incomplete/recursive/foreign source docs, original UV/rest changes and moving neck', () => {
  const mutate = (f: (doc: HeadNineAxis) => void, pattern: RegExp) => { const doc = joint(); f(doc); assert.throws(() => validateHeadNineAxis(doc), pattern); };
  mutate(doc => { doc.axisSources!.pop(); }, /完整/);
  mutate(doc => { doc.axisSources![1].axis = 'x'; }, /重复/);
  mutate(doc => { doc.axisSources![0].doc.axisSources = []; }, /递归/);
  mutate(doc => { doc.axisSources![0].doc.parts.pop(); }, /集合/);
  mutate(doc => { doc.axisSources![0].doc.parts[0].textureBounds[0]++; }, /UV/);
  mutate(doc => { doc.axisSources![0].doc.parts[0].keyforms['0'][0][0]++; }, /原形/);
  mutate(doc => { doc.axisSources![0].doc.deformers[0].keyforms['0'][0][0]++; }, /静止/);
  mutate(doc => { doc.axisSources![0].doc.parts[3].keyforms['-30'][0][0]++; }, /脖子/);
  mutate(doc => { doc.axisSources![0].doc.axis = 51; }, /中性输入/);
});

test('one generic inverse rejects folded axis sums as well as folded Warps', () => {
  const doc = joint(), p = doc.parts[0];
  for (const source of [doc.axisSources![0], doc.axisSources![1]]) {
    source.doc.deformers = []; for (const p of source.doc.parts) delete p.parent;
    const n = source.doc.parts[0];
    const form = pts(n, (x, y) => [50 + (x - 50) * .4, y]);
    if (source.axis === 'x') n.keyforms['-30'] = form; else n.keyformsY!['25'] = form;
  }
  validateHeadNineAxis(doc);
  assert.throws(() => parentPoint(doc, p, -30, 25, 50, 50, true), /无法反解/);
  assert.throws(() => inversePoint((x, y) => [-x, y], 0, 0), /无法反解/);
});

test('existing mirrorDocument mirrors the complete part mapping into right root correction without rewriting sources', () => {
  const doc = joint(), p = doc.parts[1];
  p.keyformsXY!['-30,25'] = pts(p, (x, y) => [x + 1.1, y + x * .003]);
  const originalSources = JSON.stringify(doc.axisSources), original = JSON.stringify(doc);
  const mirrored = mirrorDocument(doc, doc.axis!, 'keyformsXY');
  validateHeadNineAxis(mirrored);
  assert.equal(JSON.stringify(doc), original, 'source author remains read-only during compilation');
  assert.equal(JSON.stringify(mirrored.axisSources), originalSources);
  for (const n of mirrored.parts) {
    const pairId = n.id.replace(/left|right/g, side => side === 'left' ? 'right' : 'left');
    const pair = doc.parts.find(p => p.id === pairId) ?? doc.parts.find(p => p.id === n.id)!;
    for (const [i, [px, py]] of n.keyforms['0'].entries()) {
      let expected = parentPoint(doc, pair, -30, 25, ...warpPoint(pair, keyformAt(pair, -30, 25), 2 * doc.axis! - px, py));
      expected = [2 * doc.axis! - expected[0], expected[1]];
      const actual = parentPoint(mirrored, n, 30, 25, ...n.keyformsXY!['30,25'][i] as Point);
      close(actual, expected, .001);
    }
    for (const [x, y] of [[-30, 0], [30, 0], [0, 25], [0, -25], [-17.3, 0]]) close(evaluatePoints(mirrored, n, x, y, 3), evaluatePoints(doc, doc.parts.find(p => p.id === n.id)!, x, y, 3));
  }
});

test('new root-only artwork follows its own parent chain once without borrowing or repeating a source mapping', () => {
  const doc = joint(), g = grid('new-root-group');
  g.keyforms = Object.fromEntries([-30, 0, 30].map(k => [String(k), pts(g)]));
  g.keyformsY = Object.fromEntries([-25, 0, 25].map(k => [String(k), pts(g)]));
  g.keyformsXY = { '-30,25': pts(g, (x, y) => [x + 2, y + 3]) }; doc.deformers.push(g);
  const p = { ...grid('root-only-mask'), texture: 'layers/new-mask.png', textureBounds: [0, 0, 100, 100], parent: g.id, role: 'mask' as const };
  doc.parts.push(p); validateHeadNineAxis(doc);
  close(parentPoint(doc, p, -30, 25, 40, 50), [42, 53]);
  for (const [x, y] of [[-30, 25], [-30, -25], [30, 25], [0, 0]]) {
    close(parentPoint(doc, p, x, y, 40, 50), parentPoint({ ...doc, axisSources: undefined }, p, x, y, 40, 50));
    close(evaluatePoints(doc, p, x, y, 3), evaluatePoints({ ...doc, axisSources: undefined }, p, x, y, 3));
  }
});

function fitCase() {
  const doc = joint(), outer = grid('root-outer'), group = grid('root-fit-group'); group.parent = outer.id;
  for (const n of [outer, group]) {
    n.keyforms = Object.fromEntries([-30, 0, 30].map(k => [String(k), pts(n)]));
    n.keyformsY = Object.fromEntries([-25, 0, 25].map(k => [String(k), pts(n)]));
    n.keyformsXY = { '-30,25': pts(n) };
  }
  outer.keyformsXY!['-30,25'] = pts(outer, (x, y) => [x * 1.002 + .6, y - .4]);
  doc.deformers = [outer, group]; doc.parts[0].parent = group.id; doc.parts[1].parent = group.id;
  doc.parts[0].keyformsXY!['-30,25'] = pts(doc.parts[0], (x, y) => [x + .3, y + x * .001]);
  const truth = structuredClone(doc);
  truth.deformers[1].keyformsXY!['-30,25'] = pts(group, (x, y) => [x - 1.2 + y * .005, y + .6]);
  const position = (model: HeadNineAxis, id: string, p: Point) => {
    const n = model.parts.find(n => n.id === id)!;
    return parentPoint(model, n, -30, 25, ...warpPoint(n, keyformAt(n, -30, 25), ...p));
  };
  const features: FitFeature[] = doc.parts.slice(0, 2).map(part => {
    const samples: { from: Point; to: Point }[] = [];
    for (let y = 10; y <= 90; y += 20) for (let x = 10; x <= 90; x += 20) samples.push({ from: [x, y], to: position(truth, part.id, [x, y]) });
    return { id: part.id + '-trace', part: part.id, samples };
  });
  return { doc, group, features, position };
}

test('fitWarpToTraces on merged leaf in a root parent group inverts nonlinear source T and preserves sources/other axes', () => {
  const { doc, features, position } = fitCase(), before = JSON.stringify(doc);
  const fitted = fitWarpToTraces(doc, { id: doc.parts[0].id, x: -30, y: 25, features: [features[0]], smoothness: 0 });
  assert.ok(fitted.report.before[0].maxPixels > .5, 'target requires a real change');
  assert.ok(fitted.report.after[0].maxPixels < .01, JSON.stringify(fitted.report));
  for (const sample of features[0].samples) close(position(fitted.doc, features[0].part, sample.from), sample.to, .01);
  assert.equal(JSON.stringify(doc), before);
  assert.deepEqual(fitted.doc.axisSources, doc.axisSources);
  assert.deepEqual(fitted.doc.deformers, doc.deformers);
  for (const [x, y] of [[-30, 0], [30, 0], [0, -25], [0, 25], [-30, -25]]) for (const p of doc.parts) close(evaluatePoints(fitted.doc, fitted.doc.parts.find(n => n.id === p.id)!, x, y, 3), evaluatePoints(doc, p, x, y, 3));
});

test('fitWarpToTraces selected canvas group receives each descendant source pose and measures actual residual', () => {
  const { doc, group, features, position } = fitCase();
  const fitted = fitWarpToTraces(doc, { id: group.id, x: -30, y: 25, features, smoothness: 0 });
  assert.ok(fitted.report.before.every(r => r.maxPixels > .5), 'both independently mapped leaves require real changes');
  const actualErrors = features.map(f => Math.max(...f.samples.map(s => { const q = position(fitted.doc, f.part, s.from); return Math.hypot(q[0] - s.to[0], q[1] - s.to[1]); })));
  assert.ok(Math.max(...actualErrors) < .01, JSON.stringify({ report: fitted.report, actualErrors }));
  assert.deepEqual(fitted.doc.axisSources, doc.axisSources);
  assert.deepEqual(fitted.doc.parts, doc.parts, 'only the selected group correction changes');
  for (const [x, y] of [[-30, 0], [0, 25], [0, -25], [-30, -25]]) for (const p of doc.parts) close(evaluatePoints(fitted.doc, fitted.doc.parts.find(n => n.id === p.id)!, x, y, 3), evaluatePoints(doc, p, x, y, 3));
  // Weight reduction and reported residuals include each complete leaf source
  // pose, including independently grouped descendants.
  const occluded = fitWarpToTraces(doc, { id: group.id, x: -30, y: 25, smoothness: 0, features: [...features,
    { id: 'conflicting-hidden', part: features[0].part, visibility: 'occluded', weight: 100, samples: [{ from: [50, 50], to: [90, 90] }] }] });
  assert.ok(occluded.report.occludedWeightScale < 1);
  for (const [i, f] of features.entries()) {
    const error = Math.max(...f.samples.map(s => { const q = position(occluded.doc, f.part, s.from); return Math.hypot(q[0] - s.to[0], q[1] - s.to[1]); }));
    assert.ok(error < .11, 'conflicting hidden points do not displace the visible face');
    assert.ok(Math.abs(error - occluded.report.after[i].maxPixels) < .001);
  }
});

test('pose evaluator matches scalar warps across inherited axes and shares one prepared parent between parts', () => {
  const source = joint();
  source.parameters = [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [-25, 0, 25] }];
  const targets = source.parts.slice(0, 2).map(part => part.id);
  const doc = editNineAxis(source, [
    { action: 'create_warp', id: 'shared', targets, cols: 3, rows: 3 },
    { action: 'transform', id: 'shared', x: -30, y: 25, translate: [3, 2] },
  ]);
  const samples = Float32Array.of(-13, -4, 6, 18, 40.7, 52.3, 119, 115);
  for (const [x, y] of [[-30, 25], [18, -12.5], [0, 14], [0, 0]]) {
    const deform = createPointDeformer(doc, x, y);
    for (const part of doc.parts.slice(0, 2)) {
      const native = keyformAt(part, x, y), expected = [];
      for (let i = 0; i < samples.length; i += 2)
        expected.push(...parentPoint(doc, part, x, y, ...warpPoint(part, native, samples[i], samples[i + 1])));
      close(deform(part, samples), Float32Array.from(expected), .0001);
    }
  }
});
