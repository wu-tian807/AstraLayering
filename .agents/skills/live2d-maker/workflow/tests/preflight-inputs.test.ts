import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { configureRun, saveRun } from '../state.ts';
import { preflightTaskInputs } from '../preflight-inputs.ts';
import { main } from '../run.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { createWorkbench } from '../../../../../web/server.ts';

async function fixture(t: any) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'astra-preflight-'))), task = join(dir, 'case');
  t.after(() => rm(dir, { recursive: true, force: true }));
  const step = join(task, 'part-layering/step13_merge'), output = join(task, 'part-layering/preview.svg');
  await mkdir(step, { recursive: true }); await writeFile(join(step, '.running'), ''); await writeFile(output, 'existing output');
  const options = { name: 'case', dir, from: 'part-layering' as const, to: 'part-layering' as const };
  await saveRun(task, await configureRun(options, task));
  return { dir, task, step, output, options };
}

test('CLI retry refuses invalid knowledge before deleting its existing output', async t => {
  const f = await fixture(t), record = await readFile(join(f.task, 'run.json'));
  await assert.rejects(main(['--name', 'case', '--dir', f.dir, '--retry', '--knowledge', join(f.dir, 'missing')]), Error);
  assert.equal(await readFile(f.output, 'utf8'), 'existing output');
  assert.equal(await readFile(join(f.step, '.running'), 'utf8'), '');
  assert.deepEqual(await readFile(join(f.task, 'run.json')), record);
  await readFile(join(f.task, 'workflow.log'), 'utf8');
});

test('video configuration is required only for a route containing nine-axis', async t => {
  const f = await fixture(t), environment = loadWorkflowEnvironment({});
  await preflightTaskInputs(f.options, environment);
  await assert.rejects(preflightTaskInputs({ ...f.options, to: 'nine-axis' }, environment), Error);
  await preflightTaskInputs({ ...f.options, to: 'nine-axis' }, environment, { video: false });
});

test('web retry uses the saved task knowledge and preserves files when it is unavailable', async t => {
  const f = await fixture(t);
  await saveRun(f.task, await configureRun({ ...f.options, knowledge: join(f.dir, 'missing') }, f.task));
  const server = await createWorkbench({ defaultDir: f.dir, settingsPath: join(f.dir, 'settings.json'),
    preflight: options => preflightTaskInputs(options),
    start: async () => assert.fail('invalid knowledge must refuse before launch') });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const port = (server.address() as { port: number }).port;
  const response = await fetch(`http://127.0.0.1:${port}/api/task-action`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dir: f.dir, name: 'case', action: 'retry' }) });
  const result = await response.json() as { error: string };
  assert.equal(response.status, 400, result.error);
  assert.equal(await readFile(f.output, 'utf8'), 'existing output');
  assert.equal(await readFile(join(f.step, '.running'), 'utf8'), '');
});
