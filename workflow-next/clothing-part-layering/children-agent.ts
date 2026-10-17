import { readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { CodexAgents } from './agents.ts';
import { createBitmapTool } from './bitmap-tool.ts';
import { textResult, type FunctionTool } from './function-tools.ts';
import { readGroupPrompt, readGroupReferences } from './group-prompts.ts';
import { normalizeGroups } from './groups.ts';
import type { ChildrenAnalysis, GroupContext, GroupSeed, SvgArtifact } from './layering-types.ts';
import { createSvgPreviewTool, type SvgObservation } from './svg-tools.ts';

const rulesPath = fileURLToPath(new URL('prompts/10-拆分操作约定.md', import.meta.url));

export function decodeChildren(parentId: string, value: unknown): ChildrenAnalysis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('拆分结果必须是对象');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !['children', 'note'].includes(key)) || !Array.isArray(raw.children) || raw.children.length > 64 ||
      typeof raw.note !== 'string' || !raw.note.trim()) throw new Error('须提交直属 children 和拆分或终止依据 note');
  const groups: GroupSeed[] = raw.children.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('子节点必须是对象');
    const child = item as Record<string, unknown>;
    if (Object.keys(child).some(key => !['name', 'kind', 'note'].includes(key)) ||
        typeof child.name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(child.name) ||
        (child.kind !== 'group' && child.kind !== 'part') || typeof child.note !== 'string' || !child.note.trim()) {
      throw new Error('子节点须包含 snake_case name、group/part kind 和具体范围及独立性 note，不提交子树或进度');
    }
    return { id: `${parentId}/${child.name}`, name: child.name, kind: child.kind, note: child.note };
  });
  normalizeGroups(groups);
  if (groups.length === 1 && groups[0].kind === 'part') throw new Error('不要用 group 包装唯一 part；当前完整形体已不可再拆时提交空 children，并说明终止依据');
  return { groups, note: raw.note };
}

export async function analyzeChildren(context: GroupContext & { completed: SvgArtifact }, agents: Pick<CodexAgents, 'run'>,
  promptDirectory?: string): Promise<ChildrenAnalysis> {
  if (context.group.kind === 'part') throw new Error('part 不调用子组分析');
  const reference = resolve(context.directory, context.references.baseSubject);
  const sourceSvg = await realpath(context.completed.path), source = await readFile(sourceSvg);
  const meta = await sharp(reference).metadata();
  const canvas = { width: meta.autoOrient.width, height: meta.autoOrient.height };
  const prompt = await readGroupPrompt(context.group.id, 'children', promptDirectory);
  const references = [...await readGroupReferences(prompt.groupDirectory, 'children'), ...(context.references.originalImage ? [{ path: context.references.originalImage, description: '原穿衣角色：用于辨认衣物与身体的穿插和随动，衣片形状以纯衣服图为准。' }] : [])];
  const rules = await readFile(rulesPath, 'utf8');
  if (!rules.trim()) throw new Error('拆分操作约定提示词为空');
  const observations: SvgObservation[] = [];
  const directory = join(context.directory, 'observations', 'children', context.group.id);
  let submitted: ChildrenAnalysis | undefined;
  async function verifySource() {
    if (!(await readFile(sourceSvg)).equals(source)) throw new Error('子组分析修改了父组完成 SVG');
  }
  const submit: FunctionTool = {
    name: 'submit_children', description: '提交当前节点的全部直属子节点，程序生成完整 ID 并保存。group 还需递归，part 完成制作后终止。当前节点本身已是最终单元时 children 为空并说明依据。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['children', 'note'], properties: {
      children: { type: 'array', maxItems: 64, items: { type: 'object', additionalProperties: false, required: ['name', 'kind', 'note'], properties: {
        name: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' }, kind: { type: 'string', enum: ['group', 'part'] }, note: { type: 'string', minLength: 1 },
      } } }, note: { type: 'string', minLength: 1 },
    } },
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('子组分析已提交');
      await verifySource();
      const result = decodeChildren(context.group.id, value);
      if (!observations.some(entry => entry.source === sourceSvg && entry.mode === 'blend') ||
          !observations.some(entry => entry.source === sourceSvg && entry.mode === 'svg')) throw new Error('提交前须查看当前父组完成稿的 blend 与独显');
      submitted = result;
      return textResult({ ids: result.groups.map(group => group.id), terminal: result.groups.length === 0, note: result.note });
    },
  };
  await agents.run({ name: `直属结构拆分-${context.group.id}`, cwd: context.directory, sandboxMode: 'read-only', imageGeneration: false,
    images: [{ path: reference, description: '纯衣服参考；结合父组完成轮廓分析直属衣片。' }, ...references],
    tools: [createBitmapTool(context.directory, directory, references.map(image => image.path)), createSvgPreviewTool({ directory: context.directory, reference, canvas,
      observationDirectory: directory, observed: entry => observations.push(entry) }), submit],
    prompt: `${prompt.text}\n提示词来源：${prompt.path}\n\n【本次输入】\n${JSON.stringify({
      group: { id: context.group.id, name: context.group.name, kind: context.group.kind ?? 'group', note: context.group.note },
      sourceSvg, reference, additionalReferences: references, canvas, parentGroup: context.parent?.id ?? null,
    }, null, 2)}\n\n【固定范围与操作约定】\n${rules}\n固定约定提示词来源：${rulesPath}\n`,
  });
  await verifySource();
  if (!submitted) throw new Error('子组分析未通过 submit_children 提交');
  return submitted;
}
