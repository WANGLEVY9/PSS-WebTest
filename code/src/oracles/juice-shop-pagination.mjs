import { JUICE_SHOP_PAGINATION_TARGET } from '../mutations/juice-shop-pagination.mjs';

/** Independent visible-state oracle for the second-page catalog workflow. */
export async function evaluateJuiceShopPagination(page, {
  condition = 'clean-stable', targetName = JUICE_SHOP_PAGINATION_TARGET
} = {}) {
  const paginatorText = await page.locator('mat-paginator').innerText().catch(() => '');
  const secondPage = /16\s*[–-]\s*30\s+of\s+\d+/u.test(paginatorText);
  const targetVisible = await page.getByText(targetName, { exact: true }).isVisible().catch(() => false);
  const nextDisabled = await page.getByRole('button', { name: 'Next page' }).isDisabled().catch(() => false);
  const faultDetected = secondPage && !targetVisible;
  return {
    oracle: condition === 'functional-fault' ? 'visible-ui-pagination-fault-postcondition' : 'visible-ui-pagination-postcondition',
    authority: 'visible-state', condition, target_name: targetName,
    paginator_text: paginatorText, second_page: secondPage,
    target_visible: targetVisible, next_disabled: nextDisabled,
    expected_verdict: condition === 'functional-fault' ? 'fault' : 'clean',
    fault_detected: condition === 'functional-fault' ? faultDetected : false,
    passed: condition === 'functional-fault' ? faultDetected : Boolean(secondPage && targetVisible)
  };
}
