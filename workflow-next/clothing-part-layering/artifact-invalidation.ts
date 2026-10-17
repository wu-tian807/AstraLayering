import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { artifactPath, draftPath, reportPath, restoreFacts } from './artifact-facts.ts';
import { walkGroups, type GroupStore } from './groups.ts';

// 只在执行入口调用；GroupStore.open 的只读恢复不删除文件。
export async function invalidatePendingArtifacts(directory: string, store: GroupStore, keepDrafts = new Set<string>()): Promise<void> {
  const document = store.snapshot();
  const files = new Set<string>();
  const resetChildren = new Set<string>();
  function svg(path: string) { files.add(path); if (!keepDrafts.has(draftPath(path))) files.add(draftPath(path)); }

  for (const { group } of walkGroups(document.groups)) {
    if (group.steps.outline.status !== 'completed') {
      svg(artifactPath(directory, group.id, 'outline'));
      // 新一轮轮廓不能沿用旧候选的通过结论或返修轮次。
      files.add(reportPath(directory, group.id, 'review'));
    }
    if (group.steps.reduction.status !== 'completed') {
      // 保留共享记录里其他 part 的有效证据，只撤下本件失效的去重结果。
      svg(artifactPath(directory, group.id, 'reduction'));
    }
    if (group.steps.completion.status !== 'completed') {
      svg(artifactPath(directory, group.id, 'completion'));
      // 输入记录保留为引用证据；没有匹配的正式 SVG 时，它不能单独构成完成事实。
    }
    if (group.steps.completionCheck.status !== 'completed') files.add(reportPath(directory, group.id, 'completion-check'));
    if (group.steps.children.status !== 'completed') {
      files.add(reportPath(directory, group.id, 'children'));
      resetChildren.add(group.id);
    }
  }
  if (document.merge.status !== 'completed') {
    svg(join(directory, 'preview.svg'));
    files.add(join(directory, 'occlusion.json'));
  }
  if (!files.size && !resetChildren.size) return;

  // 所有删除必须先于任何新产物发布，不能等新哈希碰巧改变后再判断。
  // 清理中断时，尚未补齐的正式输入/批次记录仍然缺失或无效；下一次会再次清理。
  // 树最后提交，避免中途剪去后代后丢失待清理路径。
  for (const path of files) await rm(path, { force: true });
  for (const { group } of walkGroups(document.groups)) if (resetChildren.has(group.id)) {
    group.groups = [];
    delete group.childrenAnalysis;
  }
  await restoreFacts(directory, document);
  await store.update(draft => { draft.groups = document.groups; draft.merge = document.merge; });
}
