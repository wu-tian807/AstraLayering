import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendFile, mkdir, mkdtemp, realpath, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createWorkbench } from '../server.ts';
import { preflightKrita } from '../../.agents/skills/live2d-maker/workflow/krita.ts';
import { snapshot } from '../snapshot.ts';
import { launch, runWebTask } from '../worker.ts';
import { atomicJSON, jsonFile } from '../files.ts';
import { acquireTaskLock, configureRun, saveRun, readRun } from '../../.agents/skills/live2d-maker/workflow/state.ts';
import { runTask } from '../../.agents/skills/live2d-maker/workflow/runner.ts';
import { stopRequestPath } from '../../.agents/skills/live2d-maker/workflow/control.ts';

type WorkbenchOptions = NonNullable<Parameters<typeof createWorkbench>[0]>;
async function fixture(t: any, start?: WorkbenchOptions['start'], preflight: WorkbenchOptions['preflight'] = async () => {}) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'layering-web-')));
  const dir = join(base, 'runs'), settingsPath = join(base, 'settings.json');
  const server = await createWorkbench({ defaultDir: dir, settingsPath, start, preflight });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(base, { recursive: true, force: true }); });
  const port = (server.address() as any).port, url = 'http://127.0.0.1:' + port;
  const post = async (path: string, data: any, headers: any = {}) => {
    const response = await fetch(url + '/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ dir, ...data }) });
    return { status: response.status, value: await response.json() as any };
  };
  return { base, dir, server, url, post, settingsPath };
}
const upload = async () => (await sharp({ create: { width: 8, height: 8, channels: 3, background: '#cbbbaa' } }).png().toBuffer()).toString('base64');
async function put(root: string, path: string, value = 'content') { const file = join(root, path); await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, value); }

test('workspace text artifacts can be viewed and shared path/report modules load in the browser', async t => {
  const f = await fixture(t), path = 'character-assembly/step01/workspace/scripts/check.py';
  await put(join(f.dir, 'test'), path, 'print("draft")');
  const response = await fetch(f.url + '/artifact?' + new URLSearchParams({ name: 'test', dir: f.dir, path }));
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type')!, /text\/plain/);
  assert.equal(await response.text(), 'print("draft")');
  for (const module of ['step-paths.js', 'report-links.js']) assert.equal((await fetch(f.url + '/' + module)).status, 200);
});

test('页面与状态查询读取同一份最新日志，不被旧 run.json 摘要遮盖', async t => {
  const f = await fixture(t), task = join(f.dir, 'test');
  await mkdir(task);
  const run = await configureRun({ name: 'test', dir: f.dir }, task);
  await saveRun(task, run);
  await put(task, 'workflow.log', '[2026-10-20T14:40:00.000Z] [review-hair] 旧消息\n');
  // A stray service.log from an old background worker is not read.
  await put(task, 'service.log', '[返修-hair] 工具调用：write_outline_svg\n');
  let value = await snapshot(task, 'test', f.dir);
  assert.equal(value.lastLogMessage, '[review-hair] 旧消息');
  assert.equal(value.logPath, join(task, 'workflow.log'));
  await appendFile(join(task, 'workflow.log'), '[2026-10-20T16:00:00.000Z] [返修-hair] 自检完成\n'
    + '[2026-10-20T16:00:01.000Z] [返修-hair] 收到 skills/changed：{}\n'
    + '[2026-10-20T16:00:02.000Z] [返修-hair] 思考摘要：\n'
    + '[2026-10-20T16:00:03.000Z] [返修-hair] 完成：{\n}\n');
  value = await snapshot(task, 'test', f.dir);
  assert.equal(value.logPath, join(task, 'workflow.log'));
  assert.equal(value.lastLogMessage, '[返修-hair] 自检完成');
  assert.ok(value.logUpdatedAt);
  const cli = await import('../../.agents/skills/live2d-maker/workflow/state.ts');
  const status = await cli.taskStatus({ name: 'test', dir: f.dir });
  assert.equal(status.lastMessage, value.lastLogMessage);
  assert.equal(status.log, value.logPath);
});

test('网页后台启动同样只使用 workflow.log，失败时等待日志完成写入', async t => {
  const f = await fixture(t);
  // A missing executable fails the Krita check whatever the host's display setup.
  await assert.rejects(launch({ name: 'test', dir: f.dir, krita: join(f.dir, 'missing-krita'),
    from: 'raster-layering', to: 'raster-layering' }), /Krita|krita/);
  assert.match(await readFile(join(f.dir, 'test/workflow.log'), 'utf8'), /Krita|krita/);
  assert.equal(await readFile(join(f.dir, 'test/service.log')).then(() => true, () => false), false);
});

test('upload retains original/config; same name never overwrites; selection persists; stale tabs cannot start in another root', async t => {
  const f = await fixture(t);
  const bytes = await upload();
  assert.equal((await f.post('tasks', { name: '角色-01', upload: bytes, from: 'part-layering', to: 'part-layering', standard: true })).status, 201);
  const task = join(f.dir, '角色-01');
  assert.equal((await readFile(join(task, 'input/original.png'))).toString('base64'), bytes);
  assert.equal((await readRun(task))?.standard, true);
  assert.equal((await f.post('tasks', { name: '角色-01', upload: bytes })).status, 400);
  assert.equal((await f.post('tasks', { name: 'bad', upload: Buffer.from('not an image').toString('base64') })).status, 400);
  assert.equal((await f.post('tasks', { name: '../escape', upload: bytes })).status, 400);
  assert.equal((await f.post('start', { name: '角色-01' }, { Origin: 'https://unrelated.example' })).status, 403);
  const next = join(f.base, 'next');
  const saved = await f.post('settings', { directory: next });
  assert.equal(saved.status, 200); assert.match(saved.value.defaults.knowledge, /knowledge\/?$/);
  assert.equal((await f.post('settings', { dir: next, directory: next, knowledge: 'relative' })).status, 400);
  assert.equal((await f.post('settings', { dir: next, directory: next, knowledge: join(f.base, 'missing') })).status, 400);
  assert.equal((await f.post('settings', { dir: next, directory: next, krita: 'relative/krita' })).status, 400);
  assert.equal((await f.post('start', { name: '角色-01' })).status, 409);
  const restart = await createWorkbench({ defaultDir: f.dir, settingsPath: f.settingsPath });
  await new Promise<void>(resolve => restart.listen(0, '127.0.0.1', resolve));
  assert.equal((await (await fetch('http://127.0.0.1:' + (restart.address() as any).port + '/api/settings')).json() as any).directory, next);
  await new Promise<void>(resolve => restart.close(() => resolve()));
});
test('web forwards shadow mode to the existing coordinator and shows artifacts of both modes', async t => {
  let received: any;
  const f = await fixture(t, async options => { received = options; return 123; });
  assert.equal((await f.post('tasks', { name: 'shadow-case', upload: await upload(), shadowMode: 'mask' })).status, 201);
  assert.equal((await f.post('start', { name: 'shadow-case', from: 'shadow', to: 'shadow', shadowMode: 'normal-depth' })).status, 202);
  assert.equal(received.shadowMode, 'normal-depth'); assert.equal(received.from, 'shadow');
  assert.equal((await f.post('start', { name: 'shadow-case', shadowMode: '../mask' })).status, 400);
  const root = join(f.dir, 'shadow-case');
  await put(root, 'shadow/step01_mask/character-shadowed.png');
  assert.equal((await snapshot(root, 'shadow-case', f.dir)).sections.find(stage => stage.id === 'shadow')!.states.mask, 'pending', 'an unmarked step is a leftover');
  await put(root, 'shadow/step01_mask/.running');
  const value = await snapshot(root, 'shadow-case', f.dir), stage = value.sections.find(stage => stage.id === 'shadow')!;
  assert.equal(stage.states.mask, 'interrupted'); assert.equal(stage.states['normal-depth'], 'pending');
  for (const path of ['normal.png', 'depth.png', 'report.md', '.completed']) await put(root, 'shadow/step01_normal-depth/' + path);
  const finished = (await snapshot(root, 'shadow-case', f.dir)).sections.find(stage => stage.id === 'shadow')!;
  assert.equal(finished.states['normal-depth'], 'done');
  assert.equal(Object.hasOwn(finished.states, 'normal-depth-lighting'), false);
});

test('task assets reject traversal and symlinks; SVG is served sandboxed; version browsing remains read only', async t => {
  const f = await fixture(t);
  await f.post('tasks', { name: 'test', upload: await upload() });
  await put(f.dir, 'test/out.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await put(f.base, 'private/private.json', '{"private":true}');
  await symlink(join(f.base, 'private'), join(f.dir, 'test/leak'), process.platform === 'win32' ? 'junction' : 'dir');
  const artifact = (path: string) => f.url + '/artifact?' + new URLSearchParams({ name: 'test', dir: f.dir, path });
  assert.equal((await fetch(artifact('../private.json'))).status, 400);
  assert.equal((await fetch(artifact('leak/private.json'))).status, 400);
  // Agent records stay server-side; a legacy request workspace is process output.
  await put(f.dir, 'test/part-layering/agents/draw/auth-settings.json', '{"env":{"ANTHROPIC_API_KEY":"secret"}}');
  await put(f.dir, 'test/part-layering/agents/draw/request.json', '{}');
  await put(f.dir, 'test/part-layering/agents/draw/workspace/draft.png');
  await put(f.dir, 'test/part-layering/step09_outline/body/workspace/agents/note.txt');
  assert.equal((await fetch(artifact('part-layering/agents/draw/auth-settings.json'))).status, 400);
  assert.equal((await fetch(artifact('part-layering/agents/draw/request.json'))).status, 400);
  assert.equal((await fetch(artifact('part-layering/agents/draw/workspace/draft.png'))).status, 200);
  assert.equal((await fetch(artifact('part-layering/step09_outline/body/workspace/agents/note.txt'))).status, 200);
  const listed = (await snapshot(join(f.dir, 'test'), 'test', f.dir)).files;
  assert.ok(!listed.some(path => /agents\/draw\/(auth-settings|request)\.json$/.test(path)));
  assert.ok(listed.includes('part-layering/agents/draw/workspace/draft.png'));
  const svg = await fetch(artifact('out.svg'));
  assert.equal(svg.status, 200); assert.match(svg.headers.get('content-security-policy')!, /sandbox/);
  // The config page lists the knowledge directory, relative to it, in the worktree and at a commit.
  const prompt = 'part-layering/step14_occlusion/prompts/11-遮挡层级规划.md';
  const files = await (await fetch(f.url + '/api/config/files?ref=HEAD')).json() as any;
  assert.ok(files.paths.includes(prompt));
  const localFiles = await (await fetch(f.url + '/api/config/files?ref=worktree')).json() as any;
  assert.ok(localFiles.paths.includes(prompt)); assert.match(localFiles.directory, /knowledge\/?$/);
  const content = await fetch(f.url + '/api/config/content?' + new URLSearchParams({ ref: 'worktree', path: prompt }));
  assert.equal(content.status, 200); assert.ok((await content.json() as any).text.length > 0);
  assert.equal((await fetch(f.url + '/api/config/content?ref=HEAD&path=../../.env')).status, 400);
  // Tool schemas are code: a description in knowledge finds its schema beside the code.
  const description = localFiles.paths.find((path: string) => /^shared\/tools\/[^/]+\/description\.md$/.test(path));
  const schema = await (await fetch(f.url + '/api/config/schema?path=' + encodeURIComponent(description))).json() as any;
  assert.doesNotThrow(() => JSON.parse(schema.text));
});

test('snapshots distinguish artifacts, real group states, missing outputs, review pass, two repairs and dead runners', async t => {
  const f = await fixture(t), task = join(f.dir, 'test');
  await mkdir(task);
  await put(task, 'part-layering/groups.json', JSON.stringify({ groups: [{ id: 'body', groups: [] }] }));
  await put(task, 'part-layering/step09_outline/body/outline.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await put(task, 'part-layering/preview.svg');
  let value = await snapshot(task, 'test', f.dir);
  assert.equal(value.sections[0].states.merge, 'pending', 'a merge output without its step marker is a leftover');
  await put(task, 'part-layering/step09_outline/body/.completed');
  await put(task, 'part-layering/step13_merge/.running');
  value = await snapshot(task, 'test', f.dir);
  assert.equal(value.status, 'untracked');
  assert.equal(value.sections[0].states.standard, 'pending');
  assert.equal(value.sections[0].states.merge, 'available');
  assert.equal(value.sections[0].groups[0].webPhases.outline, 'done');
  assert.equal(value.sections[0].groups[0].webPhases.review, 'pending');
  const prefix = 'clothing-raster-layering/step01/';
  for (const path of ['.completed', 'clothing-depth.kra', 'report.md']) await put(task, prefix + path);
  await put(task, prefix + 'review-01.md', '结论：通过\n逐层核对完毕。');
  value = await snapshot(task, 'test', f.dir);
  assert.equal(value.sections[3].states.step01, 'done');
  assert.equal(value.sections[3].states['review-02'], 'skipped');
  await rm(join(task, prefix, 'clothing-depth.kra'));
  value = await snapshot(task, 'test', f.dir);
  assert.equal(value.sections[3].states.step01, 'failed');
  assert.match(value.sections[3].messages.step01, /缺少交付/);
  await put(task, prefix + 'clothing-depth.kra');
  await put(task, prefix + 'review-01.md', '结论：需要修复\n修复轮廓。');
  value = await snapshot(task, 'test', f.dir);
  assert.equal(value.sections[3].states.step01, 'failed');
  for (const phase of ['01', '02']) {
    await put(task, prefix + 'review-' + phase + '.md', '结论：需要修复\n修复轮廓。');
    await put(task, prefix + 'repair-' + phase + '.md', '结论：已修复\n完成逐层检查。');
  }
  value = await snapshot(task, 'test', f.dir);
  assert.equal(value.sections[3].states.step01, 'done');
  // An unmarked step directory is a leftover the next run deletes and redoes.
  await put(task, 'clothing-raster-layering/step02/clothing-depth.kra');
  value = await snapshot(task, 'test', f.dir);
  assert.equal(value.sections[3].states.step02, 'pending');
  assert.match(value.sections[3].messages.step02, /残留目录/);
  await rm(join(task, 'clothing-raster-layering/step02'), { recursive: true });
  const run = await configureRun({ name: 'test', dir: f.dir, from: 'clothing-raster-layering', to: 'clothing-raster-layering' }, task);
  run.status = 'running'; run.runner = { id: 'dead', pid: 2147483647, startedAt: new Date().toISOString() };
  await saveRun(task, run);
  assert.equal((await snapshot(task, 'test', f.dir)).status, 'interrupted');
  await put(task, 'part-layering/groups.json', '{broken');
  assert.match((await snapshot(task, 'test', f.dir)).errors.join(), /groups.json/);
});

test('real coordinator owns web execution: locking, failure diagnostics, resume, cancellation, thread preservation', async t => {
  const f = await fixture(t), task = join(f.dir, 'test');
  await f.post('tasks', { name: 'test', upload: await upload(), from: 'part-layering', to: 'part-layering' });
  await put(task, 'raster-layering/agents/steps/step01/session.json', JSON.stringify({ threadId: 'keep-me' }));
  const options = { name: 'test', dir: f.dir, from: 'part-layering', to: 'part-layering' } as const;
  await assert.rejects(runWebTask(options, { execute: async (_id, _run, context) => {
    context.progress('模型最后消息：没有 image_generation 工具'); throw new Error('未交付结果');
  } }), /未交付/);
  let run = await readRun(task); assert.equal(run?.status, 'failed');
  assert.match(await readFile(join(task, 'workflow.log'), 'utf8'), /没有 image_generation/);
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const executing = runWebTask(options, { ready: started, execute: async (_id, _run, context) => {
    await new Promise<void>((_resolve, reject) => context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true }));
    throw new Error('unreachable');
  } });
  // Attach rejection handler before signalling cancellation.
  const cancelled = assert.rejects(executing, /停止/);
  await ready;
  await assert.rejects(acquireTaskLock(task), /不能重复启动/);
  assert.equal((await snapshot(task, 'test', f.dir)).canStop, true);
  assert.equal((await f.post('stop', { name: 'test' })).status, 200);
  await cancelled;
  assert.equal((await readRun(task))?.status, 'interrupted');
  await runWebTask(options, { execute: async () => ({ output: join(task, 'parts'), summary: '完成' }) });
  run = await readRun(task); assert.equal(run?.status, 'completed');
  assert.equal((await jsonFile(task, 'raster-layering/agents/steps/step01/session.json'))?.threadId, 'keep-me');
});

test('终端总调度没有 web worker 记录仍可在网页停止；旧请求不停止新会话，产物保留且可续跑', async t => {
  const f = await fixture(t), task = join(f.dir, 'test');
  await f.post('tasks', { name: 'test', upload: await upload(), from: 'part-layering', to: 'part-layering' });
  await put(task, 'raster-layering/agents/steps/step01/session.json', JSON.stringify({ threadId: 'keep-cli-thread' }));
  await atomicJSON(stopRequestPath(task), { runnerId: 'previous-runner' });
  const ready = Promise.withResolvers<void>(), entered = Promise.withResolvers<AbortSignal>();
  const options = { name: 'test', dir: f.dir, from: 'part-layering', to: 'part-layering' } as const;
  const executing = runTask(options, { ready: () => ready.resolve(), execute: async (_id, _run, context) => {
    await put(task, 'part-layering/parts/face.draft.svg', 'saved draft');
    entered.resolve(context.signal);
    await new Promise<void>((_resolve, reject) => context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true }));
    throw new Error('unreachable');
  } });
  const cancelled = assert.rejects(executing, /停止/);
  await ready.promise;
  const signal = await entered.promise;
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(signal.aborted, false, 'a stop request must match this runner, not its predecessor');
  assert.equal((await snapshot(task, 'test', f.dir)).canStop, true);
  assert.equal((await f.post('stop', { name: 'test' })).status, 200);
  await cancelled;
  assert.equal((await readRun(task))?.status, 'interrupted');
  assert.equal((await snapshot(task, 'test', f.dir)).canStop, false);
  assert.equal(await jsonFile(task, '.stop-request.json'), undefined);
  assert.equal(await readFile(join(task, 'part-layering/parts/face.draft.svg'), 'utf8'), 'saved draft');
  assert.equal((await jsonFile(task, 'raster-layering/agents/steps/step01/session.json'))?.threadId, 'keep-cli-thread');
  assert.equal((await f.post('stop', { name: 'test' })).status, 400);
  await runTask(options, { execute: async () => ({ summary: '续跑完成' }) });
  assert.equal((await readRun(task))?.status, 'completed');
});

test('shadow reference routes serve only bundled guides, and inspection previews use declared files', async t => {
  const f=await fixture(t);
  for(const name of ['skirt','hair']) {
    const response=await fetch(f.url+'/shadow-reference/'+name+'.png');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
    const meta=await sharp(Buffer.from(await response.arrayBuffer())).metadata();assert.equal(meta.width,2048);assert.equal(meta.height,1280);
  }
  assert.equal((await fetch(f.url+'/shadow-reference/native_worker.py')).status,404);
  const {shadowInspectionArtifacts}=await import(new URL('../progress.js',import.meta.url).href);
  const path='shadow/step01_mask/inspection/relation-001-review.png';
  assert.deepEqual(shadowInspectionArtifacts([path,'shadow/step01_mask/inspection/native-123/offset.png','shadow/step01_normal-depth/inspection/relation-000-review.png']).map((a:any)=>a.path),[path]);
});

test('开始、继续、恢复、重试先检查 Krita：不可用则 409 且不改动步骤，填写新路径后按同一操作运行', async t => {
  const started: any[] = [];
  const check = async (path: string) => { if (!path.endsWith('good-krita')) throw new Error('不存在或不可执行'); return { executable: path, version: 'test' }; };
  const f = await fixture(t, async options => { started.push(options); return 456; }, options => preflightKrita(options, check)), task = join(f.dir, 'case');
  await mkdir(task);
  await saveRun(task, await configureRun({ name: 'case', dir: f.dir, krita: '/opt/old-krita' }, task));
  await put(task, 'part-layering/step11_completion/head/.running', JSON.stringify({ inputs: {} }));
  await put(task, 'part-layering/agents/steps/step11_completion/head/session.json', JSON.stringify({ threadId: 'thread-1' }));
  for (const [path, value] of [['start', {}], ['task-action', { action: 'retry' }], ['task-action', { action: 'resume' }]] as const) {
    const refused = await f.post(path, { name: 'case', ...value });
    assert.equal(refused.status, 409, path); assert.deepEqual(refused.value.krita, { path: '/opt/old-krita' });
    assert.match(refused.value.error, /记录的 Krita 不可用：\/opt\/old-krita[\s\S]*全局设置/);
  }
  assert.equal(started.length, 0);
  assert.equal(JSON.parse(await readFile(join(task, 'part-layering/agents/steps/step11_completion/head/session.json'), 'utf8')).threadId, 'thread-1');
  const resumed = await f.post('task-action', { name: 'case', action: 'resume', krita: '/opt/good-krita' });
  assert.equal(resumed.status, 202); assert.match(resumed.value.message, /thread-1/);
  assert.equal(started.length, 1); assert.equal(started[0].krita, '/opt/good-krita');
});

test('任务操作接口：恢复、重试人物与衣服分块的未完成步骤后按保存的路线重新运行，快照列出未完成步骤', async t => {
  const started: any[] = [];
  const f = await fixture(t, async options => { started.push(options); return 456; }), task = join(f.dir, 'case');
  await mkdir(task);
  await saveRun(task, await configureRun({ name: 'case', dir: f.dir }, task));
  for (const section of ['part-layering', 'clothing-part-layering']) {
    await put(task, `${section}/step11_completion/head/.running`, JSON.stringify({ inputs: {} }));
    await put(task, `${section}/agents/steps/step11_completion/head/session.json`, JSON.stringify({ threadId: 'thread-' + section }));
  }
  const sections = (await snapshot(task, 'case', f.dir)).sections;
  for (const id of ['part-layering', 'clothing-part-layering']) {
    assert.deepEqual(sections.find(section => section.id === id)!.steps, [{ id: 'step11_completion/head', status: 'running', session: true }]);
  }
  const resumed = await f.post('task-action', { name: 'case', action: 'resume' });
  assert.equal(resumed.status, 202); assert.equal(resumed.value.pid, 456);
  assert.match(resumed.value.message, /thread-part-layering/); assert.match(resumed.value.message, /thread-clothing-part-layering/);
  for (const section of ['part-layering', 'clothing-part-layering']) {
    await assert.rejects(readFile(join(task, `${section}/agents/steps/step11_completion/head/session.json`)), { code: 'ENOENT' });
  }
  const retried = await f.post('task-action', { name: 'case', action: 'retry' });
  assert.equal(retried.status, 202);
  for (const section of ['part-layering', 'clothing-part-layering']) {
    await assert.rejects(readFile(join(task, `${section}/step11_completion/head/.running`)), { code: 'ENOENT' });
  }
  assert.equal(started.length, 2); assert.equal(started[0].name, 'case'); assert.equal(started[0].from, undefined);
  const refused = await f.post('task-action', { name: 'case', action: 'retry' });
  assert.equal(refused.status >= 400, true); assert.match(refused.value.error, /没有中断或失败的步骤/);
  assert.equal(started.length, 2);
  // The removed single-step endpoint is gone; one step is acted on from the CLI.
  assert.equal((await f.post('step-action', { name: 'case', section: 'part-layering', step: 'step11_completion/head', action: 'retry' })).status, 404);
});

test('existing task-action accepts the nine-axis section ID and keeps another lane untouched', async t => {
  const started: any[] = [];
  const f = await fixture(t, async options => { started.push(options); return 456; }), task = join(f.dir, 'case');
  await mkdir(task);
  await saveRun(task, await configureRun({ name: 'case', dir: f.dir }, task));
  await put(task, 'nine-axis/step02_angles/.running', '');
  await put(task, 'nine-axis/step02_angles/up/.running', '');
  await put(task, 'nine-axis/step02_angles/up/deformers.json', 'up author');
  await put(task, 'nine-axis/agents/steps/step02_angles/up/session.json', JSON.stringify({ threadId: 'up-thread' }));
  await put(task, 'part-layering/step11_completion/head/.running', '');
  await put(task, 'part-layering/agents/steps/step11_completion/head/session.json', JSON.stringify({ threadId: 'part-thread' }));
  const response = await f.post('task-action', { name: 'case', action: 'resume', section: 'nine-axis' });
  assert.equal(response.status, 202);
  assert.equal(started[0].from, 'nine-axis'); assert.equal(started[0].to, 'nine-axis');
  assert.equal(await readFile(join(task, 'nine-axis/step02_angles/up/deformers.json'), 'utf8'), 'up author');
  assert.equal((await jsonFile(task, 'part-layering/agents/steps/step11_completion/head/session.json'))!.threadId, 'part-thread');
  assert.equal(await jsonFile(task, 'nine-axis/agents/steps/step02_angles/up/session.json'), undefined);
  const wrongSection = await f.post('task-action', { name: 'case', action: 'retry', section: '6' });
  assert.equal(wrongSection.status, 400); assert.match(wrongSection.value.error, /未知管线/);
  const wrongScope = await f.post('task-action', { name: 'case', action: 'retry', section: 'nine-axis', step: 'step02_angles/up' });
  assert.equal(wrongScope.status, 400); assert.match(wrongScope.value.error, /单步骤操作请使用 CLI/);
  assert.equal(started.length, 1);
});

test('web creation records opt-in live and start forwards it without extending explicit single-section ranges', async t => {
  const starts: any[] = [], f = await fixture(t, async options => { starts.push(options); return 456; });
  for (const live of [false, true]) {
    const name = live ? 'live-on' : 'live-off';
    assert.equal((await f.post('tasks', { name, upload: await upload(), live })).status, 201);
    const run = await readRun(join(f.dir, name));
    assert.equal(run?.live, live); assert.equal(run?.to, live ? 'nine-axis' : 'shadow');
    assert.equal((await f.post('start', { name, live })).status, 202);
    assert.equal(starts.at(-1).live, live);
  }
  assert.equal((await f.post('start', { name: 'live-on', live: 'true' })).status, 400);
  assert.equal((await f.post('start', { name: 'live-on', from: 'shadow', to: 'shadow', live: true })).status, 202);
  assert.equal(starts.at(-1).to, 'shadow');
});
