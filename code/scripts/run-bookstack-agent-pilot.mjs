import dotenv from 'dotenv';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { createAgentAdapter } from '../src/arms/agent-adapter.mjs';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';
import { createRunRecord } from '../src/run-records.mjs';

dotenv.config();
const arm = process.env.BOOKSTACK_ARM;
if (!['visual', 'hybrid'].includes(arm)) throw new Error('BOOKSTACK_ARM must be visual or hybrid');
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
if (!username || !password) throw new Error('BookStack credentials must be configured in the local environment');
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const title = process.env.PSS_BOOKSTACK_PAGE_TITLE ?? 'PSS Phase2 Page';
const content = process.env.PSS_BOOKSTACK_PAGE_CONTENT ?? 'PSS Phase2 Content';
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? '14', 10);
const viewport = { width: 1280, height: 720 };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
const trace = [];
const screenshot = async () => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.waitForTimeout(250);
      return `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 60, animations: 'disabled' })).toString('base64')}`;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(attempt * 500);
    }
  }
  throw lastError;
};

await page.goto(`${baseURL}/`);
await page.getByRole('link', { name: 'Log in' }).click();
await page.getByRole('textbox', { name: 'Email' }).fill(username);
await page.getByRole('textbox', { name: 'Password' }).fill(password);
await page.getByRole('button', { name: 'Log In' }).click();
await page.getByRole('link', { name: 'Books', exact: true }).waitFor();

const executeAction = async (action) => {
  if (['click', 'double_click'].includes(action.type) && (action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height)) {
    throw new Error(`pointer action outside viewport: ${action.x},${action.y}`);
  }
  if (action.type === 'click') { await page.mouse.click(action.x, action.y); return page.waitForTimeout(350); }
  if (action.type === 'double_click') { await page.mouse.dblclick(action.x, action.y); return page.waitForTimeout(350); }
  if (action.type === 'type') { await page.keyboard.type(action.text); return page.waitForTimeout(200); }
  if (action.type === 'keypress') {
    const aliases = { ENTER: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab', SPACE: 'Space', BACKSPACE: 'Backspace' };
    await page.keyboard.press(aliases[action.key.toUpperCase()] ?? action.key); return page.waitForTimeout(350);
  }
  if (action.type === 'scroll') return page.mouse.wheel(0, action.delta_y);
  if (action.type === 'wait') return page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
  throw new Error(`Unsupported action: ${action.type}`);
};

const driverOptions = { executeAction, timeoutMs: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? '15000', 10) };
if (arm === 'visual') {
  driverOptions.observeScreenshot = screenshot;
} else {
  driverOptions.observeHybrid = async () => ({
    screenshot: await screenshot(),
    pageStructure: await page.locator('body').ariaSnapshot().catch(() => 'aria-snapshot-unavailable'),
    viewport
  });
}
const driver = arm === 'visual' ? createVolcengineCuaDriver(driverOptions) : createVolcengineHybridDriver(driverOptions);
let result;
let failure;
try {
  const adapter = createAgentAdapter({ arm, driver, maxSteps });
  result = await adapter.run({
    intent: `Starting from the authenticated BookStack home page, create a new page in the first book. Open Books, open the first Book, choose New Page, set the page title to "${title}", enter the page content "${content}", save the page, and finish only after the saved page visibly shows both title and content. Return done with verdict pass only then.`,
    onStep: async ({ step, action }) => { trace.push({ step, action, url: page.url() }); }
  });
} catch (error) {
  failure = { name: error.name, message: error.message };
}

const oracle = await new Promise((resolve, reject) => {
  const child = spawn('node', ['scripts/evaluate-bookstack-page.mjs'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk; });
  child.on('error', reject);
  child.on('close', (code) => {
    const line = out.trim().split('\n').reverse().find((candidate) => candidate.startsWith('{'));
    resolve({ code, value: line ? JSON.parse(line) : null });
  });
});
const passed = !failure && result?.status === 'completed' && oracle.value?.passed === true;
const runRecord = createRunRecord({
  run_id: `bookstack-${arm}-${Date.now()}`,
  application_id: 'bookstack', application_version: '24.10.1', task_id: 'bookstack-create-page', condition: 'clean-stable', arm,
  status: failure ? 'test-failure' : (passed ? 'completed' : (result?.status === 'timeout' ? 'timeout' : 'test-failure')),
  checkpoint_reached: passed,
  emitted_verdict: result?.emitted_verdict === 'pass' ? 'clean' : (result?.emitted_verdict ?? 'not-emitted'),
  ground_truth_verdict: 'clean',
  timing: { wall_time_ms: result?.wall_time_ms ?? 0, actions: trace.length, retries: result?.retries ?? 0 },
  provenance: { runner_version: 'bookstack-agent-pilot-v0.1', observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure', model_id: process.env.CUA_MODEL ?? null },
  failure_category: failure ? 'execution' : (passed ? null : 'planning'), trace
});
console.log(JSON.stringify({ application: 'bookstack', arm, result: result ?? null, failure: failure ?? null, oracle, trace, run_record: runRecord }));
if (process.env.PSS_RUN_RECORD_OUT) fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(runRecord)}\n`, { mode: 0o600 });
await browser.close();
if (failure || !passed) process.exitCode = 1;
