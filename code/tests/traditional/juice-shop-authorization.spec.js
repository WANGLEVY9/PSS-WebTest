import { expect, test } from '@playwright/test';
import { installJuiceShopAuthorizationFault } from '../../src/mutations/juice-shop.mjs';

const enabled = process.env.RUN_JUICE_SHOP_AUTHORIZATION === '1';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
test.skip(!enabled, 'Set RUN_JUICE_SHOP_AUTHORIZATION=1 after the Juice Shop reset gate passes.');

test('anonymous administration access remains denied', async ({ page }) => {
  if (condition === 'functional-fault') await installJuiceShopAuthorizationFault(page);
  await page.goto('/#/administration');
  if (condition === 'functional-fault') {
    await expect(page.locator('body')).not.toContainText('You are not allowed to access this page!');
  } else {
    await expect(page).toHaveURL(/#\/administration/);
    await expect(page.getByText('403', { exact: true })).toBeVisible();
    await expect(page.getByText('You are not allowed to access this page!', { exact: true })).toBeVisible();
  }
});
