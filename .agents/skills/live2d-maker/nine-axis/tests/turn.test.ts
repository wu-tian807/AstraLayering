import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { cropUpperBody, extractTurnFrame, ffmpegPath, generateVideo, produceCornerVideos, producePitchVideos, resolveTurnInput, takeFrame, upperBodyBox, type Box } from '../turn.ts';
import { angleXYPrompt, angleYPrompt, viewFramesPrompt, cornerFramesPrompt, cornerOutlinePrompt, createFitHead, headPrompt, jawLinePrompt, outlinePrompt, runWorkflow, videoPrompt } from '../run.ts';
import { writeFaceLeft } from './head.test.ts';
import { buildHead, writeBuilt, type FaceLeft, type HeadInput } from '../head.ts';
import { axisGroups, type AxisGroup } from '../axis-groups.ts';
import { evaluatePoints, type HeadNineAxis } from '../../shared/nine-axis-model.js';
import { readStep } from '../../shared/step-chain.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { readUpstream, startContinuation } from '../continuation.ts';
import { MissingDependencyError } from '../../shared/missing-dependency.ts';

// Most tests inject production handlers; startup still receives an explicit
// executable and checker so missing-dependency failures cannot hide their assertions.
const runWithFFmpeg: typeof runWorkflow = (options, dependencies = {}) => runWorkflow({ ...options, ffmpeg: process.execPath }, {
  ...dependencies, ffmpegCheck: async executable => ({ executable, version: 'ffmpeg version fixture' }),
});

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

// The dummy KRA above is never sent to Krita. Build an identity version of
// the same four original layers used by writeFaceLeft, with the merge contract.
async function prepareNeutralFixture(directory: string, input: HeadInput, box: Box, taskRoot: string) {
  await writeFaceLeft(directory);
  const face: FaceLeft = JSON.parse(await readFile(join(directory, 'face-left.json'), 'utf8'));
  face.parts = face.parts.map((p, order) => ({ ...p, uuid: `original-${p.id}`, parentUuid: 'original-root',
    layerName: p.id, nodeType: 'paintlayer', order, stackPath: [order], visible: true, blendingMode: 'normal',
    keyforms: { '0': structuredClone(p.keyforms['0']), '-30': structuredClone(p.keyforms['0']) } }));
  await writeFile(join(directory, 'face-left.json'), JSON.stringify(face));
  const built = await buildHead(directory, input, box, undefined, taskRoot);
  await writeBuilt(directory, built);
  await writeFile(join(directory, 'export-record.json'), JSON.stringify({ version: 1, sourceKra: built.doc.source!.document,
    canvas: built.doc.canvas, order: 'bottom-to-top', parts: built.doc.parts }));
  await writeFile(join(directory, 'source.json'), JSON.stringify({ version: 1, ...built.source }));
}

// Overlay only the fitted left pose on the seeded author. Keep original rest,
// metadata, drawing sequence and texture identities from neutral.
async function writeSeededFaceLeft(directory: string) {
  const seeded: FaceLeft = JSON.parse(await readFile(join(directory, 'face-left.json'), 'utf8'));
  await writeFaceLeft(directory);
  const fitted: FaceLeft = JSON.parse(await readFile(join(directory, 'face-left.json'), 'utf8'));
  const byId = new Map(fitted.parts.map(p => [p.id, p]));
  seeded.parts = seeded.parts.map(p => ({ ...p, keyforms: { ...p.keyforms, '-30': structuredClone(byId.get(p.id)!.keyforms['-30']) } }));
  await writeFile(join(directory, 'face-left.json'), JSON.stringify(seeded));
}

async function writePitch(directory: string, group: 'up' | 'down') {
  const path = join(directory, `face-${group}.json`), doc: HeadNineAxis = JSON.parse(await readFile(path, 'utf8'));
  for (const p of doc.parts) p.keyformsY![group === 'up' ? '25' : '-25'] = p.keyforms['0'].map(([x, y]) => [x, y + (group === 'up' ? -3 : 5)]);
  await writeFile(path, JSON.stringify(doc));
}

function assertPoseEqual(actual: HeadNineAxis, expected: HeadNineAxis, x: number, y: number) {
  for (const p of expected.parts) {
    const q = actual.parts.find(n => n.id === p.id)!;
    assert.ok(q, `missing original layer ${p.id}`);
    const a = evaluatePoints(actual, q, x, y, 3), b = evaluatePoints(expected, p, x, y, 3);
    assert.equal(a.length, b.length);
    assert.ok(a.every((v, i) => Math.abs(v - b[i]) < .02), `${p.id} evaluated pose ${x},${y}`);
  }
}

test('单跑 left 沿用共享素材和参考帧，不调用视频或兄弟方向', async t => {
  const { root, task } = await fixture(t), nine = join(task, 'nine-axis'), preparation = join(nine, 'step01_preparation');
  const unexpected = async () => { throw new Error('不应调用其他步骤'); };
  await runWithFFmpeg({ name: 'case', dir: root, step: 'step01_preparation' }, { environment: loadWorkflowEnvironment({}), prepareNeutral: prepareNeutralFixture });
  const before = await readFile(join(preparation, 'deformers.json'));
  const frames = join(nine, 'step03_frames'); await mkdir(frames);
  await copyFile(join(task, 'character-assembly/step01/character-assembled.png'), join(frames, 'left.png'));
  const summary = await runWithFFmpeg({ name: 'case', dir: root, step: 'step04_angles/model/left' }, {
    environment: loadWorkflowEnvironment({}), generate: unexpected, prepareNeutral: unexpected, fitHead: writeSeededFaceLeft,
    fitUp: unexpected, fitDown: unexpected, fitAngleXY: unexpected, fitJawLine: unexpected,
  });
  assert.match(summary, /model\/left 已完成/);
  const model = join(nine, 'step04_angles/model');
  assert.equal((await readStep(model)).status, 'running');
  assert.equal((await readStep(join(model, 'left'))).status, 'completed');
  for (const name of ['up', 'down', 'merged', 'deformers.json']) await assert.rejects(access(join(model, name)), { code: 'ENOENT' });
  await assert.rejects(access(join(nine, 'step04_angles/video')), { code: 'ENOENT' });
  assert.deepEqual(await readFile(join(preparation, 'deformers.json')), before);
  const neutral = await readUpstream(preparation), fitted = await readUpstream(join(model, 'left'));
  assertPoseEqual(fitted.doc, neutral.doc, 0, 0);
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
  assert.match(videoPrompt('up'), /抬头/);
  assert.match(videoPrompt('down'), /低头/);
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

// Stands in for the frame-selection agent: one frame per view at its target angle of a uniform turn.
const pickViews = (ffmpeg: string) => async (directory: string) => {
  const videos = join(directory, '../step02_video');
  const size = (await sharp(join(videos, 'upper-body.png')).metadata()).width!, frames: Record<string, unknown> = {};
  for (const [view, angle] of [['left', 30], ['up', 25], ['down', 25]] as const) {
    const chosen = await takeFrame(directory, `${view}.png`, join(videos, `${view}.mp4`), angle, size, { ffmpeg });
    frames[view] = { video: `../step02_video/${view}.mp4`, path: chosen.path, frameIndex: chosen.frame.frameIndex, reason: 'Fixture agent; no visual acceptance claimed' };
  }
  await writeFile(join(directory, 'selected-frames.json'), JSON.stringify({ version: 1, frames }));
};

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
  assert.match(x, /X\s*=\s*-30\s*[、,，]\s*Y\s*=\s*0/);
  assert.match(up, /X\s*=\s*0\s*[、,，]\s*Y\s*=\s*25/);
  assert.match(down, /X\s*=\s*0\s*[、,，]\s*Y\s*=\s*-25/);
  assert.match(xy, /\(X,Y\)=\(-30,25\)[\s\S]*\(-30,-25\)/);
  assert.match(xy, /"-30,25"[\s\S]*"-30,-25"/);
  assert.match(jaw, /"-30,25"/);
  assert.match(jaw, /"invert": true/);
  for (const [prompt, group] of [[x, 'left'], [up, 'up'], [down, 'down']] as const) {
    assert.ok(prompt.includes(`/task/nine-axis/step04_angles/model/${group}/face-${group}.json`));
    assert.ok(prompt.includes('/task/nine-axis/step01_preparation'));
    assert.ok(prompt.includes(`/task/nine-axis/step03_frames/${group}.png`));
    assert.ok(prompt.includes(`【${group} 先验】`) && prompt.includes(`/task/nine-axis/step04_angles/model/${group}/outline`));
    const outline = outlinePrompt(head, '/task', group);
    assert.ok(outline.includes(`/task/nine-axis/step03_frames/${group}.png`) && outline.includes(`/task/nine-axis/step04_angles/model/${group}/outline`));
  }
  assert.ok(xy.includes('/task/nine-axis/step04_angles/model/deformers.json'));
  assert.ok(xy.includes('/task/nine-axis/step06_angle-xy/linear.json'));
  assert.ok(xy.includes('【斜向先验】') && xy.includes('/task/nine-axis/step06_angle-xy/outline'));
  const viewFrames = viewFramesPrompt('/task');
  assert.ok(viewFrames.includes('path（指向规范化后的 <view>.png'));
  for (const view of ['left', 'up', 'down']) assert.ok(viewFrames.includes(`/task/nine-axis/step02_video/${view}.mp4`));
  const frames = cornerFramesPrompt('/task');
  assert.ok(frames.includes('path（指向规范化后的 <corner>.png'));
  for (const corner of ['left-up', 'left-down']) assert.ok(frames.includes(`/task/nine-axis/step04_angles/video/${corner}.mp4`));
  const cornerOutlines = (['left-up', 'left-down'] as const).map(corner => cornerOutlinePrompt(head, '/task', corner));
  for (const [i, corner] of (['left-up', 'left-down'] as const).entries())
    assert.ok(cornerOutlines[i].includes(`【${corner}：`) && cornerOutlines[i].includes(`/task/nine-axis/step05_frames/${corner}.png`) && cornerOutlines[i].includes(`/task/nine-axis/step06_angle-xy/outline/${corner}`));
  for (const prompt of [x, up, down, xy, jaw, viewFrames, frames, ...cornerOutlines]) assert.doesNotMatch(prompt, /\{(?:[\w-]+:)?[\w./\u4e00-\u9fff-]+\}/);
});

test('连续七步：平层视频、三路真实并发、联合工程、斜角与下颌；完成后沿用', { timeout: 30_000 }, async t => {
  const { root, task } = await fixture(t);
  const sample = join(root, 'sample.mp4'), ffmpeg = await testVideo(t, sample);
  if (!ffmpeg) return;
  const nine = join(task, 'nine-axis'), videos = join(nine, 'step02_video'), axes = join(nine, 'step04_angles/model'), preparation = join(nine, 'step01_preparation'), viewFrames = join(nine, 'step03_frames'), cornerFrames = join(nine, 'step05_frames'), cornerVideos = join(nine, 'step04_angles/video');
  const modelStarted = Promise.withResolvers<void>(), cornerStarted = Promise.withResolvers<void>();
  const prompts: string[] = [], firsts: Buffer[] = [];
  const generate = async (prompt: string, image: Buffer) => {
    prompts.push(prompt); firsts.push(image);
    if (prompts.length > 3) {
      cornerStarted.resolve();
      await modelStarted.promise;
      assert.equal((await readStep(axes)).status, 'running');
      assert.equal((await readStep(cornerVideos)).status, 'running');
    }
    return { id: `v${prompts.length}`, status: { status: 'completed' }, bytes: await readFile(sample) };
  };
  const entered = new Set<AxisGroup>(), barrier = Promise.withResolvers<void>();
  const fitted: AxisGroup[] = [];
  let neutralPreparations = 0;
  const prepareNeutral = async (...args: Parameters<typeof prepareNeutralFixture>) => {
    neutralPreparations++;
    await prepareNeutralFixture(...args);
  };
  const fit = (group: AxisGroup) => async (directory: string) => {
    assert.equal(directory, join(axes, group));
    assert.equal((await readStep(preparation)).status, 'completed');
    const neutral = await readUpstream(preparation);
    const seeded: HeadNineAxis = JSON.parse(await readFile(join(directory, `face-${group}.json`), 'utf8'));
    assert.deepEqual(seeded.parts.map(p => p.id), group === 'left' ? neutral.doc.parts.map(p => p.id).toReversed() : neutral.doc.parts.map(p => p.id));
    for (const p of seeded.parts) {
      const original = neutral.doc.parts.find(n => n.id === p.id)!;
      assert.deepEqual(p.keyforms['0'], original.keyforms['0']);
      assert.deepEqual(await readFile(join(directory, p.texture)), await readFile(join(preparation, original.texture)));
    }
    if (group !== 'left') {
      assert.deepEqual(seeded.source, neutral.doc.source);
      assert.equal((seeded as unknown as { authoring: { upstreamSha256: string } }).authoring.upstreamSha256, neutral.hash);
      assert.equal(seeded.axisSources, undefined);
    }
    entered.add(group);
    if (entered.size === 3) { barrier.resolve(); modelStarted.resolve(); }
    // No fit can finish until all three actual injected calls have entered.
    await barrier.promise;
    await cornerStarted.promise;
    assert.equal(entered.size, 3);
    assert.equal((await readStep(axes)).status, 'running');
    await assert.rejects(access(join(axes, 'merged')), { code: 'ENOENT' });
    fitted.push(group);
    if (group === 'left') await writeSeededFaceLeft(directory); else await writePitch(directory, group);
  };
  const fitAngleXY = async (directory: string) => {
    assert.equal((await readStep(axes)).status, 'completed');
    for (const group of axisGroups) assert.equal((await readStep(join(axes, group))).status, 'completed');
    assert.deepEqual(await readFile(join(axes, 'deformers.json')), await readFile(join(axes, 'merged/deformers.json')));
    const parent = await readUpstream(axes);
    await createContinuationEditTool(directory, axes, 'xy', undefined, task).execute({}, new AbortController().signal);
    const authored = JSON.parse(await readFile(join(directory, 'face-xy.json'), 'utf8'));
    const linear = JSON.parse(await readFile(join(directory, 'linear.json'), 'utf8'));
    assert.equal(authored.authoring.upstreamSha256, parent.hash);
    assert.equal(linear.authoring.upstreamSha256, parent.hash);
    assert.deepEqual(authored.axisSources, parent.doc.axisSources);
    for (const c of ['left-up','left-down']) {
      await writeFile(join(directory, `${c}-face-trace.json`), '{"fixture":"selected trace"}');
      await writeFile(join(directory, `${c}-fit-report.json`), JSON.stringify({ corner:c }));
    }
  };
  const pickCorners = async (directory: string) => {
    const size = (await sharp(join(viewFrames, 'up.png')).metadata()).width!, frames: Record<string, unknown> = {};
    for (const [corner, angle] of [['left-up', 15], ['left-down', 45]] as const) {
      const chosen = await takeFrame(directory, `${corner}.png`, join(cornerVideos, `${corner}.mp4`), angle, size, { ffmpeg });

      frames[corner] = { video: `../step04_angles/video/${corner}.mp4`, path: chosen.path, frameIndex: chosen.frame.frameIndex,
        reason: 'Different frame choices by the injected test agent; no visual acceptance claimed' };

    }
    await writeFile(join(directory, 'selected-frames.json'), JSON.stringify({ version: 1, frames }));
  };
  const fitJawLine = async (directory: string) => {
    const upstream = await readUpstream(join(nine, 'step06_angle-xy'));
    const doc = startContinuation(upstream.doc, upstream.hash, 'jaw');
    const base = doc.parts.find(p => p.id === 'face/face_base')!;
    await mkdir(join(directory, 'layers'), { recursive: true });
    for (const name of ['jaw_line', 'jaw_mask']) await copyFile(join(nine, 'step06_angle-xy', base.texture), join(directory, `layers/${name}.png`));
    const fresh = (id: string, extra: object) => ({ ...structuredClone(base), id, group: 'jaw', texture: `layers/${id.split('/')[1]}.png`, ...extra });
    doc.parts.push(fresh('face/jaw_mask', { role: 'mask' }), fresh('face/jaw_line', { clip: { by: ['face/jaw_mask'], invert: true } }));
    await writeFile(join(directory, 'jaw.json'), JSON.stringify(doc));
  };
  const deps = { environment: loadWorkflowEnvironment({}), generate, viewFramesHead: pickViews(ffmpeg), framesHead: pickCorners, prepareNeutral,
    fitHead: fit('left'), fitUp: fit('up'), fitDown: fit('down'), fitAngleXY, fitJawLine };
  assert.match(await runWithFFmpeg({ name: 'case', dir: root }, deps), /step07_jaw-line 已完成：6 个部件的下颌线与脖子/);
  assert.deepEqual([...entered].sort(), ['down', 'left', 'up']);
  assert.deepEqual(fitted.sort(), ['down', 'left', 'up']);
  assert.equal(neutralPreparations, 1);
  const size = (await sharp(join(videos, 'upper-body.png')).metadata()).width;
  const record01 = JSON.parse(await readFile(join(videos, 'videos.json'), 'utf8'));
  const views = JSON.parse(await readFile(join(viewFrames, 'views.json'), 'utf8'));
  for (const [view, angle, frame] of [['left', 30, 20], ['up', 25, 17], ['down', 25, 17]] as const) {
    await access(join(videos, `${view}.mp4`));
    for (const name of [`${view}.png`, `frames/${view}.png`]) await access(join(viewFrames, name));
    assert.equal(record01[view].first, 'upper-body.png');
    const { info } = await sharp(join(viewFrames, `${view}.png`)).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels, views[view].angle, views[view].frame.frameIndex], [size, size, 3, angle, frame]);
    assert.equal(views[view].video.path, `nine-axis/step02_video/${view}.mp4`);
  }
  assert.equal(views.input.path, 'nine-axis/step02_video/upper-body.png');
  assert.deepEqual(firsts[1], firsts[0]); assert.deepEqual(firsts[2], firsts[0]);
  const corners = join(nine, 'step06_angle-xy');
  const recordCorners = JSON.parse(await readFile(join(cornerVideos, 'videos.json'), 'utf8'));
  const selected = JSON.parse(await readFile(join(cornerFrames, 'selected-frames.json'), 'utf8'));
  assert.deepEqual(['left-up', 'left-down'].map(c => selected.frames[c].frameIndex), [10, 30]);
  assert.deepEqual([recordCorners['left-up'].first, recordCorners['left-down'].first], ['../../step03_frames/up.png', '../../step03_frames/down.png']);
  assert.deepEqual(firsts[3], await readFile(join(viewFrames, 'up.png')));
  assert.deepEqual(firsts[4], await readFile(join(viewFrames, 'down.png')));
  for (const name of ['left-up', 'left-down', 'right']) await assert.rejects(access(join(videos, `${name}.png`)), { code: 'ENOENT' });
  for (const step of ['step02_angle-x', 'step03_video-y', 'step04_angle-up', 'step05_angle-down', 'step01_video', 'step02_angles', 'step03_angle-xy', 'step04_jaw-line']) await assert.rejects(access(join(nine, step)), { code: 'ENOENT' });
  for (const step of ['step01_preparation','step02_video','step03_frames','step04_angles','step05_frames','step06_angle-xy','step07_jaw-line']) assert.equal((await readStep(join(nine, step))).status, 'completed');
  const source = JSON.parse(await readFile(join(axes, 'source.json'), 'utf8'));
  assert.equal(source.sourceDocument, 'nine-axis/step01_preparation/character-nine-axis.kra');
  assert.deepEqual(await readFile(join(task, source.sourceDocument)), await readFile(join(task, 'character-assembly/step01/character-assembled.kra')));
  assert.deepEqual(await readFile(join(nine, 'step07_jaw-line/character-nine-axis.kra')), await readFile(join(task, source.sourceDocument)));
  const neutral = await readUpstream(preparation), merged = await readUpstream(axes);
  const independent = Object.fromEntries(await Promise.all(axisGroups.map(async group => [group, (await readUpstream(join(axes, group))).doc]))) as Record<AxisGroup, HeadNineAxis>;
  assert.deepEqual(merged.doc.parts.map(p => p.id), neutral.doc.parts.map(p => p.id));
  assert.deepEqual(merged.doc.parts.map(p => p.id), ['face/ear_left', 'face/ear_right', 'face/eye_left', 'face/face_base']);
  assert.deepEqual(merged.doc.axisSources!.map(s => s.axis), ['x', 'up', 'down']);
  assert.deepEqual(merged.doc.parameters!.map(p => p.keys), [[-30, 0, 30], [-25, 0, 25]]);
  assert.deepEqual(independent.up.parameters!.find(p => p.id === 'ParamAngleY')!.keys, [0, 25]);
  assert.deepEqual(independent.down.parameters!.find(p => p.id === 'ParamAngleY')!.keys, [-25, 0]);
  const base = (doc: HeadNineAxis) => doc.parts.find(p => p.id === 'face/face_base')!;
  for (const [doc, x, y] of [[independent.left, -30, 0], [independent.up, 0, 25], [independent.down, 0, -25]] as const)
    assert.notDeepEqual(evaluatePoints(doc, base(doc), x, y), evaluatePoints(neutral.doc, base(neutral.doc), 0, 0));
  for (const doc of [independent.up, independent.down]) for (const x of [-30, -15, 0, 15, 30]) assertPoseEqual(doc, neutral.doc, x, 0);
  assertPoseEqual(independent.up, neutral.doc, 0, -25);
  assertPoseEqual(independent.down, neutral.doc, 0, 25);
  const xy = (await readUpstream(corners)).doc, jaw = (await readUpstream(join(nine, 'step07_jaw-line'))).doc;
  for (const [group, poses] of [['left', [-30, -15, 0, 15, 30]], ['up', [0, 12.5, 25]], ['down', [-25, -12.5, 0]]] as const) {
    for (const angle of poses) {
      const [x, y] = group === 'left' ? [angle, 0] : [0, angle];
      assertPoseEqual(merged.doc, independent[group], x, y);
      assertPoseEqual(xy, merged.doc, x, y);
      assertPoseEqual(jaw, xy, x, y);
    }
  }
  assert.deepEqual(xy.axisSources, merged.doc.axisSources);
  for (const [x, y] of [[-30, 25], [-30, -25], [30, 25], [30, -25]]) {
    assertPoseEqual(jaw, xy, x, y);
    for (const p of xy.parts) {
      const actual = evaluatePoints(xy, p, x, y, 3), rest = evaluatePoints(neutral.doc, neutral.doc.parts.find(n => n.id === p.id)!, 0, 0, 3);
      const a = evaluatePoints(merged.doc, merged.doc.parts.find(n => n.id === p.id)!, x, 0, 3);
      const b = evaluatePoints(merged.doc, merged.doc.parts.find(n => n.id === p.id)!, 0, y, 3);
      assert.ok(actual.every((v, i) => Math.abs(v - (a[i] + b[i] - rest[i])) < .02), `${p.id} actual combined corner ${x},${y}`);
    }
  }
  assert.deepEqual(jaw.parts.map(p => p.id).slice(-2), ['face/jaw_mask', 'face/jaw_line']);
  assert.deepEqual(jaw.levels.map(l => l.name), ['脖子＋脸＋五官']);
  assert.deepEqual(jaw.parts.at(-1)!.clip, { by: ['face/jaw_mask'], invert: true });
  for (const p of neutral.doc.parts) for (const output of [axes, corners, join(nine, 'step07_jaw-line')])
    assert.deepEqual(await readFile(join(output, p.texture)), await readFile(join(preparation, p.texture)));
  assert.match(await runWithFFmpeg({ name: 'case', dir: root }, deps), /沿用/);
  assert.equal(prompts.length, 5);
  assert.equal(fitted.length, 3);
  assert.equal(neutralPreparations, 1);
});

test('单跑视频步骤只交付三路视频，选帧由后续步骤完成', async t => {
  const { root, task } = await fixture(t), videos = join(task, 'nine-axis/step02_video');
  const sample = join(root, 'sample.mp4'), ffmpeg = await testVideo(t, sample); if (!ffmpeg) return;
  const unexpected = async () => { throw Error('视频步骤不调用素材、选帧或模型 agent'); };
  let generated = 0;
  await runWithFFmpeg({ name: 'case', dir: root, step: 'step02_video' }, {
    environment: loadWorkflowEnvironment({}), viewFramesHead: unexpected, prepareNeutral: unexpected, fitHead: unexpected,
    generate: async () => ({ id: `v${++generated}`, status: { status: 'completed' }, bytes: await readFile(sample) }),
  });
  assert.equal(generated,3);
  for (const view of ['left','up','down']) { await access(join(videos, `${view}.mp4`)); await assert.rejects(access(join(videos, `${view}.png`)), {code:'ENOENT'}); }
  await access(join(videos,'.completed'));
  await assert.rejects(access(join(task,'nine-axis/step03_frames')), {code:'ENOENT'});
});

test('俯仰续跑按模型和提示词复用已有视频，单改 up 不重生 down', async t => {
  const { root, task } = await fixture(t), nine = join(task, 'nine-axis'), front = join(nine, 'step02_video'), pitch = join(nine, 'pitch');
  const sample = join(root, 'sample.mp4'), ffmpeg = await testVideo(t, sample);
  if (!ffmpeg) return;
  await mkdir(front, { recursive: true });
  await writeFile(join(front, 'upper-body.png'), await sharp({ create: { width: 96, height: 96, channels: 3, background: '#888' } }).png().toBuffer());
  let generated = 0;
  const generate = async () => ({ id: `v${++generated}`, status: { status: 'completed' }, bytes: await readFile(sample) });
  const options = { model: 'fixture' };
  await producePitchVideos(pitch, front, generate, { up: 'up-a', down: 'down-a' }, options);
  const before = JSON.parse(await readFile(join(pitch, 'videos.json'), 'utf8')), down = await readFile(join(pitch, 'down.mp4'));
  await producePitchVideos(pitch, front, generate, { up: 'up-b', down: 'down-a' }, options);
  assert.equal(generated, 3);
  const after = JSON.parse(await readFile(join(pitch, 'videos.json'), 'utf8'));
  assert.equal(after.down.videoId, before.down.videoId);
  assert.notEqual(after.up.videoId, before.up.videoId);
  assert.deepEqual(await readFile(join(pitch, 'down.mp4')), down);
});

test('斜向续跑按模型和提示词复用已有视频', async t => {
  const root = await mkdtemp(join(tmpdir(), 'astra-corner-reuse-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pitch = join(root, 'pitch'), corner = join(root, 'corners');
  await mkdir(pitch, { recursive: true }); await mkdir(corner, { recursive: true });
  await writeFile(join(pitch, 'up.png'), 'up-first'); await writeFile(join(pitch, 'down.png'), 'down-first');
  let generated = 0;
  const generate = async () => ({ id: `corner-${++generated}`, status: { status: 'completed' }, bytes: Buffer.from(`video-${generated}`) });
  await produceCornerVideos(corner, pitch, generate, 'left-a', { model: 'fixture' });
  const initial = JSON.parse(await readFile(join(corner, 'videos.json'), 'utf8'));
  const down = await readFile(join(corner, 'left-down.mp4'));
  await produceCornerVideos(corner, pitch, generate, 'left-a', { model: 'fixture' });
  assert.equal(generated, 2);
  const reused = JSON.parse(await readFile(join(corner, 'videos.json'), 'utf8'));
  assert.equal(reused['left-down'].videoId, initial['left-down'].videoId);
  assert.deepEqual(await readFile(join(corner, 'left-down.mp4')), down);
  await produceCornerVideos(corner, pitch, generate, 'left-b', { model: 'fixture' });
  assert.equal(generated, 4, '提示词变化时不能复用');
  await produceCornerVideos(corner, pitch, generate, 'left-b', { model: 'changed-model' });
  assert.equal(generated, 6, '模型变化时不能复用');
});

test('九轴停止信号传入真实绘制 agent，已取消时不再启动', async t => {
  const { task } = await fixture(t), controller = new AbortController();
  let started = 0;
  const fit = createFitHead({ async run(_task, signal) {
    started++; assert.equal(signal, controller.signal);
    controller.abort(new Error('cancel face fitting')); signal!.throwIfAborted();
    return { text: '{"error":null}', images: [] };
  } }, async () => [], 'step06_angle-xy', '斜向', controller.signal);
  await assert.rejects(fit(join(task, 'nine-axis/step06_angle-xy'), 'test'), /cancel face fitting/);
  assert.equal(started, 1);
  await assert.rejects(fit(join(task, 'nine-axis/step06_angle-xy'), 'test'), /cancel face fitting/);
  assert.equal(started, 1);
});

test('视频失败时 step02 不完成', async t => {
  const { root, task } = await fixture(t);
  const generate = async () => { throw new Error('模型拒绝'); };
  await assert.rejects(runWithFFmpeg({ name: 'case', dir: root, step: 'step02_video' }, { environment: loadWorkflowEnvironment({}), generate }), /模型拒绝/);
  await assert.rejects(access(join(task, 'nine-axis/step02_video/.completed')));
});

test('没有生视频接口时 step02 报错', async t => {
  const { root } = await fixture(t);
  await assert.rejects(runWithFFmpeg({ name: 'case', dir: root, step: 'step02_video' }, { environment: loadWorkflowEnvironment({}) }), /生视频接口/);
});

test('independent nine-axis startup does not recover software configuration from run.json', async t => {
  const { root, task } = await fixture(t);
  await writeFile(join(task, 'run.json'), JSON.stringify({ ffmpeg: process.execPath }));
  await assert.rejects(runWorkflow({ name: 'case', dir: root, step: 'step02_video' }, {
    environment: loadWorkflowEnvironment({}), generate: async () => { assert.fail('video must not start'); },
  }), /没有配置 FFmpeg 路径/);
  await assert.rejects(access(join(task, 'nine-axis', 'step02_video')), { code: 'ENOENT' });
});
