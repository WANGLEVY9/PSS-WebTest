import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { appendRunRecord, createTraditionalRunRecord } from '../src/traditional-run-record.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';
import { applyPrestashopMutation } from '../src/prestashop-mutations.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

dotenv.config({ path: process.env.PSS_PRESTASHOP_ENV ?? new URL('../../third_party/WebTestPilot/webapps/prestashop/.env', import.meta.url).pathname });
const execFileAsync = promisify(execFile);
const baseURL = process.env.PRESTASHOP_BASE_URL ?? 'http://localhost:8083';
const username = process.env.PSS_PRESTASHOP_USERNAME;
const password = process.env.PSS_PRESTASHOP_PASSWORD;
const query = process.env.PSS_PRESTASHOP_QUERY ?? 'Mug';
const expectedName = process.env.PSS_PRESTASHOP_EXPECTED_PRODUCT ?? 'Mug The adventure begins';
const runId = process.env.PSS_RUN_ID ?? `prestashop-playwright-${Date.now()}`;
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const taskId = 'prestashop-buyer-search-product';
const mutationId = process.env.PSS_UI_MUTATION ?? null;
if (!username || !password) throw new Error('PrestaShop credentials are missing; set PSS_PRESTASHOP_USERNAME/PSS_PRESTASHOP_PASSWORD locally.');

const startedAt = Date.now();
let actions = 0;
let failure = null;
let oracle = null;
const trace = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const replay = createLocalReplayRecorder({ runId, applicationId: 'prestashop', taskId, arm: 'playwright' });

async function state() {
  return {
    milestone: page.url().includes('/login') ? 'login' : page.url().includes('/search') ? 'search-results' : 'other',
    url_path: new URL(page.url()).pathname,
    authenticated: await page.locator('body#authentication').count() === 0 && page.url().includes('/search'),
    search_results_heading_visible: await page.getByRole('heading', { name: 'Search results', exact: true }).isVisible().catch(() => false),
    target_product_visible: await page.locator('#js-product-list .product-title').filter({ hasText: expectedName }).first().isVisible().catch(() => false),
    product_count: await page.locator('#js-product-list .js-product').count().catch(() => 0)
  };
}

async function capture(phase, step, action = null) {
  const current = await state();
  trace.push({ phase, step, action, state: current });
  await replay.capture({ page, phase, step, action, state: current });
}

async function click(locator, label) {
  const step = actions;
  await capture('before-action', step);
  actions += 1;
  await locator.click();
  await capture('after-action', step, { type: 'click', label });
}

async function fill(locator, value, label) {
  const step = actions;
  await capture('before-action', step);
  actions += 1;
  await locator.fill(value);
  await capture('after-action', step, { type: 'type', label });
}

async function independentOracle() {
  const escapedQuery = query.replaceAll("'", "''");
  const sql = `SELECT id_product,name FROM ps_product_lang WHERE id_lang=1 AND name LIKE '%${escapedQuery}%' ORDER BY id_product;`;
  const { stdout } = await execFileAsync('docker', ['exec', process.env.PSS_PRESTASHOP_DB_CONTAINER ?? 'prestashop-db-1', 'mysql', '-N', '-u', 'root', '-proot', 'prestashop', '-e', sql], { maxBuffer: 1024 * 1024 });
  const rows = stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [id_product, ...nameParts] = line.split('\t');
    return { id_product: Number(id_product), name: nameParts.join('\t') };
  }).filter((row) => Number.isInteger(row.id_product) && row.name);
  return { oracle: 'database-product-search', expected_name: expectedName, observed_rows: rows, passed: rows.some((row) => row.name === expectedName) };
}

try {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await fill(page.locator('#field-email'), username, 'email');
  await fill(page.locator('#field-password'), password, 'password');
  await click(page.locator('#submit-login'), 'login');
  await page.waitForLoadState('domcontentloaded');
  await page.goto(`${baseURL}/search?s=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Search results', exact: true }).waitFor({ state: 'visible' });
  if (mutationId) await applyPrestashopMutation(page, mutationId);
  oracle = await independentOracle();
} catch (error) {
  failure = { name: error.name, message: error.message };
}

const pageState = await state().catch(() => ({}));
const visiblePassed = pageState.search_results_heading_visible === true && pageState.target_product_visible === true && pageState.product_count > 0;
const executionExitCode = failure ? 1 : 0;
const runRecord = createTraditionalRunRecord({
  run_id: runId,
  application_id: 'prestashop',
  application_version: '8-local-arm-unpinned',
  task_id: taskId,
  execution_exit_code: executionExitCode,
  oracle: { passed: visiblePassed && oracle?.passed === true },
  wall_time_ms: Date.now() - startedAt,
  actions,
  condition,
  runner_version: 'prestashop-playwright-cell-v0.1',
  trace: [{ kind: 'scripted-sequence', action_count: actions, replay_steps: trace.length, page_state: pageState, independent_oracle: oracle }]
});
replay.finalize({ status: runRecord.status, checkpointReached: runRecord.checkpoint_reached, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: 'clean', failureCategory: runRecord.failure_category, error: failure, oraclePassed: oracle?.passed ?? null });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'prestashop', task_id: taskId, arm: 'playwright', status: runRecord.status, emitted_verdict: runRecord.emitted_verdict, actions, replay_steps: trace.length, wall_time_ms: runRecord.timing.wall_time_ms, page_state: pageState, independent_oracle: oracle, failure }));
await browser.close();
if (runRecord.status !== 'completed') process.exitCode = 1;
