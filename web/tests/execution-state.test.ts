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

test('containers retain unfinished work, active siblings and stopped outcomes without an artifact state', () => {
  assert.equal(aggregateStatus([]), 'pending');
  assert.equal(aggregateStatus(['done', 'pending']), 'pending');
  assert.equal(aggregateStatus(['done', 'skipped']), 'done');
  assert.equal(aggregateStatus(['interrupted', 'pending']), 'interrupted');
  assert.equal(aggregateStatus(['failed', 'interrupted']), 'failed');
  assert.equal(aggregateStatus(['failed', 'throttled']), 'throttled');
  assert.equal(aggregateStatus(['running', 'throttled', 'failed']), 'running');
});
