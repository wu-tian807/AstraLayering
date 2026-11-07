import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outlineFiles, runOutline, type OutlineAgent, type OutlineRole } from '../outline.ts';
import type { SvgObservation } from '../../shared/part/svg-tools.ts';

async function scratch(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'outline-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
const context = { signal: new AbortController().signal } as never;
function agent(directory: string, observations: SvgObservation[], verdicts: string[], calls: OutlineRole[]): OutlineAgent {
  return async (role, submit) => {
    calls.push(role);
    if (role === 'main') for (const file of outlineFiles) await writeFile(join(directory, file), 'x');
    if (role === 'repair') await writeFile(join(directory, 'target-face.svg'), `repaired ${calls.length}`);
    if (role === 'review') {
      observations.push({ source: join(directory, 'target-face.svg'), mode: 'blend', savedPath: 'a.png' });
      await submit!.execute({ verdict: verdicts.shift(), feedback: '意见' }, context.signal, context);
    }
  };
}

test('描边一轮 review 通过后不返修；再跑不重复', async t => {
  const directory = await scratch(t), observations: SvgObservation[] = [], calls: OutlineRole[] = [];
  await runOutline(directory, agent(directory, observations, ['pass'], calls), observations);
  await runOutline(directory, agent(directory, observations, [], calls), observations);
  assert.deepEqual(calls, ['main', 'review']);
});

test('一轮 revise 对应原线程一次返修，修完直接往下走；续跑不重复返修', async t => {
  const directory = await scratch(t), observations: SvgObservation[] = [], calls: OutlineRole[] = [];
  await runOutline(directory, agent(directory, observations, ['revise'], calls), observations);
  await runOutline(directory, agent(directory, observations, [], calls), observations);
  assert.deepEqual(calls, ['main', 'review', 'repair']);
  const report = JSON.parse(await readFile(join(directory, 'review.json'), 'utf8'));
  assert.equal(report.reviews.length, 1);
  assert.ok(report.reviews[0].repairedCandidateHash);
});

test('blocked 不算轮次，重跑时重新 review 而不重画', async t => {
  const directory = await scratch(t), observations: SvgObservation[] = [], calls: OutlineRole[] = [];
  await assert.rejects(runOutline(directory, agent(directory, observations, ['blocked'], calls), observations), /blocked/);
  await runOutline(directory, agent(directory, observations, ['revise'], calls), observations);
  assert.deepEqual(calls, ['main', 'review', 'review', 'repair']);
});
