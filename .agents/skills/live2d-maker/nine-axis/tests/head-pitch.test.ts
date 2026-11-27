import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { joint, grid, pts, scale } from './axis-fixtures.ts';
import { nodes, evaluatePoints, type HeadNineAxis } from '../../shared/nine-axis-model.js';
import { nineAxisPreviewModes } from '../../shared/nine-axis-preview.js';
import { editNineAxis } from '../../shared/nine-axis-edit.js';
import { initializeHeadPitch, checkHeadPitch, checkHeadPitchDelivery, headPitchDirections, headPitchStage, headPitchAngle, seedHeadPitch, mergeHeadPitch, headPitchScope, type HeadPitchDirection } from '../head-pitch.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { runWorkflow, createFitHead } from '../run.ts';
import { checkHeadCorners, initializeHeadCorners } from '../head-corners.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { useKnowledge, defaultKnowledgeDirectory } from '../../shared/knowledge.ts';
import { stepDeliveries } from '../../shared/step-deliveries.ts';
import { readStep } from '../../shared/step-chain.ts';
import { applyStepAction } from '../../workflow/step-actions.ts';
import { readStepSession, writeStepSession } from '../../shared/agents/step-session.ts';
import { stubStepTools } from '../../shared/tests/knowledge-fixture.ts';
import type { MaterialLoader } from '../kra-materials.ts';

const tools = () => stubStepTools('nine-axis', 'step10_head-pitch');

function source(): HeadNineAxis & { axis: number } {
  const doc = joint() as HeadNineAxis & { axis: number };
  doc.parameters = [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [0], min: 0, max: 0 }];
  doc.source = { document: 'nine-axis/step09_head-accessories/character-nine-axis.kra', geometryDocument: 'original.kra' };
  doc.levels.push({ id: 'hair', includes: ['face', 'hair'] }, { id: 'accessory', includes: ['face', 'hair', 'accessory'] });
  const carrier = { ...grid('shared-braid-tie'), level: 'hair' as const };
  carrier.keyforms = Object.fromEntries([-30, -15, 0, 15, 30].map(x => [String(x), pts(carrier, (px, py) => [px + x / 15, py + x * py / 6000])]));
  doc.deformers.push(carrier);
  for (const [id, level] of [['hair/braid', 'hair'], ['head_accessories/tie', 'accessory']] as const)
    doc.parts.push({ ...grid(id), level, partId: 'character:' + id, parent: carrier.id, textureBounds: [0, 0, 100, 100] });
  doc.parts.forEach((p, i) => { p.uuid = `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`; p.partId ??= 'character:' + p.id; });
  doc.parts.push({...grid('neck/upper'),uuid:'00000000-0000-0000-0000-999999999999',textureBounds:[0,0,100,100]});
  return doc;
}

function deform(doc: ReturnType<typeof initializeHeadPitch>, direction: HeadPitchDirection) {
  const y = headPitchAngle(direction, scale);
  return editNineAxis(doc, doc.deformers.filter(n => n.id.startsWith('pitch/')).flatMap(n => [y / 2, y].map(angle =>
    ({ action: 'transform', id: n.id, y: angle, translate: [angle / 50, -angle / 10] }))));
}

test('whole-head direction authors keep identical prepared topology and protect existing axes and fixed neck', () => {
  const base = source(), up = initializeHeadPitch(base, 'head-up', scale), down = initializeHeadPitch(base, 'head-down', scale);
  assert.deepEqual(up.deformers, down.deformers); assert.deepEqual(up.parts, down.parts);
  assert.equal(up.parts.find(p => p.id === 'neck')!.parent, undefined);
  assert.equal(up.parts.find(p => p.id === 'neck/upper')!.parent, undefined);
  assert.equal(up.parts.find(p => p.id === 'hair/braid')!.parent, up.parts.find(p => p.id === 'head_accessories/tie')!.parent);
  const after = deform(up, 'up'); checkHeadPitch(after, base, 'head-up', scale); checkHeadPitchDelivery(after, 'up', scale);
  assert.throws(() => checkHeadPitchDelivery(up, 'up', scale), /尚未交付/);
  const wrongX = structuredClone(after); wrongX.parts[0].keyforms['-30'][0][0] += 1;
  assert.throws(() => checkHeadPitch(wrongX, base, 'head-up', scale), /仅编辑本方向/);
  const wrongY = structuredClone(after); wrongY.parts[0].keyformsY!['-25'][0][0] += 1;
  assert.throws(() => checkHeadPitch(wrongY, base, 'head-up', scale), /另一方向/);
  const wrongNeck = structuredClone(after); wrongNeck.parts.find(p => p.id === 'neck')!.keyformsY!['25'][0][0] += 1;
  assert.throws(() => checkHeadPitch(wrongNeck, base, 'head-up', scale), /脖子|不能跟随/);
});

test('pitch and corner controls cap dense parents at 4×4 without altering upstream poses', () => {
  const upstream = source();
  for (const [cols, rows] of [[4, 20], [12, 32], [2, 3]]) {
    const parent = { ...grid(`parent-${cols}-${rows}`), level: 'hair' as const, cols, rows };
    parent.keyforms = Object.fromEntries([-30, 0, 30].map(x => [x, pts(parent, (px, py) => [px + x * py / 1000, py])]));
    parent.keyformsY = { '25': pts(parent, (px, py) => [px, py - px / 50]), '-25': pts(parent, (px, py) => [px, py + px / 50]) };
    upstream.deformers.push(parent);
    upstream.parts.push({ ...grid(`hair/lock-${cols}-${rows}`), level: 'hair', material: 'transparent', parent: parent.id,
      textureBounds: [0, 0, 100, 100] });
  }
  const original = structuredClone(upstream);
  for (const doc of [initializeHeadPitch(upstream, 'head-up', scale), initializeHeadCorners(upstream, scale)]) {
    assert.deepEqual(doc.deformers.slice(0, upstream.deformers.length), upstream.deformers);
    for (const [cols, rows] of [[4, 20], [12, 32], [2, 3]]) {
      const original = upstream.parts.find(p => p.id === `hair/lock-${cols}-${rows}`)!;
      const current = doc.parts.find(p => p.id === original.id)!;
      const control = doc.deformers.find(n => n.id === current.parent)!;
      assert.deepEqual([control.cols, control.rows, control.parent], [Math.min(cols, 4), Math.min(rows, 4), original.parent]);
      for (const [x, y] of [[0, 0], [-30, 0], [-15, 0], [15, 0], [30, 0], [0, -25], [0, 12.5], [0, 25]])
        assert.deepEqual(evaluatePoints(doc, current, x, y, 2), evaluatePoints(upstream, original, x, y, 2));
    }
  }
  assert.deepEqual(upstream, original);
});

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'head-pitch-')), task = join(root, 'case'), nine = join(task, 'nine-axis'), upstream = join(nine, 'step09_head-accessories'), output = join(nine, 'step10_head-pitch');
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, value: unknown) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  const doc = source();
  for (const step of ['step08_hair', 'step09_head-accessories']) {
    for (const path of await stepDeliveries(nine, 'nine-axis', step)) await put(path, path.endsWith('.json') ? doc : 'saved input');
    await put(join(nine, step, '.completed'), '');
  }
  await put(join(nine, 'step08_hair/hair-progress.json'), { version: 2, completed: ['front', 'side', 'back', 'remaining'], next: 'done' });
  const paint = async (direction: HeadPitchDirection, folder: string) => {
    const author = join(folder, `head-${direction}.json`), doc = JSON.parse(await readFile(author, 'utf8'));
    await put(author, deform(doc, direction)); await put(join(folder, 'notes.md'), `saved ${direction}`);
  };
  const materialize: MaterialLoader = async (_directory, built) => built;
  return { root, task, nine, upstream, output, doc, put, paint, options: { name: 'case', dir: root, step: 'step10_head-pitch' },
    dependencies: { environment: loadWorkflowEnvironment({}), materialize, ffmpegCheck: async () => assert.fail('existing references need no new video'),
      resolveInput: async () => ({ document: join(upstream, 'character-nine-axis.kra'), color: join(upstream, 'character-nine-axis.png'), parts: [], source: { id: 'accessories', directory: upstream } }) } };
}

test('up/down reuse the KRA and merge exact half-axis functions without changing X or copying artwork', async t => {
  const f = await fixture(t);
  for (const direction of headPitchDirections) {
    const folder = join(f.output, direction); await seedHeadPitch(folder, f.upstream, f.task, direction, scale); await f.paint(direction, folder);
    if(direction==='up'){
      const path=join(folder,'head-up.json'),author=JSON.parse(await readFile(path,'utf8'));
      const neutralFace=author.deformers.find((n:any)=>n.id===author.parts[0].parent);delete neutralFace.keyformsY;
      await f.put(path,author);
    }
    await f.put(join(folder, 'deformers.json'), JSON.parse(await readFile(join(folder, `head-${direction}.json`), 'utf8')));
    assert.equal((await readdir(folder)).some(p => p.endsWith('.kra')), false);
  }
  const merged = await mergeHeadPitch(f.output, f.upstream, scale);
  assert.equal(merged.doc.source!.document, f.doc.source!.document);
  for(const mode of nineAxisPreviewModes(merged.doc))assert.deepEqual(mode.axes.y.keys,[-25,0,25]);
  for (const x of [-30, -22.5, -15, 0, 15, 22.5, 30]) for (const part of f.doc.parts)
    assert.deepEqual(evaluatePoints(merged.doc, merged.doc.parts.find(p => p.id === part.id)!, x, 0, 2), evaluatePoints(f.doc, part, x, 0, 2));
  for (const direction of headPitchDirections) {
    const author = JSON.parse(await readFile(join(f.output, direction, `head-${direction}.json`), 'utf8'));
    for (const factor of [.2, .5, .75, 1]) for (const part of merged.doc.parts)
      assert.deepEqual(evaluatePoints(merged.doc, part, 0, factor * headPitchAngle(direction, scale), 2), evaluatePoints(author, author.parts.find((p: any) => p.id === part.id), 0, factor * headPitchAngle(direction, scale), 2));
  }
});

test('saved parent-sized controls remain editable and a new pitch sibling merges without resampling', async t => {
  const f = await fixture(t);
  const upstream = f.doc, parent = upstream.deformers.find(n => n.id === 'shared-braid-tie')!;
  parent.rows = 20;
  parent.keyforms = Object.fromEntries([-30, 0, 30].map(x => [x, pts(parent, (px, py) => [px + x / 15, py])]));
  await f.put(join(f.upstream, 'deformers.json'), upstream);
  const upFolder = join(f.output, 'up'), downFolder = join(f.output, 'down');
  const hair = 'hair/braid';
  const controlFor = (doc: HeadNineAxis) => doc.deformers.find(n => n.id === doc.parts.find(p => p.id === hair)!.parent)!;
  const withLegacyRows = (doc: HeadNineAxis) => {
    const control = controlFor(doc);
    control.rows = parent.rows;
    for (const forms of [control.keyforms, control.keyformsY, control.keyformsXY])
      for (const key of Object.keys(forms ?? {})) forms![key] = pts(control);
  };
  const corner = initializeHeadCorners(upstream, scale);
  withLegacyRows(corner);
  checkHeadCorners(corner, upstream, scale);
  const up = initializeHeadPitch(upstream, 'head-up', scale);
  withLegacyRows(up);
  const savedUp = deform(up, 'up');
  await f.put(join(upFolder, 'head-up.json'), savedUp);
  await f.put(join(upFolder, 'deformers.json'), savedUp);
  await seedHeadPitch(downFolder, f.upstream, f.task, 'down', scale);
  const down = JSON.parse(await readFile(join(downFolder, 'head-down.json'), 'utf8'));
  assert.equal(controlFor(down).rows, 20);
  await f.paint('down', downFolder);
  for (const [direction, folder] of [['up', upFolder], ['down', downFolder]] as const) {
    const author = JSON.parse(await readFile(join(folder, `head-${direction}.json`), 'utf8'));
    checkHeadPitch(author, upstream, headPitchStage(direction), scale);
    await f.put(join(folder, 'deformers.json'), author);
    await f.put(join(folder, 'notes.md'), direction);
  }
  const { doc } = await mergeHeadPitch(f.output, f.upstream, scale);
  assert.equal(controlFor(doc).rows, 20);
  for (const [direction, folder] of [['up', upFolder], ['down', downFolder]] as const) {
    const author = JSON.parse(await readFile(join(folder, 'deformers.json'), 'utf8')) as HeadNineAxis;
    const y = headPitchAngle(direction, scale);
    assert.deepEqual(evaluatePoints(doc, doc.parts.find(p => p.id === hair)!, 0, y, 2),
      evaluatePoints(author, author.parts.find(p => p.id === hair)!, 0, y, 2));
  }
});

test('official head-pitch uses concurrent independent branches, keeps a completed sibling and only completes its parent after merge', { timeout: 5000 }, async t => {
  useKnowledge(defaultKnowledgeDirectory); const f = await fixture(t), seen: string[] = [];
  let release!: () => void; const both = new Promise<void>(resolve => { release = resolve; });
  await runWorkflow(f.options, { ...f.dependencies, fitHeadPitch: Object.fromEntries(headPitchDirections.map(direction => [direction, async (folder: string, _prompt: string, verify?: () => Promise<unknown>) => {
    seen.push(direction); if (seen.length === 2) release(); await both; await f.paint(direction, folder); await verify!();
  }])) });
  assert.deepEqual(seen.sort(), ['down', 'up']); assert.equal((await readStep(f.output)).status, 'completed');
  for (const direction of headPitchDirections) assert.equal((await readStep(join(f.output, direction))).status, 'completed');
  const up = await readFile(join(f.output, 'up/head-up.json')), sourceKra = await readFile(join(f.upstream, 'character-nine-axis.kra'));
  await applyStepAction({ name: 'case', dir: f.root, section: 'nine-axis', step: 'step10_head-pitch/down', action: 'retry' });
  assert.deepEqual(await readFile(join(f.output, 'up/head-up.json')), up); assert.equal((await readStep(f.output)).status, 'running');
  await assert.rejects(readFile(join(f.output, 'deformers.json')));
  await runWorkflow(f.options, { ...f.dependencies, fitHeadPitch: { up: async () => assert.fail('completed up is kept'), down: async (folder, _prompt, verify) => { await f.paint('down', folder); await verify!(); } } });
  assert.deepEqual(await readFile(join(f.upstream, 'character-nine-axis.kra')), sourceKra); assert.equal((await readStep(f.output)).status, 'completed');
});

test('parent resume replaces only unfinished direction sessions and a failed branch keeps its completed sibling', async t => {
  useKnowledge(defaultKnowledgeDirectory); const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.dependencies, fitHeadPitch: { up: async (folder, _prompt, verify) => { await f.paint('up', folder); await verify!(); }, down: async () => { throw Error('fixture interruption'); } } }), /fixture interruption/);
  assert.equal((await readStep(join(f.output, 'up'))).status, 'completed'); assert.equal((await readStep(f.output)).status, 'running');
  for (const direction of headPitchDirections) await writeStepSession(f.nine, `step10_head-pitch/${direction}`, { threadId: direction + '-thread', harness: 'codex' });
  await applyStepAction({ name: 'case', dir: f.root, section: 'nine-axis', step: 'step10_head-pitch', action: 'resume' });
  assert.equal((await readStepSession(f.nine, 'step10_head-pitch/up'))!.threadId, 'up-thread');
  assert.equal((await readStepSession(f.nine, 'step10_head-pitch/down'))?.threadId, undefined);
});

test('head-pitch sessions start independently of the hair session and continue each direction separately',async t=>{
  useKnowledge(defaultKnowledgeDirectory);const f=await fixture(t),seen:(string|undefined)[]=[],roles:string[]=[];
  await writeStepSession(f.nine,'step08_hair',{threadId:'previous-hair',harness:'codex'});
  const agents={async run(){assert.fail('step session required');},createSession(id?:string){seen.push(id);const next=id??`pitch-${seen.length}`;return{async run(task:{step:string}){roles.push(task.step);return{text:'{"error":null}',images:[],threadId:next,harness:'codex' as const};},async close(){}};}};
  for(const direction of headPitchDirections){const folder=join(f.output,direction);await mkdir(folder,{recursive:true});
    await createFitHead(agents,tools,`step10_head-pitch/${direction}`,'fixture',undefined,f.nine)(folder,'fixture',async()=>{});
  }
  await createFitHead(agents,tools,'step10_head-pitch/up','fixture',undefined,f.nine)(join(f.output,'up'),'fixture',async()=>{});
  assert.deepEqual(seen,[undefined,undefined,'pitch-1']);
  assert.deepEqual(roles,['nine_axis_head_pitch','nine_axis_head_pitch','nine_axis_head_pitch']);
  assert.equal((await readStepSession(f.nine,'step08_hair'))!.threadId,'previous-hair');
});

for (const repaired of [true, false]) test(`head-pitch missing notes uses the normal two correction turns: ${repaired ? 'repaired' : 'exhausted'}`, async t => {
  useKnowledge(defaultKnowledgeDirectory); const f = await fixture(t); let calls = 0;
  const agents = { async run() { assert.fail('saved branch session required'); }, createSession() { return { async run() {
    calls++; const folder = join(f.output, 'up');
    if (calls === 1) { await f.paint('up', folder); await rm(join(folder, 'notes.md')); }
    if (repaired && calls === 3) await f.put(join(folder, 'notes.md'), 'saved');
    return { text: '{"error":null}', images: [], threadId: 'up-thread', harness: 'codex' as const };
  }, async close() {} }; } };
  const running = runWorkflow({ ...f.options, step: 'step10_head-pitch/up' }, { ...f.dependencies, fitHeadPitch: { up: createFitHead(agents, tools, 'step10_head-pitch/up', '完整头部抬头', undefined, f.nine) } });
  if (repaired) await running; else await assert.rejects(running);
  assert.equal(calls, 3); assert.equal((await readStep(join(f.output, 'up'))).status, repaired ? 'completed' : 'running');
  assert.equal((await readStep(f.output)).status, 'running'); assert.equal((await readStep(join(f.output, 'down'))).status, 'absent');
});

test('the normal edit tool restricts head-pitch to its signed Y half-axis', async t => {
  const f = await fixture(t), folder = join(f.output, 'up'); await seedHeadPitch(folder, f.upstream, f.task, 'up', scale);
  const edit = createContinuationEditTool(folder, f.upstream, 'head-up', scale, f.task, undefined, headPitchScope), signal = new AbortController().signal;
  const carrier = nodes(initializeHeadPitch(f.doc, 'head-up', scale)).find(n => n.id.startsWith('pitch/'))!.id;
  await edit.execute({ operations: [{ action: 'transform', id: carrier, y: 25, translate: [0, -1] }] }, signal);
  await assert.rejects(edit.execute({ operations: [{ action: 'transform', id: carrier, y: -25, translate: [0, -1] }] }, signal), /本方向/);
  await assert.rejects(edit.execute({ operations: [{ action: 'mirror', targets: [carrier], x: 30, y: 25 }] }, signal), /本方向/);
  await assert.rejects(edit.execute({ operations: [{ action: 'create_warp', id: 'extra', targets: [] }] }, signal), /已准备头部承载/);
});
