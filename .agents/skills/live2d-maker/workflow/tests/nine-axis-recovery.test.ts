import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { test, type TestContext } from 'node:test';
import { readStep } from '../../shared/step-chain.ts';
import { sessionPath } from '../../shared/agents/step-session.ts';
import { missingDeliveries, stepDeliveries } from '../../shared/step-deliveries.ts';
import { nineAxisGroups, nineAxisGroupSteps, nineAxisSteps, nineAxisBranchSteps } from '../../shared/nine-axis.ts';
import { applyStepAction, applyTaskAction, listSteps, validStepId } from '../step-actions.ts';

async function put(path: string, text = path) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}
async function snapshot(directory: string) {
  const files: Record<string, string> = {};
  for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);
      files[relative(directory, path)] = (await readFile(path)).toString('base64');
    }
  }
  return files;
}
const absent = (path: string) => assert.rejects(readFile(path), { code: 'ENOENT' });
async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'nine-axis-recovery-')), task = join(dir, 'case'), root = join(task, 'nine-axis');
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(root, { recursive: true });
  const act = (step: string, action: string) => applyStepAction({ name: 'case', dir, section: 'nine-axis', step, action });
  const all = (action: string) => applyTaskAction({ name: 'case', dir, section: 'nine-axis', action });
  async function deliver(id: string) {
    for (const path of await stepDeliveries(root, 'nine-axis', id)) {
      await put(path, path.endsWith('deformers.json') ? JSON.stringify({ parts: [{ texture: 'layers/face.png' }] }) : path);
    }
    // The document records the textures that are also required for recovery.
    for (const path of await stepDeliveries(root, 'nine-axis', id)) {
      if (path.endsWith(join('layers', 'face.png'))) await put(path, 'original PNG bytes');
    }
    await put(join(root, id, '.completed'), '');
  }
  await deliver('step04_angles/model');
  await deliver('step01_preparation');
  await deliver('step06_angle-xy');
  await put(join(root, 'step06_angle-xy/face-xy.json'), 'existing XY author');
  await put(join(root, 'step06_angle-xy/layers/face.png'), 'existing XY PNG');
  for (const group of nineAxisGroups) {
    const id = `step04_angles/model/${group}`;
    await put(join(root, id, '.completed'), '');
    await put(sessionPath(root, id), JSON.stringify({ threadId: `${group}-thread`, harness: 'codex' }));
    await put(join(root, `agents/attempt-${group}/request.json`), JSON.stringify({ outputDirectory: `nine-axis/${id}` }));
  }
  // Isolated actions must leave another section, and a similarly named attempt, alone.
  await put(join(task, 'raster-layering/step01/.running'), '');
  await put(sessionPath(join(task, 'raster-layering'), 'step01'), JSON.stringify({ threadId: 'raster-thread' }));
  await put(join(root, 'agents/attempt-other/request.json'), JSON.stringify({ outputDirectory: 'nine-axis/step04_angles/model/up-extra' }));
  await put(join(root, 'agents/attempt-unknown/request.json'), '{}');
  await put(join(root, 'agents/sessions.json'), JSON.stringify(Object.fromEntries(nineAxisGroups.map(group => [group, {
    workspace: `nine-axis/step04_angles/model/${group}/workspace`, data: `nine-axis/agents/attempt-${group}/cli-data`,
  }]))));
  return { dir, task, root, act, all, deliver };
}

test('video receipts follow the normal continue, resume and retry behavior', async t => {
  const f = await fixture(t), step = 'step04_angles/video', video = join(f.root, step);
  const pending = { version: 1, submittedAt: '2026-11-23T01:43:12.000Z', requestHash: '1'.repeat(64) };
  const confirmed = { version: 1, requestHash: '2'.repeat(64), id: 'provider-original' };
  await put(join(video, '.running'), '');
  await put(join(video, 'left-up.job.json'), JSON.stringify(pending));
  await put(join(video, 'left-down.job.json'), JSON.stringify(confirmed));
  await put(join(video, 'left-down.mp4'), 'existing video');
  const before = await snapshot(video);
  await f.all('continue');
  assert.deepEqual(await snapshot(video), before);
  await f.all('resume');
  assert.deepEqual(await snapshot(video), before);

  await f.all('retry');
  await absent(join(video, 'left-up.job.json'));
  await absent(join(video, 'left-down.job.json'));
  await absent(join(video, 'left-down.mp4'));
  assert.equal((await readStep(join(f.root, 'step04_angles/model'))).status, 'completed');
});

test('九轴登记正式七步和并发分支，独立会话可见，内部目录不可操作', async t => {
  for (const id of [...nineAxisSteps, ...nineAxisGroupSteps, ...nineAxisBranchSteps]) assert.equal(validStepId('nine-axis', id), true, id);
  for (const id of ['step04_angles/model/neutral', 'step04_angles/model/merged', 'step04_angles/model/left/more',
    'step02_angle-x', 'step03_video-y', 'step04_angle-up', 'step05_angle-down', 'step06_retired-xy', 'step05', '../step04_angles/model']) {
    assert.equal(validStepId('nine-axis', id), false, id);
  }
  const f = await fixture(t), steps = await listSteps(f.root, 'nine-axis');
  assert.deepEqual(steps.map(step => [step.id, step.session]), [
    ['step01_preparation', false], ['step04_angles', false], ['step04_angles/model', false], ['step04_angles/model/down', true], ['step04_angles/model/left', true], ['step04_angles/model/up', true],
    ['step06_angle-xy', false],
  ]);
  await put(join(f.root, 'step02_angles/up/deformers.json'), 'old model');
  const before = await snapshot(f.root);
  await assert.rejects(f.act('step02_angles/up', 'retry'), Error);
  assert.deepEqual(await snapshot(f.root), before);
});

test('child continue 保留全部字节，resume 只清自己会话，产物/尝试/兄弟/合并不动', async t => {
  const f = await fixture(t), id = 'step04_angles/model/up', own = join(f.root, id);
  await rm(join(own, '.completed')); await put(join(own, '.running'), '');
  const before = await snapshot(f.root);
  await f.act(id, 'continue');
  assert.deepEqual(await snapshot(f.root), before);
  await f.act(id, 'resume');
  await absent(sessionPath(f.root, id));
  const after = await snapshot(f.root), key = relative(f.root, sessionPath(f.root, id));
  delete before[key]; delete after[key + '.history.jsonl'];
  assert.deepEqual(after, before);
});

for (const group of nineAxisGroups) test(`重试 ${group} 只清自己的作者/会话/attempts，保留 neutral/兄弟/XY 并打开父合并`, async t => {
  const f = await fixture(t), id = `step04_angles/model/${group}`, parent = join(f.root, 'step04_angles/model');
  const neutral = await snapshot(join(f.root, 'step01_preparation')), xy = await snapshot(join(f.root, 'step06_angle-xy'));
  const other = await snapshot(join(f.task, 'raster-layering'));
  const siblings = Object.fromEntries(await Promise.all(nineAxisGroups.filter(view => view !== group).map(async view =>
    [view, await snapshot(join(parent, view))] as const)));
  await f.act(id, 'retry');
  assert.equal((await readStep(join(f.root, id))).status, 'absent');
  await absent(sessionPath(f.root, id));
  await absent(join(f.root, `agents/attempt-${group}/request.json`));
  assert.equal((await readStep(parent)).status, 'running');
  for (const path of ['deformers.json', 'axis-sources.json', 'source.json', 'merged/deformers.json', 'layers/face.png']) await absent(join(parent, path));
  assert.deepEqual(await snapshot(join(f.root, 'step01_preparation')), neutral);
  assert.deepEqual(await snapshot(join(f.root, 'step06_angle-xy')), xy);
  assert.deepEqual(await snapshot(join(f.task, 'raster-layering')), other);
  for (const [view, bytes] of Object.entries(siblings)) {
    assert.deepEqual(await snapshot(join(parent, view)), bytes);
    assert.equal(JSON.parse(await readFile(sessionPath(f.root, `step04_angles/model/${view}`), 'utf8')).threadId, `${view}-thread`);
  }
  assert.deepEqual(Object.keys(JSON.parse(await readFile(join(f.root, 'agents/sessions.json'), 'utf8'))), nineAxisGroups.filter(view => view !== group));
  assert.ok(await readFile(join(f.root, 'agents/attempt-other/request.json')));
  assert.ok(await readFile(join(f.root, 'agents/attempt-unknown/request.json')));
});

test('section 级操作忽略其他管线，task retry 跳过有 unfinished child 的父步骤并保留已完成 siblings', async t => {
  const f = await fixture(t), parent = join(f.root, 'step04_angles/model');
  await rm(join(parent, '.completed')); await put(join(parent, '.running'), '');
  for (const group of ['up', 'down']) await rm(join(parent, group, '.completed'));
  await put(join(parent, 'up/.running'), ''); // down is an unmarked, unfinished child.
  const other = await snapshot(join(f.task, 'raster-layering')), neutral = await snapshot(join(f.root, 'step01_preparation'));
  const left = await snapshot(join(parent, 'left')), xy = await snapshot(join(f.root, 'step06_angle-xy'));
  await f.all('continue');
  assert.equal(JSON.parse(await readFile(sessionPath(f.root, 'step04_angles/model/up'), 'utf8')).threadId, 'up-thread');
  await f.all('resume');
  await absent(sessionPath(f.root, 'step04_angles/model/up')); await absent(sessionPath(f.root, 'step04_angles/model/down'));
  assert.deepEqual(await snapshot(join(parent, 'left')), left);
  await f.all('retry');
  assert.equal((await readStep(join(parent, 'up'))).status, 'absent');
  assert.equal((await readStep(join(parent, 'down'))).status, 'absent');
  assert.deepEqual(await snapshot(join(parent, 'left')), left);
  assert.deepEqual(await snapshot(join(f.root, 'step01_preparation')), neutral);
  assert.deepEqual(await snapshot(join(f.root, 'step06_angle-xy')), xy);
  assert.deepEqual(await snapshot(join(f.task, 'raster-layering')), other);
});

test('合并投影丢失时只重开父合并，不删除三个已完成作者或其 session/attempts', async t => {
  const f = await fixture(t), parent = join(f.root, 'step04_angles/model');
  const groups = await Promise.all(nineAxisGroups.map(view => snapshot(join(parent, view))));
  const sessions = await snapshot(join(f.root, 'agents'));
  await rm(join(parent, 'merged/deformers.json'));
  await f.all('retry');
  assert.equal((await readStep(parent)).status, 'running');
  assert.deepEqual(await snapshot(join(f.root, 'agents')), sessions);
  for (let index = 0; index < nineAxisGroups.length; index++) assert.deepEqual(await snapshot(join(parent, nineAxisGroups[index])), groups[index]);
});

test('九轴 completed 的交付检查包含三视频/子作者/合并/斜角选帧与 trace，文件齐全不代表视觉通过', async t => {
  const f = await fixture(t);
  assert.deepEqual(await missingDeliveries(f.root, 'nine-axis', 'step04_angles/model/up'), []);
  await rm(join(f.root, 'step04_angles/model/up/fit-report.json'));
  assert.deepEqual(await missingDeliveries(f.root, 'nine-axis', 'step04_angles/model/up'), [join(f.root, 'step04_angles/model/up/fit-report.json')]);
  const video = (await stepDeliveries(f.root, 'nine-axis', 'step02_video')).map(path => relative(f.root, path).replaceAll('\\', '/'));
  for (const view of nineAxisGroups) assert.ok(video.includes(`step02_video/${view}.mp4`) );
  const xy = (await stepDeliveries(f.root, 'nine-axis', 'step06_angle-xy')).map(path => relative(f.root, path).replaceAll('\\', '/'));
  for (const name of ['face-xy.json', 'left-up-face-trace.json', 'left-down-fit-report.json']) assert.ok(xy.includes(`step06_angle-xy/${name}`), name);
});

test('九轴独立 CLI 无 ongoing 时 continue 可新跑，resume/retry 要求存在可恢复步骤', async t => {
  const f = await fixture(t);
  await rm(f.root, { recursive: true });
  await f.all('continue');
  await assert.rejects(f.all('resume'), Error);
  await assert.rejects(f.all('retry'), Error);
});

for (const retry of ['step04_angles/video', 'step04_angles/model/up', 'step04_angles/model']) test(`七步恢复 ${retry} 保留另一并发支、已完成方向和旧成果`, async t => {
  const f = await fixture(t);
  for (const id of ['step01_preparation', 'step04_angles', 'step04_angles/model', ...nineAxisGroupSteps, 'step04_angles/video']) await f.deliver(id);
  await put(join(f.root, 'step02_angles/left/deformers.json'), 'old model');
  const old = await snapshot(join(f.root, 'step02_angles'));
  const preparation = await snapshot(join(f.root, 'step01_preparation'));
  const other = retry.endsWith('/video') ? 'step04_angles/model' : 'step04_angles/video';
  const otherBytes = await snapshot(join(f.root, other));
  const preserved = await snapshot(join(f.root, 'step04_angles/model/down'));
  if (retry === 'step04_angles/model') {
    await rm(join(f.root, 'step04_angles/model/up/.completed'));
    await put(join(f.root, 'step04_angles/model/up/.running'), '');
  }
  await f.act(retry, 'retry');
  assert.deepEqual(await snapshot(join(f.root, other)), otherBytes);
  assert.deepEqual(await snapshot(join(f.root, 'step01_preparation')), preparation);
  assert.deepEqual(await snapshot(join(f.root, 'step02_angles')), old);
  assert.equal((await readStep(join(f.root, 'step04_angles'))).status, 'running');
  if (!retry.endsWith('/video')) {
    assert.deepEqual(await snapshot(join(f.root, 'step04_angles/model/down')), preserved);
    assert.equal((await readStep(join(f.root, 'step04_angles/model/up'))).status, 'absent');
    assert.equal((await readStep(join(f.root, 'step04_angles/model'))).status, 'running');
  }
});

test('总入口状态列出七步、两支和各方向自己的会话', async t => {
  const f=await fixture(t);
  await f.deliver('step01_preparation');
  await rm(join(f.root,'step04_angles/model/up/.completed'));
  for(const id of ['step04_angles','step04_angles/model','step04_angles/model/up','step04_angles/video']) await put(join(f.root,id,'.running'),'');
  await put(sessionPath(f.root,'step04_angles/model/up'),JSON.stringify({threadId:'up-thread'}));
  await put(join(f.task,'run.json'),JSON.stringify({version:1,jobs:3,from:'nine-axis',to:'nine-axis',status:'running',sections:{'nine-axis':{status:'running'}}}));
  const { taskStatus }=await import('../state.ts');
  const value=await taskStatus({name:'case',dir:f.dir}), section=value.sections[0];
  assert.equal(section.threadId,'up-thread');
  for(const name of ['step01_preparation','step04_angles','step04_angles/model','step04_angles/model/up','step04_angles/video']) assert.ok(section.steps.some(s=>s.name===name),name);
});
