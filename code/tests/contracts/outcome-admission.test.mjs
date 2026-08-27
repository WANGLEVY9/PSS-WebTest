import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAgentOutcome } from '../../src/outcome-admission.mjs';

test('separates reached task state from correct protocol termination', () => {
  assert.deepEqual(deriveAgentOutcome({ result: { status: 'timeout', emitted_verdict: 'not-emitted' }, oraclePassed: true }), {
    taskStateReached: true,
    protocolCompleted: false,
    oracleOnlySuccess: true,
    cellPassed: false
  });
});

test('admits only a pass verdict plus independent oracle success', () => {
  assert.equal(deriveAgentOutcome({ result: { status: 'completed', emitted_verdict: 'unknown' }, oraclePassed: true }).cellPassed, false);
  assert.equal(deriveAgentOutcome({ result: { status: 'completed', emitted_verdict: 'pass' }, oraclePassed: false }).cellPassed, false);
  assert.equal(deriveAgentOutcome({ result: { status: 'completed', emitted_verdict: 'pass' }, oraclePassed: true }).cellPassed, true);
});
