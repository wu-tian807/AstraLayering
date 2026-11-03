import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import type { AgentTask } from '../../shared/codex/agents.ts';
import { createPreparationSteps, getPreparationDirectory, loadPreparedReferences, prepareReferences } from '../preparation.ts';
import { taskDirectory, sectionDirectory } from '../../shared/paths.ts';
import { clothingPreparationStep, partSteps } from '../../shared/step-paths.js';
import { referencePaths } from '../../shared/tests/prompt-input.ts';

// The person part steps the clothing preparation is built on.
const personSteps = [partSteps.standard, partSteps.simplified, partSteps.base];
async function markPerson(runName: string, step: string) {
  const directory = join(sectionDirectory(runName, 'part-layering'), step);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, '.completed'), '');
}

async function fixture(t: TestContext) {
  const temporary = await mkdtemp(join(tmpdir(), 'clothing-preparation-'));
  const runName = `fixture-${randomUUID()}`, directory = getPreparationDirectory(runName);
  t.after(async () => { await rm(temporary, { recursive: true, force: true }); await rm(taskDirectory(runName), { recursive: true, force: true }); });
  const input = join(temporary, 'simplified-character.png'), generated = join(temporary, 'generated.png');
  await sharp({ create: { width: 96, height: 128, channels: 4, background: '#c0c0c0' } }).png().toFile(input);
  await sharp({ create: { width: 96, height: 128, channels: 4, background: '#80a0c080' } }).png().toFile(generated);
  const upstream = join(sectionDirectory(runName, 'part-layering'), 'references/simplified-subject.png');
  await mkdir(dirname(upstream), { recursive: true });
  await copyFile(input, upstream);
  await copyFile(input, join(dirname(upstream), 'standard.png'));
  const base = join(dirname(upstream), 'base-subject.png');
  await sharp({ create: { width: 96, height: 128, channels: 4, background: '#a0b0c0' } }).png().toFile(base);
  for (const step of personSteps) await markPerson(runName, step);
  const calls: AgentTask[] = [];
  const steps = createPreparationSteps({ async run(task) {
    calls.push(task);
    return { text: JSON.stringify({ error: null }), images: [{ savedPath: generated }] };
  } });
  return { temporary, directory, runName, input, upstream, base, generated, calls, steps };
}

test('preparation sends clothed and base references in order through one configured image task and resumes without external input', async t => {
  const f = await fixture(t);
  const refs = await prepareReferences({ runName: f.runName }, f.steps);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].prompt, /image_gen\.imagegen/);
  assert.match(f.calls[0].prompt, /生图工具 imagegen（Codex 为内置 image_gen\.imagegen，其他模型为同名工具 imagegen/);
  assert.deepEqual(referencePaths(f.calls[0].prompt), [refs.originalImage, f.base]);
  assert.equal(f.calls[0].step, 'clothing_preparation');
  assert.ok(f.calls[0].prompt.includes('96×128'));
  assert.ok(!f.calls[0].prompt.includes('{width}'));
  assert.deepEqual(await readFile(refs.originalImage!), await readFile(f.input));
  assert.deepEqual(await readFile(refs.baseSubject), await readFile(f.generated));
  assert.equal(refs.baseSubject, refs.simplifiedSubject);
  assert.equal(await readFile(join(dirname(f.directory), clothingPreparationStep, '.completed'), 'utf8'), '');
  await rm(f.input);
  f.calls.length = 0;
  assert.deepEqual(await prepareReferences({ runName: f.runName }, f.steps), refs);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await loadPreparedReferences(f.runName), refs);
});

test('deleting clothing reference is refused; retrying the step regenerates from the saved character', async t => {
  const f = await fixture(t);
  const refs = await prepareReferences({ runName: f.runName }, f.steps);
  await rm(refs.baseSubject);
  await assert.rejects(loadPreparedReferences(f.runName), /交付缺失/);
  await assert.rejects(prepareReferences({ runName: f.runName }, f.steps), /交付缺失/);
  assert.equal(f.calls.length, 1);
  await rm(join(dirname(f.directory), clothingPreparationStep, '.completed'));
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.equal(f.calls.length, 2);
  await loadPreparedReferences(f.runName);
});

test('missing native image tool leaves a retryable preparation without fake output', async t => {
  const f = await fixture(t);
  const failed = createPreparationSteps({ async run() { throw new Error('image_generation unavailable'); } });
  await assert.rejects(prepareReferences({ runName: f.runName }, failed), /unavailable/);
  await readFile(f.upstream);
  await assert.rejects(readFile(join(f.directory, 'simplified-character.png')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(f.directory, 'clothing.png')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(dirname(f.directory), clothingPreparationStep, '.completed')), { code: 'ENOENT' });
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.equal(f.calls.length, 1);
});

test('reject invalid or empty-foreground images, normalize differing dimensions', async t => {
  for (const mode of ['invalid', 'opaque', 'wrong-size'] as const) {
    await t.test(mode, async t => {
      const f = await fixture(t);
      if (mode === 'invalid') await writeFile(f.generated, 'not an image');
      else if (mode === 'opaque') await copyFile(f.input, f.generated);
      else await sharp({ create: { width: 32, height: 32, channels: 4, background: '#aabbcc80' } }).png().toFile(f.generated);
      if (mode === 'wrong-size') {
        const refs = await prepareReferences({ runName: f.runName }, f.steps);
        const m = await sharp(refs.baseSubject).metadata();
        assert.equal(m.width, 96); assert.equal(m.height, 128);
      } else {
        await assert.rejects(prepareReferences({ runName: f.runName }, f.steps));
        await assert.rejects(readFile(join(dirname(f.directory), clothingPreparationStep, '.completed')), { code: 'ENOENT' });
      }
    });
  }
});

test('loading missing references does not write', async t => {
  const f = await fixture(t);
  await assert.rejects(loadPreparedReferences(f.runName));
  await assert.rejects(readdir(f.directory), { code: 'ENOENT' });
});

test('new clothing generation requires the base reference before calling an agent', async t => {
  const f = await fixture(t);
  await rm(f.base);
  await assert.rejects(prepareReferences({ runName: f.runName }, f.steps), error => {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes(f.base));
    assert.match(error.message, /part-layering --name/);
    return true;
  });
  assert.equal(f.calls.length, 0);
  await assert.rejects(readFile(join(f.directory, 'clothing.png')), { code: 'ENOENT' });
});

test('上游人物 preparation 未完成时不生成衣服参考', async t => {
  const f = await fixture(t);
  await rm(join(sectionDirectory(f.runName, 'part-layering'), partSteps.base, '.completed'));
  await assert.rejects(prepareReferences({ runName: f.runName }, f.steps), /part-layering\/step06_base 尚未完成/);
  assert.equal(f.calls.length, 0);
});

test('衣服 preparation 不接受人物标准化选项', async t => {
  const f = await fixture(t);
  for (const standard of [true, false]) {
    await assert.rejects(prepareReferences({ runName: f.runName, standard }, f.steps), /只适用于人物 part/);
  }
  assert.equal(f.calls.length, 0);
});

test('衣服输出采用 standard 尺寸而非 simplified 尺寸，并记录自动处理', async t => {
  const f = await fixture(t);
  await sharp({ create: { width: 200, height: 200, channels: 4, background: '#8888' } }).png().toFile(join(dirname(f.upstream), 'standard.png'));
  const refs = await prepareReferences({ runName: f.runName }, f.steps);
  const m = await sharp(refs.baseSubject).metadata();
  assert.equal(m.width, 200); assert.equal(m.height, 200);
  const archive = join(dirname(f.directory), clothingPreparationStep, 'workspace/generation');
  const entries = await readdir(archive);
  assert.equal(entries.length, 1);
  assert.deepEqual(await readFile(join(archive, entries[0], 'original.png')), await readFile(f.generated));
  const report = JSON.parse(await readFile(join(archive, entries[0], 'normalization.json'), 'utf8'));
  assert.deepEqual(report.target, [200, 200]);
  await rm(archive, { recursive: true });
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.equal(f.calls.length, 1);
  await loadPreparedReferences(f.runName);
  await assert.rejects(readFile(join(f.directory, 'standard.png')), { code: 'ENOENT' });
});
