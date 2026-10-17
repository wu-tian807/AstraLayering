import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactPath, readOptional, svgHash } from './artifact-facts.ts';
import { walkGroups } from './groups.ts';
import type { OcclusionContext } from './layering-types.ts';

export const occlusionPromptPath = fileURLToPath(new URL('prompts/11-遮挡层级规划.md', import.meta.url));
export const occlusionPath = (directory: string) => join(directory, 'occlusion.json');
export type OcclusionLayer = {
  id: string;
  level: number;
  note: string;
  check: { passed: true; note: string };
};
export type OcclusionPlan = {
  version: 2;
  direction: 'back-to-front';
  sourceHash: string;
  layers: OcclusionLayer[];
};
export const terminalParts = (context: OcclusionContext) => walkGroups(context.groups).filter(({ group }) => !group.groups.length);

// 层级是独立的最后一步：绑定语义、两类轮廓、参考、已有预览及提示词，不改变上游事实。
export async function occlusionSourceHash(context: OcclusionContext): Promise<string> {
  const files = [resolve(context.directory, context.references.baseSubject), resolve(context.directory, context.preview.path), occlusionPromptPath];
  const inputs = [];
  for (const { group, parent } of walkGroups(context.groups)) {
    inputs.push({ id: group.id, parent: parent?.id, kind: group.kind, name: group.name, note: group.note, metadata: group.metadata,
      children: group.groups.map(child => child.id) });
    if (!group.groups.length) files.push(artifactPath(context.directory, group.id, 'reduction'), artifactPath(context.directory, group.id, 'completion'));
  }
  const hashes = await Promise.all(files.map(async path => ({ path: path === occlusionPromptPath ? 'planning-prompt' : relative(context.directory, path),
    hash: createHash('sha256').update(await readFile(path)).digest('hex') })));
  const tree = await readOptional(join(context.directory, 'groups.json'));
  if (tree) hashes.push({ path: 'groups.json', hash: svgHash(tree) });
  return svgHash(JSON.stringify({ schema: 2, inputs, files: hashes }));
}

export function validateOcclusionPlan(value: unknown, context: OcclusionContext, sourceHash: string): OcclusionPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('层级表必须是对象');
  const plan = value as OcclusionPlan;
  if (plan.version !== 2 || plan.direction !== 'back-to-front' || plan.sourceHash !== sourceHash || !Array.isArray(plan.layers) ||
      Object.keys(plan).some(key => !['version', 'direction', 'sourceHash', 'layers'].includes(key))) {
    throw new Error('层级表版本、方向或输入指纹不符');
  }
  const ids = new Set(terminalParts(context).map(({ group }) => group.id));
  if (!ids.size || plan.layers.length !== ids.size) throw new Error('层级表必须完整覆盖全部终止 part');
  const seen = new Set<string>();
  for (const [index, row] of plan.layers.entries()) {
    if (!row || !ids.has(row.id) || seen.has(row.id) || row.level !== index) throw new Error('层级表包含遗漏、重复、非终止节点或错误 level');
    if (Object.keys(row).some(key => !['id', 'level', 'note', 'check'].includes(key))) throw new Error('每个 part 只保存整件固定深度，不接受局部遮挡或显隐规则');
    if (typeof row.note !== 'string' || !row.note.trim() || row.check?.passed !== true ||
        typeof row.check.note !== 'string' || !row.check.note.trim()) throw new Error(`${row.id} 缺少深度依据或逐件检查`);
    seen.add(row.id);
  }
  return structuredClone(plan);
}

export async function restoreOcclusionPlan(context: OcclusionContext): Promise<OcclusionPlan | undefined> {
  const bytes = await readOptional(occlusionPath(context.directory));
  if (!bytes) return;
  const sourceHash = await occlusionSourceHash(context);
  try {
    return validateOcclusionPlan(JSON.parse(bytes.toString()), context, sourceHash);
  }
  catch { return; } // 不完整、旧版本、损坏或过期的表只重做最后一步。
}
