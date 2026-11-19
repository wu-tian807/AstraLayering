import { createHash } from 'node:crypto';
import { mkdir, readFile, rename } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { ReviewedSvgArtifact } from './layering-types.ts';
import { groupDepth, groupStepId, layerStepId } from './part-steps.ts';
import { svgSource } from '../xml.ts';
import { nextReviewAction, type ReviewProgress } from '../review-schedule.ts';

export const svgHash = (bytes: Buffer | string): string => createHash('sha256')
  .update(bytes.toString().replace(/\r\n/g, '\n')).digest('hex');
export function matchesHash(bytes: Buffer, value: unknown): boolean {
  return typeof value === 'string' && (value === svgHash(bytes) ||
    value === createHash('sha256').update(bytes).digest('hex'));
}
// Paths of the step outputs; see part-steps.ts for the step graph.
export const artifactPath = (directory: string, id: string, stage: 'outline' | 'reduction' | 'completion'): string =>
  stage === 'completion' ? join(directory, 'parts', `${id}.svg`)
    : stage === 'reduction' ? join(directory, layerStepId(groupDepth(id)), `${id}.svg`)
      : join(directory, groupStepId(id, 'outline'), 'outline.svg');
export const draftPath = (path: string): string => join(dirname(path), 'workspace', basename(path).replace(/\.svg$/, '.draft.svg'));
export const stepDraftPath = (directory: string, id: string, stage: 'outline' | 'reduction' | 'completion'): string =>
  stage === 'reduction' ? join(directory, layerStepId(groupDepth(id)), 'workspace', `${id}.draft.svg`)
    : join(directory, groupStepId(id, stage === 'outline' ? 'outline' : 'completion'), 'workspace', `${stage}.draft.svg`);
export const reportPath = (directory: string, id: string, kind: 'review' | 'completion-check' | 'children'): string =>
  kind === 'review' ? join(directory, groupStepId(id, 'outline'), 'review.json')
    : kind === 'completion-check' ? join(directory, groupStepId(id, 'completion'), 'check.json')
      : join(directory, groupStepId(id, 'children'), 'children.json');

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
  if (bytes) try {
    if (svgSource(bytes.toString()).root.selfClosing) throw new Error('缺少 SVG 正文');
  }
  catch (error) { throw new Error(`Invalid SVG output: ${path}`, { cause: error }); }
  return bytes;
}
export async function publishSvg(draft: string, output: string): Promise<void> {
  if (!draft.endsWith('.draft.svg') || output.endsWith('.draft.svg') || !output.endsWith('.svg')) {
    throw new Error('正式 SVG 必须从 .draft.svg 发布');
  }
  const bytes = await readSvg(draft);
  if (!bytes) throw new Error(`SVG 草稿未生成：${draft}`);
  await mkdir(dirname(output), { recursive: true });
  await rename(draft, output);
}

export type Review = {
  verdict: 'pass' | 'revise' | 'blocked'; feedback: string; candidateHash: string;
  observations: { source: string; mode: 'svg' | 'blend' | 'edge'; savedPath: string }[];
  updatedAt: string; repairedCandidateHash?: string;
};
export type ReviewReport = { groupId: string; reviews: Review[] };
export const maxOutlineReviews = 2;
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
// Failed inspections remain in the audit trail without consuming quality review rounds.
export const completedReviewCount = (report: ReviewReport): number => report.reviews.filter(review => review.verdict !== 'blocked').length;

export function outlineReviewProgress(report: ReviewReport, bytes?: Buffer): ReviewProgress {
  const completedReviews = completedReviewCount(report);
  const last = report.reviews.at(-1);
  if (bytes && last?.verdict === 'pass' && matchesHash(bytes, last.candidateHash)) {
    return { completedReviews, verdict: 'pass' };
  }
  if (bytes && last?.verdict === 'revise') {
    return { completedReviews, verdict: 'revise', repaired: matchesHash(bytes, last.repairedCandidateHash) };
  }
  return { completedReviews };
}

export function reviewedArtifact(bytes: Buffer, path: string, report: ReviewReport): ReviewedSvgArtifact | undefined {
  const progress = outlineReviewProgress(report, bytes);
  const action = nextReviewAction(progress, maxOutlineReviews);
  if (action.kind !== 'done') return;
  if (action.outcome === 'pass') return { path, reviewOutcome: 'pass' };
  return { path, reviewOutcome: 'repaired', note: `已按第 ${progress.completedReviews} 轮意见返修并自检，不再复审` };
}
