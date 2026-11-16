import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { grid, joint, pts, scale } from './axis-fixtures.ts';
import { nodes, evaluatePoints, type HeadNineAxis } from '../../shared/nine-axis-model.js';
import { editNineAxis } from '../../shared/nine-axis-edit.js';
import { nineAxisPreviewModes } from '../../shared/nine-axis-preview.js';
import { readStep } from '../../shared/step-chain.ts';
import { stepDeliveries } from '../../shared/step-deliveries.ts';
import { readStepSession, writeStepSession } from '../../shared/agents/step-session.ts';
import type { FunctionTool } from '../../shared/codex/function-tools.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { defaultKnowledgeDirectory, useKnowledge } from '../../shared/knowledge.ts';
import { applyStepAction } from '../../workflow/step-actions.ts';
import { initializeHeadCorners, checkHeadCorners, headCornerControlIds, headCornerPoses, headCornerScope, seedHeadCorners, buildHeadCorners } from '../head-corners.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { runWorkflow, createFitHead } from '../run.ts';
import type { MaterialLoader } from '../kra-materials.ts';

const step = 'step11_head-angle-xy';
function source(): HeadNineAxis & { axis: number } {
  const doc = joint() as HeadNineAxis & { axis: number };
  doc.parameters = [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [-25, 0, 25] }];
  doc.source = { document: 'nine-axis/step09_head-accessories/character-nine-axis.kra', geometryDocument: 'original.kra' };
  doc.levels.push({ id: 'hair', includes: ['face', 'hair'] }, { id: 'accessory', includes: ['face', 'hair', 'accessory'] });
  const inherited = grid('corners/0'); // An upstream ID is never granted editing rights by its name.
  inherited.keyforms['-30'] = pts(inherited, (x, y) => [x - 3, y]);
  inherited.keyforms['30'] = pts(inherited, (x, y) => [x + 5, y]);
  inherited.keyformsY = { '-25': pts(inherited, (x, y) => [x, y + 4]), '25': pts(inherited, (x, y) => [x, y - 3]) };
  doc.deformers.push(inherited);
  for (const [id, level] of [['hair/braid', 'hair'], ['head_accessories/tie', 'accessory']] as const)
    doc.parts.push({ ...grid(id), level, partId: 'character:' + id, parent: inherited.id, textureBounds: [0, 0, 100, 100] });
  doc.parts.forEach((part, i) => { part.uuid = `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`; part.partId ??= 'character:' + part.id; });
  return doc;
}

function deform(doc: ReturnType<typeof initializeHeadCorners>, upstream: ReturnType<typeof source>) {
  return editNineAxis(doc, [...headCornerControlIds(upstream, doc)].flatMap(id => headCornerPoses(scale).map(([x, y]) =>
    ({ action: 'transform', id, x, y, translate: [x < 0 ? -1 : 2, y < 0 ? 1 : -2] }))));
}

function samePose(a: HeadNineAxis, b: HeadNineAxis, x: number, y: number) {
  for (const part of a.parts) {
    const before = evaluatePoints(a, part, x, y, 2), after = evaluatePoints(b, b.parts.find(p => p.id === part.id)!, x, y, 2);
    assert.equal(before.length, after.length);
    assert.ok(before.every((value, i) => Math.abs(value - after[i]) < .001), `${part.id} at ${x},${y}`);
  }
}

test('neutral corner controls preserve inherited motion and all three preview planes before any edits', () => {
  const base = source(), bytes = JSON.stringify(base), doc = initializeHeadCorners(base, scale);
  checkHeadCorners(doc, base, scale);
  for (const x of [-30, -15, 0, 15, 30]) for (const y of [-25, -12.5, 0, 12.5, 25]) samePose(base, doc, x, y);
  assert.equal(doc.parts.find(p => p.id === 'neck')!.parent, undefined);
  assert.equal(doc.parts.find(p => p.id === 'hair/braid')!.parent, doc.parts.find(p => p.id === 'head_accessories/tie')!.parent);
  assert.ok(!headCornerControlIds(base, doc).has('corners/0'));
  for (const mode of nineAxisPreviewModes(doc)) {
    assert.deepEqual(mode.axes.x.keys, [-30, 0, 30]); assert.deepEqual(mode.axes.y.keys, [-25, 0, 25]);
  }
  assert.equal(JSON.stringify(base), bytes);
});

test('four independently authored corners and intermediate XY corrections leave every single-axis pose unchanged', () => {
  const base = source(), initial = initializeHeadCorners(base, scale), controls = headCornerControlIds(base, initial), id = [...controls][0];
  let doc = deform(initial, base);
  doc = editNineAxis(doc, [{ action: 'transform', id, x: -15, y: -12.5, translate: [-.5, .5] }]);
  checkHeadCorners(doc, base, scale);
  for (const x of [-30, -22.5, -15, 0, 15, 22.5, 30]) samePose(base, doc, x, 0);
  for (const y of [-25, -18.75, -12.5, 0, 12.5, 18.75, 25]) samePose(base, doc, 0, y);
  const control = doc.deformers.find(n => n.id === id)!;
  assert.notDeepEqual(control.keyformsXY!['-30,25'], control.keyformsXY!['30,25']);
  assert.ok(control.keyformsXY!['-15,-12.5']);
  assert.deepEqual(doc.axisSources, base.axisSources);
});

test('corner validation rejects edits to original nodes, binding, order, axes, topology and incomplete poses', () => {
  const base = source(), doc = deform(initializeHeadCorners(base, scale), base), id = [...headCornerControlIds(base, doc)][0];
  const invalid = (change: (copy: typeof doc) => void) => { const copy = structuredClone(doc); change(copy); assert.throws(() => checkHeadCorners(copy, base, scale)); };
  invalid(copy => { copy.parts[0].uuid = copy.parts[1].uuid; });
  invalid(copy => { copy.parts.reverse(); });
  invalid(copy => { copy.parts.find(p => p.id === 'neck')!.keyforms['0'][0][0] += 1; });
  invalid(copy => { copy.deformers.find(n => n.id === 'corners/0')!.keyforms['30'][0][0] += 1; });
  invalid(copy => { copy.deformers.find(n => n.id === id)!.keyforms['30'][0][0] += 1; });
  invalid(copy => { delete copy.deformers.find(n => n.id === id)!.keyformsXY!['30,25']; });
  invalid(copy => { copy.deformers.push(grid('extra')); });
  invalid(copy => { copy.deformers.find(n => n.id === id)!.keyformsXY!['30,25'][0] = [NaN, 0]; });
  invalid(copy => { copy.source!.document = 'other.kra'; });
});

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'head-corners-')), task = join(root, 'case'), nine = join(task, 'nine-axis'),
    upstream = join(nine, 'step10_head-pitch'), output = join(nine, step), doc = source();
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, value: unknown) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  for (const path of await stepDeliveries(nine, 'nine-axis', 'step10_head-pitch')) await put(path, path.endsWith('.json') ? doc : 'saved upstream');
  for (const id of ['step10_head-pitch', 'step10_head-pitch/up', 'step10_head-pitch/down']) await put(join(nine, id, '.completed'), '');
  const document = join(task, doc.source!.document!); await put(document, 'saved KRA');
  const paint = async (folder: string) => {
    await put(join(folder, 'head-xy.json'), deform(JSON.parse(await readFile(join(folder, 'head-xy.json'), 'utf8')), doc));
    await put(join(folder, 'notes.md'), 'four corners checked');
  };
  const materialize: MaterialLoader = async (_directory, built) => built;
  return { root, task, nine, upstream, output, doc, put, paint, options: { name: 'case', dir: root, step },
    dependencies: { environment: loadWorkflowEnvironment({}), materialize, ffmpegCheck: async () => assert.fail('no video generation in this step'),
      resolveInput: async () => ({ document, color: join(dirname(document), 'character-nine-axis.png'), parts: [], source: { id: 'accessories', directory: dirname(document) } }) } };
}

test('seed and edit use the upstream KRA without copying it, preserve asymmetric XY and reject out-of-scope tool operations', async t => {
  const f = await fixture(t); await seedHeadCorners(f.output, f.upstream, f.task, scale);
  const edit = createContinuationEditTool(f.output, f.upstream, 'head-xy', scale, f.task, undefined, headCornerScope), signal = new AbortController().signal;
  const id = [...headCornerControlIds(f.doc, initializeHeadCorners(f.doc, scale))][0];
  await edit.execute({ operations: [{ action: 'transform', id, x: 30, y: 25, translate: [2, -1] }] }, signal);
  const built = await buildHeadCorners(f.output, f.upstream, scale);
  const authored = JSON.parse(await readFile(join(f.output, 'head-xy.json'), 'utf8'));
  assert.deepEqual(built.doc.deformers.find(n => n.id === id)!.keyformsXY, authored.deformers.find((n: any) => n.id === id).keyformsXY);
  assert.equal(built.doc.source!.document, f.doc.source!.document);
  assert.equal((await readdir(f.output)).some(file => file.endsWith('.kra')), false);
  const saved = await readFile(join(f.output, 'head-xy.json')), compiled = await readFile(join(f.output, 'deformers.json'));
  await rm(join(f.output, 'source.json')); await seedHeadCorners(f.output, f.upstream, f.task, scale);
  assert.deepEqual(await readFile(join(f.output, 'head-xy.json')), saved);
  assert.deepEqual(await readFile(join(f.output, 'deformers.json')), compiled);
  assert.equal(JSON.parse(await readFile(join(f.output, 'source.json'), 'utf8')).sourceDocument, f.doc.source!.document);
  for (const operation of [
    { action: 'transform', id, x: 30, y: 0, translate: [1, 0] },
    { action: 'transform', id, x: -31, y: 25, translate: [1, 0] },
    { action: 'transform', id: 'corners/0', x: -30, y: 25, translate: [1, 0] },
    { action: 'create_warp', id: 'new', targets: [] },
  ]) await assert.rejects(edit.execute({ operations: [operation] }, signal));
});

test('official corners run one ordinary step, preserve upstream and refuse incomplete head-pitch delivery', async t => {
  useKnowledge(defaultKnowledgeDirectory); const f = await fixture(t), before = await readFile(join(f.upstream, 'deformers.json')); let calls = 0;
  await runWorkflow(f.options, { ...f.dependencies, fitHeadCorners: async (folder, _prompt, verify) => { calls++; await f.paint(folder); await verify!(); } });
  assert.equal(calls, 1); assert.equal((await readStep(f.output)).status, 'completed');
  assert.deepEqual(await readFile(join(f.upstream, 'deformers.json')), before);
  assert.ok(!(await readdir(f.output)).includes('up'));
  await rm(join(f.upstream, 'down/notes.md'));
  await assert.rejects(runWorkflow(f.options, { ...f.dependencies, fitHeadCorners: async () => assert.fail('bad upstream cannot dispatch') }));
});

test('continue, resume and retry reuse normal single-step session recovery and retain all upstream artwork and authors', async t => {
  useKnowledge(defaultKnowledgeDirectory); const f = await fixture(t), seen: (string | undefined)[] = [], roles: string[] = [];
  await seedHeadCorners(f.output, f.upstream, f.task, scale); await f.put(join(f.output, '.running'), '');
  await writeStepSession(f.nine, 'step10_head-pitch/up', { threadId: 'upstream-thread', harness: 'codex' });
  const tools = async (): Promise<FunctionTool[]> => ['view_bitmap', 'preview_svg', 'edit_nine_axis', 'view_nine_axis'].map(name =>
    ({ name, description: 'fixture', inputSchema: { type: 'object' }, async execute() { assert.fail('fixture does not execute drawing tools'); } }));
  const agents = { async run() { assert.fail('saved step session required'); }, createSession(id?: string) {
    seen.push(id); const threadId = id ?? `corners-${seen.length}`;
    return { async run(task: { step: string }) { roles.push(task.step); return { text: '{"error":null}', images: [], threadId, harness: 'codex' as const }; }, async close() {} };
  } };
  const run = () => createFitHead(agents, tools, step, '完整头部四角', undefined, f.nine)(f.output, 'fixture', async () => {});
  await run(); const author = await readFile(join(f.output, 'head-xy.json')), upstream = await readFile(join(f.upstream, 'deformers.json'));
  await applyStepAction({ ...f.options, section: 'nine-axis', action: 'continue' }); await run();
  await applyStepAction({ ...f.options, section: 'nine-axis', action: 'resume' }); await run();
  assert.deepEqual(seen, [undefined, 'corners-1', undefined]);
  assert.deepEqual(roles, ['nine_axis_head_corners', 'nine_axis_head_corners', 'nine_axis_head_corners']);
  assert.deepEqual(await readFile(join(f.output, 'head-xy.json')), author);
  await applyStepAction({ ...f.options, section: 'nine-axis', action: 'retry' });
  await assert.rejects(readFile(join(f.output, 'head-xy.json')), { code: 'ENOENT' });
  assert.equal(await readStepSession(f.nine, step), undefined);
  assert.deepEqual(await readFile(join(f.upstream, 'deformers.json')), upstream);
  assert.equal((await readStepSession(f.nine, 'step10_head-pitch/up'))!.threadId, 'upstream-thread');
  assert.equal(await readFile(join(f.task, f.doc.source!.document!), 'utf8'), 'saved KRA');
});

for (const repaired of [true, false]) test(`missing corner notes get at most two correction turns in the same session: ${repaired}`, async t => {
  useKnowledge(defaultKnowledgeDirectory); const f = await fixture(t); let calls = 0, sessions = 0;
  const tools = async (): Promise<FunctionTool[]> => ['view_bitmap', 'preview_svg', 'edit_nine_axis', 'view_nine_axis'].map(name =>
    ({ name, description: 'fixture', inputSchema: { type: 'object' }, async execute() { assert.fail('unused'); } }));
  const agents = { async run() { assert.fail('saved step session required'); }, createSession() { sessions++; return { async run() {
    calls++; if (calls === 1) { await f.paint(f.output); await rm(join(f.output, 'notes.md')); }
    if (repaired && calls === 3) await f.put(join(f.output, 'notes.md'), 'all four corners checked');
    return { text: '{"error":null}', images: [], threadId: 'corner-thread', harness: 'codex' as const };
  }, async close() {} }; } };
  const running = runWorkflow(f.options, { ...f.dependencies, fitHeadCorners: createFitHead(agents, tools, step, '完整头部四角', undefined, f.nine) });
  if (repaired) await running; else await assert.rejects(running);
  assert.equal(sessions, 1); assert.equal(calls, 3);
  assert.equal((await readStep(f.output)).status, repaired ? 'completed' : 'running');
  assert.equal((await readStep(f.upstream)).status, 'completed');
});
