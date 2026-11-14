// The same marker rule as shared/step-chain.ts. Products and validation reports
// describe the artwork; they never change an execution outcome.
export function executionStatus(marker, { active = false, failed = false, waiting = false } = {}) {
  if (marker === 'completed') return 'done';
  if (marker !== 'running') return 'pending';
  if (failed) return 'failed';
  return active ? waiting ? 'throttled' : 'running' : 'interrupted';
}

// Containers summarize their children. Saved partial work remains visible,
// while active or failed states take precedence over sibling artifacts.
export function aggregateStatus(values) {
  for (const status of ['running', 'throttled', 'failed', 'interrupted', 'unconfirmed']) {
    if (values.includes(status)) return status;
  }
  if (values.length && values.every(value => value === 'done' || value === 'skipped')) return 'done';
  return values.some(value => value === 'available' || value === 'done') ? 'available' : 'pending';
}
