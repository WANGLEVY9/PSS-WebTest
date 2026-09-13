import { chromium } from 'playwright';
import { evaluateJuiceShopBasketQuantity } from '../src/oracles/juice-shop-basket-quantity.mjs';
import { installJuiceShopLayoutEvolution, installJuiceShopProductOmission } from '../src/mutations/juice-shop.mjs';

const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  if (condition === 'functional-fault') await installJuiceShopProductOmission(page);
  if (condition === 'ui-evolution') await installJuiceShopLayoutEvolution(page);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('mat-card').first().waitFor({ state: 'visible', timeout: 15000 });
  for (const text of ['Dismiss', 'Me want it!']) {
    const control = page.getByText(text, { exact: true });
    await control.waitFor({ state: 'visible', timeout: 1000 }).then(() => control.click({ force: true })).catch(() => {});
  }
  const target = page.getByText('Apple Juice (1000ml)', { exact: true });
  if (condition !== 'functional-fault' && await target.isVisible().catch(() => false)) {
    const add = target.locator('xpath=ancestor::mat-card').getByRole('button', { name: 'Add to Basket' });
    await add.click();
    await page.waitForTimeout(200);
    await add.click();
    await page.getByRole('button', { name: 'Show the shopping cart' }).click();
    await page.waitForTimeout(250);
  }
  const oracle = await evaluateJuiceShopBasketQuantity(page, { condition });
  console.log(JSON.stringify({ application: 'juice-shop', task_id: 'juice-shop-basket-quantity', condition, ...oracle }));
  if (!oracle.passed) process.exitCode = 1;
} finally { await browser.close(); }
