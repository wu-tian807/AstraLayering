import { readFile, realpath, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { toolDefinition } from '../codex/tool-config.ts';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import { normalizeGroups, walkGroups, writeAtomic } from '../part/groups.ts';
import type { GroupInput } from '../part/layering-types.ts';
import { validateOcclusionDocument, type OcclusionPlan } from '../part/occlusion-plan.ts';
import { depthPreviewPath, publishDepthPreview } from '../part/depth-preview.ts';
import type { PartLayeringInput } from './input.ts';
import { fromTaskPath, taskRootOf } from '../task-paths.ts';

type StructureGroups = { version?: 1; groups: GroupInput[] };
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}：必须为对象`);
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) throw new Error(`${path}.${extra}：不支持的字段`);
}
// Fields a saved document carries beyond these are ignored on read.
const known = (value: Record<string, unknown>, allowed: readonly string[]) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key)));
const documentFields = ['version', 'groups'], nodeFields = ['id', 'name', 'note', 'kind', 'metadata', 'allowOutsideParent', 'hiddenInReference', 'groups'];

// Agent edits are checked strictly; a saved groups.json is read with unknown fields ignored.
export function validateStructureGroups(value: unknown, strict = true): StructureGroups {
  let document = object(value, 'groups');
  if (strict) fields(document, documentFields, 'groups'); else document = known(document, documentFields);
  if (document.version !== undefined && document.version !== 1) throw new Error('groups.version：必须为 1');
  if (!Array.isArray(document.groups) || !document.groups.length) throw new Error('groups.groups：必须为非空数组');
  const ids = new Set<string>();
  function visit(values: unknown[], path: string) {
    values.forEach((value, index) => {
      const location = `${path}[${index}]`;
      let node = object(value, location);
      if (strict) fields(node, nodeFields, location); else values[index] = node = known(node, nodeFields);
      if (typeof node.id !== 'string' || !/^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(node.id)) {
        throw new Error(`${location}.id：必须为安全的部件 ID`);
      }
      if (ids.has(node.id)) throw new Error(`${location}.id：重复 ID ${node.id}`);
      ids.add(node.id);
      if (node.kind !== undefined && !['group', 'part'].includes(String(node.kind))) throw new Error(`${location}.kind：必须为 group 或 part`);
      for (const field of ['name', 'note']) {
        if (node[field] !== undefined && typeof node[field] !== 'string') throw new Error(`${location}.${field}：必须为字符串`);
      }
      if (node.metadata !== undefined) object(node.metadata, `${location}.metadata`);
      if (!Array.isArray(node.groups)) throw new Error(`${location}.groups：必须为数组`);
      if (node.kind === 'part' && node.groups.length) throw new Error(`${location}.groups：part 不能包含子节点`);
      visit(node.groups, `${location}.groups`);
    });
  }
  visit(document.groups, 'groups.groups');
  normalizeGroups(document.groups); // Share the part section's node/type contract.
  return structuredClone(document) as StructureGroups;
}

async function readStructureFile(path: string): Promise<string> {
  const info = await stat(path);
  if (!info.isFile() || !info.size) throw new Error(`文件必须为非空普通文件：${path}`);
  return readFile(path, 'utf8');
}
async function readGroups(input: PartLayeringInput) {
  return validateStructureGroups(JSON.parse(await readStructureFile(join(input.directory, 'groups.json'))), false);
}
async function readPlan(input: PartLayeringInput): Promise<Record<string, unknown>> {
  return object(JSON.parse(await readStructureFile(join(input.directory, 'occlusion.json'))), 'occlusion');
}
async function checkReferences(input: PartLayeringInput, groups: StructureGroups, plan: OcclusionPlan) {
  const leaves = walkGroups(normalizeGroups(groups.groups)).filter(({ group }) => !group.groups.length);
  const ids = new Set(leaves.map(({ group }) => group.id));
  for (const [index, row] of plan.layers.entries()) {
    if (!ids.delete(row.id)) throw new Error(`occlusion.layers[${index}].id：${row.id} 不是当前终止部件`);
  }
  if (ids.size) throw new Error(`occlusion.layers：缺少终止部件 ${[...ids].join('、')}；分组拆分或合并时请在 edit_groups 中一并提供 layers`);
  for (const { group } of leaves) {
    const path = join(input.parts, `${group.id}.svg`);
    await readStructureFile(path).catch(error => {
      throw new Error(`groups：终止部件 ${group.id} 缺少有效 SVG ${fromTaskPath(taskRootOf(input.directory), path)}`, { cause: error });
    });
  }
}

export async function validateRasterStructure(input: PartLayeringInput): Promise<void> {
  await checkReferences(input, await readGroups(input), validateOcclusionDocument(await readPlan(input)));
}

// Drawing and repairs share the same fixed upstream destination. Serialize tool
// calls across factories too, so parallel calls cannot mix the two documents.
const writes = new Map<string, Promise<unknown>>();
function serialized<T>(directory: string, change: () => Promise<T>): Promise<T> {
  const next = (writes.get(directory) ?? Promise.resolve()).catch(() => {}).then(change);
  writes.set(directory, next);
  void next.finally(() => { if (writes.get(directory) === next) writes.delete(directory); }).catch(() => {});
  return next;
}
const serialize = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

export function createStructureTools(input: PartLayeringInput): FunctionTool[] {
  return ['edit_groups', 'edit_occlusion'].map(name => ({
    ...toolDefinition(name),
    async execute(value: unknown, signal: AbortSignal) {
      signal.throwIfAborted();
      const args = structuredClone(object(value, name));
      fields(args, name === 'edit_groups' ? ['groups', 'layers'] : ['layers'], name);
      if (name === 'edit_groups' && !Array.isArray(args.groups)) throw new Error('edit_groups.groups：必须为分组树数组');
      if ((name === 'edit_occlusion' || args.layers !== undefined) && !Array.isArray(args.layers)) throw new Error(`${name}.layers：必须为深度记录数组`);
      return serialized(await realpath(input.directory), async () => {
        signal.throwIfAborted();
        const current = await readGroups(input), oldPlan = await readPlan(input);
        const groups = name === 'edit_groups' ? validateStructureGroups({ ...current, groups: args.groups }) : current;
        const leaves = (tree: StructureGroups) => walkGroups(normalizeGroups(tree.groups)).filter(({ group }) => !group.groups.length).map(({ group }) => group.id).sort();
        if (args.layers === undefined && JSON.stringify(leaves(current)) !== JSON.stringify(leaves(groups))) {
          throw new Error('edit_groups.layers：终止部件 ID 已改变，请在同一次调用中一并提供 layers');
        }
        // Version, direction and the upstream producer fingerprint are managed
        // here. The model supplies only nodes/depths and its inspection evidence.
        const plan = validateOcclusionDocument({ ...oldPlan, version: 3, layers: args.layers ?? oldPlan.layers });
        await checkReferences(input, groups, plan);
        signal.throwIfAborted();
        const groupsPath = join(input.directory, 'groups.json'), planPath = join(input.directory, 'occlusion.json');
        const planChanged = serialize(plan) !== serialize(oldPlan);
        const groupsChanged = name === 'edit_groups' && serialize(groups) !== serialize(current);
        if (planChanged) await writeAtomic(planPath, serialize(plan));
        try {
          if (groupsChanged) await writeAtomic(groupsPath, serialize(groups));
        } catch (error) {
          // A filesystem error in the second save must not leave a new depth
          // table attached to the old tree. No artwork or step facts are reset.
          if (planChanged) await writeAtomic(planPath, serialize(oldPlan));
          throw error;
        }
        let previewWarning: string | undefined;
        if (planChanged || groupsChanged) {
          try { await publishDepthPreview(input.directory, normalizeGroups(groups.groups), plan); }
          catch (error) {
            // A newly split group may not have SVG geometry yet. Do not show the
            // previous table's picture or roll back a valid structural edit.
            await rm(depthPreviewPath(input.directory), { force: true });
            previewWarning = '深度预览尚未生成：' + (error as Error).message;
          }
        }
        const root = taskRootOf(input.directory);
        return textResult({ groupsPath: fromTaskPath(root, groupsPath), occlusionPath: fromTaskPath(root, planPath), ...(previewWarning ? { previewWarning } : {}), terminalParts: plan.layers.map(row => row.id),
          depthRegions: plan.layers.reduce((count, row) => count + (row.levels?.length ?? 1), 0), validated: true });
      });
    },
  }));
}
