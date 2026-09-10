import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createAgentAdapter } from '../src/arms/agent-adapter.mjs';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { classifyAgentFailure } from '../src/failure-taxonomy.mjs';
import { deriveAgentOutcome } from '../src/outcome-admission.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';

dotenv.config();
const execFileAsync = promisify(execFile);
const arm = process.env.PSS_ARM ?? 'visual';
if (!['visual', 'hybrid'].includes(arm)) throw new Error('PSS_ARM must be visual or hybrid');
const baseURL = process.env.PRESTASHOP_BASE_URL ?? 'http://localhost:8083';
const username = process.env.PSS_PRESTASHOP_USERNAME;
const password = process.env.PSS_PRESTASHOP_PASSWORD;
if (!username || !password) throw new Error('Set PSS_PRESTASHOP_USERNAME/PSS_PRESTASHOP_PASSWORD in the process environment.');
const query = process.env.PSS_PRESTASHOP_QUERY ?? 'Mug';
const expectedName = process.env.PSS_PRESTASHOP_EXPECTED_PRODUCT ?? 'Mug The adventure begins';
const viewport = { width: 1280, height: 720 };
const complexity = process.env.PSS_AGENT_COMPLEXITY ?? 'simple';
const taskDefinitions = {
  simple: {
    taskId: 'prestashop-search-product',
    intent: `The browser is authenticated and the PrestaShop catalog home page is visible. Search for "${query}". Finish only after the search results visibly include the product "Mug The Adventure Begins"; then return done with verdict pass. Do not inspect source code, databases, or hidden evaluator state.`
  },
  medium: {
    taskId: 'prestashop-search-open-product',
    intent: `The browser is authenticated and the PrestaShop catalog home page is visible. Search for "${query}", then open the visible product "Mug The Adventure Begins". Finish only after that product's detail page is visibly open; then return done with verdict pass. Do not inspect source code, databases, or hidden evaluator state.`
  },
  complex: {
    taskId: 'prestashop-search-revisit-product',
    intent: `The browser is authenticated and the PrestaShop catalog home page is visible. Search for "${query}", open the visible product "Mug The Adventure Begins", use the browser Back control or an equivalent visible navigation action to return to the search results, and reopen the same product. Finish only after the product detail page is visibly open for the second time; then return done with verdict pass. Do not inspect source code, databases, or hidden evaluator state.`
  }
};
if (!taskDefinitions[complexity]) throw new Error(`PSS_AGENT_COMPLEXITY must be simple, medium, or complex (got ${complexity})`);
const { taskId, intent } = taskDefinitions[complexity];
const runId = process.env.PSS_RUN_ID ?? `prestashop-${arm}-${Date.now()}`;
const replay = createLocalReplayRecorder({ runId, applicationId: 'prestashop', taskId, arm, maxFrames: 40 });
const trace = [];
let pendingProviderEventIds = [];
const optimization = resolveAgentOptimization({ env: { ...process.env, PSS_AGENT_PROFILE: process.env.PSS_AGENT_PROFILE ?? 'baseline-v0' }, arm, taskFamily: 'search-navigation' });
// Resolve the profile before constructing the adapter.  Earlier versions read
// the profile for screenshot quality only, while max steps, timeout, retry,
// and coordinate settings silently fell back to driver defaults.  That made a
// selected optimization profile non-reproducible and, in particular, left
// visual runs with the legacy eight-step budget.
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? String(optimization.max_steps), 10);
const postActionSettleMs = Number.parseInt(process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimization.post_action_settle_ms), 10);
const driverEnv = {
  ...process.env,
  CUA_MAX_OUTPUT_TOKENS: process.env.CUA_MAX_OUTPUT_TOKENS ?? String(optimization.max_output_tokens),
  CUA_COORDINATE_MODE: process.env.CUA_COORDINATE_MODE ?? String(optimization.coordinate_mode),
  CUA_HYBRID_ACTION_MODE: process.env.CUA_HYBRID_ACTION_MODE ?? String(optimization.hybrid_action_mode ?? 'coordinate')
};

async function pageState(page) {
  const pathname = new URL(page.url()).pathname;
  const searchResultsVisible = await page.getByRole('heading', { name: /Search results/i }).isVisible().catch(() => false);
  const targetProductVisible = await page.locator('#js-product-list .product-title').filter({ hasText: /Mug The Adventure Begins/i }).first().isVisible().catch(() => false);
  const productDetailVisible = await page.locator('h1').filter({ hasText: /Mug The Adventure Begins/i }).first().isVisible().catch(() => false);
  const milestone = productDetailVisible || pathname.includes('.html')
    ? 'product-detail'
    : pathname.includes('/search') || searchResultsVisible
      ? 'search-results'
      : pathname.includes('/login')
        ? 'login'
        : 'authenticated-home';
  return {
    milestone,
    url_path: pathname,
    authenticated: !pathname.includes('/login'),
    search_results_heading_visible: searchResultsVisible,
    target_product_visible: targetProductVisible,
    product_detail_visible: productDetailVisible,
    product_count: await page.locator('#js-product-list .js-product').count().catch(() => 0)
  };
}

async function structure(page) {
  const controls = await page.locator('a,button,input:not([type="hidden"]),textarea,[role="button"]').evaluateAll((elements) => {
    const visible = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return null;
      const role = element.tagName === 'A' ? 'link' : element.tagName === 'BUTTON' ? 'button' : element.getAttribute('role') || (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ? 'textbox' : element.tagName.toLowerCase());
      const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
      return { element, role, name, interaction: role === 'textbox' ? 'type' : 'click', center_normalized_1000: { x: Math.round((rect.x + rect.width / 2) * 1000 / innerWidth), y: Math.round((rect.y + rect.height / 2) * 1000 / innerHeight) } };
    }).filter(Boolean).slice(0, 120);
    visible.forEach((item, index) => { item.element.dataset.pssTargetId = `c${index}`; });
    return visible.map((item, index) => ({ ...item, element: undefined, target_id: `c${index}` }));
  });
  return { controls };
}

async function databaseOracle() {
  const escaped = query.replaceAll("'", "''");
  const sql = `SELECT id_product,name FROM ps_product_lang WHERE id_lang=1 AND name LIKE '%${escaped}%' ORDER BY id_product;`;
  const { stdout } = await execFileAsync('docker', ['exec', process.env.PSS_PRESTASHOP_DB_CONTAINER ?? 'prestashop-db-1', 'mysql', '-N', '-u', 'root', '-proot', 'prestashop', '-e', sql], { maxBuffer: 1024 * 1024 });
  const rows = stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [id_product, ...name] = line.split('\t');
    return { id_product: Number(id_product), name: name.join('\t') };
  }).filter((row) => Number.isInteger(row.id_product) && row.name);
  return { oracle: 'database-product-search', expected_name: expectedName, observed_rows: rows, passed: rows.some((row) => row.name === expectedName) };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport });
const page = await context.newPage();
const replayState = () => pageState(page);
const observeScreenshot = async ({ step } = {}) => {
  const image = await page.screenshot({ type: 'jpeg', quality: Number(process.env.CUA_SCREENSHOT_QUALITY ?? optimization.screenshot_quality), animations: 'disabled' });
  await replay.capture({ page, buffer: image, phase: 'before-action', step, state: await replayState(), providerEventIds: pendingProviderEventIds.splice(0) });
  return `data:image/jpeg;base64,${image.toString('base64')}`;
};
const observeHybrid = async ({ step } = {}) => {
  const image = await page.screenshot({ type: 'jpeg', quality: Number(process.env.CUA_SCREENSHOT_QUALITY ?? optimization.screenshot_quality), animations: 'disabled' });
  await replay.capture({ page, buffer: image, phase: 'before-action', step, state: await replayState(), providerEventIds: pendingProviderEventIds.splice(0) });
  return { screenshot: image.toString('base64'), pageStructure: await structure(page), viewport };
};
const executeAction = async (action) => {
  if (['click', 'double_click'].includes(action.type) && (action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height)) throw new Error(`pointer action outside viewport: ${action.x},${action.y}`);
  if (arm === 'hybrid' && action.target_id && ['click', 'double_click'].includes(action.type)) {
    const target = page.locator(`[data-pss-target-id="${action.target_id}"]`).first();
    if (!await target.isVisible().catch(() => false)) throw new Error(`hybrid target is not visible: ${action.target_id}`);
    if (action.type === 'double_click') await target.dblclick(); else await target.click();
    return page.waitForTimeout(postActionSettleMs);
  }
  if (action.type === 'click') await page.mouse.click(action.x, action.y);
  else if (action.type === 'double_click') await page.mouse.dblclick(action.x, action.y);
  else if (action.type === 'type') await page.keyboard.type(action.text);
  else if (action.type === 'keypress') await page.keyboard.press(({ ENTER: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab', SPACE: 'Space', BACKSPACE: 'Backspace' })[action.key?.toUpperCase()] ?? action.key);
  else if (action.type === 'scroll') await page.mouse.wheel(0, action.delta_y);
  else if (action.type === 'wait') await page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
  else throw new Error(`Unsupported action: ${action.type}`);
  return page.waitForTimeout(Math.min(postActionSettleMs, action.type === 'type' ? 350 : postActionSettleMs));
};

let result = null;
let failure = null;
const startedAt = Date.now();
try {
  // Authentication is a matched preamble and is completed before any arm
  // observation is exposed, so credentials never enter a provider prompt.
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#field-email').fill(username);
  await page.locator('#field-password').fill(password);
  await page.locator('#submit-login').click();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[name="s"]').waitFor({ state: 'visible', timeout: 15000 });
  const driverOptions = {
    env: driverEnv,
    timeoutMs: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(optimization.timeout_ms), 10),
    maxRetries: Number.parseInt(process.env.CUA_MAX_RETRIES ?? String(optimization.max_retries), 10),
    maxDecisionRetries: Number.parseInt(process.env.CUA_MAX_DECISION_RETRIES ?? String(optimization.max_decision_retries), 10),
    coordinateMode: process.env.CUA_COORDINATE_MODE ?? optimization.coordinate_mode,
    wallTimeoutMs: Number.parseInt(process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? String(optimization.wall_timeout_ms ?? 0), 10),
    onProviderResponse: (summary) => { const id = replay.recordProviderEvent(summary); if (id) pendingProviderEventIds.push(id); },
    executeAction
  };
  const driver = arm === 'visual'
    ? createVolcengineCuaDriver({ ...driverOptions, observeScreenshot })
    : createVolcengineHybridDriver({ ...driverOptions, observeHybrid, hybridActionMode: process.env.CUA_HYBRID_ACTION_MODE ?? optimization.hybrid_action_mode ?? 'coordinate' });
  const adapter = createAgentAdapter({ arm, driver, maxSteps });
  result = await adapter.run({
    intent,
    onStep: async ({ step, action }) => { const state = await replayState(); trace.push({ step, action, url: page.url(), milestone: state.milestone, state }); await replay.capture({ page, phase: 'after-action', step, action, state, providerEventIds: pendingProviderEventIds.splice(0) }); }
  });
} catch (error) {
  failure = { name: error.name, message: error.message };
}
const state = await pageState(page).catch(() => ({}));
const oracle = await databaseOracle().catch((error) => ({ oracle: 'database-product-search', passed: false, error: { name: error.name, message: error.message.slice(0, 240) } }));
const detailMilestones = trace.filter((item) => item.milestone === 'product-detail').length;
const visiblePassed = complexity === 'simple'
  ? state.milestone === 'search-results' && state.target_product_visible === true
  : state.milestone === 'product-detail' && state.product_detail_visible === true && (complexity === 'medium' || detailMilestones >= 2);
const { taskStateReached, protocolCompleted, oracleOnlySuccess, cellPassed } = deriveAgentOutcome({ failure, result, oraclePassed: visiblePassed && oracle.passed === true });
const failureCategory = classifyAgentFailure({ failure, result, oraclePassed: taskStateReached });
const runRecord = createRunRecord({
  run_id: runId, application_id: 'prestashop', application_version: '8-local-arm-unpinned', task_id: taskId, condition: process.env.PSS_PILOT_CONDITION ?? 'clean-stable', arm,
  status: failure ? 'test-failure' : (result?.status === 'timeout' ? 'timeout' : (cellPassed ? 'completed' : 'test-failure')),
  checkpoint_reached: taskStateReached, emitted_verdict: result?.emitted_verdict === 'pass' ? 'clean' : (result?.emitted_verdict ?? 'not-emitted'), ground_truth_verdict: 'clean',
  timing: { wall_time_ms: result?.wall_time_ms ?? Date.now() - startedAt, actions: trace.length, retries: result?.retries ?? 0 },
  provenance: { runner_version: `prestashop-${arm}-agent-v0.1`, observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure', model_id: process.env.CUA_MODEL ?? null },
  failure_category: cellPassed ? null : failureCategory, trace
});
replay.finalize({ status: runRecord.status, checkpointReached: taskStateReached, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: runRecord.ground_truth_verdict, failureCategory: runRecord.failure_category, error: failure, oraclePassed: oracle.passed === true });
if (process.env.PSS_RUN_RECORD_OUT) { fs.mkdirSync(path.dirname(path.resolve(process.env.PSS_RUN_RECORD_OUT)), { recursive: true }); fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(runRecord)}\n`, { mode: 0o600 }); }
console.log(JSON.stringify({ application: 'prestashop', arm, result, failure, state, independent_oracle: oracle, task_state_reached: taskStateReached, protocol_completed: protocolCompleted, oracle_only_success: oracleOnlySuccess, cell_passed: cellPassed, run_record: runRecord }));
await browser.close();
if (!cellPassed) process.exitCode = 1;
