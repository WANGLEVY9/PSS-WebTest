import { expect, test } from '@playwright/test';
import { installJuiceShopLayoutEvolution, installJuiceShopProductOmission } from '../../src/mutations/juice-shop.mjs';

const enabled = process.env.RUN_JUICE_SHOP_PRODUCT_DETAIL === '1';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
test.skip(!enabled, 'Set RUN_JUICE_SHOP_PRODUCT_DETAIL=1 after the Juice Shop reset gate passes.');

test('open the declared product detail dialog', async ({ page }) => {
  if (condition === 'functional-fault') await installJuiceShopProductOmission(page);
  if (condition === 'ui-evolution') await installJuiceShopLayoutEvolution(page);
  await page.goto('/');
  for (const text of ['Dismiss', 'Me want it!']) {
    const control = page.getByText(text, { exact: true });
    await control.waitFor({ state: 'visible', timeout: 5000 }).then(() => control.click({ force: true })).catch(() => {});
  }
  const target = page.getByText('Apple Juice (1000ml)', { exact: true });
  if (condition === 'functional-fault') {
    await expect(target).toHaveCount(0);
    return;
  }
  await target.locator('xpath=ancestor::mat-card').locator('section[role="button"]').click();
  const dialog = page.locator('mat-dialog-container[role="dialog"]:has(app-product-details)');
  await expect(dialog).toContainText('Apple Juice (1000ml)');
  await expect(dialog).toContainText('1.99¤');
});
