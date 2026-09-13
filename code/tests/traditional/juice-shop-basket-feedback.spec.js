import { expect, test } from '@playwright/test';
import { installJuiceShopFeedbackDelay, installJuiceShopLayoutEvolution, installJuiceShopProductOmission } from '../../src/mutations/juice-shop.mjs';

const enabled = process.env.RUN_JUICE_SHOP_BASKET_FEEDBACK === '1';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
test.skip(!enabled, 'Set RUN_JUICE_SHOP_BASKET_FEEDBACK=1 after the Juice Shop reset gate passes.');

test('add the declared product and wait for delayed basket confirmation', async ({ page }) => {
  await installJuiceShopFeedbackDelay(page);
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
    await expect(page.getByText('Placed Apple Juice (1000ml) into basket.', { exact: true })).toHaveCount(0);
    return;
  }
  await target.locator('xpath=ancestor::mat-card').getByRole('button', { name: 'Add to Basket' }).click();
  await expect(page.getByText('Placed Apple Juice (1000ml) into basket.', { exact: true })).toBeVisible({ timeout: 5000 });
});
