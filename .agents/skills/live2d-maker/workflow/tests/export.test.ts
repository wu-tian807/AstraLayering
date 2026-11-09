import assert from 'node:assert/strict';
import { readFile, readdir, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { unzipSync } from 'fflate';
import { exportCompletedRun } from '../export.ts';
import { parseExportArguments } from '../export-run.ts';
import { configureRun, acquireTaskLock } from '../state.ts';
import { exportFixture } from './export-fixture.ts';
import { reportPath } from '../../shared/part/artifact-facts.ts';
import { stepDeliveries } from '../../shared/step-deliveries.ts';
import { nineAxisSteps, previousNineAxisSteps } from '../../shared/nine-axis.ts';
import { relative } from 'node:path';

test('directory/ZIP exports retain artwork, completion facts and cited workspace images, without runtime files', async t => {
  const f = await exportFixture(t), destination = join(f.base, 'result');
  const result = await exportCompletedRun({ name: f.name, dir: f.dir, output: destination });
  assert.equal(result.warnings.length, 0);
  const manifest = JSON.parse(await readFile(join(destination, 'manifest.json'), 'utf8'));
  assert.equal(manifest.files['raster-layering/step01/character-depth.kra'].sha256, f.artHash);
  assert.deepEqual(await readFile(join(destination, 'raster-layering/step01/composite.png')), f.png);
  assert.deepEqual(await readFile(join(destination, 'raster-layering/step01/report-assets/inspect/cited.png')), f.png);
  assert.match(await readFile(join(destination, 'raster-layering/step01/report.md'), 'utf8'), /report-assets\/inspect\/cited.png/);
  assert.ok(Object.keys(manifest.files).some(path => path.endsWith('/.completed')));
  assert.ok(!Object.keys(manifest.files).some(path => /workspace|agents|unused|orphan|workflow\.log|\.runtime|physics/.test(path)));
  assert.ok(manifest.files['shadow/step01_mask/inspection/overview.png']);
  assert.ok(manifest.files['shadow/step01_mask/inspection/relation-000-review.png']);
  const run = JSON.parse(await readFile(join(destination, 'run.json'), 'utf8'));
  assert.equal(run.archive, true); assert.equal(run.krita, undefined); assert.equal(run.runner, undefined); assert.equal('dir' in run, false);
  assert.equal(JSON.stringify(run).includes(f.root), false);
  const depth = await readFile(join(destination, 'part-layering/step14_occlusion/preview.svg'), 'utf8');
  assert.match(depth, /data-depth-preview="whole-parts"/);
  assert.ok(depth.indexOf('data-group-path="front"') < depth.indexOf('data-group-path="rear"'));
  const zipPath = join(f.base, 'result.zip');
  await exportCompletedRun({ name: f.name, dir: f.dir, output: zipPath });
  const zip = unzipSync(await readFile(zipPath));
  assert.deepEqual(Object.keys(zip).sort(), [...Object.keys(manifest.files), 'manifest.json'].map(path => f.name + '/' + path).sort());
  assert.deepEqual(Buffer.from(zip['case/raster-layering/step01/character-depth.kra']), f.kra);
  // Source and workspace have not been moved, rewritten or deleted.
  assert.equal((JSON.parse(await readFile(join(f.root, 'run.json'), 'utf8'))).archive, undefined);
  assert.match(await readFile(join(f.root, 'raster-layering/step01/report.md'), 'utf8'), /workspace/);
  await assert.rejects(configureRun({ name: f.name, dir: f.base }, destination), /成果归档/);
  await assert.rejects(exportCompletedRun({ name: f.name, dir: f.dir, output: zipPath }), /已存在/);
});

test('records naming the task through a symlinked runs root still export task-relative', async t => {
  const f = await exportFixture(t), link = join(f.base, 'linked-runs'), destination = join(f.base, 'result');
  await symlink(f.dir, link);
  const lexical = join(link, f.name), cited = 'raster-layering/step01/workspace/inspect/cited.png';
  const review = reportPath('part-layering', 'front', 'review');
  const value = JSON.parse(await readFile(join(f.root, review), 'utf8'));
  value.reviews[0].observations = [join(lexical, cited), join(f.root, cited), '/outside/resource.png'];
  await f.put(review, JSON.stringify(value));
  await f.put('raster-layering/step01/report.md', '结论：已完成\n![检查图](' + join(lexical, cited) + ')\n');
  await exportCompletedRun({ name: f.name, dir: link, output: destination });
  const exported = JSON.parse(await readFile(join(destination, review), 'utf8'));
  assert.deepEqual(exported.reviews[0].observations, [cited, cited, '/outside/resource.png']);
  assert.match(await readFile(join(destination, 'raster-layering/step01/report.md'), 'utf8'), /\]\(report-assets\/inspect\/cited.png\)/);
});

for (const staged of [false, true]) test(`a completed ${staged ? 'seven-step' : 'previous'} nine-axis route exports its actual models, textures, KRA and evidence without shadow naming requirements`, async t => {
  const jaw = staged ? 'step07_jaw-line' : 'step04_jaw-line';
  const f = await exportFixture(t), nine = join(f.root, 'nine-axis');
  for (const step of staged ? ['step01_preparation', 'step04_angles/model', 'step04_angles/model/merged', ...['left','up','down'].map(g => 'step04_angles/model/' + g), 'step06_angle-xy', jaw] : ['step02_angles', 'step02_angles/neutral', 'step02_angles/merged', 'step02_angles/left', 'step02_angles/up', 'step02_angles/down', 'step03_angle-xy', jaw]) {
    await f.put(`nine-axis/${step}/deformers.json`, JSON.stringify({ parts: [{ texture: 'layers/face.png' }] }));
  }
  for (const id of staged ? nineAxisSteps : previousNineAxisSteps) {
    for (const path of await stepDeliveries(nine, 'nine-axis', id)) {
      try { await readFile(path); } catch { await f.put(relative(f.root, path), path.endsWith('.kra') ? f.kra : path.endsWith('.png') ? f.png : path.endsWith('.json') ? '{}' : 'delivery'); }
    }
    await f.put(`nine-axis/${id}/.completed`, '');
  }
  for (const file of ['character-nine-axis.kra', 'character-nine-axis.png', 'notes.md', 'jaw-check.png', 'review/left-up.png']) await f.put(`nine-axis/${jaw}/` + file, file.endsWith('.kra') ? f.kra : file.endsWith('.png') ? f.png : 'artwork note');
  const output = join(f.base, 'nine-result');
  await exportCompletedRun({ name: f.name, dir: f.dir, output });
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  for (const file of ['deformers.json', 'layers/face.png', 'character-nine-axis.kra', 'character-nine-axis.png', 'jaw-check.png', 'review/left-up.png']) assert.ok(manifest.files[`nine-axis/${jaw}/${file}`], file);
  assert.equal(JSON.parse(await readFile(join(output, 'run.json'), 'utf8')).to, 'nine-axis');
  await f.put(`nine-axis/${jaw}/layers/arbitrary-cast-name.png`, f.png);
  await f.put(`nine-axis/${jaw}/workspace/draft.png`, f.png);
  const second = join(f.base, 'nine-result-with-cast');
  await exportCompletedRun({ name: f.name, dir: f.dir, output: second });
  const actual = JSON.parse(await readFile(join(second, 'manifest.json'), 'utf8'));
  assert.ok(actual.files[`nine-axis/${jaw}/layers/arbitrary-cast-name.png`]);
  assert.equal(actual.files[`nine-axis/${jaw}/workspace/draft.png`], undefined);
});

test('incomplete, active, missing-delivery and missing-marker exports fail without leaving partial outputs', async t => {
  const f = await exportFixture(t), output = join(f.base, 'refused');
  const tryExport = () => exportCompletedRun({ name: f.name, dir: f.dir, output });
  const run = structuredClone(f.run); run.sections.shadow!.status = 'pending';
  await f.put('run.json', JSON.stringify(run)); await assert.rejects(tryExport(), /全流程/);
  await f.put('run.json', JSON.stringify(f.run));
  const release = await acquireTaskLock(f.root);
  try { await assert.rejects(tryExport(), /已停止/); } finally { await release(); }
  await rm(join(f.root, 'raster-layering/step02/.completed'));
  await assert.rejects(tryExport(), /\.completed/);
  await f.put('raster-layering/step02/.completed', '');
  await rm(join(f.root, 'shadow/step01_mask/face-review.png'));
  await assert.rejects(tryExport(), /face-review\.png/);
  assert.equal((await readdir(f.base)).includes('refused'), false);
  assert.equal((await readdir(f.base)).some(path => path.startsWith('.live2d-export')), false);
});

test('export refuses symlink evidence, existing output and destinations inside the source', async t => {
  const f = await exportFixture(t), output = join(f.base, 'out');
  await f.put('raster-layering/step01/report.md', '![private](workspace/inspect/link.png)');
  await symlink(join(f.root, 'input/original.png'), join(f.root, 'raster-layering/step01/workspace/inspect/link.png'));
  await assert.rejects(exportCompletedRun({ name: f.name, dir: f.dir, output }), /符号链接/);
  // Prose the file system cannot resolve is a warning, not a failed export.
  await f.put('raster-layering/step01/report.md', `\`${'很长的说明'.repeat(60)}.png\` 与 \`input/original.png/zoom.png\``);
  const exported = await exportCompletedRun({ name: f.name, dir: f.dir, output });
  assert.deepEqual(exported.warnings.map(warning => warning.match(/（(\w+)）/)?.[1]), ['ENOTDIR', 'ENAMETOOLONG']);
  await rm(output, { recursive: true, force: true });
  await assert.rejects(exportCompletedRun({ name: f.name, dir: f.dir, output: join(f.root, 'out') }), /原任务目录/);
  await assert.rejects(exportCompletedRun({ name: f.name, dir: f.dir, output: join(f.root, 'input/original.png') }), /原任务目录/);
});

test('CLI arguments follow --name/--dir and provide directory/ZIP output without starting models', () => {
  assert.equal(parseExportArguments(['--name', 'case'])?.output.endsWith('case.zip'), true);
  assert.equal(parseExportArguments(['--help']), undefined);
  assert.throws(() => parseExportArguments(['--name', '../escape']), /--name/);
  assert.throws(() => parseExportArguments([]), /--name/);
  assert.throws(() => parseExportArguments(['--name', 'case', '--model', 'anything']), /Unknown option/);
});
