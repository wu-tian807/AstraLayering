import type { LayerPixels,MapSurface } from './part-maps.js';
export interface SurfaceCoverageOptions { fillInterior?:boolean; sealGapPixels?:number; paddingPixels?:number }
export const defaultContourCoverage:Readonly<SurfaceCoverageOptions>;
export function buildMapSurface(layers:readonly LayerPixels[],options?:SurfaceCoverageOptions):MapSurface;
