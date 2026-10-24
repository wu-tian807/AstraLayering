export interface Bounds { x:number; y:number; width:number; height:number }
export interface LayerPixels { id:string; partId:string; partPath?:string; bounds:Bounds; rgba:Uint8ClampedArray; maskedRgba?:Uint8ClampedArray }
export interface PartMaps { data:Uint8Array; known:number; inferred:number; confidence:Uint8Array; surfaceOwner?:string }
export interface MapSurface { layerIds:readonly string[]; bounds:Bounds; coverage:Uint8Array }
export function extractPartMaps(width:number,height:number,layers:LayerPixels[],normal:Uint8ClampedArray,depth:Uint8ClampedArray,surfaces?:MapSurface[]):Map<string,PartMaps>;
