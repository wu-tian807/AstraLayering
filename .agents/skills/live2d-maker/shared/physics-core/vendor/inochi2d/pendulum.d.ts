export class InochiPendulum {
  constructor(body: any);
  angle: number;
  speed: number;
  lastPivot: number[] | null;
  frameAngle: number;
  step(h: number): void;
  reset(): void;
}
