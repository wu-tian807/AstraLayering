import { Codex, type CodexOptions, type UserInput } from '@openai/codex-sdk';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const agentDefaults = { model: 'gpt-6.1-sol', effort: 'xhigh' } as const;

export type AgentTask = {
  name: string;
  prompt: string;
  images?: { path: string; description: string }[];
  imageGeneration?: boolean;
  outputSchema?: Record<string, unknown>;
  timeoutMs?: number;
};

export type GeneratedImage = { savedPath: string };
export type AgentResult = { text: string; images: GeneratedImage[] };
export type AgentOptions = CodexOptions & {
  cwd?: string;
  progress?: (message: string) => void;
};

export class CodexAgents {
  private options: AgentOptions;

  constructor(options: AgentOptions = {}) {
    this.options = options;
  }

  async run(task: AgentTask): Promise<AgentResult> {
    const { cwd, progress, config, ...options } = this.options;
    const codex = new Codex({
      ...options,
      config: {
        ...config,
        features: {
          image_generation: task.imageGeneration ?? false,
          shell_tool: false, unified_exec: false, multi_agent: false, memories: false,
        },
      },
    });
    const thread = codex.startThread({
      model: agentDefaults.model, modelReasoningEffort: agentDefaults.effort,
      workingDirectory: resolve(cwd ?? fileURLToPath(new URL('.', import.meta.url))),
      sandboxMode: 'read-only', approvalPolicy: 'never', webSearchMode: 'disabled',
    });
    const input: UserInput[] = [{ type: 'text', text: task.prompt }];
    for (const image of task.images ?? []) {
      input.push({ type: 'text', text: image.description });
      input.push({ type: 'local_image', path: resolve(image.path) });
    }
    progress?.(`开始：${task.name}`);
    const result = await thread.run(input, {
      outputSchema: task.outputSchema,
      signal: AbortSignal.timeout(task.timeoutMs ?? 15 * 60_000),
    });
    const images: GeneratedImage[] = [];
    if (task.imageGeneration) {
      const output = JSON.parse(result.finalResponse) as { savedPath?: unknown };
      if (typeof output.savedPath !== 'string' || !output.savedPath.trim()) {
        throw new Error(`${task.name} 没有返回生成图片的 savedPath`);
      }
      images.push({ savedPath: resolve(cwd ?? fileURLToPath(new URL('.', import.meta.url)), output.savedPath) });
    }
    progress?.(`完成：${task.name}`);
    return { text: result.finalResponse, images };
  }
}
