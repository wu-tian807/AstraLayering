import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { preflightAgentSteps } from '../agents/preflight.ts';
import { normalizeReference, referenceNeedsGeneration } from '../part/reference-normalization.ts';
import { runTask } from '../../workflow/runner.ts';
import { taskStatus } from '../../workflow/state.ts';

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'layering-dependencies-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const krita = join(directory, 'krita');
  await writeFile(krita, `#!${process.execPath}\nconsole.log('krita 5.3 fixture');\n`);
  await chmod(krita, 0o755);
  return { directory, krita };
}

test('透明图后处理与已完成参考不要求 外部图片程序，缺参考才需要生成前置', async t => {
  const f = await fixture(t), input = join(f.directory, 'transparent.png');
  await sharp({ create: { width: 8, height: 8, channels: 4, background: '#0000' } })
    .composite([{ input: Buffer.from('<svg width="8" height="8"><rect x="2" y="2" width="4" height="4" fill="white"/></svg>') }]).png().toFile(input);
  const output = join(f.directory, 'output.png');
  const report = await normalizeReference(input, input, output, { env: { PATH: '' } });
  assert.equal(report.method, null); assert.deepEqual(await readFile(output), await readFile(input));
  for (const [id, names] of [
    ['part-layering', ['base-subject.png', 'judgment.json', 'simplified-subject.png']],
    ['clothing-part-layering', ['clothing.png', '../step01_preparation/.completed']],
  ] as const) {
    const references = join(f.directory, 'case', id, 'references');
    assert.equal(await referenceNeedsGeneration(id, 'case', f.directory), true);
    await mkdir(references, { recursive: true });
    for (const name of names) {
      await mkdir(dirname(join(references, name)), { recursive: true });
      await writeFile(join(references, name), 'retained');
    }
    assert.equal(await referenceNeedsGeneration(id, 'case', f.directory), false);
    if (id === 'part-layering') {
      await rm(join(references, 'judgment.json'));
      assert.equal(await referenceNeedsGeneration(id, 'case', f.directory), false);
    }
    await rm(join(references, names[0]));
    assert.equal(await referenceNeedsGeneration(id, 'case', f.directory), true);
  }
  assert.equal(await referenceNeedsGeneration('character-assembly', 'case', f.directory), false);
});

test('Nano-only preparation starts without Krita/Python; missing image credentials and raster requirements still fail before ready', async t => {
  const f = await fixture(t);
  await writeFile(f.krita, `#!${process.execPath}\nif(process.argv.includes('--version'))console.log('codex-cli 0.161.0');else console.log(JSON.stringify({version:1,image_provider:true,image_provider_version:2,failed_error_event_version:1}));\n`);
  const options = { name: 'case', dir: f.directory, from: 'part-layering' as const, to: 'part-layering' as const };
  const environment = loadWorkflowEnvironment({ layering_codex_path: f.krita, PATH: '',
    part_simplify_image_model: 'gemini-nano-banana-2.1', layering_google_image_api_key: 'fixture',
    layering_google_image_base_url: 'https://example.invalid' }, f.directory);
  let started = false, ready = false;
  await runTask(options, { environment, ready() { ready = true; }, execute: async () => { started = true; return { summary: 'prepared' }; } });
  assert.equal(started, true); assert.equal(ready, true);
  assert.equal((await taskStatus(options)).status, 'completed');
  const missingCredentials = loadWorkflowEnvironment({ layering_codex_path: f.krita,
    part_simplify_image_model: 'gemini-nano-banana-2.1' }, f.directory);
  await assert.rejects(preflightAgentSteps(missingCredentials, ['part_simplify']), /API URL \/ API key/);
  ready = false;
  const raster = { ...options, name: 'raster', from: 'raster-layering' as const, to: 'raster-layering' as const };
  await assert.rejects(runTask(raster, { ready() { ready = true; }, execute: async () => assert.fail('Krita is required for raster') }), /--krita/);
  assert.equal(ready, false);
  // Refused before the task record is written; --krita gives the path again.
  await assert.rejects(taskStatus(raster), /缺少总控记录/);
});
