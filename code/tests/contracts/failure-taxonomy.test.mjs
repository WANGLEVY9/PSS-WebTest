import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAgentFailure } from '../../src/failure-taxonomy.mjs';

test('classifies provider and grounding failures by observed boundary', () => {
  assert.equal(classifyAgentFailure({ failure: { name: 'AbortError', message: 'This operation was aborted' } }), 'provider-timeout');
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'repeated non-progressing click at x=1 y=2' } }), 'grounding-loop');
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'CUA API request failed (429)' } }), 'provider-api');
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'CUA model did not return valid JSON' } }), 'provider-format');
});

test('separates step budget, termination verdict, and oracle failure', () => {
  assert.equal(classifyAgentFailure({ result: { status: 'timeout' }, oraclePassed: true }), 'agent-step-budget');
  assert.equal(classifyAgentFailure({ result: { status: 'completed', emitted_verdict: 'not-emitted' }, oraclePassed: true }), 'termination-verdict');
  assert.equal(classifyAgentFailure({ result: { status: 'completed', emitted_verdict: 'pass' }, oraclePassed: false }), 'oracle');
  assert.equal(classifyAgentFailure({ result: { status: 'completed', emitted_verdict: 'pass' }, oraclePassed: true }), null);
});
