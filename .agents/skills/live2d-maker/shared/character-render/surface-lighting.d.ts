import type {LayerPixels,PartMaps} from './part-maps.js';
export interface SurfaceLightingFields {normal:Uint8ClampedArray;depth:Uint8ClampedArray;inherited:{id:string;owner:string}[]}
export function shareShallowSurfaceMaps(layers:LayerPixels[],maps:Map<string,PartMaps>):void;
export function surfaceLightingMaps(width:number,height:number,layers:LayerPixels[],maps:Map<string,PartMaps>,normal:ArrayLike<number>,depth:ArrayLike<number>):SurfaceLightingFields|null;
