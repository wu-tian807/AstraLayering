// Callers return follow-up instances after committing the facts that make them
// ready. Files, conditions and selection remain the caller's responsibility.
export type StepInstance = {
  id: string;
  run(): Promise<void | readonly StepInstance[]>;
};

type ReadySteps = readonly StepInstance[] | (() => Promise<readonly StepInstance[]>);

// Use one dispatcher per operation. A pending or completed instance is only
// dispatched once in that operation, even if rediscovered in a later batch.
export function createStepDispatcher() {
  const started = new Set<string>();

  async function run(steps: ReadySteps): Promise<void> {
    const active = new Set<Promise<void>>();
    let failure: { error: unknown } | undefined;
    const checkFailure = () => {
      if (failure) throw failure.error;
    };

    try {
      while (true) {
        checkFailure();
        const hadActive = active.size > 0;
        const ready = typeof steps === 'function' ? await steps() : steps;
        checkFailure();
        if (ready.some(step => !step.id)) throw new Error('Ready steps require an ID');

        for (const step of ready) {
          if (started.has(step.id)) continue;
          started.add(step.id);
          const task: Promise<void> = Promise.resolve()
            .then(async () => {
              const followups = await step.run();
              // A started branch can finish its committed follow-ups even if
              // an independent branch fails.
              if (followups && followups.length) await run(followups);
            })
            .catch((error: unknown) => { failure ??= { error }; })
            .finally(() => { active.delete(task); });
          active.add(task);
        }

        if (active.size) await Promise.race(active);
        // The last task may have made more work ready during an async scan.
        else if (!hadActive) return;
      }
    } finally {
      await Promise.allSettled(active);
    }
  }

  // The selected work and required members can differ. A targeted run may
  // reuse previously committed siblings or leave the join waiting for them.
  async function runAndJoin<Member>(steps: ReadySteps, join: {
    members: readonly Member[];
    completed(member: Member): boolean | Promise<boolean>;
    run(): Promise<void | boolean>;
  }): Promise<'waiting' | 'pending' | 'completed'> {
    await run(steps);
    const completed = await Promise.all(join.members.map(member => join.completed(member)));
    if (!completed.every(Boolean)) return 'waiting';
    return await join.run() === false ? 'pending' : 'completed';
  }

  return { run, runAndJoin };
}

// Dispatch a fixed batch and collect results in declaration order. When
// multiple members fail, report the first declared failure after all settle.
export async function runStepBatch<Result>(
  steps: readonly { id: string; run(): Promise<Result> }[],
): Promise<Result[]> {
  const results = new Map<string, PromiseSettledResult<Result>>();
  await createStepDispatcher().run(steps.map(step => ({
    id: step.id,
    async run() {
      try {
        results.set(step.id, { status: 'fulfilled', value: await step.run() });
      } catch (reason) {
        results.set(step.id, { status: 'rejected', reason });
      }
    },
  })));
  return steps.map(({ id }) => {
    const result = results.get(id)!;
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
}
