import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { AgentSlotPool, ipcAgentSlots } from '../../workflow/agent-slots.ts';
import { AsyncResource } from 'node:async_hooks';
import { test } from 'node:test';
import { AgentRuntime, shareAgentSlots, withAgentSlotReleased, withAgentToolScope, type AgentSlots } from '../agents/runtime.ts';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';

const signal = new AbortController().signal;
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function tool(execute: FunctionTool['execute']): FunctionTool { return { name: 'nested_review', description: '', inputSchema: {}, execute }; }
function pool(limit: number) {
  let peak = 0, requests = 0;
  const scheduler = new AgentSlotPool(limit);
  const child = new EventEmitter() as EventEmitter & { connected: boolean; send(message: unknown): boolean };
  const port = new EventEmitter() as EventEmitter & { send(message: unknown): boolean };
  child.connected = true;
  child.send = message => { queueMicrotask(() => port.emit('message', message)); return true; };
  port.send = message => { queueMicrotask(() => child.emit('message', message)); return true; };
  scheduler.attach(child as unknown as ChildProcess);
  const ipc = ipcAgentSlots(port as unknown as NodeJS.Process);
  const slots: AgentSlots = async signal => { requests++; const release = await ipc(signal); peak = Math.max(peak, scheduler.active); return release; };
  return { slots, state: () => ({ active: scheduler.active, peak, requests }) };
}

// The resource is created before the turn, like the app-server socket or MCP
// server receiving a CLI's tool request. No inherited async context is assumed.
test('a tool callback from another async resource can hand off one local slot and resume', { timeout: 2000 }, async () => {
  const external = new AsyncResource('external-cli-tool'), runtime = new AgentRuntime(1), events: string[] = [];
  await withAgentToolScope({ tools: [tool(async (_, signal) => withAgentSlotReleased(async signal => {
    await runtime.run(async () => { events.push('review'); }, { signal });
    return textResult('approved');
  }, signal))] }, task => runtime.run(async () => {
    events.push('drawing');
    await external.runInAsyncScope(() => task.tools[0].execute({}, signal));
    events.push('drawing-resumed');
  }));
  await runtime.run(async () => { events.push('next'); });
  assert.deepEqual(events, ['drawing', 'review', 'drawing-resumed', 'next']);
  external.emitDestroy();
});

test('ordinary tools retain their slot', { timeout: 2000 }, async () => {
  const runtime = new AgentRuntime(1), entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let next = false;
  const parent = withAgentToolScope({ tools: [tool(async () => { entered.resolve(); await release.promise; return textResult('read'); })] }, task =>
    runtime.run(async () => { await task.tools[0].execute({}, signal); }));
  await entered.promise;
  const queued = runtime.run(async () => { next = true; });
  await tick(); assert.equal(next, false);
  release.resolve(); await Promise.all([parent, queued]);
  assert.equal(next, true);
});

test('all occupied parents can await reviews within both local and shared limits', { timeout: 3000 }, async t => {
  const shared = pool(3), runtime = new AgentRuntime(3), allEntered = Promise.withResolvers<void>();
  shareAgentSlots(shared.slots); t.after(() => shareAgentSlots(undefined));
  let entered = 0, reviewed = 0, resumed = 0;
  await Promise.all(Array.from({ length: 3 }, () => withAgentToolScope({ tools: [tool(async (_, signal) => withAgentSlotReleased(async signal => {
    await runtime.run(async () => { reviewed++; await tick(); }, { signal });
    return textResult('done');
  }, signal))] }, task => runtime.run(async () => {
    if (++entered === 3) allEntered.resolve();
    await allEntered.promise;
    await task.tools[0].execute({}, signal); resumed++;
  }))));
  await tick();
  assert.equal(reviewed, 3); assert.equal(resumed, 3);
  assert.deepEqual(shared.state(), { active: 0, peak: 3, requests: 9 });
});

test('a rejected review restores the parent slot before returning the tool error', { timeout: 2000 }, async t => {
  const shared = pool(1), runtime = new AgentRuntime(1);
  shareAgentSlots(shared.slots); t.after(() => shareAgentSlots(undefined));
  await withAgentToolScope({ tools: [tool(async (_, signal) => withAgentSlotReleased(async signal => {
    await runtime.run(async () => { throw new Error('review failed'); }, { signal });
    return textResult('unreachable');
  }, signal))] }, task => runtime.run(async () => {
    await assert.rejects(task.tools[0].execute({}, signal), Error);
    assert.equal(shared.state().active, 1);
  }));
  await tick(); assert.equal(shared.state().active, 0);
  await runtime.run(async () => {});
});

test('parent cancellation reaches the reviewer and leaves no local or shared lease', { timeout: 2000 }, async t => {
  const shared = pool(1), runtime = new AgentRuntime(1), abort = new AbortController(), reviewing = Promise.withResolvers<void>();
  shareAgentSlots(shared.slots); t.after(() => shareAgentSlots(undefined));
  const parent = withAgentToolScope({ tools: [tool(async (_, toolSignal) => withAgentSlotReleased(async signal => {
    await runtime.run(async () => {
      reviewing.resolve();
      await new Promise<void>((_, reject) => signal!.addEventListener('abort', () => reject(signal!.reason), { once: true }));
    }, { signal });
    return textResult('unreachable');
  }, toolSignal))] }, task => runtime.run(async () => { await task.tools[0].execute({}, signal); }, { signal: abort.signal }));
  await reviewing.promise; abort.abort(new Error('stop drawing'));
  await assert.rejects(parent, Error);
  await runtime.run(async () => {});
  await tick(); assert.equal(shared.state().active, 0);
});

test('cancelling while reacquiring the parent does not wait for another model', { timeout: 2000 }, async () => {
  const runtime = new AgentRuntime(1), abort = new AbortController(), reviewing = Promise.withResolvers<void>();
  const otherEntered = Promise.withResolvers<void>(), otherRelease = Promise.withResolvers<void>();
  let other: Promise<void>;
  const parent = withAgentToolScope({ tools: [tool(async (_, signal) => withAgentSlotReleased(async nestedSignal => {
    await runtime.run(async () => {
      other = runtime.run(async () => { otherEntered.resolve(); await otherRelease.promise; });
      reviewing.resolve();
    }, { signal: nestedSignal });
    return textResult('done');
  }, signal))] }, task => runtime.run(async () => { await task.tools[0].execute({}, signal); }, { signal: abort.signal }));
  await reviewing.promise; await otherEntered.promise; abort.abort(new Error('stop while queued'));
  await assert.rejects(parent, Error);
  otherRelease.resolve(); await other!;
  await runtime.run(async () => {});
});

test('parallel tool branches serialize transfers of their single parent lease', { timeout: 2000 }, async () => {
  const runtime = new AgentRuntime(1), events: string[] = [];
  await withAgentToolScope({ tools: [tool(async (id, signal) => withAgentSlotReleased(async nestedSignal => {
    await runtime.run(async () => { events.push('start-' + id); await tick(); events.push('end-' + id); }, { signal: nestedSignal });
    return textResult(id);
  }, signal))] }, task => runtime.run(async () => {
    await Promise.all([task.tools[0].execute('a', signal), task.tools[0].execute('b', signal)]);
  }));
  assert.deepEqual(events, ['start-a', 'end-a', 'start-b', 'end-b']);
});

test('a tool from a finished turn cannot borrow another turn’s slot', { timeout: 2000 }, async () => {
  const runtime = new AgentRuntime(1); let saved: FunctionTool | undefined;
  await withAgentToolScope({ tools: [tool(async () => textResult('done'))] }, async task => {
    saved = task.tools[0]; await runtime.run(async () => {});
  });
  await runtime.run(async () => { await assert.rejects(async () => saved!.execute({}, signal), Error); });
});
