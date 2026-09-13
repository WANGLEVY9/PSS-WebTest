import { chromium } from 'playwright';
import { evaluateJuiceShopPagination } from '../src/oracles/juice-shop-pagination.mjs';
import { installJuiceShopLayoutEvolution } from '../src/mutations/juice-shop.mjs';
import { installJuiceShopPaginationOmission } from '../src/mutations/juice-shop-pagination.mjs';

const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const targetName = process.env.PSS_JUICE_PAGINATION_TARGET ?? 'Lemon Juice (500ml)';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  if (condition === 'functional-fault') await installJuiceShopPaginationOmission(page, { omitName: targetName });
  if (condition === 'ui-evolution') await installJuiceShopLayoutEvolution(page);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('mat-card').first().waitFor({ state: 'visible', timeout: 15000 });
  const close = page.locator('button[aria-label="Close Welcome Banner"]');
  if (await close.isVisible().catch(() => false)) await close.click({ force: true });
  await page.locator('button[aria-label="Next page"]').evaluate((element) => element.click());
  await page.waitForTimeout(350);
  const result = await evaluateJuiceShopPagination(page, { condition, targetName });
  console.log(JSON.stringify({ application: 'juice-shop', task_id: 'juice-shop-pagination', condition, ...result }));
  if (!result.passed) process.exitCode = 1;
} finally { await browser.close(); }
