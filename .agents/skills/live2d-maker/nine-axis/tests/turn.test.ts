import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { cropUpperBody, extractTurnFrame, ffmpegPath, generateVideo, resolveTurnInput, upperBodyBox } from '../turn.ts';
import { angleXYPrompt, angleYPrompt, headPrompt, jawLinePrompt, runWorkflow, videoPrompt } from '../run.ts';
import { writeFaceLeft } from './head.test.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { readUpstream, startContinuation } from '../continuation.ts';
import { MissingDependencyError } from '../../shared/missing-dependency.ts';

const rect = (w: number, h: number, x: number, y: number, rw: number, rh: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="#000"/></svg>`;
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'astra-nine-axis-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const task = join(root, 'case'), assembly = join(task, 'character-assembly/step01'), parts = join(task, 'part-layering/parts');
  await mkdir(assembly, { recursive: true }); await mkdir(parts, { recursive: true });
  await writeFile(join(assembly, 'character-assembled.png'), await sharp({ create: { width: 200, height: 400, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 1 } } }).png().toBuffer());
  await writeFile(join(assembly, 'character-assembled.kra'), 'kra');
  await writeFile(join(assembly, '.completed'), JSON.stringify({ stamp: 'assembly-1', inputs: {} }));
  await writeFile(join(parts, 'face.svg'), rect(200, 400, 80, 60, 40, 50));
  await writeFile(join(parts, 'hair.svg'), rect(200, 400, 60, 30, 70, 70));
  return { root, task };
}

test('单跑 left 沿用参考输入，不调用视频或后续形变步骤', async t => {
  const { root, task } = await fixture(t), nine = join(task, 'nine-axis'), videos = join(nine, 'step01_video'), views = join(nine, 'step01_video');
  await mkdir(videos, { recursive: true }); await mkdir(views, { recursive: true });
  const crop = JSON.stringify({ box: { x: 0, y: 0, size: 200 } });
  await writeFile(join(videos, 'crop.json'), crop);
  const left = await readFile(join(task, 'character-assembly/step01/character-assembled.png'));
  await writeFile(join(views, 'left.png'), left);
  const unexpected = async () => { throw new Error('不应调用其他步骤'); };
  const summary = await runWorkflow({ name: 'case', dir: root, step: 'step02_angle-x' }, {
    environment: loadWorkflowEnvironment({}), generate: unexpected, fitHead: writeFaceLeft,
    fitUp: unexpected, fitDown: unexpected, fitAngleXY: unexpected, fitJawLine: unexpected,
  });
  assert.match(summary, /step02_angle-x 已完成/);
  assert.equal(await readFile(join(videos, 'crop.json'), 'utf8'), crop);
  assert.deepEqual(await readFile(join(views, 'left.png')), left);
  await access(join(nine, 'step02_angle-x/.completed'));
  for (const step of ['step03_video-y', 'step04_angle-up', 'step05_angle-down', 'step06_angle-xy', 'step07_jaw-line']) await assert.rejects(access(join(nine, step)), { code: 'ENOENT' });
});

test('头部特写从头顶截到肩线，以脸为中心并留边，长发不加宽', async t => {
  const { root } = await fixture(t);
  const input = await resolveTurnInput('case', root);
  assert.equal(input.source.id, 'character-assembly/step01');
  assert.equal(input.parts.length, 2, '缺少头饰形状时只用脸与头发');
  const box = await upperBodyBox(input, 200, 400);
  // Hair top 30, face 60–110 → shoulders at 110 + 0.5×50 = 135; height 105 / 0.88.
  // The hair (60–130) is wider than the face but does not widen the square.
  assert.equal(box.size, Math.ceil(105 / 0.88));
  assert.equal(box.x, Math.round(100 - box.size / 2));
  assert.equal(box.y, Math.round(30 - box.size * 0.06));
  const image = sharp(await cropUpperBody(input.color, { x: -10, y: 0, size: 50 }));
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [50, 50]);
  assert.deepEqual([...data.subarray(0, 3)], [128, 128, 128], '画布外补灰');
  assert.deepEqual([...data.subarray(30 * 3, 30 * 3 + 3)], [200, 100, 50]);
});

test('胸像的脸靠下时，裁切止于画布底边', async t => {
  const { root, task } = await fixture(t);
  await writeFile(join(task, 'part-layering/parts/face.svg'), rect(200, 400, 60, 200, 80, 150));
  const input = await resolveTurnInput('case', root);
  // Hair top 30; the shoulders would fall at 350 + 0.5×150, so it stops at 400.
  assert.equal((await upperBodyBox(input, 200, 400)).size, Math.ceil(370 / 0.88));
});

test('阴影蒙版完成时用阴影角色图', async t => {
  const { root, task } = await fixture(t);
  const shadow = join(task, 'shadow/step01_mask');
  await mkdir(shadow, { recursive: true });
  await writeFile(join(shadow, 'character-shadowed.png'), await readFile(join(task, 'character-assembly/step01/character-assembled.png')));
  assert.equal((await resolveTurnInput('case', root)).source.id, 'character-assembly/step01', '未完成的阴影不作来源');
  await writeFile(join(shadow, '.completed'), JSON.stringify({ stamp: 'shadow-1', inputs: {} }));
  const input = await resolveTurnInput('case', root);
  assert.equal(input.source.id, 'shadow/step01_mask');
  assert.equal(input.color, join(shadow, 'character-shadowed.png'));
});

test('转头提示词向左；生视频只用自己的接口，不读生图接口', async () => {
  assert.match(videoPrompt(), /转向画面左侧/);
  assert.doesNotMatch(videoPrompt(), /[{}]/);
  assert.match(videoPrompt('up'), /仰视/);
  assert.match(videoPrompt('down'), /俯视/);
  assert.equal(loadWorkflowEnvironment({}).videoApi, undefined);
  assert.equal(loadWorkflowEnvironment({ openai_image_base_url: 'https://image.example/v1', openai_image_api_key: 'i' }).videoApi, undefined);
  assert.throws(() => loadWorkflowEnvironment({ video_base_url: 'https://video.example/v1' }), /video_api_key/);
  assert.deepEqual(loadWorkflowEnvironment({ layering_video_base_url: 'https://video.example/v1', layering_video_api_key: 'k' }).videoApi,
    { baseUrl: 'https://video.example/v1', apiKey: 'k', model: 'seedance-2.5' });
  assert.deepEqual(loadWorkflowEnvironment({ openai_image_base_url: 'https://image.example/v1', openai_image_api_key: 'i',
    video_base_url: 'https://video.example/v1', video_api_key: 'k', nine_axis_view_video_model: 'm' }).videoApi,
    { baseUrl: 'https://video.example/v1', apiKey: 'k', model: 'm' });
  await assert.rejects(ffmpegPath({ PATH: '' }), (error: unknown) => error instanceof MissingDependencyError);
});

test('生视频提交、轮询并下载，错误中不含密钥', async t => {
  const requests: string[] = [];
  let polls = 0;
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url} ${request.headers.authorization}`);
    let body = ''; request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      if (request.method === 'POST') {
        const json = JSON.parse(body);
        assert.equal(json.model, 'seedance-test'); assert.equal(json.seconds, '5'); assert.match(json.input_reference, /^data:image\/png;base64,/);
        response.end(JSON.stringify({ id: 'v1', status: 'queued' }));
      } else if (request.url === '/videos/v1') response.end(JSON.stringify({ id: 'v1', status: ++polls < 2 ? 'in_progress' : 'completed' }));
      else if (request.url === '/videos/v1/content') response.end('mp4');
      else { response.statusCode = 500; response.end('bad secret-key'); }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const api = { baseUrl: base, apiKey: 'secret-key', model: 'seedance-test' };
  const video = await generateVideo(api, 'turn', Buffer.from('png'), { poll: 1 });
  assert.equal(video.bytes.toString(), 'mp4');
  assert.equal(requests[0], 'POST /videos Bearer secret-key');
  await assert.rejects(generateVideo({ ...api, baseUrl: base + '/x' }, 'turn', Buffer.from('png'), { poll: 1 }),
    (error: Error) => !error.message.includes('secret-key') && error.message.includes('[redacted]'));
});

async function testVideo(t: TestContext, path: string) {
  const ffmpeg = await ffmpegPath().catch(() => undefined);
  if (!ffmpeg) { t.skip('没有 ffmpeg'); return undefined; }
  assert.equal(spawnSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=32x32:rate=10', '-frames:v', '61', '-pix_fmt', 'yuv420p', path]).status, 0);
  return ffmpeg;
}

test('按帧序取出转到 30° 的帧（整段匀速转到 90°）', async t => {
  const root = await mkdtemp(join(tmpdir(), 'astra-turn-frame-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const video = join(root, 'turn.mp4'), ffmpeg = await testVideo(t, video);
  if (!ffmpeg) return;
  assert.deepEqual(await extractTurnFrame(ffmpeg, video, join(root, 'frame.png'), 30), { frameCount: 61, frameIndex: 20, angle: 30 });
  assert.equal((await sharp(join(root, 'frame.png')).metadata()).width, 32);
});

test('脸部步骤提示词以度数写出关键形', () => {
  const head = { document: '/task/a.kra', color: '/task/a.png' } as Parameters<typeof headPrompt>[0];
  const x = headPrompt(head, '/task'), up = angleYPrompt('/task', 'up'), down = angleYPrompt('/task', 'down'), xy = angleXYPrompt('/task'), jaw = jawLinePrompt(head, '/task');
  assert.match(x, /ParamAngleX = -30/);
  assert.match(up, /ParamAngleY = 25/);
  assert.match(down, /ParamAngleY = -25/);
  assert.match(xy, /"-30,25"[\s\S]*"-30,-25"/);
  assert.match(jaw, /"-30,25"/);
  assert.match(jaw, /"invert": true/);
  for (const prompt of [x, up, down, xy, jaw]) assert.doesNotMatch(prompt, /\{\w+\}/);
});

test('七步依次生成各自视频与参考帧，尺寸一致，完成后沿用', async t => {
  const { root, task } = await fixture(t);
  const sample = join(root, 'sample.mp4'), ffmpeg = await testVideo(t, sample);
  if (!ffmpeg) return;
  const prompts: string[] = [];
  const firsts: Buffer[] = [];
  const generate = async (prompt: string, image: Buffer) => { prompts.push(prompt); firsts.push(image); return { id: `v${prompts.length}`, status: { status: 'completed' }, bytes: await readFile(sample) }; };
  let fitted = 0;
  const fitHead = async (directory: string) => { fitted++; await writeFaceLeft(directory); };
  // All later fits retain the complete hierarchy and exact upstream source.
  const fitUp = async (directory: string) => {
    await createContinuationEditTool(directory, join(directory, '../step02_angle-x'), 'up').execute({}, new AbortController().signal);
  };
  const fitDown = async (directory: string) => {
    await createContinuationEditTool(directory, join(directory, '../step04_angle-up'), 'down').execute({}, new AbortController().signal);
  };
  const fitAngleXY = async (directory: string) => {
    await createContinuationEditTool(directory, join(directory, '../step05_angle-down'), 'xy').execute({}, new AbortController().signal);
  };
  const fitJawLine = async (directory: string) => {
    const upstream = await readUpstream(join(directory, '../step06_angle-xy'));
    const doc = startContinuation(upstream.doc, upstream.hash, 'jaw');
    const base = doc.parts.find(p => p.id === 'face/face_base')!;
    await mkdir(join(directory, 'layers'), { recursive: true });
    for (const name of ['jaw_line', 'jaw_mask']) await writeFile(join(directory, `layers/${name}.png`), 'png');
    const fresh = (id: string, extra: object) => ({ ...structuredClone(base), id, group: 'jaw', texture: `layers/${id.split('/')[1]}.png`, ...extra });
    doc.parts.push(fresh('face/jaw_mask', { role: 'mask' }), fresh('face/jaw_line', { clip: { by: ['face/jaw_mask'], invert: true } }));
    await writeFile(join(directory, 'jaw.json'), JSON.stringify(doc));
  };
  const deps = { environment: loadWorkflowEnvironment({}), generate, ffmpeg, fitHead, fitUp, fitDown, fitAngleXY, fitJawLine };
  assert.match(await runWorkflow({ name: 'case', dir: root }, deps), /step07_jaw-line 已完成：6 个部件的下颌线与脖子/);
  const videos = join(task, 'nine-axis/step01_video'), step = join(task, 'nine-axis/step01_video');
  const size = (await sharp(join(videos, 'upper-body.png')).metadata()).width;
  const record01 = JSON.parse(await readFile(join(videos, 'videos.json'), 'utf8'));
  await access(join(videos, 'left.mp4'));
  for (const name of ['up', 'down', 'left-up', 'left-down']) await assert.rejects(access(join(videos, `${name}.mp4`)));
  const corners = join(task, 'nine-axis/step06_angle-xy');
  const recordCorners = JSON.parse(await readFile(join(corners, 'videos.json'), 'utf8'));
  for (const name of ['left-up', 'left-down']) await access(join(corners, `${name}.mp4`));
  // The corner turns start from the up and down views at their angles.
  assert.deepEqual([recordCorners['left-up'].first, recordCorners['left-down'].first], ['../step03_video-y/up.png', '../step03_video-y/down.png']);
  assert.equal(record01.left.first, 'upper-body.png');
  assert.equal((await sharp(firsts[3]).metadata()).width, size);
  const { info } = await sharp(join(step, 'left.png')).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [size, size, 3]);
  await assert.rejects(access(join(step, 'right.png')));
  const record = JSON.parse(await readFile(join(step, 'views.json'), 'utf8'));
  assert.equal(record.left.frame.frameIndex, 20);
  await access(join(step, '.completed'));
  assert.match(await runWorkflow({ name: 'case', dir: root }, deps), /沿用/);
  assert.equal(prompts.length, 5);
  assert.equal(fitted, 1);
  const source = JSON.parse(await readFile(join(task, 'nine-axis/step02_angle-x/source.json'), 'utf8'));
  assert.equal(source.sourceDocument, 'character-assembly/step01/character-assembled.kra');
  assert.equal(source.sourceKraHash.length, 64);
  // The far ear's turn mirrors with the pair: turning right, the left ear goes behind like the right ear turning left.
  // Keyform keys are the degrees from knowledge angles.json (left view 30°).
  const { parts, parameters } = JSON.parse(await readFile(join(task, 'nine-axis/step02_angle-x/deformers.json'), 'utf8'));
  assert.deepEqual(parameters.find((q: { id: string }) => q.id === 'ParamAngleX').keys, [-30, 0, 30]);
  // face-left.json is top to bottom; deformers.json is drawing order, bottom first.
  assert.deepEqual(parts.map((p: { id: string }) => p.id), ['face/ear_left', 'face/ear_right', 'face/eye_left', 'face/face_base']);
  const byId = Object.fromEntries(parts.map((p: { id: string }) => [p.id, p]));
  assert.deepEqual(Object.keys(byId['face/face_base'].keyforms).sort(), ['-30', '0', '30']);
  assert.deepEqual(byId['face/ear_left'].keyforms['30'][0], [126, 70]);
  assert.ok(parts.every((p: object) => !('opacity' in p)));
  const y = join(task, 'nine-axis/step03_video-y'), viewY = JSON.parse(await readFile(join(y, 'views.json'), 'utf8'));
  for (const view of ['up', 'down']) {
    const { info: yInfo } = await sharp(join(y, `${view}.png`)).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([yInfo.width, yInfo.height, viewY[view].angle, viewY[view].frame.frameIndex], [size, size, 25, 17]);
  }
  assert.equal(viewY.input.path, 'nine-axis/step01_video/upper-body.png');
  const upDoc = JSON.parse(await readFile(join(task, 'nine-axis/step04_angle-up/deformers.json'), 'utf8'));
  assert.deepEqual(upDoc.parameters.find((q: { id: string }) => q.id === 'ParamAngleY').keys, [0, 25]);
  const angleY = JSON.parse(await readFile(join(task, 'nine-axis/step05_angle-down/deformers.json'), 'utf8'));
  assert.deepEqual(angleY.parameters.find((q: { id: string }) => q.id === 'ParamAngleY').keys, [-25, 0, 25]);
  // With rest-shaped Y keys the linear corners are the X keys, and the right corners mirror to the +30 keys.
  const xy = JSON.parse(await readFile(join(task, 'nine-axis/step06_angle-xy/deformers.json'), 'utf8'));
  assert.doesNotMatch(xy.notes, /未制作/);
  for (const p of xy.parts as { id: string; keyforms: Record<string, number[][]>; keyformsXY: Record<string, number[][]> }[]) {
    assert.deepEqual(Object.keys(p.keyformsXY).sort(), ['-30,-25', '-30,25', '30,-25', '30,25']);
    for (const [corner, key] of [['-30,25', '-30'], ['30,25', '30'], ['30,-25', '30']])
      p.keyformsXY[corner].forEach((q, i) => q.forEach((v, k) => assert.ok(Math.abs(v - p.keyforms[key][i][k]) < 0.02, `${p.id} ${corner}`)));
  }
  // The jaw step draws the kept parts first, then the mask and the clipped line on top, with the right side mirrored.
  const jaw = JSON.parse(await readFile(join(task, 'nine-axis/step07_jaw-line/deformers.json'), 'utf8'));
  assert.deepEqual(jaw.parts.map((p: { id: string }) => p.id).slice(-2), ['face/jaw_mask', 'face/jaw_line']);
  assert.deepEqual(jaw.levels.map((l: { name: string }) => l.name), ['脖子＋脸＋五官']);
  const line = jaw.parts.at(-1), faceBase = xy.parts.find((p: { id: string }) => p.id === 'face/face_base');
  assert.deepEqual([line.clip, Object.keys(line.keyforms).sort(), Object.keys(line.keyformsXY).sort()], [{ by: ['face/jaw_mask'], invert: true }, ['-30', '0', '30'], ['-30,-25', '-30,25', '30,-25', '30,25']]);
  line.keyforms['30'].forEach((q: number[], i: number) => q.forEach((v, k) => assert.ok(Math.abs(v - faceBase.keyforms['30'][i][k]) < 0.02)));
  await access(join(task, 'nine-axis/step07_jaw-line', faceBase.texture));
});

test('单跑 step03 只生成上下视频并取帧，原裁框和 left 完全保留', async t => {
  const { root, task } = await fixture(t), nine = join(task, 'nine-axis'), front = join(nine, 'step01_video');
  const sample = join(root, 'sample.mp4'), ffmpeg = await testVideo(t, sample);
  if (!ffmpeg) return;
  await mkdir(front, { recursive: true });
  const image = await sharp({ create: { width: 96, height: 96, channels: 3, background: '#888' } }).png().toBuffer();
  const protectedFiles = { 'upper-body.png': image, 'crop.json': Buffer.from('{"box":{"x":17,"y":23,"size":96}}'), 'left.png': image };
  for (const [file, bytes] of Object.entries(protectedFiles)) await writeFile(join(front, file), bytes);
  const unexpected = async () => { throw Error('不应调用脸部或四角'); };
  let generated = 0;
  await runWorkflow({ name: 'case', dir: root, step: 'step03_video-y' }, {
    environment: loadWorkflowEnvironment({}), ffmpeg,
    generate: async (_prompt, first) => { assert.deepEqual(first, image); generated++; return { id: `pitch-${generated}`, status: { status: 'completed' }, bytes: await readFile(sample) }; },
    fitHead: unexpected, fitUp: unexpected, fitDown: unexpected, fitAngleXY: unexpected, fitJawLine: unexpected,
  });
  assert.equal(generated, 2);
  for (const [file, bytes] of Object.entries(protectedFiles)) assert.deepEqual(await readFile(join(front, file)), bytes);
  const pitch = join(nine, 'step03_video-y');
  for (const file of ['up.mp4', 'down.mp4', 'up.png', 'down.png', 'videos.json', 'views.json', '.completed']) await access(join(pitch, file));
  for (const step of ['step02_angle-x', 'step04_angle-up', 'step05_angle-down', 'step06_angle-xy', 'step07_jaw-line']) await assert.rejects(access(join(nine, step)));
});

test('视频失败时 step01 不完成', async t => {
  const { root, task } = await fixture(t);
  const generate = async () => { throw new Error('模型拒绝'); };
  await assert.rejects(runWorkflow({ name: 'case', dir: root }, { environment: loadWorkflowEnvironment({}), generate, ffmpeg: '/bin/false' }), /模型拒绝/);
  await assert.rejects(access(join(task, 'nine-axis/step01_video/.completed')));
});

test('没有生视频接口时 step01 报错', async t => {
  const { root } = await fixture(t);
  await assert.rejects(runWorkflow({ name: 'case', dir: root }, { environment: loadWorkflowEnvironment({}) }), /生视频接口/);
});
