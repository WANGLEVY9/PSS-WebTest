const TARGET = 'Apple Juice (1000ml)';
const CONFIRMATION = `Placed ${TARGET} into basket.`;

/** Independent UI oracle for delayed basket confirmation feedback. */
export async function evaluateJuiceShopBasketFeedback(page, {
  condition = 'clean-stable', targetName = TARGET
} = {}) {
  const targetVisible = await page.getByText(targetName, { exact: true }).isVisible().catch(() => false);
  const confirmationVisible = await page.getByText(`Placed ${targetName} into basket.`, { exact: true }).isVisible().catch(() => false);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const targetAbsent = !bodyText.includes(targetName);
  const faultDetected = targetAbsent && !bodyText.includes(`Placed ${targetName} into basket.`);
  return {
    oracle: condition === 'functional-fault' ? 'visible-ui-basket-feedback-fault-postcondition' : 'visible-ui-basket-feedback-postcondition',
    authority: 'visible-state', condition, target_name: targetName,
    confirmation_text: `Placed ${targetName} into basket.`, target_visible: targetVisible,
    confirmation_visible: confirmationVisible,
    expected_verdict: condition === 'functional-fault' ? 'fault' : 'clean',
    fault_detected: condition === 'functional-fault' ? faultDetected : false,
    passed: condition === 'functional-fault' ? faultDetected : Boolean(targetVisible && confirmationVisible)
  };
}

export { TARGET as JUICE_SHOP_BASKET_FEEDBACK_TARGET, CONFIRMATION as JUICE_SHOP_BASKET_CONFIRMATION };
