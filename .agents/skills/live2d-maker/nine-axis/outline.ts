import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { writeAtomic } from '../shared/part/groups.ts';
import { completedReviewCount, readReviewReport, type Review } from '../shared/part/artifact-facts.ts';
import { textResult, type FunctionTool } from '../shared/codex/function-tools.ts';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { SvgObservation } from '../shared/part/svg-tools.ts';

export type OutlineRole = 'main' | 'review' | 'repair';
// Runs one agent turn in the given role. Draw and repair share the outline
// thread; review is a fresh session whose extra tool is `submit`.
export type OutlineAgent = (role: OutlineRole, submit?: FunctionTool) => Promise<void>;

export const outlineFiles = ['source-face.svg', 'target-face.svg', 'notes.md'] as const;
// Like the part outline review, but one round: a revise is repaired once in the
// drawing thread and the step moves on without another review.
const maxOutlineReviews = 1;

async function candidateHash(directory: string) {
  const hash = createHash('sha256');
  for (const file of outlineFiles) {
    const bytes = await readFile(join(directory, file)).catch(() => { throw Error(`描边缺少交付：${join(directory, file)}`); });
    hash.update(`${file}\0`).update(bytes).update('\0');
  }
  return hash.digest('hex');
}

function submitReview(directory: string, reportPath: string, hash: string, observations: SvgObservation[], done: (review: Review) => void): FunctionTool {
  let submitted = false;
  return {
    ...toolDefinition('submit_review'),
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('本轮审查已提交');
      const raw = value as Record<string, unknown> | null;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.verdict !== 'string' || !['pass', 'revise', 'blocked'].includes(raw.verdict) ||
          typeof raw.feedback !== 'string' || !raw.feedback.trim() || Object.keys(raw).some(key => !['verdict', 'feedback'].includes(key))) throw new Error('无效审查结论或意见');
      if (raw.verdict !== 'blocked' && !observations.some(entry => entry.mode !== 'svg')) throw new Error('必须先用 preview_svg 实际对照描边与参考图');
      if (await candidateHash(directory) !== hash) throw new Error('审查期间描边被修改，不能提交');
      const review: Review = { verdict: raw.verdict as Review['verdict'], feedback: raw.feedback, candidateHash: hash,
        observations: observations.map(({ source, mode, savedPath }) => ({ source, mode, savedPath })), updatedAt: new Date().toISOString() };
      const report = await readReviewReport(reportPath, 'outline');
      report.reviews.push(review);
      signal.throwIfAborted();
      await writeAtomic(reportPath, JSON.stringify(report, null, 2) + '\n');
      submitted = true;
      done(review);
      return textResult({ path: reportPath, verdict: review.verdict });
    },
  };
}

// `observations` collects the reviewer's preview_svg calls for the current round.
export async function runOutline(directory: string, run: OutlineAgent, observations: SvgObservation[], progress: (message: string) => void = () => {}) {
  const reportPath = join(directory, 'review.json');
  const report = await readReviewReport(reportPath, 'outline');
  const drawn = await Promise.all(outlineFiles.map(file => access(join(directory, file)).then(() => true, () => false)));
  if (!report.reviews.length && !drawn.every(Boolean)) await run('main');
  async function repair(review: Review) {
    if (review.repairedCandidateHash && review.repairedCandidateHash === await candidateHash(directory)) return;
    await run('repair');
    review.repairedCandidateHash = await candidateHash(directory);
    await writeAtomic(reportPath, JSON.stringify(report, null, 2) + '\n');
    progress('描边已按 review 返修，不再复审');
  }
  let last = report.reviews.at(-1);
  if (last?.verdict === 'pass' && last.candidateHash === await candidateHash(directory)) return;
  if (last?.verdict === 'revise') await repair(last);
  while (completedReviewCount(report) < maxOutlineReviews) {
    const hash = await candidateHash(directory);
    observations.length = 0;
    let submitted: Review | undefined;
    await run('review', submitReview(directory, reportPath, hash, observations, review => { submitted = review; }));
    if (!submitted) throw Error('描边 review 未通过 submit_review 保存结论');
    if (await candidateHash(directory) !== hash) throw Error('描边 review 修改了描边');
    report.reviews.push(last = submitted);
    progress(`描边 review：${last.verdict}`);
    if (last.verdict === 'pass') return;
    if (last.verdict === 'blocked') throw Error(`描边 review blocked：${last.feedback}；报告：${reportPath}`);
    await repair(last);
  }
  if (last?.verdict === 'pass' && last.candidateHash !== await candidateHash(directory)) throw Error(`描边与已通过 review 的候选不一致；报告：${reportPath}`);
}
