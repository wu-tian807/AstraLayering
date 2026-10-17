import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { AgentRequest, StepResult } from '../agent.ts';
import { steps, type StepDefinition } from '../steps.ts';
import { runWorkflow } from '../workflow.ts';

const completed: StepResult = { status: 'completed', summary: 'fixture completed' };
const forbidden = async (): Promise<never> => assert.fail('unexpected model call');
const preflight = async (executable: string) => ({ executable, version: 'fixture' });
const config = async (directory: string) => JSON.parse(await readFile(join(directory, 'run.json'), 'utf8'));
async function absent(path: string) { await assert.rejects(readFile(path), { code: 'ENOENT' }); }
const isReview = (request: AgentRequest) => request.prompt.startsWith('你负责对第二步交付');
function reportName(request: AgentRequest): string {
  const name = request.prompt.match(/step02\/((?:review|repair)-\d{2}\.md\.tmp)/)?.[1];
  assert.ok(name, 'a single concrete output filename must be injected');
  return name;
}
async function report(request: AgentRequest, conclusion: string) {
  await writeFile(join(request.directory, 'step02', reportName(request)), `结论：${conclusion}\n\n逐项检查和处理证据。\n`);
  return completed;
}
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'raster-review-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'source'), runsDirectory = join(directory, 'runs');
  await mkdir(join(input, 'parts'), { recursive: true });
  await writeFile(join(input, 'parts/part.svg'), 'fixture');
  const options = { name: 'test', input, krita: process.execPath };
  const deps = { preflight, runsDirectory, steps: steps.slice(0, 2) };
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
  return { directory, output: join(runsDirectory, 'test'), options, resume: { name: 'test' }, deps };
}

test('旧第二步交付直接补 review；无问题时一次结束，reviewer ID 不覆盖或保存为主上下文', async t => {
  const f = await fixture(t);
  const original = await readFile(join(f.output, 'step02/clothing-soft-edges.kra'));
  let calls = 0;
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    calls++;
    assert.ok(isReview(request));
    assert.equal(request.threadId, undefined);
    assert.equal(request.model, 'gpt-6-astra');
    assert.equal(request.effort, 'xhigh');
    assert.ok(!/第一轮|第二轮|最多|两轮|\{\w+\}/.test(request.prompt));
    await readFile(join(f.output, 'step02/.running'));
    await absent(join(f.output, 'step02/.completed'));
    await request.onEvent({ type: 'thread.started', thread_id: 'disposable-reviewer' });
    assert.equal((await config(f.output)).threadId, 'drawing-thread');
    return report(request, '通过');
  } });
  assert.equal(calls, 1);
  assert.deepEqual(await readFile(join(f.output, 'step02/clothing-soft-edges.kra')), original);
  await readFile(join(f.output, 'step02/review-01.md'));
  await absent(join(f.output, 'step02/review-01.md.tmp'));
  await absent(join(f.output, 'step02/repair-01.md'));
  await absent(join(f.output, 'step02/review-02.md'));
  await readFile(join(f.output, 'step02/.completed'));
  assert.ok(!(await readFile(join(f.output, 'step02/events.jsonl'), 'utf8')).includes('disposable-reviewer'));
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
      if (name === 'review-02.md.tmp') await readFile(join(f.output, 'step02/repair-01.md'));
      return report(request, '需要修复');
    }
    assert.equal(request.threadId, 'drawing-thread');
    await request.onEvent({ type: 'thread.started', thread_id: 'drawing-thread' });
    await absent(join(f.output, 'step02/.completed'));
    if (name === 'repair-02.md.tmp' && ++lastRepairs === 1) {
      await absent(join(f.output, 'step02/repair-02.md'));
      return report(request, '仍有问题');
    }
    return report(request, '已修复');
  } });
  assert.deepEqual(calls, ['review-01.md.tmp', 'repair-01.md.tmp', 'review-02.md.tmp', 'repair-02.md.tmp', 'repair-02.md.tmp']);
  assert.equal((await config(f.output)).threadId, 'drawing-thread');
  await readFile(join(f.output, 'step02/repair-02.md'));
  await absent(join(f.output, 'step02/review-03.md'));
  await readFile(join(f.output, 'step02/.completed'));
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
  await absent(join(f.output, 'step02/review-01.md'));
  await readFile(join(f.output, 'step02/review-01.md.tmp'));
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, undefined);
    assert.equal(reportName(request), 'review-01.md.tmp');
    await absent(join(f.output, 'step02/review-01.md.tmp'));
    await request.onEvent({ type: 'thread.started', thread_id: 'new-reviewer' });
    return report(request, '通过');
  } });
  assert.equal((await config(f.output)).threadId, 'drawing-thread');
});

test('正式报告已发布但总步骤标记尚未完成时，恢复只完成标记，不重复调用 agent', async t => {
  const f = await fixture(t);
  await runWorkflow(f.resume, { ...f.deps, agent: request => report(request, '通过') });
  await rename(join(f.output, 'step02/.completed'), join(f.output, 'step02/.running'));
  await runWorkflow(f.resume, { ...f.deps, agent: forbidden });
  await readFile(join(f.output, 'step02/.completed'));
  await absent(join(f.output, 'step02/.running'));
});

test('修复中断保留反馈与已画工程，续跑仍在原 thread 修完后才检查下一次', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '需要修复');
    assert.equal(request.threadId, 'drawing-thread');
    await writeFile(join(f.output, 'step02/clothing-soft-edges.kra'), 'unfinished repair work');
    await report(request, '已修复');
    throw new Error('repair interrupted');
  } }), /repair interrupted/);
  await readFile(join(f.output, 'step02/review-01.md'));
  await absent(join(f.output, 'step02/repair-01.md'));
  const calls: string[] = [];
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    calls.push(reportName(request));
    if (isReview(request)) {
      assert.equal(request.threadId, undefined);
      return report(request, '通过');
    }
    assert.equal(request.threadId, 'drawing-thread');
    assert.equal(await readFile(join(f.output, 'step02/clothing-soft-edges.kra'), 'utf8'), 'unfinished repair work');
    return report(request, '已修复');
  } });
  assert.deepEqual(calls, ['repair-01.md.tmp', 'review-02.md.tmp']);
  await absent(join(f.output, 'step02/repair-02.md'));
});

test('第二次修复受阻不能按次数结束，下次只继续该次修复', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '需要修复');
    if (reportName(request) === 'repair-02.md.tmp') return { status: 'blocked', summary: 'Krita unavailable' };
    return report(request, '已修复');
  } }), /Krita unavailable/);
  await readFile(join(f.output, 'step02/review-02.md'));
  await absent(join(f.output, 'step02/repair-02.md'));
  await readFile(join(f.output, 'step02/.running'));
  await absent(join(f.output, 'step02/.completed'));
  let calls = 0;
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    calls++;
    assert.equal(reportName(request), 'repair-02.md.tmp');
    assert.equal(request.threadId, 'drawing-thread');
    return report(request, '已修复');
  } });
  assert.equal(calls, 1);
  await readFile(join(f.output, 'step02/.completed'));
});

test('修复交付缺失不发布 repair.md，恢复后能继续补齐文件', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '需要修复');
    await rm(join(f.output, 'step02/clothing-soft-edges.kra'));
    return report(request, '已修复');
  } }), /缺少有效交付/);
  await absent(join(f.output, 'step02/repair-01.md'));
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) return report(request, '通过');
    assert.equal(request.threadId, 'drawing-thread');
    await writeFile(join(f.output, 'step02/clothing-soft-edges.kra'), 'repaired composite');
    return report(request, '已修复');
  } });
  await readFile(join(f.output, 'step02/.completed'));
});

test('删除 review 报告只重启检查及后续反馈，保留工程和绘制 thread，并使后续步骤失效', async t => {
  const f = await fixture(t);
  await runWorkflow(f.resume, { ...f.deps, agent: request => report(request, '通过') });
  await rm(join(f.output, 'step02/review-01.md'));
  await writeFile(join(f.output, 'step02/repair-01.md'), '结论：已修复\n\nstale');
  await writeFile(join(f.output, 'step02/review-02.md'), '结论：通过\n\nstale');
  await mkdir(join(f.output, 'step03'));
  await writeFile(join(f.output, 'step03/.completed'), '');
  const original = await readFile(join(f.output, 'step02/clothing-soft-edges.kra'));
  const before = await readFile(join(f.output, 'run.json'));
  const dryPrompt = await runWorkflow({ ...f.resume, dryRun: true }, { ...f.deps, agent: forbidden });
  assert.ok(dryPrompt.startsWith('你负责对第二步交付'));
  assert.ok(dryPrompt.includes('step02/review-01.md.tmp'));
  await readFile(join(f.output, 'step02/.completed'));
  await readFile(join(f.output, 'step02/repair-01.md'));
  assert.deepEqual(await readFile(join(f.output, 'run.json')), before);
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    assert.equal(reportName(request), 'review-01.md.tmp');
    await absent(join(f.output, 'step02/repair-01.md'));
    await absent(join(f.output, 'step02/review-02.md'));
    await assert.rejects(readdir(join(f.output, 'step03')), { code: 'ENOENT' });
    assert.equal((await config(f.output)).threadId, 'drawing-thread');
    assert.deepEqual(await readFile(join(f.output, 'step02/clothing-soft-edges.kra')), original);
    return report(request, '通过');
  } });
});

test('重新进入初次绘制时清除旧 review 结论，不把修改前的通过报告复用到新交付', async t => {
  const f = await fixture(t);
  await runWorkflow(f.resume, { ...f.deps, agent: request => report(request, '通过') });
  await rename(join(f.output, 'step02/.completed'), join(f.output, 'step02/.running'));
  await rm(join(f.output, 'step02/report.md'));
  let draws = 0, reviews = 0;
  await runWorkflow(f.resume, { ...f.deps, agent: async request => {
    if (isReview(request)) {
      reviews++;
      return report(request, '通过');
    }
    draws++;
    assert.equal(request.threadId, 'drawing-thread');
    await absent(join(f.output, 'step02/review-01.md'));
    await writeFile(join(f.output, 'step02/report.md.tmp'), 'updated initial delivery');
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
        if (mode === 'invalid') await writeFile(join(f.output, 'step02', reportName(request)), 'unfinished text');
        if (mode === 'unavailable') await report(request, '无法完成检查');
        if (mode === 'abort') {
          await report(request, '通过');
          controller.abort(new Error('aborted'));
        }
        return completed;
      } }));
      await absent(join(f.output, 'step02/review-01.md'));
      await absent(join(f.output, 'step02/.completed'));
      await readFile(join(f.output, 'step02/.running'));
    });
  }
});
