import { Codex, type Thread, type ThreadEvent, type ThreadOptions } from '@openai/codex-sdk';

export type StepResult = { status: 'completed' | 'blocked'; summary: string };
export type AgentRequest = {
  prompt: string;
  directory: string;
  model: string;
  effort: 'xhigh';
  threadId?: string;
  signal?: AbortSignal;
  onEvent: (event: ThreadEvent) => Promise<void>;
};
export type Agent = (request: AgentRequest) => Promise<StepResult>;
type Client = {
  startThread(options: ThreadOptions): Pick<Thread, 'runStreamed'>;
  resumeThread(id: string, options: ThreadOptions): Pick<Thread, 'runStreamed'>;
};

export async function runAgent(request: AgentRequest, client?: Client): Promise<StepResult> {
  // Keep the configured login and tool providers; enable the native image tool.
  const codex = client ?? new Codex({ config: { features: { image_generation: true } } });
  const options: ThreadOptions = {
    model: request.model,
    modelReasoningEffort: request.effort,
    workingDirectory: request.directory,
    skipGitRepoCheck: true,
    sandboxMode: 'danger-full-access',
    approvalPolicy: 'never',
  };
  const thread = request.threadId ? codex.resumeThread(request.threadId, options) : codex.startThread(options);
  const { events } = await thread.runStreamed(request.prompt, {
    signal: request.signal,
    outputSchema: {
      type: 'object', additionalProperties: false,
      properties: { status: { type: 'string', enum: ['completed', 'blocked'] }, summary: { type: 'string' } },
      required: ['status', 'summary'],
    },
  });
  let text = '', completed = false, lastError = '';
  for await (const event of events) {
    await request.onEvent(event);
    if (event.type === 'item.completed' && event.item.type === 'agent_message') text = event.item.text;
    if (event.type === 'error') lastError = event.message; // The CLI may still reconnect.
    if (event.type === 'turn.failed') throw new Error(event.error.message);
    if (event.type === 'turn.completed') completed = true;
  }
  if (!completed) throw new Error(lastError || 'SDK 事件流中断，未收到 turn.completed');
  const result: unknown = JSON.parse(text);
  if (!result || typeof result !== 'object' || !('status' in result) || !('summary' in result)
    || !['completed', 'blocked'].includes(String(result.status)) || typeof result.summary !== 'string' || !result.summary.trim()) {
    throw new Error('步骤未返回有效的完成或受阻说明');
  }
  return result as StepResult;
}
