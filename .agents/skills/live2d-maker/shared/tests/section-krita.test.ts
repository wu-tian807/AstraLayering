import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SectionKrita, kritaLimit, kritaSlotsInUse, readKritaRecord } from '../krita/section-krita.ts';
import { createKritaTool } from '../krita/tool.ts';

// Speaks the bridge protocol without Krita: a job whose source is "crash"
// kills the process; any other job returns its source as the result.
const fakeKrita = `#!/usr/bin/env node
const { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const root = process.env.ASTRA_KRITA_BRIDGE, jobs = join(root, 'jobs');
mkdirSync(jobs, { recursive: true });
writeFileSync(root + '/ready.json.tmp', JSON.stringify({ protocol: 1, pid: process.pid, version: '0.fake', jobs }));
renameSync(root + '/ready.json.tmp', root + '/ready.json');
setInterval(() => {
  if (existsSync(join(root, 'quit'))) process.exit(0);
  for (const name of readdirSync(jobs).filter(name => name.endsWith('.py'))) {
    const source = readFileSync(join(jobs, name), 'utf8').trim();
    if (source === 'crash') process.exit(3);
    renameSync(join(jobs, name), join(jobs, name + '.done'));
    writeFileSync(join(jobs, name.slice(0, -3) + '.json'), JSON.stringify({ ok: true, result: source, hints: [], dialogs: [] }));
  }
}, 20);
`;

const exists = (path: string) => stat(path).then(() => true, () => false);
const parse = (result: { contentItems: { type: string; text?: string }[] }) => JSON.parse(result.contentItems[0]!.text!);

test('section Krita: lazy start through the tool, crash and restart, release on section end', async t => {
  const root = await mkdtemp(join(tmpdir(), 'section-krita-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const krita = join(root, 'krita');
  await writeFile(krita, fakeKrita); await chmod(krita, 0o755);
  const record = join(root, 'krita.json');
  const section = new SectionKrita({ section: root, krita, record, env: { ...process.env, DISPLAY: ':fixture' }, slotsDirectory: join(root, 'slots') });
  t.after(() => section.release());
  const tool = createKritaTool(section, root), signal = new AbortController().signal;

  // Without the section's slot nothing can start; with it, nothing starts yet.
  await assert.rejects(tool.execute({ action: 'start' }, signal), /名额/);
  await section.reserve();
  assert.equal(section.reserved, true);
  assert.equal(parse(await tool.execute({}, signal)).state, 'stopped');
  // The record shows the held slot before Krita starts.
  assert.equal((await readKritaRecord(record))?.state, 'reserved');

  await writeFile(join(root, 'ok.py'), 'hello');
  const first = await tool.execute({ action: 'run', script: 'ok.py' }, signal);
  assert.equal(first.success, true);
  assert.equal(parse(first).result, 'hello');
  const running = parse(await tool.execute({ action: 'status' }, signal));
  assert.equal(running.state, 'running');
  assert.equal(running.version, '0.fake');
  const runningRecord = await readKritaRecord(record);
  assert.equal(runningRecord?.state, 'running');
  assert.equal(runningRecord?.state === 'running' && runningRecord.pid, running.pid);
  const profile = join(running.bridge, '..');

  // A script that kills Krita: the agent learns it and restarts it itself.
  await writeFile(join(root, 'crash.py'), 'crash');
  await assert.rejects(tool.execute({ action: 'run', script: 'crash.py' }, signal), /restart/);
  const crashed = parse(await tool.execute({}, signal));
  assert.equal(crashed.state, 'crashed');
  assert.equal(crashed.lastExit.code, 3);
  // The slot stays with the section after a crash.
  assert.equal((await readKritaRecord(record))?.state, 'reserved');
  // Crash status is immediate; removing the private profile is asynchronous.
  const cleanupDeadline = Date.now() + 5_000;
  while (await exists(profile) && Date.now() < cleanupDeadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await exists(profile), false);
  const restarted = parse(await tool.execute({ action: 'restart' }, signal));
  assert.equal(restarted.state, 'running');
  assert.equal(restarted.restarts, 1);
  assert.notEqual(restarted.pid, running.pid);

  // The section ends: Krita, its profile and its record go away.
  await section.release();
  assert.equal(section.status().state, 'stopped');
  assert.throws(() => process.kill(restarted.pid, 0));
  assert.equal(await exists(record), false);
  assert.equal(await exists(join(restarted.bridge, '..')), false);
  await assert.rejects(tool.execute({ action: 'start' }, signal), /已结束/);
});

test('section Krita: machine-wide cap queues sections until a slot is free', async t => {
  const root = await mkdtemp(join(tmpdir(), 'section-krita-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const krita = join(root, 'krita'), slots = join(root, 'slots');
  await writeFile(krita, fakeKrita); await chmod(krita, 0o755);
  // A slot left by a process that died is reclaimed.
  await mkdir(slots);
  await writeFile(join(slots, '0.lock'), '999999999');
  const env = { ...process.env, DISPLAY: ':fixture', krita_max_instances: '1' };
  const first = new SectionKrita({ section: 'a', krita, env, slotsDirectory: slots });
  const secondRecord = join(root, 'b.json');
  const second = new SectionKrita({ section: 'b', krita, env, slotsDirectory: slots, record: secondRecord });
  t.after(() => Promise.all([first.release(), second.release()]));
  await first.reserve();
  // The slot belongs to the section: a restart keeps it.
  assert.equal((await first.start()).state, 'running');
  assert.equal((await first.restart()).state, 'running');

  const messages: string[] = [];
  const queued = second.reserve(undefined, message => messages.push(message));
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(second.reserved, false);
  assert.match(second.status().waiting ?? '', /krita_max_instances/);
  assert.equal(messages.length, 1);
  const waiting = await readKritaRecord(secondRecord);
  assert.deepEqual([waiting?.state, waiting?.limit, await kritaSlotsInUse(slots)], ['waiting', 1, 1]);
  await first.release();
  await queued;
  assert.equal(second.reserved, true);
  assert.equal((await readKritaRecord(secondRecord))?.state, 'reserved');
  assert.equal(second.status().waiting, undefined);
  assert.equal((await second.start()).state, 'running');

  // A section that ends while queued gives up its place.
  const thirdRecord = join(root, 'c.json');
  const third = new SectionKrita({ section: 'c', krita, env, slotsDirectory: slots, record: thirdRecord });
  const abandoned = assert.rejects(third.reserve(), /已结束/);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal((await readKritaRecord(thirdRecord))?.state, 'waiting');
  await third.release();
  await abandoned;
  assert.equal(await exists(thirdRecord), false);
  // So does a wait given up through its signal.
  const fourthRecord = join(root, 'd.json'), stop = new AbortController();
  const fourth = new SectionKrita({ section: 'd', krita, env, slotsDirectory: slots, record: fourthRecord });
  const aborted = assert.rejects(fourth.reserve(stop.signal), { name: 'AbortError' });
  await new Promise(resolve => setTimeout(resolve, 100));
  stop.abort(new Error('stopped'));
  await aborted;
  assert.equal(await exists(fourthRecord), false);
  await second.release();
  assert.equal(await exists(secondRecord), false);

  assert.throws(() => kritaLimit({ krita_max_instances: '0' }), /正整数/);
  assert.throws(() => kritaLimit({ krita_max_instances: '2.5' }), /正整数/);
  assert.equal(kritaLimit({ krita_max_instances: ' 3 ' }), 3);
  // The default comes from example.env.
  assert.equal(kritaLimit({}), 4);
});

// Without -noreset, an Xvfb whose socket file another starting Xvfb unlinked
// stops serving clients once its first one leaves: concurrent sections hung.
test('section Krita: the shared Xvfb never resets between clients', { skip: process.platform !== 'linux' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'section-krita-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const krita = join(root, 'krita'), xvfb = join(root, 'Xvfb'), argv = join(root, 'argv');
  await writeFile(krita, fakeKrita); await chmod(krita, 0o755);
  await writeFile(xvfb, `#!/bin/sh\nprintf '%s\\n' "$@" > '${argv}'\nprintf '93\\n'\nexec sleep 30\n`, { mode: 0o700 });
  const env: NodeJS.ProcessEnv = { ...process.env, ASTRA_STUDIO_XVFB: xvfb };
  delete env.DISPLAY; delete env.WAYLAND_DISPLAY; delete env.QT_QPA_PLATFORM;
  const section = new SectionKrita({ section: root, krita, env, slotsDirectory: join(root, 'slots') });
  t.after(() => section.release());
  await section.reserve();
  assert.equal((await section.start()).state, 'running');
  assert.ok((await readFile(argv, 'utf8')).split('\n').includes('-noreset'));
});

test('krita tool: argument errors', async () => {
  const tool = createKritaTool(new SectionKrita({ section: '/fixture', krita: '/fixture/krita' }), '/fixture');
  const signal = new AbortController().signal;
  await assert.rejects(tool.execute({ action: 'paint' }, signal), /action/);
  await assert.rejects(tool.execute({ action: 'run' }, signal), /script/);
  await assert.rejects(tool.execute({ action: 'run', script: 'a.py', timeout_seconds: 0 }, signal), /timeout_seconds/);
});
