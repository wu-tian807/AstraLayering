import { checkCodexCapabilities, type WorkflowEnvironment } from '../codex/environment.ts';
import type { SectionId } from '../paths.ts';
import { stepModelSlots, type AgentStep } from './models.ts';
import { cliExecutable } from './cli.ts';
import { validateImageSelection } from './images.ts';
import { validateProviderModel } from './providers.ts';
import { usesPatchedImageTool } from './codex-images.ts';
import type { ImageProcessingOptions } from '../image-processing.ts';
import spawn from 'cross-spawn';
import { stopCliProcess } from './process.ts';
import { appServerCommand } from '../codex/tool-agent.ts';
import { withNodePath } from '../process-environment.ts';
import type { Harness } from './models.ts';
import type { ReportPreparation } from '../preparation-progress.ts';

export async function checkAgentCli(settings: WorkflowEnvironment, harness: Harness): Promise<string> {
  if (harness === 'codex' && !settings.codex.codexPathOverride) await checkCodexCapabilities(settings);
  const launch = harness === 'codex' ? appServerCommand(settings.codex.codexPathOverride)
    : { command: await cliExecutable(settings, harness), args: [] };
  const args = [...(harness === 'codex' ? launch.args.slice(0, -1) : launch.args), '--version'];
  try {
    // This local version probe never starts a model turn. Its deadline is only
    // for CLI startup, not reasoning, image generation or workflow execution.
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(launch.command, args, { env: withNodePath(settings.codex.env), stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', failure: Error | undefined;
      const stop = () => process.platform === 'win32' ? stopCliProcess(child) : child.kill();
      const timeout = setTimeout(() => { failure = new Error('CLI 版本检查超时'); stop(); }, 15_000);
      const collect = (chunk: Buffer, stream: 'stdout' | 'stderr') => {
        if (stream === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
        if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > 64 * 1024) {
          failure = new Error('CLI 版本输出超过 64 KiB'); stop();
        }
      };
      child.stdout!.on('data', chunk => collect(chunk, 'stdout'));
      child.stderr!.on('data', chunk => collect(chunk, 'stderr'));
      child.once('error', error => { failure = error; });
      child.once('close', code => {
        clearTimeout(timeout);
        if (failure || code !== 0) reject(failure ?? new Error(stderr.trim() || `CLI 退出码：${code}`));
        else resolve({ stdout, stderr });
      });
    });
    const version = `${stdout}\n${stderr}`.trim();
    if (!/\d+\.\d+/.test(version)) throw new Error('版本命令未返回可识别的版本');
    return version.split('\n')[0];
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr || (error instanceof Error ? error.message : String(error));
    throw new Error(`${harness} CLI 启动检查未通过，未发起模型请求。可使用「继续」重试。\n${launch.command}\n${detail.trim()}`, { cause: error });
  }
}

export function sectionAgentSteps(section: SectionId, _standard = false, shadowMode: 'mask' | 'normal-depth' = 'mask'): AgentStep[] {
  return (Object.keys(stepModelSlots) as AgentStep[]).filter(step => {
    if (section === 'part-layering') return step.startsWith('part_') && step !== 'part_pose_judgment';
    if (section === 'clothing-part-layering') return step.startsWith('clothing_') && !step.startsWith('clothing_raster_');
    if (section === 'raster-layering') return step.startsWith('raster_');
    if (section === 'clothing-raster-layering') return step.startsWith('clothing_raster_');
    if (section === 'shadow') return step === (shadowMode === 'mask' ? 'shadow_mask' : 'shadow_maps');
    return step === 'assembly';
  });
}
export async function preflightAgentSteps(settings: WorkflowEnvironment, steps: readonly AgentStep[],
  normalization: ImageProcessingOptions & { building?: () => void; report?: ReportPreparation } = {}): Promise<void> {
  const harnesses = new Set<Harness>();
  for (const step of steps) {
    validateProviderModel(settings.providers, settings.stepModels[step], step);
    validateImageSelection(settings, step);
    const harness = settings.stepModels[step].harness;
    harnesses.add(harness);
  }
  for (const harness of harnesses) {
    if (harness === 'codex') await checkCodexCapabilities(settings, settings.codex, {
      image: steps.some(step => settings.stepModels[step].harness === 'codex' && usesPatchedImageTool(settings, step)),
      progress: normalization.progress, building: normalization.building, report: normalization.report,
    });
    const version = await checkAgentCli(settings, harness);
    normalization.progress?.(`CLI 启动检查通过：${harness}；${version}`);
  }
}
