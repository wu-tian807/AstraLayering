import {renderPromptFile} from '../prompts/render.ts';
import { loadWorkflowEnvironment, type WorkflowEnvironment } from '../codex/environment.ts';
import { formatAgentError, agentOutcomeError } from '../codex/diagnostics.ts';
import { pipelineDirectory, resolveInput, resolveRunsDirectory, type PipelineId } from '../paths.ts';
import { appendFile, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runAgent, type Agent, type AgentRequest } from './agent.ts';
import { checkKrita, type KritaInstallation } from './krita.ts';
import type { StepDefinition } from './steps.ts';
import { readStep, type ChainStep, type StepStatus } from '../step-chain.ts';
import { runSection, type SectionPlan } from '../step-section.ts';
import { canonicalPath, fileInfo, initializeRun, loadConfig, newConfig, rasterSteps, saveConfig, within } from './run-store.ts';
import { buildReviewPrompt, discardReviewReports, nextReviewTask, runReviews } from './review.ts';
import { modelHarnesses } from '../agents/models.ts';
import { cliExecutable } from '../agents/cli.ts';
import { validateImageSelection } from '../agents/images.ts';
import { beginReview, finishReview, legacyEdgeDrawingReady } from './review-baseline.ts';

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
    const path = join(directory, file);
    try {
      const info = await stat(path);
      if (!info.isFile() || info.size === 0 || !within(directory, await realpath(path))) throw new Error('交付文件为空或位于输出目录以外');
    } catch (error) { throw new Error(`步骤尚不能完成，缺少有效交付：${file}`, { cause: error }); }
  }
}

export type KritaPipeline<Input> = {
  id: Extract<PipelineId, 'raster-layering' | 'clothing-raster-layering' | 'character-assembly' | 'shadow' | 'physics'>;
  directorySuffix?: string;
  tools?(output: string, input: Input, step: StepDefinition, phase: string): NonNullable<AgentRequest['tools']>;
  fingerprintInput?(input: Input): Promise<string>;
  // The upstream pipeline's final step; step01 records its stamp and reruns when it changes.
  upstreamStep?(input: Input): ChainStep;
  prepareStep?(output: string, input: Input, step: StepDefinition, krita: KritaInstallation): Promise<void>;
  prepareDelivery?(output: string, input: Input, step: StepDefinition): Promise<void>;
  validateDelivery?(output: string, input: Input, step: StepDefinition, krita: KritaInstallation, dryRun?: boolean): Promise<void>;
  steps: readonly StepDefinition[];
  resolveInput(name: string, root: string): Promise<Input>;
  validateInput(value: unknown): value is Input;
  inputDirectories(input: Input): readonly string[];
  buildPrompt(step: StepDefinition, input: Input, output: string, krita: KritaInstallation, previous: readonly string[]): Promise<string>;
};

// Upstream runs from before the step was recorded have no step directory; they
// are read as they are. An unfinished upstream step must finish first.
async function upstreamSteps(step: ChainStep | undefined): Promise<ChainStep[]> {
  if (!step) return [];
  const { status } = await readStep(step.directory);
  if (status === 'absent') return [];
  if (status !== 'completed') throw new Error(`上游步骤 ${step.id} 尚未完成（${step.directory}），请先完成上游再运行本管线。`);
  return [step];
}

export async function runWorkflow<Input>(pipeline: KritaPipeline<Input>, options: WorkflowOptions, dependencies: Dependencies = {}): Promise<string> {
  const root = resolveRunsDirectory(options.dir ?? dependencies.runsDirectory);
  if (pipeline.directorySuffix && !/^[a-z][a-z-]*$/.test(pipeline.directorySuffix)) throw new Error('无效的管线分支目录');
  const requested = join(pipelineDirectory(options.name, pipeline.id, root), pipeline.directorySuffix ?? '');
  const saved = await loadConfig<Input>(requested, options.name, pipeline.validateInput);
  const directory = await canonicalPath(requested);
  const environment = dependencies.environment ?? loadWorkflowEnvironment();
  const definitions: readonly StepDefinition[] = (dependencies.steps ?? pipeline.steps).map(step => ({ ...step,
    ...(step.modelStep ? environment.stepModels[step.modelStep] : step.modelTier ? environment.models[step.modelTier] : {}),
    ...(step.review ? { review: { ...step.review, ...(step.review.modelStep ? environment.stepModels[step.review.modelStep] : step.review.modelTier ? environment.models[step.review.modelTier] : {}) } } : {}),
  }));
  if (!dependencies.agent) for (const step of definitions) {
    for (const key of [step.modelStep, step.review?.modelStep, step.review?.repairModelStep]) if (key) {
      validateImageSelection(environment, key);
      if (environment.stepModels[key].harness !== 'codex') await cliExecutable(environment, environment.stepModels[key].harness);
    }
  }
  const reference = await pipeline.resolveInput(options.name, root);
  const fingerprint = await pipeline.fingerprintInput?.(reference);
  const inputChanged = !!saved && fingerprint !== undefined && saved.inputFingerprint !== fingerprint;
  const inputDirectories = pipeline.inputDirectories(reference);
  const upstream = await upstreamSteps(pipeline.upstreamStep?.(reference));
  for (const source of inputDirectories) {
    if (within(source, directory) || within(directory, source)) throw new Error('上游与本管线目录必须分开');
  }
  const configuredKrita = options.krita ?? saved?.krita.executable;
  if (!configuredKrita?.trim()) throw new Error('首次运行必须提供 --krita <已安装的 Krita 可执行文件路径>。');
  const kritaPath = options.krita === undefined ? configuredKrita : resolveInput(options.name, configuredKrita, root);
  const krita = await (dependencies.preflight ? dependencies.preflight(kritaPath) : checkKrita(kritaPath, undefined, environment.codex.env));
  const config = !saved || inputChanged ? newConfig(options.name, reference, krita) : saved;
  if (fingerprint !== undefined) config.inputFingerprint = fingerprint;
  config.sourceInput = reference;
  config.krita = krita;
  options.progress?.(`前置检查通过：Krita ${krita.version} (${krita.executable})`);
  options.progress?.(`任务目录：${directory}；直接读取上游：${inputDirectories.join('、')}`);

  const previous: string[] = [];
  const previews: string[] = [];
  const byId = new Map(definitions.map(step => [step.id, step]));
  await runSection({ directory, steps: rasterSteps(definitions, upstream.map(step => step.id)), upstream, dryRun: options.dryRun, signal: options.signal,
    progress: options.progress, fresh: inputChanged, resetNote: '，并清除旧 threadId',
    // Validate retained deliveries before making any reset destructive.
    async keep(chainStep) {
      const step = byId.get(chainStep.id)!;
      try { await checkFiles(chainStep.directory, step.requiredFiles); }
      catch (error) { throw new Error(`${step.id} 已标记完成但交付缺失；请恢复文件，或删除 ${step.id}/.completed 触发重跑。`, { cause: error }); }
      await pipeline.validateDelivery?.(chainStep.directory, reference, step, krita, options.dryRun);
    },
    async prepare(plan) {
      if (inputChanged) {
        const archive = directory + '.previous-' + randomUUID();
        await rename(directory, archive);
        options.progress?.(`输入或制作规则已变化；旧分支已保留到 ${archive}，重新制作本分支。`);
      }
      if (!saved || inputChanged) await initializeRun(directory, config);
      else await saveConfig(directory, config);
      // The drawing thread carries the work of the steps being redone.
      if (plan.reset.length) { config.threadId = null; delete config.threadHandoff; await saveConfig(directory, config); }
    },
    step: (chainStep, status, plan) => stepWork(byId.get(chainStep.id)!, status, plan),
  });
  if (options.dryRun) return previews.join('\n\n') || '当前已定义步骤均已完成；无需调用模型。';
  return `已完成当前已定义步骤。交付目录：${previous.at(-1) ?? directory}`;

  async function stepWork(step: StepDefinition, status: StepStatus, plan: SectionPlan): Promise<(() => Promise<void>) | undefined> {
    const output = join(directory, step.id);
    const drawingReady = status !== 'absent' && (step.review ? !!await fileInfo(join(output, 'report.md'))
      : status === 'running' && await legacyEdgeDrawingReady(output, step));
    const reviewTask = step.review && drawingReady ? await nextReviewTask(output) : undefined;
    if (status === 'completed' && (!step.review || !reviewTask)) {
      options.progress?.(`${step.id}：.completed 已存在，跳过`);
      previous.push(output);
      return;
    }
    const model = step;
    if (options.dryRun) {
      if (!drawingReady) previews.push(await pipeline.buildPrompt(step, reference, output, krita, previous));
      if (step.review) {
        const task = drawingReady ? reviewTask : { kind: 'review' as const, filename: 'review-01.md' as const, index: 0 };
        if (task) previews.push(await buildReviewPrompt(step, task, krita));
      }
      options.progress?.(`${step.id}：${drawingReady ? '接续 review / 修复' : status === 'running' ? '恢复未完成步骤' : '开始步骤'} (${model.model} / ${model.effort})`);
      previous.push(output);
      return async () => {};
    }
    await mkdir(output, { recursive: true });
    let lastAgentMessage = '';
    let lastThreadId: string | undefined;
    if(step.freshSession&&config.threadStep!==step.id){
      await appendFile(join(output,'attempts.jsonl'),JSON.stringify({previousThreadId:config.threadId,reason:'独立步骤会话',step:step.id,at:new Date().toISOString()})+'\n');
      config.threadId=null;delete config.threadHarness;delete config.threadHandoff;config.threadStep=step.id;await saveConfig(directory,config);
    }
    const invoke = async (prompt: string, phase: string, fresh = false) => {
      lastAgentMessage = '';
      lastThreadId = fresh ? undefined : config.threadId ?? undefined;
      const attempt = randomUUID();
      const key = fresh ? step.review?.modelStep : phase.startsWith('repair') ? step.review?.repairModelStep : step.modelStep;
      const selected = key ? environment.stepModels[key] : fresh ? step.review! : model;
      const harness = 'harness' in selected ? selected.harness : modelHarnesses[selected.model as keyof typeof modelHarnesses] || 'codex';
      if (!fresh && config.threadId && (config.threadHarness || 'codex') !== harness) {
        await appendFile(join(output, 'attempts.jsonl'), JSON.stringify({ previousThreadId: config.threadId,
          previousHarness: config.threadHarness || 'codex', harness, reason: '模型配置切换 CLI', at: new Date().toISOString() }) + '\n');
        config.threadId = null; await saveConfig(directory, config);
      }
      const handoff = !fresh && !config.threadId ? config.threadHandoff : undefined;
      if (!fresh && phase !== 'draw' && !config.threadId && !handoff) prompt = renderPromptFile(new URL('../prompts/raster-repair-resume.md',import.meta.url),{drawing_prompt:await pipeline.buildPrompt(step, reference, output, krita, previous),repair_prompt:prompt});
      if (handoff) {
        const notes = await readFile(handoff.notes, 'utf8');
        if (!notes.trim()) throw new Error('替代 thread 的交接记录为空：' + handoff.notes);
        // A new repair thread also needs the original drawing task and inputs.
        if (phase !== 'draw') prompt = renderPromptFile(new URL('../prompts/raster-handoff-repair.md',import.meta.url),{drawing_prompt:await pipeline.buildPrompt(step, reference, output, krita, previous),repair_prompt:prompt});
        prompt = renderPromptFile(new URL('../prompts/raster-handoff.md',import.meta.url),{
          task_prompt:prompt, previous_thread_id:handoff.previousThreadId, reason:handoff.reason,
          step_id:step.id, phase, notes,
        });
      }
      await writeFile(join(output, phase === 'draw' ? 'prompt.md' : `${phase}.prompt.txt`), prompt);
      await appendFile(join(output, 'attempts.jsonl'), JSON.stringify({ attempt, phase, startedAt: new Date().toISOString(),
        model: selected.model, effort: selected.effort, krita, ...(fresh ? {} : { threadId: config.threadId }) }) + '\n');
      const resultFile = join(output, phase === 'draw' ? 'result.json' : `${phase}.result.json`);
      await rm(resultFile, { force: true });
      await rm(join(output, 'error.txt'), { force: true });
      options.progress?.(`${step.id} ${phase}：${fresh ? '新建 reviewer 会话' : config.threadId ? '继续原 thread' : '新建 thread'} (${selected.model} / ${selected.effort})`);
      const result = await (dependencies.agent ?? runAgent)({
        prompt, directory, model: selected.model, effort: selected.effort, environment, step: key,
        tools: pipeline.tools?.(output, reference, step, phase),
        imageNormalization: { env: environment.codex.env, krita: krita.executable, runsRoot: root, progress: options.progress },
        imageRoots: [dirname(directory), ...inputDirectories],
        recoveryPrompt: config.threadId && !fresh && phase !== 'draw' ? renderPromptFile(new URL('../prompts/raster-repair-resume.md',import.meta.url),{drawing_prompt:await pipeline.buildPrompt(step, reference, output, krita, previous),repair_prompt:prompt}) : undefined,
        threadId: fresh ? undefined : config.threadId ?? undefined, signal: options.signal,
        onThreadReplacement: async (oldId, reason) => {
          await appendFile(join(output, 'attempts.jsonl'), JSON.stringify({ oldId, reason, phase, at: new Date().toISOString() }) + '\n');
          if (!fresh) { config.threadId = null; await saveConfig(directory, config); }
        },
        onRetry: async retry => {
          options.progress?.(`${step.id} ${phase}：临时服务错误，${retry.delayMs / 1000} 秒后重试，沿用原 thread 与产物。`);
          await appendFile(join(output, 'attempts.jsonl'), JSON.stringify({ attempt, phase, retry: retry.nextAttempt, delayMs: retry.delayMs, error: retry.error instanceof Error ? retry.error.message : String(retry.error) }) + '\n');
        },
        onEvent: async event => {
          if (event.type === 'item.completed' && event.item.type === 'agent_message') lastAgentMessage = event.item.text;
          if (event.type === 'thread.started') {
            lastThreadId = event.thread_id;
            if (fresh) return; // Reviewer sessions are never saved or resumed.
            if (!event.thread_id.trim() || (config.threadId && config.threadId !== event.thread_id)) throw new Error('SDK 返回了不同的 threadId；拒绝替换当前会话。');
            config.threadId = event.thread_id;
            config.threadHarness = harness;
            if (handoff) handoff.replacementThreadId = event.thread_id;
            await saveConfig(directory, config);
          }
          await appendFile(join(output, 'events.jsonl'), JSON.stringify({ attempt, phase, event }) + '\n');
          if (event.type === 'item.completed' && event.item.type === 'agent_message') options.progress?.(event.item.text);
          if (event.type === 'error') options.progress?.(`SDK：${event.message}`);
        },
      });
      if (!lastAgentMessage) lastAgentMessage = result.summary;
      await writeFile(resultFile, JSON.stringify(result, null, 2) + '\n');
      return result;
    };
    return async () => { try {
      await pipeline.prepareStep?.(output, reference, step, krita);
      if (!drawingReady) {
        if (step.review) {
          await discardReviewReports(output);
          await rm(join(output, 'report.md.tmp'), { force: true });
        }
        const result = await invoke(await pipeline.buildPrompt(step, reference, output, krita, previous), 'draw');
        if (result.status !== 'completed') throw new Error(`步骤未完成：${result.summary}`);
        if (!config.threadId) throw new Error('SDK 未返回 threadId，不能完成步骤。');
        const required = step.requiredFiles.map(file => step.review && file === 'report.md' ? 'report.md.tmp' : file);
        await checkFiles(output, required);
        options.signal?.throwIfAborted();
        if (step.review) await rename(join(output, 'report.md.tmp'), join(output, 'report.md'));
      }
      if (step.review) {
        // Keep the original baseline across interrupted repairs. A read-only
        // review must not discard already completed downstream artwork.
        if (!await fileInfo(join(output, 'review-baseline.json'))) await beginReview(output, step);
        // An interrupted repair may still need to regenerate a deliverable.
        if (!drawingReady || reviewTask?.kind !== 'repair') await checkFiles(output, step.requiredFiles);
        await runReviews({ step, directory: output, krita, signal: options.signal, progress: options.progress,
          invoke: (prompt, task) => invoke(prompt, task.filename.slice(0, -3), task.kind === 'review'),
          validate: () => checkFiles(output, step.requiredFiles),
        });
      }
      if (fingerprint !== undefined && await pipeline.fingerprintInput?.(reference) !== fingerprint) throw new Error('制作期间上游输入改变，保留进度；续跑将重新制作本分支。');
      await pipeline.prepareDelivery?.(output, reference, step);
      await checkFiles(output, step.requiredFiles);
      await pipeline.validateDelivery?.(output, reference, step, krita);
      options.signal?.throwIfAborted();
      if (step.review) await finishReview(directory, step, plan, options.progress);
      options.progress?.(`${step.id}：交付检查通过，写入 .completed`);
      previous.push(output);
    } catch (error) {
      const failure = agentOutcomeError(error instanceof Error ? error.message : String(error),
        { text: lastAgentMessage, threadId: lastThreadId }, error);
      const message = formatAgentError(failure);
      await writeFile(join(output, 'error.txt'), message + '\n');
      options.progress?.(message);
      throw failure;
    } };
  }
}
