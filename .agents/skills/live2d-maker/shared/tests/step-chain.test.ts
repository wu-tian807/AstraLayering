import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { completeStep, inspectChain, modifiedError, resetChain, startStep, type ChainStep } from '../step-chain.ts';

async function tree(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'step-chain-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  // a -> b -> c, and a -> d: a tree, not a line.
  const step = (id: string, ...dependsOn: string[]): ChainStep => ({ id, directory: join(root, id), dependsOn });
  const steps = [step('a'), step('b', 'a'), step('c', 'b'), step('d', 'a')];
  const finish = async (id: string) => {
    const target = steps.find(s => s.id === id)!;
    await mkdir(target.directory, { recursive: true });
    await startStep(target.directory, (await inspectChain(steps)).statuses.get(id)!);
    await completeStep(target, steps);
  };
  return { steps, finish };
}

test('允许提前诊断的目录保持未开始，不能让已存在的后代冒充有效', async t => {
  const { steps, finish } = await tree(t);
  steps[1].allowsEarlyArtifacts = true;
  await finish('a');
  await mkdir(steps[1].directory);
  const diagnostic = join(steps[1].directory, 'trace.json');
  await writeFile(diagnostic, 'preserved diagnostic');
  const initial = await inspectChain(steps);
  assert.equal(initial.statuses.get('b'), 'absent');
  assert.deepEqual(initial.reset, []);
  await mkdir(steps[2].directory);
  await writeFile(join(steps[2].directory, '.completed'), '');
  const plan = await inspectChain(steps);
  assert.deepEqual(plan.reset, ['c']);
  await resetChain(steps, plan);
  assert.equal(await readFile(diagnostic, 'utf8'), 'preserved diagnostic');
  await startStep(steps[1].directory, 'absent');
  assert.equal((await inspectChain(steps)).statuses.get('b'), 'running');
});

test('上游重新完成后，依赖它的已完成步骤及其后代断链重跑，旁支保留', async t => {
  const { steps, finish } = await tree(t);
  for (const id of ['a', 'b', 'c', 'd']) await finish(id);
  assert.deepEqual((await inspectChain(steps)).reset, []);
  await rm(join(steps[1].directory, '.completed'));
  await finish('b');
  const plan = await inspectChain(steps);
  assert.deepEqual(plan.reset, ['c']);
  await resetChain(steps, plan);
  await assert.rejects(stat(steps[2].directory), { code: 'ENOENT' });
  await stat(join(steps[3].directory, '.completed'));
});

test('缺标记的步骤与其存在的后代重跑；缺失的上游只断开已存在的下游', async t => {
  const { steps, finish } = await tree(t);
  for (const id of ['a', 'b', 'c', 'd']) await finish(id);
  await rm(join(steps[0].directory, '.completed'));
  assert.deepEqual((await inspectChain(steps)).reset, ['a', 'b', 'c', 'd']);
  await rm(steps[0].directory, { recursive: true });
  assert.deepEqual((await inspectChain(steps)).reset, ['b', 'c', 'd']);
});

test('旧的空 .completed 视为完成；重新打开已完成步骤保留原 stamp', async t => {
  const { steps, finish } = await tree(t);
  await mkdir(steps[0].directory); await writeFile(join(steps[0].directory, '.completed'), '');
  await finish('b');
  assert.deepEqual(JSON.parse(await readFile(join(steps[1].directory, '.completed'), 'utf8')).inputs, {});
  const before = await readFile(join(steps[1].directory, '.completed'), 'utf8');
  await finish('b');
  assert.equal(await readFile(join(steps[1].directory, '.completed'), 'utf8'), before);
  assert.deepEqual((await inspectChain(steps)).reset, []);
});

test('声明产物的步骤：续跑发现产物被换则报告改动；重试后 hash 刷新，同内容重做保留下游', async t => {
  const root = await mkdtemp(join(tmpdir(), 'step-chain-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const steps: ChainStep[] = [{ id: 'a', directory: join(root, 'a'), dependsOn: [], outputs: ['a.png'] },
    { id: 'b', directory: join(root, 'b'), dependsOn: ['a'], outputs: ['b.png'] }];
  const finish = async (index: number, bytes: string) => {
    await mkdir(steps[index].directory, { recursive: true });
    await writeFile(join(steps[index].directory, `${steps[index].id}.png`), bytes);
    await startStep(steps[index].directory, (await inspectChain(steps)).statuses.get(steps[index].id)!);
    await completeStep(steps[index], steps);
  };
  await finish(0, 'one'); await finish(1, 'two');
  await writeFile(join(steps[0].directory, 'a.png'), 'swapped');
  const plan = await inspectChain(steps);
  assert.deepEqual(plan, { ...plan, reset: [], modified: ['a'] });
  assert.match(modifiedError(plan, steps)!.message, /不能直接续跑/);
  // Retry a with the same bytes: b stays.
  await rm(steps[0].directory, { recursive: true });
  await finish(0, 'one');
  assert.deepEqual((await inspectChain(steps)).reset, []);
  // Retry a with new bytes: b reruns.
  await rm(steps[0].directory, { recursive: true });
  await finish(0, 'changed');
  assert.deepEqual((await inspectChain(steps)).reset, ['b']);
});

test('产物可在步骤目录外：删除产物即重试该步骤，重置会一并删除后代的产物', async t => {
  const root = await mkdtemp(join(tmpdir(), 'step-chain-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const steps: ChainStep[] = [{ id: 'a', directory: join(root, '.steps/a'), dependsOn: [], outputs: ['../../a.png'] },
    { id: 'b', directory: join(root, '.steps/b'), dependsOn: ['a'], outputs: ['../../b.png'] }];
  for (const step of steps) {
    await mkdir(step.directory, { recursive: true });
    await writeFile(join(root, `${step.id}.png`), step.id);
    await startStep(step.directory, 'absent');
    await completeStep(step, steps);
  }
  assert.deepEqual(Object.keys(JSON.parse(await readFile(join(root, '.steps/b/.completed'), 'utf8')).outputs), ['../../b.png']);
  await rm(join(root, 'a.png'));
  const plan = await inspectChain(steps);
  assert.deepEqual([plan.reset, plan.modified], [['a', 'b'], []]);
  await resetChain(steps, plan);
  for (const path of ['b.png', '.steps/a', '.steps/b']) await assert.rejects(stat(join(root, path)), { code: 'ENOENT' });
});
