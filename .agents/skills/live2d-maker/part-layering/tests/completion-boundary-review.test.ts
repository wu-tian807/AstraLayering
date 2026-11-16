import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { test } from 'node:test';
import type { AgentTask } from '../../shared/agents/dispatcher.ts';
import { completeGroupOcclusion, checkGroupCompletion } from '../../shared/part/completion-agent.ts';
import { normalizeGroups } from '../../shared/part/groups.ts';
import { assertCompletionPreserves } from '../../shared/part/completion-svg.ts';
import { groupStepId } from '../../shared/part/part-steps.ts';
import { fixture as characterFixture, shape, publishGroups } from './layering-fixture.ts';
import { fixture as clothingFixture } from '../../clothing-part-layering/tests/layering-fixture.ts';
import { promptInput } from '../../shared/tests/prompt-input.ts';

const signal = new AbortController().signal;
const additions = [{ d: 'M5 40H25V60H5Z' }];
const tool = (task: AgentTask, name: string) => task.tools!.find(t => t.name === name)!;
async function view(task: AgentTask, path: string) {
  await tool(task, 'preview_svg').execute({ path, mode: 'blend' }, signal);
  await tool(task, 'preview_svg').execute({ path, mode: 'svg' }, signal);
}
async function review(task: AgentTask, allow = true) {
  assert.equal(task.shell, false);
  assert.ok(!task.tools!.some(t => t.name === 'imagegen' || t.name === 'set_completion_paths'));
  const input = promptInput(task.prompt);
  await view(task, input.candidate);
  await tool(task, 'preview_svg').execute({ path: input.parent, mode: 'svg' }, signal);
  await tool(task, 'view_bitmap').execute({ path: input.outsideReference }, signal);
  await tool(task, 'submit_completion_boundary_review').execute({ allow, note: allow ? '本件被主体遮住的连续范围，原边缘和真实开口保留。' : '申请将真实开隙填成了本件，须在父范围内修正。' }, signal);
}
const submit = (task: AgentTask, reason?: string) => tool(task, 'submit_completion').execute({ note: '已核对连续形体', ...(reason ? { outsideParentReason: reason } : {}) }, signal);

for (const section of ['character', 'clothing'] as const) {
  const make = section === 'character' ? characterFixture : clothingFixture;
  async function context(t: Parameters<typeof make>[0], flag = false, id = 'head/child') {
    const f = await make(t);
    await writeFile(join(f.directory, 'groups.json'), JSON.stringify({ groups: [{ id: 'head', groups: [{ id, kind: 'part', allowOutsideParent: flag }] }] }));
    const group = normalizeGroups([{ id, kind: 'part', allowOutsideParent: flag }])[0];
    const source = join(f.directory, 'source.svg'), parentPath = join(f.directory, 'parent.svg');
    await writeFile(source, shape(id, 20, 80)); await writeFile(parentPath, shape('head', 10, 90));
    const parent = normalizeGroups([{ id: 'head', steps: { completion: { status: 'completed', output: { path: parentPath } } } }])[0];
    return { ...f, group, parent, reviewed: { path: source }, outputPath: join(f.directory, 'completion.draft.svg') };
  }

  test(`${section}: reviewer CLI workspace stays shallow for deeply nested groups`, async t => {
    const c = await context(t, false, 'head/' + Array(12).fill('nested_group').join('/') + '/child');
    await completeGroupOcclusion(c, { async run(task) {
      await tool(task, 'set_completion_paths').execute({ paths: additions }, signal);
      await view(task, c.outputPath); await submit(task, 'Hidden continuous structure.'); return { text: '', images: [] };
    } }, { async run(task) {
      assert.equal(dirname(task.outputDirectory!), join(c.directory, 'step11_completion', 'boundary-review'));
      assert.equal(basename(task.outputDirectory!).length, 64);
      await review(task); return { text: '', images: [] };
    } });
  });

  test(`${section}: edits after submission must be observed and reviewed again before publication`, async t => {
    const c = await context(t); let turns = 0, reviews = 0;
    const result = await completeGroupOcclusion(c, { async run(task) {
      turns++;
      if (turns === 1) await tool(task, 'set_completion_paths').execute({ paths: additions }, signal);
      await view(task, c.outputPath); await submit(task, 'Hidden continuous structure.');
      if (turns === 1) {
        const bytes = await readFile(c.outputPath, 'utf8');
        await writeFile(c.outputPath, bytes.replace('M5 40H25V60H5Z', 'M4 40H25V60H4Z'));
      }
      return { text: '', images: [] };
    } }, { async run(task) { reviews++; await review(task); return { text: '', images: [] }; } });
    assert.equal(result.path, c.outputPath); assert.equal(turns, 2); assert.equal(reviews, 2);
  });

  test(`${section}: in-parent submission does not invoke the reviewer`, async t => {
    const c = await context(t); let reviews = 0;
    await completeGroupOcclusion(c, { async run(task) { await view(task, c.outputPath); await submit(task, 'unneeded request'); return { text: '', images: [] }; } },
      { async run() { reviews++; assert.fail('in-parent must not be reviewed'); } });
    assert.equal(reviews, 0);
  });

  test(`${section}: legacy grouping permission cannot bypass submission review; rejected drafts stay repairable`, async t => {
    const c = await context(t, true);
    const result = await completeGroupOcclusion(c, { async run(task) {
      const set = await tool(task, 'set_completion_paths').execute({ paths: additions }, signal);
      const detail = JSON.parse(set.contentItems.find(x => x.type === 'inputText')!.text);
      assert.equal(detail.bounds.status, 'fail');
      await view(task, c.outputPath);
      await assert.rejects(submit(task), /默认不允许/);
      assert.equal(assertCompletionPreserves(await readFile(c.reviewed.path, 'utf8'), await readFile(c.outputPath, 'utf8')), 1);
      await tool(task, 'set_completion_paths').execute({ paths: [] }, signal);
      await view(task, c.outputPath); await submit(task);
      return { text: '', images: [] };
    } }, { async run() { assert.fail('no request, no review'); } });
    assert.equal(await readFile(result.path, 'utf8'), await readFile(c.reviewed.path, 'utf8'));
  });

  test(`${section}: requested exception invokes an independent reviewer and can be published`, async t => {
    const c = await context(t); let reviews = 0;
    const result = await completeGroupOcclusion(c, { async run(task) {
      await tool(task, 'set_completion_paths').execute({ paths: additions }, signal); await view(task, c.outputPath); await submit(task, '连接被主体遮住的两端'); return { text: '', images: [] };
    } }, { async run(task) { reviews++; assert.equal(task.step, section === 'character' ? 'part_completion_boundary_review' : 'clothing_completion_boundary_review'); await review(task); return { text: '', images: [] }; } });
    assert.equal(reviews, 1);
    assert.equal(assertCompletionPreserves(await readFile(c.reviewed.path, 'utf8'), await readFile(result.path, 'utf8')), 1);
    assert.equal((await checkGroupCompletion({ ...c, before: c.reviewed, after: result })).passed, true);
    const dir = join(c.directory, groupStepId(c.group.id, 'completion'), 'boundary-reviews');
    const keys = await readdir(dir); assert.equal(keys.length, 1);
    const record = JSON.parse(await readFile(join(dir, keys[0], 'decision.json'), 'utf8'));
    assert.equal(record.decision.allow, true);
    assert.equal(record.hashes.candidate.length, 64);
  });

  test(`${section}: a refusal returns to the drawing turn, identical resubmission reuses it, repair can succeed`, async t => {
    const c = await context(t); let reviews = 0;
    await completeGroupOcclusion(c, { async run(task) {
      await tool(task, 'set_completion_paths').execute({ paths: additions }, signal); await view(task, c.outputPath);
      await assert.rejects(submit(task, 'first reason'), /真实开隙/);
      await assert.rejects(submit(task, 'a different explanation'), /真实开隙/);
      await tool(task, 'set_completion_paths').execute({ paths: [] }, signal); await view(task, c.outputPath); await submit(task);
      return { text: '', images: [] };
    } }, { async run(task) { reviews++; await review(task, false); return { text: '', images: [] }; } });
    assert.equal(reviews, 1);
  });

  test(`${section}: interruption preserves the draft and approval; continuation does not review the same draft again`, async t => {
    const c = await context(t); let reviews = 0;
    const reviewer = { async run(task: AgentTask) { reviews++; await review(task); return { text: '', images: [] }; } };
    await assert.rejects(completeGroupOcclusion(c, { async run(task) {
      await tool(task, 'set_completion_paths').execute({ paths: additions }, signal); await view(task, c.outputPath); await submit(task, 'hidden continuity'); throw new Error('interrupted after tool');
    } }, reviewer), /interrupted/);
    const draft = await readFile(c.outputPath, 'utf8');
    await completeGroupOcclusion({ ...c, resumeDraft: true }, { async run(task) {
      assert.equal(await readFile(c.outputPath, 'utf8'), draft); await view(task, c.outputPath); await submit(task, 'hidden continuity'); return { text: '', images: [] };
    } }, reviewer);
    assert.equal(reviews, 1);
    await completeGroupOcclusion(c, { async run(task) {
      await tool(task, 'set_completion_paths').execute({ paths: [{ d: 'M4 40H25V60H4Z' }] }, signal); await view(task, c.outputPath); await submit(task, 'changed shape'); return { text: '', images: [] };
    } }, reviewer);
    assert.equal(reviews, 2);
  });

  test(`${section}: changes to original inputs during review cannot authorize the draft`, async t => {
    const c = await context(t);
    await assert.rejects(completeGroupOcclusion(c, { async run(task) {
      await tool(task, 'set_completion_paths').execute({ paths: additions }, signal); await view(task, c.outputPath); await submit(task, 'hidden continuity'); return { text: '', images: [] };
    } }, { async run(task) {
      await review(task); await writeFile(c.parent.steps.completion.output!.path, shape('head', 12, 90)); return { text: '', images: [] };
    } }), /输入或草稿变化/);
  });
}
