export class ComponentPhysicsLiveRunner {
  constructor(panel: any);
  readonly worker: Worker;
  ready: boolean;
  busy: boolean;
  pendingSteps: number;
  maxBatchSteps: number;
  advance(steps: number, manual: boolean): boolean;
  pump(): void;
  reset(): void;
  dispose(): void;
}

export const ComponentPhysicsPanel: any;
