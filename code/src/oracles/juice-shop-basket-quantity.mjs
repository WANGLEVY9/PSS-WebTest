const TARGET = 'Apple Juice (1000ml)';

/** Independent visible-state oracle for the repeated-add basket workflow. */
export async function evaluateJuiceShopBasketQuantity(page, {
  condition = 'clean-stable', targetName = TARGET, expectedQuantity = 2
} = {}) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const location = page.url();
  const basketRoute = location.toLowerCase().includes('/basket');
  const headingVisible = await page.getByText('Your Basket (anonymous)', { exact: true }).isVisible().catch(() => false);
  const targetVisible = await page.getByText(targetName, { exact: true }).isVisible().catch(() => false);
  const quantityVisible = (await page.locator('.cell-initial-font').allTextContents().catch(() => []))
    .some((text) => text.trim() === String(expectedQuantity));
  const priceVisible = await page.getByText('Total Price: 3.98¤', { exact: true }).isVisible().catch(() => bodyText.includes('Total Price: 3.98¤'));
  const targetAbsent = !bodyText.includes(targetName);
  const faultDetected = targetAbsent;
  return {
    oracle: condition === 'functional-fault' ? 'visible-ui-basket-quantity-fault-postcondition' : 'visible-ui-basket-quantity-postcondition',
    authority: 'visible-state', condition, target_name: targetName, expected_quantity: expectedQuantity, location,
    basket_route: basketRoute, heading_visible: headingVisible, target_visible: targetVisible,
    quantity_visible: quantityVisible, price_visible: priceVisible,
    expected_verdict: condition === 'functional-fault' ? 'fault' : 'clean',
    fault_detected: condition === 'functional-fault' ? faultDetected : false,
    passed: condition === 'functional-fault'
      ? faultDetected
      : Boolean(basketRoute && headingVisible && targetVisible && quantityVisible && priceVisible)
  };
}

export { TARGET as JUICE_SHOP_BASKET_QUANTITY_TARGET };
