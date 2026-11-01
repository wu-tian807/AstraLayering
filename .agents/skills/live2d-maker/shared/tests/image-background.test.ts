import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { imageGenerationTool } from '../agents/images.ts';
import { createCodexImageRoute } from '../agents/codex-images.ts';
import { transparentGeneratedImage, providerImageArguments } from '../agents/image-background.ts';
import { recommendBackground } from '../agents/background-selection.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'image-background-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, 'codex.mjs');
  await writeFile(executable, `#!${process.execPath}\nconsole.log(JSON.stringify({version:1,image_provider:true,image_provider_version:2,failed_error_event_version:1}));\n`, { mode: 0o700 });
  return { root, executable };
}

async function solidImage(color: number[]) {
  const width = 48, height = 64, data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const hole = x >= 22 && x <= 26 && y >= 30 && y <= 34;
    const alpha = x >= 12 && x <= 36 && y >= 12 && y <= 52 && !hole ? 1
      : x === 11 && y >= 16 && y <= 48 ? 0.5 : 0;
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(alpha * 65 + (1 - alpha) * color[c]);
    data[i + 3] = 255;
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test('background adaptation keeps original tasks, GPT alpha requests and explicit auto/opaque requests', async () => {
  const original = { prompt: '绿色绣线、蓝宝石与红色缎带保持原色，正常开口完全透明。最终只输出透明 PNG。', background: 'transparent' as const, size: '1024x1536' };
  const nano = await providerImageArguments('gemini-nano-banana-2.1', original);
  assert.ok(nano.prompt.startsWith(original.prompt + '\n\n'));
  assert.match(nano.prompt, /背景使用高纯度纯色 #00FF00/);
  assert.ok(!nano.prompt.includes('{background_hex}'));
  assert.equal(nano.background, 'opaque'); assert.equal(nano.size, original.size);
  assert.equal(original.background, 'transparent');
  for (const model of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'codex-native'] as const) {
    assert.equal(await providerImageArguments(model, original), original);
  }
  for (const background of ['auto', 'opaque'] as const) {
    const request = { ...original, background };
    assert.equal(await providerImageArguments('gemini-nano-banana-2.1', request), request);
  }
});

test('both routes recover dual backgrounds over Gemini/OpenAI protocols without Krita, preserving first generated dimensions', async t => {
  const { root, executable } = await fixture(t);
  const reference = join(root, 'reference.png');
  const input = await sharp({ create: { width: 8, height: 10, channels: 4, background: '#ffaabb80' } }).png().toBuffer();
  await writeFile(reference, input);
  let protocol = 'gemini', first = await solidImage([11, 246, 12]), calls = 0;
  const second = await solidImage([255, 255, 255]);
  const server = createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      let prompt: string, inputs: Buffer[] = [];
      if (protocol === 'gemini') {
        assert.equal(req.url, '/v1beta/models/gemini-nano-banana-2.1:generateContent');
        const parts = JSON.parse(bytes.toString()).contents[0].parts;
        prompt = parts[0].text;
        inputs = parts.slice(1).map((part: any) => Buffer.from(part.inlineData.data, 'base64'));
      } else if (req.url?.endsWith('/edits')) {
        const form = await new Request('http://localhost', { method: 'POST', headers: { 'content-type': req.headers['content-type']! }, body: new Uint8Array(bytes) }).formData();
        prompt = String(form.get('prompt')).replaceAll('\r\n', '\n'); assert.equal(form.get('background'), 'opaque');
        for (const [key, value] of form) if (key.startsWith('image')) inputs.push(Buffer.from(await (value as File).arrayBuffer()));
      } else {
        const args = JSON.parse(bytes.toString()); prompt = args.prompt; assert.equal(args.background, 'opaque');
      }
      const replacement = calls % 2 === 1;
      if (replacement) {
        assert.deepEqual(inputs, [first]);
        assert.match(prompt, /只修改所附图片的背景/); assert.match(prompt, /#FFFFFF/); assert.match(prompt, /48×64/);
        assert.ok(!prompt.includes('保留主体和正常开口，输出透明 PNG。'));
      } else {
        for (const picture of inputs) assert.deepEqual(picture, input);
        assert.ok(prompt.startsWith('保留主体和正常开口，输出透明 PNG。\n\n'));
        assert.match(prompt, /背景使用高纯度纯色 #[0-9A-F]{6}/);
      }
      calls++;
      const png = replacement ? second : first;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(protocol === 'gemini'
        ? { candidates: [{ content: { parts: [{ inlineData: { data: png.toString('base64') } }] } }] }
        : { data: [{ b64_json: png.toString('base64') }] }));
    } catch (error) { res.writeHead(500).end(String(error)); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise<void>(done => server.close(() => done())); });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  for (protocol of ['gemini', 'openai']) for (const color of [[11, 246, 12], [4, 9, 254], [249, 5, 9]]) {
    first = await solidImage(color);
    for (const native of [false, true]) for (const edit of [false, true]) {
      const directory = join(root, `${protocol}-${color[0]}-${native}-${edit}`);
      const settings = loadWorkflowEnvironment({ layering_codex_path: executable, PATH: '',
        part_simplify_image_model: 'gemini-nano-banana-2.1', layering_google_image_base_url: base + '/v1beta',
        layering_google_image_api_key: 'fixture', layering_google_image_protocol: protocol }, root);
      const prompt = '保留主体和正常开口，输出透明 PNG。';
      let output: Buffer;
      if (native) {
        const route = await createCodexImageRoute(settings, 'part_simplify', directory);
        try {
          const form = new FormData(); form.set('model', 'gemini-nano-banana-2.1'); form.set('prompt', prompt);
          if (edit) form.append('image', new Blob([new Uint8Array(input)], { type: 'image/png' }), 'reference.png');
          const response = await fetch(route.env.LAYERING_IMAGE_BASE_URL + `/images/${edit ? 'edits' : 'generations'}`, { method: 'POST',
            headers: { authorization: `Bearer ${route.env.LAYERING_IMAGE_API_KEY}`, ...(edit ? {} : { 'content-type': 'application/json' }) },
            body: edit ? form : JSON.stringify({ model: 'gemini-nano-banana-2.1', prompt }) });
          assert.equal(response.status, 200, await response.clone().text());
          output = Buffer.from((await response.json()).data[0].b64_json, 'base64');
        } finally { await route.close(); }
      } else {
        const tool = imageGenerationTool(settings, 'part_simplify', directory)!;
        const result = await tool.execute({ prompt, input_images: edit ? [reference] : [] }, new AbortController().signal);
        output = await readFile(JSON.parse((result.contentItems[0] as { text: string }).text).savedPath);
      }
      const image = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([image.info.width, image.info.height], [48, 64]);
      assert.equal(image.data[(32 * 48 + 24) * 4 + 3], 0); // a genuine opening
      assert.deepEqual([...image.data.subarray((20 * 48 + 20) * 4, (20 * 48 + 20) * 4 + 4)], [65, 65, 65, 255]);
      const p = (20 * 48 + 11) * 4;
      assert.ok(Math.abs(image.data[p + 3] - 128) <= 1);
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(image.data[p + c] - 65) <= 2);
      const [id] = await readdir(join(directory, 'image-processing'));
      const records = join(directory, 'image-processing', id);
      assert.deepEqual(await readFile(join(records, 'original.png')), first);
      assert.deepEqual(await readFile(join(records, 'counterpart.png')), second);
      const report = JSON.parse(await readFile(join(records, 'normalization.json'), 'utf8'));
      assert.equal(report.originalPrompt, prompt); assert.equal(report.normalization.method, 'dual-background');
      assert.deepEqual(report.normalization.backgrounds, [color, [255, 255, 255]]);
      assert.equal(report.selection.reference, edit ? 'first-image' : 'none');
      assert.ok(!(await readdir(directory)).includes('.runtime'));
    }
  }
  assert.equal(calls, 48); assert.deepEqual(await readFile(reference), input);
});

test('program recommends green for pink, avoids small same-colour details and ignores control maps/transparent RGB', async () => {
  const rgba = Buffer.alloc(32 * 32 * 4);
  for (let p = 0; p < 1024; p++) {
    rgba[p * 4] = 0; rgba[p * 4 + 1] = 255;
    if (p % 32 >= 8 && p % 32 < 24 && Math.floor(p / 32) >= 8 && Math.floor(p / 32) < 24) {
      rgba.set([235, 150, 195, 128], p * 4);
    }
  }
  const input = async () => ({ bytes: await sharp(rgba, { raw: { width: 32, height: 32, channels: 4 } }).png().toBuffer(), mime: 'image/png' });
  const pink = await input();
  const selected = await recommendBackground([pink]); assert.equal(selected.hex, '#00FF00');
  assert.equal(selected.foregroundPixels, 256); assert.equal(selected.sourceBackground, null);
  const control = { bytes: await solidImage([0, 255, 0]), mime: 'image/png' };
  assert.deepEqual(await recommendBackground([pink, control]), selected);
  // One visible green stitch must still disqualify a green key.
  rgba.set([0, 255, 0, 255], (16 * 32 + 16) * 4);
  const withStitch = await recommendBackground([await input()]);
  assert.notEqual(withStitch.hex, '#00FF00');
  assert.equal(withStitch.candidates.find(c => c.hex === '#00FF00')!.collisionPixels, 1);
  // A white backdrop is neutral and must not hide bright opaque material colours.
  const pale = { bytes: await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } })
    .composite([{ input: Buffer.from('<svg width="32" height="32"><rect x="8" y="8" width="16" height="16" fill="#ebb4dc"/></svg>') }]).png().toBuffer(), mime: 'image/png' };
  assert.equal((await recommendBackground([pale])).hex, '#00FF00');
  const greenAndBlue = { bytes: await sharp({ create: { width: 32, height: 32, channels: 3, background: '#00ff00' } })
    .composite([{ input: Buffer.from('<svg width="32" height="32"><rect x="16" width="16" height="32" fill="#0000ff"/></svg>') }]).png().toBuffer(), mime: 'image/png' };
  assert.equal((await recommendBackground([greenAndBlue])).hex, '#FF0000');
});

test('Nano fails explicitly with retained raw generation when no reliable solid background is returned', async t => {
  const { root } = await fixture(t);
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#00ff00' } })
    .composite([{ input: Buffer.from('<svg width="32" height="32"><rect x="16" width="16" height="32" fill="#0000ff"/></svg>') }]).png().toBuffer();
  const server = createServer((_req, res) => res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] })));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise<void>(done => server.close(() => done())); });
  const settings = loadWorkflowEnvironment({ part_simplify_image_model: 'gemini-nano-banana-2.1', PATH: process.env.PATH,
    layering_google_image_base_url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    layering_google_image_api_key: 'fixture', layering_google_image_protocol: 'openai' }, root);
  const tool = imageGenerationTool(settings, 'part_simplify', root)!;
  await assert.rejects(tool.execute({ prompt: '主体透明 PNG', input_images: [] }, new AbortController().signal), /Nano 透明背景处理失败.*原始生图保留在/);
  const [id] = await readdir(join(root, 'image-processing'));
  assert.deepEqual(await sharp(join(root, 'image-processing', id, 'original.png')).raw().toBuffer(), await sharp(png).raw().toBuffer());
  assert.ok((await readFile(join(root, 'image-processing', id, 'error.json'), 'utf8')).includes('主体透明 PNG'));
});

test('second request failures preserve the first image and expose the provider error without extra requests', async t => {
  const { root } = await fixture(t); const first = await solidImage([11, 245, 5]); let calls = 0;
  const server = createServer((_req, res) => {
    calls++;
    if (calls === 1) res.end(JSON.stringify({ data: [{ b64_json: first.toString('base64') }] }));
    else res.writeHead(503).end('provider failed fixture-secret');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise<void>(done => server.close(() => done())); });
  const settings = loadWorkflowEnvironment({ part_simplify_image_model: 'gemini-nano-banana-2.1',
    layering_google_image_base_url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    layering_google_image_api_key: 'fixture-secret', layering_google_image_protocol: 'openai' }, root);
  await assert.rejects(imageGenerationTool(settings, 'part_simplify', root)!.execute(
    { prompt: '透明 PNG', input_images: [] }, new AbortController().signal), /HTTP 503.*provider failed \[redacted\].*原始生图保留在/);
  assert.equal(calls, 2);
  const [id] = await readdir(join(root, 'image-processing')); const directory = join(root, 'image-processing', id);
  assert.deepEqual(await readFile(join(directory, 'original.png')), first);
  assert.ok(!(await readdir(directory)).includes('transparent.png'));
  assert.ok(!(await readFile(join(directory, 'error.json'), 'utf8')).includes('fixture-secret'));
});

test('cancellation during the second call retains the first image and request record', async t => {
  const { root } = await fixture(t); const first = await solidImage([11, 245, 5]); let calls = 0;
  let secondStarted!: () => void;
  const started = new Promise<void>(resolve => { secondStarted = resolve; });
  const server = createServer((_req, res) => {
    calls++;
    if (calls === 1) res.end(JSON.stringify({ data: [{ b64_json: first.toString('base64') }] }));
    else secondStarted();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise<void>(done => server.close(() => done())); });
  const settings = loadWorkflowEnvironment({ part_simplify_image_model: 'gemini-nano-banana-2.1',
    layering_google_image_base_url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    layering_google_image_api_key: 'fixture', layering_google_image_protocol: 'openai' }, root);
  const controller = new AbortController();
  const rejected = assert.rejects(imageGenerationTool(settings, 'part_simplify', root)!.execute(
    { prompt: '透明 PNG', input_images: [] }, controller.signal), /cancelled.*原始生图保留在/);
  await started; controller.abort(new Error('cancelled')); await rejected;
  assert.equal(calls, 2);
  const [id] = await readdir(join(root, 'image-processing')); const directory = join(root, 'image-processing', id);
  assert.deepEqual(await readFile(join(directory, 'original.png')), first);
  assert.ok((await readdir(directory)).includes('counterpart-request.json'));
  assert.ok(!(await readdir(directory)).includes('transparent.png'));
});

test('invalid second images keep both observations without producing a successful result', async t => {
  const { root } = await fixture(t); const first = await solidImage([11, 245, 5]);
  for (const [name, second, message] of [
    ['dimensions', await sharp(await solidImage([255, 255, 255])).resize(96, 64).png().toBuffer(), /画布尺寸/],
    ['same-background', first, /颜色过于接近/],
  ] as const) {
    const directory = join(root, name);
    const args = { prompt: '透明 PNG', background: 'transparent' as const };
    await assert.rejects(transparentGeneratedImage(first, 'gemini-nano-banana-2.1', args, args,
      { directory }, new AbortController().signal, await recommendBackground([]), async () => second), message);
    assert.deepEqual(await readFile(join(directory, 'original.png')), first);
    assert.deepEqual(await readFile(join(directory, 'counterpart.png')), second);
    assert.ok(!(await readdir(directory)).includes('transparent.png'));
  }
});

test('a proportional second resolution is normalized only for comparison, retaining both raw observations', async t => {
  const { root } = await fixture(t); const first = await solidImage([11, 245, 5]);
  const second = await sharp(await solidImage([255, 255, 255])).resize(96, 128).png().toBuffer();
  const args = { prompt: '透明 PNG', background: 'transparent' as const };
  const output = await transparentGeneratedImage(first, 'gemini-nano-banana-2.1', args, args,
    { directory: root }, new AbortController().signal, await recommendBackground([]), async () => second);
  const meta = await sharp(output).metadata(); assert.deepEqual([meta.width, meta.height], [48, 64]);
  assert.deepEqual(await readFile(join(root, 'original.png')), first);
  assert.deepEqual(await readFile(join(root, 'counterpart.png')), second);
  const report = JSON.parse(await readFile(join(root, 'normalization.json'), 'utf8'));
  assert.deepEqual(report.counterpartAlignment, { from: [96, 128], to: [48, 64], fit: 'contain' });
});

test('原生半透明 alpha 原字节保留，不触发第二次请求或缩放', async t => {
  const { root } = await fixture(t);
  const png = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#ee88aa80' } }).png().toBuffer();
  const args = { prompt: '透明部件 PNG', background: 'transparent' as const };
  let called = false;
  const output = await transparentGeneratedImage(png, 'gemini-nano-banana-2.1', args, args,
    { directory: root, runsRoot: root },
    new AbortController().signal, await recommendBackground([]), async () => { called = true; throw new Error('不应该换背景'); });
  assert.equal(called, false); assert.deepEqual(output, png);
  assert.ok(!(await readdir(root)).includes('.runtime'));
  const record = JSON.parse(await readFile(join(root, 'normalization.json'), 'utf8'));
  assert.equal(record.nativeAlphaPreserved, true);
});
