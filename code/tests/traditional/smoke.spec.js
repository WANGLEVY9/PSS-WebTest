import { expect, test } from '@playwright/test';

test.skip(!process.env.SUT_BASE_URL, 'Set SUT_BASE_URL to run against a self-hosted application.');

test('homepage exposes a stable accessible landmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
});
