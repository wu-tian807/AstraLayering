import { readFileSync } from 'node:fs';
import { stepKnowledge } from '../shared/knowledge.ts';

// ParamAngleX and ParamAngleY use degrees in authoring and deformers.json.
// Mapping to another range (e.g. Cubism ±30) belongs to an exporter.
export type AngleScale = { x: [number, number]; y: [number, number] };

export function angleScale(): AngleScale {
  const path = stepKnowledge('nine-axis', 'step02_video').reference('angles.json');
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { throw new Error(`先验知识缺少角度：${path}`, { cause: error }); }
  const degrees = (view: string): number => {
    const value = raw?.[view];
    if (typeof value !== 'number' || !(value > 0)) throw new Error(`${path}：${view} 须为该视角的正度数`);
    return value;
  };
  const left = degrees('left');
  return { x: [-left, left], y: [-degrees('down'), degrees('up')] };
}

// Keyform keys are the parameter values written as JSON keys ("-30", "30").
export const angleKey = (value: number) => String(value);

export const angleParameter = (id: string, name: string, [min, max]: [number, number]) => ({ id, name, min, max, default: 0, keys: [min, 0, max] });
