import { expect, test } from '@playwright/test';
import { installJuiceShopLayoutEvolution } from '../../src/mutations/juice-shop.mjs';
import { installJuiceShopPaginationOmission, JUICE_SHOP_PAGINATION_LAST_ITEM_TARGET } from '../../src/mutations/juice-shop-pagination.mjs';

const enabled = process.env.RUN_JUICE_SHOP_PAGINATION_LAST_ITEM === '1';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
test.skip(!enabled, 'Set RUN_JUICE_SHOP_PAGINATION_LAST_ITEM=1 after the Juice Shop reset gate passes.');

test('paginate to the second catalog page and inspect its last visible target', async ({ page }) => {
  if (condition === 'functional-fault') await installJuiceShopPaginationOmission(page, { omitName: JUICE_SHOP_PAGINATION_LAST_ITEM_TARGET });
  if (condition === 'ui-evolution') await installJuiceShopLayoutEvolution(page);
  await page.goto('/');
  for (const selector of ['button[aria-label="Close Welcome Banner"]', 'button[aria-label="Me want it!"]']) {
    const control = page.locator(selector);
    await control.waitFor({ state: 'visible', timeout: 3000 }).then(() => control.click({ force: true })).catch(() => {});
  }
  await page.locator('mat-card').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('button[aria-label="Next page"]').evaluate((element) => element.click());
  await expect(page.locator('mat-paginator')).toContainText(/16\s*[–-]\s*30\s+of\s+\d+/u);
  if (condition === 'functional-fault') await expect(page.getByText(JUICE_SHOP_PAGINATION_LAST_ITEM_TARGET, { exact: true })).toHaveCount(0);
  else await expect(page.getByText(JUICE_SHOP_PAGINATION_LAST_ITEM_TARGET, { exact: true })).toBeVisible();
});
