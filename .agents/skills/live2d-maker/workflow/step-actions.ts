import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { readStep, type StepStatus } from '../shared/step-chain.ts';
import { missingDeliveries } from '../shared/step-deliveries.ts';
import { fromTaskPath, taskRootOf } from '../shared/task-paths.ts';
import { within } from '../shared/raster/run-store.ts';
import { clearStepSession, readStepSession } from '../shared/agents/step-session.ts';
import { occlusionPath } from '../shared/part/occlusion-plan.ts';
import { artifactPath, draftPath } from '../shared/part/artifact-facts.ts';
import { partSteps, stepPattern } from '../shared/step-paths.js';
import { sectionIds, type SectionId } from '../shared/paths.ts';
import { nineAxisGroupSteps, nineAxisSteps, nineAxisBranchSteps, previousNineAxisGroupSteps, previousNineAxisSteps } from '../shared/nine-axis.ts';
import { acquireTaskLock, directoryFor, sectionId, type TaskOptions } from './state.ts';
import { upgradeHairProgress } from '../nine-axis/hair-progress.ts';

// Step recovery, for one step (CLI --section/--step) or for every step still
// marked .running (web toolbar and CLI, applyTaskAction); retry also takes the
// completed steps that lost a delivery, which a run refuses to keep:
//   continue: change nothing; the next run continues the step with its
//             products and session.
//   resume:   drop the step's session and keep its products, so the next run
//             continues them in a new session.
//   retry:    reset the step (directory, its products outside it, session and
//             the agent attempts that worked in it); the next run reruns it
//             from a clean step.
// Every section keeps a step's session in agents/steps/<step>/session.json
// (shared/agents/step-session.ts). Steps without a session (one-shot agents)
// simply rerun when they have no product, so resume equals continue.
// The empty step id continues the whole section.
export const stepActions = ['continue', 'resume', 'retry'] as const;
export type StepAction = typeof stepActions[number];
// missing: the deliveries a completed step lost, relative to the section.
export type StepEntry = { id: string; status: Exclude<StepStatus, 'absent'>; session: boolean; missing?: string[] };

const partSections: readonly SectionId[] = ['part-layering', 'clothing-part-layering'];
const safeSegment = (segment: string) => !!segment && segment !== '.' && segment !== '..' && !/[\\\0]/.test(segment);
// Step ids are the step directories relative to the section (see part-steps.ts and step-section.ts).
const itemSteps: readonly string[] = [partSteps.outline, partSteps.completion, partSteps.children];
const anglesStep = 'step04_angles/model';
const axisChild = (step: string) => nineAxisGroupSteps.includes(step) || previousNineAxisGroupSteps.includes(step);
export function validStepId(section: SectionId, id: string): boolean {
  if (typeof id !== 'string' || !id.split('/').every(safeSegment)) return false;
  if (section === 'nine-axis') return (nineAxisSteps as readonly string[]).includes(id) || nineAxisBranchSteps.includes(id) || axisChild(id) || (previousNineAxisSteps as readonly string[]).includes(id) || previousNineAxisGroupSteps.includes(id);
  const [step, ...items] = id.split('/'), item = items.join('/');
  if (!stepPattern.test(step)) return false;
  if (!partSections.includes(section)) return !items.length;
  if (itemSteps.includes(step)) return /^[^/]+(\/children\/[^/]+)*$/.test(item);
  if (step === partSteps.reduce) return /^depth\d{2}$/.test(item);
  return !items.length;
}

export const sectionRoot = (directory: string, section: SectionId): string => join(directory, section);

// Every marked or unmarked step directory of a section, in path order.
export async function listSteps(root: string, section: SectionId): Promise<StepEntry[]> {
  let names: string[];
  try { names = await readdir(root, { recursive: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const ids = new Set(names.map(name => name.split(/[\\/]/).join('/')).filter(name => validStepId(section, name)));
  const steps: StepEntry[] = [];
  for (const id of [...ids].sort()) {
    const { status } = await readStep(join(root, id));
    if (status === 'absent') continue;
    const session = await readStepSession(root, id);
    const missing = status === 'completed' ? (await missingDeliveries(root, section, id)).map(path => relative(root, path).split(/[\\/]/).join('/')) : [];
    steps.push({ id, status, session: !!session?.threadId, ...(missing.length ? { missing } : {}) });
  }
  return steps;
}

export async function applyStepAction(options: Pick<TaskOptions, 'name' | 'dir'> & { section: string; step: string; action: string }): Promise<string> {
  const section = sectionId(options.section);
  if (!(stepActions as readonly string[]).includes(options.action)) throw new Error('未知操作：' + options.action + '；可选：' + stepActions.join(', '));
  const whole = options.step === '';
  if (whole ? options.action !== 'continue' : !validStepId(section, options.step)) throw new Error(`${section} 没有步骤 ${options.step}`);
  const directory = directoryFor(options);
  // The task lock keeps a running coordinator and a second recovery out.
  const release = await acquireTaskLock(directory);
  try {
    const root = sectionRoot(directory, section);
    if (whole) return `${section}：保留全部产物，下次运行续跑。`;
    return await actOnStep(root, section, options.step, options.action as StepAction);
  } finally { await release(); }
}

// The task-wide form the web toolbar uses: the action applies to every step
// still marked .running in every section; interrupted and failed steps both
// keep that marker. Retry also redoes completed steps that lost a delivery.
// Continue with no such step just runs the task on from where it stopped.
export async function applyTaskAction(options: Pick<TaskOptions, 'name' | 'dir'> & { action: string; section?: SectionId }): Promise<string> {
  if (!(stepActions as readonly string[]).includes(options.action)) throw new Error('未知操作：' + options.action + '；可选：' + stepActions.join(', '));
  const action = options.action as StepAction, directory = directoryFor(options);
  const release = await acquireTaskLock(directory);
  try {
    const messages: string[] = [];
    for (const section of options.section ? [sectionId(options.section)] : sectionIds) {
      const root = sectionRoot(directory, section);
      if(section==='nine-axis'&&action!=='retry')await upgradeHairProgress(join(root,'step08_hair'));
      const steps = await listSteps(root, section);
      const parentRunning = section === 'nine-axis' && steps.some(step => [anglesStep, 'step02_angles'].includes(step.id) && step.status === 'running');
      const selected = steps.filter(step => step.status === 'running' || action === 'retry' && step.missing
        || parentRunning && axisChild(step.id) && step.status !== 'completed');
      const hasChild = section === 'nine-axis' && selected.some(step => axisChild(step.id));
      for (const step of selected) {
        // The parent contains neutral and completed siblings. Recover the
        // selected children independently; they reopen the merge on retry.
        if (hasChild && [anglesStep, 'step04_angles', 'step02_angles'].includes(step.id)) continue;
        if (section === 'nine-axis' && step.id === 'step04_angles' && selected.some(child => child.id.startsWith(step.id + '/'))) continue;
        messages.push(`${section}/` + await actOnStep(root, section, step.id, action));
      }
    }
    if (!messages.length) {
      if (action !== 'continue') throw new Error(`没有中断或失败的步骤可${action === 'resume' ? '恢复' : '重试'}；继续运行即可。`);
      return '没有中断或失败的步骤，保留全部产物，从未完成处续跑。';
    }
    return messages.join('\n');
  } finally { await release(); }
}

async function actOnStep(root: string, section: SectionId, step: string, action: StepAction): Promise<string> {
  const stepDirectory = join(root, step);
  if(section==='nine-axis'&&step==='step08_hair'&&action!=='retry')await upgradeHairProgress(stepDirectory);
  const { status } = await readStep(stepDirectory);
  if (status === 'absent') throw new Error(`步骤 ${section}/${step} 不存在，下次运行会直接执行。`);
  const part = partSections.includes(section);
  if (action === 'continue') {
    if (status === 'completed') throw new Error(`步骤 ${step} 已完成；需要重做请选择重试。`);
    return `${step}：保留产物和会话，下次运行继续。`;
  }
  if (action === 'resume') {
    if (status === 'completed') throw new Error(`步骤 ${step} 已完成；只能对中断或失败的步骤恢复。`);
    const dropped = await clearStepSession(root, step, '网页恢复：清除会话，保留产物');
    if (!dropped) return `${step} 没有保存的会话，恢复等同继续：下次运行沿用产物。`;
    return `${step}：已清除会话${dropped.threadId ? ' ' + dropped.threadId : ''}，保留产物；下次运行在新会话中继续。`;
  }
  if (section === 'nine-axis' && step === 'step04_angles') {
    const branches = (await listSteps(root, section)).filter(child => nineAxisBranchSteps.includes(child.id) && (child.status !== 'completed' || child.missing));
    const messages = [];
    for (const child of branches) messages.push(await actOnStep(root, section, child.id, action));
    await reopenStage(root);
    return [...messages, `${step}：保留已完成分支，下次运行继续未完成分支。`].join('\n');
  }
  if (section === 'nine-axis' && [anglesStep, 'step02_angles'].includes(step)) {
    // A parent retry means unfinished children plus a fresh merge, not deletion
    // of the enclosing directory or every child's session/attempt history.
    const children = (await listSteps(root, section)).filter(child => axisChild(child.id) && child.id.startsWith(step + '/')
      && (child.status !== 'completed' || child.missing));
    const messages: string[] = [];
    for (const child of children) messages.push(await actOnStep(root, section, child.id, action));
    await reopenAngles(root, step.startsWith('step02_angles') ? 'step02_angles' : anglesStep);
    return [...messages, `${step}：保留共享素材和已完成单轴，已清除联合投影；下次运行重新合并。`].join('\n');
  }
  // retry: the step directory holds its session; some part products live outside it.
  const outputs: string[] = [];
  const group = step.startsWith(partSteps.completion + '/') ? step.slice(partSteps.completion.length + 1).split('/children/').join('/') : undefined;
  if (part && group) outputs.push(artifactPath(root, group, 'completion'), draftPath(artifactPath(root, group, 'completion')));
  if (part && step === partSteps.merge) outputs.push(join(root, 'preview.svg'), join(root, 'preview.draft.svg'));
  if (part && step === partSteps.occlusion) outputs.push(occlusionPath(root));
  const outside = outputs.filter(path => !within(root, path));
  if (outside.length) throw new Error(`${step} 的产物在管线目录之外（${outside.join('、')}），不能在此重试。`);
  for (const path of outputs) await rm(path, { force: true });
  await rm(stepDirectory, { recursive: true, force: true });
  await rm(join(root, 'agents', 'steps', step), { recursive: true, force: true });
  const attempts = await clearAgentAttempts(root, stepDirectory);
  if (section === 'nine-axis' && axisChild(step)) await reopenAngles(root, step.startsWith('step02_angles') ? 'step02_angles' : anglesStep);
  else if (section === 'nine-axis' && nineAxisBranchSteps.includes(step)) await reopenStage(root);
  return `${step}：已删除步骤产物、会话${attempts ? `和 ${attempts} 次 agent 尝试记录` : ''}；下次运行重做该步骤。`;
}

async function reopenAngles(root: string, modelStep = anglesStep): Promise<void> {
  if (modelStep === anglesStep) await reopenStage(root);
  const parent = join(root, modelStep);
  await mkdir(parent, { recursive: true });
  await rm(join(parent, '.completed'), { force: true });
  await writeFile(join(parent, '.running'), '', { flag: 'wx' }).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  });
  for (const file of ['merged', 'layers', 'deformers.json', 'axis-sources.json', 'source.json']) {
    await rm(join(parent, file), { recursive: true, force: true });
  }
}

async function reopenStage(root: string): Promise<void> {
  const parent = join(root, 'step04_angles');
  await mkdir(parent, { recursive: true });
  await rm(join(parent, '.completed'), { force: true });
  await writeFile(join(parent, '.running'), '', { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
}

// Each agent call leaves agents/<time>-<name>-*/ (request, events, CLI data) and a
// sessions.json entry. A retried step drops the ones whose output went to that step,
// so its new agent does not find and repeat the earlier attempts. Attempts with no
// recorded output directory are kept: their step is unknown.
async function clearAgentAttempts(root: string, stepDirectory: string): Promise<number> {
  const agents = join(root, 'agents'), taskRoot = taskRootOf(root);
  const inside = (directory: string, path: unknown) => {
    if (typeof path !== 'string') return false;
    try { return within(directory, fromTaskPath(taskRoot, path)); } catch { return false; }
  };
  const inStep = (path: unknown) => inside(stepDirectory, path);
  let entries;
  try { entries = await readdir(agents, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error; }
  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'steps') continue;
    let request;
    try { request = JSON.parse(await readFile(join(agents, entry.name, 'request.json'), 'utf8')); } catch { continue; }
    if (!inStep(request?.outputDirectory ?? request?.task?.outputDirectory)) continue;
    await rm(join(agents, entry.name), { recursive: true, force: true });
    removed.push(join(agents, entry.name));
  }
  const file = join(agents, 'sessions.json');
  let sessions: Record<string, { data?: string; workspace?: string }>;
  try { sessions = JSON.parse(await readFile(file, 'utf8')); } catch { return removed.length; }
  const kept = Object.fromEntries(Object.entries(sessions).filter(([, session]) =>
    !inStep(session?.workspace) && !removed.some(directory => inside(directory, session?.data))));
  if (Object.keys(kept).length !== Object.keys(sessions).length) {
    const temporary = `${file}.retry.tmp`;
    await writeFile(temporary, JSON.stringify(kept, null, 2), { mode: 0o600 }); await rename(temporary, file);
  }
  return removed.length;
}
