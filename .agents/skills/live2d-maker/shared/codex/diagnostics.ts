import { AgentCallError } from './agent-runtime.ts';
import { errorDetails, errorMessage } from '../agents/errors.ts';

export function agentCallError(payload: unknown, fallback: string, info?: unknown): AgentCallError {
  const error = new AgentCallError(errorMessage(payload, fallback), info);
  error.details = errorDetails(payload);
  return error;
}

// Codex reports a content-filter cut as a terminal turn failure: the response stream
// disconnected and the failure details name `reason: content_filter`. Only that
// structured pair counts; text anywhere else (echoed source, logs) is not evidence.
export function codexContentFilterInfo(error: any): { refusal: { category: string; turns: null } } | undefined {
  const info = error?.codexErrorInfo;
  if (!info || typeof info !== 'object' || !('responseStreamDisconnected' in info)) return undefined;
  if (typeof error.additionalDetails !== 'string' || !/reason:\s*content_filter\b/.test(error.additionalDetails)) return undefined;
  return { refusal: { category: 'content_filter', turns: null } };
}

type AgentContext = { text?: string; threadId?: string | null; logDirectory?: string };

export function agentOutcomeError(message: string, context: AgentContext = {}, cause?: unknown): AgentCallError {
  const error = new AgentCallError(message, 'localError', cause === undefined ? undefined : { cause });
  error.finalResponse = context.text;
  error.threadId = context.threadId ?? undefined;
  error.logDirectory = context.logDirectory;
  return error;
}

export async function validateAgentOutcome<T>(context: AgentContext, validate: () => T | Promise<T>): Promise<T> {
  try { return await validate(); }
  catch (error) { throw agentOutcomeError(error instanceof Error ? error.message : String(error), context, error); }
}

export function formatAgentError(error: unknown): string {
  const message = errorMessage(error, String(error));
  const contexts: AgentCallError[] = [];
  const details: unknown[] = [];
  const causes: string[] = [];
  const seen = new Set<unknown>();
  for (let current = error; current != null && !seen.has(current); current = current instanceof Error ? current.cause : undefined) {
    seen.add(current);
    if (current instanceof AgentCallError) {
      contexts.push(current);
      if (current.details !== undefined) details.push(current.details);
      else if (current.info !== undefined && current.info !== 'localError') details.push(current.info);
    } else if (typeof current === 'object') details.push(errorDetails(current));
    if (current !== error) {
      const cause = errorMessage(current, String(current));
      if (cause !== message && !causes.includes(cause)) causes.push(cause);
    }
  }
  const last = contexts.find(context => context.finalResponse?.trim());
  const thread = contexts.find(context => context.threadId)?.threadId;
  const log = contexts.find(context => context.logDirectory)?.logDirectory;
  const serialized = [...new Set(details.map(detail => JSON.stringify(errorDetails(detail), null, 2)))];
  return [message, ...causes.map(cause => `原因：${cause}`),
    ...(serialized.length ? [`错误详情：\n${serialized.join('\n')}`] : []), ...(last ? [`模型最后消息：\n${last.finalResponse}`] : []),
    ...(thread ? [`threadId：${thread}`] : []), ...(log ? [`调用记录：${log}`] : [])].join('\n');
}
