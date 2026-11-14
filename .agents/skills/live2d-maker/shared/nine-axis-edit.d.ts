import type { HeadNineAxis, WarpGrid } from './nine-axis-model.js';
export function initializeKeyforms(node: WarpGrid, poses: readonly (readonly [number, number])[]): void;
export function editNineAxis(doc: HeadNineAxis, operations: any[]): HeadNineAxis;
