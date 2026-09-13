import { chromium } from 'playwright';
import { evaluateJuiceShopCondition } from '../src/oracles/juice-shop-condition.mjs';
import { installJuiceShopLayoutEvolution, installJuiceShopSearchOmission } from '../src/mutations/juice-shop.mjs';

const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const query = process.env.PSS_JUICE_SHOP_QUERY ?? 'apple';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  if (condition === 'functional-fault') await installJuiceShopSearchOmission(page);
  if (condition === 'ui-evolution') await installJuiceShopLayoutEvolution(page);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('mat-card').first().waitFor({ state: 'visible', timeout: 15000 });
  for (const text of ['Dismiss', 'Me want it!']) {
    const control = page.getByText(text, { exact: true });
    await control.waitFor({ state: 'visible', timeout: 1000 }).then(() => control.click({ force: true })).catch(() => {});
  }
  await page.getByRole('button', { name: 'Open search' }).click();
  const box = page.getByRole('textbox').first();
  await box.fill(query);
  await box.press('Enter');
  await page.waitForTimeout(400);
  const oracle = await evaluateJuiceShopCondition(page, { condition, query });
  console.log(JSON.stringify({ application: 'juice-shop', condition, ...oracle }));
  if (!oracle.passed) process.exitCode = 1;
} finally {
  await browser.close();
}
