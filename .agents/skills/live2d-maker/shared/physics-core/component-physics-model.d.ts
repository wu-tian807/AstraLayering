export const componentPhysicsVersion: string;
export class ComponentBody {
  constructor(component: any, scene: any);
  [key: string]: any;
  step(dt?: number): void;
  reset(): void;
  inspect(): any;
}
export class ComponentScene {
  constructor(config: any);
  [key: string]: any;
  step(dt?: number): void;
  reset(): void;
  inspect(): any;
}
