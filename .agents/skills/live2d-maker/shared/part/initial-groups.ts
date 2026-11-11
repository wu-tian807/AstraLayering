import { partStep } from '../agents/models.ts';
import { checkedTurn, missingSubmit } from '../codex/checked-turn.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { partProfile } from './profile.ts';
import { join } from 'node:path';
import type { CodexAgents } from '../codex/agents.ts';
import { createBitmapTool } from './bitmap-tool.ts';
import { partKnowledge } from './group-prompts.ts';
import { normalizeGroups, writeAtomic } from './groups.ts';
import { readInitialGroups } from './part-steps.ts';
import { partSteps } from '../step-paths.js';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import type { InitialContext, InitialGrouping } from './layering-types.ts';
import { taskRootOf, toAgentPath } from '../task-paths.ts';

function decodeInitialGrouping(value: unknown): InitialGrouping {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('首次分组 JSON 须为对象');
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.groups) || !raw.groups.length || Object.keys(raw).some(key => key !== 'groups')) {
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
  normalizeGroups(groups);
  return { groups };
}

export async function recognizeInitialGroups(
  context: InitialContext, agents: Pick<CodexAgents, 'run'>,
): Promise<InitialGrouping> {
  const profile = partProfile(context);
  const knowledge = partKnowledge(profile, 'initial');
  // The tool writes the step output directly, so a turn that fails after saving
  // continues from the saved grouping instead of asking again.
  const path = join(context.directory, partSteps.initial, 'groups.json');
  const root = taskRootOf(context.directory), task = (path: string) => toAgentPath(root, path);
  let submitted = false;
  const writeGroups: FunctionTool = {
    ...toolDefinition('write_groups', profile.toolsDirectory),
    async execute(value, signal) {
      signal.throwIfAborted();
      const result = decodeInitialGrouping(value);
      if (submitted) throw new Error('已有分组，不能覆盖；请继续现有进度');
      normalizeGroups(result.groups);
      signal.throwIfAborted();
      await writeAtomic(path, JSON.stringify(result, null, 2) + '\n');
      submitted = true;
      return textResult({ path: await task(path), ids: result.groups.map(group => group.id) });
    },
  };
  return checkedTurn({ agents, records: join(context.directory, partSteps.initial, 'checks'),
    task: { step: partStep(partProfile(context).id, 'initial_groups'),
      name: '首次分组识别', cwd: context.directory,
      prompt: knowledge.render('main', {}, { taskRoot: root }),
      tools: knowledge.tools('main', [createBitmapTool(context.directory, join(context.directory, 'observations', 'initial-groups')), writeGroups]) },
    check: () => {
      if (!submitted) throw missingSubmit('write_groups', '首次分组未通过 write_groups 保存');
      return readInitialGroups(context.directory);
    } });
}
