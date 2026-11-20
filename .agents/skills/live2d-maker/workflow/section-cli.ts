import { parseSectionArguments, sectionRangeHelp } from '../shared/section-options.ts';
import { formatAgentError } from '../shared/codex/diagnostics.ts';
import { loadWorkflowEnvironment } from '../shared/codex/environment.ts';
import { selectKnowledge } from '../shared/knowledge.ts';
import { resolveInput, taskDirectory } from '../shared/paths.ts';
import { GroupExecutionError } from '../shared/part/layering.ts';
import { formatLayeringSummary } from '../shared/part/run.ts';
import { checkKrita } from '../shared/raster/krita.ts';
import { acquireTaskLock, sectionId } from './state.ts';
import { applyStepAction, applyTaskAction, validStepId } from './step-actions.ts';
import { sections, type SectionDefinition, type SectionInvocation } from './sections.ts';
import { cleanLegacyCodexCache } from '../patches/codex/legacy-cache.ts';

export async function runSectionCommand(
  argv: string[], registry: Readonly<Record<string, SectionDefinition>> = sections, log = console.log,
): Promise<void> {
  const [id, ...rest] = argv;
  if (id === undefined || id === '--help' || id === '-h') {
    log('pnpm section <section-id> --name <任务名> --knowledge <先验知识目录> [选项]');
    log('可用 section：' + Object.keys(registry).join('、'));
    log(sectionRangeHelp);
    return;
  }
  if (!Object.hasOwn(registry, id)) throw new Error('未知 section：' + id);
  const section = registry[id], args = parseSectionArguments(rest);
  if (args.help) {
    log(section.help ?? id);
    log(sectionRangeHelp);
    return;
  }
  if (args['check-krita']) {
    if (!args.krita?.trim()) throw new Error('必须提供 --krita <已安装的 Krita 可执行文件路径>。');
    log(JSON.stringify(await checkKrita(args.krita, loadWorkflowEnvironment().codex.env), null, 2));
    return;
  }
  if (!args.name?.trim()) throw new Error('必须提供 --name <任务名>。');
  if (!args.knowledge?.trim()) throw new Error('必须提供 --knowledge <先验知识目录>；独立 section 每次启动都须指定。');
  if (args['dry-run'] && !section.dryRun) throw new Error(id + ' 不支持 --dry-run');
  if (args.action && !section.checkRecovery) throw new Error('请使用总入口执行此 section 的继续、恢复或重试');

  // Whole-step selection uses the common range. A child target and a recovery
  // target still use the section's established step identity.
  const explicitTarget = args.step !== undefined && (args.action !== undefined || args.step.includes('/'));
  if (explicitTarget && (!section.targetedSteps || !validStepId(sectionId(id), args.step!))) {
    throw new Error('无效的步骤或分支：' + args.step);
  }
  if (explicitTarget && args.selection) throw new Error('步内分支与步骤范围不能同时选择');
  const selection = args.step !== undefined && !explicitTarget ? { ...args.selection, fromStep: args.step } : args.selection;
  const directory = taskDirectory(args.name, args.dir);
  selectKnowledge(resolveInput(args.name, args.knowledge, args.dir));
  const controller = new AbortController();
  const options: SectionInvocation = {
    name: args.name, dir: args.dir, image: args.image, knowledge: args.knowledge, krita: args.krita, ffmpeg: args.ffmpeg,
    standard: args.standard, shadowMode: args.shadowMode, jobs: args.agentConcurrency,
    step: explicitTarget ? args.step : undefined, selection, standalone: true,
    dryRun: args['dry-run'], signal: controller.signal, progress: log,
  };
  const stop = () => controller.abort(new Error('运行已中断；可用相同任务名和运行目录续跑。'));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let release: (() => Promise<void>) | undefined;
  try {
    if (args.action) {
      await section.checkRecovery!(options);
      const target = { name: options.name, dir: options.dir, section: sectionId(id), action: args.action };
      log(await (options.step ? applyStepAction({ ...target, step: options.step }) : applyTaskAction(target)));
    }
    if (!options.dryRun) {
      release = await acquireTaskLock(directory);
      if (registry === sections) await cleanLegacyCodexCache({ progress: log });
    }
    log((await section.run(options, {})).summary);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await release?.();
  }
}

export async function launchSection(alias?: string): Promise<void> {
  const args = process.argv.slice(2);
  try {
    await runSectionCommand(alias ? [alias, ...args] : args);
  } catch (error) {
    console.error(formatAgentError(error));
    if (error instanceof GroupExecutionError) {
      console.error('Layering 未完成：停止派发新待办，已启动的组已结束；其余未启动的待办未执行。');
      for (const line of formatLayeringSummary(error.groups)) console.error(line);
      console.error('事实产物目录：' + error.statePath);
    }
    process.exitCode = 1;
  }
}

if (import.meta.main) await launchSection();
