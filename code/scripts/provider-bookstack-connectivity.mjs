import 'dotenv/config';
import { chromium } from 'playwright';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';

const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const timeoutMs = Number.parseInt(process.env.CUA_TIMEOUT_MS ?? '15000', 10);
const viewport = { width: 1280, height: 720 };
const intent = 'Inspect the current BookStack login page. Return one valid JSON action identifying the visible Log in button, or a done decision if no safe action can be identified. Do not submit credentials.';

async function screenshot(page) {
  return `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 60, animations: 'disabled' })).toString('base64')}`;
}

async function runArm(arm, browser) {
  const page = await browser.newPage({ viewport });
  const started = Date.now();
  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    const executeAction = async () => {};
    const driverOptions = { executeAction, timeoutMs };
    if (arm === 'visual') {
      driverOptions.observeScreenshot = () => screenshot(page);
    } else {
      driverOptions.observeHybrid = async () => ({
        screenshot: await screenshot(page),
        pageStructure: await page.locator('body').ariaSnapshot().catch(() => 'aria-snapshot-unavailable'),
        viewport
      });
    }
    const driver = arm === 'visual'
      ? createVolcengineCuaDriver(driverOptions)
      : createVolcengineHybridDriver(driverOptions);
    const observation = await driver.observe();
    const decision = await driver.decide({ intent, observation, step: 0 });
    return {
      arm,
      status: 'ok',
      url: page.url(),
      elapsed_ms: Date.now() - started,
      retries: driver.getRetryCount(),
      decision_type: decision.type,
      action_type: decision.type === 'action' ? decision.action.type : null,
      coordinate_mode: decision.type === 'action' ? decision.action.coordinate_mode ?? null : null,
      observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure'
    };
  } catch (error) {
    return { arm, status: 'error', url: page.url(), elapsed_ms: Date.now() - started, error_name: error.name, error_message: error.message };
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const arm of ['visual', 'hybrid']) results.push(await runArm(arm, browser));
await browser.close();
console.log(JSON.stringify({ provider: process.env.CUA_PROVIDER, model: process.env.CUA_MODEL, base_url: process.env.CUA_BASE_URL, sut: baseURL, results }));
if (results.some((result) => result.status !== 'ok')) process.exitCode = 1;
