import { groupStepId } from './part-steps.ts';
import { partStep } from '../agents/models.ts';
import { checkedTurn, missingSubmit } from '../codex/checked-turn.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { partProfile } from './profile.ts';
import { readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { CodexAgents } from '../codex/agents.ts';
import { createBitmapTool } from './bitmap-tool.ts';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import { groupValues, partKnowledge } from './group-prompts.ts';
import { normalizeGroups } from './groups.ts';
import type { ChildrenAnalysis, GroupContext, GroupSeed, SvgArtifact } from './layering-types.ts';
import { createSvgPreviewTool, type SvgObservation } from './svg-tools.ts';
import { taskRootOf } from '../task-paths.ts';


export function decodeChildren(parentId: string, value: unknown): ChildrenAnalysis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('拆分结果必须是对象');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !['children', 'note'].includes(key)) || !Array.isArray(raw.children) || raw.children.length > 64 ||
      typeof raw.note !== 'string' || !raw.note.trim()) throw new Error('须提交直属 children 和拆分或终止依据 note');
  const groups: GroupSeed[] = raw.children.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('子节点必须是对象');
    const child = item as Record<string, unknown>;
    if (Object.keys(child).some(key => !['name', 'kind', 'note', 'allowOutsideParent', 'hiddenInReference'].includes(key)) ||
        typeof child.name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(child.name) ||
        (child.kind !== 'group' && child.kind !== 'part') || typeof child.note !== 'string' || !child.note.trim()) {
      throw new Error('子节点须包含 snake_case name、group/part kind 和具体范围及独立性 note，不提交子树或进度');
    }
    return { id: `${parentId}/${child.name}`, name: child.name, kind: child.kind, note: child.note,
      ...(child.allowOutsideParent !== undefined ? { allowOutsideParent: child.allowOutsideParent as boolean } : {}),
      ...(child.hiddenInReference !== undefined ? { hiddenInReference: child.hiddenInReference as boolean } : {}) };
  });
  normalizeGroups(groups);
  if (groups.length === 1 && groups[0].kind === 'part') throw new Error('不要用 group 包装唯一 part；当前完整形体已不可再拆时提交空 children，并说明终止依据');
  return { groups, note: raw.note };
}

export async function analyzeChildren(context: GroupContext & { completed: SvgArtifact }, agents: Pick<CodexAgents, 'run'>): Promise<ChildrenAnalysis> {
  const profile = partProfile(context);
  if (context.group.kind === 'part') throw new Error('part 不调用子组分析');
  const reference = resolve(context.directory, context.references.baseSubject);
  const sourceSvg = await realpath(context.completed.path), source = await readFile(sourceSvg);
  const meta = await sharp(reference).metadata();
  const canvas = { width: meta.autoOrient.width, height: meta.autoOrient.height };
  const knowledge = partKnowledge(profile, 'children');
  const observations: SvgObservation[] = [];
  const directory = join(context.directory, 'observations', 'children', context.group.id);
  let submitted: ChildrenAnalysis | undefined;
  async function verifySource() {
    if (!(await readFile(sourceSvg)).equals(source)) throw new Error('子组分析修改了父组完成 SVG');
  }
  const submit: FunctionTool = {
    ...toolDefinition('submit_children'),
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
  const root = taskRootOf(context.directory);
  return checkedTurn({ agents, records: join(context.directory, groupStepId(context.group.id, 'children'), 'checks'),
    task: { step: partStep(partProfile(context).id, 'children'), name: `直属结构拆分-${context.group.id}`, cwd: context.directory, outputDirectory: join(context.directory, groupStepId(context.group.id, 'children')),
      tools: knowledge.tools('main', [createBitmapTool(context.directory, directory), createSvgPreviewTool({ directory: context.directory, reference, canvas,
        observationDirectory: directory, observed: entry => observations.push(entry) }), submit]),
      prompt: knowledge.render('main', {
        ...groupValues(context.group.id, canvas),
      }, { taskRoot: root, group: context.group.id }) },
    check: async () => {
      await verifySource();
      if (!submitted) throw missingSubmit('submit_children', '子组分析未通过 submit_children 提交');
      return submitted;
    } });
}
