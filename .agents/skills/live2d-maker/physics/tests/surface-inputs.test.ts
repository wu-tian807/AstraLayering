import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareSurfaceInputs } from '../surface-inputs.ts';

test('independent physics review retains hash-checked draft surfaces without claiming upstream acceptance', async () => {
  const task = await mkdtemp(join(tmpdir(), 'astra-surfaces-'));
  try {
    const input = { task, document: join(task, 'assembled.kra'), color: join(task, 'color.png'), profile: 'all' as const, structures: [] }, source = join(task, 'source');
    await writeFile(input.document, 'document');
    const png = await sharp({ create: { width: 4, height: 6, channels: 4, background: '#8080ff' } }).png().toBuffer();
    for (const name of ['color', 'normal', 'depth']) await writeFile(join(task, name + '.png'), png);
    const files = { normal: { available: true, path: 'normal.png' }, depth: { available: true, path: 'depth.png' } };
    await prepareSurfaceInputs(input, source, files);
    const snapshot = await prepareSurfaceInputs(input, source, {});
    assert.deepEqual(await readFile(join(source, 'normal.png')), png); assert.deepEqual(await readFile(join(source, 'depth.png')), png);
    assert.equal(snapshot.maps.normal.status, 'frozen-preview-input'); assert.equal(snapshot.maps.normal.upstreamAvailable, false);
    await writeFile(join(task, 'normal.png'), Buffer.from('changed'));
    await assert.rejects(prepareSurfaceInputs(input, source, {}), /来源已变化/);
    await writeFile(input.document, 'new document');
    assert.deepEqual((await prepareSurfaceInputs(input, source, {})).maps, {});
    await assert.rejects(access(join(source, 'normal.png'))); await assert.rejects(access(join(source, 'depth.png')));
    const wrong = await sharp({ create: { width: 5, height: 6, channels: 4, background: '#8080ff' } }).png().toBuffer();
    await writeFile(join(task, 'normal.png'), wrong);
    await assert.rejects(prepareSurfaceInputs(input, source, files), /尺寸不同/);
  } finally { await rm(task, { recursive: true, force: true }); }
});
