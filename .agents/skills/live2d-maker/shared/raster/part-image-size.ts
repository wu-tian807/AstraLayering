import type { AgentStep } from '../agents/models.ts';

export const rasterPartImageEdge = 1024;
export const rasterPartImageSize = `${rasterPartImageEdge}x${rasterPartImageEdge}`;
export const rasterPartImageSteps: ReadonlySet<AgentStep> = new Set([
  'raster_step01', 'raster_step01_repair', 'clothing_raster_step01', 'clothing_raster_step01_repair',
]);
