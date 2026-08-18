import { expect, test } from '@playwright/test';

const enabled = process.env.RUN_INDICO_FAULT_WORKFLOW === '1';
const username = process.env.PSS_INDICO_USERNAME;
const password = process.env.PSS_INDICO_PASSWORD;
const title = process.env.PSS_INDICO_EVENT_TITLE ?? 'PSS Phase2 Event';
const date = process.env.PSS_INDICO_EVENT_DATE ?? '15/01/2030';

test.skip(!enabled || !username || !password, 'Set RUN_INDICO_FAULT_WORKFLOW=1 and local Indico credentials.');

test('fault workflow exposes the independent event-title mismatch', async ({ page }) => {
  await page.goto('/login/');
  await page.getByRole('textbox', { name: 'Username or email' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login with Indico' }).click();
  await expect(page.getByRole('button', { name: 'Create event' })).toBeVisible();

  await page.getByRole('link', { name: 'Create event' }).last().click();
  await page.getByRole('link', { name: 'Lecture', exact: true }).click();
  await expect(page.getByText('Create new lecture', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /Title/i }).fill(title);
  await page.getByPlaceholder('DD/MM/YYYY').fill(date);
  await page.getByRole('button', { name: 'Create event', exact: true }).click();

  await expect(page.getByText(`${title} [FAULT]`, { exact: true }).last()).toBeVisible();
  await expect(page.getByText('15 January 2030', { exact: true })).toBeVisible();
});
