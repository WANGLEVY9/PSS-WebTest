import { evaluateJuiceShopUiSearch } from './juice-shop-ui-search.mjs';

/**
 * Condition-aware visible oracle for the browser-scoped Juice Shop pilot.
 * The functional fault intentionally omits Apple Pomace from the response;
 * the oracle therefore expects the declared negative postcondition rather
 * than treating a clean-search failure as an infrastructure error.
 */
export async function evaluateJuiceShopCondition(page, { condition = 'clean-stable', query = 'apple' } = {}) {
  const clean = await evaluateJuiceShopUiSearch(page, { query });
  if (condition !== 'functional-fault') return { ...clean, expected_verdict: 'clean' };
  const faultDetected = clean.query_in_route
    && clean.visible_expected_names.length === 2
    && !clean.visible_expected_names.includes('Apple Pomace')
    && clean.visible_negative_names.length === 0;
  return {
    ...clean,
    oracle: 'visible-ui-search-fault-postcondition',
    expected_verdict: 'fault',
    fault_detected: faultDetected,
    passed: faultDetected
  };
}
