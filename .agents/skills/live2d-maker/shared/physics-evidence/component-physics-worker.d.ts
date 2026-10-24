export function advancePhysicsJob(scene: any, job: any): { elapsed: number; replayStep: number; playback: string; paused: boolean };
export interface PhysicsSnapshot {
  buffer: ArrayBuffer;
  components: Array<{ id: string; arrays: Record<string, [number, number]>; stats: any; impulses: number; angularVelocity: number }>;
  sourcePose: { x: number; y: number; angle: number };
  clockStep: number;
}
export function physicsSnapshot(scene: any, buffer?: ArrayBuffer): PhysicsSnapshot;
