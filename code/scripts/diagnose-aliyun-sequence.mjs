import 'dotenv/config';
import { chromium } from 'playwright';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';

const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const viewport = { width: 1280, height: 720 };
const maxSteps = Number.parseInt(process.env.DIAGNOSTIC_STEPS ?? '8', 10);
if (!username || !password) throw new Error('BookStack credentials must be configured in code/.env');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
const raw = [];
const fetchImpl = async (url, options) => {
  const response = await fetch(url, options);
  const payload = await response.clone().json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  raw.push({
    status: response.status,
    finish_reason: payload?.choices?.[0]?.finish_reason ?? null,
    content_length: typeof content === 'string' ? content.length : null,
    content_prefix: typeof content === 'string' ? content.slice(0, 180) : null,
    content_suffix: typeof content === 'string' ? content.slice(-180) : null
  });
  return response;
};
const screenshot = async () => `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 60, animations: 'disabled' })).toString('base64')}`;
const executeAction = async (action) => {
  if (action.type === 'click') { await page.mouse.click(action.x, action.y); return page.waitForTimeout(350); }
  if (action.type === 'double_click') { await page.mouse.dblclick(action.x, action.y); return page.waitForTimeout(350); }
  if (action.type === 'type') { await page.keyboard.type(action.text); return page.waitForTimeout(200); }
  if (action.type === 'keypress') { await page.keyboard.press(action.key); return page.waitForTimeout(350); }
  if (action.type === 'scroll') { await page.mouse.wheel(0, action.delta_y); return page.waitForTimeout(350); }
  if (action.type === 'wait') return page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
  throw new Error(`Unsupported action: ${action.type}`);
};
try {
  await page.goto(`${baseURL}/`);
  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByRole('link', { name: 'Books', exact: true }).waitFor();
  const driver = createVolcengineCuaDriver({ observeScreenshot: screenshot, executeAction, fetchImpl, timeoutMs: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? '20000', 10) });
  const trace = [];
  let failure = null;
  let result = null;
  for (let step = 0; step < maxSteps; step += 1) {
    try {
      const observation = await driver.observe();
      const decision = await driver.decide({
        intent: 'Starting from the authenticated BookStack home page, create a new page in the first book. Open Books, open the first Book, choose New Page, set the page title to "PSS Phase2 Page", enter the page content "PSS Phase2 Content", save the page, and finish only after the saved page visibly shows both title and content. Return done with verdict pass only then.',
        observation,
        step
      });
      trace.push({ step, decision, url: page.url() });
      if (decision.type === 'done') { result = decision; break; }
      await driver.act(decision.action);
    } catch (error) {
      failure = { name: error.name, message: error.message, step };
      break;
    }
  }
  console.log(JSON.stringify({ provider: process.env.CUA_PROVIDER, model: process.env.CUA_MODEL, raw, trace, failure, final_url: page.url() }));
} finally {
  await browser.close();
}
