import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AgentRuntime } from '../agents/runtime.ts';
import { createStepDispatcher, runStepBatch, type StepInstance } from '../step-dispatch.ts';

test('all ready instances are dispatched while the agent runtime limits active calls', { timeout: 5000 }, async () => {
  const runtime = new AgentRuntime(3);
  const release = Promise.withResolvers<void>();
  const allQueued = Promise.withResolvers<void>();
  const slotsFilled = Promise.withResolvers<void>();
  const ids = Array.from({ length: 29 }, (_, index) => String(index));
  const dispatched: string[] = [];
  let active = 0;
  let peak = 0;
  const steps = ids.map(id => ({
    id,
    async run() {
      dispatched.push(id);
      if (dispatched.length === ids.length) allQueued.resolve();
      await runtime.run(async () => {
        active++;
        peak = Math.max(peak, active);
        if (active === runtime.concurrency) slotsFilled.resolve();
        await release.promise;
        active--;
      });
    },
  }));
  const running = createStepDispatcher().run(async () => steps);
  try {
    await Promise.all([allQueued.promise, slotsFilled.promise]);
    assert.equal(active, 3);
    assert.deepEqual(dispatched, ids);
  } finally {
    release.resolve();
    await running;
  }
  assert.equal(peak, 3);
  assert.deepEqual(dispatched, ids);
});

test('a committed step can dispatch new instances while a sibling is still running', { timeout: 5000 }, async () => {
  const dispatcher = createStepDispatcher();
  const releaseSibling = Promise.withResolvers<void>();
  const followedUp = Promise.withResolvers<void>();
  const events: string[] = [];
  const followup: StepInstance = {
    id: 'index',
    async run() {
      assert.ok(events.includes('published'));
      events.push('indexed');
      followedUp.resolve();
    },
  };
  const running = dispatcher.run([
    { id: 'publish', async run() { events.push('published'); return [followup, followup]; } },
    { id: 'independent', async run() { await releaseSibling.promise; events.push('finished'); } },
  ]);
  try {
    await followedUp.promise;
    assert.deepEqual(events, ['published', 'indexed']);
  } finally {
    releaseSibling.resolve();
    await running;
  }

  await dispatcher.run([followup]);
  assert.deepEqual(events, ['published', 'indexed', 'finished']);
  await createStepDispatcher().run([followup]);
  assert.deepEqual(events, ['published', 'indexed', 'finished', 'indexed']);
});

test('a failure drains already started branches and their committed follow-ups', { timeout: 5000 }, async () => {
  const release = Promise.withResolvers<void>();
  const events: string[] = [];
  const failure = assert.rejects(createStepDispatcher().run([
    { id: 'failure', async run() { throw new Error('failed'); } },
    {
      id: 'save',
      async run() {
        await release.promise;
        events.push('saved');
        return [{ id: 'report', async run() { events.push('reported'); } }];
      },
    },
  ]), Error);
  await new Promise<void>(resolve => setImmediate(resolve));
  try {
    assert.deepEqual(events, []);
  } finally {
    release.resolve();
    await failure;
  }
  assert.deepEqual(events, ['saved', 'reported']);
});

test('a join reuses completed members and waits for unselected members', async () => {
  const committed = new Set(['retained']);
  let joins = 0;
  const join = {
    members: ['retained', 'selected', 'waiting'],
    completed: (id: string) => committed.has(id),
    async run() {
      joins++;
      return joins > 1;
    },
  };
  function member(id: string): StepInstance {
    return {
      id,
      async run() {
        assert.ok(!committed.has(id), `${id} must start once`);
        committed.add(id);
      },
    };
  }

  assert.equal(await createStepDispatcher().runAndJoin([member('selected')], join), 'waiting');
  assert.equal(joins, 0);
  assert.equal(await createStepDispatcher().runAndJoin([member('waiting')], join), 'pending');
  assert.equal(await createStepDispatcher().runAndJoin([], join), 'completed');
  assert.equal(joins, 2);
});

test('a fixed batch waits for every member and reports failures in declaration order', { timeout: 5000 }, async () => {
  const releaseFirst = Promise.withResolvers<void>();
  const secondFailed = Promise.withResolvers<void>();
  let settled = false;
  const batch = runStepBatch([
    {
      id: 'first',
      async run() {
        await releaseFirst.promise;
        throw new Error('first branch failed');
      },
    },
    {
      id: 'second',
      async run() {
        secondFailed.resolve();
        throw new Error('second branch failed');
      },
    },
  ]);
  const markSettled = () => { settled = true; };
  void batch.then(markSettled, markSettled);
  try {
    await secondFailed.promise;
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(settled, false);
  } finally {
    releaseFirst.resolve();
    await assert.rejects(batch, Error);
  }
});
