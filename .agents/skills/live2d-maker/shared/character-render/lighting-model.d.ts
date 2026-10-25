export type LightingSettings = {
  lightX: number;
  lightY: number;
  lightZ: number;
  lightColor: string;
  ambient: number;
  lightingMix: number;
  shade: string;
  toony: number;
  shift: number;
  normalStrength: number;
  normalY: number;
  depthScale: number;
  shadow: boolean;
  shadowStrength: number;
  shadowSoftness: number;
  bias: number;
  rim: number;
  background: string;
};
export const rendererVersion: string;
export const defaults: Readonly<LightingSettings>;
export const ranges: Readonly<Record<string, readonly [number, number]>>;
export const presets: Readonly<
  Record<string, { label: string; values: LightingSettings }>
>;
export function validateSettings(value: unknown): LightingSettings;
export function projectionDepth(
  depth: Uint8Array | Uint8ClampedArray,
  alpha: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array;
export function reliefGrid(
  depth: Uint8Array | Float32Array,
  alpha: Uint8Array,
  width: number,
  height: number,
  maxEdge?: number,
): {
  positions: Float32Array;
  uv: Float32Array;
  display: Uint32Array;
  caster: Uint32Array;
  vertices: number;
};
