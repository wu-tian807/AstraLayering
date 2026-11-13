import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { profile as clothing } from '../../clothing-part-layering/profile.ts';
import type { AgentTask } from '../../shared/codex/agents.ts';
import { toolCatalog } from '../../shared/codex/tool-config.ts';
import { artifactPath, stepDraftPath } from '../../shared/part/artifact-facts.ts';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { checkParentMask, copyParentRegion, createParentRegionTool } from '../../shared/part/parent-region.ts';
import { copyDecisionPath, readCopyDecision } from '../../shared/part/parent-copy-decision.ts';
import { drawGroupOutline } from '../../shared/part/outline-agent.ts';
import { profile } from '../profile.ts';
import { promptInput } from '../../shared/tests/prompt-input.ts';
import { fixture, workingSteps } from './layering-fixture.ts';
import { GroupStore, normalizeGroups, writeAtomic } from '../../shared/part/groups.ts';

const signal = new AbortController().signal, canvas = { width: 100, height: 100 };
// Two separate blocks in one path, and a third block of its own.
const pair = (id: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g id="shape" data-group-path="${id}">` +
  '<path fill="#55b9ad" d="M10 10H40V40H10Z M60 10H90V40H60Z"/><rect fill="#55b9ad" x="10" y="60" width="80" height="30"/></g></svg>';

const maskOf = (shape: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${shape}</svg>`;
const svgOf = (shape: string) => maskOf(`<g id="parent" data-group-path="face" fill="#55b9ad">${shape}</g>`);
const raster = (svg: string) => sharp(Buffer.from(svg)).ensureAlpha().extractChannel('alpha').raw().toBuffer();

test('遮罩复制可取互不相连的独立形状，遮罩内无形状或包含全部时拒绝', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parent.svg');
  await writeFile(parent, pair('face'));
  const left = await copyParentRegion(parent, 'face/eye_left', checkParentMask(maskOf('<rect x="5" y="5" width="45" height="45"/>'), canvas), canvas);
  assert.match(left.svg, /M10 10H40V40H10Z/);
  assert.match(left.svg, /<g data-group-path="face\/eye_left" id="eye-left-outline">/);
  assert.doesNotMatch(left.svg, /data-(parent-mask|source-sha256|parent-region)/);
  assert.equal(left.needsCompletion, false);
  assert.equal(left.reason, 'whole-independent-geometry');
  const pixels = await raster(left.svg);
  assert.equal(pixels[20 * 100 + 20], 255);
  assert.equal(pixels[20 * 100 + 70], 0);
  const lower = await copyParentRegion(parent, 'face/mouth', checkParentMask(maskOf('<rect x="0" y="50" width="100" height="50"/>'), canvas), canvas);
  assert.match(lower.svg, /<rect/);
  await assert.rejects(copyParentRegion(parent, 'face/x', checkParentMask(maskOf('<rect x="45" y="45" width="10" height="10"/>'), canvas), canvas), /没有/);
  await assert.rejects(copyParentRegion(parent, 'face/x', checkParentMask(maskOf('<rect x="0" y="0" width="100" height="100"/>'), canvas), canvas), /没有裁掉/);
});

test('描边 agent 复制父组完成稿的轮廓跳过 review 与补全，改写后照常 review；服装段不提供该工具', async t => {
  assert.ok(toolCatalog(profile.toolsDirectory).names().includes('copy_parent_region'));
  assert.ok(!toolCatalog(clothing.toolsDirectory).names().includes('copy_parent_region'));

  const f = await fixture(t), events: string[] = [];
  const base = workingSteps(events, [{ id: 'face' }], { face: [{ id: 'face/eye_left', kind: 'part', note: '左眼' }, { id: 'face/rest', kind: 'part', note: '其余' }] });
  const run = async (task: AgentTask) => {
    const tool = (name: string) => task.tools!.find(entry => entry.name === name)!;
    if (task.name.includes('face/eye_left')) {
      const mask = join(f.directory, 'eye-mask.svg');
      await writeFile(mask, maskOf('<rect x="5" y="5" width="45" height="45"/>'));
      await assert.rejects(tool('copy_parent_region').execute({ region: { x: 5, y: 5, width: 45, height: 45 } }, signal), /不支持/);
      // The default mode only previews: no draft is written and the result carries an image.
      const shown = await tool('copy_parent_region').execute({ maskSvg: mask }, signal) as { contentItems: { type: string }[] };
      assert.ok(shown.contentItems.some(item => item.type === 'inputImage'));
      await assert.rejects(readFile(promptInput(task.prompt).outputSvg, 'utf8'), /ENOENT/);
      await tool('copy_parent_region').execute({ maskSvg: mask, mode: 'crop' }, signal);
    } else {
      // Starting from a copy and then rewriting it is ordinary drawing.
      const mask = join(f.directory, 'rest-mask.svg');
      await writeFile(mask, maskOf('<rect x="0" y="50" width="100" height="50"/>'));
      await tool('copy_parent_region').execute({ maskSvg: mask, mode: 'crop' }, signal);
      // Explicit rewrite invalidates the decision even with identical bytes.
      await tool('write_outline_svg').execute({ svg: await readFile(promptInput(task.prompt).outputSvg, 'utf8') }, signal);
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
  assert.equal((await raster(outline))[20 * 100 + 70], 0);
  assert.equal(await readFile(artifactPath(f.directory, 'face/eye_left', 'completion'), 'utf8'), outline);
  assert.doesNotMatch(await readFile(artifactPath(f.directory, 'face/rest', 'outline'), 'utf8'), /data-parent-mask/);
  const decision = await readCopyDecision(f.directory, 'face/eye_left');
  assert.equal(decision?.needsCompletion, false);
  assert.deepEqual(JSON.parse(await readFile(copyDecisionPath(f.directory, 'face/eye_left'), 'utf8')), {
    version: 1, kind: 'parentCopy', groupId: 'face/eye_left', detectorVersion: 1,
    needsCompletion: false, reason: 'whole-independent-geometry',
  });
  assert.equal(Object.hasOwn(decision!, 'svg'), false);
  await assert.rejects(readFile(copyDecisionPath(f.directory, 'face/rest')), /ENOENT/);
});

test('复制去掉父稿各层的旧控制属性，SVG 不再写入复制决策', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parent-copied.svg');
  await writeFile(parent, pair('face').replace('<svg ', '<svg data-parent-region="1 1 1 1" data-parent-mask="0000000000000000" ')
    .replace('<g ', '<g data-source-sha256="inherited" '));
  const cut = await copyParentRegion(parent, 'face/eye_left', checkParentMask(maskOf('<rect x="5" y="5" width="45" height="45"/>'), canvas), canvas);
  assert.doesNotMatch(cut.svg, /data-parent-region/);
  assert.doesNotMatch(cut.svg, /0000000000000000/);
  assert.doesNotMatch(cut.svg, /data-(parent-mask|source-sha256)/);
});

test('遮罩方式沿分界线裁剪相连形状，去掉父稿补全层标记，并拒绝无效遮罩', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parent-mask.svg');
  // One connected arm-like block plus a completion layer carrying the parent's marker.
  await writeFile(parent, '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">' +
    '<g data-completion-additions="v1" fill="#58b8a9" stroke="none"><path d="M10 70H40V90H10Z" fill-rule="nonzero"/></g>' +
    '<g id="arm" data-group-path="arm"><path fill="#55b9ad" d="M10 10H40V60H10Z"/><rect fill="#55b9ad" x="60" y="10" width="30" height="30"/></g></svg>');
  const mask = maskOf;
  const upper = checkParentMask(mask('<rect x="0" y="0" width="100" height="35"/>'), canvas);
  const cut = await copyParentRegion(parent, 'arm/upper_arm', upper, canvas);
  assert.match(cut.svg, /<clipPath id="arm-upper-arm-region"/);
  assert.doesNotMatch(cut.svg, /data-parent-mask/);
  assert.equal(cut.needsCompletion, true);
  assert.equal(cut.reason, 'mask-cuts-parent');
  assert.doesNotMatch(cut.svg, /data-completion-additions/);
  assert.match(cut.svg, /data-group-path="arm\/upper_arm"/);
  assert.deepEqual([cut.pieces, cut.total], [[1, 2], 3]);
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
  // A clipped outline can be the next parent's completed artwork; the inherited
  // clip is preserved and does not count as a painted shape.
  const clipped = join(f.directory, 'clipped.svg');
  await writeFile(clipped, cut.svg);
  const next = await copyParentRegion(clipped, 'arm/y', checkParentMask(mask('<rect x="0" y="0" width="50" height="100"/>'), canvas), canvas);
  assert.equal(next.total, 2);
  assert.equal(next.needsCompletion, false);
  assert.equal((await raster(next.svg))[40 * 100 + 20], 0);
  assert.equal((await raster(next.svg))[20 * 100 + 20], 255);
  await writeFile(clipped, svgOf('<use href="#parent"/>'));
  await assert.rejects(copyParentRegion(clipped, 'arm/y', upper, canvas), /<use>/);
});

test('连续形体被切开时仍跳过 review，调度补全和补全检查', async t => {
  const f = await fixture(t), events: string[] = [];
  const base = workingSteps(events, [{ id: 'face' }], { face: [{ id: 'face/upper', kind: 'part' }] });
  const run = async (task: AgentTask) => {
    const mask = join(f.directory, 'cut.svg');
    await writeFile(mask, maskOf('<rect x="0" y="0" width="100" height="50"/>'));
    await assert.rejects(task.tools!.find(tool => tool.name === 'copy_parent_region')!
      .execute({ maskSvg: mask, mode: 'crop', needsCompletion: false }, signal), /不支持/);
    await task.tools!.find(tool => tool.name === 'copy_parent_region')!.execute({ maskSvg: mask, mode: 'crop' }, signal);
    return { text: 'done', images: [] };
  };
  const adapter = createLayeringSteps({ run, createSession: () => ({ run, async close() {} }) });
  await runLayering({ ...f, groups: null, maxDepth: 2, steps: { ...base,
    drawOutline: context => context.parent ? adapter.drawOutline(context) : base.drawOutline(context) } });
  assert.ok(!events.includes('face/upper:review'));
  for (const stage of ['completion', 'check']) assert.ok(events.includes(`face/upper:${stage}`), stage);
  const decision = JSON.parse(await readFile(copyDecisionPath(f.directory, 'face/upper'), 'utf8'));
  assert.equal(decision.needsCompletion, true);
  assert.equal(decision.reason, 'mask-cuts-parent');
});

test('按填色联合形体判别：跨元素连接、独立子路径、孔洞、边缘重合和细连接', async t => {
  const f = await fixture(t), parent = join(f.directory, 'geometry.svg');
  const cases = [
    { svg: pair('face'), selection: '<rect x="10" y="10" width="30" height="30"/>', needs: false },
    { svg: svgOf('<rect x="10" y="10" width="30" height="30"/><rect x="30" y="30" width="30" height="30"/>'),
      selection: '<rect x="0" y="0" width="40" height="100"/>', needs: true },
    { svg: svgOf('<path fill-rule="evenodd" d="M10 10H50V50H10Z M20 20H40V40H20Z"/><rect x="70" y="10" width="20" height="20"/>'),
      selection: '<rect x="5" y="5" width="50" height="50"/>', needs: false, hole: true },
    { svg: svgOf('<path d="M10 10H40V40H10Z m50 0h30v30h-30z"/>'),
      selection: '<rect x="0" y="0" width="50" height="50"/>', needs: false },
    { svg: svgOf('<circle cx="25" cy="25" r="15"/><circle cx="75" cy="25" r="15"/>'),
      selection: '<rect x="0" y="0" width="50" height="50"/>', needs: false },
    { svg: svgOf('<rect x="10" y="10" width="20" height="20"/><rect x="60" y="10" width="20" height="20"/><rect x="30" y="19.9" width="30" height="0.2"/>'),
      selection: '<rect x="0" y="0" width="45" height="50"/>', needs: true },
    { svg: svgOf('<rect x="10.2" y="10.2" width="30" height="30"/><rect x="70" y="10" width="20" height="20"/>'),
      selection: '<rect x="10.2" y="10.2" width="30" height="30"/>', needs: true, uncertain: true },
  ];
  for (const [index, entry] of cases.entries()) {
    await writeFile(parent, entry.svg);
    const result = await copyParentRegion(parent, 'face/child', checkParentMask(maskOf(entry.selection), canvas), canvas);
    assert.equal(result.needsCompletion, entry.needs, `case ${index}`);
    if (entry.uncertain) assert.equal(result.reason, 'uncertain-geometry');
    if (entry.hole) assert.equal((await raster(result.svg))[30 * 100 + 30], 0);
  }
  const selection = checkParentMask(maskOf('<path fill-rule="evenodd" d="M0 0H100V100H0Z M20 20H40V40H20Z"/>'), canvas);
  assert.equal((await raster(selection.mask))[30 * 100 + 30], 0); // preview and crop share the same hole
});

test('信任本组工具记录，不回查上游指纹；兼容旧记录，缺失、损坏和跨组记录不允许跳过', async t => {
  const f = await fixture(t), parent = join(f.directory, 'parent.svg'), id = 'face/child';
  const draft = stepDraftPath(f.directory, id, 'outline'), selection = join(f.directory, 'selection.svg');
  await writeFile(parent, pair('face'));
  await writeFile(selection, maskOf('<rect x="0" y="0" width="50" height="50"/>'));
  const tool = createParentRegionTool({ directory: f.directory, parentPath: parent, reference: f.references.baseSubject, canvas, groupId: id, draft, overrides: profile.toolsDirectory });
  await tool.execute({ maskSvg: selection, mode: 'crop' }, signal);
  const path = copyDecisionPath(f.directory, id), before = await readFile(path), outline = await readFile(draft);
  assert.equal((await readCopyDecision(f.directory, id))?.needsCompletion, false);
  // A preview preserves both the existing draft and its decision.
  await tool.execute({ maskSvg: selection }, signal);
  assert.deepEqual(await readFile(path), before);
  assert.deepEqual(await readFile(draft), outline);
  // Reading the decision only needs this group's record, not the source files.
  await rm(parent); await rm(selection);
  assert.equal((await readCopyDecision(f.directory, id))?.needsCompletion, false);
  const legacy = { ...JSON.parse(before.toString()), detectorVersion: 99,
    parentSha256: 'old-parent', outlineSha256: 'old-outline', maskSha256: 'old-mask' };
  await writeFile(path, JSON.stringify(legacy));
  assert.equal((await readCopyDecision(f.directory, id))?.needsCompletion, false);
  assert.equal((await readCopyDecision(f.directory, id))?.detectorVersion, 99);
  for (const change of [{ groupId: 'face/other' }, { version: 2 }, { kind: 'drawing' },
    { needsCompletion: 'false' }, { reason: 'mask-cuts-parent' }, { reason: 'unknown' }]) {
    await writeFile(path, JSON.stringify({ ...JSON.parse(before.toString()), ...change }));
    assert.equal(await readCopyDecision(f.directory, id), undefined);
  }
  await writeFile(path, '{');
  assert.equal(await readCopyDecision(f.directory, id), undefined);
  await rm(path);
  assert.equal(await readCopyDecision(f.directory, id), undefined);
});

test('继续并发布草稿保留决策，重新绘制清除决策', async t => {
  const f = await fixture(t), id = 'face/child', parentPath = join(f.directory, 'parent.svg');
  const [parent] = normalizeGroups([{ id: 'face', groups: [{ id }] }]), group = parent.groups[0];
  parent.steps.completion = { status: 'completed', output: { path: parentPath } };
  const draft = stepDraftPath(f.directory, id, 'outline'), output = artifactPath(f.directory, id, 'outline');
  const selection = join(f.directory, 'selection.svg');
  await writeFile(parentPath, pair('face'));
  await writeFile(selection, maskOf('<rect x="0" y="0" width="50" height="50"/>'));
  await createParentRegionTool({ directory: f.directory, parentPath, reference: f.references.baseSubject, canvas, groupId: id, draft, overrides: profile.toolsDirectory })
    .execute({ maskSvg: selection, mode: 'crop' }, signal);
  const bytes = await readFile(draft), record = await readFile(copyDecisionPath(f.directory, id));
  const store = await GroupStore.open(f.directory);
  await drawGroupOutline({ ...f, store, group, parent, outputPath: output, resumeDraft: true }, { async run() {
    assert.deepEqual(await readFile(draft), bytes);
    return { text: 'done', images: [] };
  } });
  assert.deepEqual(await readFile(output), bytes);
  assert.deepEqual(await readFile(copyDecisionPath(f.directory, id)), record);
  assert.ok(await readCopyDecision(f.directory, id));
  await drawGroupOutline({ ...f, store, group, parent, outputPath: output }, { async run(task) {
    await assert.rejects(readFile(copyDecisionPath(f.directory, id)), /ENOENT/);
    await task.tools!.find(tool => tool.name === 'write_outline_svg')!.execute({ svg: bytes.toString() }, signal);
    return { text: 'done', images: [] };
  } });
  await assert.rejects(readFile(copyDecisionPath(f.directory, id)), /ENOENT/);
});

test('裁剪父稿能继续复制；普通子组不继承父组记录，缺失记录回到常规流程', async t => {
  const f = await fixture(t), events: string[] = [];
  const base = workingSteps(events, [{ id: 'face' }], {
    face: [{ id: 'face/upper' }],
    'face/upper': [{ id: 'face/upper/copy', kind: 'part' }, { id: 'face/upper/drawing', kind: 'part' }, { id: 'face/upper/missing', kind: 'part' }],
  });
  const run = async (task: AgentTask) => {
    const id = promptInput(task.prompt).group.id;
    const selection = join(f.directory, `${id.split('/').pop()}.svg`);
    await writeFile(selection, maskOf(id === 'face/upper' ? '<rect x="0" y="0" width="100" height="50"/>'
      : '<rect x="0" y="0" width="50" height="50"/>'));
    if (id.endsWith('/drawing')) {
      const parent = await readFile(artifactPath(f.directory, 'face/upper', 'completion'), 'utf8');
      await task.tools!.find(tool => tool.name === 'write_outline_svg')!.execute({ svg: parent.replaceAll('face/upper', id) }, signal);
    } else {
      await task.tools!.find(tool => tool.name === 'copy_parent_region')!.execute({ maskSvg: selection, mode: 'crop' }, signal);
      if (id.endsWith('/missing')) await rm(copyDecisionPath(f.directory, id));
    }
    return { text: 'done', images: [] };
  };
  const adapter = createLayeringSteps({ run, createSession: () => ({ run, async close() {} }) });
  const steps = { ...base, async drawOutline(context: Parameters<typeof base.drawOutline>[0]) {
    if (!context.parent) { await writeAtomic(context.outputPath, pair(context.group.id)); return { status: 'completed' as const, output: { path: context.outputPath } }; }
    return adapter.drawOutline(context);
  } };
  await runLayering({ ...f, groups: null, maxDepth: 3, steps });
  for (const id of ['face/upper', 'face/upper/copy']) {
    for (const stage of ['review', 'completion', 'check']) assert.ok(!events.includes(`${id}:${stage}`));
  }
  for (const id of ['face/upper/drawing', 'face/upper/missing']) {
    for (const stage of ['review', 'completion', 'check']) assert.ok(events.includes(`${id}:${stage}`));
    await assert.rejects(readFile(copyDecisionPath(f.directory, id)), /ENOENT/);
  }
  const child = JSON.parse(await readFile(copyDecisionPath(f.directory, 'face/upper/copy'), 'utf8'));
  assert.equal(child.groupId, 'face/upper/copy');
  assert.notEqual(child.groupId, (await readCopyDecision(f.directory, 'face/upper'))?.groupId);
  assert.equal(child.needsCompletion, false);
});

test('独立复制经过实际去重修改后，进入补全而不还原被删的轮廓', async t => {
  const f = await fixture(t), events: string[] = [];
  const base = workingSteps(events, [{ id: 'face' }], { face: [{ id: 'face/copy', kind: 'part' }, { id: 'face/other', kind: 'part' }] });
  const run = async (task: AgentTask) => {
    const selection = join(f.directory, 'selection.svg');
    await writeFile(selection, maskOf('<rect x="0" y="0" width="50" height="50"/>'));
    await task.tools!.find(tool => tool.name === 'copy_parent_region')!.execute({ maskSvg: selection, mode: 'crop' }, signal);
    return { text: 'done', images: [] };
  };
  const adapter = createLayeringSteps({ run, createSession: () => ({ run, async close() {} }) });
  await runLayering({ ...f, groups: null, maxDepth: 2, steps: { ...base,
    async drawOutline(context) {
      if (context.group.id === 'face/copy') return adapter.drawOutline(context);
      if (!context.parent) { await writeAtomic(context.outputPath, pair('face')); return { status: 'completed', output: { path: context.outputPath } }; }
      return base.drawOutline(context);
    },
    async reduceOutlines(context) {
      const copy = context.entries.find(entry => entry.group.id === 'face/copy')!;
      await writeAtomic(copy.outputPath, svgOf('<rect x="10" y="10" width="10" height="30"/>').replaceAll('data-group-path="face"', 'data-group-path="face/copy"'));
      return { status: 'completed', output: { changed: [{ groupId: copy.group.id, path: copy.outputPath }] } };
    },
  } });
  assert.ok(!events.includes('face/copy:review'));
  for (const stage of ['completion', 'check']) assert.ok(events.includes(`face/copy:${stage}`));
  const outline = await readFile(artifactPath(f.directory, 'face/copy', 'outline'), 'utf8');
  const completed = await readFile(artifactPath(f.directory, 'face/copy', 'completion'), 'utf8');
  assert.equal((await raster(outline))[20 * 100 + 30], 255);
  assert.equal((await raster(completed))[20 * 100 + 30], 0);
});
