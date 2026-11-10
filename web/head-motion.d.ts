export type HeadPoint = { x: number; y: number };
export type HeadAxes = { x: { min: number; max: number }; y: { min: number; max: number }; plane: boolean };
export function headSideLimit(y: number): number;
export function constrainHeadPoint(point: HeadPoint): HeadPoint;
export function followHeadPointer(pointer: HeadPoint, current: HeadPoint, previous?: HeadPoint | null): HeadPoint;
export function headPreviewAngles(point: HeadPoint, axes: HeadAxes): HeadPoint;
