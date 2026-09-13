const DENIAL = 'You are not allowed to access this page!';

/** Independent oracle for anonymous administration access control. */
export async function evaluateJuiceShopAuthorization(page, { condition = 'clean-stable' } = {}) {
  const location = page.url();
  const administrationRoute = location.includes('#/administration');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const forbiddenVisible = bodyText.includes('403') && bodyText.includes(DENIAL);
  const faultDetected = administrationRoute && !forbiddenVisible;
  return {
    oracle: condition === 'functional-fault' ? 'visible-ui-authorization-fault-postcondition' : 'visible-ui-authorization-postcondition',
    authority: 'visible-state', condition, location, administration_route: administrationRoute,
    forbidden_visible: forbiddenVisible, denial_text: DENIAL,
    expected_verdict: condition === 'functional-fault' ? 'fault' : 'clean',
    fault_detected: condition === 'functional-fault' ? faultDetected : false,
    passed: condition === 'functional-fault' ? faultDetected : Boolean(administrationRoute && forbiddenVisible)
  };
}
