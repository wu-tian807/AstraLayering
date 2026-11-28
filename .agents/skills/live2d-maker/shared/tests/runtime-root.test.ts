import { readStepSession } from '../agents/step-session.ts';
import {deliverRasterStep, isRasterReview} from './raster-delivery.ts';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import sharp from 'sharp';
import { defaultRunsDirectory, sectionDirectory, resolveInput, runsDirectory, taskDirectory, workflowsDirectory } from '../paths.ts';
import { prepareReferences as preparePerson, loadPreparedReferences as loadPerson } from '../../part-layering/preparation.ts';
import { prepareReferences as prepareClothing, loadPreparedReferences as loadClothing } from '../../clothing-part-layering/preparation.ts';
import { parseSectionArguments } from '../section-options.ts';
import { runWorkflow as runPersonRaster } from '../../raster-layering/run.ts';
import { runWorkflow as runClothingRaster } from '../../clothing-raster-layering/run.ts';
import { steps as personSteps } from '../../raster-layering/steps.ts';
import { steps as clothingSteps } from '../../clothing-raster-layering/steps.ts';
import { seedUpstream } from './upstream-fixture.ts';
import { defaultKnowledgeDirectory } from '../knowledge.ts';

test('默认 root 是仓库 .run，独立 skill 使用上一级 .run；--dir 必须绝对，任务不能写进 skill', () => {
  const repository = resolve(workflowsDirectory, '../../..');
  assert.equal(runsDirectory, existsSync(join(repository, 'web/server.ts')) && existsSync(join(repository, 'pnpm-workspace.yaml'))
    ? join(repository, '.run') : resolve(workflowsDirectory, '../.run'));
  const installed = resolve(tmpdir(), 'installed');
  assert.equal(defaultRunsDirectory(join(installed, 'live2d-maker')), join(installed, '.run'));
  assert.equal(taskDirectory('sample'), join(runsDirectory, 'sample'));
  const custom = join(tmpdir(), 'custom');
  assert.equal(parseSectionArguments(['--name', 'sample', '--dir', custom, '--knowledge', 'knowledge']).dir, custom);
  assert.throws(() => parseSectionArguments(['--name', 'sample', '--dir', 'relative', '--knowledge', 'knowledge']), Error);
  assert.throws(() => taskDirectory('live2d-maker', resolve(workflowsDirectory, '..')), Error);
  assert.throws(() => taskDirectory('sample', workflowsDirectory), Error);
  assert.equal(resolveInput('sample', 'source.png', custom), join(custom, 'sample/source.png'));
});

test('同名任务可在不同 root 独立准备、读取上游、按 name 续跑并检查步骤范围前置', async t => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'skill-root-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const name = 'same-name';
  for (const label of ['first root', "second'root"]) {
    const dir = join(temporary, label), task = taskDirectory(name, dir);
    await mkdir(task, { recursive: true });
    const subject = Buffer.from('<svg width="16" height="16"><rect x="2" y="2" width="12" height="12" fill="#c090a0"/></svg>');
    await sharp(subject).png().toFile(join(task, 'ref.png'));
    let personCalls = 0, clothingCalls = 0;
    const person = { async simplify(input: string, output: string) { personCalls++; await copyFile(input, output); },
      async generateStandardReference() { assert.fail('original already has transparency'); },
      async baseSubject(input: string, output: string) { personCalls++; await copyFile(input, output); } };
    const refs = await preparePerson({ runName: name, dir, image: 'ref.png' }, person);
    assert.equal(refs.directory, join(task, 'part-layering/references'));
    await rm(join(task, 'ref.png'));
    assert.deepEqual(await preparePerson({ runName: name, dir }, person), refs);
    assert.deepEqual(await loadPerson(name, dir), refs);
    assert.equal(personCalls, 2);
    const clothing = { async extract(input: string, baseImage: string, output: string) {
      clothingCalls++; assert.equal(input, refs.simplifiedSubject); assert.equal(baseImage, refs.baseSubject); await copyFile(input, output);
    } };
    const clothes = await prepareClothing({ runName: name, dir }, clothing);
    assert.equal(clothes.directory, join(task, 'clothing-part-layering/references'));
    assert.deepEqual(await prepareClothing({ runName: name, dir }, clothing), clothes);
    assert.deepEqual(await loadClothing(name, dir), clothes);
    assert.equal(clothingCalls, 1);
    for (const [section, step] of [['part-layering', 'step07_ready'], ['clothing-part-layering', 'step01_preparation']]) {
      const prerequisite = join(task, section, step);
      await rm(join(prerequisite, '.completed'));
      await assert.rejects(promisify(execFile)(process.execPath, [
        '--import', new URL('../../part-layering/tests/forbid-model-processes.ts', import.meta.url).href,
        join(workflowsDirectory, 'workflow/section-cli.ts'), section,
        '--name', name, '--dir', dir, '--from-step', 'step09', '--knowledge', defaultKnowledgeDirectory,
      ], { cwd: temporary, timeout: 10000 }), error => {
        assert.ok(String(error).includes(prerequisite));
        return true;
      });
    }
  }
});

test('两套 raster 的 --dir 定位上游与续跑 thread，覆盖测试注入 root', async t => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'skill-raster-root-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [run, input, section, definitions] of [
    [runPersonRaster, 'part-layering', 'raster-layering', personSteps],
    [runClothingRaster, 'clothing-part-layering', 'clothing-raster-layering', clothingSteps],
  ] as const) {
    await seedUpstream('case', input, dir);
    const output = sectionDirectory('case', section, dir);
    const deps = { runsDirectory: join(dir, 'unused'), steps: [definitions[0]],
      preflight: async (executable: string) => {
        assert.equal(executable, join(dir, 'case/krita')); return { executable };
      } };
    await assert.rejects(run({ name: 'case', dir, krita: 'krita' }, { ...deps, agent: async request => {
      assert.equal(request.directory, output);
      await request.onEvent({ type: 'thread.started', thread_id: 'kept-thread' });
      throw new Error('interrupted fixture');
    } }), Error);
    await stat(join(output, 'step01/.running'));
    await run({ name: 'case', dir, krita: 'krita' }, { ...deps, agent: async request => {
      if (!isRasterReview(request)) assert.equal(request.threadId, 'kept-thread');
      // The upstream located under --dir is shown to the agent as an absolute path.
      if (!isRasterReview(request)) assert.ok(request.prompt.includes(join(sectionDirectory('case', input, dir), 'parts')));
      return deliverRasterStep(request, definitions[0], 'kept-thread');
    } });
    await stat(join(output, 'step01/.completed'));
    assert.equal((await readStepSession(output, 'step01'))?.threadId, 'kept-thread');
  }
});
