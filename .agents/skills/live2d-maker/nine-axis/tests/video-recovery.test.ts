import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { generateVideo, produceLeftVideo, producePitchVideos, produceCornerVideos, type VideoJob, type VideoJobStore } from '../turn.ts';

const api = { provider: 'openai' as const, baseUrl: 'https://video.test/v1', apiKey: 'fixture-secret', model: 'fixture-model' };
const dnsFailure = () => new TypeError('fetch failed', { cause: Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' }) });
const options = { poll: 1, retryDelay: 1 };

for (const target of ['left', 'up', 'down', 'left-up', 'left-down']) test(`${target} resumes the persisted job after DNS retries exhaust, preserving completed siblings`, async t => {
  const root = await mkdtemp(join(tmpdir(), 'video-recovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const front = join(root, 'nine-axis/step02_video'), corners = join(root, 'nine-axis/step04_angles/video');
  await mkdir(front, { recursive: true }); await mkdir(corners, { recursive: true });
  const colour = join(root, 'original.png'), face = join(root, 'face.svg');
  await sharp({ create: { width: 64, height: 64, channels: 3, background: '#edb' } }).png().toFile(colour);
  await writeFile(face, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="20" y="10" width="24" height="30"/></svg>');
  await writeFile(join(front, 'upper-body.png'), await readFile(colour));
  await writeFile(join(front, 'up.png'), 'up-first'); await writeFile(join(front, 'down.png'), 'down-first');
  let healthy = false;
  const posts = new Map<string, number>(), queries = new Map<string, number>();
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      const name = body.prompt === 'corner' ? 'left-' + Buffer.from(body.input_reference.split(',')[1], 'base64').toString().split('-')[0] : body.prompt;
      posts.set(name, (posts.get(name) ?? 0) + 1);
      return Response.json({ id: 'job-' + name, status: 'queued' });
    }
    const id = new URL(url).pathname.split('/')[3], name = id.slice(4);
    if (url.endsWith('/content')) return new Response('mp4:' + name);
    queries.set(name, (queries.get(name) ?? 0) + 1);
    if (name === target && !healthy) throw dnsFailure();
    return Response.json({ id, status: 'completed' });
  });
  const generate = (prompt: string, image: Buffer, value: any) => generateVideo(api, prompt, image, { ...value, ...options });
  const directory = target.startsWith('left-') ? corners : front;
  const names = target === 'left' ? ['left'] : target.startsWith('left-') ? ['left-up', 'left-down'] : ['up', 'down'];
  const run = () => target === 'left'
    ? produceLeftVideo(front, { color: colour, source: { id: 'shadow', directory: root }, parts: [face] }, generate, 'left', { model: api.model })
    : target.startsWith('left-') ? produceCornerVideos(corners, front, generate, 'corner', { model: api.model })
      : producePitchVideos(front, front, generate, { up: 'up', down: 'down' }, { model: api.model });
  await assert.rejects(run(), /fetch failed/);
  assert.equal(queries.get(target), 3, 'one query plus two network retries');
  const checkpoint = await readFile(join(directory, target + '.job.json'), 'utf8');
  assert.equal(JSON.parse(checkpoint).id, 'job-' + target);
  assert.ok(!checkpoint.includes(api.apiKey));
  const siblings = await Promise.all(names.filter(name => name !== target).map(async name => [name, await readFile(join(directory, name + '.mp4'))] as const));
  healthy = true; await run();
  const records = JSON.parse(await readFile(join(directory, 'videos.json'), 'utf8'));
  for (const name of names) {
    assert.equal(posts.get(name), 1, 'continue must not submit another paid job');
    assert.equal(records[name].videoId, 'job-' + name);
    assert.equal(await readFile(join(directory, name + '.mp4'), 'utf8'), 'mp4:' + name);
    await assert.rejects(access(join(directory, name + '.job.json')));
  }
  for (const [name, bytes] of siblings) assert.deepEqual(await readFile(join(directory, name + '.mp4')), bytes);
});

test('retryable query and download responses recover through the same bounded read policy', async t => {
  let posts = 0, queries = 0, downloads = 0, saved: VideoJob | undefined;
  const checkpoint: VideoJobStore = { read: async () => saved, write: async job => { saved = job; } };
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts++; return Response.json({ id: 'job', status: 'queued' }); }
    assert.equal(saved?.id, 'job', 'the ID is durable before the first query');
    if (url.endsWith('/content')) {
      downloads++;
      if (downloads === 1) throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
      return downloads === 2 ? new Response('', { status: 503 }) : new Response('mp4');
    }
    return ++queries === 1 ? new Response('', { status: 429 }) : Response.json({ status: 'completed' });
  });
  assert.equal((await generateVideo(api, 'turn', Buffer.from('png'), { ...options, checkpoint })).bytes.toString(), 'mp4');
  assert.equal(posts, 1); assert.equal(queries, 2); assert.equal(downloads, 3);
});

test('authentication failures are not retried and changed requests cannot reuse another job', async t => {
  let saved: VideoJob | undefined, posts = 0, queries = 0;
  const checkpoint: VideoJobStore = { read: async () => saved, write: async job => { saved = job; } };
  t.mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts++; return Response.json({ id: 'job', status: 'queued' }); }
    queries++; return new Response('bad fixture-secret', { status: 401 });
  });
  await assert.rejects(generateVideo(api, 'turn', Buffer.from('png'), { ...options, checkpoint }), error =>
    error instanceof Error && error.message.includes('401') && !error.message.includes(api.apiKey));
  assert.equal(queries, 1);
  for (const changed of [
    { api, prompt: 'changed', image: Buffer.from('png') },
    { api: { ...api, model: 'different' }, prompt: 'turn', image: Buffer.from('png') },
    { api: { ...api, baseUrl: 'https://other.test' }, prompt: 'turn', image: Buffer.from('png') },
    { api, prompt: 'turn', image: Buffer.from('other-image') },
  ]) await assert.rejects(generateVideo(changed.api, changed.prompt, changed.image, { ...options, checkpoint }), /不一致/);
  assert.equal(posts, 1); assert.equal(queries, 1);
});

test('an uncertain submission is attempted once, and cancellation stops read retries', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw dnsFailure(); });
  await assert.rejects(generateVideo(api, 'turn', Buffer.from('png'), options));
  assert.equal(requests, 1);
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json({ id: 'job', status: 'queued' });
    requests++; controller.abort(new Error('stop')); throw dnsFailure();
  });
  await assert.rejects(generateVideo(api, 'turn', Buffer.from('png'), { ...options, signal: controller.signal }));
  assert.equal(requests, 2, 'abort never starts another query');
});
