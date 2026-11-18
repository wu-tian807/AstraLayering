export type LayerState = {
  id: string;
  visible: boolean;
  opacity: number;
  blend: string;
  inheritAlpha: boolean;
  passThrough: boolean | null;
};
export type Layer = LayerState & {
  name: string;
  parentId: string | null;
  depth: number;
};
export const layerFields: string[];
export function layerState(layers: LayerState[]): LayerState[];
export function stateKey(layers: LayerState[]): string;
export function layerTree<T extends Layer>(
  layers: T[],
  collapsed?: Set<string>,
  query?: string,
): (T & { inheritedHidden: boolean; shown: boolean; hasChildren: boolean })[];
export const layerTypes: Record<string, string>;
export const blends: Record<string, string>;
