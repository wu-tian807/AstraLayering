import { runWorkflow as shadow, help as shadowHelp } from '../shadow/run.ts';
import { shadowMode } from '../shared/shadow.ts';
import { basename, dirname, join } from 'node:path';
import { shadowStep } from '../shared/step-paths.js';
import { toTaskPath } from '../shared/task-paths.ts';
import { runPartSection, formatLayeringSummary, type PartSection } from '../shared/part/run.ts';
import { section as personPart } from '../part-layering/run.ts';
import { section as clothingPart } from '../clothing-part-layering/run.ts';
import { runWorkflow as characterRaster, help as characterRasterHelp } from '../raster-layering/run.ts';
import { runWorkflow as clothingRaster, help as clothingRasterHelp } from '../clothing-raster-layering/run.ts';
import { runWorkflow as assemble, help as assemblyHelp } from '../character-assembly/run.ts';
import { runWorkflow as nineAxis, isArtworkOnly, help as nineAxisHelp } from '../nine-axis/run.ts';
import { resolveInput, taskDirectory, type SectionId } from '../shared/paths.ts';
import { taskOriginal, type TaskOptions, type TaskRun } from './state.ts';
import { readStep } from '../shared/step-chain.ts';
import { nineAxisSteps } from '../shared/nine-axis.ts';
import type { SectionRun } from '../shared/step-section.ts';
import { requireFFmpeg } from './ffmpeg.ts';
import { preflightTaskInputs } from './preflight-inputs.ts';
import { checkKrita } from '../shared/raster/krita.ts';
import { loadWorkflowEnvironment } from '../shared/codex/environment.ts';
import { defaultAgentConcurrency } from '../shared/agents/runtime.ts';

// Output is relative to the task root.
export type SectionResult = { summary: string; output?: string; completed?: boolean };
export type SectionInvocation = Pick<SectionRun, 'selection' | 'dryRun' | 'signal' | 'progress'>
  & Pick<TaskOptions, 'name' | 'dir' | 'image' | 'knowledge' | 'krita' | 'ffmpeg' | 'standard' | 'shadowMode' | 'jobs'>
  & { step?: string; standalone?: boolean };
type SectionEvents = { prepared?(): void };
export type SectionDefinition = {
  help?: string;
  dryRun?: boolean;
  targetedSteps?: boolean;
  checkRecovery?(options: SectionInvocation): Promise<void>;
  run(options: SectionInvocation, events: SectionEvents): Promise<SectionResult>;
};

function partSection(section: PartSection, help: string): SectionDefinition {
  const person = section.profile.id === 'part-layering';
  return { help: help + `\n--jobs / -j 设置 agent 并发上限，默认 ${defaultAgentConcurrency}。--agents / -a 是兼容别名。`, async run(options, events) {
    const { name, dir, standalone, progress } = options;
    const directory = taskDirectory(name, dir);
    const image = person && !standalone ? await taskOriginal(directory) : options.image;
    const result = await runPartSection(section, {
      reference: { runName: name, dir, image, standard: options.standard }, groups: null, selection: options.selection,
    }, { prepared: events.prepared }, { agentConcurrency: options.jobs, progress, signal: options.signal });
    if (!result.layering) {
      return { summary: '本次参考准备范围已完成，交付目录：' + result.references.directory, completed: false };
    }
    const { layering } = result;
    const groups = formatLayeringSummary(layering.groups);
    if (!standalone && layering.status !== 'completed') {
      throw new Error('管线尚未完成：' + section.profile.id + '\n' + groups.join('\n') + '\n进度目录：' + layering.statePath);
    }
    const complete = layering.status === 'completed';
    const detail = layering.stoppedAt ? '本次范围已完成，停在 ' + layering.stoppedAt
      : complete ? 'Layering 已完成：' + layering.output : 'Layering 未完成，正式产物与检查记录已保存';
    const summary = !standalone ? section.profile.id + ' 已完成' : [
      '参考输出：' + result.references.directory, '分组：' + layering.groupsPath, '事实产物目录：' + layering.statePath,
      ...(layering.occlusionPath ? ['遮挡层级表：' + layering.occlusionPath] : []), ...groups, detail,
    ].join('\n');
    return { summary, completed: complete, output: complete && layering.output ? toTaskPath(directory, layering.output) : undefined };
  } };
}

function kritaSection(help: string, run: (options: SectionInvocation) => Promise<string>,
  output: string | ((options: SectionInvocation) => string)): SectionDefinition {
  return { help, dryRun: true, async run(options) {
    const summary = await run(options);
    return options.dryRun || options.selection ? { summary }
      : { summary, output: typeof output === 'string' ? output : output(options) };
  } };
}

// Both standalone commands and worker processes use this registry. The
// pipeline order and cross-section prerequisites live in the coordinator.
export const sections = {
  'part-layering': partSection(personPart, '人物参考准备与分件。首次提供 --image，按需用 --standard 调整姿态。'),
  'clothing-part-layering': partSection(clothingPart, '衣服参考准备与分件。按任务名读取人物参考。'),
  'raster-layering': kritaSection(characterRasterHelp, characterRaster, 'raster-layering/step03/character-dressup-base.kra'),
  'clothing-raster-layering': kritaSection(clothingRasterHelp, clothingRaster, 'clothing-raster-layering/step02/clothing-soft-edges.kra'),
  'character-assembly': kritaSection(assemblyHelp, assemble, 'character-assembly/step01/character-assembled.kra'),
  shadow: kritaSection(shadowHelp, shadow, options => {
    const mode = shadowMode(options.shadowMode);
    return 'shadow/' + shadowStep(mode) + '/' + (mode === 'mask' ? 'character-shadowed.kra' : 'normal.png');
  }),
  'nine-axis': {
    help: nineAxisHelp, dryRun: true, targetedSteps: true,
    async checkRecovery(options) {
      const artworkOnly = isArtworkOnly(options.step?.split('/')[0]);
      const environment = loadWorkflowEnvironment();
      if (!artworkOnly) await requireFFmpeg({ from: 'nine-axis', to: 'nine-axis',
        ffmpeg: options.ffmpeg ? resolveInput(options.name, options.ffmpeg, options.dir) : environment.codex.env?.ASTRA_STUDIO_FFMPEG });
      await preflightTaskInputs({ ...options, from: 'nine-axis', to: 'nine-axis' }, environment, { video: !artworkOnly });
      if (options.krita) await checkKrita(resolveInput(options.name, options.krita, options.dir), environment.codex.env);
    },
    async run(options) {
      const summary = await nineAxis(options);
      if (options.dryRun || options.selection || options.step) return { summary };
      const last = nineAxisSteps.at(-1)!;
      const folder = join(taskDirectory(options.name, options.dir), 'nine-axis', last);
      return { summary, output: 'nine-axis/' + last + '/deformers.json', completed: (await readStep(folder)).status === 'completed' };
    },
  },
} satisfies Record<SectionId, SectionDefinition> & Record<string, SectionDefinition>;

export async function executeSection(id: SectionId, directory: string, run: TaskRun, progress: (message: string) => void,
  events: SectionEvents = {}): Promise<SectionResult> {
  const definition: SectionDefinition = sections[id];
  return definition.run({ name: basename(directory), dir: dirname(directory), krita: run.krita, ffmpeg: run.ffmpeg,
    standard: id === 'part-layering' ? run.standard : undefined,
    shadowMode: run.shadowMode, jobs: run.jobs, progress }, events);
}
