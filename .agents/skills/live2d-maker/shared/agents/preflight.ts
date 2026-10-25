import { checkCodexCapabilities, type WorkflowEnvironment } from '../codex/environment.ts';
import type { PipelineId } from '../paths.ts';
import { stepDefaults, type AgentStep } from './models.ts';
import { cliExecutable } from './cli.ts';
import { validateImageSelection } from './images.ts';
import { usesPatchedImageTool } from './codex-images.ts';
import type { ImageProcessingOptions } from '../image-processing.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appServerCommand } from '../codex/tool-agent.ts';
import { withNodePath } from '../process-environment.ts';
import type { Harness } from './models.ts';

export async function checkAgentCli(settings: WorkflowEnvironment, harness: Harness, runsRoot?: string): Promise<string> {
  const launch = harness === 'codex' ? appServerCommand(settings.codex.codexPathOverride)
    : { command: await cliExecutable(settings, harness, runsRoot), args: [] };
  const args = [...(harness === 'codex' ? launch.args.slice(0, -1) : launch.args), '--version'];
  try {
    // This local version probe never starts a model turn. Its deadline is only
    // for CLI startup, not reasoning, image generation or workflow execution.
    const { stdout, stderr } = await promisify(execFile)(launch.command, args,
      { env: withNodePath(settings.codex.env), timeout: 15_000, maxBuffer: 64 * 1024 });
    const version = `${stdout}\n${stderr}`.trim();
    if (!/\d+\.\d+/.test(version)) throw new Error('版本命令未返回可识别的版本');
    return version.split('\n')[0];
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr || (error instanceof Error ? error.message : String(error));
    throw new Error(`${harness} CLI 无法在工作流环境启动：${launch.command}。请检查解释器和系统依赖；未发起模型请求。\n${detail.trim()}`, { cause: error });
  }
}

export function pipelineAgentSteps(pipeline: PipelineId, standard = false, shadowMode: 'mask' | 'normal-depth' = 'mask'): AgentStep[] {
  return (Object.keys(stepDefaults) as AgentStep[]).filter(step => {
    if (pipeline === 'part-layering') return step.startsWith('part_') && (standard || !['part_pose_judgment', 'part_standardize'].includes(step));
    if (pipeline === 'clothing-part-layering') return step.startsWith('clothing_') && !step.startsWith('clothing_raster_');
    if (pipeline === 'raster-layering') return step.startsWith('raster_');
    if (pipeline === 'clothing-raster-layering') return step.startsWith('clothing_raster_');
    if (pipeline === 'physics') return step.startsWith('physics_');
    if (pipeline === 'shadow') return step === (shadowMode === 'mask' ? 'shadow_mask' : 'shadow_maps');
    return step === 'assembly';
  });
}
export async function preflightAgentSteps(settings: WorkflowEnvironment, steps: readonly AgentStep[],
  normalization: ImageProcessingOptions & { building?: () => void } = {}): Promise<void> {
  const harnesses = new Set<Harness>();
  for (const step of steps) {
    validateImageSelection(settings, step);
    const harness = settings.stepModels[step].harness;
    harnesses.add(harness);
    if (harness === 'codex') await checkCodexCapabilities(settings, settings.codex, { image: usesPatchedImageTool(settings, step), progress: normalization.progress, building: normalization.building });
  }
  for (const harness of harnesses) {
    const version = await checkAgentCli(settings, harness, normalization.runsRoot);
    normalization.progress?.(`CLI 启动检查通过：${harness}；${version}`);
  }
}
