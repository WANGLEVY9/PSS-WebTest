import assert from 'node:assert/strict';
import test from 'node:test';
import { strictPass } from '../../scripts/phase2-evidence-report.mjs';

const base = { status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean' };

test('evidence ledger requires protocol, independent state, and matching verdict for a strict pass', () => {
  assert.equal(strictPass(base), true);
  assert.equal(strictPass({ ...base, checkpoint_reached: false }), false);
  assert.equal(strictPass({ ...base, emitted_verdict: 'fault' }), false);
  assert.equal(strictPass({ ...base, status: 'timeout' }), false);
});
