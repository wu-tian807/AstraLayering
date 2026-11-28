import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { artifactPath, readJson, reportPath } from '../../shared/part/artifact-facts.ts';
import { writeAtomic } from '../../shared/part/groups.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { groupStepId } from '../../shared/part/part-steps.ts';
import { readStep } from '../../shared/step-chain.ts';
import { fixture, shape, workingMerger, workingSteps } from './layering-fixture.ts';

async function missing(paths: string[]) {
  for (const path of paths) await assert.rejects(readFile(path), { code: 'ENOENT' }, path);
}

test('复核中断后续跑沿用同一轮廓与复核记录，不重画也不重置返修次数', async t => {
  const f = await fixture(t), events: string[] = [], steps = workingSteps(events);
  const report = { groupId: 'head', reviews: [{ verdict: 'revise', feedback: 'first', candidateHash: 'old' }] };
  await assert.rejects(runLayering({ ...f, groups: null, steps: { ...steps, async reviewOutline(context) {
    await writeAtomic(context.reportPath, JSON.stringify(report)); throw new Error('review interrupted');
  } } }), Error);
  assert.equal((await readStep(join(f.directory, groupStepId('head', 'outline')))).status, 'running');
  events.length = 0;
  await runLayering({ ...f, groups: null, steps: { ...steps, async reviewOutline(context) {
    assert.deepEqual(await readJson(context.reportPath), report);
    return steps.reviewOutline(context);
  } } });
  assert.ok(!events.includes('head:outline'));
});

for (const stage of ['outline', 'completion'] as const) {
  test(`${stage} 中断后续跑沿用草稿；重试删除步骤后从空草稿重画`, async t => {
    const f = await fixture(t), events: string[] = [];
    const steps = workingSteps(events, [{ id: 'a' }, { id: 'b' }]);
    const partial = Buffer.from(shape('a', 30, 70));
    const draw = stage === 'outline' ? 'drawOutline' : 'completeOcclusion';
    await assert.rejects(runLayering({ ...f, groups: null, mergeSvg: workingMerger(events), steps: { ...steps, async [draw](context: never) {
      const { group, outputPath, resumeDraft } = context as { group: { id: string }; outputPath: string; resumeDraft?: boolean };
      if (group.id !== 'a') return (steps[draw] as (c: never) => Promise<unknown>)(context);
      assert.equal(resumeDraft, false);
      await writeAtomic(outputPath, partial);
      throw new Error('interrupted while drawing');
    } } }), Error);
    const resumed: (boolean | undefined)[] = [];
    const resuming = { ...steps, async [draw](context: never) {
      const { group, outputPath, resumeDraft } = context as { group: { id: string }; outputPath: string; resumeDraft?: boolean };
      if (group.id === 'a') {
        resumed.push(resumeDraft);
        if (resumeDraft) assert.deepEqual(await readFile(outputPath), partial);
        else await missing([outputPath]);
      }
      return (steps[draw] as (c: never) => Promise<unknown>)(context);
    } };
    await runLayering({ ...f, groups: null, steps: resuming, mergeSvg: workingMerger(events) });
    assert.deepEqual(resumed, [true]);
    // 重试：删掉步骤目录（及补全草稿）后不再沿用。
    await rm(join(f.directory, groupStepId('a', stage)), { recursive: true });
    if (stage === 'completion') await rm(artifactPath(f.directory, 'a', 'completion'));
    await runLayering({ ...f, groups: null, steps: resuming, mergeSvg: workingMerger(events) });
    assert.deepEqual(resumed, [true, false]);
  });
}
