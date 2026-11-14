import { mkdir } from 'node:fs/promises';
import { resolveInput } from '../shared/paths.ts';
import { checkKnowledge, defaultKnowledgeDirectory } from '../shared/knowledge.ts';
import { loadWorkflowEnvironment, type WorkflowEnvironment } from '../shared/codex/environment.ts';
import { requireVideoApi } from '../shared/video.ts';
import { directoryFor, readRun, selectedSections, taskRoute, type TaskOptions } from './state.ts';
import { createTaskLog } from './log.ts';

// Check the startup inputs before a recovery action removes any files.
export async function preflightTaskInputs(options: TaskOptions, environment?: WorkflowEnvironment, { video = true }: { video?: boolean } = {}): Promise<void> {
  const directory = directoryFor(options), saved = await readRun(directory);
  if (saved?.archive) throw new Error('这是导出的成果归档；请在原运行目录继续制作。');
  const knowledge = options.knowledge === undefined ? saved?.knowledge ?? defaultKnowledgeDirectory
    : options.knowledge ? resolveInput(options.name, options.knowledge, options.dir) : defaultKnowledgeDirectory;
  try {
    checkKnowledge(knowledge);
    const configuration=environment??loadWorkflowEnvironment();
    const route = taskRoute(options, saved);
    if (video && selectedSections(route.from, route.to).includes('nine-axis')) requireVideoApi(configuration);
  } catch (error) {
    await mkdir(directory,{recursive:true});
    const log = createTaskLog(directory); log.write((error as Error).message); await log.flush();
    throw error;
  }
}
