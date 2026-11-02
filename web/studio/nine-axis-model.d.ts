export type Point = [number, number];
export type HeadLevel = 'face' | 'hair' | 'accessory';
export interface HeadDeformer { id: string; level: HeadLevel; group?: string; texture: string; textureBounds: number[]; bbox: number[]; cols: number; rows: number; keyforms: Record<string, Point[] | number[][]>; keyformsY?: Record<string, Point[] | number[][]>; keyformsXY?: Record<string, Point[] | number[][]>; status?: string }
export interface HeadNineAxis { version: 1; kind: 'head-nine-axis'; canvas?: number[]; view?: { x: number; y: number; width: number; height: number }; parameters?: any[]; levels: { id: string; name?: string; includes: HeadLevel[] }[]; notes?: string; parts: HeadDeformer[] }
export const levelNames: Record<HeadLevel, string>;
export function validateHeadNineAxis(doc: any): HeadNineAxis;
export function keyValues(part: HeadDeformer, axis?: 'x' | 'y'): number[];
export function keyformAt(part: HeadDeformer, x: number, y?: number, out?: Float32Array): Float32Array;
export function lattice(part: HeadDeformer): Float32Array;
export function refine(points: ArrayLike<number>, cols: number, rows: number, n: number, out?: Float32Array): Float32Array;
export function meshIndices(cols: number, rows: number): Uint32Array;
export function levelParts(doc: HeadNineAxis, levelId: string): HeadDeformer[];
export function dragKeyform(start: number[][], index: number, dx: number, dy: number, radius: number): number[][];
export function deformerTree(doc: HeadNineAxis): { id: HeadLevel; name: string; groups: { id: string; parts: HeadDeformer[] }[] }[];
