import { loadWorkflowEnvironment, type WorkflowEnvironment, type ModelSelection } from '../codex/environment.ts';
import { CheckFailure, checkedTurn } from '../codex/checked-turn.ts';
import type { ThreadEvent } from '@openai/codex-sdk';
import type { FunctionTool } from '../codex/function-tools.ts';
import { CodexAgents } from '../codex/agents.ts';
import { parseAgentModel, type AgentStep } from '../agents/models.ts';
import { join } from 'node:path';
import { AgentRuntime, type AgentRetry } from '../codex/agent-runtime.ts';
import type { ImageProcessingOptions } from '../image-processing.ts';
import { validateProviderModel } from '../agents/providers.ts';
import { executionPaths, prepareWorkspace } from '../agents/workspace.ts';

export type StepResult = { status: 'completed' | 'blocked'; summary: string };
export type AgentRequest = {
  imageNormalization?: ImageProcessingOptions;
  step?: AgentStep;
  onThreadReplacement?: (oldId: string, reason: string) => Promise<void>;
  prompt: string;
  recoveryPrompt?: string;
  directory: string;
  outputDirectory?: string;
  model: string;
  effort: ModelSelection['effort'];
  environment?: WorkflowEnvironment;
  threadId?: string;
  tools?: FunctionTool[];
  signal?: AbortSignal;
  onEvent: (event: ThreadEvent) => Promise<void>;
  onRetry?: (retry: AgentRetry) => Promise<void> | void;
};
export type Agent = (request: AgentRequest) => Promise<StepResult>;
// Every harness runs through the shared session: Codex over the app-server
// protocol, other CLIs through their own adapters.
export async function runAgent(request: AgentRequest, runtime = new AgentRuntime(1)): Promise<StepResult> {
  const task = { cwd: request.directory, outputDirectory: request.outputDirectory, step: request.step };
  const paths = executionPaths(task, request.directory);
  // Keep the configured login and tool providers; image capability is per step.
  const environment = request.environment ?? loadWorkflowEnvironment();
  const selected = parseAgentModel(`${request.model}-${request.effort}`, request.step || 'raster agent');
  validateProviderModel(environment.providers, selected, request.step);
  // A rejected model leaves no directories behind.
  await prepareWorkspace(task, request.directory);
  const agents = new CodexAgents({ environment, selectedModel: selected, cwd: request.directory, imageNormalization: request.imageNormalization,
    logDirectory: join(request.directory, 'agents'), runtime, onRetry: request.onRetry,
    onEvent: request.onEvent, onThreadReplacement: request.onThreadReplacement });
  const session = agents.createSession(request.threadId);
  try {
    let value: StepResult | undefined;
    const task = { step: request.step, name: request.step || 'raster', prompt: request.prompt, recoveryPrompt: request.recoveryPrompt,
      cwd: request.directory, outputDirectory: paths.outputDirectory, tools: request.tools,
      outputSchema: { type: 'object', additionalProperties: false, properties: {
        status: { type: 'string', enum: ['completed', 'blocked'] }, summary: { type: 'string' } }, required: ['status', 'summary'] } };
    await checkedTurn({ agents: { run: (next, abort) => session.run(next, abort) }, task, signal: request.signal, check: result => {
      let parsed;
      try { parsed = JSON.parse(result.text); }
      catch { throw new CheckFailure('bad-result', '没有返回有效的步骤结果 JSON', { detail: '没有返回有效的步骤结果 JSON' }); }
      if (!parsed || !['completed', 'blocked'].includes(parsed.status) || typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
        throw new CheckFailure('bad-result', '步骤未返回有效的完成或受阻说明', { detail: '须返回 status（completed 或 blocked）和非空 summary' });
      }
      value = parsed as StepResult;
    } });
    return value!;
  } finally { await session.close(); }
}
