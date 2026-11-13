import { readStepSession } from '../../shared/agents/step-session.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { seedUpstream } from '../../shared/tests/upstream-fixture.ts';
import { sectionDirectory } from '../../shared/paths.ts';
const runDirectory = (name: string) => sectionDirectory(name, 'clothing-raster-layering');
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import type { AgentRequest, StepResult } from '../../shared/raster/agent.ts';
import { resolvePartInput } from '../../shared/raster/input.ts';
import { parseRunArguments } from '../run.ts';

import { steps } from '../steps.ts';
import { runWorkflow } from '../run.ts';

const completed: StepResult = { status: 'completed', summary: 'fixture' };
const preflight = async (executable: string) => ({ executable });
async function fixture(t: TestContext) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'clothing-raster-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runsDirectory = join(directory, 'runs');
  const source = await seedUpstream('test', 'clothing-part-layering', runsDirectory);
  await mkdir(join(source, 'parts'), { recursive: true });
  await mkdir(join(source, 'references'), { recursive: true });
  await writeFile(join(source, 'parts/front.svg'), 'front');
  await writeFile(join(source, 'parts/back.svg'), 'back');
  await writeFile(join(source, 'references/clothing.png'), 'clothing fixture');
  return { source, output: join(runsDirectory, 'test', 'clothing-raster-layering'), options: { name: 'test', krita: process.execPath }, deps: { environment: loadWorkflowEnvironment({}, directory), runsDirectory, preflight } };
}
async function deliver(request: AgentRequest, thread = request.threadId ?? 'drawing-1'): Promise<StepResult> {
  if (request.prompt.startsWith('你负责独立 review 第一步的交付')) {
    assert.equal(request.threadId, undefined);
    assert.equal(request.tools?.[0].name, 'annotate_review_regions');
    await request.onEvent({ type: 'thread.started', thread_id: 'temporary-reviewer' });
    await writeFile(join(request.directory, 'step01/review-01.md.tmp'), '结论：通过\n\n已检查全部衣片。');
  } else {
    await request.onEvent({ type: 'thread.started', thread_id: thread });
    const id = request.prompt.startsWith('在 clothing-raster-layering/step01/') ? 'step02' : 'step01';
    assert.deepEqual(request.tools?.map(tool => tool.name), id === 'step02' ? ['krita'] : ['edit_groups', 'edit_occlusion', 'krita']);
    const step = steps.find(step => step.id === id)!;
    for (const file of step.requiredFiles) await writeFile(join(request.directory, id, 'review' in step && step.review && file === 'report.md' ? 'report.md.tmp' : file), `${id} ${file}`);
  }
  return completed;
}

test('independent run directory, parts path normalization, and external-only provider configuration', async t => {
  const f = await fixture(t);
  assert.equal(runDirectory('test'), fileURLToPath(new URL('../../../../../.run/test/clothing-raster-layering', import.meta.url)));
  assert.equal((await resolvePartInput('test', 'clothing-part-layering', f.deps.runsDirectory)).directory, f.source);
  assert.equal(parseRunArguments(['--name', 'test', '--knowledge', 'knowledge']).name, 'test');
  assert.throws(() => parseRunArguments(['--name', 'test', '--provider-config', 'secret.json']), /Unknown option/);
  const prompt = await runWorkflow({ ...f.options, dryRun: true }, { ...f.deps, agent: async () => assert.fail('dry run must not invoke Codex') });
  assert.ok(prompt.includes('step02/clothing-soft-edges.kra'));
  assert.ok(!prompt.includes('wearing-order.md') && !prompt.includes('character-dressup-base'));
  await assert.rejects(readdir(f.output), { code: 'ENOENT' });
});

test('each drawing stage starts its own thread; review completes before step01 marker; only clothing KRA required', async t => {
  const f = await fixture(t), requests: AgentRequest[] = [];
  await runWorkflow(f.options, { ...f.deps, agent: async request => {
    requests.push(request);
    assert.equal(request.model, 'gpt-6.1-sol');
    assert.equal(request.effort, request.step === 'clothing_raster_step02' ? 'medium' : 'xhigh');
    if (requests.length === 2) assert.equal(request.threadId, undefined);
    if (requests.length === 2) await assert.rejects(readFile(join(f.output, 'step01/.completed')), { code: 'ENOENT' });
    // step01's thread keeps step01's tools; step02 must start a thread with its own.
    if (requests.length === 3) assert.equal(request.threadId, undefined);
    return deliver(request, requests.length === 3 ? 'drawing-step02' : undefined);
  } });
  assert.equal(requests.length, 3);
  assert.equal((await readStepSession(f.output, 'step02'))?.threadId, 'drawing-step02');
  await assert.rejects(readFile(join(f.output, 'run.json')), { code: 'ENOENT' });
  assert.equal((await readStepSession(f.output, 'step01'))?.threadId, 'drawing-1');
  for (const step of steps) { await readFile(join(f.output, step.id, '.completed')); for (const file of step.requiredFiles) await readFile(join(f.output, step.id, file)); }
  await assert.rejects(readdir(join(f.output, 'step03')), { code: 'ENOENT' });
  await runWorkflow(f.options, { ...f.deps, agent: async () => assert.fail('completed run must not invoke Codex') });
});

test('interrupted drawing resumes saved thread and directly reads upstream', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'drawing-resume' });
    await writeFile(join(request.directory, 'step01/partial.png'), 'keep partial work');
    throw new Error('interrupted');
  } }), /interrupted/);
  await readFile(join(f.output, 'step01/.running'));
  await assert.rejects(readdir(join(f.output, 'input')), { code: 'ENOENT' });
  let first = true;
  await runWorkflow(f.options, { ...f.deps, agent: async request => {
    if (first) {
      first = false;
      assert.equal(request.threadId, 'drawing-resume');
      assert.equal(await readFile(join(f.source, 'references/clothing.png'), 'utf8'), 'clothing fixture');
      assert.equal(await readFile(join(f.output, 'step01/partial.png'), 'utf8'), 'keep partial work');
    }
    return deliver(request);
  } });
  // step02 starts its own thread after step01 resumed the saved one.
  assert.equal((await readStepSession(f.output, 'step01'))?.threadId, 'drawing-resume');
  assert.equal((await readStepSession(f.output, 'step02'))?.threadId, 'drawing-1');
});


test('clothing-part-layering occlusion 未完成时拒绝且不动本管线；完成后全部沿用', async t => {
  const f = await fixture(t), occlusion = join(f.source, 'step14_occlusion');
  await mkdir(occlusion);
  await writeFile(join(occlusion, '.completed'), '');
  await runWorkflow(f.options, { ...f.deps, agent: request => deliver(request) });
  await rm(join(occlusion, '.completed'));
  await writeFile(join(occlusion, '.running'), '');
  const before = await readFile(join(f.output, 'step02/.completed'));
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async () => assert.fail('upstream running') }), /上游步骤 clothing-part-layering\/step14_occlusion 尚未完成/);
  assert.deepEqual(await readFile(join(f.output, 'step02/.completed')), before);
  await rm(join(occlusion, '.running'));
  await writeFile(join(occlusion, '.completed'), '');
  await runWorkflow(f.options, { ...f.deps, agent: async () => assert.fail('all kept') });
});
