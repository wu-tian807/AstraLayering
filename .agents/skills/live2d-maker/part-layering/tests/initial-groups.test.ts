import {staticPromptPrefix} from '../../shared/tests/prompt-prefix.ts';
import { profile } from '../profile.ts';
import { partKnowledge } from '../../shared/part/group-prompts.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { AgentTask } from '../../shared/codex/agents.ts';
import { formatAgentError } from '../../shared/codex/diagnostics.ts';
import { GroupStore } from '../../shared/part/groups.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { readInitialGroups } from '../../shared/part/part-steps.ts';
import { partSteps } from '../../shared/step-paths.js';
import { readStep } from '../../shared/step-chain.ts';
import type { InitialContext } from '../../shared/part/layering-types.ts';

function initialSteps(agents: Parameters<typeof createLayeringSteps>[0]) {
  return { ...createLayeringSteps(agents), async drawOutline() {
    return { status: 'pending' as const, message: '本测试只验证首次分组' };
  } };
}

async function fixture(t: TestContext): Promise<InitialContext> {
  const root = await mkdtemp(join(tmpdir(), 'part-layering-initial-')), directory = join(root, 'part-layering');
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(directory);
  return { profile, directory, references: {
    directory: join(directory, 'references'),
    simplifiedSubject: join(directory, 'references/simplified-subject.png'), baseSubject: join(directory, 'references/base-subject.png'),
  } };
}

const wingGroups = {
  groups: [
    { name: 'left_wing', groups: [], note: '主体左翼' },
    { name: 'right_wing', groups: [], note: null },
  ],
};

async function saveGrouping(task: AgentTask, value: unknown = wingGroups) {
  const tool = task.tools!.find(tool => tool.name === 'write_groups')!;
  return tool.execute(value, new AbortController().signal);
}

test('首次识别一次调用，绑定 view_bitmap 和 write_groups；直接保存正式分组，忽略最终回复', async t => {
  const context = await fixture(t);
  context.references.baseSubject = 'references/base-subject.png';
  const calls: AgentTask[] = [];
  const steps = initialSteps({ async run(task) {
    calls.push(task);
    await saveGrouping(task);
    return { text: '保存完成。这不是 JSON。', images: [] };
  } });
  const result = await steps.initialGroups(context);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, '首次分组识别');
  assert.equal(calls[0].cwd, context.directory);
  assert.ok(calls[0].prompt.startsWith(staticPromptPrefix(await readFile(partKnowledge(profile, 'initial').files('main')[0], 'utf8'))));
  assert.ok(calls[0].prompt.includes(`素体参考图：${join(context.directory, 'references/base-subject.png')}`));
  assert.equal(calls[0].outputSchema, undefined);
  assert.deepEqual(calls[0].tools!.map(tool => tool.name), ['view_bitmap', 'write_groups']);
  assert.match(calls[0].tools!.find(tool => tool.name === 'view_bitmap')!.description, /crop=.*scale/);
  assert.deepEqual(result, { status: 'completed', output: {
    groups: [
      { id: 'left_wing', name: 'left_wing', note: '主体左翼' },
      { id: 'right_wing', name: 'right_wing' },
    ],
  } });
  assert.deepEqual(await readInitialGroups(context.directory), result.output);
  assert.ok(!(await readdir(context.directory)).includes('initial-groups'));
});

test('null 且组为空接入真实识别适配器，结果原子保存，旧文件续跑不再识别', async t => {
  const context = await fixture(t);
  let calls = 0;
  const steps = initialSteps({ async run(task) {
    calls++;
    await saveGrouping(task);
    return { text: 'ok', images: [] };
  } });
  const result = await runLayering({ ...context, groups: null, steps });
  assert.equal(calls, 1);
  assert.equal(result.status, 'pending');
  const state = (await GroupStore.open(context.directory)).snapshot();
  assert.ok(!('initial' in state));
  assert.deepEqual(state.groups.map(group => group.id), ['left_wing', 'right_wing']);
  assert.ok(!('mirror_pairs' in state));
  assert.ok(state.groups.every(group => group.groups.length === 0 && group.steps.outline.status === 'pending'));
  const legacy = JSON.parse(await readFile(result.groupsPath, 'utf8'));
  legacy.mirror_pairs = [{ name: 'old_pair', members: ['left_wing', 'removed_group'] }];
  await writeFile(result.groupsPath, JSON.stringify(legacy));
  await runLayering({ ...context, groups: null, steps });
  assert.equal(calls, 1);
  const resumed = (await GroupStore.open(context.directory)).snapshot();
  assert.deepEqual(resumed.groups, state.groups);
  assert.ok(!('mirror_pairs' in JSON.parse(await readFile(result.groupsPath, 'utf8'))));
});

test('写入工具拒绝空组、深入拆分、part、进度、无效名称和重复 ID，不污染文件', async t => {
  const invalid = [
    { ...wingGroups, groups: [] },
    { ...wingGroups, groups: [{ name: 'head', groups: [{ name: 'face', groups: [] }], note: null }] },
    { ...wingGroups, groups: [{ name: 'head', groups: [], parts: [], note: null }] },
    { ...wingGroups, groups: [{ name: 'head', groups: [], kind: 'part', note: null }] },
    { ...wingGroups, groups: [{ name: 'Head', groups: [], note: null }] },
    { ...wingGroups, groups: [wingGroups.groups[0], wingGroups.groups[0]] },
    { ...wingGroups, subject: 'other' },
    { ...wingGroups, initial: { status: 'completed' } },
    { ...wingGroups, groups: [{ name: 'head', groups: [], steps: {}, note: null }] },
  ];
  for (const value of invalid) {
    const context = await fixture(t);
    let calls = 0;
    const steps = initialSteps({ async run(task) {
      calls++;
      await saveGrouping(task, value);
      return { text: 'ok', images: [] };
    } });
    await assert.rejects(steps.initialGroups(context));
    assert.equal(calls, 1);
    assert.deepEqual(await readdir(context.directory), []);
  }
});

test('首次分组失败不留下组，续跑仍可重新识别', async t => {
  const context = await fixture(t);
  const steps = initialSteps({ async run(task) {
    await saveGrouping(task, { groups: [] });
    return { text: 'ok', images: [] };
  } });
  await assert.rejects(runLayering({ ...context, groups: null, steps }), /非空/);
  const state = (await GroupStore.open(context.directory)).snapshot();
  assert.ok(!('initial' in state));
  assert.deepEqual(state.groups, []);
  const resumed = await runLayering({ ...context, groups: null, steps: initialSteps({ async run(task) {
    await saveGrouping(task);
    return { text: 'ok', images: [] };
  } }) });
  assert.equal(resumed.groups.length, 2);
});

test('只在最终回复给 JSON 仍失败，未调用写入工具不能记成功', async t => {
  const context = await fixture(t);
  const steps = initialSteps({ async run() {
    return { text: JSON.stringify(wingGroups), images: [] };
  } });
  await assert.rejects(steps.initialGroups(context), /未通过 write_groups/);
  assert.deepEqual(await readdir(context.directory), ["step08_initial"]); // only the repair records
});

test('part 缺少正式提交时展示模型的最后说明和 threadId', async t => {
  const context = await fixture(t);
  const steps = initialSteps({ async run() {
    return { text: '没有可用的图片工具，无法继续处理参考图。', images: [], threadId: 'part-diagnostic-thread' };
  } });
  await assert.rejects(steps.initialGroups(context), error => {
    const message = formatAgentError(error);
    assert.match(message, /未通过 write_groups/);
    assert.match(message, /没有可用的图片工具/);
    assert.match(message, /part-diagnostic-thread/);
    return true;
  });
  assert.deepEqual(await readdir(context.directory), ["step08_initial"]); // only the repair records
});

test('工具报错可修正参数后提交；重复提交不能覆盖已有组', async t => {
  const context = await fixture(t);
  const steps = initialSteps({ async run(task) {
    await assert.rejects(saveGrouping(task, { ...wingGroups, groups: [] }), /非空/);
    await saveGrouping(task);
    const before = await readFile(join(context.directory, partSteps.initial, 'groups.json'), 'utf8');
    await assert.rejects(saveGrouping(task, { groups: [{ name: 'head', groups: [], note: null }] }), /不能覆盖/);
    assert.equal(await readFile(join(context.directory, partSteps.initial, 'groups.json'), 'utf8'), before);
    return { text: 'ok', images: [] };
  } });
  const result = await runLayering({ ...context, groups: null, steps });
  assert.deepEqual(result.groups.map(group => group.id), ['left_wing', 'right_wing']);
});

test('工具已保存分组后回合失败，续跑仍跳过已完成识别', async t => {
  const context = await fixture(t);
  const steps = initialSteps({ async run(task) {
    await saveGrouping(task);
    throw new Error('回合中断');
  } });
  await assert.rejects(runLayering({ ...context, groups: null, steps }), /回合中断/);
  assert.equal((await readStep(join(context.directory, partSteps.initial))).status, 'running');
  assert.equal((await readInitialGroups(context.directory)).groups.length, 2);
  await runLayering({ ...context, groups: null, steps: initialSteps({ async run() { assert.fail('不应重做首次识别'); } }) });
});
