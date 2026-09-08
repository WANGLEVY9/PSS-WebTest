import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyBookStackPersistence } from '../../src/oracles/bookstack-persistence.mjs';

test('BookStack persistence oracle distinguishes one clean page, one injected mismatch, and ambiguous states', () => {
  assert.deepEqual(classifyBookStackPersistence({ candidateCount: 1, cleanMatches: 1, faultMatches: 0 }), {
    candidate_count: 1, clean_matches: 1, fault_matches: 0,
    observed_verdict: 'clean', expected_verdict: 'clean', passed: true
  });
  assert.equal(classifyBookStackPersistence({ candidateCount: 1, cleanMatches: 0, faultMatches: 1, expectedVerdict: 'fault' }).passed, true);
  assert.equal(classifyBookStackPersistence({ candidateCount: 0, cleanMatches: 0, faultMatches: 0, expectedVerdict: 'fault' }).observed_verdict, 'unknown');
  assert.equal(classifyBookStackPersistence({ candidateCount: 1, cleanMatches: 1, faultMatches: 1 }).observed_verdict, 'unknown');
});
