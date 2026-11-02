import { matchesHash, type ReviewReport } from '../.agents/skills/live2d-maker/shared/part/artifact-facts.ts';
import { throttled, type AgentCall } from './agent-progress.ts';
import type { PartReviewRound, ReviewPhase } from './progress.js';

export type ReviewSkip = { skip: boolean; reason: string };

// Display-only skip decision, shared by phase status and review rounds. A flag
// alone is insufficient: the skipped step must have published its outline.
export function partReviewSkip(group: { hiddenInReference?: boolean; outlineFromParent?: unknown },
  prepared: string, hasOutline: boolean): ReviewSkip {
  const reason = group.hiddenInReference === true ? '原图不可见，已跳过描边和轮廓复核'
    : group.outlineFromParent ? '轮廓由父组完成稿框选复制，已跳过描边和轮廓复核' : '';
  return { skip: !!reason && prepared === 'completed' && hasOutline, reason };
}

// Read-only observations of the existing two-round review chain. Retries and
// blocked inspections are not additional quality rounds.
export function partReviewRounds(groupId: string, report: ReviewReport | undefined, outline: Buffer | undefined,
  calls: AgentCall[], active: boolean, skip: ReviewSkip = { skip: false, reason: '' }): PartReviewRound[] {
  const rounds: PartReviewRound[] = [1, 2].map(round => ({ round,
    review: { status: 'pending', detail: '等待轮廓复核' },
    repair: { status: 'pending', detail: '等待本轮复核意见' },
  }));
  if (skip.skip) return rounds.map(round => ({ ...round,
    review: { status: 'skipped', detail: skip.reason },
    repair: { status: 'skipped', detail: '轮廓复核已跳过，无需返修' },
  }));
  const reviews = report?.groupId === groupId && Array.isArray(report.reviews)
    ? report.reviews.flatMap((review, index) => review && ['pass', 'revise', 'blocked'].includes(review.verdict)
      && typeof review.candidateHash === 'string' && typeof review.feedback === 'string' ? [{ review, index }] : []) : [];
  const quality = reviews.filter(({ review }) => review.verdict !== 'blocked').slice(0, 2);
  const confirmed = new Set<number>(), repaired = new Set<number>();
  let downstream: string | undefined;
  for (let i = quality.length - 1; i >= 0; i--) {
    const { review, index } = quality[i];
    const matches = (hash: unknown) => i === quality.length - 1
      ? !!outline && matchesHash(outline, hash) : typeof hash === 'string' && downstream === hash;
    if (!matches(review.candidateHash) && !matches(review.repairedCandidateHash)) break;
    confirmed.add(index);
    if (matches(review.repairedCandidateHash)) repaired.add(index);
    downstream = review.candidateHash;
  }
  let count = 0;
  for (const { review, index } of reviews) {
    if (count >= 2) break;
    const round = rounds[count];
    round.review = { status: confirmed.has(index) ? 'done' : 'available', reportIndex: index,
      detail: review.verdict === 'blocked' ? '复核受阻，本次不消耗质量轮次' : review.verdict === 'pass' ? '复核通过' : '已提交返修意见' };
    if (!confirmed.has(index) && review.verdict !== 'blocked') round.review.detail += ' · 与当前稿未匹配';
    if (review.verdict === 'blocked') continue;
    round.repair = review.verdict === 'pass' && confirmed.has(index)
      ? { status: 'skipped', detail: '本轮通过，无需返修' }
      : { status: repaired.has(index) ? 'done' : review.repairedCandidateHash ? 'available' : 'pending',
        reportIndex: index, detail: repaired.has(index) ? '已按本轮意见返修并自检'
          : review.repairedCandidateHash ? '已记录返修 · 与当前稿未匹配' : '等待返修并自检' };
    count++;
  }
  const passed = quality.find(({ review, index }) => review.verdict === 'pass' && confirmed.has(index));
  if (passed && quality.indexOf(passed) === 0) {
    rounds[1].review = { status: 'skipped', detail: '第 1 轮通过，无需继续复核' };
    rounds[1].repair = { status: 'skipped', detail: '第 1 轮通过，无需继续返修' };
  }

  const latest = new Map<ReviewPhase, AgentCall>();
  for (const call of calls) {
    const mode = call.name === `组轮廓review-${groupId}` ? 'review'
      : call.name === `组轮廓返修-${groupId}` ? 'repair' : undefined;
    if (!mode) continue;
    const submitted = mode === 'review'
      ? reviews.find(({ review }) => Date.parse(review.updatedAt) >= call.mtime)
      : reviews.filter(({ review }) => review.verdict === 'revise' &&
        (!review.updatedAt || Date.parse(review.updatedAt) <= call.mtime)).at(-1);
    const preceding = reviews.filter(({ review, index }) => review.verdict !== 'blocked' &&
      (submitted ? index < submitted.index : !review.updatedAt || Date.parse(review.updatedAt) < call.mtime)).length;
    const round = Math.min(preceding, 1);
    latest.set(`${mode}-${round + 1}` as ReviewPhase, call);
  }
  for (const [key, call] of latest) {
    const [mode, number] = key.split('-') as ['review' | 'repair', string];
    const observation = rounds[Number(number) - 1][mode];
    if (call.failed) { observation.status = 'failed'; observation.detail = '调用失败，请查看运行记录'; }
    else if (active && throttled(call)) { observation.status = 'throttled'; observation.detail = call.retryError!; }
    else if (active && !call.finished) {
      observation.status = 'running'; observation.detail = mode === 'review' ? '正在复核轮廓' : '正在按本轮意见返修';
    }
  }
  return rounds;
}
