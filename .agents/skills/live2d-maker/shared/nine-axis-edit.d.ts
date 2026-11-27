import type { HeadNineAxis, WarpGrid } from './nine-axis-model.js';
export function initializeKeyforms(node: WarpGrid, poses: readonly (readonly [number, number])[]): void;
export function initializeEditKeyform(doc: HeadNineAxis, node: WarpGrid, x?: number, y?: number): ['keyforms' | 'keyformsY' | 'keyformsXY', string];
export function editNineAxis(doc: HeadNineAxis, operations: any[],
  checkMirror?: (doc: HeadNineAxis, target: WarpGrid, source: WarpGrid, x: number, y: number) => void): HeadNineAxis;
