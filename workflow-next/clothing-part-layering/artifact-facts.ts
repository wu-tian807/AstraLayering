import { createHash } from 'node:crypto';
import { readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { groupCompleted, nodeSeed, normalizeGroups, walkGroups, writeAtomic } from './groups.ts';
import { groupStages, type GroupsDocument, type ReviewedSvgArtifact } from './layering-types.ts';
import { assertCompletionPreserves } from './completion-svg.ts';
import { completionInputsMatch } from './completion-inputs.ts';

export const svgHash = (bytes: Buffer | string): string => createHash('sha256')
  .update(bytes.toString().replace(/\r\n/g, '\n')).digest('hex');
export function matchesHash(bytes: Buffer, value: unknown): boolean {
  return typeof value === 'string' && (value === svgHash(bytes) ||
    value === createHash('sha256').update(bytes).digest('hex'));
}
export const artifactPath = (directory: string, id: string, stage: 'outline' | 'reduction' | 'completion'): string =>
  stage === 'completion' ? join(directory, 'parts', `${id}.svg`)
    : join(directory, 'stages', stage === 'reduction' ? 'outline-reduce' : stage, `${id}.svg`);
export const draftPath = (path: string): string => path.replace(/\.svg$/, '.draft.svg');
export const reportPath = (directory: string, id: string, kind: 'review' | 'completion-check' | 'children'): string =>
  join(directory, 'stages', kind, `${id}${kind === 'review' ? '.review' : ''}.json`);
export const reductionReportPath = (directory: string, depth: number): string =>
  join(directory, 'stages', 'outline-reduce', 'layers', `${depth}.json`);

export async function readOptional(path: string): Promise<Buffer | undefined> {
  try { return await readFile(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
}
export async function readJson(path: string): Promise<any | undefined> {
  const bytes = await readOptional(path);
  return bytes === undefined ? undefined : JSON.parse(bytes.toString());
}
export async function readSvg(path: string): Promise<Buffer | undefined> {
  const bytes = await readOptional(path);
  if (bytes && (!/<svg\b[^>]*>/.test(bytes.toString()) || !/<\/svg>\s*$/.test(bytes.toString()))) {
    throw new Error(`Invalid SVG output: ${path}`);
  }
  return bytes;
}
export function stampedSvg(bytes: Buffer, sourceHash?: string): Buffer {
  return sourceHash ? Buffer.from(bytes.toString().replace(/<svg\b[^>]*>/, root => root
    .replace(/\sdata-source-sha256=(['"]).*?\1/g, '').replace(/>$/, ` data-source-sha256="${sourceHash}">`))) : bytes;
}
export async function publishSvg(draft: string, output: string, sourceHash?: string): Promise<void> {
  if (!draft.endsWith('.draft.svg') || output.endsWith('.draft.svg') || !output.endsWith('.svg')) {
    throw new Error('正式 SVG 必须从 .draft.svg 发布');
  }
  const bytes = await readSvg(draft);
  if (!bytes) throw new Error(`SVG 草稿未生成：${draft}`);
  if (sourceHash) {
    await writeAtomic(draft, stampedSvg(bytes, sourceHash));
  }
  await rename(draft, output);
}
function sourceMatches(bytes: Buffer, sourceHash: string): boolean {
  return bytes.toString().match(/\bdata-source-sha256=['"]([^'"]+)['"]/)?.[1] === sourceHash;
}

export type Review = {
  verdict: 'pass' | 'revise' | 'blocked'; feedback: string; candidateHash: string;
  observations: { source: string; mode: 'svg' | 'blend' | 'edge'; savedPath: string }[];
  updatedAt: string; repairedCandidateHash?: string;
};
export type ReviewReport = { groupId: string; reviews: Review[] };
export async function readReviewReport(path: string, id: string): Promise<ReviewReport> {
  const value = await readJson(path) ?? { groupId: id, reviews: [] };
  if (value.groupId !== id || !Array.isArray(value.reviews) || value.reviews.some((review: Review) =>
    !review || !['pass', 'revise', 'blocked'].includes(review.verdict) ||
    typeof review.feedback !== 'string' || typeof review.candidateHash !== 'string' ||
    (review.repairedCandidateHash !== undefined && typeof review.repairedCandidateHash !== 'string'))) {
    throw new Error(`审查记录损坏：${path}`);
  }
  return value;
}
export function reviewedArtifact(bytes: Buffer, path: string, report: ReviewReport): ReviewedSvgArtifact | undefined {
  const last = report.reviews.at(-1);
  if (last?.verdict === 'pass' && matchesHash(bytes, last.candidateHash)) return { path, reviewOutcome: 'pass' };
  if (report.reviews.length >= 2 && last?.verdict === 'revise' && matchesHash(bytes, last.repairedCandidateHash)) {
    return { path, reviewOutcome: 'repaired', note: `已按第 ${report.reviews.length} 轮意见返修并自检，不再复审` };
  }
}

export async function restoreFacts(directory: string, document: GroupsDocument): Promise<void> {
  let discovered = false;
  for (const { group } of walkGroups(document.groups)) {
    group.steps = Object.fromEntries(groupStages.map(stage => [stage, { status: 'pending' }])) as typeof group.steps;
  }
  const depths = [...new Set(walkGroups(document.groups).map(entry => entry.depth))];
  const nodes = new Map(walkGroups(document.groups).map(({ group }) => [group.id, group]));
  for (const depth of depths) {
    const entries = walkGroups(document.groups).filter(entry => entry.depth === depth);
    for (const { group, parent } of entries) {
      // 先恢复父层的完整事实；磁盘上残留的旧父 SVG 不能单独放行子层。
      if (parent && !groupCompleted(parent)) continue;
      const path = artifactPath(directory, group.id, 'outline');
      const bytes = await readSvg(path);
      if (!bytes) continue;
      if (parent) {
        const before = await readSvg(artifactPath(directory, parent.id, 'completion'));
        if (!before || !sourceMatches(bytes, svgHash(before))) continue;
      }
      group.steps.outline = { status: 'completed', output: { path } };
      const report = await readReviewReport(reportPath(directory, group.id, 'review'), group.id);
      const reviewed = reviewedArtifact(bytes, path, report);
      if (reviewed) group.steps.review = { status: 'completed', output: reviewed };
      else if (report.reviews.at(-1)?.verdict === 'blocked') {
        group.steps.review.message = `轮廓 review blocked：${report.reviews.at(-1)!.feedback}`;
      }
    }
    const receipt = await readJson(reductionReportPath(directory, depth));
    if (!receipt) continue;
    if (receipt.depth !== depth || !Array.isArray(receipt.groups) || new Set(receipt.groups.map((g: any) => g.id)).size !== receipt.groups.length) continue;
    for (const { group } of entries) {
      const saved = receipt.groups.find((item: any) => item.id === group.id);
      const before = await readSvg(artifactPath(directory, group.id, 'outline'));
      const after = await readSvg(artifactPath(directory, group.id, 'reduction'));
      if (group.steps.review.status !== 'completed' || !before || !after ||
        !matchesHash(before, saved?.inputHash) || !matchesHash(after, saved?.outputHash)) continue;
      group.steps.reduction = { status: 'completed', output: { path: artifactPath(directory, group.id, 'reduction') } };
    }
    for (const { group } of entries) {
      if (group.steps.reduction.status !== 'completed') continue;
      const path = artifactPath(directory, group.id, 'reduction');
      const before = (await readSvg(path))!;
      const partPath = artifactPath(directory, group.id, 'completion');
      const after = await readSvg(partPath);
      if (!after || !sourceMatches(after, svgHash(before))) continue;
      try { assertCompletionPreserves(before.toString(), after.toString()); }
      catch { continue; }
      if (!await completionInputsMatch(directory, group.id, svgHash(before), svgHash(after), nodes,
        /\bdata-completion-inputs=['"]v1['"]/.test(after.toString()))) continue;
      group.steps.completion = { status: 'completed', output: { path: partPath } };
      const check = await readJson(reportPath(directory, group.id, 'completion-check'));
      if (check?.groupId !== group.id || check.passed !== true ||
        !matchesHash(before, check.beforeHash) || !matchesHash(after, check.afterHash)) continue;
      group.steps.completionCheck = { status: 'completed', output: { passed: true, ...(check.note ? { note: check.note } : {}) } };
      if (group.kind === 'part') {
        group.steps.children = { status: 'completed', output: { ids: [] } };
        continue;
      }
      if (!group.childrenAnalysis) {
        // Read old reports only to migrate an existing run. New runs commit the tree and analysis together.
        const legacy = await readJson(reportPath(directory, group.id, 'children'));
        if (legacy?.groupId !== group.id || !matchesHash(after, legacy.sourceHash)) continue;
        const proposed = normalizeGroups(legacy.groups);
        if (proposed.some(child => !child.id.startsWith(`${group.id}/`) || child.id.slice(group.id.length + 1).includes('/') || child.groups.length)) {
          throw new Error(`${group.id}: 子组事实必须只包含直属节点`);
        }
        if (!group.groups.length && proposed.length) {
          const seen = new Set(walkGroups(document.groups).map(entry => entry.group.id));
          group.groups = normalizeGroups(legacy.groups, seen);
          discovered = true;
        } else if (JSON.stringify(proposed.map(nodeSeed)) !== JSON.stringify(group.groups.map(nodeSeed))) {
          throw new Error(`${group.id}: 旧子组事实与 groups.json 不一致`);
        }
        group.childrenAnalysis = { sourceHash: svgHash(after), ...(legacy.note ? { note: legacy.note } : {}) };
      }
      if (matchesHash(after, group.childrenAnalysis.sourceHash)) {
        group.steps.children = { status: 'completed', output: { ids: group.groups.map(child => child.id) } };
      }
    }
  }
  // 分析结果已提交但树尚未保存时，恢复发现的后代并读取它们的事实。
  if (discovered) return restoreFacts(directory, document);
  document.merge = { status: 'pending' };
  if (document.groups.length && walkGroups(document.groups).every(entry => groupCompleted(entry.group))) {
    const final = await readSvg(join(directory, 'preview.svg'));
    if (final && sourceMatches(final, await mergeSourceHash(directory, document))) {
      document.merge = { status: 'completed', output: { path: join(directory, 'preview.svg') } };
    }
  }
}
export async function mergeSourceHash(directory: string, document: GroupsDocument): Promise<string> {
  const inputs = [];
  for (const { group } of walkGroups(document.groups)) {
    inputs.push({ id: group.id, ...(group.kind ? { kind: group.kind } : {}), children: group.groups.map(child => child.id),
      hash: svgHash((await readSvg(artifactPath(directory, group.id, 'completion')))! ) });
  }
  return svgHash(JSON.stringify(inputs));
}
