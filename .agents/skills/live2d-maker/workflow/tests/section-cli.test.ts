import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { defaultKnowledgeDirectory, knowledgeDirectory } from '../../shared/knowledge.ts';
import { readStep } from '../../shared/step-chain.ts';
import { rangeSummary, runSection } from '../../shared/step-section.ts';
import { runSectionCommand } from '../section-cli.ts';
import type { SectionDefinition } from '../sections.ts';

test('新注册的 section 直接获得起止范围、前置交付检查和续跑', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'astra-section-scope-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'case', 'example');
  const events: string[] = [];
  let finished = false;
  const registry: Record<string, SectionDefinition> = {
    example: {
      async run(options) {
        assert.equal(options.dir, root);
        assert.equal(options.knowledge, resolve(defaultKnowledgeDirectory));
        assert.equal(knowledgeDirectory(), options.knowledge);
        const result = await runSection({
          ...options, directory,
          steps: [{ number: 1, requiredFiles: ['delivery.txt'] }, { number: 2, note: 'selected' }, { number: 3 }],
          async step(step, status) {
            if (status === 'completed') return;
            return async () => {
              events.push(step.id + ':' + status);
              if (step.id === 'step01') await writeFile(join(step.directory, 'delivery.txt'), 'kept delivery');
            };
          },
          async finished(step) { return step.id !== 'step02_selected' || finished; },
        });
        return { summary: rangeSummary(result) };
      },
    },
  };
  const args = ['example', '--name', 'case', '--dir', root, '--knowledge', defaultKnowledgeDirectory];
  const launch = (...selection: string[]) => runSectionCommand([...args, ...selection], registry, () => {});
  await assert.rejects(launch('--from-step', 'step02'), Error);
  assert.deepEqual(events, []);
  await launch('--to-step', 'step01', '--max-recursive-counts', '2');
  assert.deepEqual(events, ['step01:absent']);
  const delivery = join(directory, 'step01', 'delivery.txt');
  await rm(delivery);
  await assert.rejects(launch('--from-step', 'step02_selected'), Error);
  assert.equal((await readStep(join(directory, 'step02_selected'))).status, 'absent');
  await writeFile(delivery, 'kept delivery');
  await launch('--from-step', 'step02', '--to-step', 'step03');
  assert.equal((await readStep(join(directory, 'step02_selected'))).status, 'running');
  assert.equal((await readStep(join(directory, 'step03'))).status, 'absent');
  finished = true;
  await launch('--from-step', 'step02');
  assert.equal((await readStep(join(directory, 'step02_selected'))).status, 'completed');
  assert.equal((await readStep(join(directory, 'step03'))).status, 'absent');
  assert.equal(await readFile(delivery, 'utf8'), 'kept delivery');
  assert.deepEqual(events, ['step01:absent', 'step02_selected:absent', 'step02_selected:running']);
});

test('公共命令检查启动必需参数', async () => {
  const registry: Record<string, SectionDefinition> = { example: { async run() { assert.fail('invalid arguments reached execution'); } } };
  await assert.rejects(runSectionCommand(['example'], registry), Error);
  await assert.rejects(runSectionCommand(['example', '--name', 'case'], registry), Error);
  await assert.rejects(runSectionCommand(['example', '--check-krita'], registry), Error);
});

test('独立 section 接收默认 1K 和显式档位', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'astra-section-size-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sizes: string[] = [];
  const registry: Record<string, SectionDefinition> = { example: {
    async run(options) {
      sizes.push(options.size);
      return { summary: 'size fixture' };
    },
  } };
  const args = ['example', '--name', 'case', '--dir', root, '--knowledge', defaultKnowledgeDirectory];
  const launch = (...extra: string[]) => runSectionCommand([...args, ...extra], registry, () => {}, async () => ({ supported: true }));
  await launch();
  await launch('--size', '2K');
  await assert.rejects(launch('--size', '4096'), Error);
  await runSectionCommand([...args, '--size', '4K'], registry, () => {}, async () => ({ supported: false, reason: 'GPU fixture' }));
  assert.deepEqual(sizes, ['1K', '2K', '1K']);
  assert.match(await readFile(join(root, 'case', 'workflow.log'), 'utf8'), /4K.*1K.*GPU fixture/);
});
