import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { snapshot } from '../../web/snapshot.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = async path => JSON.parse(await readFile(join(root, path), 'utf8'));

test('Tanuki reference archive contains refreshed raster, assembly and shadow deliveries without live runner state', async () => {
  const base = 'demos/tanuki-girl';
  const run = await json(base + '/run.json');
  assert.equal(run.archive, true);
  assert.equal(run.status, 'completed');
  assert.equal(run.from, 'part-layering'); assert.equal(run.to, 'shadow');
  assert.ok(Object.values(run.sections).every(section => section.status === 'completed'));
  assert.equal(run.runner, undefined); assert.equal(run.krita, undefined); assert.equal(run.knowledge, undefined);
  assert.equal(run.sections['nine-axis'], undefined);
  assert.ok(!(await readdir(join(root, base))).includes('nine-axis'));
  for (const file of ['input/original.png', 'raster-layering/step01/character-depth.kra', 'raster-layering/step01/composite.png',
    'raster-layering/step03/character-dressup-base.kra', 'character-assembly/step01/character-assembled.kra',
    'character-assembly/step01/character-assembled.png', 'shadow/step01_mask/character-shadowed.kra', 'shadow/step01_mask/character-shadowed.png']) {
    assert.ok((await stat(join(root, base, file))).size > 0);
  }
});

test('Tanuki exported completion markers survive omitted process images in the workbench', async () => {
  const value = await snapshot(join(root, 'demos/tanuki-girl'), 'tanuki-girl', join(root, 'demos'));
  assert.deepEqual(value.errors, []);
  assert.ok(value.sections.every(section => section.status === 'done'));
  assert.equal(value.sections.find(section => section.id === 'nine-axis'), undefined);
  for (const id of ['raster-layering', 'character-assembly']) {
    const section = value.sections.find(section => section.id === id);
    assert.ok(Object.values(section.states).every(status => status === 'done'));
    assert.deepEqual(section.messages, {});
  }
  const shadow = value.sections.find(section => section.id === 'shadow');
  assert.equal(shadow.mode, 'mask');
  assert.deepEqual(shadow.states, { mask: 'done', 'normal-depth-maps': 'pending', 'normal-depth': 'pending', step01: 'done' });
  assert.deepEqual(shadow.messages, {});
});

test('Pink Doll retains its completed static archive without head motion files or metadata', async () => {
  const base = 'demos/pink-doll';
  assert.ok(!(await readdir(join(root, base))).some(name => /nine-axis|nineAxis|九轴/i.test(name)));
  const run = await json(base + '/run.json');
  assert.equal(run.archive, true); assert.equal(run.to, 'shadow'); assert.equal(run.sections['nine-axis'], undefined);
  assert.ok(!/nine-axis|nineAxis|九轴/i.test(await readFile(join(root, base, 'README.md'), 'utf8')));
});
