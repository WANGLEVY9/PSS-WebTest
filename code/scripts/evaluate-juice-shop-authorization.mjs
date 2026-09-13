import { chromium } from 'playwright';
import { evaluateJuiceShopAuthorization } from '../src/oracles/juice-shop-authorization.mjs';
import { installJuiceShopAuthorizationFault } from '../src/mutations/juice-shop.mjs';

const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  if (condition === 'functional-fault') await installJuiceShopAuthorizationFault(page);
  await page.goto(`${baseURL}/#/administration`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const oracle = await evaluateJuiceShopAuthorization(page, { condition });
  console.log(JSON.stringify({ application: 'juice-shop', task_id: 'juice-shop-authorization-guard', condition, ...oracle }));
  if (!oracle.passed) process.exitCode = 1;
} finally { await browser.close(); }
