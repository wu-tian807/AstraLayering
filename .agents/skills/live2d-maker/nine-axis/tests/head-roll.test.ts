import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { evaluatePoints, headRollLimit, HEAD_ROLL_LIMIT, kraReferences, nineAxisCapabilities, validateHeadNineAxis, type HeadNineAxis } from '../../shared/nine-axis-model.js';
import { headRollStep } from '../../shared/nine-axis.ts';
import { readStep } from '../../shared/step-chain.ts';
import { stepDeliveries } from '../../shared/step-deliveries.ts';
import { applyStepAction } from '../../workflow/step-actions.ts';
import { prepareHeadRoll } from '../head-roll.ts';
import { runWorkflow } from '../run.ts';
import { grid, joint, pts } from './axis-fixtures.ts';

function corners() {
  const doc = joint();
  doc.parts.push({ ...grid('neck/upper', [40, 50, 60, 80]), textureBounds: [40, 50, 20, 30] });
  doc.parts.push({ ...grid('jaw/contact_mask'), textureBounds: [0, 0, 100, 100], role: 'mask' });
  doc.parts.push({ ...grid('jaw/chin_to_neck'), textureBounds: [0, 0, 100, 100], clip: { by: ['neck'] },
    shadow: { casters: ['face/face_base'], receivers: ['neck'], opacity: 0.5, blendMode: 'multiply' } });
  doc.parts[0].clip = { by: ['jaw/contact_mask'], invert: true };
  const parent = grid('corners/0');
  parent.keyformsXY = { '30,25': pts(parent, (x, y) => [x + 5, y - 2]) };
  doc.deformers.push(parent);
  doc.parts[0].parent = parent.id;
  for (const [i, part] of doc.parts.entries()) {
    delete part.texture;
    part.uuid = `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`;
  }
  for (const { doc: axis } of doc.axisSources!) for (const part of axis.parts) {
    delete part.texture;
    part.uuid = doc.parts.find(candidate => candidate.id === part.id)!.uuid;
  }
  return doc;
}

test('roll preserves XY at zero and rotates the final pose, masks and shadows around the fixed neck contact', () => {
  const original = corners(), rolled = prepareHeadRoll(original);
  assert.equal(headRollLimit(original), 0);
  assert.equal(headRollLimit(rolled), HEAD_ROLL_LIMIT);
  assert.deepEqual(rolled.headRoll!.pivot, [50, 80]);
  const [cx, cy] = rolled.headRoll!.pivot;
  const angle = HEAD_ROLL_LIMIT * Math.PI / 180;
  for (const part of original.parts) {
    const before = evaluatePoints(original, part, 30, 25, 2);
    assert.deepEqual(evaluatePoints(rolled, part, 30, 25, 2), before);
    const after = evaluatePoints(rolled, part, 30, 25, 2, HEAD_ROLL_LIMIT);
    assert.deepEqual(evaluatePoints(rolled, part, 30, 25, 2, 100), after);
    assert.deepEqual(evaluatePoints(rolled, part, 30, 25, 2, -100), evaluatePoints(rolled, part, 30, 25, 2, -HEAD_ROLL_LIMIT));
    if (part.id === 'neck' || part.id === 'neck/upper') {
      assert.deepEqual(after, before);
      continue;
    }
    for (let i = 0; i < before.length; i += 2) {
      const dx = before[i] - cx, dy = before[i + 1] - cy;
      assert.ok(Math.abs(after[i] - (cx + Math.cos(angle) * dx - Math.sin(angle) * dy)) < 0.0001, part.id);
      assert.ok(Math.abs(after[i + 1] - (cy + Math.sin(angle) * dx + Math.cos(angle) * dy)) < 0.0001, part.id);
    }
  }
});

function faceVerticalRange(doc: HeadNineAxis, y: number) {
  const face = doc.parts.find(p => p.id === 'face/face_base')!;
  const points = evaluatePoints(doc, face, 0, y, 5).filter((_, i) => i % 2 === 1);
  const top = Math.min(...points), bottom = Math.max(...points);
  return { center: (top + bottom) / 2, height: bottom - top };
}

function withHeadLift(lift: number) {
  const doc = corners();
  doc.parameters = [{ id: 'ParamAngleX', min: -30, max: 30, keys: [-30, 0, 30] },
    { id: 'ParamAngleY', min: -25, max: 25, keys: [-25, 0, 25] }];
  const outer = doc.deformers[0], inner = { ...grid('corners/inner'), parent: outer.id };
  outer.keyforms['-30'] = pts(outer, (x, y) => [x - 3, y + x / 60]);
  outer.keyforms['30'] = pts(outer, (x, y) => [x + 4, y - x / 80]);
  outer.keyformsY = { '-25': pts(outer, (x, y) => [x, y + 4]), '25': pts(outer) };
  inner.keyformsY = { '-25': pts(inner), '12.5': pts(inner, (x, y) => [x + y / 80, y + 0.7]), '25': pts(inner) };
  doc.deformers.push(inner);
  doc.parts[0].parent = inner.id;
  const add = (id: string, level: 'face' | 'hair' | 'accessory', parent?: string, partId = id) => {
    const part = { ...grid(id), level, parent, partId, material: 'transparent' as const, textureBounds: [0, 0, 100, 100] };
    doc.parts.push(part);
    return part;
  };
  add('hair/bangs', 'hair', inner.id);
  const bow = add('head_accessories/bow', 'accessory');
  bow.keyforms['-30'] = pts(bow, (x, y) => [x - 4, y]);
  bow.keyforms['30'] = pts(bow, (x, y) => [x + 4, y]);
  const clasp = add('head_accessories/clasp', 'accessory');
  clasp.keyformsY = { '-25': pts(clasp), '25': pts(clasp, (x, y) => [x + 1, y - 2]) };
  add('body/shoulder', 'face', outer.id);
  const current = faceVerticalRange(doc, 0).center - faceVerticalRange(doc, 25).center;
  outer.keyformsY['25'] = pts(outer, (x, y) => [x, y + current - lift]);
  return validateHeadNineAxis(doc);
}

test('roll keeps the authored head lift and all nested XY geometry at Z=0', () => {
  const original = withHeadLift(18), rolled = prepareHeadRoll(original);
  assert.equal(rolled.parts, original.parts);
  assert.equal(rolled.deformers, original.deformers);
  assert.equal(rolled.axisSources, original.axisSources);
  assert.deepEqual(nineAxisCapabilities(rolled), nineAxisCapabilities(original));
  assert.ok(Math.abs(faceVerticalRange(rolled, 0).center - faceVerticalRange(rolled, 25).center - 18) < .001);
  for (const part of original.parts) for (const x of [-30, -12, 0, 17, 30]) for (const y of [-25, 0, 12.5, 25]) {
    assert.deepEqual(evaluatePoints(rolled, part, x, y, 5), evaluatePoints(original, part, x, y, 5));
  }
});

test('the deterministic roll step requires completed corners and can retry using the same saved KRA', async t => {
  const root = await mkdtemp(join(tmpdir(), 'head-roll-')), task = join(root, 'case'), nine = join(task, 'nine-axis');
  t.after(() => rm(root, { recursive: true, force: true }));
  const upstream = 'step11_head-angle-xy', marker = join(nine, upstream, '.completed'), output = join(nine, headRollStep);
  const original = corners(), document = join(task, original.source!.document);
  await mkdir(task, { recursive: true });
  await writeFile(document, 'saved KRA');
  for (const path of await stepDeliveries(nine, 'nine-axis', upstream)) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, path.endsWith('.json') ? JSON.stringify(original) : 'four corners checked');
  }
  const options = { name: 'case', dir: root, step: headRollStep };
  const dependencies = {
    environment: loadWorkflowEnvironment({}),
    resolveInput: async () => assert.fail('roll uses the completed model as its source'),
    ffmpegCheck: async () => assert.fail('roll does not require video'),
    fitHeadCorners: async () => assert.fail('roll does not dispatch a head agent'),
  };
  await assert.rejects(runWorkflow(options, dependencies), /先完成完整头部四角/);
  await writeFile(marker, '');
  await runWorkflow(options, dependencies);
  assert.equal((await readStep(output)).status, 'completed');
  assert.deepEqual((await readdir(output)).sort(), ['.completed', 'deformers.json']);
  const modelPath = join(output, 'deformers.json'), saved = await readFile(modelPath, 'utf8');
  assert.deepEqual(JSON.parse(saved), kraReferences(prepareHeadRoll(original)));
  await rename(marker, join(nine, upstream, '.running'));
  await assert.rejects(runWorkflow(options, dependencies), /先完成完整头部四角/);
  await rename(join(nine, upstream, '.running'), marker);
  await applyStepAction({ ...options, section: 'nine-axis', action: 'retry' });
  await runWorkflow(options, dependencies);
  assert.equal(await readFile(modelPath, 'utf8'), saved);
  assert.equal(await readFile(document, 'utf8'), 'saved KRA');
  assert.equal((await readStep(join(nine, upstream))).status, 'completed');
  await applyStepAction({ ...options, step: upstream, section: 'nine-axis', action: 'retry' });
  assert.equal((await readStep(output)).status, 'absent');
  assert.equal(await readFile(document, 'utf8'), 'saved KRA');
});
