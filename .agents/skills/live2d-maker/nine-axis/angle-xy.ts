import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { FunctionTool } from '../shared/codex/function-tools.ts';
import { taskRootOf, toAgentPath } from '../shared/task-paths.ts';
import { angleKey, angleScale, type AngleScale } from './angles.ts';
import { checkFaceY, cornersPending, type FaceY } from './angle-y.ts';
import { mirrorKeyform, pairId, sign, type Part } from './head.ts';
import { takeView, type GenerateVideo } from './turn.ts';

// step05_angle-xy: the diagonal (corner) keyforms on both angles. The program
// writes the linear start — rest + the X offset + the Y offset — for the left
// corners (linear.json); the agent shears them by hand into face-xy.json, and
// may take a corner reference frame (corner_view) when it needs one. The right
// corners are the mirror images, and the workbench blends the 3×3 grid of keyforms.

type Point = [number, number];
type YPart = Part & { keyformsY: Record<string, Point[]> };
type YDocument = { axis: number; parts: YPart[]; parameters: { id: string }[]; notes?: string };

// Corner keyform keys: both parameter values, X first ("-30,25").
export const cornerKey = (x: number, y: number) => `${angleKey(x)},${angleKey(y)}`;
export const corners = ['left-up', 'left-down'] as const;
export type Corner = typeof corners[number];
const cornerValues = ({ x, y }: AngleScale) => ({ 'left-up': [x[0], y[1]], 'left-down': [x[0], y[0]] }) as Record<Corner, [number, number]>;
export const cornerAngleValues = (scale: AngleScale = angleScale()) => {
  const v = cornerValues(scale);
  return { left_up: cornerKey(...v['left-up']), left_down: cornerKey(...v['left-down']) };
};

async function atomic(path: string, text: string | Buffer) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, text); await rename(tmp, path);
}
const round = (value: number) => Math.round(value * 100) / 100;

// The start the agent shears from: X and Y offsets from the rest form added up.
export function linearCorner(part: YPart, x: number, y: number): Point[] {
  const rest = part.keyforms['0'], X = part.keyforms[angleKey(x)], Y = part.keyformsY[angleKey(y)];
  return rest.map(([rx, ry], i) => [round(X[i][0] + Y[i][0] - rx), round(X[i][1] + Y[i][1] - ry)]);
}
export async function writeLinearCorners(directory: string, angleY: string, scale: AngleScale = angleScale()) {
  const doc = JSON.parse(await readFile(join(angleY, 'deformers.json'), 'utf8')) as YDocument, v = cornerValues(scale);
  await atomic(join(directory, 'linear.json'), JSON.stringify({ notes: 'X 与 Y 的线性叠加', parts: doc.parts.map(p => ({ id: p.id,
    keyforms: Object.fromEntries(corners.map(c => [cornerKey(...v[c]), linearCorner(p, ...v[c])])) })) }) + '\n');
}

// The corner reference: step01's head-turn video from step03's up or down view,
// taken at the left angle as step01 does.
export function createCornerTool(directory: string, viewsY: string, prompt: string, angle: number,
  video: () => Promise<{ generate: GenerateVideo; ffmpeg: string }>, progress?: (message: string) => void): FunctionTool {
  return {
    ...toolDefinition('corner_view'),
    async execute(value, signal, context) {
      const corner = (value as { corner?: unknown } | null)?.corner as Corner;
      if (!corners.includes(corner)) throw new Error(`corner 须为 ${corners.join(' 或 ')}`);
      const first = join(viewsY, corner === 'left-up' ? 'up.png' : 'down.png'), image = await readFile(first);
      const { width = 0 } = await sharp(image).metadata(), { generate, ffmpeg } = await video();
      const record = await takeView(directory, corner, prompt, angle, image, width, generate, { signal, progress, ffmpeg });
      await atomic(join(directory, `${corner}.json`), JSON.stringify({ version: 1, first: corner === 'left-up' ? 'up.png' : 'down.png', angle, ...record }, null, 2) + '\n');
      const root = context?.root ?? taskRootOf(directory), bytes = await readFile(join(directory, record.path));
      return { success: true, contentItems: [
        { type: 'inputText', text: JSON.stringify({ path: await toAgentPath(root, join(directory, record.path)), frame: record.frame }) },
        { type: 'inputImage', imageUrl: `data:image/png;base64,${bytes.toString('base64')}` },
      ] };
    },
  };
}

// After the agent: check face-xy.json against step04, mirror the right corners
// and write the deformers.json the workbench reads.
export async function finishAngleXY(directory: string, angleY: string, scale: AngleScale = angleScale()): Promise<number> {
  const doc = JSON.parse(await readFile(join(angleY, 'deformers.json'), 'utf8')) as YDocument, v = cornerValues(scale);
  let raw: unknown;
  try { raw = JSON.parse(await readFile(join(directory, 'face-xy.json'), 'utf8')); }
  catch (error) { throw new Error('agent 未交付可读的 face-xy.json', { cause: error }); }
  const keys = corners.map(c => cornerKey(...v[c]));
  const byId = new Map(checkFaceY(raw, doc, keys, 'face-xy.json', 'step04').parts.map(p => [p.id, p.keyforms]));
  await mkdir(join(directory, 'layers'), { recursive: true });
  for (const p of doc.parts) await copyFile(join(angleY, p.texture), join(directory, p.texture));
  const parts = doc.parts.map(p => {
    const own = byId.get(p.id)!, pair = doc.parts.find(q => q.id === pairId(p.id)) ?? p, forms = byId.get(pair.id)!;
    const right = (c: Corner) => {
      const [x, y] = v[c], key = cornerKey(x, y);
      return [cornerKey(-x, y), mirrorKeyform(p, { ...pair, keyforms: { ...pair.keyforms, [key]: forms[key] } }, doc.axis, key)] as const;
    };
    return { ...p, keyformsXY: { ...Object.fromEntries(keys.map(k => [k, own[k]])), ...Object.fromEntries(corners.map(right)) } };
  });
  const [lx] = v['left-up'];
  const notes = [doc.notes?.replace(cornersPending, '').trim(), (raw as FaceY).notes?.trim(),
    `斜向：${sign(lx)}° 的左上、左下手动斜切，${sign(-lx)}° 的右上、右下为左右成对镜像；四角之间双线性插值。`].filter(Boolean).join(' ');
  await atomic(join(directory, 'deformers.json'), JSON.stringify({ ...doc, notes, parts }) + '\n');
  return parts.length;
}
