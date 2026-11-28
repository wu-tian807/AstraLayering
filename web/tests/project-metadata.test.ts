import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createWorkbench } from '../server.ts';

test('Chinese project names persist across views and restarts without changing a running task', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'astra-project-name-'))), dir = join(root, 'runs');
  await mkdir(dir);
  const name = 'character-01', folder = join(dir, name);
  await mkdir(folder); await mkdir(join(folder, '.runner.lock'));
  const run = JSON.stringify({ version: 1, name, dir, jobs: 1, from: 'part-layering', to: 'part-layering', status: 'running',
    activeSections: ['part-layering'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    sections: { 'part-layering': { status: 'running', updatedAt: new Date().toISOString() } },
    runner: { id: 'fixture', pid: process.pid, startedAt: new Date().toISOString() } });
  await writeFile(join(folder, 'run.json'), run);
  let server: ReturnType<typeof createWorkbench> extends Promise<infer T> ? T : never;
  let base = '';
  async function open() {
    server = await createWorkbench({ settingsPath: join(root, 'settings.json'), defaultDir: dir });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + (server.address() as any).port;
  }
  await open();
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); });
  const label = (displayName: unknown, task = name, directory = dir) => fetch(base + '/api/project-name', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: task, dir: directory, displayName }),
  });
  const tasks = () => fetch(base + '/api/tasks').then(r => r.json());
  assert.equal((await tasks()).tasks[0].displayName, name);
  assert.equal((await label('  粉色人偶  ')).status, 200);
  const listed = (await tasks()).tasks[0];
  assert.equal(listed.name, name); assert.equal(listed.displayName, '粉色人偶');
  assert.equal(listed.runnerAlive, true); assert.equal(listed.lockHeld, true);
  for (const query of ['task?' + new URLSearchParams({ name, dir }), 'studio/project?' + new URLSearchParams({ folder })]) {
    const value = await fetch(base + '/api/' + query).then(r => r.json());
    assert.equal(value.displayName, '粉色人偶'); assert.equal(value.name, name);
  }
  assert.equal(await readFile(join(folder, 'run.json'), 'utf8'), run);
  for (const invalid of ['a'.repeat(81), 'bad\nname', 42]) assert.equal((await label(invalid)).status, 400);
  assert.equal((await label('越界', '../outside')).status, 400);
  assert.equal((await label('越界', name, root)).status, 409);
  await symlink(root, join(dir, 'alias'));
  assert.equal((await label('越界', 'alias')).status, 400);
  await new Promise<void>(resolve => server.close(() => resolve())); await open();
  assert.equal((await tasks()).tasks.find((task: any) => task.name === name).displayName, '粉色人偶');
  assert.equal((await label('')).status, 200);
  assert.equal((await tasks()).tasks.find((task: any) => task.name === name).displayName, name);
});

test('new tasks accept Chinese display names and retain their stable directory names', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'astra-new-project-name-')));
  const server = await createWorkbench({ settingsPath: join(root, 'settings.json'), defaultDir: root });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + (server.address() as any).port;
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const response = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'character-new', displayName: '新角色', dir: root, from: 'part-layering', to: 'part-layering', upload: png.toString('base64') }) });
  assert.equal(response.status, 201);
  const listed = await fetch(base + '/api/tasks').then(r => r.json());
  assert.equal(listed.tasks[0].name, 'character-new'); assert.equal(listed.tasks[0].displayName, '新角色');
});
