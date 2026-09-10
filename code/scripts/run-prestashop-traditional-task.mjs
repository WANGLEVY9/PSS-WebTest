import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { appendRunRecord, createTraditionalRunRecord } from '../src/traditional-run-record.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';

dotenv.config();
const execFileAsync = promisify(execFile);
const baseURL = process.env.PRESTASHOP_BASE_URL ?? 'http://localhost:8083';
const username = process.env.PSS_PRESTASHOP_USERNAME;
const password = process.env.PSS_PRESTASHOP_PASSWORD;
const complexity = process.env.PSS_TRADITIONAL_COMPLEXITY ?? 'simple';
const query = process.env.PSS_PRESTASHOP_QUERY ?? 'Mug';
const expectedName = process.env.PSS_PRESTASHOP_EXPECTED_PRODUCT ?? 'Mug The adventure begins';
const runId = process.env.PSS_RUN_ID ?? `prestashop-traditional-${complexity}-${Date.now()}`;
const taskId = `prestashop-${complexity === 'simple' ? 'search-product' : complexity === 'medium' ? 'search-open-product' : 'search-revisit-product'}`;
if (!username || !password) throw new Error('PSS_PRESTASHOP_USERNAME and PSS_PRESTASHOP_PASSWORD are required');
if (!['simple', 'medium', 'complex'].includes(complexity)) throw new Error(`Unsupported complexity: ${complexity}`);

const startedAt = Date.now();
let actions = 0;
let failure = null;
let oracle = null;
const trace = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const replay = createLocalReplayRecorder({ runId, applicationId: 'prestashop', taskId, arm: 'playwright', maxFrames: 30 });

async function state() {
  const pathname = new URL(page.url()).pathname;
  return {
    milestone: pathname === '/' ? 'authenticated-home' : pathname === '/search' ? 'search-results' : pathname.includes('.html') ? 'product-detail' : 'other',
    url_path: pathname,
    authenticated: !pathname.includes('/login'),
    search_results_heading_visible: await page.getByRole('heading', { name: /Search results/i }).isVisible().catch(() => false),
    target_product_visible: await page.locator('#js-product-list .product-title').filter({ hasText: /Mug The Adventure Begins/i }).first().isVisible().catch(() => false),
    product_detail_visible: await page.locator('h1').filter({ hasText: /Mug The Adventure Begins/i }).first().isVisible().catch(() => false),
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

try {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await fill(page.locator('#field-email'), username, 'email');
  await fill(page.locator('#field-password'), password, 'password');
  await click(page.locator('#submit-login'), 'login');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[name="s"]').waitFor({ state: 'visible', timeout: 15000 });
  await fill(page.locator('input[name="s"]'), query, 'search-query');
  await page.locator('input[name="s"]').press('Enter');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#js-product-list .js-product').first().waitFor({ state: 'visible', timeout: 15000 });
  if (complexity !== 'simple') {
    await click(page.locator('#js-product-list .product-title a').filter({ hasText: /Mug The Adventure Begins/i }).first(), 'open-target-product');
    await page.locator('h1').filter({ hasText: /Mug The Adventure Begins/i }).first().waitFor({ state: 'visible', timeout: 15000 });
  }
  if (complexity === 'complex') {
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.locator('#js-product-list .js-product').first().waitFor({ state: 'visible', timeout: 15000 });
    await click(page.locator('#js-product-list .product-title a').filter({ hasText: /Mug The Adventure Begins/i }).first(), 'reopen-target-product');
    await page.locator('h1').filter({ hasText: /Mug The Adventure Begins/i }).first().waitFor({ state: 'visible', timeout: 15000 });
  }
  oracle = await databaseOracle();
} catch (error) {
  failure = { name: error.name, message: error.message };
}

const finalState = await state().catch(() => ({}));
const visiblePassed = complexity === 'simple'
  ? finalState.milestone === 'search-results' && finalState.target_product_visible === true
  : finalState.milestone === 'product-detail' && finalState.product_detail_visible === true;
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
  condition: process.env.PSS_PILOT_CONDITION ?? 'clean-stable',
  expected_verdict: 'clean',
  runner_version: `prestashop-traditional-${complexity}-v0.1`,
  trace: [{ kind: 'scripted-sequence', complexity, action_count: actions, replay_steps: trace.length, final_state: finalState, independent_oracle: oracle }]
});
replay.finalize({ status: runRecord.status, checkpointReached: runRecord.checkpoint_reached, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: 'clean', failureCategory: runRecord.failure_category, error: failure, oraclePassed: oracle?.passed ?? false });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'prestashop', arm: 'playwright', complexity, task_id: taskId, status: runRecord.status, emitted_verdict: runRecord.emitted_verdict, actions, wall_time_ms: runRecord.timing.wall_time_ms, visible_passed: visiblePassed, independent_oracle: oracle, failure }));
await browser.close();
if (runRecord.status !== 'completed') process.exitCode = 1;
