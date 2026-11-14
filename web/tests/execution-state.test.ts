import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateStatus, executionStatus } from '../execution-state.js';

test('completion markers win over liveness, errors and retry waits; files do not determine status', () => {
  for (const active of [false, true]) for (const failed of [false, true]) for (const waiting of [false, true]) {
    assert.equal(executionStatus('completed', { active, failed, waiting }), 'done');
    for (const marker of ['absent', 'unmarked'] as const) assert.equal(executionStatus(marker, { active, failed, waiting }), 'pending');
  }
  assert.equal(executionStatus('running'), 'interrupted');
  assert.equal(executionStatus('running', { failed: true }), 'failed');
  assert.equal(executionStatus('running', { active: true }), 'running');
  assert.equal(executionStatus('running', { active: true, waiting: true }), 'throttled');
});

test('containers distinguish saved partial work from pending and completed work', () => {
  assert.equal(aggregateStatus([]), 'pending');
  assert.equal(aggregateStatus(['done', 'pending']), 'available');
  assert.equal(aggregateStatus(['available', 'pending']), 'available');
  assert.equal(aggregateStatus(['done', 'skipped']), 'done');
  assert.equal(aggregateStatus(['interrupted', 'pending']), 'interrupted');
  assert.equal(aggregateStatus(['unconfirmed', 'available']), 'unconfirmed');
  assert.equal(aggregateStatus(['failed', 'interrupted']), 'failed');
  assert.equal(aggregateStatus(['failed', 'throttled']), 'throttled');
  assert.equal(aggregateStatus(['running', 'failed']), 'running');
  assert.equal(aggregateStatus(['running', 'throttled', 'failed']), 'throttled');
});
