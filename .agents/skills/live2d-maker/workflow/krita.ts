import { loadWorkflowEnvironment } from '../shared/codex/environment.ts';
import { checkKrita, type KritaInstallation } from '../shared/raster/krita.ts';
import { MissingDependencyError } from '../shared/missing-dependency.ts';
import { directoryFor, readRun, selectedSections, taskRoute, taskKrita, usesKrita, type TaskOptions, type TaskRun } from './state.ts';

// Refused before any start, continue, resume or retry changes the task; the
// path is given again with --krita (in the web, the Krita path field).
export class KritaUnavailable extends Error {
  readonly reason: string; readonly path?: string;
  constructor(reason: string, path?: string, options?: ErrorOptions) {
    super(reason + '\n请用 --krita <Krita 可执行文件路径> 重新指定 Krita；不会自动下载或搜索。', options);
    this.reason = reason; this.path = path;
  }
}

export type KritaCheck = (path: string) => Promise<KritaInstallation>;
// Krita starts under the same display environment as the workflow's agents.
export const workflowKrita: KritaCheck = path => checkKrita(path, loadWorkflowEnvironment().codex.env);

// Checks the Krita this run would use: the one given now, else the recorded one.
// Routes without a Krita section need none. A missing system dependency does not
// refuse the start: the run records it as failed, so workflow.log and the page show it.
export async function preflightKrita(options: TaskOptions, check: KritaCheck = workflowKrita): Promise<KritaInstallation | undefined> {
  const directory = directoryFor(options), saved = await readRun(directory);
  if (saved?.archive) return; // Refused as an archive by the caller.
  try { return await requireKrita({ ...taskRoute(options, saved), krita: taskKrita(options, saved) }, !!options.krita, check); }
  catch (error) { if (!(error instanceof MissingDependencyError)) throw error; }
}

// The same check on a configured run, whose krita is already resolved.
export async function requireKrita(run: Pick<TaskRun, 'from' | 'to' | 'krita'>, given: boolean, check: KritaCheck): Promise<KritaInstallation | undefined> {
  if (!usesKrita(selectedSections(run.from, run.to))) return;
  if (!run.krita) throw new KritaUnavailable('本次路线包含 Krita 步骤，但没有记录 Krita 路径。');
  try { return await check(run.krita); }
  catch (error) {
    if (error instanceof MissingDependencyError) throw error;
    throw new KritaUnavailable(`${given ? '指定' : '记录'}的 Krita 不可用：${run.krita}\n${(error as Error).message}`, run.krita, { cause: error });
  }
}
