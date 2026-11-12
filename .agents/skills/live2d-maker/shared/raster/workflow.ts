import { prepareWorkspace, workspacePrompt } from '../agents/workspace.ts';
import { publishReportAssets } from '../report-assets.ts';
import { runtimePrompt, stepKnowledge } from '../knowledge.ts';
import { loadWorkflowEnvironment, type WorkflowEnvironment } from '../codex/environment.ts';
import { formatAgentError, agentOutcomeError } from '../codex/diagnostics.ts';
import { CheckFailure, maxRepairs } from '../codex/checked-turn.ts';
import { retryDelays } from '../codex/agent-runtime.ts';
import { sectionDirectory, resolveInput, resolveRunsDirectory, type SectionId } from '../paths.ts';
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runAgent, type Agent, type AgentRequest } from './agent.ts';
import { checkKrita, type KritaInstallation } from './krita.ts';
import type { StepDefinition } from './steps.ts';
import { readStep, type ChainStep, type StepStatus } from '../step-chain.ts';
import { runSection } from '../step-section.ts';
import { clearStepSession, readStepSession, writeStepSession, type StepSession } from '../agents/step-session.ts';
import { canonicalPath, fileInfo, rasterSteps, within } from './run-store.ts';
import { taskRootOf } from '../task-paths.ts';
import { buildReviewPrompt, discardReviewReports, nextReviewTask, runReviews } from './review.ts';
import { modelHarnesses } from '../agents/models.ts';
import { requireCurrentLayout } from '../../workflow/layout.ts';
import { cliExecutable } from '../agents/cli.ts';
import { validateImageSelection } from '../agents/images.ts';
import { SectionKrita, kritaRecordFile } from '../krita/section-krita.ts';
import { createKritaTool } from '../krita/tool.ts';

export type WorkflowOptions = {
  name: string;
  dir?: string;
  krita?: string;
  dryRun?: boolean;
  signal?: AbortSignal;
  progress?: (message: string) => void;
};
export type Dependencies = {
  agent?: Agent;
  environment?: WorkflowEnvironment;
  preflight?: (path: string) => Promise<KritaInstallation>;
  steps?: readonly StepDefinition[];
  runsDirectory?: string; // Optional injected root; explicit --dir takes precedence.
};

async function checkFiles(directory: string, files: readonly string[]): Promise<void> {
  for (const file of files) {
    const info = await stat(join(directory, file)).catch(() => undefined);
    if (!info) throw new CheckFailure('missing-file', `步骤尚不能完成，缺少有效交付：${file}`, { detail: `交付 ${file} 未生成` });
    if (!info.isFile() || info.size === 0) throw new CheckFailure('invalid-output', `步骤尚不能完成，交付为空或不是普通文件：${file}`, { detail: `交付 ${file} 为空或不是普通文件` });
  }
}

export type Passthrough = { reason: string; deliver(): Promise<void> };
export type KritaSection<Input> = {
  id: Extract<SectionId, 'raster-layering' | 'clothing-raster-layering' | 'character-assembly' | 'shadow'>;
  // `krita`: the section's Krita, reserved when the step uses Krita.
  tools?(output: string, input: Input, step: StepDefinition, phase: string, krita?: SectionKrita): NonNullable<AgentRequest['tools']>;
  // The upstream section's final step, which must be completed before this section runs.
  upstreamStep?(input: Input): ChainStep;
  prepareStep?(output: string, input: Input, step: StepDefinition, krita: KritaInstallation): Promise<void>;
  prepareDelivery?(output: string, input: Input, step: StepDefinition): Promise<void>;
  validateDelivery?(output: string, input: Input, step: StepDefinition, krita: KritaInstallation, dryRun?: boolean): Promise<void>;
  deliveryWarnings?(input: Input, step: StepDefinition): Promise<readonly string[]>;
  // A step this input needs no agent for: deliver() writes its required files
  // itself, e.g. copies the upstream result when there is no dress-up to strip.
  passthrough?(output: string, input: Input, step: StepDefinition): Promise<Passthrough | undefined>;
  steps: readonly StepDefinition[];
  resolveInput(name: string, root: string): Promise<Input>;
  validateInput(value: unknown): value is Input;
  inputDirectories(input: Input): readonly string[];
  buildPrompt(step: StepDefinition, input: Input, output: string, previous: readonly string[]): Promise<string>;
};

// Upstream runs from before the step was recorded have no step directory; they
// are read as they are. An unfinished upstream step must finish first.
async function requireUpstreamStep(step: ChainStep | undefined): Promise<void> {
  if (!step) return;
  const { status } = await readStep(step.directory);
  if (status !== 'absent' && status !== 'completed') throw new Error(`上游步骤 ${step.id} 尚未完成（${step.directory}），请先完成上游再运行本管线。`);
}

export async function runWorkflow<Input>(section: KritaSection<Input>, options: WorkflowOptions, dependencies: Dependencies = {}): Promise<string> {
  const root = resolveRunsDirectory(options.dir ?? dependencies.runsDirectory);
  const requested = sectionDirectory(options.name, section.id, root);
  await requireCurrentLayout(dirname(requested));
  const info = await fileInfo(requested);
  if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error(`管线目录必须是普通目录：${requested}`);
  const directory = await canonicalPath(requested);
  const environment = dependencies.environment ?? loadWorkflowEnvironment();
  const definitions: readonly StepDefinition[] = (dependencies.steps ?? section.steps).map(step => ({ ...step,
    ...(step.modelStep ? environment.stepModels[step.modelStep] : step.modelTier ? environment.models[step.modelTier] : {}),
    ...(step.review ? { review: { ...step.review, ...(step.review.modelStep ? environment.stepModels[step.review.modelStep] : step.review.modelTier ? environment.models[step.review.modelTier] : {}) } } : {}),
  }));
  if (!dependencies.agent) for (const step of definitions) {
    for (const key of [step.modelStep, step.review?.modelStep, step.review?.repairModelStep]) if (key) {
      validateImageSelection(environment, key);
      if (environment.stepModels[key].harness !== 'codex') await cliExecutable(environment, environment.stepModels[key].harness);
    }
  }
  const reference = await section.resolveInput(options.name, root);
  const inputDirectories = section.inputDirectories(reference);
  await requireUpstreamStep(section.upstreamStep?.(reference));
  for (const source of inputDirectories) {
    if (within(source, directory) || within(directory, source)) throw new Error('上游与本管线目录必须分开');
  }
  // The section keeps no state of its own: every run is given its Krita.
  if (!options.krita?.trim()) throw new Error('必须提供 --krita <已安装的 Krita 可执行文件路径>。');
  const kritaPath = resolveInput(options.name, options.krita, root);
  const krita = await (dependencies.preflight ? dependencies.preflight(kritaPath) : checkKrita(kritaPath, environment.codex.env));
  const taskRoot = taskRootOf(directory);
  options.progress?.(`前置检查通过：Krita ${krita.executable}`);
  options.progress?.(`任务目录：${directory}；直接读取上游：${inputDirectories.join('、')}`);

  const previous: string[] = [];
  const previews: string[] = [];
  const byId = new Map(definitions.map(step => [step.id, step]));
  // The section's own Krita. A step whose definition does not opt out with
  // `krita: false` reserves a machine-wide Krita slot before it starts (queueing
  // while all are taken) and its drawing, review and repair agents get the krita tool;
  // other steps get neither. The slot and Krita are released when the section ends.
  const sectionKrita = new SectionKrita({ section: directory, krita: krita.executable, env: environment.codex.env,
    record: join(directory, kritaRecordFile) });
  const kritaTool = createKritaTool(sectionKrita, taskRoot);
  try { await runSection({ directory, steps: rasterSteps(definitions), dryRun: options.dryRun, signal: options.signal,
    progress: options.progress,
    // Validate retained deliveries before running anything.
    async keep(chainStep) {
      const step = byId.get(chainStep.id)!;
      try { await checkFiles(chainStep.directory, step.requiredFiles); }
      catch (error) { throw new Error(`${step.id} 已标记完成但交付缺失；请恢复文件，或重试该步骤（网页「重试」或 --retry）。`, { cause: error }); }
      await section.validateDelivery?.(chainStep.directory, reference, step, krita, options.dryRun);
      if (!options.dryRun) await logDeliveryWarnings(step);
    },
    async prepare() { await mkdir(directory, { recursive: true }); },
    step: (chainStep, status) => stepWork(byId.get(chainStep.id)!, status),
  }); } finally { await sectionKrita.release(); }
  if (options.dryRun) return previews.join('\n\n') || '当前已定义步骤均已完成；无需调用模型。';
  return `已完成当前已定义步骤。交付目录：${previous.at(-1) ?? directory}`;

  async function logDeliveryWarnings(step: StepDefinition) {
    for (const warning of await section.deliveryWarnings?.(reference, step) ?? []) {
      options.progress?.(`${step.id} 结构检查提示：${warning}`);
    }
  }

  async function stepWork(step: StepDefinition, status: StepStatus): Promise<(() => Promise<void>) | undefined> {
    const output = join(directory, step.id);
    const records = join(directory, 'agents', 'steps', step.id);
    if (!options.dryRun) await mkdir(records, { recursive: true });
    // A step's thread carries that step's work; a step starting over (its
    // directory removed) starts a new one.
    if (status === 'absent' && !options.dryRun) await clearStepSession(directory, step.id, '步骤重新开始');
    const drawingReady = status !== 'absent' && !!step.review && !!await fileInfo(join(output, 'report.md'));
    if (status === 'completed') {
      options.progress?.(`${step.id}：.completed 已存在，跳过`);
      previous.push(output);
      return;
    }
    const reviewTask = step.review && drawingReady ? await nextReviewTask(output) : undefined;
    const passthrough = await section.passthrough?.(output, reference, step);
    if (passthrough) {
      options.progress?.(`${step.id}：${passthrough.reason}，不调用 agent`);
      previous.push(output);
      return async () => {
        if (options.dryRun) return;
        await mkdir(output, { recursive: true });
        await passthrough.deliver();
        await checkFiles(output, step.requiredFiles);
        options.signal?.throwIfAborted();
      };
    }
    const model = step;
    if (options.dryRun) {
      if (!drawingReady) previews.push(await section.buildPrompt(step, reference, output, previous));
      if (step.review) {
        const task = drawingReady ? reviewTask : { kind: 'review' as const, filename: 'review-01.md' as const, index: 0 };
        if (task) previews.push(await buildReviewPrompt(step, task));
      }
      options.progress?.(`${step.id}：${drawingReady ? '接续 review / 修复' : status === 'running' ? '恢复未完成步骤' : '开始步骤'} (${model.model} / ${model.effort})`);
      previous.push(output);
      return async () => {};
    }
    let lastAgentMessage = '';
    let lastThreadId: string | undefined, lastAttempt = '';
    // The step's own drawing session (agents/steps/<step>/session.json).
    let session: StepSession = {};
    const saveSession = async (next: StepSession, reason?: string) => { await writeStepSession(directory, step.id, next, reason); session = next; };
    const invoke = async (prompt: string, phase: string, fresh = false, verify?: () => Promise<void>) => {
      lastAgentMessage = '';
      if (!fresh) session = await readStepSession(directory, step.id) ?? {};
      lastThreadId = fresh ? undefined : session.threadId;
      const attempt = randomUUID();
      lastAttempt = attempt;
      const key = fresh ? step.review?.modelStep : phase.startsWith('repair') ? step.review?.repairModelStep : step.modelStep;
      const selected = key ? environment.stepModels[key] : fresh ? step.review! : model;
      const harness = 'harness' in selected ? selected.harness : modelHarnesses[selected.model as keyof typeof modelHarnesses] || 'codex';
      // Each step draws in its own thread; its draw and repairs share it. A thread
      // keeps the tools it started with (Codex ignores tools sent on resume).
      if (!fresh && session.threadId && (session.harness || 'codex') !== harness) {
        await appendFile(join(records, 'attempts.jsonl'), JSON.stringify({ previousThreadId: session.threadId,
          previousHarness: session.harness || 'codex', harness, reason: '模型配置切换 CLI', at: new Date().toISOString() }) + '\n');
        await saveSession({}, '模型配置切换 CLI');
      }
      // A repair in a new thread also needs the original drawing task and inputs.
      const repairPrompt = prompt;
      const resumeRepair = async (repair: string) => `${await section.buildPrompt(step, reference, output, previous)}\n\n${runtimePrompt('raster-repair-resume')}${repair}`;
      if (!fresh && phase !== 'draw' && !session.threadId) prompt = await resumeRepair(prompt);
      const paths = await prepareWorkspace({ cwd: directory, outputDirectory: output }, directory);
      prompt = workspacePrompt(prompt, paths);
      await writeFile(join(records, phase === 'draw' ? 'prompt.md' : `${phase}.prompt.txt`), prompt);
      await appendFile(join(records, 'attempts.jsonl'), JSON.stringify({ attempt, phase, startedAt: new Date().toISOString(),
        model: selected.model, effort: selected.effort, krita, ...(fresh ? {} : { threadId: session.threadId ?? null }) }) + '\n');
      const resultFile = join(records, phase === 'draw' ? 'result.json' : `${phase}.result.json`);
      await rm(resultFile, { force: true });
      await rm(join(records, 'error.txt'), { force: true });
      options.progress?.(`${step.id} ${phase}：${fresh ? '新建 reviewer 会话' : session.threadId ? '继续原 thread' : '新建 thread'} (${selected.model} / ${selected.effort})`);
      const result = await (dependencies.agent ?? runAgent)({
        prompt, directory, outputDirectory: output, model: selected.model, effort: selected.effort, environment, step: key,
        tools: stepKnowledge(step.knowledge.section, step.knowledge.step).tools(fresh ? 'review' : phase === 'draw' ? 'main' : 'repair', [
          ...section.tools?.(output, reference, step, phase, sectionKrita) ?? [],
          // Drawing, review and repairs run one after another in this section
          // and share its Krita; a fresh reviewer thread is still the same section.
          ...(step.krita === false || !sectionKrita.reserved ? [] : [kritaTool])]),
        imageNormalization: { env: environment.codex.env, runsRoot: root, progress: options.progress },
        recoveryPrompt: session.threadId && !fresh && phase !== 'draw' ? workspacePrompt(await resumeRepair(repairPrompt), paths) : undefined,
        threadId: fresh ? undefined : session.threadId, signal: options.signal, verify,
        onThreadReplacement: async (oldId, reason) => {
          await appendFile(join(records, 'attempts.jsonl'), JSON.stringify({ oldId, reason, phase, at: new Date().toISOString() }) + '\n');
          if (!fresh) await saveSession({}, reason);
        },
        onRetry: async retry => {
          options.progress?.(`${step.id} ${phase}：限流等待（${retry.rateLimited ? '429' : '临时错误'}），保留并发位置，${retry.delayMs / 1000} 秒后第 ${retry.attempt}/${retryDelays.retries} 次重试，沿用原 thread 与产物。`);
          await appendFile(join(records, 'attempts.jsonl'), JSON.stringify({ attempt, phase, retry: retry.nextAttempt, delayMs: retry.delayMs, rateLimited: retry.rateLimited, error: retry.error instanceof Error ? retry.error.message : String(retry.error) }) + '\n');
        },
        onEvent: async event => {
          if (event.type === 'item.completed' && event.item.type === 'agent_message') lastAgentMessage = event.item.text;
          if (event.type === 'thread.started') {
            lastThreadId = event.thread_id;
            if (fresh) return; // Reviewer sessions are never saved or resumed.
            if (!event.thread_id.trim() || (session.threadId && session.threadId !== event.thread_id)) throw new Error('SDK 返回了不同的 threadId；拒绝替换当前会话。');
            if (session.threadId !== event.thread_id) await saveSession({ threadId: event.thread_id, harness });
          }
          await appendFile(join(records, 'events.jsonl'), JSON.stringify({ attempt, phase, event }) + '\n');
          if (event.type === 'item.completed' && event.item.type === 'agent_message') options.progress?.(event.item.text);
          if (event.type === 'error') options.progress?.(`SDK：${event.message}`);
        },
      });
      if (!lastAgentMessage) lastAgentMessage = result.summary;
      await writeFile(resultFile, JSON.stringify(result, null, 2) + '\n');
      return result;
    };
    if (step.krita !== false) await sectionKrita.reserve(options.signal, waiting => options.progress?.(`${step.id}：${waiting}`));
    // A failed program check goes back to the step's own thread as a repair turn
    // (at most maxRepairs per attempt).
    const repairing = async (check: () => Promise<void>) => {
      for (let round = 1; ; round++) {
        try { await check(); return; }
        catch (error) {
          options.signal?.throwIfAborted();
          const message = error instanceof Error ? error.message : String(error);
          if (round > maxRepairs) {
            throw new Error(`${message}（已返修 ${maxRepairs} 次仍未通过；继续仍接回同一会话，会话已无法推进时请用“恢复”换新会话）`, { cause: error });
          }
          const code = error instanceof CheckFailure ? error.code : 'invalid-output';
          const values = error instanceof CheckFailure ? error.values : { detail: message };
          const problems = runtimePrompt(`checks/${code}`, values);
          const repair = runtimePrompt('check-repair', { problems, round: String(round), max: String(maxRepairs) });
          const result = await invoke(repair, `repair-check-${round}`);
          if (result.status !== 'completed') throw new Error(`步骤未完成：${result.summary}`);
        }
      }
    };
    return async () => { try {
      await section.prepareStep?.(output, reference, step, krita);
      if (!drawingReady) {
        if (step.review) {
          await discardReviewReports(output);
          await rm(join(output, 'report.md.tmp'), { force: true });
        }
        const result = await invoke(await section.buildPrompt(step, reference, output, previous), 'draw');
        if (result.status !== 'completed') throw new Error(`步骤未完成：${result.summary}`);
        if (!session.threadId) throw new Error('SDK 未返回 threadId，不能完成步骤。');
        const required = step.requiredFiles.map(file => step.review && file === 'report.md' ? 'report.md.tmp' : file);
        await repairing(() => checkFiles(output, required));
        options.signal?.throwIfAborted();
        if (step.review) await rename(join(output, 'report.md.tmp'), join(output, 'report.md'));
      }
      if (step.review) {
        // An interrupted repair may still need to regenerate a deliverable.
        if (!drawingReady || reviewTask?.kind !== 'repair') await repairing(() => checkFiles(output, step.requiredFiles));
        await runReviews({ step, directory: output, signal: options.signal, progress: options.progress,
          invoke: (prompt, task, verify) => invoke(prompt, task.filename.slice(0, -3), task.kind === 'review', verify),
          validate: () => repairing(() => checkFiles(output, step.requiredFiles)),
        });
      }
      await section.prepareDelivery?.(output, reference, step);
      await publishReportAssets(join(output, 'report.md'), join(output, 'workspace'));
      await repairing(async () => {
        await checkFiles(output, step.requiredFiles);
        await section.validateDelivery?.(output, reference, step, krita);
      });
      await logDeliveryWarnings(step);
      options.signal?.throwIfAborted();
      options.progress?.(`${step.id}：交付检查通过，写入 .completed`);
      previous.push(output);
    } catch (error) {
      const failure = agentOutcomeError(error instanceof Error ? error.message : String(error),
        { text: lastAgentMessage, threadId: lastThreadId }, error);
      const message = formatAgentError(failure);
      await writeFile(join(records, 'error.txt'), message + '\n');
      options.progress?.(message);
      throw failure;
    } };
  }
}
