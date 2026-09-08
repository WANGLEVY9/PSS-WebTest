import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAgentOutcome, normalizeAgentVerdict } from '../../src/outcome-admission.mjs';

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

test('admits a fault cell only when the visible-agent verdict and independent fault oracle agree', () => {
  assert.equal(normalizeAgentVerdict('pass'), 'clean');
  assert.equal(deriveAgentOutcome({ result: { status: 'completed', emitted_verdict: 'fault' }, oraclePassed: true, expectedVerdict: 'fault' }).cellPassed, true);
  assert.equal(deriveAgentOutcome({ result: { status: 'completed', emitted_verdict: 'clean' }, oraclePassed: true, expectedVerdict: 'fault' }).cellPassed, false);
  assert.equal(deriveAgentOutcome({ result: { status: 'completed', emitted_verdict: 'fault' }, oraclePassed: false, expectedVerdict: 'fault' }).cellPassed, false);
});
