import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { AgentSlotPool, ipcAgentSlots } from '../agent-slots.ts';

// A connected pair standing in for the scheduler's child and the worker's process.
function channel() {
  const child = new EventEmitter() as EventEmitter & { connected: boolean; send(message: unknown): boolean };
  const port = new EventEmitter() as EventEmitter & { send(message: unknown): boolean };
  child.connected = true;
  child.send = message => { queueMicrotask(() => port.emit('message', message)); return true; };
  port.send = message => { queueMicrotask(() => child.emit('message', message)); return true; };
  return { child: child as unknown as ChildProcess, slots: ipcAgentSlots(port as unknown as NodeJS.Process), close: () => child.emit('close') };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

test('agent slot pool: workers share the limit, cancelled and closed holders free their slots', async () => {
  const pool = new AgentSlotPool(1), a = channel(), b = channel();
  pool.attach(a.child); pool.attach(b.child);
  const release = await a.slots();
  let granted = false;
  const waiting = b.slots().then(done => { granted = true; return done; });
  await settle();
  assert.equal(granted, false);
  release(); release(); // A second release is a no-op.
  const second = await waiting;
  assert.equal(pool.active, 1);
  second();
  await settle();
  assert.equal(pool.active, 0);

  // A cancelled request never holds a slot.
  const held = await a.slots(), abort = new AbortController();
  const cancelled = b.slots(abort.signal);
  abort.abort(new Error('stop'));
  await assert.rejects(cancelled, Error);
  held();
  await settle();
  assert.equal(pool.active, 0);

  // A worker that exits gives back what it held.
  await a.slots();
  a.close();
  const after = await b.slots();
  assert.equal(pool.active, 1);
  after();
  assert.throws(() => new AgentSlotPool(0), Error);
});
