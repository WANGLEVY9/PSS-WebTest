import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeRecords } from '../../scripts/summarize-run-records.mjs';

const base = (overrides = {}) => ({
  schema_version: '0.1', run_id: `run-${Math.random()}`, application_id: 'bookstack', application_version: '24.10.1',
  task_id: 'bookstack-open-book', condition: 'clean-stable', arm: 'visual', status: 'completed', checkpoint_reached: true,
  emitted_verdict: 'clean', ground_truth_verdict: 'clean',
  timing: { wall_time_ms: 100, actions: 2, retries: 0, tokens: null, cost_usd: null },
  provenance: { runner_version: 'test', observation_contract: 'screenshot-only', model_id: 'test', trace_hash: 'a'.repeat(64) },
  failure_category: null, ...overrides
});

test('metric summary computes cell-level completion and efficiency metrics', () => {
  const summary = summarizeRecords([base(), base({ run_id: 'run-2', status: 'timeout', checkpoint_reached: false, failure_category: 'provider', timing: { wall_time_ms: 500, actions: 8, retries: 1, tokens: null, cost_usd: null } })]);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].n, 2);
  assert.equal(summary[0].valid_completion_rate, 0.5);
  assert.equal(summary[0].verdict_correct_rate, 1);
  assert.equal(summary[0].mean_action_count, 5);
  assert.equal(summary[0].failure_categories.provider, 1);
  assert.equal(summary[0].false_positive_rate, null);
});
