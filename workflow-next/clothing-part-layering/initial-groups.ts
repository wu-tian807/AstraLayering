import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { CodexAgents } from './agents.ts';
import { createBitmapTool } from './bitmap-tool.ts';
import { GroupStore, normalizeGroups } from './groups.ts';
import { textResult, type FunctionTool } from './function-tools.ts';
import type { InitialContext, InitialGrouping } from './layering-types.ts';

function decodeInitialGrouping(value: unknown): InitialGrouping {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('首次分组 JSON 须为对象');
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.groups) || !raw.groups.length || Object.keys(raw).some(key => !['subject', 'groups'].includes(key))) {
    throw new Error('首次分组必须包含非空的 groups 数组，且只包含组');
  }
  const groups = raw.groups.map((group: unknown) => {
    if (!group || typeof group !== 'object' || Array.isArray(group)) throw new Error('初始组必须是对象');
    const item = group as Record<string, unknown>;
    if (typeof item.name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(item.name) ||
        !Array.isArray(item.groups) || item.groups.length || Object.keys(item).some(key => !['name', 'groups', 'note'].includes(key)) ||
        (item.note !== undefined && item.note !== null && typeof item.note !== 'string')) {
      throw new Error('初始组必须使用 snake_case 名称，只拆一层，不包含 part 或制作进度');
    }
    return { id: item.name, name: item.name, ...(typeof item.note === 'string' ? { note: item.note } : {}) };
  });
  if (raw.subject !== 'other') throw new Error('纯衣服首次分组的 subject 必须为 other');
  normalizeGroups(groups);
  return { groups, subject: raw.subject };
}

export async function recognizeInitialGroups(
  context: InitialContext, agents: Pick<CodexAgents, 'run'>,
): Promise<InitialGrouping> {
  const prompt = await readFile(new URL('prompts/4-初始分组.md', import.meta.url), 'utf8');
  const store = context.store ?? await GroupStore.open(context.directory);
  const reference = resolve(context.directory, context.references.baseSubject);
  let submitted = false;
  const writeGroups: FunctionTool = {
    name: 'write_groups',
    description: '校验并保存本次运行的初始分组到 groups.json。只提交一层组；已有组时拒绝覆盖。路径与进度由程序维护，无需手工编辑 JSON 文件。',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['subject', 'groups'],
      properties: {
        subject: { type: 'string', enum: ['other'] },
        groups: { type: 'array', minItems: 1, items: {
          type: 'object', additionalProperties: false, required: ['name', 'groups', 'note'],
          properties: {
            name: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
            groups: { type: 'array', maxItems: 0, items: {} },
            note: { type: ['string', 'null'] },
          },
        } },
      },
    },
    async execute(value, signal) {
      signal.throwIfAborted();
      const result = decodeInitialGrouping(value);
      await store.update(document => {
        signal.throwIfAborted();
        if (document.groups.length) throw new Error('已有分组，不能覆盖；请继续现有进度');
        document.groups = normalizeGroups(result.groups);
        document.subject = result.subject;
        document.merge = { status: 'pending' };
      });
      submitted = true;
      return textResult({ path: store.path, ids: result.groups.map(group => group.id) });
    },
  };
  await agents.run({
    name: '首次分组识别', cwd: context.directory,
    images: [{ path: reference, description: '纯衣服参考：本次轮廓与衣片形状的标准。' }, ...(context.references.originalImage ? [{ path: context.references.originalImage, description: '原穿衣角色：只辅助判断衣物环绕身体的结构和随动关系，不是输出内容。' }] : [])],
    prompt: `${prompt}\n本次运行目录：${context.directory}\n纯衣服参考图：${reference}\n分组文件：${store.path}\n`,
    tools: [createBitmapTool(context.directory, join(context.directory, 'observations', 'initial-groups')), writeGroups],
  });
  if (!submitted) throw new Error('首次分组未通过 write_groups 保存');
  const saved = store.snapshot();
  return { subject: saved.subject, groups: saved.groups.map(({ groups, steps, ...seed }) => seed) };
}
