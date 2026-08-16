import { expect, test } from '@playwright/test';
import { installBookStackLayoutMutation } from '../../src/mutations/bookstack-layout.mjs';

const enabled = process.env.RUN_BOOKSTACK_VERTICAL_SLICE === '1';
const title = process.env.PSS_BOOKSTACK_PAGE_TITLE ?? 'PSS Phase2 Page';
const content = process.env.PSS_BOOKSTACK_PAGE_CONTENT ?? 'PSS Phase2 Content';

test.skip(!enabled, 'Set RUN_BOOKSTACK_VERTICAL_SLICE=1 after the BookStack reset gate passes.');

test('create and persist a page with accessibility-first locators', async ({ page, context }) => {
  if (process.env.PSS_UI_MUTATION === 'bookstack-layout-v1') {
    await installBookStackLayoutMutation(context);
  }
  await page.goto('/');
  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('admin@admin.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password');
  await page.getByRole('button', { name: 'Log In' }).click();

  await page.getByRole('link', { name: 'Books', exact: true }).click();
  await page.getByRole('link', { name: 'Book', exact: true }).first().click();
  await page.getByRole('link', { name: 'New Page' }).click();
  await page.getByRole('textbox', { name: 'Page Title' }).fill(title);
  await page.frameLocator('iframe[title="Rich Text Area"]').locator('body').fill(content);
  await page.getByRole('button', { name: 'Save Page' }).click();

  await expect(page.locator('#bkmrk-page-title')).toContainText(title);
  await expect(page.locator('main')).toContainText(content);
});
