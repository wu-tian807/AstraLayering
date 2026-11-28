import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { nodeExecutables } from '../../clothing-part-layering/tests/node-executables.ts';
import { tmpdir } from 'node:os';
import { executionPaths, prepareWorkspace, workspacePrompt } from '../agents/workspace.ts';
import { prepareFileInputs, referencesDirectory } from '../agents/inputs.ts';
import { AgentDispatcher } from '../agents/dispatcher.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { textResult } from '../codex/function-tools.ts';
import { publishReportAssets } from '../report-assets.ts';
import { fakeAppServer } from '../../part-layering/tests/fake-app-server.ts';

async function fixture(t: { after(callback: () => Promise<unknown>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'astra-workspaces-'));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}

test('input preparation only materializes requested files in references and leaves upstream/context inputs unchanged', async t => {
  const root = await fixture(t), output = join(root, 'step02'), source = join(root, 'upstream.png');
  const bytes = Buffer.from([0, 1, 2, 255]); await writeFile(source, bytes);
  assert.deepEqual(await prepareFileInputs(output, []), {});
  await assert.rejects(readFile(join(referencesDirectory(output), 'upstream.png')), { code: 'ENOENT' });
  const inputs = await prepareFileInputs(output, [
    { name: 'guide.md', content: 'input guide' }, { name: 'derived/crop.png', content: bytes },
  ]);
  assert.equal(await readFile(inputs['guide.md'], 'utf8'), 'input guide');
  assert.deepEqual(await readFile(inputs['derived/crop.png']), bytes);
  assert.deepEqual(await readFile(source), bytes);
  assert.ok(Object.values(inputs).every(path => path.startsWith(referencesDirectory(output) + sep)));
  await assert.rejects(prepareFileInputs(output, [{ name: '../escape.png', source }]));
  await assert.rejects(prepareFileInputs(output, [{ name: 'same', content: '' }, { name: 'same', content: '' }]));
});

test('native Codex executes and resumes in the step workspace; tools keep their schema and logical path base', async t => {
  nodeExecutables(t);
  const root = await fixture(t), output = join(root, 'step01');
  const server = await fakeAppServer(root, [{ tool: 'probe', arguments: {} }]);
  const paths = await prepareWorkspace({ cwd: root, outputDirectory: output }, root);
  const tool = { name: 'probe', description: 'unchanged', inputSchema: { type: 'object' },
    async execute(_args: unknown, _signal: AbortSignal, context?: typeof paths) {
      assert.deepEqual(context, paths);
      await mkdir(join(context!.workspace, 'arbitrary/01'), { recursive: true });
      await writeFile(join(context!.workspace, 'arbitrary/01/draft.py'), 'intermediate');
      return textResult({ ok: true });
    } };
  const agents = new AgentDispatcher({ environment: loadWorkflowEnvironment({}, root), cwd: root,
    logDirectory: join(root, 'agents'), codexPathOverride: server.executable });
  const task = { name: 'probe', prompt: 'draw', cwd: root, outputDirectory: output, tools: [tool] };
  const session = agents.createSession();
  const first = await session.run(task).finally(() => session.close());
  const resumed = agents.createSession(first.threadId!);
  const second = await resumed.run(task).finally(() => resumed.close());
  assert.equal(second.threadId, first.threadId);
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  for (const call of protocol.filter(item => ['thread/start', 'thread/resume'].includes(item.method))) {
    assert.equal(call.params.cwd, paths.workspace);
    assert.deepEqual(call.params.dynamicTools[0].inputSchema, tool.inputSchema);
  }
  for (const result of [first, second]) {
    const request = JSON.parse(await readFile(join(result.logDirectory!, 'request.json'), 'utf8'));
    // Request records are task-relative.
    assert.equal(request.workspace, 'step01/workspace'); assert.equal(request.outputDirectory, 'step01');
    assert.ok(result.logDirectory!.startsWith(join(root, 'agents/')));
    assert.equal(request.prompt, workspacePrompt('draw', paths));
  }
  assert.equal(await readFile(join(paths.workspace, 'arbitrary/01/draft.py'), 'utf8'), 'intermediate');
  // Unknown work stays in its own directory instead of a guessed step.
  assert.equal(executionPaths({ cwd: root }, root).workspace, join(root, 'workspace'));
  assert.equal(executionPaths({ cwd: root, step: 'part_base_subject' }, root).workspace, join(root, 'step06_base/workspace'));
});

test('report publication preserves bytes and the chosen folder, and leaves unrelated intermediates in workspace', async t => {
  const root = await fixture(t), paths = await prepareWorkspace({ cwd: root, outputDirectory: 'step01' }, root);
  const image = join(paths.workspace, '自由目录/01/evidence.png');
  await mkdir(join(paths.workspace, '自由目录/01'), { recursive: true });
  const bytes = Buffer.from([0, 1, 2, 255]); await writeFile(image, bytes);
  await writeFile(join(paths.workspace, 'unrelated.py'), 'draft');
  const report = join(paths.outputDirectory, 'review-01.md.tmp');
  await writeFile(report, `结论：通过\n\n![证据](<${image}>)\n`);
  await publishReportAssets(report, paths.workspace);
  assert.deepEqual(await readFile(join(paths.outputDirectory, '自由目录/01/evidence.png')), bytes);
  const text = await readFile(report, 'utf8'); assert.ok(!text.includes(paths.workspace));
  assert.match(text, /evidence\.png/);
  assert.equal(await readFile(join(paths.workspace, 'unrelated.py'), 'utf8'), 'draft');
  await assert.rejects(readFile(join(paths.outputDirectory, 'unrelated.py')), { code: 'ENOENT' });
});

test('report publication leaves a cited path that names no file as written', async t => {
  const root = await fixture(t), paths = await prepareWorkspace({ cwd: root, outputDirectory: 'step01' }, root);
  const report = join(paths.outputDirectory, 'review-01.md.tmp');
  const text = `结论：通过\n\n\`${'很长的说明'.repeat(60)}.png\` 与 \`missing/zoom.png\`\n`;
  await writeFile(report, text);
  await publishReportAssets(report, paths.workspace);
  assert.equal(await readFile(report, 'utf8'), text);
});

test('report publication rewrites the link target even when the label repeats it, and skips non-files', async t => {
  const root = await fixture(t), paths = await prepareWorkspace({ cwd: root, outputDirectory: 'step01' }, root);
  await mkdir(join(paths.workspace, 'zoom'), { recursive: true });
  await writeFile(join(paths.workspace, 'zoom/a.png'), 'image');
  await mkdir(join(paths.workspace, 'folder.png'));
  const report = join(paths.outputDirectory, 'review-01.md.tmp');
  await writeFile(report, '结论：通过\n\n[zoom/a.png](workspace/zoom/a.png) [workspace/zoom/a.png](workspace/zoom/a.png) `workspace/folder.png`\n');
  await publishReportAssets(report, paths.workspace);
  assert.equal(await readFile(report, 'utf8'), '结论：通过\n\n[zoom/a.png](zoom/a.png) [workspace/zoom/a.png](zoom/a.png) `workspace/folder.png`\n');
  assert.equal(await readFile(join(paths.outputDirectory, 'zoom/a.png'), 'utf8'), 'image');
});

test('Codex changes tools by reconnecting to the same thread and keeps formal write access', async t => {
  nodeExecutables(t);
  const root = await fixture(t), server = await fakeAppServer(root, [{ tool: 'deliver', arguments: {} }]);
  const agents = new AgentDispatcher({ environment: loadWorkflowEnvironment({}, root), cwd: root,
    logDirectory: join(root, 'agents'), codexPathOverride: server.executable });
  const session = agents.createSession();
  try {
    for (const step of ['step01', 'step02']) {
      const outputDirectory = join(root, step);
      const result = await session.run({ name: step, cwd: root, outputDirectory, prompt: 'deliver',
        tools: [{ name: 'deliver', description: step, inputSchema: { type: 'object' },
          async execute(_args, _signal, context) { await writeFile(join(context!.outputDirectory, 'formal.txt'), step); return textResult('done'); } }] });
      assert.equal(result.threadId, 'native-thread');
      assert.equal(await readFile(join(outputDirectory, 'formal.txt'), 'utf8'), step);
    }
  } finally { await session.close(); }
  const protocol = (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const starts = protocol.filter(call => ['thread/start', 'thread/resume'].includes(call.method));
  assert.deepEqual(starts.map(call => call.method), ['thread/start', 'thread/resume']);
  assert.equal(starts[1].params.threadId, 'native-thread');
  for (const [index, call] of starts.entries()) {
    assert.equal(call.params.cwd, join(root, ['step01', 'step02'][index], 'workspace'));
    assert.equal(call.params.sandbox, 'danger-full-access');
    assert.equal(call.params.config['sandbox_workspace_write.writable_roots'], undefined);
  }
});
