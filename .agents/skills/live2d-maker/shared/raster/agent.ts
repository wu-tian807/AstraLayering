import { loadWorkflowEnvironment, type WorkflowEnvironment, type ModelSelection } from '../codex/environment.ts';
import { validateAgentOutcome } from '../codex/diagnostics.ts';
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
    const result = await session.run({ step: request.step, name: request.step || 'raster', prompt: request.prompt, recoveryPrompt: request.recoveryPrompt,
      cwd: request.directory, outputDirectory: paths.outputDirectory, tools: request.tools,
      outputSchema: { type: 'object', additionalProperties: false, properties: {
        status: { type: 'string', enum: ['completed', 'blocked'] }, summary: { type: 'string' } }, required: ['status', 'summary'] } }, request.signal);
    return await validateAgentOutcome(result, () => {
      let value;
      try { value = JSON.parse(result.text); }
      catch (error) { throw new Error('模型回合已结束，但没有返回有效的步骤结果 JSON。', { cause: error }); }
      if (!value || !['completed', 'blocked'].includes(value.status) || typeof value.summary !== 'string' || !value.summary.trim()) {
        throw new Error('步骤未返回有效的完成或受阻说明');
      }
      return value as StepResult;
    });
  } finally { await session.close(); }
}
