import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// One rerun rule for every pipeline. A step owns a directory with a .running
// or .completed marker. .completed records a fresh stamp and the stamps its
// dependencies had when it finished; a step whose marker is missing, or whose
// recorded dependency stamps no longer match, reruns with everything after it.
// Session identity (threadId) belongs to the step's own records, so deleting a
// step always drops its session.
//
// A step that declares outputs records their hashes and uses them as its stamp:
// regenerating identical bytes keeps dependents, and outputs replaced while the
// run was interrupted are reported as modified, so continuing refuses until the
// step is explicitly retried. Output paths are relative to the step directory
// and may point outside it; a missing output reruns the step, and resetting a
// step deletes its outputs.
//
// A dependency is a step id, or `id#output` to depend on one declared output's
// hash only, so a step that rewrites several files reruns just the dependents of
// the files that actually changed.
export type ChainStep = { id: string; directory: string; dependsOn: readonly string[]; outputs?: readonly string[]; allowsEarlyArtifacts?: boolean };
export type StepStatus = 'absent' | 'unmarked' | 'running' | 'completed';
export type StepRecord = { stamp: string; inputs: Record<string, string>; outputs?: Record<string, string> };
export type ChainPlan = {
  statuses: Map<string, StepStatus>;
  // Steps to rerun, in chain order; the first entries are the breaks.
  reset: string[];
  // Kept steps whose recorded outputs no longer match: continuing must refuse.
  modified: string[];
};

async function info(path: string) {
  try { return await lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
}

// Empty or non-JSON markers come from older runs: completed, but without a stamp.
function parseRecord(text: string): StepRecord | undefined {
  try {
    const value = JSON.parse(text) as StepRecord;
    if (typeof value?.stamp === 'string' && value.inputs && typeof value.inputs === 'object'
      && Object.values(value.inputs).every(stamp => typeof stamp === 'string')
      && (value.outputs === undefined || (typeof value.outputs === 'object' && !!value.outputs
        && Object.values(value.outputs).every(hash => typeof hash === 'string')))) return value;
  } catch { /* legacy marker */ }
}

export async function readStep(directory: string): Promise<{ status: StepStatus; record?: StepRecord }> {
  const folder = await info(directory);
  if (!folder) return { status: 'absent' };
  if (!folder.isDirectory() || folder.isSymbolicLink()) throw new Error(`步骤路径必须是普通目录：${directory}`);
  for (const marker of ['completed', 'running'] as const) {
    const path = join(directory, `.${marker}`), file = await info(path);
    if (!file) continue;
    if (!file.isFile() || file.isSymbolicLink()) throw new Error(`步骤标记必须是普通文件：${directory}/.${marker}`);
    return { status: marker, record: parseRecord(await readFile(path, 'utf8')) };
  }
  return { status: 'unmarked' };
}

async function outputHashes(step: ChainStep): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const name of step.outputs ?? []) {
    try { hashes[name] = createHash('sha256').update(await readFile(resolve(step.directory, name))).digest('hex'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return hashes;
}
const sameOutputs = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([name, hash]) => b[name] === hash);
const dependencyStep = (dependency: string) => dependency.split('#', 1)[0];
const dependencyStamp = (dependency: string, record?: StepRecord) => {
  const at = dependency.indexOf('#');
  return at < 0 ? record?.stamp : record?.outputs?.[dependency.slice(at + 1)];
};

export async function inspectChain(steps: readonly ChainStep[]): Promise<ChainPlan> {
  const known = new Set<string>();
  for (const step of steps) {
    if (known.has(step.id)) throw new Error(`重复的步骤：${step.id}`);
    for (const dependency of step.dependsOn) {
      if (!known.has(dependencyStep(dependency))) throw new Error(`${step.id} 的依赖 ${dependency} 必须排在它之前`);
    }
    known.add(step.id);
  }
  const statuses = new Map<string, StepStatus>(), records = new Map<string, StepRecord | undefined>();
  const unusable = new Set<string>(), reset: string[] = [], modified: string[] = [];
  for (const step of steps) {
    const state = await readStep(step.directory), record = state.record;
    // Diagnostics can be produced before this step starts. Keep their files,
    // while an absent marker still means the step has not run or been approved.
    const status = state.status === 'unmarked' && step.allowsEarlyArtifacts ? 'absent' : state.status;
    statuses.set(step.id, status);
    // A completed step reopened for more work keeps its stamp while running.
    records.set(step.id, record);
    const broken = step.dependsOn.some(dependency => unusable.has(dependencyStep(dependency)));
    const changed = status !== 'unmarked' && !!record && step.dependsOn.some(dependency =>
      dependency in record.inputs && record.inputs[dependency] !== dependencyStamp(dependency, records.get(dependencyStep(dependency))));
    // Deleting a completed step's output is a retry of that step.
    const outputs = status === 'completed' && step.outputs ? await outputHashes(step) : undefined;
    const missing = !!outputs && step.outputs!.some(name => !(name in outputs));
    if (status === 'unmarked' || changed || missing || (broken && status !== 'absent')) reset.push(step.id);
    // An absent step only breaks the steps that already exist after it. A running
    // step does not: it continues the work its dependents were built on.
    if (status === 'absent' || reset.includes(step.id)) unusable.add(step.id);
    else if (outputs && record?.outputs && !sameOutputs(record.outputs, outputs)) modified.push(step.id);
  }
  return { statuses, reset, modified };
}

export function modifiedError(plan: ChainPlan, steps: readonly ChainStep[]): Error | undefined {
  if (!plan.modified.length) return;
  const paths = steps.filter(step => plan.modified.includes(step.id)).map(step => step.directory);
  return new Error(`已完成步骤的产物在中断期间被改动，不能直接续跑：\n${paths.join('\n')}\n请对该步骤执行重试（删除其 .completed 或产物后重跑），依赖它的后续步骤会随之重跑。已有文件已保留。`);
}

export async function resetChain(steps: readonly ChainStep[], plan: ChainPlan): Promise<void> {
  // Remove descendants first. The triggering step goes last, so a crash during
  // deletion still shows the break on the next launch.
  for (const step of [...steps].reverse()) {
    if (!plan.reset.includes(step.id)) continue;
    for (const name of step.outputs ?? []) await rm(resolve(step.directory, name), { force: true });
    await rm(step.directory, { recursive: true, force: true });
  }
}

// A completed step reopened for more work keeps its record (and stamp).
export async function startStep(directory: string, status: StepStatus): Promise<void> {
  if (status === 'completed') await rename(join(directory, '.completed'), join(directory, '.running'));
  else if (status !== 'running') await writeFile(join(directory, '.running'), '', { flag: 'wx' });
}

type StepLookup = readonly ChainStep[] | ((id: string) => ChainStep | undefined);

// The stamps a step's dependencies have now. Every dependency must be completed.
export async function stepInputs(step: ChainStep, steps: StepLookup): Promise<Record<string, string>> {
  const inputs: Record<string, string> = {};
  for (const dependency of step.dependsOn) {
    const id = dependencyStep(dependency);
    const upstream = typeof steps === 'function' ? steps(id) : steps.find(candidate => candidate.id === id);
    if (!upstream) throw new Error(`${step.id} 的依赖 ${dependency} 不在链上`);
    const { status, record } = await readStep(upstream.directory);
    if (status !== 'completed') throw new Error(`${step.id} 的依赖 ${dependency} 尚未完成`);
    const stamp = dependencyStamp(dependency, record);
    if (record && stamp === undefined) throw new Error(`${step.id} 的依赖 ${dependency} 没有该产物`);
    if (stamp !== undefined) inputs[dependency] = stamp;
  }
  return inputs;
}
const sameInputs = (a: Record<string, string>, b: Record<string, string>) => sameOutputs(a, b);

// Checks one step once its dependencies are settled, for graphs that grow while
// they run. keep: completed against the current inputs with its outputs intact.
// continue: interrupted while running against the same inputs, so its own
// partial work (drafts, session) is still valid. rerun: anything else; the
// caller resets the step (and with it the session) before starting it again.
export type StepCheck = { action: 'keep' | 'continue' | 'rerun'; status: StepStatus; record?: StepRecord; inputs: Record<string, string> };
export async function checkStep(step: ChainStep, steps: StepLookup): Promise<StepCheck> {
  const { status, record } = await readStep(step.directory);
  const inputs = await stepInputs(step, steps);
  const started = status === 'running' ? await runningInputs(step.directory) : undefined;
  if (status === 'running' && started && sameInputs(started, inputs)) return { action: 'continue', status, record, inputs };
  if (status !== 'completed' || !record || !sameInputs(record.inputs, inputs)) return { action: 'rerun', status, record, inputs };
  const outputs = await outputHashes(step);
  if (step.outputs?.some(name => !(name in outputs))) return { action: 'rerun', status, record, inputs };
  if (record.outputs && !sameOutputs(record.outputs, outputs)) {
    throw new Error(`已完成步骤的产物被改动，不能直接续跑：${step.directory}\n请对该步骤执行重试（删除其 .completed 或产物后重跑），依赖它的后续步骤会随之重跑。`);
  }
  return { action: 'keep', status, record, inputs };
}

// The inputs a lazily checked step was started against (see beginStep).
export async function runningInputs(directory: string): Promise<Record<string, string> | undefined> {
  try {
    const value = JSON.parse(await readFile(join(directory, '.running'), 'utf8')) as { inputs?: unknown };
    if (value?.inputs && typeof value.inputs === 'object' && Object.values(value.inputs).every(stamp => typeof stamp === 'string')) {
      return value.inputs as Record<string, string>;
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; }
}

// Marks a step running against the given inputs, replacing any earlier marker.
export async function beginStep(directory: string, inputs: Record<string, string>): Promise<void> {
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.running.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify({ inputs }) + '\n');
    await rename(temporary, join(directory, '.running'));
  } finally { await rm(temporary, { force: true }); }
  await rm(join(directory, '.completed'), { force: true });
}

// Removes a step and its declared outputs.
export async function resetStep(step: ChainStep): Promise<void> {
  for (const name of step.outputs ?? []) await rm(resolve(step.directory, name), { force: true });
  await rm(step.directory, { recursive: true, force: true });
}

export async function completeStep(step: ChainStep, steps: StepLookup): Promise<void> {
  const running = join(step.directory, '.running');
  const reopened = parseRecord(await readFile(running, 'utf8'));
  if (reopened && !step.outputs) {
    await rename(running, join(step.directory, '.completed'));
    return;
  }
  const inputs = await stepInputs(step, steps);
  let record: StepRecord;
  if (step.outputs) {
    const outputs = await outputHashes(step);
    const missing = step.outputs.filter(name => !(name in outputs));
    if (missing.length) throw new Error(`${step.id} 缺少产物：${missing.join('、')}`);
    // A reopened step keeps its original inputs: it continued the same work.
    record = { stamp: createHash('sha256').update(JSON.stringify(outputs)).digest('hex'), inputs: reopened?.inputs ?? inputs, outputs };
  } else record = { stamp: randomUUID(), inputs };
  const temporary = join(step.directory, `.completed.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(record) + '\n');
    await rename(temporary, join(step.directory, '.completed'));
  } finally { await rm(temporary, { force: true }); }
  await rm(running, { force: true });
}
