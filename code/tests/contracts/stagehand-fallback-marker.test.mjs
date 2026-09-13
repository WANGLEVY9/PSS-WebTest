import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRAMEWORK_FALLBACK_CATEGORY,
  deriveFrameworkAdapterOutcome,
  findForbiddenObservationTokens,
  assertAdapterPayloadIsContractClean
} from '../../src/framework-adapter-outcome.mjs';

test('a fallback-assisted cell is not a model-only success', () => {
  const outcome = deriveFrameworkAdapterOutcome({ failure: null, oraclePassed: true, fallbackCount: 1 });
  // The checkpoint really was reached, so checkpoint_reached stays true...
  assert.equal(outcome.checkpoint_reached, true);
  // ...but the cell must not be reported as a completed model success.
  assert.equal(outcome.fallback_assisted, true);
  assert.equal(outcome.model_only_success, false);
  assert.equal(outcome.status, 'test-failure');
  assert.equal(outcome.failure_category, FRAMEWORK_FALLBACK_CATEGORY);
});

test('a model-only success is the only path to completed', () => {
  const outcome = deriveFrameworkAdapterOutcome({ failure: null, oraclePassed: true, fallbackCount: 0 });
  assert.equal(outcome.status, 'completed');
  assert.equal(outcome.model_only_success, true);
  assert.equal(outcome.fallback_assisted, false);
  assert.equal(outcome.failure_category, null);
  assert.equal(outcome.emitted_verdict, 'clean');
});

test('a failed adapter run keeps its provider category and does not claim the checkpoint', () => {
  const outcome = deriveFrameworkAdapterOutcome({ failure: { name: 'TimeoutError', message: 'provider timeout' }, oraclePassed: true, fallbackCount: 0 });
  assert.equal(outcome.checkpoint_reached, false);
  assert.equal(outcome.status, 'test-failure');
  assert.equal(outcome.failure_category, 'provider');
  assert.equal(outcome.emitted_verdict, 'not-emitted');
});

test('an unreached checkpoint without a failure is an oracle category', () => {
  const outcome = deriveFrameworkAdapterOutcome({ failure: null, oraclePassed: false, fallbackCount: 0 });
  assert.equal(outcome.status, 'test-failure');
  assert.equal(outcome.failure_category, 'oracle');
  assert.equal(outcome.checkpoint_reached, false);
});

test('fallbackCount is validated rather than coerced', () => {
  assert.throws(() => deriveFrameworkAdapterOutcome({ fallbackCount: -1 }), RangeError);
  assert.throws(() => deriveFrameworkAdapterOutcome({ fallbackCount: 1.5 }), RangeError);
});

test('the observation boundary detector finds forbidden tokens in adapter payloads', () => {
  const forbidden = ['goldOracle', 'mutationLabel', 'applicationState'];
  assert.deepEqual(findForbiddenObservationTokens('click the Books link', forbidden), []);
  assert.deepEqual(findForbiddenObservationTokens({ instruction: 'x', note: 'goldOracle' }, forbidden), ['goldOracle']);
  assert.throws(() => assertAdapterPayloadIsContractClean({ mutationLabel: 'x' }, forbidden, 'instruction'), /forbidden observation fields/);
});
