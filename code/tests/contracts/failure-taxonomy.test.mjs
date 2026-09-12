import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAgentFailure } from '../../src/failure-taxonomy.mjs';

test('classifies provider and grounding failures by observed boundary', () => {
  assert.equal(classifyAgentFailure({ failure: { name: 'AbortError', message: 'This operation was aborted' } }), 'provider-timeout');
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'repeated non-progressing click at x=1 y=2' } }), 'grounding-loop');
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'CUA API request failed (429)' } }), 'provider-api');
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'CUA model did not return valid JSON' } }), 'provider-format');
});

test('classifies malformed hybrid pointer output as provider format, not SUT execution', () => {
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'pointer action coordinates must be normalized coordinates (received x=undefined y=undefined)' } }), 'provider-format');
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'title textbox requires CTRL+A before typing at target_id=c11' } }), 'provider-format');
});

test('separates step budget, termination verdict, and oracle failure', () => {
  assert.equal(classifyAgentFailure({ result: { status: 'timeout' }, oraclePassed: true }), 'agent-step-budget');
  assert.equal(classifyAgentFailure({ result: { status: 'completed', emitted_verdict: 'not-emitted' }, oraclePassed: true }), 'termination-verdict');
  assert.equal(classifyAgentFailure({ result: { status: 'completed', emitted_verdict: 'pass' }, oraclePassed: false }), 'oracle');
  assert.equal(classifyAgentFailure({ result: { status: 'completed', emitted_verdict: 'pass' }, oraclePassed: true }), null);
  assert.equal(classifyAgentFailure({ result: { status: 'completed', emitted_verdict: 'clean' }, oraclePassed: true, expectedVerdict: 'fault' }), 'termination-verdict');
  assert.equal(classifyAgentFailure({ result: { status: 'completed', emitted_verdict: 'fault' }, oraclePassed: true, expectedVerdict: 'fault' }), null);
});

test('does not mislabel Playwright actionability timeout as provider timeout', () => {
  assert.equal(classifyAgentFailure({ failure: { name: 'TimeoutError', message: 'locator.click: Timeout 30000ms exceeded waiting for locator' } }), 'execution');
  assert.equal(classifyAgentFailure({ failure: { name: 'Error', message: 'agent wall-time budget exceeded' } }), 'agent-step-budget');
});
