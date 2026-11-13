import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { profile as clothing } from '../../clothing-part-layering/profile.ts';
import type { AgentTask } from '../../shared/codex/agents.ts';
import { toolCatalog } from '../../shared/codex/tool-config.ts';
import { artifactPath } from '../../shared/part/artifact-facts.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { checkParentMask, copyParentRegion } from '../../shared/part/parent-region.ts';
import { profile } from '../profile.ts';
import { promptInput } from '../../shared/tests/prompt-input.ts';
import { fixture, workingSteps } from './layering-fixture.ts';
import { writeAtomic } from '../../shared/part/groups.ts';

const signal = new AbortController().signal, canvas = { width: 100, height: 100 };
// Two separate blocks in one path, and a third block of its own.
const pair = (id: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g id="shape" data-group-path="${id}">` +
  '<path fill="#55b9ad" d="M10 10H40V40H10Z M60 10H90V40H60Z"/><rect fill="#55b9ad" x="10" y="60" width="80" height="30"/></g></svg>';

test('框选复制只取整块落在框内的独立形状，切线、相连、空框与全选都会拒绝', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parent.svg');
  await writeFile(parent, pair('face'));
  const left = await copyParentRegion(parent, 'face/eye_left', { x: 5, y: 5, width: 45, height: 45 }, canvas);
  assert.deepEqual([left.pieces, left.total], [[0], 3]);
  assert.match(left.svg, /d="M10 10H40V40H10Z"/);
  assert.doesNotMatch(left.svg, /M60|<rect/);
  assert.match(left.svg, /<g data-group-path="face\/eye_left" id="eye-left-outline">/);
  assert.match(left.svg, /data-parent-region="5 5 45 45"/);
  const lower = await copyParentRegion(parent, 'face/mouth', { x: 0, y: 50, width: 100, height: 50 }, canvas);
  assert.match(lower.svg, /<rect/);
  assert.doesNotMatch(lower.svg, /<path/);
  await assert.rejects(copyParentRegion(parent, 'face/x', { x: 20, y: 5, width: 30, height: 45 }, canvas), /切过/);
  await assert.rejects(copyParentRegion(parent, 'face/x', { x: 45, y: 45, width: 10, height: 10 }, canvas), /没有/);
  await assert.rejects(copyParentRegion(parent, 'face/x', { x: 0, y: 0, width: 100, height: 100 }, canvas), /全部/);
  await writeFile(parent, pair('face').replace('<rect', '<rect fill="#55b9ad" x="35" y="30" width="30" height="40"/><rect'));
  await assert.rejects(copyParentRegion(parent, 'face/x', { x: 5, y: 5, width: 45, height: 45 }, canvas), /切过|切分/);
});

test('描边 agent 复制父组完成稿的轮廓跳过 review 与补全，改写后照常 review；服装段不提供该工具', async t => {
  assert.ok(toolCatalog(profile.toolsDirectory).names().includes('copy_parent_region'));
  assert.ok(!toolCatalog(clothing.toolsDirectory).names().includes('copy_parent_region'));

  const f = await fixture(t), events: string[] = [];
  const base = workingSteps(events, [{ id: 'face' }], { face: [{ id: 'face/eye_left', kind: 'part', note: '左眼' }, { id: 'face/rest', kind: 'part', note: '其余' }] });
  const run = async (task: AgentTask) => {
    const tool = (name: string) => task.tools!.find(entry => entry.name === name)!;
    if (task.name.includes('face/eye_left')) {
      await assert.rejects(tool('copy_parent_region').execute({ region: { x: 20, y: 5, width: 30, height: 45 } }, signal), /切过/);
      await tool('copy_parent_region').execute({ region: { x: 5, y: 5, width: 45, height: 45 } }, signal);
    } else {
      // Starting from a copy and then rewriting it is ordinary drawing.
      await tool('copy_parent_region').execute({ region: { x: 0, y: 50, width: 100, height: 50 } }, signal);
      await tool('write_outline_svg').execute({ svg: (await readFile(promptInput(task.prompt).outputSvg, 'utf8')).replace('#55b9ad', '#55b9ae') }, signal);
    }
    return { text: 'done', images: [] };
  };
  const adapter = createLayeringSteps({ run, createSession: () => ({ run, async close() {} }) });
  const steps = { ...base, async drawOutline(context: Parameters<typeof base.drawOutline>[0]) {
    if (context.group.id === 'face') {
      events.push('face:outline'); await writeAtomic(context.outputPath, pair('face'));
      return { status: 'completed' as const, output: { path: context.outputPath } };
    }
    events.push(`${context.group.id}:outline`);
    return adapter.drawOutline(context);
  } };
  await runLayering({ ...f, groups: null, steps, maxDepth: 2 });
  for (const stage of ['review', 'completion', 'check']) assert.ok(!events.includes(`face/eye_left:${stage}`), stage);
  for (const stage of ['outline', 'review', 'completion', 'check']) assert.ok(events.includes(`face/rest:${stage}`), stage);
  const outline = await readFile(artifactPath(f.directory, 'face/eye_left', 'outline'), 'utf8');
  assert.match(outline, /data-group-path="face\/eye_left"/);
  assert.doesNotMatch(outline, /M60|<rect/);
  assert.equal(await readFile(artifactPath(f.directory, 'face/eye_left', 'completion'), 'utf8'), outline);
  assert.doesNotMatch(await readFile(artifactPath(f.directory, 'face/rest', 'outline'), 'utf8'), /data-parent-region/);
});

test('遮罩方式沿分界线裁剪相连形状，去掉父稿补全层标记，并拒绝无效遮罩', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parent-mask.svg');
  // One connected arm-like block plus a completion layer carrying the parent's marker.
  await writeFile(parent, '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">' +
    '<g data-completion-additions="v1" fill="#58b8a9" stroke="none"><path d="M10 70H40V90H10Z" fill-rule="nonzero"/></g>' +
    '<g id="arm" data-group-path="arm"><path fill="#55b9ad" d="M10 10H40V60H10Z"/><rect fill="#55b9ad" x="60" y="10" width="30" height="30"/></g></svg>');
  const mask = (shape: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${shape}</svg>`;
  const upper = checkParentMask(mask('<rect x="0" y="0" width="100" height="35"/>'), canvas);
  const cut = await copyParentRegion(parent, 'arm/upper_arm', upper, canvas);
  assert.match(cut.svg, /<clipPath id="arm-upper-arm-region"/);
  assert.match(cut.svg, /data-parent-mask="[0-9a-f]{16}"/);
  assert.doesNotMatch(cut.svg, /data-completion-additions/);
  assert.match(cut.svg, /data-group-path="arm\/upper_arm"/);
  assert.deepEqual([cut.pieces, cut.total], [[], 3]);
  // The completion layer lies wholly outside the mask and is dropped.
  assert.doesNotMatch(cut.svg, /M10 70/);
  // The lower side of the same connected block comes from the complementary mask.
  const lower = await copyParentRegion(parent, 'arm/forearm', checkParentMask(mask('<path d="M0 35H100V100H0Z"/>'), canvas), canvas);
  assert.match(lower.svg, /M10 70/);
  await assert.rejects(copyParentRegion(parent, 'arm/x', checkParentMask(mask('<rect x="0" y="0" width="100" height="100"/>'), canvas), canvas), /没有裁掉/);
  await assert.rejects(copyParentRegion(parent, 'arm/x', checkParentMask(mask('<rect x="45" y="65" width="10" height="10"/>'), canvas), canvas), /没有/);
  assert.throws(() => checkParentMask('<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="5" height="5"/></svg>', canvas), /画布/);
  assert.throws(() => checkParentMask(mask('<path d="M0 0H10V10"/>'), canvas), /闭合/);
  assert.throws(() => checkParentMask(mask('<line x1="0" y1="0" x2="5" y2="5"/>'), canvas), /<line>/);
  assert.throws(() => checkParentMask(mask('<g transform="scale(2)"><rect width="5" height="5"/></g>'), canvas), /transform/);
  // A clipped outline cannot itself be the parent of another copy.
  const clipped = join(f.directory, 'clipped.svg');
  await writeFile(clipped, cut.svg);
  await assert.rejects(copyParentRegion(clipped, 'arm/y', { x: 0, y: 0, width: 50, height: 50 }, canvas), /defs/);
  // Marker stripping also applies to box copies.
  const boxed = await copyParentRegion(parent, 'arm/hand', { x: 5, y: 65, width: 40, height: 30 }, canvas);
  assert.doesNotMatch(boxed.svg, /data-completion-additions/);
});
