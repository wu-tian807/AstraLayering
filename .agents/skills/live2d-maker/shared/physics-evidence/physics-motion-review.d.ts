export const motionReviewVersion: string;
export const motionStepBasis: string;
export class MotionStepTracker {
  constructor(canvas: {width: number; height: number}, length: number,maximum?:number);
  discontinuityRatio?:number;
  maxStep: number;
  maxWorldStep: number;
  maxAcceleration:number;
  visiblePeak:number;
  visibleTravel:number;
  fallbackStreak:number;
  maxFallbackStreak:number;
  update(positions: ArrayLike<number>, pose: {x: number; y: number; angle: number}, fallback?:boolean): void;
}
export function motionIssues(test: string, component: any, metric: {invalid: number;root: number;fallback: number;limited: number;peak: number;final: number;maxStep: number;maxAcceleration?:number;discontinuityRatio?:number;visiblePeak?:number;maxFallbackStreak?:number;recovery?:any}, steps?: number): string[];
