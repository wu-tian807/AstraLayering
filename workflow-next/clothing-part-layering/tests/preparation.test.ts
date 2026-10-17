import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import type { AgentTask } from '../agents.ts';
import { createPreparationSteps, getPreparationDirectory, loadPreparedReferences, prepareReferences } from '../preparation.ts';

async function fixture(t: TestContext) {
  const temporary = await mkdtemp(join(tmpdir(), 'clothing-preparation-'));
  const runName = `fixture-${randomUUID()}`, directory = getPreparationDirectory(runName);
  t.after(async () => { await rm(temporary, { recursive: true, force: true }); await rm(dirname(directory), { recursive: true, force: true }); });
  const input = join(temporary, 'simplified-character.png'), generated = join(temporary, 'generated.png');
  await sharp({ create: { width: 96, height: 128, channels: 4, background: '#c0c0c0' } }).png().toFile(input);
  await sharp({ create: { width: 96, height: 128, channels: 4, background: '#80a0c080' } }).png().toFile(generated);
  const calls: AgentTask[] = [];
  const steps = createPreparationSteps({ async run(task) {
    calls.push(task);
    return { text: JSON.stringify({ savedPath: generated, error: null }), images: [{ savedPath: generated }] };
  } });
  return { temporary, directory, runName, input, generated, calls, steps };
}

test('preparation uses one native image task, copies the clothed input, and resumes without external input', async t => {
  const f = await fixture(t);
  const refs = await prepareReferences({ runName: f.runName, image: f.input }, f.steps);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].imageGeneration, true);
  assert.equal(f.calls[0].images!.length, 1);
  assert.equal(f.calls[0].images![0].path, refs.originalImage);
  assert.ok(f.calls[0].prompt.includes('Codex 内置 image_generation'));
  assert.ok(f.calls[0].prompt.includes('96×128'));
  assert.ok(!f.calls[0].prompt.includes('{width}'));
  assert.deepEqual(await readFile(refs.originalImage!), await readFile(f.input));
  assert.deepEqual(await readFile(refs.baseSubject), await readFile(f.generated));
  assert.equal(refs.baseSubject, refs.simplifiedSubject);
  await rm(f.input);
  f.calls.length = 0;
  assert.deepEqual(await prepareReferences({ runName: f.runName }, f.steps), refs);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await loadPreparedReferences(f.runName), refs);
});

test('deleting clothing reference regenerates from saved character and invalidates old decomposition', async t => {
  const f = await fixture(t);
  const refs = await prepareReferences({ runName: f.runName, image: f.input }, f.steps);
  await mkdir(join(dirname(f.directory), 'parts'), { recursive: true });
  await writeFile(join(dirname(f.directory), 'parts/old.svg'), 'old garment');
  await writeFile(join(dirname(f.directory), 'groups.json'), '{"groups":[]}');
  await rm(refs.baseSubject);
  await assert.rejects(loadPreparedReferences(f.runName), /尚未完成/);
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.equal(f.calls.length, 2);
  await assert.rejects(readdir(join(dirname(f.directory), 'parts')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(dirname(f.directory), 'groups.json')), { code: 'ENOENT' });
});

test('missing native image tool leaves a retryable preparation without fake output', async t => {
  const f = await fixture(t);
  const failed = createPreparationSteps({ async run() { throw new Error('image_generation unavailable'); } });
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.input }, failed), /unavailable/);
  await readFile(join(f.directory, 'simplified-character.png'));
  await assert.rejects(readFile(join(f.directory, 'clothing.png')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(f.directory, 'preparation.json')), { code: 'ENOENT' });
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.equal(f.calls.length, 1);
});

test('reject invalid, opaque, or differently sized images instead of publishing completion', async t => {
  for (const mode of ['invalid', 'opaque', 'wrong-size'] as const) {
    await t.test(mode, async t => {
      const f = await fixture(t);
      if (mode === 'invalid') await writeFile(f.generated, 'not an image');
      else if (mode === 'opaque') await copyFile(f.input, f.generated);
      else await sharp({ create: { width: 32, height: 32, channels: 4, background: '#aabbcc80' } }).png().toFile(f.generated);
      await assert.rejects(prepareReferences({ runName: f.runName, image: f.input }, f.steps));
      await assert.rejects(readFile(join(f.directory, 'preparation.json')), { code: 'ENOENT' });
    });
  }
});

test('changed cached references are not silently reused; loading missing references does not write', async t => {
  const f = await fixture(t);
  await assert.rejects(loadPreparedReferences(f.runName));
  await assert.rejects(readdir(f.directory), { code: 'ENOENT' });
  const refs = await prepareReferences({ runName: f.runName, image: f.input }, f.steps);
  await writeFile(refs.originalImage!, 'changed source');
  await assert.rejects(loadPreparedReferences(f.runName), /参考已变化/);
  assert.equal(f.calls.length, 1);
});
