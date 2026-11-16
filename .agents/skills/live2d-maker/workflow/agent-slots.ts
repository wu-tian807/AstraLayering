import type { ChildProcess } from 'node:child_process';
import type { AgentSlots } from '../shared/agents/runtime.ts';

// Concurrent sections run in separate worker processes; the scheduler holds
// one pool of agent slots and grants them over IPC, so the task as a whole runs
// at most jobs agents. Requests are served first come, first served.
type SlotMessage = { type: 'slot-request' | 'slot-release' | 'slot-cancel' | 'slot-granted'; id: number };
const slotMessage = (value: unknown): value is SlotMessage => !!value && typeof value === 'object'
  && typeof (value as SlotMessage).type === 'string' && (value as SlotMessage).type.startsWith('slot-') && Number.isSafeInteger((value as SlotMessage).id);

// Set in a worker's environment when its scheduler grants slots over IPC.
export const agentSlotsVariable = 'ASTRA_AGENT_SLOTS';

export class AgentSlotPool {
  private used = 0;
  private queue: { child: ChildProcess; id: number }[] = [];
  private held = new Map<ChildProcess, Set<number>>();
  readonly limit: number;
  constructor(limit: number) {
    this.limit = limit;
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('agent 并发必须是正整数');
  }
  get active() { return this.used; }

  attach(child: ChildProcess) {
    this.held.set(child, new Set());
    child.on('message', message => {
      if (!slotMessage(message)) return;
      if (message.type === 'slot-request') { this.queue.push({ child, id: message.id }); this.pump(); }
      // A cancel that crossed its grant releases the granted slot.
      else if (message.type === 'slot-release' || message.type === 'slot-cancel') this.release(child, message.id);
    });
    child.once('close', () => {
      this.queue = this.queue.filter(item => item.child !== child);
      this.used -= this.held.get(child)?.size ?? 0;
      this.held.delete(child);
      this.pump();
    });
  }

  private release(child: ChildProcess, id: number) {
    if (this.held.get(child)?.delete(id)) { this.used--; this.pump(); }
    else this.queue = this.queue.filter(item => item.child !== child || item.id !== id);
  }

  private pump() {
    while (this.used < this.limit && this.queue.length) {
      const { child, id } = this.queue.shift()!, held = this.held.get(child);
      if (!held || !child.connected) continue;
      held.add(id); this.used++;
      try { child.send({ type: 'slot-granted', id } satisfies SlotMessage); }
      catch { this.release(child, id); }
    }
  }
}

// The worker side: each agent turn asks the scheduler for a slot.
export function ipcAgentSlots(port: NodeJS.Process): AgentSlots {
  let next = 0;
  const waiting = new Map<number, () => void>();
  port.on('message', message => { if (slotMessage(message) && message.type === 'slot-granted') waiting.get(message.id)?.(); });
  return signal => new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const id = ++next;
    const cancel = () => { waiting.delete(id); port.send?.({ type: 'slot-cancel', id } satisfies SlotMessage); reject(signal!.reason); };
    waiting.set(id, () => {
      waiting.delete(id); signal?.removeEventListener('abort', cancel);
      let released = false;
      resolve(() => { if (!released) { released = true; port.send?.({ type: 'slot-release', id } satisfies SlotMessage); } });
    });
    signal?.addEventListener('abort', cancel, { once: true });
    port.send!({ type: 'slot-request', id } satisfies SlotMessage);
  });
}
