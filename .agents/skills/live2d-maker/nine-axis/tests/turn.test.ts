import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { cropUpperBody, resolveTurnInput, upperBodyBox, turnViews } from '../turn.ts';
import { runWorkflow, viewPrompt } from '../run.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';

const rect = (w: number, h: number, x: number, y: number, rw: number, rh: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="#000"/></svg>`;
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'astra-nine-axis-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const task = join(root, 'case'), assembly = join(task, 'character-assembly/step01'), parts = join(task, 'part-layering/parts');
  await mkdir(assembly, { recursive: true }); await mkdir(parts, { recursive: true });
  await writeFile(join(assembly, 'character-assembled.png'), await sharp({ create: { width: 200, height: 400, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 1 } } }).png().toBuffer());
  await writeFile(join(assembly, '.completed'), JSON.stringify({ stamp: 'assembly-1', inputs: {} }));
  await writeFile(join(parts, 'face.svg'), rect(200, 400, 80, 60, 40, 50));
  await writeFile(join(parts, 'hair.svg'), rect(200, 400, 60, 30, 70, 70));
  return { root, task };
}

test('头部特写从头顶截到肩线，以脸为中心并留边，长发不加宽', async t => {
  const { root } = await fixture(t);
  const input = await resolveTurnInput('case', root);
  assert.equal(input.source.id, 'character-assembly/step01');
  assert.equal(input.parts.length, 2, '缺少头饰形状时只用脸与头发');
  const box = await upperBodyBox(input, 200, 400);
  // Hair top 30, face 60–110 → shoulders at 110 + 0.5×50 = 135; height 105 / 0.88.
  // The hair (60–130) is wider than the face but does not widen the square.
  assert.equal(box.size, Math.ceil(105 / 0.88));
  assert.equal(box.x, Math.round(100 - box.size / 2));
  assert.equal(box.y, Math.round(30 - box.size * 0.06));
  const image = sharp(await cropUpperBody(input.color, { x: -10, y: 0, size: 50 }));
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [50, 50]);
  assert.deepEqual([...data.subarray(0, 3)], [128, 128, 128], '画布外补灰');
  assert.deepEqual([...data.subarray(30 * 3, 30 * 3 + 3)], [200, 100, 50]);
});

test('胸像的脸靠下时，裁切止于画布底边', async t => {
  const { root, task } = await fixture(t);
  await writeFile(join(task, 'part-layering/parts/face.svg'), rect(200, 400, 60, 200, 80, 150));
  const input = await resolveTurnInput('case', root);
  // Hair top 30; the shoulders would fall at 350 + 0.5×150, so it stops at 400.
  assert.equal((await upperBodyBox(input, 200, 400)).size, Math.ceil(370 / 0.88));
});

test('阴影蒙版完成时用阴影角色图', async t => {
  const { root, task } = await fixture(t);
  const shadow = join(task, 'shadow/step01_mask');
  await mkdir(shadow, { recursive: true });
  await writeFile(join(shadow, 'character-shadowed.png'), await readFile(join(task, 'character-assembly/step01/character-assembled.png')));
  assert.equal((await resolveTurnInput('case', root)).source.id, 'character-assembly/step01', '未完成的阴影不作来源');
  await writeFile(join(shadow, '.completed'), JSON.stringify({ stamp: 'shadow-1', inputs: {} }));
  const input = await resolveTurnInput('case', root);
  assert.equal(input.source.id, 'shadow/step01_mask');
  assert.equal(input.color, join(shadow, 'character-shadowed.png'));
});

test('每个视角的提示词带入动作与三张参考图', () => {
  for (const view of turnViews) {
    const prompt = viewPrompt(view, '/task');
    assert.match(prompt, /\/task\/nine-axis\/step01_turn\/upper-body\.png/);
    assert.match(prompt, new RegExp(`pink-doll/front\\.png[\\s\\S]*pink-doll/${view}\\.png`));
    assert.doesNotMatch(prompt, /\{(view|motion)\}/);
  }
  assert.match(viewPrompt('up', '/task'), /抬头/);
});

test('step01 生成五个视角并统一到上半身尺寸，完成后沿用', async t => {
  const { root, task } = await fixture(t);
  const drawn: string[] = [];
  const draw = async (view: string, output: string) => {
    drawn.push(view);
    await sharp({ create: { width: 64, height: 32, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0 } } }).png().toFile(output);
  };
  const deps = { environment: loadWorkflowEnvironment({}), draw };
  assert.match(await runWorkflow({ name: 'case', dir: root }, deps), /5 个视角/);
  const step = join(task, 'nine-axis/step01_turn'), size = (await sharp(join(step, 'upper-body.png')).metadata()).width;
  for (const view of turnViews) {
    const { data, info } = await sharp(join(step, `${view}.png`)).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [size, size, 3]);
    assert.deepEqual([...data.subarray(0, 3)], [128, 128, 128], '透明处铺灰');
  }
  const record = JSON.parse(await readFile(join(step, 'views.json'), 'utf8'));
  assert.deepEqual(Object.keys(record.views), [...turnViews]);
  await access(join(step, '.completed'));
  assert.match(await runWorkflow({ name: 'case', dir: root }, deps), /沿用/);
  assert.equal(drawn.length, 5);
});

test('任一视角失败时 step01 不完成，并列出失败的视角', async t => {
  const { root, task } = await fixture(t);
  const draw = async (view: string, output: string) => {
    if (view === 'down') throw new Error('模型拒绝');
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toFile(output);
  };
  await assert.rejects(runWorkflow({ name: 'case', dir: root }, { environment: loadWorkflowEnvironment({}), draw }), /down[\s\S]*模型拒绝/);
  await assert.rejects(access(join(task, 'nine-axis/step01_turn/.completed')));
});
