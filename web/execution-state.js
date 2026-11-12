// The same marker rule as shared/step-chain.ts. Products and validation reports
// describe the artwork; they never change an execution outcome.
export function executionStatus(marker, { active = false, failed = false, waiting = false } = {}) {
  if (marker === 'completed') return 'done';
  if (marker !== 'running') return 'pending';
  if (failed) return 'failed';
  return active ? waiting ? 'throttled' : 'running' : 'interrupted';
}

// Containers summarize their children. Partial completion is still pending,
// while an active child takes precedence over stopped siblings.
export function aggregateStatus(values) {
  for (const status of ['running', 'throttled', 'failed', 'interrupted']) {
    if (values.includes(status)) return status;
  }
  return values.length && values.every(value => value === 'done' || value === 'skipped') ? 'done' : 'pending';
}
