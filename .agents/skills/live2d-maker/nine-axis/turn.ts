import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, constants, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, delimiter, dirname, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { MissingDependencyError } from '../shared/missing-dependency.ts';
import { requireUpstream } from '../shared/upstream.ts';
import { readStep, type ChainStep } from '../shared/step-chain.ts';
import { taskDirectory } from '../shared/paths.ts';
import { toTaskPath } from '../shared/task-paths.ts';
import type { VideoApi } from '../shared/codex/environment.ts';

// Video production and frame extraction belong to the same step. Left crops
// the front once; pitch and corners reuse that registration without recropping.
export const profileAngle = 90, turnSeconds = '5';
const background = 128, margin = 0.06, neckFaces = 0.5;
const terminal = new Set(['completed', 'failed', 'cancelled', 'expired']);

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

// A head close-up: from the top of the head to the shoulder line half a face
// below the chin, centred on the face; the shoulders stay as the turn's reference. Long hair does
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

const redact = (text: string, api: VideoApi) => text.replaceAll(api.apiKey, '[redacted]').slice(-2000);
async function call(api: VideoApi, method: string, path: string, signal: AbortSignal | undefined, body?: unknown) {
  const response = await fetch(api.baseUrl.replace(/\/+$/, '') + path, { method, signal,
    headers: { authorization: `Bearer ${api.apiKey}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`生视频 ${method} ${path} HTTP ${response.status}：${redact(await response.text(), api)}`);
  return response;
}
const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

export type VideoResult = { id: string; status: Record<string, unknown>; bytes: Buffer };
// OpenAI Videos API: the first frame goes as a data URL in JSON (the proxy
// ignores multipart files); the result is polled, then downloaded.
export async function generateVideo(api: VideoApi, prompt: string, image: Buffer,
  { signal, progress, poll = 10_000, timeout = 30 * 60_000 }: { signal?: AbortSignal; progress?: (message: string) => void; poll?: number; timeout?: number } = {}): Promise<VideoResult> {
  const created = await (await call(api, 'POST', '/videos', signal,
    { model: api.model, prompt, seconds: turnSeconds, input_reference: 'data:image/png;base64,' + image.toString('base64') })).json() as Record<string, unknown>;
  const id = String(created.id ?? '');
  if (!id) throw new Error(`生视频没有返回任务 id：${redact(JSON.stringify(created), api)}`);
  progress?.(`已提交生视频 ${id}（${api.model}）`);
  const started = Date.now();
  let status = created;
  while (!terminal.has(String(status.status))) {
    if (Date.now() - started > timeout) throw new Error(`生视频等待超时：${id} 仍为 ${status.status}`);
    await wait(poll, signal);
    status = await (await call(api, 'GET', `/videos/${encodeURIComponent(id)}`, signal)).json() as Record<string, unknown>;
  }
  if (status.status !== 'completed') throw new Error(`生视频失败：${redact(JSON.stringify(status), api)}`);
  // The proxy sometimes cuts a download short.
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await call(api, 'GET', `/videos/${encodeURIComponent(id)}/content`, signal);
      const bytes = Buffer.from(await response.arrayBuffer()), length = Number(response.headers.get('content-length'));
      if (length && bytes.length !== length) throw new Error(`下载不完整（${bytes.length}/${length} 字节）`);
      return { id, status, bytes };
    } catch (error) {
      if (attempt >= 3 || signal?.aborted) throw new Error(`生视频 ${id} 下载失败`, { cause: error });
      progress?.(`生视频下载中断，重试 ${attempt}`);
    }
  }
}

export async function ffmpegPath(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const command = env.ASTRA_STUDIO_FFMPEG || 'ffmpeg';
  const candidates = command.includes('/') ? [command] : (env.PATH ?? '').split(delimiter).filter(Boolean).map(directory => join(directory, command));
  for (const candidate of candidates) if (await access(candidate, constants.X_OK).then(() => true, () => false)) return candidate;
  throw new MissingDependencyError(`找不到 ffmpeg（${command}），无法从转头视频取出左右视角帧。`,
    '请安装 ffmpeg：macOS 运行 brew install ffmpeg；Debian/Ubuntu 运行 sudo apt install ffmpeg；Windows 运行 winget install ffmpeg。已装在其他位置时用 ASTRA_STUDIO_FFMPEG 指定路径。');
}
function run(ffmpeg: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'ignore', 'pipe'], signal });
    let log = ''; child.stderr.on('data', chunk => { log = (log + chunk).slice(-20_000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(log) : reject(new Error(`ffmpeg 退出码 ${code}：${log.slice(-1500)}`)));
  });
}
// The turn is uniform from the first frame to the last, so frame k of N is at
// k/(N-1) of the way to profile. Frames are counted by decoding, not from container metadata.
export async function extractTurnFrame(ffmpeg: string, video: string, output: string, angle: number, signal?: AbortSignal) {
  const log = await run(ffmpeg, ['-i', video, '-map', '0:v:0', '-f', 'null', '-'], signal);
  const count = Number([...log.matchAll(/frame=\s*(\d+)/g)].at(-1)?.[1]);
  if (!(count > 3)) throw new Error(`转头视频帧数无效：${video}`);
  const index = Math.round((count - 1) * angle / profileAngle);
  await run(ffmpeg, ['-y', '-i', video, '-vf', `select=eq(n\\,${index})`, '-frames:v', '1', '-update', '1', output], signal);
  return { frameCount: count, frameIndex: index, angle: index / (count - 1) * profileAngle };
}

async function exists(path: string) { return access(path).then(() => true, () => false); }
async function atomic(path: string, bytes: Buffer | string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, bytes); await rename(tmp, path);
}

export type GenerateVideo = (prompt: string, image: Buffer, options: { signal?: AbortSignal; progress?: (message: string) => void }) => Promise<VideoResult>;
type Run = { signal?: AbortSignal; progress?: (message: string) => void };

// A frame comes back at the video's size; it is brought to the upper body's square.
export async function normalizeView(path: string, size: number): Promise<Buffer> {
  const grey = { r: background, g: background, b: background };
  return sharp(await sharp(await readFile(path)).flatten({ background: grey }).png().toBuffer())
    .resize(size, size, { fit: 'contain', background: grey }).removeAlpha().png().toBuffer();
}

// One video saved as <video>.mp4 in the step directory; the record's paths are
// relative to it.
async function takeVideo(directory: string, video: string, prompt: string, image: Buffer, first: string, generate: GenerateVideo, { signal, progress }: Run) {
  const mp4 = join(directory, `${video}.mp4`);
  await rm(mp4, { force: true });
  const result = await generate(prompt, image, { signal, progress: message => progress?.(`${video}：${message}`) });
  await atomic(mp4, result.bytes);
  const { url: _url, ...status } = result.status;
  progress?.(`${video} 视频已完成`);
  return { path: `${video}.mp4`, bytes: result.bytes.length, first, prompt, videoId: result.id, status };
}

// The frame of a video at a view's angle, brought to the upper body's square
// and saved as <output>; the raw frame goes under frames/.
export async function takeFrame(directory: string, output: string, video: string, angle: number, size: number, { signal, ffmpeg }: { signal?: AbortSignal; ffmpeg: string }) {
  const frame = join(directory, 'frames', basename(output));
  await rm(join(directory, output), { force: true }); await mkdir(dirname(frame), { recursive: true });
  const taken = await extractTurnFrame(ffmpeg, video, frame, angle, signal);
  const bytes = await normalizeView(frame, size);
  await atomic(join(directory, output), bytes);
  return { path: output, angle, frame: taken };
}

export const videoNames = ['left', 'up', 'down', 'left-up', 'left-down'] as const;
export type VideoName = typeof videoNames[number];
export const viewsY = ['up', 'down'] as const;
export type ViewY = typeof viewsY[number];
export type VideoPrompts = { turn: string } & Record<ViewY, string>;

// Left owns the original crop, video and reference frame. Each video record
// names its first frame relative to the video step directory.
export async function produceLeftVideo(directory: string, input: TurnInput, generate: GenerateVideo, prompt: string,
  { signal, progress, model }: Run & { model: string }) {
  const task = dirname(dirname(directory)), { width = 0, height = 0 } = await sharp(input.color).metadata();
  const box = await upperBodyBox(input, width, height), image = await cropUpperBody(input.color, box);
  await atomic(join(directory, 'upper-body.png'), image);
  await atomic(join(directory, 'crop.json'), JSON.stringify({ version: 1, source: toTaskPath(task, input.color),
    parts: input.parts.map(path => toTaskPath(task, path)), canvas: [width, height], box, background }, null, 2) + '\n');
  const run = { signal, progress }, started = Date.now();
  progress?.(`头部裁切 ${box.size}×${box.size}，提交向左转头视频`);
  const cached = await readFile(join(directory, 'videos.json'), 'utf8').then(JSON.parse, error => { if (error.code !== 'ENOENT') throw error; });
  const previous = cached?.left;
  const reusable = cached?.version === 1 && cached.model === model && cached.seconds === turnSeconds && cached.profileAngle === profileAngle
    && previous?.prompt === prompt && previous.first === 'upper-body.png' && previous.path === 'left.mp4' && await exists(join(directory, previous.path));
  const left = reusable ? previous : await takeVideo(directory, 'left', prompt, image, 'upper-body.png', generate, run);
  await atomic(join(directory, 'videos.json'), JSON.stringify({ version: 1, model, seconds: turnSeconds, profileAngle,
    input: { path: 'upper-body.png' }, ...(cached ? { up: cached.up, down: cached.down } : {}), left,
    elapsedSeconds: Math.round((Date.now() - started) / 100) / 10 }, null, 2) + '\n');
  return box;
}

export async function producePitchVideos(directory: string, front: string, generate: GenerateVideo, prompts: Record<ViewY, string>,
  { signal, progress, model }: Run & { model: string }) {
  const upperBody = join(front, 'upper-body.png'), image = await readFile(upperBody), started = Date.now();
  type Batch = { version: number; model: string; seconds: string; profileAngle: number } & Partial<Record<ViewY, Awaited<ReturnType<typeof takeVideo>>>>;
  const cached: Batch | undefined = await readFile(join(directory, 'videos.json'), 'utf8').then(text => JSON.parse(text), error => {
    if (error.code !== 'ENOENT') throw error;
  });
  const sameInput = cached?.version === 1 && cached.model === model && cached.seconds === turnSeconds
    && cached.profileAngle === profileAngle;
  progress?.('提交抬头、低头绕轴视频，沿用左转步骤的正面裁框');
  const records = await Promise.all(viewsY.map(async view => {
    const previous = cached?.[view], first = relative(directory, upperBody).split(sep).join('/');
    if (sameInput && previous?.prompt === prompts[view] && previous.first === first && previous.path === `${view}.mp4`
      && await exists(join(directory, previous.path))) {
      progress?.(`${view}：沿用本步已生成的视频`);
      return [view, previous] as const;
    }
    return [view, await takeVideo(directory, view, prompts[view], image, first, generate, { signal, progress })] as const;
  }));
  await atomic(join(directory, 'videos.json'), JSON.stringify({ version: 1, model, seconds: turnSeconds, profileAngle,
    input: { path: relative(directory, upperBody).split(sep).join('/') }, ...(directory === front && cached && 'left' in cached ? { left: cached.left } : {}), ...Object.fromEntries(records),
    elapsedSeconds: Math.round((Date.now() - started) / 100) / 10 }, null, 2) + '\n');
}

export async function produceCornerVideos(directory: string, pitch: string, generate: GenerateVideo, prompt: string,
  { signal, progress, model }: Run & { model: string }) {
  const started = Date.now();
  type Batch = { version: number; model: string; seconds: string; profileAngle: number } & Partial<Record<`left-${ViewY}`, Awaited<ReturnType<typeof takeVideo>>>>;
  const cached: Batch | undefined = await readFile(join(directory, 'videos.json'), 'utf8').then(text => JSON.parse(text), error => {
    if (error.code !== 'ENOENT') throw error;
  });
  const sameSettings = cached?.version === 1 && cached.model === model && cached.seconds === turnSeconds && cached.profileAngle === profileAngle;
  progress?.('提交左上、左下转头参考视频');
  const records = await Promise.all(viewsY.map(async view => {
    const corner = `left-${view}` as const, first = relative(directory, join(pitch, `${view}.png`)).split(sep).join('/'), previous = cached?.[corner];
    if (sameSettings && previous?.prompt === prompt && previous.path === `${corner}.mp4` && await exists(join(directory, previous.path))) {
      progress?.(`${corner}：沿用本步已生成的视频`);
      return [corner, { ...previous, first }] as const;
    }
    return [corner, await takeVideo(directory, corner, prompt, await readFile(join(pitch, `${view}.png`)), first, generate, { signal, progress })] as const;
  }));
  await atomic(join(directory, 'videos.json'), JSON.stringify({ version: 1, model, seconds: turnSeconds, profileAngle,
    ...Object.fromEntries(records), elapsedSeconds: Math.round((Date.now() - started) / 100) / 10 }, null, 2) + '\n');
}

// The reference frames are chosen by an agent from the left, up and down
// videos and recorded in selected-frames.json; views.json is written from it.
export const turnViews = ['left', ...viewsY] as const;
export type TurnView = typeof turnViews[number];
export const viewOutputs = (views: readonly string[]) => [...views.map(view => `${view}.png`), 'views.json'];
const selectionFiles = (names: readonly string[]) => ['selected-frames.json', ...names.flatMap(name => [`${name}.png`, `frames/${name}.png`])];

// An agent picks each frame once; frames already delivered are kept as is.
export async function runFrameSelection(directory: string, names: readonly string[], select: () => Promise<void>) {
  const missing = async () => (await Promise.all(selectionFiles(names).map(file => exists(join(directory, file)).then(found => found ? undefined : file)))).filter(Boolean);
  if (!(await missing()).length) return;
  await select();
  const left = await missing();
  if (left.length) throw Error(`选帧缺少交付：${left.map(file => join(directory, file!)).join('、')}`);
}

// Each chosen frame names its own video and the normalized <name>.png, with a
// recorded frame position and reason, at the upper body's square size.
export async function checkSelectedFrames(directory: string, names: readonly string[], size: number) {
  const selected = JSON.parse(await readFile(join(directory, 'selected-frames.json'), 'utf8'));
  if (selected.version !== 1 || !selected.frames || typeof selected.frames !== 'object') throw Error('selected-frames.json 需要 version:1 和 frames 对象');
  for (const name of names) {
    const frame = selected.frames[name];
    const sameFile = (value: unknown, file: string) => typeof value === 'string' && resolve(directory, value) === resolve(directory, file);
    if (!frame || !sameFile(frame.video, `${name}.mp4`) || !sameFile(frame.path, `${name}.png`) || typeof frame.reason !== 'string' || !frame.reason.trim()) throw Error(`${name}：缺少本步选帧路径或选择依据`);
    if (!(Number.isSafeInteger(frame.frameIndex) && frame.frameIndex >= 0) && !(Number.isFinite(frame.timeSeconds) && frame.timeSeconds >= 0)) throw Error(`${name}：记录实际 frameIndex 或 timeSeconds，不以估算角度代替`);
    await readFile(join(directory, 'frames', `${name}.png`));
    const meta = await sharp(resolve(directory, frame.path)).metadata();
    if (meta.format !== 'png' || meta.width !== size || meta.height !== size) throw Error(`${name}：参考帧必须保留裁框并规范化为 ${size}×${size} PNG`);
  }
  return selected.frames as Record<string, { frameIndex?: number; timeSeconds?: number; reason: string }>;
}

export async function finishViews(directory: string, angles: Record<TurnView, number>) {
  const task = dirname(dirname(directory)), upperBody = join(directory, 'upper-body.png');
  const { width = 0 } = await sharp(upperBody).metadata();
  const frames = await checkSelectedFrames(directory, turnViews, width);
  await atomic(join(directory, 'views.json'), JSON.stringify({ version: 1, input: { path: toTaskPath(task, upperBody) },
    ...Object.fromEntries(turnViews.map(view => { const { frameIndex, timeSeconds, reason } = frames[view]; return [view, { path: `${view}.png`, angle: angles[view],
      frame: { frameIndex, timeSeconds }, reason, video: { path: toTaskPath(task, join(directory, `${view}.mp4`)) } }]; })) }, null, 2) + '\n');
}
