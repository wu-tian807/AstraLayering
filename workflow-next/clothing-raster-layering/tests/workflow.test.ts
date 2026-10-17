import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import type { AgentRequest, StepResult } from '../agent.ts';
import { resolvePartInput } from '../input.ts';
import { parseRunArguments } from '../run.ts';
import { runDirectory } from '../run-store.ts';
import { steps } from '../steps.ts';
import { runWorkflow } from '../workflow.ts';

const completed: StepResult = { status: 'completed', summary: 'fixture' };
const preflight = async (executable: string) => ({ executable, version: 'fixture' });
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'clothing-raster-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, 'source'), runsDirectory = join(directory, 'runs');
  await mkdir(join(source, 'parts'), { recursive: true });
  await mkdir(join(source, 'references'));
  await writeFile(join(source, 'parts/front.svg'), 'front');
  await writeFile(join(source, 'parts/back.svg'), 'back');
  await writeFile(join(source, 'references/clothing.png'), 'clothing fixture');
  await writeFile(join(source, 'groups.json'), '{"groups":[]}');
  return { source, output: join(runsDirectory, 'test'), options: { name: 'test', input: source, krita: process.execPath }, deps: { runsDirectory, preflight } };
}
async function deliver(request: AgentRequest, thread = request.threadId ?? 'drawing-1'): Promise<StepResult> {
  if (request.prompt.startsWith('你负责对第二步交付')) {
    assert.equal(request.threadId, undefined);
    await request.onEvent({ type: 'thread.started', thread_id: 'temporary-reviewer' });
    await writeFile(join(request.directory, 'step02/review-01.md.tmp'), '结论：通过\n\n已检查全部衣片。');
  } else {
    await request.onEvent({ type: 'thread.started', thread_id: thread });
    const id = request.prompt.startsWith('在 step01/') ? 'step02' : 'step01';
    const step = steps.find(step => step.id === id)!;
    for (const file of step.requiredFiles) await writeFile(join(request.directory, id, id === 'step02' && file === 'report.md' ? 'report.md.tmp' : file), `${id} ${file}`);
  }
  return completed;
}

test('independent run directory, parts path normalization, and external-only provider configuration', async t => {
  const f = await fixture(t);
  assert.equal(runDirectory('test'), fileURLToPath(new URL('../.run/test', import.meta.url)));
  assert.deepEqual(await resolvePartInput(f.source), await resolvePartInput(join(f.source, 'parts')));
  assert.equal(parseRunArguments(['--name', 'test']).name, 'test');
  assert.throws(() => parseRunArguments(['--name', 'test', '--provider-config', 'secret.json']), /Unknown option/);
  const prompt = await runWorkflow({ ...f.options, dryRun: true }, { ...f.deps, agent: async () => assert.fail('dry run must not invoke Codex') });
  assert.ok(prompt.includes('Codex 内置的 image_generation'));
  assert.ok(prompt.includes('step02/clothing-soft-edges.kra'));
  assert.ok(!prompt.includes('wearing-order.md') && !prompt.includes('character-dressup-base'));
  await assert.rejects(readdir(f.output), { code: 'ENOENT' });
});

test('two drawing stages share context; review completes before step02 marker; only clothing KRA required', async t => {
  const f = await fixture(t), requests: AgentRequest[] = [];
  await runWorkflow(f.options, { ...f.deps, agent: async request => {
    requests.push(request);
    assert.equal(request.model, 'gpt-6-astra');
    assert.equal(request.effort, 'xhigh');
    if (requests.length === 2) assert.equal(request.threadId, 'drawing-1');
    if (requests.length === 3) await assert.rejects(readFile(join(f.output, 'step02/.completed')), { code: 'ENOENT' });
    return deliver(request);
  } });
  assert.equal(requests.length, 3);
  const config = JSON.parse(await readFile(join(f.output, 'run.json'), 'utf8'));
  assert.equal(config.threadId, 'drawing-1');
  assert.deepEqual(Object.keys(config.models), ['step01', 'step02']);
  for (const step of steps) { await readFile(join(f.output, step.id, '.completed')); for (const file of step.requiredFiles) await readFile(join(f.output, step.id, file)); }
  await assert.rejects(readdir(join(f.output, 'step03')), { code: 'ENOENT' });
  await runWorkflow({ name: 'test' }, { ...f.deps, agent: async () => assert.fail('completed run must not invoke Codex') });
});

test('interrupted drawing resumes saved thread and input after source deletion', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'drawing-resume' });
    await writeFile(join(request.directory, 'step01/partial.png'), 'keep partial work');
    throw new Error('interrupted');
  } }), /interrupted/);
  await readFile(join(f.output, 'step01/.running'));
  await rm(f.source, { recursive: true });
  let first = true;
  await runWorkflow({ name: 'test' }, { ...f.deps, agent: async request => {
    if (first) {
      first = false;
      assert.equal(request.threadId, 'drawing-resume');
      assert.equal(await readFile(join(f.output, 'input/references/clothing.png'), 'utf8'), 'clothing fixture');
      assert.equal(await readFile(join(f.output, 'step01/partial.png'), 'utf8'), 'keep partial work');
    }
    return deliver(request);
  } });
  assert.equal(JSON.parse(await readFile(join(f.output, 'run.json'), 'utf8')).threadId, 'drawing-resume');
});

test('deleting step02 completion resets its directory and context, preserving step01 and saved input', async t => {
  const f = await fixture(t);
  await runWorkflow(f.options, { ...f.deps, agent: request => deliver(request) });
  const first = await readFile(join(f.output, 'step01/events.jsonl'));
  await writeFile(join(f.output, 'step02/old.png'), 'old');
  await rm(join(f.output, 'step02/.completed'));
  let calls = 0;
  await runWorkflow({ name: 'test' }, { ...f.deps, agent: async request => {
    calls++;
    if (calls === 1) {
      assert.ok(request.prompt.startsWith('在 step01/'));
      assert.equal(request.threadId, undefined);
      await assert.rejects(readFile(join(f.output, 'step02/old.png')), { code: 'ENOENT' });
    }
    return deliver(request, 'drawing-new');
  } });
  assert.equal(calls, 2);
  assert.equal(JSON.parse(await readFile(join(f.output, 'run.json'), 'utf8')).threadId, 'drawing-new');
  assert.deepEqual(await readFile(join(f.output, 'step01/events.jsonl')), first);
  await readFile(join(f.output, 'input/parts/front.svg'));
});
