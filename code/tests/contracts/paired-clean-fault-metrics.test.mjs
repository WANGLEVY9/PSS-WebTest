import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizePairedCleanFault } from '../../src/paired-clean-fault-metrics.mjs';
import { createRunRecord } from '../../src/run-records.mjs';

let counter = 0;
const record = ({ truth, emitted, status = 'completed', checkpoint = true, arm = 'visual' }) => createRunRecord({
  schema_version: '0.1', run_id: `paired-${counter++}`, application_id: 'bookstack', application_version: '24.10.1', task_id: 'bookstack-create-page', condition: truth === 'clean' ? 'clean-stable' : 'functional-fault:persistence-mismatch', arm, status, checkpoint_reached: checkpoint, emitted_verdict: emitted, ground_truth_verdict: truth,
  timing: { wall_time_ms: 1, actions: 1, retries: 0 }, provenance: { runner_version: 'test', observation_contract: 'screenshot-only', model_id: null }, failure_category: status === 'completed' ? null : 'execution', trace: []
});

test('paired metrics retain unknown and not-emitted fault outcomes as false negatives', () => {
  const [row] = summarizePairedCleanFault([
    record({ truth: 'clean', emitted: 'clean' }), record({ truth: 'clean', emitted: 'unknown', status: 'test-failure' }),
    record({ truth: 'fault', emitted: 'fault' }), record({ truth: 'fault', emitted: 'not-emitted', status: 'timeout' })
  ]);
  assert.equal(row.clean_n, 2);
  assert.equal(row.fault_n, 2);
  assert.equal(row.verdict_coverage_rate, 0.5);
  assert.equal(row.false_positive_rate, 0);
  assert.equal(row.false_negative_rate, 0.5);
  assert.equal(row.sensitivity, 0.5);
  assert.equal(row.specificity, 0.5);
});
