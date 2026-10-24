import { runWorkflow as shadow } from '../shadow/run.ts';
import { shadowMode } from '../shared/shadow.ts';
import { join } from 'node:path';
import { runPartLayering } from '../part-layering/run.ts';
import { runClothingPartLayering } from '../clothing-part-layering/run.ts';
import { formatLayeringSummary } from '../shared/part/run.ts';
import { runWorkflow as characterRaster } from '../raster-layering/run.ts';
import { runWorkflow as clothingRaster } from '../clothing-raster-layering/run.ts';
import { runWorkflow as assemble } from '../character-assembly/run.ts';
import type { PipelineId } from '../shared/paths.ts';
import type { TaskRun } from './state.ts';

export type PipelineResult = { summary: string; output?: string };
export async function executePipeline(id: PipelineId, run: TaskRun, progress: (message: string) => void): Promise<PipelineResult> {
  if (id === 'physics') {
    const { runWorkflow: physics } = await import('../physics/run.ts');
    const summary = await physics({ name: run.name, dir: run.dir, krita: run.krita, profile: run.physicsProfile, referencePhysics:run.physicsReference, progress });
    return { summary, output: join(run.dir, run.name, 'physics', 'physics.json') };
  }
  if (id === 'shadow') {
    const mode = shadowMode(run.shadowMode);
    const summary = await shadow({ name: run.name, dir: run.dir, krita: run.krita, shadowMode: mode, progress });
    return { summary, output: join(run.dir, run.name, 'shadow', mode, 'step01', mode === 'mask' ? 'character-shadowed.kra' : 'normal.png') };
  }
  if (id === 'part-layering' || id === 'clothing-part-layering') {
    const execute = id === 'part-layering' ? runPartLayering : runClothingPartLayering;
    const result = await execute({
      reference: { runName: run.name, dir: run.dir, krita: run.krita, ...(id === 'part-layering' ? { image: run.image, standard: run.standard } : {}) },
      groups: null,
    }, {}, { agentConcurrency: run.jobs, progress });
    if (result.layering.status !== 'completed') {
      throw new Error('管线尚未完成：' + id + '\n' + formatLayeringSummary(result.layering.groups).join('\n')
        + '\n进度目录：' + join(run.dir, run.name, id));
    }
    return { summary: id + ' 已完成', output: result.layering.output };
  }
  const execute = id === 'raster-layering' ? characterRaster : id === 'clothing-raster-layering' ? clothingRaster : assemble;
  const summary = await execute({ name: run.name, dir: run.dir, krita: run.krita, progress });
  const output = id === 'raster-layering' ? 'step03/character-dressup-base.kra'
    : id === 'clothing-raster-layering' ? 'step02/clothing-soft-edges.kra' : 'step01/character-assembled.kra';
  return { summary, output: join(run.dir, run.name, id, output) };
}
