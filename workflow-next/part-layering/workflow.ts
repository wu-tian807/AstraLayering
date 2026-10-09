export type ReadyGroup<G> = { id: string; group: G; depth: number };

export type WorkflowHooks<G> = {
  preparation?(): Promise<void>;
  initialize(input: G | G[] | null): Promise<void>;
  ready(): Promise<ReadyGroup<G>[]>;
  runRound(group: G): Promise<void>;
};

export async function runWorkflow<G>(
  input: G | G[] | null,
  hooks: WorkflowHooks<G>,
  { concurrency = 3, maxDepth = Infinity } = {},
): Promise<void> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be a positive integer');
  }
  if (maxDepth !== Infinity && (!Number.isInteger(maxDepth) || maxDepth < 1)) {
    throw new Error('maxDepth must be a positive integer or Infinity');
  }

  await hooks.preparation?.();
  await hooks.initialize(input);
  const started = new Set<string>();
  const active = new Set<Promise<void>>();
  let failure: { error: unknown } | undefined;
  const checkFailure = () => {
    if (failure) throw failure.error;
  };

  try {
    while (true) {
      checkFailure();

      const ready = await hooks.ready();
      checkFailure();

      for (const item of ready) {
        if (active.size >= concurrency) break;
        if (started.has(item.id) || item.depth >= maxDepth) continue;
        if (!item.id || !Number.isInteger(item.depth) || item.depth < 0) {
          throw new Error('ready groups require an id and a nonnegative integer depth');
        }

        started.add(item.id);
        const task = Promise.resolve()
          .then(() => hooks.runRound(item.group))
          .catch((error: unknown) => { failure ??= { error }; })
          .finally(() => { active.delete(task); });
        active.add(task);
      }

      if (active.size === 0) {
        checkFailure();
        return;
      }
      await Promise.race(active);
    }
  } finally {
    await Promise.allSettled(active);
  }
}
