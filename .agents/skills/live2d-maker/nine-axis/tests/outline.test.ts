import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outlineFiles, runOutline, type OutlineRole } from '../outline.ts';

async function scratch(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'outline-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
const agent = (directory: string, verdicts: Partial<Record<OutlineRole, string>>, calls: OutlineRole[]) => async (role: OutlineRole) => {
  calls.push(role);
  if (role === 'main') for (const file of outlineFiles) await writeFile(join(directory, file), 'x');
  else await writeFile(join(directory, role === 'review' ? 'review-01.md.tmp' : 'repair-01.md.tmp'), `结论：${verdicts[role]}\n正文`);
};

test('描边通过 review 后不返修；再跑不重复', async t => {
  const directory = await scratch(t), calls: OutlineRole[] = [];
  await runOutline(directory, agent(directory, { review: '通过' }, calls));
  await runOutline(directory, agent(directory, { review: '通过' }, calls));
  assert.deepEqual(calls, ['main', 'review']);
  assert.match(await readFile(join(directory, 'review-01.md'), 'utf8'), /^结论：通过/);
});

test('需要修复时原线程返修一次，不再 review', async t => {
  const directory = await scratch(t), calls: OutlineRole[] = [];
  await runOutline(directory, agent(directory, { review: '需要修复', repair: '已修复' }, calls));
  await runOutline(directory, agent(directory, { review: '需要修复', repair: '已修复' }, calls));
  assert.deepEqual(calls, ['main', 'review', 'repair']);
});

test('返修仍有问题时报错并在重跑时只续返修；review 失败后不重画', async t => {
  const directory = await scratch(t), calls: OutlineRole[] = [];
  await assert.rejects(runOutline(directory, agent(directory, { review: '需要修复', repair: '仍有问题' }, calls)), /仍有问题/);
  await runOutline(directory, agent(directory, { repair: '已修复' }, calls));
  assert.deepEqual(calls, ['main', 'review', 'repair', 'repair']);
  const other = await scratch(t), again: OutlineRole[] = [];
  await assert.rejects(runOutline(other, agent(other, { review: '无法完成检查' }, again)), /无法完成检查/);
  await runOutline(other, agent(other, { review: '通过' }, again));
  assert.deepEqual(again, ['main', 'review', 'review']);
});
