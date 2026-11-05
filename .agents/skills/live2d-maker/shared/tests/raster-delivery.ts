import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {AgentRequest, StepResult} from '../raster/agent.ts';
import type {StepDefinition} from '../raster/steps.ts';

export const isRasterReview = (request: AgentRequest) => request.prompt.startsWith('你负责独立 review 第一步的交付');
export async function deliverRasterStep(request: AgentRequest, step: StepDefinition, thread = 'fixture-thread', text = 'fixture'): Promise<StepResult> {
  if (isRasterReview(request)) {
    assert.equal(request.threadId, undefined);
    const report = request.prompt.match(/step01\/(review-\d{2}\.md\.tmp)/)?.[1];
    assert.ok(report);
    await request.onEvent({type:'thread.started',thread_id:'independent-reviewer'});
    await writeFile(join(request.directory, step.id, report), '结论：通过\n\n已逐项检查本测试交付。');
  } else {
    await request.onEvent({type:'thread.started',thread_id:request.threadId ?? thread});
    for (const file of step.requiredFiles) await writeFile(join(request.directory,step.id,
      step.review && file==='report.md'?'report.md.tmp':file),text);
  }
  return {status:'completed',summary:'fixture completed'};
}
