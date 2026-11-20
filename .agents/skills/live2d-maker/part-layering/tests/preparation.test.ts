import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stepKnowledge } from '../../shared/knowledge.ts';
import { test, type TestContext } from 'node:test';
import type { AgentTask } from '../../shared/agents/dispatcher.ts';
import { getPreparationDirectory, loadPreparedReferences, prepareReferences, type PreparationReferences } from '../preparation.ts';
import { createPreparationSteps } from '../run.ts';
import { taskDirectory } from '../../shared/paths.ts';
import sharp from 'sharp';
import { formatAgentError } from '../../shared/codex/diagnostics.ts';
import { readDressup } from '../../shared/part/dressup.ts';
import { partSteps } from '../../shared/step-paths.js';
import { referencePaths } from '../../shared/tests/prompt-input.ts';
import { pngBytes } from '../../shared/png.ts';

// The part section holds the preparation steps beside the references directory.
const section = (refs: { directory: string } | string) => dirname(typeof refs === 'string' ? refs : refs.directory);
const step = (stage: keyof typeof partSteps) => partSteps[stage];
const optionsPath = (refs: { directory: string } | string) => join(section(refs), step('options'), 'options.json');

const styleReference = stepKnowledge('part-layering', 'step05_simplified').reference('简化参考图片.png');
const outfitReference = stepKnowledge('part-layering', 'step06_base').reference('连体服参考.jpg');

async function fixture(t: TestContext, needsSimplification: boolean, needsAdjustment = false, reuseBase = false) {
  const temporary = await mkdtemp(join(tmpdir(), 'part-layering-preparation-'));
  const runName = `test-${randomUUID()}`;
  t.after(async () => {
    await rm(temporary, { recursive: true, force: true });
    await rm(taskDirectory(runName), { recursive: true, force: true });
  });
  const subject = Buffer.from('<svg width="48" height="64"><rect x="8" y="10" width="32" height="44" fill="#a16b89"/></svg>');
  const bytes = await sharp(subject).png().toBuffer();
  const original = join(temporary, 'original.png');
  const generated = join(temporary, 'generated.png');
  await writeFile(original, bytes);
  await writeFile(generated, bytes);
  const calls: AgentTask[] = [];
  const standardReuse: { savedPath?: string; status?: string; instruction?: string }[] = [];
  const steps = createPreparationSteps({
    async run(task) {
      calls.push(task);
      if ((task.name === '参考判断与简化' && !needsSimplification) || (task.name === '素体换装' && reuseBase)) {
        const tool = task.tools!.find(tool => tool.name === 'reuse_reference')!;
        const result = await tool.execute({ reason: task.name === '参考判断与简化' ? '测试画风判断' : '无需替换主体衣装' }, new AbortController().signal);
        const saved = JSON.parse((result.contentItems[0] as { text: string }).text);
        return { text: JSON.stringify({ error: null, reason: saved.reason }), images: [] };
      }
      if (task.name === '标准姿态' && !needsAdjustment) {
        const tool = task.tools!.find(tool => tool.name === 'reuse_reference')!;
        const result = await tool.execute({ reason: '姿态已经合适' }, new AbortController().signal);
        const reuse = JSON.parse((result.contentItems[0] as { text: string }).text);
        standardReuse.push(reuse);
        if (reuse.savedPath) return { text: '', images: [] };
        assert.equal(reuse.status, 'needs_cutout');
      }
      if (task.step === 'part_standardize') return { text: '', images: [{ savedPath: generated }] };
      return { text: JSON.stringify({ error: null, reason: '测试转换依据' }), images: [{ savedPath: generated }] };
    },
  });
  return { original, generated, runName, calls, steps, bytes, standardReuse };
}

test('无需简化仍执行换装，判断和换装各收到正确的两张图片', async t => {
  const f = await fixture(t, false);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  assert.deepEqual(f.calls.map(task => task.name), ['参考判断与简化', '素体换装']);
  assert.deepEqual(referencePaths(f.calls[0].prompt), [refs.standardImage, styleReference]);
  assert.deepEqual(referencePaths(f.calls[1].prompt), [refs.simplifiedSubject, outfitReference]);
  assert.deepEqual(await readFile(refs.simplifiedSubject), f.bytes);
  assert.deepEqual(await readFile(refs.baseSubject), f.bytes);
  assert.deepEqual(await readFile(refs.standardImage!), f.bytes);
  assert.deepEqual(await readFile(refs.originalImage!), f.bytes);
  await readFile(join(section(refs), step('standard'), '.completed'));
  await assert.rejects(readFile(join(section(refs), step('cutout'), '.completed')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(refs.directory, 'judgment.json')), { code: 'ENOENT' });
  assert.equal(await readDressup(taskDirectory(f.runName)), true);
});

test('需要简化时先转换画风再换装，续跑不依赖外部原图', async t => {
  const f = await fixture(t, true);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  assert.deepEqual(f.calls.map(task => task.name), ['参考判断与简化', '素体换装']);
  assert.deepEqual(referencePaths(f.calls[0].prompt), [refs.standardImage, styleReference]);
  assert.deepEqual(referencePaths(f.calls[1].prompt), [refs.simplifiedSubject, outfitReference]);
  await rm(f.original);
  f.calls.length = 0;
  const messages: string[] = [];
  const resumed = await prepareReferences({ runName: f.runName }, f.steps, message => messages.push(message));
  assert.deepEqual(resumed, refs);
  assert.equal(f.calls.length, 0);
  assert.equal(messages.filter(message => message.includes('沿用已有')).length, 3);

  // A completed step keeps its delivery; a missing one is refused until the step is retried.
  await rm(refs.baseSubject);
  await assert.rejects(prepareReferences({ runName: f.runName }, f.steps), /step06_base 已标记完成但交付缺失/);
  await rm(join(section(refs), step('base'), '.completed'));
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.deepEqual(f.calls.map(task => task.name), ['素体换装']);
});

test('简化和素体各一次 agent 调用，复用分支保持参考字节且正常续跑零调用', async t => {
  const f = await fixture(t, false, false, true);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  assert.deepEqual(f.calls.map(call => call.name), ['参考判断与简化', '素体换装']);
  for (const task of f.calls) {
    assert.equal(task.tools?.length, 1);
    assert.equal(task.tools![0].name, 'reuse_reference');
    assert.ok(!task.prompt.includes('{image_execution_rules}'));
  }
  assert.deepEqual(await readFile(refs.simplifiedSubject), await readFile(refs.standardImage!));
  assert.deepEqual(await readFile(refs.baseSubject), await readFile(refs.simplifiedSubject));
  await assert.rejects(readFile(join(refs.directory, 'judgment.json')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(section(refs), step('base'), 'judgment.json')), { code: 'ENOENT' });
  f.calls.length = 0;
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await loadPreparedReferences(f.runName), refs);
  const decision = JSON.parse(await readFile(join(section(refs), step('base'), 'decision.json'), 'utf8'));
  assert.deepEqual(decision, { version: 1, dressed: false, reason: '无需替换主体衣装' });
  assert.equal(await readDressup(taskDirectory(f.runName)), false);
});

test('生图分支在准备函数内完成尺寸处理，两步直接交付 PNG 并保留生图原件', async t => {
  const f = await fixture(t, true);
  await sharp({ create: { width: 24, height: 32, channels: 4, background: '#b0907080' } }).png().toFile(f.generated);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  const standard = (await sharp(refs.standardImage!).metadata()).autoOrient;
  for (const image of [refs.simplifiedSubject, refs.baseSubject]) {
    const metadata = await sharp(image).metadata();
    assert.deepEqual([metadata.width, metadata.height], [standard.width, standard.height]);
    assert.equal(metadata.format, 'png');
  }
  for (const stage of ['simplified', 'base'] as const) {
    const directory = join(section(refs), step(stage), 'workspace/generation');
    const archives = await readdir(directory);
    assert.equal(archives.length, 1);
    assert.deepEqual(await readFile(join(directory, archives[0], 'original.png')), await readFile(f.generated));
  }
  await assert.rejects(readdir(join(refs.directory, 'archive')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(refs.directory, 'judgment.json')), { code: 'ENOENT' });
});

test('2K 的标准图、简化和素体在交付时各最多超分一次并共用同一画布', async t => {
  const f = await fixture(t, true, true);
  const generated = Buffer.from('<svg width="641" height="933"><rect x="75" y="100" width="450" height="700" fill="#a16b89"/></svg>');
  await sharp(generated).png().toFile(f.generated);
  const inputs: [number, number][] = [];
  const upscale = async (bytes: Buffer) => {
    const { width, height } = await sharp(bytes).metadata();
    inputs.push([width, height]);
    return sharp(bytes).resize(width * 4, height * 4).png().toBuffer();
  };
  const input = { runName: f.runName, image: f.original, standard: true, size: '2K' as const };
  const refs = await prepareReferences(input, f.steps, undefined, { upscale });
  assert.deepEqual(inputs, [[641, 933], [641, 933], [641, 933]]);
  for (const path of [refs.standardImage!, refs.simplifiedSubject, refs.baseSubject]) {
    const { width, height, hasAlpha } = await sharp(path).metadata();
    assert.deepEqual([width, height, hasAlpha], [1408, 2048, true]);
  }
  assert.deepEqual(await readFile(refs.originalImage!), f.bytes);
  assert.deepEqual(await prepareReferences(input, f.steps, undefined, { upscale }), refs);
  assert.equal(inputs.length, 3);
  assert.equal(f.calls.length, 3);
});

test('超分中断时保留已生成的简化图，续跑只补后处理并复用为素体', async t => {
  const f = await fixture(t, true, false, true);
  await sharp(f.original).resize(1536, 2048).png().toFile(join(dirname(f.original), '2k.png'));
  const input = { runName: f.runName, image: join(dirname(f.original), '2k.png'), size: '2K' as const };
  let attempts = 0;
  const upscale = async (bytes: Buffer) => {
    if (++attempts === 1) throw new Error('测试超分中断');
    return sharp(bytes).resize(192, 256).png().toBuffer();
  };
  await assert.rejects(prepareReferences(input, f.steps, undefined, { upscale }), /测试超分中断/);
  const refs = await prepareReferences(input, f.steps, undefined, { upscale });
  assert.deepEqual(f.calls.map(call => call.name), ['参考判断与简化', '素体换装']);
  assert.deepEqual(await readFile(refs.baseSubject), await readFile(refs.simplifiedSubject));
  assert.equal(attempts, 2);
});

test('复用工具只接受理由，输入和输出路径固定且单次复制', async t => {
  const f = await fixture(t, false);
  const target = join(dirname(f.original), 'reused.png');
  const steps = createPreparationSteps({ async run(task) {
    const tool = task.tools!.find(tool => tool.name === 'reuse_reference')!;
    const signal = new AbortController().signal;
    await assert.rejects(tool.execute({ reason: '复用', output: f.original }, signal), /只接受非空 reason/);
    const result = await tool.execute({ reason: '已满足要求' }, signal);
    assert.equal(JSON.parse((result.contentItems[0] as { text: string }).text).savedPath, target);
    await assert.rejects(tool.execute({ reason: '再次复制' }, signal), /已经复制完成/);
    return { text: JSON.stringify({ savedPath: target, error: null, reason: '已满足要求' }), images: [] };
  } });
  assert.deepEqual(await steps.baseSubject(f.original, target, 'test prompt', async () => assert.fail('复制分支跳过生图后处理')), { generated: false, reason: '已满足要求' });
  assert.deepEqual(await readFile(target), f.bytes);
  assert.deepEqual(await readFile(f.original), f.bytes);
});

test('模型仅返回已有路径而未执行工具时，拒绝冒充已完成的参考', async t => {
  const f = await fixture(t, false);
  const target = join(dirname(f.original), 'missing.png');
  const steps = createPreparationSteps({ async run() {
    return { text: JSON.stringify({ savedPath: f.original, error: null, reason: '声称复用' }), images: [] };
  } });
  await assert.rejects(steps.baseSubject(f.original, target, 'test prompt'), /did not produce an image/);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
});

test('复制与生图互斥，混合分支保留输入并阻止正式参考发布', async t => {
  const f = await fixture(t, false);
  let reused = false;
  const mixed = createPreparationSteps({ async run(task) {
    if (!reused) { reused = true; await task.tools![0].execute({ reason: '先复用' }, new AbortController().signal); }
    return { text: JSON.stringify({ error: null, reason: '又生图' }), images: [{ savedPath: f.generated }] };
  } });
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.original },
    { ...f.steps, baseSubject: mixed.baseSubject }), /同时执行了复制与生图/);
  const directory = getPreparationDirectory(f.runName);
  await assert.rejects(readFile(join(directory, 'base-subject.png')), { code: 'ENOENT' });
  assert.equal((await readdir(directory)).some(name => name.startsWith('base-subject.png.')), false);
  assert.deepEqual(await readFile(f.original), f.bytes);
});

test('素体准备中断后只恢复素体 agent，复用前面已完成的简化图片', async t => {
  const f = await fixture(t, true, false, true);
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.original },
    { ...f.steps, async baseSubject() { throw new Error('测试中断'); } }), /测试中断/);
  const directory = getPreparationDirectory(f.runName);
  const simplified = await readFile(join(directory, 'simplified-subject.png'));
  f.calls.length = 0;
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.deepEqual(f.calls.map(call => call.name), ['素体换装']);
  assert.deepEqual(await readFile(join(directory, 'simplified-subject.png')), simplified);
  assert.deepEqual(await readFile(join(directory, 'base-subject.png')), await readFile(join(directory, 'simplified-subject.png')));
});

test('已有图片直接续跑；缺图时拒绝，删除完成标记只重做该步骤', async t => {
  const f = await fixture(t, true);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  f.calls.length = 0;
  assert.deepEqual(await loadPreparedReferences(f.runName), refs);
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.equal(f.calls.length, 0);
  await rm(refs.simplifiedSubject);
  await assert.rejects(prepareReferences({ runName: f.runName }, f.steps), /交付缺失/);
  assert.equal(f.calls.length, 0);
  await rm(join(section(refs), step('simplified'), '.completed'));
  await prepareReferences({ runName: f.runName }, f.steps);
  assert.deepEqual(f.calls.map(call => call.name), ['参考判断与简化']);
  assert.deepEqual(await loadPreparedReferences(f.runName), refs);
});

test('简化后处理失败只保留上游，重试重新执行同一个准备 agent 并正常发布图片', async t => {
  const f = await fixture(t, true);
  const failing = { ...f.steps, async simplify(...args: Parameters<typeof f.steps.simplify>) {
    await f.steps.simplify(args[0], args[1], args[2], async () => { throw new Error('测试后处理失败'); });
  } };
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.original }, failing), /测试后处理失败/);
  const directory = getPreparationDirectory(f.runName);
  await assert.rejects(readFile(join(directory, 'simplified-subject.png')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(directory, 'judgment.json')), { code: 'ENOENT' });
  assert.equal((await readdir(directory)).some(name => name.endsWith('.tmp')), false);
  f.calls.length = 0;
  const refs = await prepareReferences({ runName: f.runName }, f.steps);
  assert.deepEqual(f.calls.map(call => call.name), ['参考判断与简化', '素体换装']);
  assert.deepEqual(await loadPreparedReferences(f.runName), refs);
});

test('重试该步骤时无效 PNG 明确报错，不留下正式参考', async t => {
  const f = await fixture(t, false);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  await rm(refs.baseSubject);
  await rm(join(section(refs), step('base'), '.completed'));
  await writeFile(f.generated, 'not a PNG');
  await assert.rejects(prepareReferences({ runName: f.runName }, f.steps), /did not produce a PNG/);
  await assert.rejects(readFile(refs.baseSubject), { code: 'ENOENT' });
});

test('不透明原图转换为 PNG，单独派发去背景并发布生图工具的透明结果', async t => {
  const f = await fixture(t, false);
  const jpeg = f.original.replace('.png', '.jpg');
  await writeFile(jpeg, await sharp(f.original).flatten({ background: 'white' }).jpeg().toBuffer());
  const refs = await prepareReferences({ runName: f.runName, image: jpeg }, f.steps);
  assert.deepEqual(await readFile(refs.originalImage!), await pngBytes(jpeg));
  assert.ok(refs.originalImage!.endsWith('original.png'));
  await prepareReferences({ runName: f.runName, image: jpeg }, f.steps);
  for (const path of [refs.standardImage!, refs.simplifiedSubject]) assert.equal((await sharp(path).metadata()).format, 'png');
  assert.deepEqual(f.calls.map(task => task.name), ['原图去背景', '参考判断与简化', '素体换装']);
  assert.equal(f.calls[0].step, 'part_standardize');
  assert.equal(f.calls[0].outputDirectory, step('standard'));
  assert.deepEqual(referencePaths(f.calls[0].prompt), [refs.originalImage]);
  assert.deepEqual(await readFile(refs.standardImage!), f.bytes);
  await readFile(join(section(refs), step('standard'), '.completed'));
  await assert.rejects(readFile(join(section(refs), step('cutout'), '.completed')), { code: 'ENOENT' });
});

test('只有一个角透明的原图仍派发去背景', async t => {
  const f = await fixture(t, false);
  const width = 48, height = 64;
  const pixels = Buffer.alloc(width * height * 4, 255);
  pixels[3] = 0;
  await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toFile(f.original);

  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  assert.equal(f.calls[0].name, '原图去背景');
  assert.deepEqual(await readFile(refs.standardImage!), f.bytes);
  await readFile(join(section(refs), step('standard'), '.completed'));
});

test('--standard 在同一回合判断姿态并复用或生图，由标准参考交付', async t => {
  for (const mode of ['reuse', 'adjust', 'cutout'] as const) await t.test(mode, async t => {
    const f = await fixture(t, true, mode === 'adjust');
    if (mode === 'cutout') {
      const opaque = await sharp(f.original).flatten({ background: 'white' }).png().toBuffer();
      await writeFile(f.original, opaque);
    }

    const refs = await prepareReferences({ runName: f.runName, image: f.original, standard: true }, f.steps);
    assert.deepEqual(f.calls.map(task => task.name), ['标准姿态', '参考判断与简化', '素体换装']);
    const standard = f.calls[0];
    assert.equal(standard.step, 'part_standardize');
    assert.equal(standard.outputDirectory, step('standard'));
    assert.deepEqual(standard.tools?.map(tool => tool.name), ['reuse_reference']);
    assert.deepEqual(referencePaths(standard.prompt), [refs.originalImage]);
    assert.equal(standard.outputSchema, undefined);
    if (mode === 'adjust') assert.deepEqual(f.standardReuse, []);
    else if (mode === 'reuse') assert.ok(f.standardReuse[0]?.savedPath);
    else assert.deepEqual(f.standardReuse, [{ status: 'needs_cutout', instruction: '保持原图人物前景，去除其他背景。' }]);
    assert.deepEqual(await readFile(refs.standardImage!), f.bytes);
    assert.deepEqual(await readFile(refs.originalImage!), await readFile(f.original));
    assert.equal(referencePaths(f.calls[1].prompt)[0], refs.standardImage);
    await readFile(join(section(refs), step('standard'), '.completed'));
    await assert.rejects(readFile(join(section(refs), step('pose'), 'judgment.json')), { code: 'ENOENT' });
    f.calls.length = 0;
    assert.deepEqual(await prepareReferences({ runName: f.runName, standard: true }, f.steps), refs);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(JSON.parse(await readFile(optionsPath(refs), 'utf8')), { standard: true });
  });
});

test('已有透传标记的任务直接复用原标准参考', async t => {
  const f = await fixture(t, false);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  await rename(join(section(refs), step('standard')), join(section(refs), step('passthrough')));
  f.calls.length = 0;
  assert.deepEqual(await loadPreparedReferences(f.runName), refs);
  assert.deepEqual(await prepareReferences({ runName: f.runName }, f.steps), refs);
  assert.equal(f.calls.length, 0);
});

test('标准生图异常保留选项和原图，带同一 --standard 从标准参考续跑', async t => {
  const f = await fixture(t, false, true);
  const failed = createPreparationSteps({ async run() {
    return { text: '没有 image_generation 工具，无法生图', images: [], threadId: 'standard-thread', logDirectory: '/logs/standard' };
  } });
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.original, standard: true },
    { ...f.steps, generateStandardReference: failed.generateStandardReference }), error => {
    assert.match(formatAgentError(error), /模型最后消息：[\s\S]*没有 image_generation[\s\S]*standard-thread/);
    return true;
  });
  const directory = getPreparationDirectory(f.runName);
  await assert.rejects(readFile(join(directory, 'standard.png')), { code: 'ENOENT' });
  assert.deepEqual(JSON.parse(await readFile(optionsPath(directory), 'utf8')), { standard: true });
  await readFile(join(section(directory), step('standard'), '.running'));
  f.calls.length = 0;
  await prepareReferences({ runName: f.runName, standard: true }, f.steps);
  assert.deepEqual(f.calls.map(task => task.name), ['标准姿态', '参考判断与简化', '素体换装']);
});

test('标准 PNG 已存在但步骤未完成时，按尺寸交付并接着做简化', async t => {
  for (const aligned of [true, false]) await t.test(String(aligned), async t => {
    const f = await fixture(t, false, true, true);
    await assert.rejects(prepareReferences({ runName: f.runName, image: f.original, standard: true }, {
      ...f.steps,
      async simplify() { throw new Error('测试中断'); },
    }), /测试中断/);
    const directory = getPreparationDirectory(f.runName);
    const stage = join(section(directory), step('standard'));
    await rename(join(stage, '.completed'), join(stage, '.running'));
    const area = { left: 0, top: 0, width: aligned ? 48 : 47, height: aligned ? 64 : 63 };
    const existing = aligned ? f.bytes : await sharp(f.bytes).extract(area).png().toBuffer();
    await writeFile(join(directory, 'standard.png'), existing);

    f.calls.length = 0;
    const refs = await prepareReferences({ runName: f.runName, standard: true }, f.steps);
    assert.deepEqual(f.calls.map(call => call.name), ['参考判断与简化', '素体换装']);
    const image = sharp(refs.standardImage!);
    const { width, height } = await image.metadata();
    assert.deepEqual([width, height], [48, 64]);
    if (aligned) assert.deepEqual(await readFile(refs.standardImage!), existing);
    else assert.deepEqual(await image.extract(area).raw().toBuffer(), await sharp(existing).raw().toBuffer());
    await readFile(join(stage, '.completed'));
  });
});

test('生图工具写图后回合中断，继续补边并发布已有 PNG', async t => {
  const f = await fixture(t, false, true, true);
  const area = { left: 0, top: 0, width: 47, height: 63 };
  const generated = await sharp(f.bytes).extract(area).png().toBuffer();
  await writeFile(f.generated, generated);
  const interrupted = createPreparationSteps({
    async run(task) {
      await task.onImageSaved!({ savedPath: f.generated });
      throw new Error('工具保存后中断');
    },
  });
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.original, standard: true }, {
    ...f.steps, generateStandardReference: interrupted.generateStandardReference,
  }), /工具保存后中断/);
  const directory = getPreparationDirectory(f.runName);
  const stage = join(section(directory), step('standard'));
  await readFile(join(stage, '.running'));
  const pending = join(stage, 'standard-input.png');
  assert.deepEqual(await readFile(pending), generated);
  await assert.rejects(readFile(join(directory, 'standard.png')), { code: 'ENOENT' });

  const refs = await prepareReferences({ runName: f.runName, standard: true }, f.steps);
  assert.deepEqual(f.calls.map(call => call.name), ['参考判断与简化', '素体换装']);
  const image = sharp(refs.standardImage!);
  const { width, height } = await image.metadata();
  assert.deepEqual([width, height], [48, 64]);
  assert.deepEqual(await image.extract(area).raw().toBuffer(), await sharp(generated).raw().toBuffer());
  await readFile(join(stage, '.completed'));
  await assert.rejects(readFile(pending), { code: 'ENOENT' });
});

test('抠图交付拒绝无效文件，接受前景贴边的 PNG 并补齐画布', async t => {
  const f = await fixture(t, false);
  const opaque = await sharp(f.bytes).flatten({ background: 'white' }).png().toBuffer();
  await writeFile(f.original, opaque);
  await writeFile(f.generated, 'invalid PNG');
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.original, standard: true }, f.steps), /did not produce a PNG/);
  await assert.rejects(readFile(join(getPreparationDirectory(f.runName), 'standard.png')), { code: 'ENOENT' });

  // Crop the transparent margin above the subject so it touches the top edge.
  const area = { left: 0, top: 0, width: 47, height: 54 };
  const touching = await sharp(f.bytes).extract({ ...area, top: 10 }).png().toBuffer();
  await writeFile(f.generated, touching);
  const refs = await prepareReferences({ runName: f.runName, standard: true }, f.steps);
  const standard = sharp(refs.standardImage!);
  const { width, height } = await standard.metadata();
  assert.deepEqual([width, height], [48, 64]);
  assert.deepEqual(await standard.clone().extract(area).raw().toBuffer(), await sharp(touching).raw().toBuffer());
  const alpha = await standard.extractChannel('alpha').raw().toBuffer();
  assert.ok(alpha.subarray(area.height * width).every(value => value === 0));
  for (let y = 0; y < area.height; y++) assert.equal(alpha[y * width + area.width], 0);
  await readFile(join(section(refs), step('standard'), '.completed'));
});

test('复用原图也补齐标准画布，并给简化和素体同一尺寸', async t => {
  for (const standard of [true, false]) await t.test(String(standard), async t => {
    const f = await fixture(t, false, false, true);
    const area = { left: 0, top: 0, width: 47, height: 63 };
    const source = await sharp(f.bytes).extract(area).png().toBuffer();
    await writeFile(f.original, source);
    const refs = await prepareReferences({ runName: f.runName, image: f.original, standard }, f.steps);
    assert.deepEqual(f.calls.map(call => call.name), [...(standard ? ['标准姿态'] : []), '参考判断与简化', '素体换装']);
    if (standard) assert.ok(f.standardReuse[0]?.savedPath);
    assert.deepEqual(await readFile(refs.originalImage!), source);
    const image = sharp(refs.standardImage!);
    const { width, height } = await image.metadata();
    assert.deepEqual([width, height], [48, 64]);
    assert.deepEqual(await image.extract(area).raw().toBuffer(), await sharp(source).raw().toBuffer());
    const delivered = await readFile(refs.standardImage!);
    assert.deepEqual(await readFile(refs.simplifiedSubject), delivered);
    assert.deepEqual(await readFile(refs.baseSubject), delivered);
  });
});

test('切换模式时不修改文件、不调用模型，提示使用新的 --name；只读入口同样校验', async t => {
  const f = await fixture(t, false);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  const markers = section(refs), ids = ['original', 'options', 'standard', 'simplified', 'base', 'ready'] as const;
  const before = await Promise.all(ids.map(id => readFile(join(markers, step(id), '.completed'))));
  f.calls.length = 0;
  await assert.rejects(prepareReferences({ runName: f.runName, standard: true }, f.steps), /不能直接切换[\s\S]*新的 --name/);
  await assert.rejects(loadPreparedReferences(f.runName, undefined, true), /不能直接切换/);
  assert.deepEqual(await Promise.all(ids.map(id => readFile(join(markers, step(id), '.completed')))), before);
  assert.equal(f.calls.length, 0);
});

test('显式组的参考入口只读已有产物，缺失时不补图或调用 agent', async t => {
  const f = await fixture(t, false);
  const refs = await prepareReferences({ runName: f.runName, image: f.original }, f.steps);
  f.calls.length = 0;
  assert.deepEqual(await loadPreparedReferences(f.runName), refs);
  await rm(refs.simplifiedSubject);
  await rm(refs.baseSubject);
  await assert.rejects(loadPreparedReferences(f.runName), /simplified-subject\.png[\s\S]*base-subject\.png/);
  assert.equal(f.calls.length, 0);
  await assert.rejects(readFile(refs.simplifiedSubject), { code: 'ENOENT' });
  await assert.rejects(readFile(refs.baseSubject), { code: 'ENOENT' });
});
