import { profile } from '../profile.ts';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { createLayeringSteps } from '../../shared/part/layering-steps.ts';
import { runLayering } from '../../shared/part/layering.ts';
import { partKnowledge } from '../../shared/part/group-prompts.ts';
import { walkGroups, writeAtomic } from '../../shared/part/groups.ts';
import { fixture, workingSteps } from './layering-fixture.ts';
import { promptInput } from '../../shared/tests/prompt-input.ts';

const signal = new AbortController().signal;
test('clothing prompt lookup is local and has no inherited body-specific prior', async () => {
  const children = partKnowledge(profile, 'children');
  assert.ok(children.files('main', 'body')[0].endsWith('knowledge/clothing-part-layering/step12_children/prompts/10-直属结构拆分.md'));
  assert.ok(children.render('main', {}, { taskRoot: '/task', group: 'body' }).includes('同动整体仍可终止为一个 part'));
  await assert.rejects(readdir(join(children.directory, 'prompts', 'groups')), { code: 'ENOENT' });
});

test('initial groups receive both clothing and clothed-character references', async t => {
  const f = await fixture(t);
  // The clothed character is the upstream simplified subject at its fixed task path.
  const refs = { ...f.references, originalImage: join(dirname(f.directory), 'part-layering/references/simplified-subject.png') };
  const adapter = createLayeringSteps({ async run(task) {
    for (const path of [refs.baseSubject, refs.originalImage]) assert.ok(task.prompt.includes(`参考图绝对路径：${path}`));
    const tool = task.tools!.find(tool => tool.name === 'write_groups')!;
    const groups = [{ name: 'coat', groups: [], note: '整件衣物；按控制和穿插需要继续拆分' }];
    await tool.execute({ groups }, signal);
    return { text: 'saved', images: [] };
  } });
  const result = await adapter.initialGroups({ ...f, references: refs });
  assert.equal(result.status, 'completed');
  const tree = JSON.parse(await readFile(join(f.directory, 'step08_initial/groups.json'), 'utf8'));
  assert.deepEqual(tree.groups.map((group: { id: string }) => group.id), ['coat']);
});

test('wrapping garments can become distinct front/back parts even when they move together', async t => {
  const f = await fixture(t), events: string[] = [];
  // The clothed character is the upstream simplified subject at its fixed task path.
  const refs = { ...f.references, originalImage: join(dirname(f.directory), 'part-layering/references/simplified-subject.png') };
  const adapter = createLayeringSteps({ async run(task) {
    const input = promptInput(task.prompt);
    assert.equal(input.additionalReferences[0].path, refs.originalImage);
    const preview = task.tools!.find(tool => tool.name === 'preview_svg')!;
    await preview.execute({ path: input.sourceSvg, mode: 'svg' }, signal);
    await preview.execute({ path: input.sourceSvg, mode: 'blend' }, signal);
    await task.tools!.find(tool => tool.name === 'submit_children')!.execute({
      children: [
        { name: 'back', kind: 'part', note: '环绕结构后片；与前片同动，但处于被夹部件后方' },
        { name: 'front', kind: 'part', note: '环绕结构前片；与后片同动，但须为独立绘画层' },
      ], note: '一层不能满足穿插，因此沿真实边界分为两片',
    }, signal);
    return { text: 'done', images: [] };
  } });
  const steps = { ...workingSteps(events, [{ id: 'collar', note: '随躯干运动，但需要容纳颈部穿过' }]), splitChildren: adapter.splitChildren };
  const result = await runLayering({ ...f, references: refs, groups: null, steps });
  assert.equal(result.status, 'completed');
  const leaves = walkGroups(result.groups).filter(({ group }) => !group.groups.length);
  assert.deepEqual(leaves.map(({ group }) => group.id), ['collar/back', 'collar/front']);
  assert.ok(leaves.every(({ group }) => group.kind === 'part' && group.steps.children.status === 'completed'));
  for (const { group } of leaves) await readFile(join(f.directory, 'parts', `${group.id}.svg`));
  const depth = JSON.parse(await readFile(join(f.directory, 'occlusion.json'), 'utf8'));
  assert.deepEqual(depth.layers.map((row: { id: string }) => row.id), ['collar/back', 'collar/front']);
  const before = await readFile(join(f.directory, 'groups.json'));
  await runLayering({ ...f, references: refs, groups: null, steps: { ...steps, splitChildren: async () => assert.fail('must resume saved splitting') } });
  assert.deepEqual(await readFile(join(f.directory, 'groups.json')), before);
});
