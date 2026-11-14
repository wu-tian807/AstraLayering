import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promptInput } from './prompt-input.ts';

test('输入解析在 LF、CRLF 和混合换行下保留路径、节点及列表', async t => {
  const root = await mkdtemp(join(tmpdir(), 'prompt-input-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const groups = join(root, 'groups.json'), output = join(root, 'outline.draft.svg');
  const reference = join(root, 'reference.png');
  const group = { id: 'face/eye', kind: 'part', note: 'fixture eye' };
  await writeFile(groups, JSON.stringify({ groups: [{ id: 'face', groups: [group] }] }));
  const lines = [
    '【本次输入】',
    '{',
    '  "canvas": { "width": 24, "height": 32 }',
    '}',
    `groups：${groups}`,
    'group：groups 中 id 为 face/eye 的节点；kind 省略时为 group',
    'parentGroup：face/eye 去掉最后一段 /<名称> 后的 ID；不含 / 时为 null',
    `outputSvg：${output}`,
    'round：2',
    'references：',
    `- ${reference}：fixture reference`,
    '',
    'outside：not an input',
  ];
  const expected = { canvas: { width: 24, height: 32 }, groups, group, parentGroup: 'face',
    outputSvg: output, round: '2', references: [{ path: reference, description: 'fixture reference' }] };
  const variants = [lines.join('\n'), lines.join('\r\n'),
    lines.map((line, i) => line + (i % 2 ? '\r\n' : '\n')).join('')];
  for (const prompt of variants) assert.deepEqual(promptInput(prompt), expected);
});
