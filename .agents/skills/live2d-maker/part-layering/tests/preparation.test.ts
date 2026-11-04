import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stepKnowledge } from '../../shared/knowledge.ts';
import { test, type TestContext } from 'node:test';
import type { AgentTask } from '../../shared/codex/agents.ts';
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
  const bytes = await readFile(styleReference);
  const original = join(temporary, 'original.png');
  const generated = join(temporary, 'generated.png');
  await writeFile(original, bytes);
  await writeFile(generated, bytes);
  const calls: AgentTask[] = [];
  const steps = createPreparationSteps({
    async run(task) {
      calls.push(task);
      if ((task.name === '参考判断与简化' && !needsSimplification) || (task.name === '素体换装' && reuseBase)) {
        const tool = task.tools!.find(tool => tool.name === 'reuse_reference')!;
        const result = await tool.execute({ reason: task.name === '参考判断与简化' ? '测试画风判断' : '无需替换主体衣装' }, new AbortController().signal);
        const saved = JSON.parse((result.contentItems[0] as { text: string }).text);
        return { text: JSON.stringify({ error: null, reason: saved.reason }), images: [] };
      }
      if (task.step === 'part_pose_judgment') {
        return { text: JSON.stringify({ needsAdjustment, reason: '测试姿态判断' }), images: [] };
      }
      return { text: JSON.stringify({ error: null, reason: '测试转换依据' }), images: [{ savedPath: generated }] };
    },
  });
  return { original, generated, runName, calls, steps, bytes };
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
  const mixed = createPreparationSteps({ async run(task) {
    await task.tools![0].execute({ reason: '先复用' }, new AbortController().signal);
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

test('原图不是 PNG 时复制为 original.png，standard 和不简化的参考都是真实 PNG', async t => {
  const f = await fixture(t, false);
  const jpeg = f.original.replace('.png', '.jpg');
  await writeFile(jpeg, await sharp(f.original).jpeg().toBuffer());
  const refs = await prepareReferences({ runName: f.runName, image: jpeg }, f.steps);
  assert.deepEqual(await readFile(refs.originalImage!), await pngBytes(jpeg));
  assert.ok(refs.originalImage!.endsWith('original.png'));
  await prepareReferences({ runName: f.runName, image: jpeg }, f.steps);
  for (const path of [refs.standardImage!, refs.simplifiedSubject]) assert.equal((await sharp(path).metadata()).format, 'png');
  assert.deepEqual(f.calls.map(task => task.name), ['参考判断与简化', '素体换装']);
});

test('--standard 先判断；已标准仅复制，需要调整才传一张原图给原生生图，后续引用新图', async t => {
  for (const adjust of [false, true]) await t.test(String(adjust), async t => {
    const f = await fixture(t, true, adjust);
    await sharp({ create: { width: 24, height: 32, channels: 4, background: '#b0907080' } }).png().toFile(f.generated);
    const refs = await prepareReferences({ runName: f.runName, image: f.original, standard: true }, f.steps);
    assert.deepEqual(f.calls.map(task => task.name), ['姿态判断', ...(adjust ? ['标准姿态'] : []), '参考判断与简化', '素体换装']);
    const judge = f.calls[0];
    assert.deepEqual(referencePaths(judge.prompt), [refs.originalImage]);
    const generation = f.calls.find(task => task.name === '标准姿态');
    if (adjust) {
      assert.equal(generation!.step, 'part_standardize');
      assert.deepEqual(referencePaths(generation!.prompt), [refs.originalImage]);
      assert.deepEqual(await readFile(refs.standardImage!), await readFile(f.generated));
    } else assert.deepEqual(await readFile(refs.standardImage!), f.bytes);
    assert.equal(referencePaths(f.calls.find(task => task.name === '参考判断与简化')!.prompt)[0], refs.standardImage);
    assert.deepEqual(await readFile(refs.originalImage!), f.bytes);
    f.calls.length = 0;
    assert.deepEqual(await prepareReferences({ runName: f.runName, standard: true }, f.steps), refs);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(JSON.parse(await readFile(optionsPath(refs), 'utf8')), { standard: true });
  });
});

test('标准生图异常保留选项和判断，带同一 --standard 续跑不重做判断', async t => {
  const f = await fixture(t, false, true);
  const failed = createPreparationSteps({ async run() {
    return { text: '没有 image_generation 工具，无法生图', images: [], threadId: 'standard-thread', logDirectory: '/logs/standard' };
  } });
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.original, standard: true },
    { ...f.steps, standardize: failed.standardize }), error => {
    assert.match(formatAgentError(error), /模型最后消息：[\s\S]*没有 image_generation[\s\S]*standard-thread/);
    return true;
  });
  const directory = getPreparationDirectory(f.runName);
  await assert.rejects(readFile(join(directory, 'standard.png')), { code: 'ENOENT' });
  assert.deepEqual(JSON.parse(await readFile(optionsPath(directory), 'utf8')), { standard: true });
  assert.equal(JSON.parse(await readFile(join(section(directory), step('pose'), 'judgment.json'), 'utf8')).needsAdjustment, true);
  f.calls.length = 0;
  await prepareReferences({ runName: f.runName, standard: true }, f.steps);
  assert.deepEqual(f.calls.map(task => task.name), ['标准姿态', '参考判断与简化', '素体换装']);
});

test('无效姿态判断和无效生成图片明确报错，不回退原图', async t => {
  const f = await fixture(t, false, true);
  const invalid = createPreparationSteps({ async run() {
    return { text: '{"needsAdjustment":"no"}', images: [], threadId: 'invalid-decision' };
  } });
  await assert.rejects(prepareReferences({ runName: f.runName, image: f.original, standard: true }, invalid), error => {
    assert.match(formatAgentError(error), /boolean needsAdjustment[\s\S]*invalid-decision/); return true;
  });
  await writeFile(f.generated, 'invalid PNG');
  await assert.rejects(prepareReferences({ runName: f.runName, standard: true }, f.steps), /did not produce a PNG/);
  await assert.rejects(readFile(join(getPreparationDirectory(f.runName), 'standard.png')), { code: 'ENOENT' });
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
