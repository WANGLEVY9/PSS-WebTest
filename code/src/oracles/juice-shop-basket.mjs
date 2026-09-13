const TARGET = 'Apple Juice (1000ml)';

/** Independent visible-state oracle for the catalog-to-basket workflow. */
export async function evaluateJuiceShopBasket(page, {
  condition = 'clean-stable', targetName = TARGET
} = {}) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const location = page.url();
  const basketRoute = location.toLowerCase().includes('/basket');
  const headingVisible = await page.getByText('Your Basket (anonymous)', { exact: true }).isVisible().catch(() => false);
  const targetVisible = await page.getByText(targetName, { exact: true }).isVisible().catch(() => false);
  const quantityTexts = await page.locator('.cell-initial-font').allTextContents().catch(() => []);
  const quantityVisible = quantityTexts.some((text) => text.trim() === '1');
  const priceVisible = await page.getByText('1.99¤', { exact: true }).isVisible().catch(() => false);
  const targetAbsent = !bodyText.includes(targetName);
  // The declared fault is target omission at the catalog boundary.  Requiring
  // a basket route would make the fault impossible to detect because the
  // correct agent behavior is to stop before clicking a nonexistent target.
  const faultDetected = targetAbsent;
  return {
    oracle: condition === 'functional-fault' ? 'visible-ui-basket-fault-postcondition' : 'visible-ui-basket-postcondition',
    authority: 'visible-state', condition, target_name: targetName, location,
    basket_route: basketRoute, heading_visible: headingVisible, target_visible: targetVisible,
    quantity_visible: quantityVisible, price_visible: priceVisible,
    expected_verdict: condition === 'functional-fault' ? 'fault' : 'clean',
    fault_detected: condition === 'functional-fault' ? faultDetected : false,
    passed: condition === 'functional-fault'
      ? faultDetected
      : Boolean(basketRoute && headingVisible && targetVisible && quantityVisible && priceVisible)
  };
}

export { TARGET as JUICE_SHOP_BASKET_TARGET };
