import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { readJson, reportPath } from '../../shared/part/artifact-facts.ts';
import { writeAtomic } from '../../shared/part/groups.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { groupStepId } from '../../shared/part/part-steps.ts';
import { readStep } from '../../shared/step-chain.ts';
import { fixture, workingSteps } from './layering-fixture.ts';

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
