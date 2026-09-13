const TARGET = 'Apple Juice (1000ml)';

/** Independent visible-state oracle for the product-detail dialog workflow. */
export async function evaluateJuiceShopProductDetail(page, {
  condition = 'clean-stable', targetName = TARGET
} = {}) {
  const dialog = page.locator('mat-dialog-container[role="dialog"]:has(app-product-details)');
  const dialogVisible = await dialog.isVisible().catch(() => false);
  const titleVisible = dialogVisible && await dialog.getByText(targetName, { exact: true }).isVisible().catch(() => false);
  const priceVisible = dialogVisible && await dialog.getByText('1.99¤', { exact: true }).isVisible().catch(() => false);
  const location = page.url();
  const faultDetected = !titleVisible && !priceVisible;
  return {
    oracle: condition === 'functional-fault' ? 'visible-ui-product-detail-fault-postcondition' : 'visible-ui-product-detail-postcondition',
    authority: 'visible-state', condition, target_name: targetName, location,
    dialog_visible: dialogVisible, title_visible: Boolean(titleVisible), price_visible: Boolean(priceVisible),
    expected_verdict: condition === 'functional-fault' ? 'fault' : 'clean',
    fault_detected: condition === 'functional-fault' ? faultDetected : false,
    passed: condition === 'functional-fault' ? faultDetected : Boolean(dialogVisible && titleVisible && priceVisible)
  };
}

export { TARGET as JUICE_SHOP_PRODUCT_DETAIL_TARGET };
