import { readFile, writeFile, mkdir, copyFile, access, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const [repo, task, knowledge, mode = 'prepare'] = process.argv.slice(2);
const scope = process.argv[7] ?? 'all-hair';
if (!['all-hair', 'bangs-left', 'side-hair-left', 'back-hair-left'].includes(scope)) throw new Error('Unknown hair scope: ' + scope);
const leftOnly = scope !== 'all-hair';
const editableXs = leftOnly ? [-30] : [-30, 30];
if (!repo || !task || !knowledge) throw new Error('Pass repository, task and knowledge directories.');
const skill = join(repo, '.agents/skills/live2d-maker');
const workspace = join(task, 'nine-axis/step08_hair/workspace');
const scopedFile = name => join(workspace, `${scope}-${name}.md`);
const load = file => import(pathToFileURL(join(skill, file)));
const { selectKnowledge } = await load('shared/knowledge.ts');
selectKnowledge(knowledge);
const { lattice, nodes, validateHeadNineAxis, evaluatePoints } = await load('shared/nine-axis-model.js');
const { editNineAxis } = await load('shared/nine-axis-edit.js');
const { writeBuilt } = await load('nine-axis/head.ts');
const { createNineAxisViewTool } = await load('nine-axis/view-tool.ts');
const { createBitmapTool } = await load('shared/part/bitmap-tool.ts');
const { toolDefinition } = await load('shared/codex/tool-config.ts');
const { textResult } = await load('shared/codex/function-tools.ts');
const { fromTaskPath } = await load('shared/task-paths.ts');
const { checkedTurn, CheckFailure } = await load('shared/codex/checked-turn.ts');
const nine = join(task, 'nine-axis');
const output = join(nine, 'step08_hair');
const author = join(output, 'hair-x.json');
const source = JSON.parse(await readFile(join(nine, 'step07_jaw-line/deformers.json'), 'utf8'));
const originalParts = new Map(source.parts.map(p => [p.id, p]));
const originalWarps = new Map(source.deformers.map(p => [p.id, p]));
const pairs = a => Array.from({ length: a.length / 2 }, (_, i) => [a[i * 2], a[i * 2 + 1]]);
const read = () => readFile(author, 'utf8').then(JSON.parse);
const build = async () => {
  const doc = validateHeadNineAxis(await read());
  return { doc, textures: new Map(doc.parts.map(p => [p.texture, join(output, p.texture)])) };
};
const allowed = id => typeof id === 'string' && (id === 'hair' || id.startsWith('hair/'));
const editable = id => allowed(id) && (scope === 'bangs-left' ? id === 'hair/bangs' || id.startsWith('hair/bangs/')
  : scope === 'side-hair-left' ? id.startsWith('hair/side_hair/')
  : scope === 'back-hair-left' ? id === 'hair/back_hair' || id.startsWith('hair/back_hair/') : true);
let fixedHair = new Map();
function protect(doc) {
  for (const [id, before] of originalParts) {
    if (JSON.stringify(doc.parts.find(p => p.id === id)) !== JSON.stringify(before)) throw new Error('Existing face part changed: ' + id);
  }
  for (const [id, before] of originalWarps) {
    if (JSON.stringify(doc.deformers.find(p => p.id === id)) !== JSON.stringify(before)) throw new Error('Existing face warp changed: ' + id);
  }
  if (JSON.stringify(doc.axisSources) !== JSON.stringify(source.axisSources)) throw new Error('Existing independent axis sources changed.');
  if (nodes(doc).filter(n => allowed(n.id)).some(n => n.mirror || n.parent && !allowed(n.parent))) throw new Error('Hair must keep independent keyforms and hair-only parents.');
  for (const [id, before] of fixedHair) {
    if (JSON.stringify(nodes(doc).find(p => p.id === id)) !== JSON.stringify(before)) throw new Error('Hair outside this turn changed: ' + id);
  }
  if (leftOnly) for (const n of doc.deformers.filter(n => editable(n.id))) {
    if (nodes(doc).some(p => p.parent === n.id && !editable(p.id))) throw new Error('Scoped hair warps may only carry editable nodes.');
  }
  for (const p of doc.parts.filter(p => allowed(p.id))) {
    const rest = lattice(p), actual = evaluatePoints(doc, p, 0, 0);
    if (actual.some((v, i) => Math.abs(v - rest[i]) > 0.001)) throw new Error('Neutral hair form changed: ' + p.id);
    if (leftOnly && editable(p.id) && evaluatePoints(doc, p, 30, 0).some((v, i) => Math.abs(v - rest[i]) > 0.001)) throw new Error('Right hair form changed: ' + p.id);
  }
}
if (!await access(author).then(() => true, () => false)) {
  const manifest = JSON.parse(await readFile(join(nine, 'step01_preparation/head_parts_manifest.json'), 'utf8'));
  const hair = manifest.referenceLayers.filter(p => p.scope === 'hair');
  const doc = structuredClone(source);
  doc.levels.push({ id: 'hair', name: '脸部与头发', includes: ['face', 'hair'] });
  await mkdir(join(output, 'layers'), { recursive: true });
  for (const p of source.parts) await copyFile(join(nine, 'step07_jaw-line', p.texture), join(output, p.texture));
  for (const original of hair) {
    const p = { id: original.id, group: original.group, level: 'hair', texture: 'layers/' + basename(original.texture),
      textureBounds: original.textureBounds, bbox: original.bbox, order: original.order, cols: 6, rows: 6, interpolation: 'smooth' };
    const rest = pairs(lattice(p));
    p.keyforms = Object.fromEntries([-30, 0, 30].map(k => [String(k), structuredClone(rest)]));
    const at = doc.parts.findIndex(q => typeof q.order === 'number' && q.order < p.order);
    doc.parts.splice(at < 0 ? doc.parts.length : at, 0, p);
    await copyFile(join(nine, 'step01_preparation', original.texture), join(output, p.texture));
  }
  validateHeadNineAxis(doc); protect(doc);
  await writeFile(author, JSON.stringify(doc) + '\n');
  await writeBuilt(output, await build());
  console.log('Prepared five neutral hair parts on the existing jaw/face model.');
}
fixedHair = new Map(nodes(await read()).filter(p => allowed(p.id) && !editable(p.id)).map(p => [p.id, p]));
protect(await read());
await writeBuilt(output, await build());
const editDefinition = toolDefinition('edit_nine_axis');
const editSchema = structuredClone(editDefinition.inputSchema);
delete editSchema.properties.revision;
delete editSchema.properties.axis;
delete editSchema.properties.importParts;
editSchema.properties.operations.items.properties.action.enum = ['create_warp', 'reparent', 'remove_warp', 'interpolation', 'points', 'drag', 'transform'];
const edit = { ...editDefinition, inputSchema: editSchema,
  description: leftOnly
    ? (await Promise.all([scopedFile('tools'), join(workspace, 'hair-left-tools.md')].map(file => readFile(file, 'utf8')))).join('\n\n')
    : await readFile(join(task, 'knowledge/nine-axis/step08_hair/tools/edit_nine_axis.md'), 'utf8'),
  async execute(args, signal) {
    const before = await read();
    if (args.operations) for (const op of args.operations) {
      if (op.id && !editable(op.id) || op.targets?.some(id => !editable(id)) || op.parent && !editable(op.parent)) throw new Error('Node is outside the editable scope: ' + scope);
      if (op.level && op.level !== 'hair') throw new Error('New warps must belong to hair.');
      if (op.y) throw new Error('This trial only edits Y=0.');
      if (['points', 'drag', 'transform'].includes(op.action) && !editableXs.includes(op.x)) throw new Error('Editable X values: ' + editableXs.join(', '));
      if (!editSchema.properties.operations.items.properties.action.enum.includes(op.action)) throw new Error('Unsupported action in this trial: ' + op.action);
      if (op.action === 'mirror_pair' || op.part) throw new Error('Symmetry and new artwork are not part of this trial.');
    }
    const doc = args.operations ? editNineAxis(before, args.operations) : before;
    if (args.notes !== undefined) doc.notes = args.notes;
    protect(doc);
    signal.throwIfAborted();
    if (args.operations || args.notes !== undefined) {
      await writeFile(author, JSON.stringify(doc) + '\n');
      await writeBuilt(output, await build());
    }
    return textResult({ source: author, nodes: nodes(doc).filter(n => allowed(n.id)).map(n => ({
      id: n.id, kind: doc.deformers.includes(n) ? 'warp' : 'part', parent: n.parent ?? null,
      bbox: n.bbox, cols: n.cols, rows: n.rows, keys: Object.keys(n.keyforms), interpolation: n.interpolation
    })) });
  }
};
const view = createNineAxisViewTool(output, join(output, 'observations'), build);
const signal = AbortSignal.timeout(45 * 60_000);
if (mode === 'prepare') process.exit(0);
if (mode === 'render') {
  const result = await view.execute({ x: Number(process.argv[6] ?? 0), y: 0, level: 'hair' }, signal);
  console.log(result.contentItems.filter(p => p.type === 'inputText').map(p => p.text).join('\n'));
  process.exit(0);
}
if (mode !== 'run') throw new Error('Unknown mode: ' + mode);
const { CodexAgents } = await load('shared/codex/agents.ts');
const { loadWorkflowEnvironment } = await load('shared/codex/environment.ts');
const { readStepSession, writeStepSession } = await load('shared/agents/step-session.ts');
const environment = loadWorkflowEnvironment(process.env, skill);
const promptPath = process.argv[6] ?? (leftOnly ? scopedFile('task') : join(task, 'knowledge/nine-axis/step08_hair/prompts/左右头发.md'));
const taskPrompt = await readFile(promptPath, 'utf8');
if (!taskPrompt.trim()) throw new Error('The hair trial prompt is empty.');
const prompt = leftOnly ? taskPrompt + '\n\n' + await readFile(join(workspace, 'hair-reference-review.md'), 'utf8') : taskPrompt;
if (leftOnly) await writeFile(join(workspace, 'effective-task.md'), prompt + '\n');
await access(join(output, 'references/left.png'));
const saved = await readStepSession(nine, 'step08_hair') ?? {};
const agents = new CodexAgents({ environment, selectedModel: environment.stepModels.nine_axis_head,
  cwd: nine, logDirectory: join(nine, 'agents'), progress: text => console.log(text) });
const session = agents.createSession(saved.threadId, {
  resumeHarness: saved.harness,
  onSessionStarted: (threadId, harness) => writeStepSession(nine, 'step08_hair', { threadId, harness })
});
await writeFile(join(output, '.running'), '');
await rm(join(output, '.completed'), { force: true });
try {
  const result = await checkedTurn({ agents: { run: (task, abort) => session.run(task, abort) }, signal,
    records: join(output, 'checks'), task: { name: scope === 'side-hair-left' ? 'left侧发逐件制作' : scope === 'bangs-left' ? 'left刘海逐件制作' : scope === 'back-hair-left' ? 'left后发制作' : '头发-left与right独立形变试验', cwd: nine, outputDirectory: output,
      shell: false, imageGeneration: false, prompt, tools: [createBitmapTool(nine, join(output, 'observations')), view, edit],
      outputSchema: { type: 'object', additionalProperties: false, properties: { error: { type: ['string', 'null'] } }, required: ['error'] } },
    check: async response => {
      let result;
      try { result = JSON.parse(response.text); } catch { throw new CheckFailure('bad-result', 'Invalid result JSON.', { detail: response.text }); }
      if (result.error) throw new Error(result.error);
      const { doc } = await build(); protect(doc);
      // A stable back-hair shell is valid; foreground motion changes its exposure.
      const front = doc.parts.filter(p => editable(p.id) && /bangs|side_hair/.test(p.id));
      for (const p of front) for (const x of editableXs) {
        const moved = evaluatePoints(doc, p, x, 0), rest = evaluatePoints(doc, p, 0, 0);
        if (!moved.some((v, i) => Math.abs(v - rest[i]) > 0.1)) throw new CheckFailure('invalid-output', p.id + ' has no authored change at X=' + x, { detail: p.id + ' at X=' + x + ' still uses its neutral shape.' });
      }
      return response;
    } });
  await writeFile(join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  for (const x of leftOnly ? [-30, 0] : [-30, 0, 30]) {
    const rendered = await view.execute({ x, y: 0, level: 'hair' }, signal);
    const info = JSON.parse(rendered.contentItems.find(p => p.type === 'inputText').text);
    await copyFile(fromTaskPath(task, info.savedPath), join(output, x < 0 ? 'left.png' : x > 0 ? 'right.png' : 'neutral.png'));
  }
  await writeFile(join(output, '.completed'), '');
  console.log(leftOnly ? 'Produced the ' + scope + ' trial and neutral render.' : 'Trial produced left, neutral and independently authored right renders.');
} finally {
  await rm(join(output, '.running'), { force: true });
  await session.close();
}
