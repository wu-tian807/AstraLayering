import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runLayering } from '../../shared/part/layering.ts';
import * as character from './layering-fixture.ts';
import * as clothing from '../../clothing-part-layering/tests/layering-fixture.ts';

// Both sections share the scheduler, but keep their own directory/profile facts.
for (const [name, fixtures] of [['人物', character], ['衣服', clothing]] as const) {
  test(`${name}：四层树在每一层都提前描边，但去重与补全不会越过全层屏障`, { timeout: 5000 }, async t => {
    const f = await fixtures.fixture(t), events: string[] = [];
    const levels = [['a', 'b'], ['a/child', 'b/child'],
      ['a/child/mid', 'b/child/mid'], ['a/child/mid/leaf', 'b/child/mid/leaf']];
    const children = Object.fromEntries(levels.slice(0, -1).flatMap((ids, depth) =>
      ids.map((id, index) => [id, [{ id: levels[depth + 1][index] }]])));
    const steps = fixtures.workingSteps(events, levels[0].map(id => ({ id })), children);
    const gates = ['b/child', 'b/child/mid'].map(parent => ({ parent,
      blocked: Promise.withResolvers<void>(), release: Promise.withResolvers<void>(),
      reviewed: Promise.withResolvers<void>(),
    }));
    const run = runLayering({ ...f, groups: null, steps: { ...steps,
      async splitChildren(context) {
        const gate = gates.find(gate => gate.parent === context.group.id);
        if (gate) { gate.blocked.resolve(); await gate.release.promise; }
        return steps.splitChildren(context);
      },
      async reviewOutline(context) {
        const result = await steps.reviewOutline(context);
        const gate = gates.find(gate => context.group.id === children[gate.parent.replace(/^b/, 'a')][0].id);
        gate?.reviewed.resolve();
        return result;
      },
      async reduceOutlines(context) {
        assert.deepEqual(context.entries.map(entry => entry.group.id).sort(), levels[context.depth]);
        return steps.reduceOutlines!(context);
      },
    }, mergeSvg: fixtures.workingMerger(events) });
    try {
      for (const [index, gate] of gates.entries()) {
        await Promise.all([gate.blocked.promise, gate.reviewed.promise]);
        const child = levels[index + 2][0];
        assert.ok(events.includes(`${child}:outline`) && events.includes(`${child}:review`));
        assert.ok(!events.includes(`${gate.parent}:children`));
        assert.ok(!events.includes(`layer-${index + 2}:reduce`));
        assert.ok(!events.includes(`${child}:completion`));
        gate.release.resolve();
      }
    } finally { for (const gate of gates) gate.release.resolve(); await run; }
    assert.equal((await run).status, 'completed');
    for (const [depth, ids] of levels.entries()) {
      const reduction = events.indexOf(`layer-${depth}:reduce`);
      assert.equal(events.filter(e => e === `layer-${depth}:reduce`).length, 1);
      for (const id of ids) {
        assert.equal(events.filter(e => e === `${id}:outline`).length, 1);
        assert.equal(events.filter(e => e === `${id}:review`).length, 1);
        assert.ok(events.indexOf(`${id}:review`) < reduction);
        assert.ok(events.indexOf(`${id}:completion`) > reduction);
      }
    }
    assert.ok(events.indexOf('merge') > events.indexOf('b/child/mid/leaf:check'));
  });

  test(`${name}：慢分支 pending 时仍预备子组，续跑沿用且全层仅去重一次`, async t => {
    const f = await fixtures.fixture(t), events: string[] = [];
    const steps = fixtures.workingSteps(events, [{ id: 'a' }, { id: 'b' }], {
      a: [{ id: 'a/child' }], b: [{ id: 'b/child' }],
    });
    const first = await runLayering({ ...f, groups: null, steps: { ...steps,
      async splitChildren(context) {
        return context.group.id === 'b' ? { status: 'pending', message: 'paused' } : steps.splitChildren(context);
      },
    }, mergeSvg: fixtures.workingMerger(events) });
    assert.equal(first.status, 'pending');
    assert.ok(events.includes('a/child:review'));
    assert.ok(!events.includes('layer-1:reduce') && !events.includes('a/child:completion'));
    events.length = 0;
    const resumed = await runLayering({ ...f, groups: null, steps, mergeSvg: fixtures.workingMerger(events) });
    assert.equal(resumed.status, 'completed');
    assert.ok(!events.includes('a/child:outline') && !events.includes('a/child:review'));
    assert.ok(events.includes('b/child:review'));
    assert.equal(events.filter(e => e === 'layer-1:reduce').length, 1);
    assert.ok(events.indexOf('layer-1:reduce') > events.indexOf('b/child:review'));
  });

  test(`${name}：提前 review 返回 pending 不在同一次运行中重复重试`, async t => {
    const f = await fixtures.fixture(t), events: string[] = [];
    const steps = fixtures.workingSteps(events, [{ id: 'a' }], { a: [{ id: 'a/child' }] });
    let reviews = 0;
    const result = await runLayering({ ...f, groups: null, steps: { ...steps,
      async reviewOutline(context) {
        if (context.group.id === 'a/child') { reviews++; return { status: 'pending', message: 'waiting' }; }
        return steps.reviewOutline(context);
      },
    } });
    assert.equal(result.status, 'pending');
    assert.equal(reviews, 1);
    assert.ok(!events.includes('a/child:completion'));
    events.length = 0;
    const resumed = await runLayering({ ...f, groups: null, steps, mergeSvg: fixtures.workingMerger(events) });
    assert.equal(resumed.status, 'completed');
    assert.ok(!events.includes('a/child:outline') && events.includes('a/child:review'));
  });

  test(`${name}：深度限制仍只登记子组，不提前描边；放开后可继续`, async t => {
    const f = await fixtures.fixture(t), events: string[] = [];
    const steps = fixtures.workingSteps(events, [{ id: 'a' }], { a: [{ id: 'a/child' }] });
    const limited = await runLayering({ ...f, groups: null, maxDepth: 1, steps });
    assert.equal(limited.status, 'pending');
    assert.equal(limited.groups[0].groups[0].id, 'a/child');
    assert.ok(!events.some(e => e.startsWith('a/child:')));
    const resumed = await runLayering({ ...f, groups: null, steps, mergeSvg: fixtures.workingMerger(events) });
    assert.equal(resumed.status, 'completed');
    assert.equal(events.filter(e => e === 'a/child:outline').length, 1);
  });

  test(`${name}：显式分支只提前派发自己的子组，未选分支不被启动`, async t => {
    const f = await fixtures.fixture(t), events: string[] = [];
    const steps = fixtures.workingSteps(events, [{ id: 'a' }, { id: 'b' }], {
      a: [{ id: 'a/child' }], b: [{ id: 'b/child' }],
    });
    await runLayering({ ...f, groups: null, maxDepth: 1, steps });
    events.length = 0;
    const result = await runLayering({ ...f, groups: { id: 'a' }, steps });
    assert.equal(result.status, 'pending');
    assert.ok(events.includes('a/child:review'));
    assert.ok(!events.some(e => e.startsWith('b/child:')));
    assert.ok(!events.includes('layer-1:reduce'));
  });
}
