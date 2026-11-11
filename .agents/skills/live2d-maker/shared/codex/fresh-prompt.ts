import type { AgentTask } from './agents.ts';

// What a turn sends when its thread is new. A step's own recovery text replaces the
// prompt; a follow-up turn (e.g. a repair) keeps its prompt and gets the original
// task in front of it, so the layer that resumes and the layer that follows up never
// know about each other.
export function freshPrompt(task: Pick<AgentTask, 'prompt' | 'recoveryPrompt' | 'resumeContext'>): string {
  if (task.resumeContext) return `${task.resumeContext}\n\n${task.prompt}`;
  return task.recoveryPrompt || task.prompt;
}
