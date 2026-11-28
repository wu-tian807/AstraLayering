import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { startWorkbench, postTask, imageUpload } from './workbench-server.ts';
import { createSoftwareScan } from '../software-scan.ts';
import { defaultKnowledgeDirectory } from '../../.agents/skills/live2d-maker/shared/knowledge.ts';
import { preflightTaskInputs } from '../../.agents/skills/live2d-maker/workflow/preflight-inputs.ts';
import { preflightKrita } from '../../.agents/skills/live2d-maker/workflow/krita.ts';
import { preflightFFmpeg } from '../../.agents/skills/live2d-maker/workflow/ffmpeg.ts';
import { loadWorkflowEnvironment } from '../../.agents/skills/live2d-maker/shared/codex/environment.ts';

async function bench(t: any, started: any[] = [], scans: { kritaScan?: ReturnType<typeof createSoftwareScan>; ffmpegScan?: ReturnType<typeof createSoftwareScan> } = {}) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'layering-settings-')));
  const dir = join(base, 'runs');
  const kritaCheck = async (path: string) => { if (!path.endsWith('good-krita')) throw new Error('不存在或不可执行'); return { executable: path, version: 'test' }; };
  const ffmpegCheck = async (path: string) => { if (!path.endsWith('good-ffmpeg')) throw new Error('不是 FFmpeg'); return { executable: path, version: 'ffmpeg version test' }; };
  const { server, url } = await startWorkbench(t, { defaultDir: dir, settingsPath: join(base, 'settings.json'), kritaCheck, ffmpegCheck, ...scans,
    preflight: async options => {
      await preflightKrita(options, kritaCheck); await preflightFFmpeg(options, ffmpegCheck);
      await preflightTaskInputs(options, loadWorkflowEnvironment({ video_base_url: 'https://video.example/v1', video_api_key: 'fixture' }));
    }, start: async options => { started.push(options); return 1; } });
  t.after(() => rm(base, { recursive: true, force: true }));
  return { base, dir, url, post: postTask(url, dir), server };
}

test('Studio layer editing follows the saved global Krita path', async t => {
  const b = await bench(t);
  const deploymentPath = process.env.ASTRA_STUDIO_KRITA;
  process.env.ASTRA_STUDIO_KRITA = join(b.base, 'legacy-krita');
  t.after(() => {
    if (deploymentPath === undefined) delete process.env.ASTRA_STUDIO_KRITA;
    else process.env.ASTRA_STUDIO_KRITA = deploymentPath;
  });
  const layers = async () => (await fetch(b.url + '/api/studio/layers')).json();
  assert.deepEqual(await layers(), { available: false, engine: 'Krita' });
  const krita = join(b.base, 'good-krita');
  assert.equal((await b.post('settings', { directory: b.dir, krita })).status, 200);
  assert.deepEqual(await layers(), { available: true, engine: 'Krita' });
  assert.equal((await b.post('settings', { directory: b.dir, krita: '' })).status, 200);
  assert.deepEqual(await layers(), { available: false, engine: 'Krita' });
});

test('both scan APIs use the same controls with separate states and stop on service close', async t => {
  const stops: string[] = [];
  const scanner = (name: string) => {
    let running = false;
    const state = () => ({ running, scanned: 4, current: running ? '/test' : '', found: ['/test/' + name] });
    return { state, start: () => { running = true; return state(); }, stop: () => { running = false; stops.push(name); return state(); } };
  };
  const b = await bench(t, [], { kritaScan: scanner('krita'), ffmpegScan: scanner('ffmpeg') });
  const state = async (name: string) => (await (await fetch(b.url + '/api/' + name + '-scan')).json()) as any;
  assert.equal((await state('ffmpeg')).running, false);
  assert.equal((await b.post('ffmpeg-scan', { action: 'start' })).value.running, true);
  assert.equal((await state('krita')).running, false);
  assert.equal((await b.post('krita-scan', { action: 'start' })).value.running, true);
  assert.equal((await b.post('ffmpeg-scan', { action: 'stop' })).value.running, false);
  assert.equal((await state('krita')).running, true);
  assert.deepEqual((await state('ffmpeg')).found, ['/test/ffmpeg']);
  assert.equal((await b.post('ffmpeg-scan', { action: 'unknown' })).status, 400);
  await new Promise<void>(resolve => b.server.close(() => resolve()));
  assert.deepEqual(stops, ['ffmpeg', 'krita', 'ffmpeg']);
});

test('global FFmpeg supplies new task defaults; starts pass the task path without overwriting it', async t => {
  const started: any[] = [], b = await bench(t, started);
  await b.post('settings', { directory: b.dir, krita: '/opt/good-krita' });
  assert.equal((await b.post('tasks', { name: 'static', upload: await imageUpload() })).status, 201);
  const refused = await b.post('tasks', { name: 'head', from: 'nine-axis', to: 'nine-axis', upload: await imageUpload() });
  assert.equal(refused.status, 409); assert.ok(refused.value.ffmpeg); assert.match(refused.value.error, /全局设置/);
  await assert.rejects(readFile(join(b.dir, 'head', 'run.json')));
  assert.equal((await b.post('settings', { directory: b.dir, ffmpeg: '/opt/bad-ffmpeg' })).status, 400);
  const first = join(b.base, 'one', 'good-ffmpeg'), second = join(b.base, 'two', 'good-ffmpeg');
  assert.equal((await b.post('settings', { directory: b.dir, ffmpeg: first })).value.ffmpeg, first);
  assert.equal((await b.post('settings', { directory: b.dir })).value.ffmpeg, first);
  assert.equal((await b.post('tasks', { name: 'head', from: 'nine-axis', to: 'nine-axis', upload: await imageUpload() })).status, 201);
  assert.equal(JSON.parse(await readFile(join(b.dir, 'head', 'run.json'), 'utf8')).ffmpeg, first);
  assert.equal((await b.post('start', { name: 'head' })).status, 202);
  assert.equal(started[0].ffmpeg, first);
  await b.post('settings', { directory: b.dir, ffmpeg: second });
  assert.equal((await b.post('start', { name: 'head' })).status, 202);
  assert.equal(started[1].ffmpeg, first);
  assert.equal((await b.post('task-options',{name:'head',ffmpeg:second})).status,200);
  assert.equal((await b.post('start',{name:'head'})).status,202);
  assert.equal(started[2].ffmpeg,second);
  assert.equal((await b.post('settings', { directory: b.dir, ffmpeg: '' })).value.ffmpeg, undefined);
});

test('unavailable FFmpeg refuses resume before changing nine-axis markers', async t => {
  const b = await bench(t);
  await b.post('settings', { directory: b.dir, krita: '/opt/good-krita', ffmpeg: '/opt/good-ffmpeg' });
  await b.post('tasks', { name: 'head', from: 'nine-axis', to: 'nine-axis', upload: await imageUpload() });
  await b.post('settings', { directory: b.dir, ffmpeg: '' });
  const record = join(b.dir, 'head', 'run.json'), run = JSON.parse(await readFile(record, 'utf8'));
  run.ffmpeg = '/opt/removed-ffmpeg'; await writeFile(record, JSON.stringify(run));
  const step = join(b.dir, 'head', 'nine-axis', 'step03_frames'); await mkdir(step, { recursive: true });
  await writeFile(join(step, '.running'), 'unchanged');
  const result = await b.post('task-action', { name: 'head', action: 'resume', section: 'nine-axis' });
  assert.equal(result.status, 409); assert.ok(result.value.ffmpeg);
  assert.equal(await readFile(join(step, '.running'), 'utf8'), 'unchanged');
  assert.deepEqual(JSON.parse(await readFile(record, 'utf8')), run);
});

test('没有可用的全局 Krita 时创建任务返回 409 且不建目录；保存设置后新任务记录 Krita 与先验知识目录', async t => {
  const started: any[] = [], b = await bench(t, started);
  const refused = await b.post('tasks', { name: 'case', upload: await imageUpload() });
  assert.equal(refused.status, 409); assert.ok(refused.value.krita); assert.match(refused.value.error, /全局设置/);
  await assert.rejects(readFile(join(b.dir, 'case', 'run.json')));
  assert.equal((await b.post('settings', { directory: b.dir, krita: '/opt/bad-krita' })).status, 400);
  const knowledge = join(b.base, 'knowledge');
  await cp(defaultKnowledgeDirectory, knowledge, { recursive: true });
  const krita = join(b.base, 'good-krita');
  const saved = await b.post('settings', { directory: b.dir, krita, knowledge });
  assert.equal(saved.status, 200); assert.equal(saved.value.krita, krita); assert.equal(saved.value.knowledge, knowledge);
  // An absent key keeps the saved value; an empty one clears it.
  assert.equal((await b.post('settings', { directory: b.dir })).value.krita, krita);
  const created = await b.post('tasks', { name: 'case', upload: await imageUpload() });
  assert.equal(created.status, 201, JSON.stringify(created.value));
  const run = JSON.parse(await readFile(join(b.dir, 'case', 'run.json'), 'utf8'));
  assert.equal(run.krita, krita); assert.equal(run.knowledge, knowledge);
  // The config page now browses the chosen knowledge directory.
  assert.equal((await (await fetch(b.url + '/api/config/files?ref=worktree')).json() as any).directory, knowledge);
  assert.equal((await (await fetch(b.url + '/api/config/versions')).json() as any).git, false);
  assert.equal((await b.post('settings', { directory: b.dir, knowledge: '' })).value.knowledge, undefined);
});

test('路径选择列出服务器目录，文件选择返回父目录并标记所选文件', async t => {
  const b = await bench(t), root = join(b.base, 'tree');
  await mkdir(join(root, 'sub'), { recursive: true }); await writeFile(join(root, 'krita'), '');
  const dirs = await (await fetch(b.url + '/api/fs?' + new URLSearchParams({ path: root, kind: 'dir' }))).json() as any;
  assert.deepEqual(dirs.entries.map((entry: any) => entry.name), ['sub']); assert.equal(dirs.parent, b.base);
  const files = await (await fetch(b.url + '/api/fs?' + new URLSearchParams({ path: join(root, 'krita'), kind: 'file' }))).json() as any;
  assert.equal(files.path, root); assert.equal(files.selected, 'krita');
  assert.deepEqual(files.entries.map((entry: any) => [entry.name, entry.dir]), [['sub', true], ['krita', false]]);
  assert.equal((await fetch(b.url + '/api/fs?path=relative')).status, 400);
});

test('先验知识中的媒体按类型返回并支持 Range，供视频拖动', async t => {
  const b = await bench(t), knowledge = join(b.base, 'knowledge');
  await cp(defaultKnowledgeDirectory, knowledge, { recursive: true });
  await writeFile(join(knowledge, 'shared', 'clip.mp4'), Buffer.from('0123456789'));
  await b.post('settings', { directory: b.dir, knowledge });
  const raw = b.url + '/api/config/raw?ref=worktree&path=shared/clip.mp4';
  const whole = await fetch(raw);
  assert.equal(whole.headers.get('content-type'), 'video/mp4'); assert.match(whole.headers.get('content-security-policy')!, /sandbox/);
  assert.equal(await whole.text(), '0123456789');
  const part = await fetch(raw, { headers: { Range: 'bytes=2-4' } });
  assert.equal(part.status, 206); assert.equal(part.headers.get('content-range'), 'bytes 2-4/10'); assert.equal(await part.text(), '234');
  assert.equal((await fetch(raw, { headers: { Range: 'bytes=20-' } })).status, 416);
  assert.equal((await fetch(b.url + '/api/config/raw?ref=worktree&path=../settings.json')).status, 400);
});
