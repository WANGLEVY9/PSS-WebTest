import { chromium } from 'playwright';
import { evaluateJuiceShopUiSearch } from '../src/oracles/juice-shop-ui-search.mjs';

const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
const oracle = await evaluateJuiceShopUiSearch(page, { query: process.env.PSS_JUICE_SHOP_QUERY ?? 'apple' });
const cleanStateVerified = !oracle.query_in_route && oracle.passed === false;
const result = { application: 'juice-shop', gate: 'clean-ui-state', clean_state_verified: cleanStateVerified, location: oracle.location, query_in_route: oracle.query_in_route, evaluated_at: new Date().toISOString() };
console.log(JSON.stringify(result));
await browser.close();
if (!cleanStateVerified) process.exitCode = 1;
