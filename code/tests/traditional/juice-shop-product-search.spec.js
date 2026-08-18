import { expect, test } from '@playwright/test';

const enabled = process.env.RUN_JUICE_SHOP_VERTICAL_SLICE === '1';
const query = process.env.PSS_JUICE_SHOP_QUERY ?? 'apple';

test.skip(!enabled, 'Set RUN_JUICE_SHOP_VERTICAL_SLICE=1 after the Juice Shop reset gate passes.');

test('search the product catalog with accessibility-first locators', async ({ page }) => {
  await page.goto('/');
  const dismiss = page.getByText('Dismiss', { exact: true });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click({ force: true });
  const cookies = page.getByText('Me want it!', { exact: true });
  if (await cookies.isVisible().catch(() => false)) await cookies.click({ force: true });
  await page.getByRole('button', { name: 'Open search' }).click();
  // Juice Shop v20 exposes the search input as an unnamed textbox; role is
  // retained here and the absence of an accessible name is recorded as a UI
  // accessibility limitation rather than hidden with a CSS selector.
  const searchBox = page.getByRole('textbox').first();
  await searchBox.fill(query);
  await searchBox.press('Enter');
  await expect(page.getByText('Apple Juice (1000ml)', { exact: true })).toBeVisible();
  await expect(page.getByText('Apple Pomace', { exact: true })).toBeVisible();
  await expect(page.getByText('Pineapple Juice (1000ml)', { exact: true })).toBeVisible();
  await expect(page.getByText('Banana Juice (1000ml)', { exact: true })).toHaveCount(0);
});
