import { appendFile, mkdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runAgent, type Agent } from './agent.ts';
import { resolvePartInput } from './input.ts';
import { checkKrita, type KritaInstallation } from './krita.ts';
import { buildPrompt, steps, type StepDefinition } from './steps.ts';
import { canonicalPath, fileInfo, initializeRun, inspectRun, loadConfig, newConfig, resetSteps, runDirectory, saveConfig, within } from './run-store.ts';
import { buildReviewPrompt, discardReviewReports, nextReviewTask, runReviews } from './review.ts';

export type WorkflowOptions = {
  name: string;
  input?: string;
  krita?: string;
  dryRun?: boolean;
  signal?: AbortSignal;
  progress?: (message: string) => void;
};
type Dependencies = {
  agent?: Agent;
  preflight?: (path: string) => Promise<KritaInstallation>;
  steps?: readonly StepDefinition[];
  runsDirectory?: string; // Test isolation only; the CLI always uses the module's .run/.
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

export async function runWorkflow(options: WorkflowOptions, dependencies: Dependencies = {}): Promise<string> {
  const requested = runDirectory(options.name, dependencies.runsDirectory);
  const saved = await loadConfig(requested, options.name);
  const directory = await canonicalPath(requested);
  const definitions: readonly StepDefinition[] = dependencies.steps ?? steps;
  const plan = await inspectRun(directory, definitions);
  let source = saved?.sourceInput;
  if (!saved) {
    if (!options.input?.trim()) throw new Error('首次运行必须提供 --input <clothing-part-layering运行目录>。');
    source = await resolvePartInput(options.input);
    if (within(source.directory, directory) || within(directory, source.directory)
      || within(source.parts, directory) || within(directory, source.parts)) throw new Error('输入与任务目录必须分开，不能相同或相互包含。');
  } else if (options.input) {
    const supplied = await resolvePartInput(options.input);
    if (supplied.directory !== saved.sourceInput.directory || supplied.parts !== saved.sourceInput.parts) {
      throw new Error('该 --name 已绑定另一份输入；请为新输入使用新的 --name。');
    }
  }
  const reference = saved ? await resolvePartInput(join(directory, 'input')) : { directory: join(directory, 'input'), parts: join(directory, 'input/parts') };
  const kritaPath = options.krita ?? saved?.krita.executable;
  if (!kritaPath?.trim()) throw new Error('首次运行必须提供 --krita <已安装的 Krita 可执行文件路径>。');
  const krita = await (dependencies.preflight ?? checkKrita)(kritaPath);
  const config = saved ?? newConfig(options.name, source!, krita, definitions);
  config.krita = krita;
  for (const step of definitions) config.models[step.id] ??= { model: step.model, effort: step.effort };
  options.progress?.(`前置检查通过：Krita ${krita.version} (${krita.executable})`);
  options.progress?.(`任务目录：${directory}；输入${saved ? '副本' : '将保存到'}：${reference.directory}`);
  if (plan.resetFrom !== undefined) options.progress?.(`${options.dryRun ? '预览：将' : '将'}重置 step${String(plan.resetFrom).padStart(2, '0')} 及后续步骤，并清除旧 threadId。`);

  const previous: string[] = [];
  const previews: string[] = [];
  // Validate retained deliveries before making any reset destructive.
  for (const [index, step] of definitions.entries()) {
    if ((plan.resetFrom === undefined || index + 1 < plan.resetFrom) && plan.statuses.get(step.id) === 'completed') {
      try { await checkFiles(join(directory, step.id), step.requiredFiles); }
      catch (error) { throw new Error(`${step.id} 已标记完成但交付缺失；请恢复文件，或删除 ${step.id}/.completed 触发重跑。`, { cause: error }); }
    }
  }
  if (!options.dryRun) {
    options.signal?.throwIfAborted();
    if (!saved) await initializeRun(directory, config);
    else await saveConfig(directory, config);
    await resetSteps(directory, config, plan);
  }

  for (const [index, step] of definitions.entries()) {
    options.signal?.throwIfAborted();
    const output = join(directory, step.id);
    const status = plan.resetFrom !== undefined && index + 1 >= plan.resetFrom ? 'absent' : plan.statuses.get(step.id);
    const drawingReady = !!step.review && status !== 'absent' && !!await fileInfo(join(output, 'report.md'));
    const reviewTask = step.review && drawingReady ? await nextReviewTask(output) : undefined;
    if (status === 'completed' && (!step.review || !reviewTask)) {
      options.progress?.(`${step.id}：.completed 已存在，跳过`);
      previous.push(output);
      continue;
    }
    const model = config.models[step.id];
    if (options.dryRun) {
      if (!drawingReady) previews.push(await buildPrompt(step, reference, output, krita, previous));
      if (step.review) {
        const task = drawingReady ? reviewTask : { kind: 'review' as const, filename: 'review-01.md' as const, index: 0 };
        if (task) previews.push(await buildReviewPrompt(step, task, krita));
      }
      options.progress?.(`${step.id}：${drawingReady ? '接续 review / 修复' : status === 'running' ? '恢复未完成步骤' : '开始步骤'} (${model.model} / ${model.effort})`);
      previous.push(output);
      continue;
    }
    await mkdir(output, { recursive: true });
    if (status === 'completed') await rename(join(output, '.completed'), join(output, '.running'));
    else if (status !== 'running') await writeFile(join(output, '.running'), '', { flag: 'wx' });
    if (step.review) {
      // Reopened review can change this step's artifacts. Invalidate descendants,
      // including after an interruption between reopening and deleting them.
      for (const [id, laterStatus] of [...plan.statuses].reverse()) {
        if (Number(id.slice(4)) > index + 1 && laterStatus !== 'absent') {
          await rm(join(directory, id), { recursive: true, force: true });
          plan.statuses.set(id, 'absent');
        }
      }
    }
    const invoke = async (prompt: string, phase: string, fresh = false) => {
      const attempt = randomUUID();
      const selected = fresh ? step.review! : model;
      if (!fresh && phase !== 'draw' && !config.threadId) throw new Error('缺少原绘制 threadId，无法继续修复。');
      await writeFile(join(output, phase === 'draw' ? 'prompt.md' : `${phase}.prompt.txt`), prompt);
      await appendFile(join(output, 'attempts.jsonl'), JSON.stringify({ attempt, phase, startedAt: new Date().toISOString(),
        model: selected.model, effort: selected.effort, krita, ...(fresh ? {} : { threadId: config.threadId }) }) + '\n');
      const resultFile = join(output, phase === 'draw' ? 'result.json' : `${phase}.result.json`);
      await rm(resultFile, { force: true });
      await rm(join(output, 'error.txt'), { force: true });
      options.progress?.(`${step.id} ${phase}：${fresh ? '新建 reviewer 会话' : config.threadId ? '继续原 thread' : '新建 thread'} (${selected.model} / ${selected.effort})`);
      const result = await (dependencies.agent ?? runAgent)({
        prompt, directory, model: selected.model, effort: selected.effort,
        threadId: fresh ? undefined : config.threadId ?? undefined, signal: options.signal,
        onEvent: async event => {
          if (event.type === 'thread.started') {
            if (fresh) return; // Reviewer sessions are never saved or resumed.
            if (!event.thread_id.trim() || (config.threadId && config.threadId !== event.thread_id)) throw new Error('SDK 返回了不同的 threadId；拒绝替换当前会话。');
            config.threadId = event.thread_id;
            await saveConfig(directory, config);
          }
          await appendFile(join(output, 'events.jsonl'), JSON.stringify({ attempt, phase, event }) + '\n');
          if (event.type === 'item.completed' && event.item.type === 'agent_message') options.progress?.(event.item.text);
          if (event.type === 'error') options.progress?.(`SDK：${event.message}`);
        },
      });
      await writeFile(resultFile, JSON.stringify(result, null, 2) + '\n');
      return result;
    };
    try {
      if (!drawingReady) {
        if (step.review) {
          await discardReviewReports(output);
          await rm(join(output, 'report.md.tmp'), { force: true });
        }
        const result = await invoke(await buildPrompt(step, reference, output, krita, previous), 'draw');
        if (result.status !== 'completed') throw new Error(`步骤未完成：${result.summary}`);
        if (!config.threadId) throw new Error('SDK 未返回 threadId，不能完成步骤。');
        const required = step.requiredFiles.map(file => step.review && file === 'report.md' ? 'report.md.tmp' : file);
        await checkFiles(output, required);
        options.signal?.throwIfAborted();
        if (step.review) await rename(join(output, 'report.md.tmp'), join(output, 'report.md'));
      }
      if (step.review) {
        // An interrupted repair may still need to regenerate a deliverable.
        if (!drawingReady || reviewTask?.kind !== 'repair') await checkFiles(output, step.requiredFiles);
        await runReviews({ step, directory: output, krita, signal: options.signal, progress: options.progress,
          invoke: (prompt, task) => invoke(prompt, task.filename.slice(0, -3), task.kind === 'review'),
          validate: () => checkFiles(output, step.requiredFiles),
        });
      }
      await checkFiles(output, step.requiredFiles);
      options.signal?.throwIfAborted();
      await rename(join(output, '.running'), join(output, '.completed'));
      options.progress?.(`${step.id}：交付检查通过，已写入 .completed`);
      previous.push(output);
    } catch (error) {
      await writeFile(join(output, 'error.txt'), (error instanceof Error ? error.message : String(error)) + '\n');
      throw error;
    }
  }
  if (options.dryRun) return previews.join('\n\n') || '当前已定义步骤均已完成；无需调用模型。';
  return `已完成当前已定义步骤。交付目录：${previous.at(-1) ?? directory}`;
}
