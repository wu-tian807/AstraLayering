import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { requireUpstream } from '../shared/upstream.ts';
import { readStep, type ChainStep } from '../shared/step-chain.ts';
import { taskDirectory } from '../shared/paths.ts';
import { toTaskPath } from '../shared/task-paths.ts';

// step01_views: the upper body around the head is redrawn by an image model in
// five head poses, each copied from a template character's front → pose pair.
// The right-side poses are not drawn: later steps mirror the face deformation.
export const turnViews = ['left', 'up', 'down', 'left-up', 'left-down'] as const;
export type TurnView = typeof turnViews[number];
const background = 128, margin = 0.06, neckFaces = 0.5;

export type TurnInput = { color: string; source: ChainStep; parts: string[] };
export type Box = { x: number; y: number; size: number };

// The same colour the workbench shows: the delivered shadow mask when it is
// complete, otherwise the assembled character.
export async function resolveTurnInput(name: string, root: string): Promise<TurnInput> {
  const task = taskDirectory(name, root), shadow = join(task, 'shadow/step01_mask');
  const color = join(shadow, 'character-shadowed.png');
  let source: ChainStep;
  if ((await readStep(shadow)).status === 'completed' && await exists(color)) {
    source = { id: 'shadow/step01_mask', directory: shadow };
  } else {
    const assembly = join(await requireUpstream(name, 'character-assembly', [{ path: 'step01/character-assembled.png' }], root), 'step01');
    source = { id: 'character-assembly/step01', directory: assembly };
  }
  const parts = await requireUpstream(name, 'part-layering', [{ path: 'parts/face.svg' }], root);
  const optional = ['hair.svg', 'head_accessories.svg'].map(file => join(parts, 'parts', file));
  return { color: source.id.startsWith('shadow') ? color : join(source.directory, 'character-assembled.png'), source,
    parts: [join(parts, 'parts/face.svg'), ...(await Promise.all(optional.map(async path => await exists(path) ? path : ''))).filter(Boolean)] };
}

async function alphaBounds(svg: string, width: number, height: number) {
  const { data, info } = await sharp(await readFile(svg)).resize(width, height, { fit: 'fill' }).ensureAlpha()
    .extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] < 128) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? undefined : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

// A head close-up like the template poses: from the top of the head to the
// shoulder line half a face below the chin, centred on the face. Long hair does
// not widen it; only the face and head accessories must fit.
export async function upperBodyBox(input: TurnInput, width: number, height: number): Promise<Box> {
  const [face, ...rest] = await Promise.all(input.parts.map(path => alphaBounds(path, width, height)));
  if (!face) throw new Error(`脸部形状为空：${input.parts[0]}`);
  const head = [face, ...rest].filter(b => !!b);
  const sides = [face, ...rest.filter((b, i) => b && !input.parts[i + 1].endsWith('/hair.svg'))].filter(b => !!b);
  const top = Math.min(...head.map(b => b.y0)), left = Math.min(...sides.map(b => b.x0)), right = Math.max(...sides.map(b => b.x1));
  // A bust drawn to the canvas edge has nothing below it; the crop stops at the canvas.
  const bottom = Math.min(height, face.y1 + neckFaces * (face.y1 - face.y0)), cx = (face.x0 + face.x1) / 2;
  const size = Math.ceil(Math.max(bottom - top, 2 * Math.max(cx - left, right - cx)) / (1 - 2 * margin));
  return { x: Math.round(cx - size / 2), y: Math.round(top - size * margin), size };
}

// Outside the canvas and behind the character is plain grey, as the prompt says.
export async function cropUpperBody(color: string, box: Box): Promise<Buffer> {
  const image = sharp(await readFile(color)), { width = 0, height = 0 } = await image.metadata();
  const left = Math.max(0, box.x), top = Math.max(0, box.y);
  const right = Math.min(width, box.x + box.size), bottom = Math.min(height, box.y + box.size);
  if (right <= left || bottom <= top) throw new Error('上半身裁切框落在画布之外');
  const part = await image.extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
  return sharp({ create: { width: box.size, height: box.size, channels: 3, background: { r: background, g: background, b: background } } })
    .composite([{ input: part, left: left - box.x, top: top - box.y }]).removeAlpha().png().toBuffer();
}

export const fileHash = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex');
const bufferHash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function exists(path: string) { return access(path).then(() => true, () => false); }
async function atomic(path: string, bytes: Buffer | string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, bytes); await rename(tmp, path);
}

export const turnOutputs = ['upper-body.png', 'crop.json', ...turnViews.map(view => `${view}.png`), 'views.json'] as const;
// Draws one view from upper-body.png into output; the path is the agent's.
export type DrawView = (view: TurnView, output: string) => Promise<void>;

// A view comes back at the image model's size and may carry transparency; it is
// laid on the same grey and brought to the upper body's square.
export async function normalizeView(path: string, size: number): Promise<Buffer> {
  const grey = { r: background, g: background, b: background };
  return sharp(await sharp(await readFile(path)).flatten({ background: grey }).png().toBuffer())
    .resize(size, size, { fit: 'contain', background: grey }).removeAlpha().png().toBuffer();
}

// The whole step: crop, then all views at once. Paths in records are task-relative.
export async function produceTurn(directory: string, input: TurnInput, draw: DrawView,
  { progress, model }: { progress?: (message: string) => void; model: string }) {
  const task = dirname(dirname(directory)), { width = 0, height = 0 } = await sharp(input.color).metadata();
  const box = await upperBodyBox(input, width, height), image = await cropUpperBody(input.color, box);
  await atomic(join(directory, 'upper-body.png'), image);
  await atomic(join(directory, 'crop.json'), JSON.stringify({ version: 1, source: toTaskPath(task, input.color), sourceHash: await fileHash(input.color),
    parts: input.parts.map(path => toTaskPath(task, path)), canvas: [width, height], box, background }, null, 2) + '\n');
  progress?.(`上半身裁切 ${box.size}×${box.size}，生成 ${turnViews.length} 个视角`);
  const started = Date.now(), views: Record<string, { path: string; sha256: string }> = {};
  // Every view runs to its end before a failure is reported, so no agent outlives the step.
  const results = await Promise.allSettled(turnViews.map(async view => {
    const output = join(directory, `${view}.png`), generated = join(directory, 'generated', `${view}.png`);
    await rm(output, { force: true }); await mkdir(dirname(generated), { recursive: true });
    await draw(view, generated);
    const bytes = await normalizeView(generated, box.size);
    await atomic(output, bytes);
    views[view] = { path: `${view}.png`, sha256: bufferHash(bytes) };
    progress?.(`视角 ${view} 已完成`);
  }));
  const failed = results.flatMap((result, index) => result.status === 'rejected' ? [`${turnViews[index]}：${result.reason instanceof Error ? result.reason.message : result.reason}`] : []);
  if (failed.length) throw new Error(`视角参考生成失败（${failed.length}/${turnViews.length}）\n${failed.join('\n')}`, { cause: (results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason });
  await atomic(join(directory, 'views.json'), JSON.stringify({ version: 1, model, input: { path: 'upper-body.png', sha256: bufferHash(image) },
    views: Object.fromEntries(turnViews.map(view => [view, views[view]])), elapsedSeconds: Math.round((Date.now() - started) / 100) / 10 }, null, 2) + '\n');
  return box;
}
