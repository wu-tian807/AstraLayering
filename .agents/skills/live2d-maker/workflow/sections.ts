import { runWorkflow as shadow } from '../shadow/run.ts';
import { shadowMode } from '../shared/shadow.ts';
import { basename, dirname, join } from 'node:path';
import { shadowStep } from '../shared/step-paths.js';
import { toTaskPath } from '../shared/task-paths.ts';
import { runPartLayering } from '../part-layering/run.ts';
import { runClothingPartLayering } from '../clothing-part-layering/run.ts';
import { formatLayeringSummary } from '../shared/part/run.ts';
import { runWorkflow as characterRaster } from '../raster-layering/run.ts';
import { runWorkflow as clothingRaster } from '../clothing-raster-layering/run.ts';
import { runWorkflow as assemble } from '../character-assembly/run.ts';
import { runWorkflow as nineAxis } from '../nine-axis/run.ts';
import type { SectionId } from '../shared/paths.ts';
import { taskOriginal, type TaskRun } from './state.ts';

// output is the delivered file relative to the task root.
export type SectionResult = { summary: string; output?: string };
// prepared(): part-layering has its references; the clothing lane may start.
// directory is the task directory, <runs root>/<task name>; the run's settings come from its run.json.
export async function executeSection(id: SectionId, directory: string, run: TaskRun, progress: (message: string) => void,
  events: { prepared?(): void } = {}): Promise<SectionResult> {
  const name = basename(directory), dir = dirname(directory);
  if (id === 'nine-axis') {
    const summary = await nineAxis({ name, dir, krita: run.krita, ffmpeg: run.ffmpeg, progress });
    return { summary, output: 'nine-axis/step07_jaw-line/deformers.json' };
  }
  if (id === 'shadow') {
    const mode = shadowMode(run.shadowMode);
    const summary = await shadow({ name, dir, krita: run.krita, shadowMode: mode, progress });
    return { summary, output: `shadow/${shadowStep(mode)}/${mode === 'mask' ? 'character-shadowed.kra' : 'normal.png'}` };
  }
  if (id === 'part-layering' || id === 'clothing-part-layering') {
    const execute = id === 'part-layering' ? runPartLayering : runClothingPartLayering;
    const result = await execute({
      reference: { runName: name, dir, ...(id === 'part-layering' ? { image: await taskOriginal(directory), standard: run.standard } : {}) },
      groups: null,
    }, { prepared: events.prepared }, { agentConcurrency: run.jobs, progress });
    if (result.layering.status !== 'completed') {
      throw new Error('管线尚未完成：' + id + '\n' + formatLayeringSummary(result.layering.groups).join('\n')
        + '\n进度目录：' + join(directory, id));
    }
    return { summary: id + ' 已完成', output: result.layering.output && toTaskPath(directory, result.layering.output) };
  }
  const execute = id === 'raster-layering' ? characterRaster : id === 'clothing-raster-layering' ? clothingRaster : assemble;
  const summary = await execute({ name, dir, krita: run.krita, progress });
  const output = id === 'raster-layering' ? 'step03/character-dressup-base.kra'
    : id === 'clothing-raster-layering' ? 'step02/clothing-soft-edges.kra' : 'step01/character-assembled.kra';
  return { summary, output: `${id}/${output}` };
}
