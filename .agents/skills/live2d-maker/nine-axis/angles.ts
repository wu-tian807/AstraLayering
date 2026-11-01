import { readFileSync } from 'node:fs';
import { stepKnowledge } from '../shared/knowledge.ts';

// The face agents deliver their boundary keyforms as "-30" / "30"; the angles
// those stand for are fixed by the step01 views (left about 45°, up about 25°,
// down about 20°) and kept in knowledge/nine-axis/step01_views/references/
// angles.json. After the agents, the program writes deformers.json in those
// degrees, so the workbench's scale comes from the document itself.
export type AngleScale = { x: [number, number]; y: [number, number] };

export function angleScale(): AngleScale {
  const path = stepKnowledge('nine-axis', 'step01_views').reference('angles.json');
  let raw: Record<string, Record<string, unknown>>;
  try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { throw new Error(`先验知识缺少角度刻度：${path}`, { cause: error }); }
  const pair = (id: string): [number, number] => {
    const low = raw?.[id]?.['-30'], high = raw?.[id]?.['30'];
    if (typeof low !== 'number' || typeof high !== 'number' || !(low < 0 && high > 0)) throw new Error(`${path}：${id} 须为 {"-30": 负度数, "30": 正度数}`);
    return [low, high];
  };
  return { x: pair('ParamAngleX'), y: pair('ParamAngleY') };
}

export const angleParameter = (id: string, name: string, [min, max]: [number, number]) => ({ id, name, min, max, default: 0, keys: [min, 0, max] });
