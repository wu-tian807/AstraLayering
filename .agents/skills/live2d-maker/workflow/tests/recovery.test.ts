import {staticPromptPrefix} from '../../shared/tests/prompt-prefix.ts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { runWorkflow as raster } from '../../raster-layering/run.ts';
import { steps as rasterSteps } from '../../raster-layering/steps.ts';
import { runWorkflow as clothing } from '../../clothing-raster-layering/run.ts';
import { steps as clothingSteps } from '../../clothing-raster-layering/steps.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { seedUpstream } from '../../shared/tests/upstream-fixture.ts';
import type { AgentRequest } from '../../shared/raster/agent.ts';
import type { StepDefinition } from '../../shared/raster/steps.ts';
import { clearStepSession, readStepSession } from '../../shared/agents/step-session.ts';
import { stepKnowledge } from '../../shared/knowledge.ts';
const mainPrompt = (step: { knowledge: { section: string; step: string } }) => stepKnowledge(step.knowledge.section, step.knowledge.step).files('main')[0];

async function deliver(request: AgentRequest, step: StepDefinition, thread = request.threadId ?? 'replacement') {
  await request.onEvent({ type: 'thread.started', thread_id: thread });
  for (const file of step.requiredFiles) {
    await writeFile(join(request.directory, step.id, step.review && file === 'report.md' ? 'report.md.tmp' : file), 'fixture');
  }
  return { status: 'completed' as const, summary: 'done' };
}

for (const [section, execute, definitions, upstream] of [
  ['raster-layering', raster, rasterSteps, 'part-layering'],
  ['clothing-raster-layering', clothing, clothingSteps, 'clothing-part-layering'],
] as const) {
  test(section + ' 恢复后新 thread 接续修复包含原任务，reviewer 仍全新且第二轮修完结束', async t => {
    const dir = await mkdtemp(join(tmpdir(), 'review-recovery-')), name = 'case', task = join(dir, name);
    t.after(() => rm(dir, { recursive: true, force: true }));
    await seedUpstream(name, upstream, dir);
    const options = { name, dir, krita: process.execPath }, output = join(task, section);
    const deps = { environment: loadWorkflowEnvironment({}, dir), steps: definitions.slice(0, 2),
      preflight: async (executable: string) => ({ executable, version: 'test' }) };
    let call = 0;
    await assert.rejects(execute(options, { ...deps, agent: async request => {
      call++;
      if (call === 1) return deliver(request, definitions[0], 'original');
      if (call === 2) {
        assert.equal(request.threadId, undefined);
        await writeFile(join(output, 'step01/review-01.md.tmp'), '结论：需要修复\n袖口残色。');
        return { status: 'completed', summary: 'reviewed' };
      }
      assert.equal(call, 3); assert.equal(request.threadId, 'original'); throw new Error('broken context');
    } }), Error);
    const report = await readFile(join(output, 'step01/review-01.md'));
    // --resume: the session is cleared, products and review stay.
    await clearStepSession(output, 'step01', 'broken context');
    let resumed = 0;
    await execute(options, { ...deps, agent: async request => {
      resumed++;
      if (resumed === 1) {
        assert.equal(request.threadId, undefined);
        assert.ok(request.prompt.startsWith(staticPromptPrefix(await readFile(mainPrompt(definitions[0]), 'utf8'))));
        assert.match(request.prompt, /repair-01.md.tmp/);
        await request.onEvent({ type: 'thread.started', thread_id: 'replacement-draw' });
        await writeFile(join(output, 'step01/repair-01.md.tmp'), '结论：已修复\n袖口已修画。');
      } else if (resumed === 2) {
        assert.equal(request.threadId, undefined);
        await request.onEvent({ type: 'thread.started', thread_id: 'fresh-review' });
        await writeFile(join(output, 'step01/review-02.md.tmp'), '结论：需要修复\n领口需修画。');
      } else if (resumed === 3) {
        assert.equal(resumed, 3); assert.equal(request.threadId, 'replacement-draw');
        await writeFile(join(output, 'step01/repair-02.md.tmp'), '结论：已修复\n领口已修画。');
      }
      if (resumed === 4) return deliver(request, definitions[1], 'replacement-draw');
      return { status: 'completed', summary: 'done' };
    } });
    assert.equal(resumed, 4); assert.deepEqual(await readFile(join(output, 'step01/review-01.md')), report);
    await readFile(join(output, 'step01/.completed'));
    assert.equal((await readStepSession(output, 'step01'))!.threadId, 'replacement-draw');
  });
}
