import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runtimePrompt, type KnowledgeValues } from '../knowledge.ts';
import { agentOutcomeError } from './diagnostics.ts';
import type { AgentResult, AgentSession, AgentTask, CodexAgents } from './agents.ts';

// Program checks after an agent turn. A check that finds something the agent can
// fix throws CheckFailure; the same thread then gets the problem as its next turn
// (at most `maxRepairs` times) before the step fails. The wording the agent sees is
// knowledge/shared/prompts/runtime/checks/<code>.md; the code passes values only.
export type CheckCode = 'missing-submit' | 'invalid-output' | 'missing-file' | 'bad-result';
export const maxRepairs = 2;

export class CheckFailure extends Error {
  readonly code: CheckCode;
  readonly values: KnowledgeValues;
  constructor(code: CheckCode, message: string, values: KnowledgeValues = {}, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.values = values;
  }
}

// An error the check hit while reading the product counts as a problem to repair.
export async function asCheck<T>(code: CheckCode, check: () => T | Promise<T>): Promise<T> {
  try { return await check(); }
  catch (error) {
    if (error instanceof CheckFailure) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CheckFailure(code, message, { detail: message }, { cause: error });
  }
}

export const missingSubmit = (tool: string, message: string, detail = '') =>
  new CheckFailure('missing-submit', message, { tool, detail });

// The model service cut the turn off (content filter); the thread's own history then
// holds a refusal that repeats on every later turn.
async function contentFiltered(logDirectory: string | undefined): Promise<boolean> {
  if (!logDirectory) return false;
  try { return (await readFile(join(logDirectory, 'events.jsonl'), 'utf8')).includes('content_filter'); }
  catch { return false; }
}

type Runner = { run: AgentSession['run'] } & Partial<Pick<CodexAgents, 'createSession'>>;
export type CheckedTurn<T> = {
  // A real CodexAgents opens one session for the turn and its repairs. A caller that
  // keeps its own session (saved thread) passes that session's `run` here, and every
  // repair then continues it.
  agents: Runner;
  task: AgentTask;
  check: (response: AgentResult) => T | Promise<T>;
  // <records>/<round>/{problems.txt,prompt.txt}
  records?: string;
  signal?: AbortSignal;
};

export async function checkedTurn<T>(turn: CheckedTurn<T>): Promise<T> {
  const session: Pick<AgentSession, 'run'> & Partial<Pick<AgentSession, 'close'>> = turn.agents.createSession
    ? turn.agents.createSession() : { run: (task, signal) => (turn.agents.run as AgentSession['run'])(task, signal) };
  try {
    let response = await session.run(turn.task, turn.signal);
    for (let round = 1; ; round++) {
      try { return await turn.check(response); }
      catch (error) {
        if (!(error instanceof CheckFailure)) throw error;
        const filtered = await contentFiltered(response.logDirectory);
        if (filtered || round > maxRepairs) {
          const reason = filtered ? '模型回合被内容过滤截断' : `已返修 ${maxRepairs} 次仍未通过`;
          // Only the user reads this: the agent's prompts never mention it.
          throw agentOutcomeError(`${error.message}（${reason}；继续仍接回同一会话，会话已无法推进时请用“恢复”换新会话）`, response, error);
        }
        const problems = runtimePrompt(`checks/${error.code}`, error.values);
        const repair = runtimePrompt('check-repair', { problems, round: String(round), max: String(maxRepairs) });
        if (turn.records) {
          const directory = join(turn.records, String(round));
          await mkdir(directory, { recursive: true });
          await writeFile(join(directory, 'problems.txt'), problems);
          await writeFile(join(directory, 'prompt.txt'), repair);
        }
        response = await session.run({ ...turn.task, prompt: repair,
          recoveryPrompt: `${turn.task.recoveryPrompt ?? turn.task.prompt}\n\n${runtimePrompt('check-repair-resume')}${repair}` }, turn.signal);
      }
    }
  } finally { await session.close?.(); }
}
