import { rasterAppServer } from './raster-app-server.ts';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { normalizeGroups } from '../part/groups.ts';
import { createSvgPreviewTool, type SvgObservation } from '../part/svg-tools.ts';
import { reviewGroupOutline } from '../part/outline-agent.ts';
import { runAgent } from '../raster/agent.ts';
import { AgentRuntime } from '../agents/runtime.ts';
import { profile as character } from '../../part-layering/profile.ts';
import { profile as clothing } from '../../clothing-part-layering/profile.ts';
import { fixture, shape } from '../../part-layering/tests/layering-fixture.ts';

test('分组进度拒绝数组状态', () => {
  for (const status of ['pending', 'running', 'completed', 'failed']) {
    assert.throws(() => normalizeGroups([{ id: 'head', steps: {
      outline: { status: [status], output: { path: 'head.svg' } },
    } }]), /invalid status/);
  }
});

test('SVG 预览拒绝数组模式，不产生与请求不符的图片或观察记录', async t => {
  const f = await fixture(t), path = join(f.directory, 'head.svg');
  await writeFile(path, shape('head'));
  const observations: SvgObservation[] = [];
  const preview = createSvgPreviewTool({ directory: f.directory, reference: f.references.baseSubject,
    canvas: { width: 100, height: 100 }, observationDirectory: join(f.directory, 'observations'),
    observed: item => observations.push(item),
  });
  const signal = new AbortController().signal;
  for (const mode of ['svg', 'blend', 'edge']) {
    await assert.rejects(preview.execute({ path, mode: [mode] }, signal), /无效 mode/);
  }
  assert.equal(observations.length, 0);
  await preview.execute({ path, mode: 'blend' }, signal);
  assert.equal(observations[0].mode, 'blend');
});

test('review 拒绝非字符串结论，允许修正参数后正常提交且不写坏报告', async t => {
  for (const profile of [character, clothing]) {
    const f = await fixture(t), path = join(f.directory, 'head.svg'), reportPath = join(f.directory, 'review.json');
    await writeFile(path, shape('head'));
    const group = normalizeGroups([{ id: 'head' }])[0];
    const result = await reviewGroupOutline({ ...f, profile, group, outline: { path }, reportPath }, {
      async run(task) {
        const signal = new AbortController().signal;
        await task.tools!.find(tool => tool.name === 'preview_svg')!.execute({ path, mode: 'blend' }, signal);
        const submit = task.tools!.find(tool => tool.name === 'submit_review')!;
        for (const verdict of ['pass', 'revise', 'blocked']) {
          await assert.rejects(submit.execute({ verdict: [verdict], feedback: '已逐处核对' }, signal), /无效审查结论/);
        }
        await assert.rejects(readFile(reportPath), { code: 'ENOENT' });
        await submit.execute({ verdict: 'pass', feedback: '已逐处核对' }, signal);
        return { text: '完成', images: [] };
      },
    });
    assert.equal(result.status, 'completed');
    assert.deepEqual(JSON.parse(await readFile(reportPath, 'utf8')).reviews.map((item: { verdict: string }) => item.verdict), ['pass']);
  }
});

test('raster 拒绝数组完成状态，返回格式错误不进入临时服务重试', async t => {
  const execute = async (status: unknown) => {
    const server = await rasterAppServer(t, JSON.stringify({ status, summary: '步骤结果' }));
    return runAgent({ prompt: 'test', directory: server.directory, model: 'gpt-6.1-sol', effort: 'xhigh', environment: server.environment,
      onEvent: async () => {} }, new AgentRuntime(1, async () => assert.fail('invalid result must not retry')));
  };
  for (const status of ['completed', 'blocked']) {
    await assert.rejects(execute([status]), /未返回有效/);
    assert.equal((await execute(status)).status, status);
  }
});
