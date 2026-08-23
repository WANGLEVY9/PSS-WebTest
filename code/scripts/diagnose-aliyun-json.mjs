import 'dotenv/config';
import { chromium } from 'playwright';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';

const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const viewport = { width: 1280, height: 720 };
const timeoutMs = Number.parseInt(process.env.CUA_TIMEOUT_MS ?? '15000', 10);
const maxOutputTokens = Number.parseInt(process.env.CUA_MAX_OUTPUT_TOKENS ?? '512', 10);
if (!username || !password) throw new Error('BookStack credentials must be configured in code/.env');

async function capture(page) {
  return `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 60, animations: 'disabled' })).toString('base64')}`;
}

async function diagnose(arm, page) {
  let raw;
  const fetchImpl = async (url, options) => {
    const response = await fetch(url, options);
    const payload = await response.clone().json().catch(() => null);
    const content = payload?.choices?.[0]?.message?.content;
    raw = {
      status: response.status,
      finish_reason: payload?.choices?.[0]?.finish_reason ?? null,
      content_length: typeof content === 'string' ? content.length : null,
      content_prefix: typeof content === 'string' ? content.slice(0, 160) : null,
      content_suffix: typeof content === 'string' ? content.slice(-160) : null
    };
    return response;
  };
  const executeAction = async () => {};
  const options = { env: process.env, executeAction, fetchImpl, timeoutMs };
  if (arm === 'visual') options.observeScreenshot = () => capture(page);
  else options.observeHybrid = async () => ({
    screenshot: await capture(page),
    pageStructure: await page.locator('body').ariaSnapshot().catch(() => 'aria-snapshot-unavailable'),
    viewport
  });
  const driver = arm === 'visual'
    ? createVolcengineCuaDriver(options)
    : createVolcengineHybridDriver(options);
  const observation = await driver.observe();
  let decision = null;
  let error = null;
  try {
    decision = await driver.decide({
      intent: 'Starting from the authenticated BookStack home page, open Books. Return exactly one complete JSON action object and do not perform any other action.',
      observation,
      step: 0
    });
  } catch (caught) {
    error = { name: caught.name, message: caught.message };
  }
  return { arm, max_output_tokens: maxOutputTokens, raw, decision, error };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
try {
  await page.goto(`${baseURL}/`);
  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByRole('link', { name: 'Books', exact: true }).waitFor();
  const results = [];
  for (const arm of ['visual', 'hybrid']) results.push(await diagnose(arm, page));
  console.log(JSON.stringify({ provider: process.env.CUA_PROVIDER, model: process.env.CUA_MODEL, base_url: process.env.CUA_BASE_URL, sut: baseURL, results }));
} finally {
  await browser.close();
}
