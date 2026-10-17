export type ReadyGroup<G> = { id: string; group: G; depth: number };

export type WorkflowHooks<G> = {
  preparation?(): Promise<void>;
  initialize(input: G | G[] | null): Promise<void>;
  // 只返回依赖已满足的未完成组；具体父子依赖由上层判断。
  ready(): Promise<ReadyGroup<G>[]>;
  runRound(group: G): Promise<void>;
};

export function validateWorkflowOptions({ maxDepth = Infinity } = {}): void {
  if (maxDepth !== Infinity && (!Number.isInteger(maxDepth) || maxDepth < 1)) {
    throw new Error('maxDepth must be a positive integer or Infinity');
  }
}

export async function runWorkflow<G>(
  input: G | G[] | null,
  hooks: WorkflowHooks<G>,
  { maxDepth = Infinity } = {},
): Promise<void> {
  validateWorkflowOptions({ maxDepth });

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

      const hadActive = active.size > 0;
      const ready = await hooks.ready();
      checkFailure();

      for (const item of ready) {
        if (!item.id || !Number.isInteger(item.depth) || item.depth < 0) {
          throw new Error('ready groups require an id and a nonnegative integer depth');
        }
      }

      // 优先浅层，但其他分支仍在运行时，也允许派发依赖已满足的子组。
      for (const item of [...ready].sort((a, b) => a.depth - b.depth)) {
        if (started.has(item.id) || item.depth >= maxDepth) continue;

        started.add(item.id);
        const task = Promise.resolve()
          .then(() => hooks.runRound(item.group))
          .catch((error: unknown) => { failure ??= { error }; })
          .finally(() => { active.delete(task); });
        active.add(task);
      }

      if (active.size === 0) {
        checkFailure();
        // 扫描时最后一个任务刚结束，刷新一次快照以发现新放行的子组。
        if (hadActive) continue;
        return;
      }
      await Promise.race(active.keys());
    }
  } finally {
    await Promise.allSettled(active.keys());
  }
}
