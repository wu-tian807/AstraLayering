export type Point = [number, number];
export type HeadLevel = 'face' | 'hair' | 'accessory';
export interface WarpGrid { id: string; name?: string; level: HeadLevel; parent?: string; bbox: number[]; cols: number; rows: number; keyforms: Record<string, Point[] | number[][]>; keyformsY?: Record<string, Point[] | number[][]>; keyformsXY?: Record<string, Point[] | number[][]>; interpolation?: 'linear' | 'smooth'; parameterInterpolation?: { x?: 'linear' | 'ellipse' }; status?: string }
export interface HeadDeformer extends WarpGrid { group?: string; texture: string; textureBounds: number[]; role?: 'mask'; clip?: { by: string[]; invert?: boolean } }
export interface HeadNineAxis { version: 2; kind: 'head-nine-axis'; canvas?: number[]; view?: { x: number; y: number; width: number; height: number }; parameters?: any[]; levels: { id: string; name?: string; includes: HeadLevel[] }[]; notes?: string; deformers: WarpGrid[]; parts: HeadDeformer[] }
export const levelNames: Record<HeadLevel, string>;
export function validateHeadNineAxis(doc: any): HeadNineAxis;
export function keyValues(part: WarpGrid, axis?: 'x' | 'y'): number[];
export function keyformAt(part: WarpGrid, x: number, y?: number, out?: Float32Array): Float32Array;
export function lattice(part: WarpGrid): Float32Array;
export function warpPoint(part: WarpGrid, points: ArrayLike<number>, x: number, y: number): Point;
export function inverseWarpPoint(part: WarpGrid, points: ArrayLike<number>, x: number, y: number): Point;
export function nodes(doc: HeadNineAxis): WarpGrid[];
export function descendants(doc: HeadNineAxis, id: string): Set<string>;
export function evaluatePoints(doc: HeadNineAxis, node: WarpGrid, x: number, y?: number, subdivision?: number): Float32Array;
export function parentPoint(doc: HeadNineAxis, node: WarpGrid, x: number, y: number, px: number, py: number, inverse?: boolean): Point;
export function checkWarpGeometry(node: WarpGrid): void;
export function reparent(doc: HeadNineAxis, ids: string[], parent?: string): void;
export function refine(points: ArrayLike<number>, cols: number, rows: number, n: number, out?: Float32Array): Float32Array;
export function meshIndices(cols: number, rows: number): Uint32Array;
export function levelParts(doc: HeadNineAxis, levelId: string): HeadDeformer[];
export function dragKeyform(start: number[][], index: number, dx: number, dy: number, radius: number): number[][];
export function deformerTree(doc: HeadNineAxis): { id: HeadLevel; name: string; groups: { id: string; parts: HeadDeformer[] }[] }[];
