import { expect, test } from '@playwright/test';
import { installJuiceShopLayoutEvolution, installJuiceShopProductOmission } from '../../src/mutations/juice-shop.mjs';

const enabled = process.env.RUN_JUICE_SHOP_BASKET_QUANTITY === '1';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
test.skip(!enabled, 'Set RUN_JUICE_SHOP_BASKET_QUANTITY=1 after the Juice Shop reset gate passes.');

test('add the declared product twice and verify quantity propagation', async ({ page }) => {
  if (condition === 'functional-fault') await installJuiceShopProductOmission(page);
  if (condition === 'ui-evolution') await installJuiceShopLayoutEvolution(page);
  await page.goto('/');
  for (const text of ['Dismiss', 'Me want it!']) {
    const control = page.getByText(text, { exact: true });
    await control.waitFor({ state: 'visible', timeout: 5000 }).then(() => control.click({ force: true })).catch(() => {});
  }
  const target = page.getByText('Apple Juice (1000ml)', { exact: true });
  if (condition === 'functional-fault') { await expect(target).toHaveCount(0); return; }
  const add = target.locator('xpath=ancestor::mat-card').getByRole('button', { name: 'Add to Basket' });
  await add.click();
  await page.waitForTimeout(200);
  await add.click();
  await page.getByRole('button', { name: 'Show the shopping cart' }).click();
  await expect(page).toHaveURL(/#\/basket/);
  await expect(page.getByText('Your Basket (anonymous)', { exact: true })).toBeVisible();
  await expect(page.getByText('Apple Juice (1000ml)', { exact: true })).toBeVisible();
  await expect(page.getByText('Total Price: 3.98¤', { exact: true })).toBeVisible();
  await expect(page.locator('.cell-initial-font').filter({ hasText: /^\s*2\s*$/ })).toBeVisible();
});
