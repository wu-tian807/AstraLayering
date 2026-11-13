import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { profile as clothing } from '../../clothing-part-layering/profile.ts';
import { toolCatalog } from '../../shared/codex/tool-config.ts';
import { artifactPath } from '../../shared/part/artifact-facts.ts';
import { decodeChildren } from '../../shared/part/children-agent.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { checkParentMask, copiedOutlinePath, copyParentRegion } from '../../shared/part/parent-region.ts';
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

test('复制的子节点跳过描边与 review，相邻子节点照常描边，补全照常运行；服装段不提供该工具', async t => {
  assert.ok(toolCatalog(profile.toolsDirectory).names().includes('copy_parent_region'));
  assert.ok(!toolCatalog(clothing.toolsDirectory).names().includes('copy_parent_region'));
  assert.throws(() => decodeChildren('face', { children: [{ name: 'a', kind: 'part', note: 'n', hiddenInReference: true },
    { name: 'b', kind: 'part', note: 'n' }], note: 'n' }, new Map([['a', { x: 0, y: 0, width: 1, height: 1 }]])));

  const f = await fixture(t), events: string[] = [];
  const base = workingSteps(events, [{ id: 'face' }]);
  const adapter = createLayeringSteps({ async run(task) {
    assert.ok(task.tools!.some(tool => tool.name === 'copy_parent_region'));
    const tool = (name: string) => task.tools!.find(entry => entry.name === name)!;
    const input = promptInput(task.prompt);
    await tool('preview_svg').execute({ path: input.sourceSvg, mode: 'svg' }, signal);
    await tool('preview_svg').execute({ path: input.sourceSvg, mode: 'blend' }, signal);
    await assert.rejects(tool('copy_parent_region').execute({ name: 'eye_left', region: { x: 20, y: 5, width: 30, height: 45 } }, signal), /切过/);
    await tool('copy_parent_region').execute({ name: 'eye_left', region: { x: 5, y: 5, width: 45, height: 45 } }, signal);
    await assert.rejects(tool('copy_parent_region').execute({ name: 'other', region: { x: 0, y: 0, width: 50, height: 50 } }, signal), /重叠/);
    await tool('submit_children').execute({ children: [{ name: 'eye_left', kind: 'part', note: '左眼' },
      { name: 'rest', kind: 'part', note: '其余' }], note: '左眼独立' }, signal);
    return { text: 'done', images: [] };
  } });
  const steps = { ...base, splitChildren: adapter.splitChildren, async drawOutline(context: Parameters<typeof base.drawOutline>[0]) {
    if (context.group.id !== 'face') return base.drawOutline(context);
    events.push('face:outline'); await writeAtomic(context.outputPath, pair('face'));
    return { status: 'completed' as const, output: { path: context.outputPath } };
  } };
  await runLayering({ ...f, groups: null, steps, maxDepth: 2 });
  assert.ok(!events.includes('face/eye_left:outline') && !events.includes('face/eye_left:review'));
  assert.ok(events.includes('face/rest:outline') && events.includes('face/eye_left:completion'));
  const outline = await readFile(artifactPath(f.directory, 'face/eye_left', 'outline'), 'utf8');
  assert.match(outline, /data-group-path="face\/eye_left"/);
  assert.doesNotMatch(outline, /M60|<rect/);
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
  assert.throws(() => decodeChildren('arm', { children: [{ name: 'upper_arm', kind: 'part', note: 'n', hiddenInReference: true }, { name: 'forearm', kind: 'part', note: 'n' }], note: 'n' },
    new Map([['upper_arm', upper]])), /hiddenInReference/);
  assert.equal(copiedOutlinePath(f.directory, 'arm/upper_arm'), join(f.directory, 'observations', 'children', 'arm', 'copy-upper_arm.svg'));
});
