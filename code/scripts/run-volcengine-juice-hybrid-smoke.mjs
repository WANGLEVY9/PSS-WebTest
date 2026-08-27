import dotenv from 'dotenv';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createAgentAdapter } from '../src/arms/agent-adapter.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';
import { evaluateJuiceShopUiSearch } from '../src/oracles/juice-shop-ui-search.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { classifyAgentFailure } from '../src/failure-taxonomy.mjs';
import { deriveAgentOutcome } from '../src/outcome-admission.mjs';

dotenv.config();
const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? '16', 10);
const prepareSearch = process.env.CUA_PREPARE_SEARCH === '1';
const taskMode = process.env.CUA_TASK_MODE ?? 'full-search';
const oraclePollMs = Number.parseInt(process.env.PSS_ORACLE_POLL_MS ?? '5000', 10);
const viewport = { width: 1280, height: 720 };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
const trace = [];

const driver = createVolcengineHybridDriver({
  observeHybrid: async () => ({
    screenshot: (await page.screenshot({ type: 'png' })).toString('base64'),
    pageStructure: await page.locator('body').ariaSnapshot().catch(() => 'aria-snapshot-unavailable'),
    viewport
  }),
  wallTimeoutMs: Number.parseInt(process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0', 10),
  executeAction: async (action) => {
    if (['click', 'double_click'].includes(action.type) && (action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height)) {
      throw new Error(`pointer action outside viewport: ${action.x},${action.y}`);
    }
    if (action.type === 'click') return page.mouse.click(action.x, action.y);
    if (action.type === 'double_click') return page.mouse.dblclick(action.x, action.y);
    if (action.type === 'type') return page.keyboard.type(action.text);
    if (action.type === 'keypress') {
      const keyAliases = { ENTER: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab', SPACE: 'Space', BACKSPACE: 'Backspace' };
      return page.keyboard.press(keyAliases[action.key.toUpperCase()] ?? action.key);
    }
    if (action.type === 'scroll') return page.mouse.wheel(0, action.delta_y);
    if (action.type === 'wait') return page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
    throw new Error(`Unsupported action: ${action.type}`);
  }
});

let result;
let failure;
try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  if (prepareSearch) {
    const dismiss = page.getByText('Dismiss', { exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click({ force: true });
    const cookies = page.getByText('Me want it!', { exact: true });
    if (await cookies.isVisible().catch(() => false)) await cookies.click({ force: true });
    await page.keyboard.press('Escape').catch(() => {});
    await page.getByRole('button', { name: 'Open search' }).click({ force: true });
    if (taskMode === 'submit-only') await page.getByRole('textbox').first().fill('apple');
  }
  const adapter = createAgentAdapter({ arm: 'hybrid', driver, maxSteps });
  result = await adapter.run({
    intent: taskMode === 'submit-only'
      ? 'The product search box is already open and already contains apple. Press the Enter key exactly once, wait for the results, then return done with verdict pass.'
      : prepareSearch
      ? 'The product search box is already open. Type apple into it and press Enter. Finish only after the search results for apple are visible; then return done with verdict pass.'
      : 'In the Juice Shop product catalog, search for apple. Handle any welcome or cookie overlays. Finish only after the search results for apple are visible; then return done with verdict pass.',
    onStep: async ({ step, action }) => { trace.push({ step, action, url: page.url() }); }
  });
} catch (error) {
  failure = { name: error.name, message: error.message };
}

const oracleDeadline = Date.now() + oraclePollMs;
let uiOracle = await evaluateJuiceShopUiSearch(page, { query: 'apple' });
while (uiOracle?.passed !== true && Date.now() < oracleDeadline) {
  await page.waitForTimeout(250);
  uiOracle = await evaluateJuiceShopUiSearch(page, { query: 'apple' });
}
const { taskStateReached, protocolCompleted, oracleOnlySuccess, cellPassed } = deriveAgentOutcome({ failure, result, oraclePassed: uiOracle?.passed === true });
const failureCategory = classifyAgentFailure({ failure, result, oraclePassed: taskStateReached });
const runRecord = createRunRecord({
  run_id: `juice-shop-hybrid-${Date.now()}`,
  application_id: 'juice-shop',
  application_version: '20.0.0',
  task_id: 'juice-shop-product-search',
  condition: 'clean-stable',
  arm: 'hybrid',
  status: failure ? 'test-failure' : (result?.status === 'timeout' ? 'timeout' : (uiOracle?.passed ? 'completed' : 'test-failure')),
  checkpoint_reached: taskStateReached,
  emitted_verdict: result?.emitted_verdict === 'pass' ? 'clean' : (result?.emitted_verdict ?? 'not-emitted'),
  ground_truth_verdict: 'clean',
  timing: { wall_time_ms: result?.wall_time_ms ?? 0, actions: trace.length, retries: result?.retries ?? 0 },
  provenance: { runner_version: 'volcengine-juice-hybrid-v0.2', observation_contract: 'screenshot-plus-structure', model_id: process.env.CUA_MODEL ?? null },
  failure_category: cellPassed ? null : failureCategory,
  trace
});
console.log(JSON.stringify({ application: 'juice-shop', arm: 'hybrid', task_mode: taskMode, result: result ?? null, failure: failure ?? null, trace, ui_oracle: uiOracle, task_state_reached: taskStateReached, protocol_completed: protocolCompleted, oracle_only_success: oracleOnlySuccess, cell_passed: cellPassed, run_record: runRecord }));
if (process.env.PSS_RUN_RECORD_OUT) fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(runRecord)}\n`, { mode: 0o600 });
await browser.close();
if (!cellPassed) process.exitCode = 1;
