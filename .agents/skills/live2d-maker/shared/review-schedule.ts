export type ReviewProgress =
  | { completedReviews: number; verdict?: 'pass' | 'blocked' }
  | { completedReviews: number; verdict: 'revise'; repaired: boolean };

type ReviewWork = { kind: 'review' | 'repair'; round: number };
type ReviewOutcome =
  | { kind: 'done'; outcome: 'pass' | 'repaired' }
  | { kind: 'blocked'; reason: 'review-blocked' | 'round-limit'; round: number };

// A verdict comes from a committed review. Blocked attempts do not consume a
// quality round. The last review can still require a repair.
export function nextReviewAction(progress: ReviewProgress, maxRounds: number): ReviewWork | ReviewOutcome {
  const { completedReviews } = progress;
  const nextRound = completedReviews + 1;
  if (progress.verdict === 'pass') return { kind: 'done', outcome: 'pass' };
  if (progress.verdict === 'blocked') return { kind: 'blocked', reason: 'review-blocked', round: nextRound };
  if (progress.verdict === 'revise' && !progress.repaired) return { kind: 'repair', round: completedReviews };
  if (completedReviews < maxRounds) return { kind: 'review', round: nextRound };
  if (progress.verdict === 'revise') return { kind: 'done', outcome: 'repaired' };
  return { kind: 'blocked', reason: 'round-limit', round: nextRound };
}

// The adapters own their report formats, prompts, and session binding. Each
// phase must finish publishing its results before the next one is selected.
export async function runReviewSchedule(schedule: {
  maxRounds: number;
  progress(): ReviewProgress | Promise<ReviewProgress>;
  review(round: number): Promise<void>;
  repair(round: number): Promise<void>;
  signal?: AbortSignal;
}): Promise<ReviewOutcome> {
  while (true) {
    const action = nextReviewAction(await schedule.progress(), schedule.maxRounds);
    if (action.kind === 'done' || action.kind === 'blocked') return action;
    schedule.signal?.throwIfAborted();
    await schedule[action.kind](action.round);
  }
}
