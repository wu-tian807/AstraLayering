import { readStepSession } from '../../shared/agents/step-session.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { splitStructure } from '../../shared/tests/structure-fixture.ts';
import { seedUpstream } from '../../shared/tests/upstream-fixture.ts';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { AgentRequest, StepResult } from '../../shared/raster/agent.ts';
import { steps, type StepDefinition } from '../steps.ts';
import { runWorkflow } from '../run.ts';

const completed: StepResult = { status: 'completed', summary: 'fixture completed' };
const forbidden = async (): Promise<never> => assert.fail('unexpected model call');
const preflight = async (executable: string) => ({ executable });
async function absent(path: string) { await assert.rejects(readFile(path), { code: 'ENOENT' }); }
const isReview = (request: AgentRequest) => request.prompt.startsWith('你负责独立 review 第一步的交付');
function reportName(request: AgentRequest): string {
  const name = request.prompt.match(/step01\/((?:review|repair)-\d{2}\.md\.tmp)/)?.[1];
  assert.ok(name, 'a single concrete output filename must be injected');
  return name;
}
async function report(request: AgentRequest, conclusion: string) {
  await writeFile(join(request.directory, 'step01', reportName(request)), `结论：${conclusion}\n\n逐项检查和处理证据。\n`);
  return completed;
}
async function fixture(t: TestContext) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'raster-review-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runsDirectory = join(directory, 'runs');
  const input = await seedUpstream('test', 'clothing-part-layering', runsDirectory);
  await mkdir(join(input, 'parts'), { recursive: true });
  await writeFile(join(input, 'parts/part.svg'), 'fixture');
  const options = { name: 'test', krita: process.execPath };
  const deps = { environment: loadWorkflowEnvironment({}, directory), preflight, runsDirectory, steps: steps.slice(0, 1) };
  const drawingSteps = deps.steps.map((step: StepDefinition) => {
    const { review: _review, ...drawing } = step;
    return drawing;
  });
  let index = 0;
  await runWorkflow(options, { ...deps, steps: drawingSteps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'drawing-thread' });
    for (const file of drawingSteps[index].requiredFiles) await writeFile(join(request.directory, drawingSteps[index].id, file), `initial ${file}`);
    index++;
    return completed;
  } });
  // The drawing is delivered but not yet reviewed: the step is still running.
  const output = join(runsDirectory, 'test', 'clothing-raster-layering');
  await rename(join(output, 'step01/.completed'), join(output, 'step01/.running'));
  return { directory, output: join(runsDirectory, 'test', 'clothing-raster-layering'), options, resume: { name: 'test', krita: process.execPath }, deps };
}

test('旧第一步交付直接补 review；无问题时一次结束，reviewer ID 不覆盖或保存为主上下文', async t => {
  const f = await fixture(t);
  const original = await readFile(join(f.output, 'step01/clothing-depth.kra'));
  let calls = 0;
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    calls++;
    assert.ok(isReview(request));
    assert.equal(request.threadId, undefined);
    assert.equal(request.model, 'gpt-6.1-sol');
    assert.equal(request.effort, 'xhigh');
    assert.ok(!/第一轮|第二轮|最多|两轮|\{\w+\}/.test(request.prompt));
    await readFile(join(f.output, 'step01/.running'));
    await absent(join(f.output, 'step01/.completed'));
    await request.onEvent({ type: 'thread.started', thread_id: 'disposable-reviewer' });
    assert.equal((await readStepSession(f.output, 'step01'))?.threadId, 'drawing-thread');
    return report(request, '通过');
  } });
  assert.equal(calls, 1);
  assert.deepEqual(await readFile(join(f.output, 'step01/clothing-depth.kra')), original);
  await readFile(join(f.output, 'step01/review-01.md'));
  await absent(join(f.output, 'step01/review-01.md.tmp'));
  await absent(join(f.output, 'step01/repair-01.md'));
  await absent(join(f.output, 'step01/review-02.md'));
  await readFile(join(f.output, 'step01/.completed'));
  assert.ok(!(await readFile(join(f.output, 'agents/steps/step01/events.jsonl'), 'utf8')).includes('disposable-reviewer'));
  await runWorkflow(f.resume, { ...f.deps, agent: forbidden });
});

test('每轮全部修完再推进；第二轮允许继续修复直到解决，随后直接结束而不追加 reviewer', async t => {
  const f = await fixture(t);
  const calls: string[] = [];
  let lastRepairs = 0;
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    const name = reportName(request);
    calls.push(name);
    if (isReview(request)) {
      assert.equal(request.threadId, undefined);
      await request.onEvent({ type: 'thread.started', thread_id: `fresh-${calls.length}` });
      if (name === 'review-02.md.tmp') await readFile(join(f.output, 'step01/repair-01.md'));
      return report(request, '需要修复');
    }
    assert.equal(request.threadId, 'drawing-thread');
    await request.onEvent({ type: 'thread.started', thread_id: 'drawing-thread' });
    await absent(join(f.output, 'step01/.completed'));
    if (name === 'repair-02.md.tmp' && ++lastRepairs === 1) {
      await absent(join(f.output, 'step01/repair-02.md'));
      return report(request, '仍有问题');
    }
    return report(request, '已修复');
  } });
  assert.deepEqual(calls, ['review-01.md.tmp', 'repair-01.md.tmp', 'review-02.md.tmp', 'repair-02.md.tmp', 'repair-02.md.tmp']);
  assert.equal((await readStepSession(f.output, 'step01'))?.threadId, 'drawing-thread');
  await readFile(join(f.output, 'step01/repair-02.md'));
  await absent(join(f.output, 'step01/review-03.md'));
  await readFile(join(f.output, 'step01/.completed'));
  await runWorkflow(f.resume, { ...f.deps, agent: forbidden });
});

test('reviewer 中断不留下正式报告，再启动使用新上下文检查同一个环节', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, undefined);
    await request.onEvent({ type: 'thread.started', thread_id: 'failed-reviewer' });
    await report(request, '通过');
    throw new Error('review stream interrupted');
  } }), /review stream interrupted/);
  await absent(join(f.output, 'step01/review-01.md'));
  await readFile(join(f.output, 'step01/review-01.md.tmp'));
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, undefined);
    assert.equal(reportName(request), 'review-01.md.tmp');
    await absent(join(f.output, 'step01/review-01.md.tmp'));
    await request.onEvent({ type: 'thread.started', thread_id: 'new-reviewer' });
    return report(request, '通过');
  } });
  assert.equal((await readStepSession(f.output, 'step01'))?.threadId, 'drawing-thread');
});

test('正式报告已发布但总步骤标记尚未完成时，恢复只完成标记，不重复调用 agent', async t => {
  const f = await fixture(t);
  await runWorkflow(f.resume, { ...f.deps, agent: request => report(request, '通过') });
  await rename(join(f.output, 'step01/.completed'), join(f.output, 'step01/.running'));
  await runWorkflow(f.resume, { ...f.deps, agent: forbidden });
  await readFile(join(f.output, 'step01/.completed'));
  await absent(join(f.output, 'step01/.running'));
});

test('修复中断保留反馈与已画工程，续跑仍在原 thread 修完后才检查下一次', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '需要修复');
    assert.equal(request.threadId, 'drawing-thread');
    await writeFile(join(f.output, 'step01/clothing-depth.kra'), 'unfinished repair work');
    await report(request, '已修复');
    throw new Error('repair interrupted');
  } }), /repair interrupted/);
  await readFile(join(f.output, 'step01/review-01.md'));
  await absent(join(f.output, 'step01/repair-01.md'));
  const calls: string[] = [];
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    calls.push(reportName(request));
    if (isReview(request)) {
      assert.equal(request.threadId, undefined);
      return report(request, '通过');
    }
    assert.equal(request.threadId, 'drawing-thread');
    assert.equal(await readFile(join(f.output, 'step01/clothing-depth.kra'), 'utf8'), 'unfinished repair work');
    return report(request, '已修复');
  } });
  assert.deepEqual(calls, ['repair-01.md.tmp', 'review-02.md.tmp']);
  await absent(join(f.output, 'step01/repair-02.md'));
});

test('第二次修复受阻不能按次数结束，下次只继续该次修复', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '需要修复');
    if (reportName(request) === 'repair-02.md.tmp') return { status: 'blocked', summary: 'Krita unavailable' };
    return report(request, '已修复');
  } }), /Krita unavailable/);
  await readFile(join(f.output, 'step01/review-02.md'));
  await absent(join(f.output, 'step01/repair-02.md'));
  await readFile(join(f.output, 'step01/.running'));
  await absent(join(f.output, 'step01/.completed'));
  let calls = 0;
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    calls++;
    assert.equal(reportName(request), 'repair-02.md.tmp');
    assert.equal(request.threadId, 'drawing-thread');
    return report(request, '已修复');
  } });
  assert.equal(calls, 1);
  await readFile(join(f.output, 'step01/.completed'));
});

test('修复交付缺失不发布 repair.md，恢复后能继续补齐文件', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '需要修复');
    await rm(join(f.output, 'step01/clothing-depth.kra'));
    return report(request, '已修复');
  } }), /缺少有效交付/);
  await absent(join(f.output, 'step01/repair-01.md'));
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '通过');
    assert.equal(request.threadId, 'drawing-thread');
    await writeFile(join(f.output, 'step01/clothing-depth.kra'), 'repaired composite');
    return report(request, '已修复');
  } });
  await readFile(join(f.output, 'step01/.completed'));
});

test('重新进入初次绘制时清除旧 review 结论，不把修改前的通过报告复用到新交付', async t => {
  const f = await fixture(t);
  await runWorkflow(f.resume, { ...f.deps, agent: request => report(request, '通过') });
  await rename(join(f.output, 'step01/.completed'), join(f.output, 'step01/.running'));
  await rm(join(f.output, 'step01/report.md'));
  let draws = 0, reviews = 0;
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) {
      reviews++;
      return report(request, '通过');
    }
    draws++;
    assert.equal(request.threadId, 'drawing-thread');
    await absent(join(f.output, 'step01/review-01.md'));
    await writeFile(join(f.output, 'step01/report.md.tmp'), 'updated initial delivery');
    return completed;
  } });
  assert.equal(draws, 1);
  assert.equal(reviews, 1);
});

test('缺失、不完整、无法检查的报告以及取消均不发布正式 review Markdown', async t => {
  for (const mode of ['missing', 'invalid', 'unavailable', 'abort'] as const) {
    await t.test(mode, async t => {
      const f = await fixture(t);
      const controller = new AbortController();
      await assert.rejects(runWorkflow({ ...f.resume, signal: controller.signal }, { ...f.deps, agent: async request => {
        if (mode === 'invalid') await writeFile(join(f.output, 'step01', reportName(request)), 'unfinished text');
        if (mode === 'unavailable') await report(request, '无法完成检查');
        if (mode === 'abort') {
          await report(request, '通过');
          controller.abort(new Error('aborted'));
        }
        return completed;
      } }));
      await absent(join(f.output, 'step01/review-01.md'));
      await absent(join(f.output, 'step01/.completed'));
      await readFile(join(f.output, 'step01/.running'));
    });
  }
});

test('step01 返修修改分层文件后中断，续跑保留结构且保留未改动的 KRA', async t => {
  const f = await fixture(t);
  const source = join(dirname(f.output), 'clothing-part-layering');
  const baseline = await readFile(join(f.output, 'step01/clothing-depth.kra'));
  let changed: Record<string, string> = {};
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '需要修复');
    assert.equal(request.threadId, 'drawing-thread');
    changed = await splitStructure(source);
    throw new Error('结构保存后中断');
  } }), /结构保存后中断/);
  await absent(join(f.output, 'step01/repair-01.md'));
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    for (const [file, bytes] of Object.entries(changed)) assert.equal(await readFile(join(source, file), 'utf8'), bytes);
    assert.deepEqual(await readFile(join(f.output, 'step01/clothing-depth.kra')), baseline);
    if (isReview(request)) return report(request, '通过');
    assert.equal(request.threadId, 'drawing-thread');
    return report(request, '已修复');
  } });
  await runWorkflow(f.resume, { ...f.deps, agent: forbidden });
});
