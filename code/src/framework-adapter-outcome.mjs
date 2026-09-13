/**
 * Outcome semantics for the external framework adapters.
 *
 * These rules were previously inline in `run-stagehand-bookstack-v02.mjs`, where
 * they could not be unit-tested. The important one: a cell that reached the
 * checkpoint only because the harness clicked a visible locator fallback is NOT
 * a model-only success. It used to be recorded as `completed` with
 * `failure_category: null`, which would have pooled un-grounded runs into the
 * model-capability estimate.
 */

export const FRAMEWORK_FALLBACK_CATEGORY = 'framework-fallback';

/**
 * @param {object} input
 * @param {object|null} input.failure  adapter-level failure ({name, message}) or null
 * @param {boolean} input.oraclePassed whether the independent oracle confirmed the checkpoint
 * @param {number} input.fallbackCount number of harness locator fallbacks performed
 */
export function deriveFrameworkAdapterOutcome({ failure = null, oraclePassed = false, fallbackCount = 0 } = {}) {
  if (!Number.isInteger(fallbackCount) || fallbackCount < 0) throw new RangeError('fallbackCount must be a non-negative integer');
  const reachedCheckpoint = !failure && oraclePassed === true;
  const fallbackAssisted = fallbackCount > 0;
  // Model-only success requires the checkpoint to be reached WITHOUT a fallback.
  const modelOnlySuccess = reachedCheckpoint && !fallbackAssisted;
  let failureCategory = null;
  if (failure) failureCategory = 'provider';
  else if (fallbackAssisted) failureCategory = FRAMEWORK_FALLBACK_CATEGORY;
  else if (!reachedCheckpoint) failureCategory = 'oracle';
  return {
    checkpoint_reached: reachedCheckpoint,
    fallback_assisted: fallbackAssisted,
    model_only_success: modelOnlySuccess,
    status: failure ? 'test-failure' : (modelOnlySuccess ? 'completed' : 'test-failure'),
    emitted_verdict: reachedCheckpoint ? 'clean' : 'not-emitted',
    failure_category: failureCategory
  };
}

/**
 * The observation boundary an adapter is responsible for: whatever the adapter
 * itself passes into the framework must not contain forbidden observation keys.
 * (A framework that builds its own observation internally is out of scope here;
 * this covers the payload the adapter controls.)
 */
export function findForbiddenObservationTokens(payload, forbidden) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload ?? '');
  return (forbidden ?? []).filter((token) => text.includes(token));
}

export function assertAdapterPayloadIsContractClean(payload, forbidden, label = 'payload') {
  const leaked = findForbiddenObservationTokens(payload, forbidden);
  if (leaked.length > 0) {
    throw new Error(`Adapter payload "${label}" contains forbidden observation fields: ${leaked.join(', ')}`);
  }
  return true;
}
