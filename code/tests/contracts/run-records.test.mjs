import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunRecord, traceHash } from '../../src/run-records.mjs';

const base = () => createRunRecord({ run_id: 'juice-1', application_id: 'juice-shop', application_version: '20.0.0', task_id: 'search', condition: 'clean', arm: 'visual', status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean', timing: { wall_time_ms: 10, actions: 1, retries: 0 }, provenance: { runner_version: '0.1.0', observation_contract: 'screenshot-only', model_id: 'doubao-seed-2-0-pro-260215' }, trace: [{ action: 'keypress', key: 'ENTER' }] });

test('creates schema-compatible immutable record with trace hash', () => {
  const r = base();
  assert.equal(r.provenance.trace_hash, traceHash([{ action: 'keypress', key: 'ENTER' }]));
  assert.equal(r.failure_category, null);
  assert.equal('trace' in r, false);
});
test('rejects credentials and provider secrets', () => {
  assert.throws(() => createRunRecord({ ...base(), trace: [{ api_key: 'sk-should-not-be-recorded' }] }), /sensitive field/);
  assert.throws(() => createRunRecord({ ...base(), provenance: { runner_version: 'x', observation_contract: 'screenshot-only', trace_hash: 'x', authorization: 'Bearer abcdefghijklmnop' } }), /sensitive field/);
});
test('rejects malformed status and timing', () => {
  assert.throws(() => createRunRecord({ ...base(), status: 'success' }), /unsupported status/);
  assert.throws(() => createRunRecord({ ...base(), timing: { wall_time_ms: -1, actions: 0, retries: 0 } }), /invalid timing/);
  assert.throws(() => createRunRecord({ ...base(), failure_category: 'unclassified' }), /unsupported failure_category/);
});
