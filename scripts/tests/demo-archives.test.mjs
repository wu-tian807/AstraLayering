import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { snapshot } from '../../web/snapshot.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = async path => JSON.parse(await readFile(join(root, path), 'utf8'));

test('Tanuki reference archive contains its source KRA and all final head textures without live runner state', async () => {
  const base = 'demos/tanuki-girl';
  const run = await json(base + '/run.json');
  assert.equal(run.archive, true);
  assert.equal(run.status, 'completed');
  assert.equal(run.from, 'part-layering'); assert.equal(run.to, 'nine-axis');
  assert.ok(Object.values(run.sections).every(section => section.status === 'completed'));
  assert.equal(run.runner, undefined); assert.equal(run.krita, undefined); assert.equal(run.knowledge, undefined);
  const path = base + '/nine-axis/step07_jaw-line/deformers.json', doc = await json(path);
  assert.equal(doc.kind, 'head-nine-axis'); assert.equal(doc.version, 2);
  assert.ok(doc.parts.length > 0 && doc.deformers.length > 0);
  for (const part of doc.parts) assert.ok((await stat(join(root, dirname(path), part.texture))).size > 0);
  assert.ok((await stat(join(root, base, doc.source.document))).size > 0);
  for (const file of ['input/original.png', 'character-assembly/step01/character-assembled.kra', 'shadow/step01_mask/character-shadowed.kra', 'nine-axis/step07_jaw-line/character-nine-axis.kra', 'nine-axis/step07_jaw-line/character-nine-axis.png']) {
    assert.ok((await stat(join(root, base, file))).size > 0);
  }
});

test('Tanuki exported completion markers survive omitted process images in the workbench', async () => {
  const value = await snapshot(join(root, 'demos/tanuki-girl'), 'tanuki-girl', join(root, 'demos'));
  assert.deepEqual(value.errors, []);
  assert.ok(value.sections.every(section => section.status === 'done'));
  const nine = value.sections.find(section => section.id === 'nine-axis');
  assert.ok(Object.values(nine.states).every(status => status === 'done'));
  assert.deepEqual(nine.messages, {});
});

test('Pink Doll retains its completed static archive without head motion files or metadata', async () => {
  const base = 'demos/pink-doll';
  assert.ok(!(await readdir(join(root, base))).some(name => /nine-axis|nineAxis|九轴/i.test(name)));
  const run = await json(base + '/run.json');
  assert.equal(run.archive, true); assert.equal(run.to, 'shadow'); assert.equal(run.sections['nine-axis'], undefined);
  assert.ok(!/nine-axis|nineAxis|九轴/i.test(await readFile(join(root, base, 'README.md'), 'utf8')));
});
