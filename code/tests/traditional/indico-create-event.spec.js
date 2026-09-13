import { expect, test } from '@playwright/test';
import { installIndicoLayoutEvolution } from '../../src/mutations/indico.mjs';

const enabled = process.env.RUN_INDICO_VERTICAL_SLICE === '1';
const username = process.env.PSS_INDICO_USERNAME;
const password = process.env.PSS_INDICO_PASSWORD;
const title = process.env.PSS_INDICO_EVENT_TITLE ?? 'PSS Phase2 Event';
const date = process.env.PSS_INDICO_EVENT_DATE ?? '15/01/2030';
const evolutionEnabled = process.env.RUN_INDICO_EVOLUTION_WORKFLOW === '1';

test.skip(!enabled || !username || !password, 'Set RUN_INDICO_VERTICAL_SLICE=1 and local PSS_INDICO_USERNAME/PSS_INDICO_PASSWORD.');

test('create a public event with accessibility-first locators', async ({ page }) => {
  if (evolutionEnabled) await installIndicoLayoutEvolution(page);
  await page.goto('/login/');
  // Indico 3.3.6 exposes placeholders but no accessible label for these
  // inputs.  Using the real DOM contract avoids a false green from a skipped
  // or pre-login timeout and keeps the scripted arm reproducible.
  await page.getByPlaceholder('Username or email').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Login with Indico' }).click();
  await expect(page.getByRole('button', { name: 'Create event' })).toBeVisible();

  await page.getByRole('link', { name: 'Create event' }).last().click();
  await page.getByRole('link', { name: 'Lecture', exact: true }).click();
  await expect(page.getByText('Create new lecture', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /Title/i }).fill(title);
  await page.getByPlaceholder('DD/MM/YYYY').fill(date);
  await page.getByRole('button', { name: 'Create event', exact: true }).click();

  await expect(page.getByText(title, { exact: true }).last()).toBeVisible();
  await expect(page.getByText('15 January 2030', { exact: true })).toBeVisible();
  if (evolutionEnabled) await expect(page.locator('#pss-indico-layout-v1')).toHaveCount(1);
});
