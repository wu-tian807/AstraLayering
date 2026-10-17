import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWorkflow, type ReadyGroup } from '../workflow.ts';
import { AgentRuntime } from '../agent-runtime.ts';

test('null 输入按前置、初始化、扫描的顺序交给钩子', async () => {
  const events: unknown[] = [];
  await runWorkflow(null, {
    async preparation() { events.push('preparation'); },
    async initialize(input) { events.push(input); },
    async ready() { events.push('ready'); return []; },
    async runRound() { assert.fail('没有待执行组时不应启动任务'); },
  });
  assert.deepEqual(events, ['preparation', null, 'ready']);
});

test('全部就绪组进入队列且同 ID 不重复，实际并发只受 agent runtime 限制', { timeout: 5000 }, async () => {
  const groups: ReadyGroup<number>[] = Array.from({ length: 29 }, (_, group) => ({ id: String(group), group, depth: 0 }));
  const calls: number[] = [];
  const runtime = new AgentRuntime(3);
  const release = Promise.withResolvers<void>();
  const allQueued = Promise.withResolvers<void>();
  let active = 0;
  let peak = 0;
  const workflow = runWorkflow(groups.map(item => item.group), {
    async initialize() {},
    async ready() { return groups; },
    async runRound(group) {
      calls.push(group);
      if (calls.length === groups.length) allQueued.resolve();
      await runtime.run(async () => {
        active++;
        peak = Math.max(peak, active);
        await release.promise;
        active--;
      });
    },
  });
  try {
    await allQueued.promise;
    assert.equal(active, 3);
    assert.equal(calls.length, 29);
  } finally { release.resolve(); }
  await workflow;
  assert.equal(peak, 3);
  assert.deepEqual(calls, groups.map(item => item.group));
});

test('已有组可以由 ready 根据完成状态筛选，调度器不重置输入', async () => {
  const input = [{ id: 'done', completed: true }, { id: 'pending', completed: false }];
  const calls: string[] = [];
  await runWorkflow(input, {
    async initialize(groups) { assert.equal(groups, input); },
    async ready() {
      return input.filter(group => !group.completed).map(group => ({ id: group.id, group, depth: 0 }));
    },
    async runRound(group) { calls.push(group.id); group.completed = true; },
  });
  assert.deepEqual(calls, ['pending']);
});

test('依赖满足的子组可在其他根组运行时补位，浅层待办优先且无需预先排序', { timeout: 5000 }, async () => {
  const items: ReadyGroup<string>[] = [
    { id: 'grandchild', group: 'grandchild', depth: 2 },
    { id: 'child_a', group: 'child_a', depth: 1 },
    { id: 'root_fast', group: 'root_fast', depth: 0 },
    { id: 'root_slow', group: 'root_slow', depth: 0 },
    { id: 'child_b', group: 'child_b', depth: 1 },
    { id: 'root_extra', group: 'root_extra', depth: 0 },
  ];
  const parents: Record<string, string> = { child_a: 'root_fast', child_b: 'root_slow', grandchild: 'child_a' };
  const completed = new Set<string>();
  const calls: string[] = [];
  const slow = Promise.withResolvers<void>();
  const grandchildStarted = Promise.withResolvers<void>();
  const workflow = runWorkflow(null, {
    async initialize() {},
    async ready() {
      return items.filter(item => !completed.has(item.id) && (!parents[item.id] || completed.has(parents[item.id])));
    },
    async runRound(group) {
      if (parents[group]) assert.ok(completed.has(parents[group]));
      calls.push(group);
      if (group === 'grandchild') grandchildStarted.resolve();
      if (group === 'root_slow') await slow.promise;
      else await Promise.resolve();
      completed.add(group);
    },
  });
  try {
    await grandchildStarted.promise;
    assert.deepEqual(calls, ['root_fast', 'root_slow', 'root_extra', 'child_a', 'grandchild']);
    assert.equal(completed.has('root_slow'), false);
  } finally { slow.resolve(); }
  await workflow;
  assert.deepEqual(calls, ['root_fast', 'root_slow', 'root_extra', 'child_a', 'grandchild', 'child_b']);
});

test('父组仍未完成时子组不进入待办，续跑完成父组后才放行', async () => {
  const items: ReadyGroup<string>[] = [
    { id: 'parent', group: 'parent', depth: 0 }, { id: 'child', group: 'child', depth: 1 },
  ];
  const completed = new Set<string>();
  const calls: string[] = [];
  const hooks = {
    async initialize() {},
    async ready() { return items.filter(item => !completed.has(item.id) && (item.id !== 'child' || completed.has('parent'))); },
    async runRound(group: string) { calls.push(group); },
  };
  await runWorkflow(null, hooks);
  assert.deepEqual(calls, ['parent']);
  calls.length = 0;
  await runWorkflow(null, { ...hooks, async runRound(group) { calls.push(group); completed.add(group); } });
  assert.deepEqual(calls, ['parent', 'child']);
});

test('并发失败后停止新派发，并等待已启动组结束', async () => {
  const calls: number[] = [];
  let release!: () => void;
  const running = new Promise<void>(resolve => { release = resolve; });
  let signalFailure!: () => void;
  const failed = new Promise<void>(resolve => { signalFailure = resolve; });
  let otherFinished = false;
  const workflow = runWorkflow(null, {
    async initialize() {},
    async ready() { return (otherFinished ? [0, 1, 2] : [0, 1]).map(group => ({ id: String(group), group, depth: 0 })); },
    async runRound(group) {
      calls.push(group);
      if (group === 0) { signalFailure(); throw new Error('测试失败'); }
      await running;
      otherFinished = true;
    },
  });
  const rejection = assert.rejects(workflow, /测试失败/);
  await failed;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [0, 1]);
  assert.equal(otherFinished, false);
  release();
  await rejection;
  assert.equal(otherFinished, true);
});

test('无效深度值在执行前置前被拒绝', async () => {
  for (const maxDepth of [0, -1, 1.5, NaN]) {
    await assert.rejects(runWorkflow(null, {
      async preparation() { assert.fail('参数无效时不应开始前置'); },
      async initialize() {}, async ready() { return []; }, async runRound() {},
    }, { maxDepth }), /maxDepth must be a positive integer/);
  }
});
