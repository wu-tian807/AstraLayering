import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isPromptRounds, type PromptRound } from './prompt-rounds.ts';

type Continuation = { version: 1; rounds: readonly PromptRound[]; completed: string[] };
type RunRound = (round: PromptRound, position: { first: boolean; last: boolean }) => Promise<void>;

async function savedContinuation(path: string): Promise<Continuation | undefined> {
  let value;
  try { value = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const rounds = value?.rounds;
  if (value?.version !== 1 || !isPromptRounds(rounds) || !rounds.length ||
      !Array.isArray(value.completed) || !continuationPrefix(rounds, value.completed)) {
    throw new Error(`接续进度无效：${path}`);
  }
  return { version: 1, rounds, completed: value.completed };
}

export function continuationPrefix(rounds: readonly { id: string }[], completed: readonly unknown[]): boolean {
  return completed.length <= rounds.length && completed.every((id, index) => id === rounds[index].id);
}

async function saveContinuation(path: string, state: Continuation): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(state, null, 2) + '\n');
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

// Adapters provide the session-bound call and their completion fact. A later
// round can only run after the earlier one has published that fact.
export async function runContinuation(options: {
  rounds: readonly PromptRound[];
  completed: readonly string[];
  run: RunRound;
  commit(round: PromptRound): Promise<void>;
  oneRound?: boolean;
  signal?: AbortSignal;
}): Promise<void> {
  for (let index = options.completed.length; index < options.rounds.length; index++) {
    const round = options.rounds[index];
    options.signal?.throwIfAborted();
    await options.run(round, { first: index === 0, last: index + 1 === options.rounds.length });
    options.signal?.throwIfAborted();
    await options.commit(round);
    if (options.oneRound) return;
  }
}

export async function pendingRepairRound(path: string, configured: readonly PromptRound[]): Promise<PromptRound | undefined> {
  const saved = await savedContinuation(path);
  return saved ? saved.rounds[saved.completed.length] : configured[0];
}

// Repair keeps its plan and intermediate progress inside the owning step.
// The final call still publishes the step's existing completion record.
export async function runRepairContinuation(path: string, configured: readonly PromptRound[], run: RunRound, signal?: AbortSignal) {
  const saved = await savedContinuation(path);
  const state: Continuation = saved ?? { version: 1, rounds: configured, completed: [] };
  if (!saved) await saveContinuation(path, state);
  await runContinuation({
    ...state, run, signal,
    async commit(round) {
      state.completed.push(round.id);
      // The adapter publishes the final result during the last call. Only
      // intermediate rounds need an additional checkpoint.
      if (state.completed.length < state.rounds.length) await saveContinuation(path, state);
    },
  });
  await rm(path, { force: true });
}
