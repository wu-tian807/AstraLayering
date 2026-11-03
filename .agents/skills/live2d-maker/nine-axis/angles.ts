import { readFileSync } from 'node:fs';
import { stepKnowledge } from '../shared/knowledge.ts';

// ParamAngleX / ParamAngleY are in degrees everywhere: the step01 views, the
// agents' prompts and deliveries, and deformers.json. The degrees of each view
// (left about 30°, up and down about 25°) live only in knowledge/
// nine-axis/step01_video/references/angles.json and are filled into the
// prompts; mapping to another range (e.g. Cubism ±30) belongs to an exporter.
export type AngleScale = { x: [number, number]; y: [number, number] };

export function angleScale(): AngleScale {
  const path = stepKnowledge('nine-axis', 'step01_video').reference('angles.json');
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

// What the prompts are filled with: parameter values (keys) and view magnitudes.
export const angleValues = ({ x, y }: AngleScale = angleScale()) => ({
  left_angle: angleKey(x[0]), right_angle: angleKey(x[1]), down_angle: angleKey(y[0]), up_angle: angleKey(y[1]),
  left_degrees: String(x[1]), up_degrees: String(y[1]), down_degrees: String(-y[0]),
});

export const angleParameter = (id: string, name: string, [min, max]: [number, number]) => ({ id, name, min, max, default: 0, keys: [min, 0, max] });
