import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { beginStep, checkStep, completeStep, readStep } from '../step-chain.ts';

async function folder(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'step-chain-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return join(root, 'step01');
}

test('只看标记：缺失则运行，.running 续跑，.completed 沿用', async t => {
  const step = await folder(t);
  assert.deepEqual(await checkStep(step), { action: 'run', status: 'absent' });
  await beginStep(step, 'absent');
  await writeFile(join(step, 'draft.svg'), 'draft');
  assert.deepEqual(await checkStep(step), { action: 'continue', status: 'running' });
  // 续跑不动已有草稿。
  await beginStep(step, 'running');
  assert.equal(await readFile(join(step, 'draft.svg'), 'utf8'), 'draft');
  await completeStep(step);
  assert.deepEqual(await checkStep(step), { action: 'keep', status: 'completed' });
  assert.equal(await readFile(join(step, '.completed'), 'utf8'), '');
  await assert.rejects(beginStep(step, 'completed'), Error);
});

test('无标记的目录删除后重新运行', async t => {
  const step = await folder(t);
  await mkdir(step);
  await writeFile(join(step, 'leftover.svg'), 'old');
  assert.deepEqual(await checkStep(step), { action: 'run', status: 'unmarked' });
  await beginStep(step, 'unmarked');
  await assert.rejects(readFile(join(step, 'leftover.svg')), { code: 'ENOENT' });
  assert.equal((await readStep(step)).status, 'running');
});

test('旧 JSON 标记照常读作完成或运行中', async t => {
  const step = await folder(t);
  await mkdir(step);
  await writeFile(join(step, '.running'), JSON.stringify({ inputs: {} }));
  assert.equal((await readStep(step)).status, 'running');
  await rm(join(step, '.running'));
  await writeFile(join(step, '.completed'), JSON.stringify({ stamp: 's', inputs: {}, outputs: {} }));
  assert.equal((await readStep(step)).status, 'completed');
});

test('步骤路径与标记必须是普通目录和普通文件', async t => {
  const step = await folder(t);
  await writeFile(step, 'not a directory');
  await assert.rejects(readStep(step), Error);
  await rm(step);
  await mkdir(join(step, '.completed'), { recursive: true });
  await assert.rejects(readStep(step), Error);
});
