import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createRunRecord } from '../src/run-records.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';
import { evaluateInvoiceNinjaInvoice } from '../src/invoiceninja-oracle.mjs';
import { installInvoiceNinjaMutation } from '../src/mutations/invoiceninja.mjs';

dotenv.config({ path: process.env.PSS_INVOICENINJA_ENV ?? new URL('../../third_party/WebTestPilot/webapps/invoiceninja/.env', import.meta.url).pathname });
const baseURL = process.env.INVOICE_NINJA_BASE_URL ?? `http://127.0.0.1:${process.env.APP_PORT ?? '8082'}`;
const username = process.env.PSS_INVOICENINJA_USERNAME ?? process.env.IN_USER_EMAIL;
const password = process.env.PSS_INVOICENINJA_PASSWORD ?? process.env.IN_PASSWORD;
const runId = process.env.PSS_RUN_ID ?? `invoiceninja-playwright-${Date.now()}`;
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const taskId = 'invoiceninja-view-invoice-details';
const mutationId = process.env.PSS_UI_MUTATION ?? null;
const expectedVerdict = process.env.PSS_EXPECTED_VERDICT ?? (mutationId === 'invoiceninja-visible-number-mismatch' ? 'fault' : 'clean');
if (!['clean', 'fault'].includes(expectedVerdict)) throw new Error('PSS_EXPECTED_VERDICT must be clean or fault');
if (!username || !password) throw new Error('Invoice Ninja credentials are missing; set PSS_INVOICENINJA_USERNAME/PSS_INVOICENINJA_PASSWORD locally.');

const startedAt = Date.now();
let actions = 0;
let failure = null;
let visibleVerdict = 'not-emitted';
const trace = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await installInvoiceNinjaMutation(page, mutationId);
const replay = createLocalReplayRecorder({ runId, applicationId: 'invoiceninja', taskId, arm: 'playwright' });

async function state() {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const visibleInvoiceValues = await page.locator('input:visible').evaluateAll((inputs) => inputs.map((input) => input.value).filter(Boolean)).catch(() => []);
  return {
    milestone: page.url().includes('/login') ? 'login' : page.url().includes('/invoices/') ? 'invoice-detail' : page.url().includes('/invoices') ? 'invoices' : 'other',
    url_path: new URL(page.url()).pathname,
    invoices_heading_visible: await page.getByRole('heading', { name: 'Invoices', exact: true }).isVisible().catch(() => false),
    edit_invoice_heading_visible: await page.getByRole('heading', { name: 'Edit Invoice', exact: true }).isVisible().catch(() => false),
    invoice_number_visible: visibleInvoiceValues.includes('999999') || bodyText.includes('999999') ? '999999' : visibleInvoiceValues.includes('123456') || bodyText.includes('123456') ? '123456' : null,
    authenticated: !page.url().includes('/login')
  };
}

async function capture(phase, step, action = null) {
  const current = await state();
  trace.push({ phase, step, action, state: current });
  await replay.capture({ page, phase, step, action, state: current });
}

async function click(locator, label = 'click') {
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

try {
  await page.goto(`${baseURL}/login`);
  await fill(page.locator('input[name="email"]'), username, 'email');
  await fill(page.getByRole('textbox', { name: 'Password' }), password, 'password');
  await click(page.getByRole('button', { name: 'Login' }), 'login');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Save', exact: true }).click().catch(() => {});
  await page.waitForTimeout(250);
  await click(page.getByRole('link', { name: 'Invoices', exact: true }), 'open-invoices');
  await click(page.getByRole('link', { name: '123456', exact: true }), 'open-invoice-123456');
  await page.waitForTimeout(1000);
  const finalState = await state();
  visibleVerdict = finalState.edit_invoice_heading_visible
    ? (expectedVerdict === 'fault' && finalState.invoice_number_visible === '999999' ? 'fault' : finalState.invoice_number_visible === '123456' ? 'clean' : 'unknown')
    : 'unknown';
} catch (error) {
  failure = { name: error.name, message: error.message };
}

// The independent oracle is evaluated after the arm stops and is never fed back
// into the browser session. A visible "Edit Invoice" heading alone is not
// ground truth: the persisted invoice row is.
const oracle = await evaluateInvoiceNinjaInvoice();
const independentOraclePassed = oracle.passed === true && visibleVerdict === expectedVerdict;
const checkpointReached = independentOraclePassed;

const runRecord = createRunRecord({
  run_id: runId,
  application_id: 'invoiceninja',
  application_version: '5.11.61',
  task_id: taskId,
  condition,
  arm: 'playwright',
  status: failure ? 'test-failure' : (checkpointReached ? 'completed' : 'evaluator-error'),
  checkpoint_reached: checkpointReached,
  independent_oracle_passed: independentOraclePassed,
  emitted_verdict: failure ? 'not-emitted' : visibleVerdict,
  ground_truth_verdict: expectedVerdict,
  timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 },
  provenance: { runner_version: 'invoiceninja-playwright-cell-v0.2', observation_contract: 'scripted-locator' },
  failure_category: failure ? 'execution' : (checkpointReached ? null : 'oracle'),
  trace: [{ kind: 'scripted-sequence', action_count: actions, replay_steps: trace.length, independent_oracle: oracle }]
});
replay.finalize({ status: runRecord.status, checkpointReached: runRecord.checkpoint_reached, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: expectedVerdict, failureCategory: runRecord.failure_category, error: failure, oraclePassed: independentOraclePassed });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'invoiceninja', task_id: taskId, arm: 'playwright', status: runRecord.status, emitted_verdict: runRecord.emitted_verdict, checkpoint_reached: checkpointReached, actions, replay_steps: trace.length, wall_time_ms: runRecord.timing.wall_time_ms, independent_oracle: oracle, failure }));
await browser.close();
if (runRecord.status !== 'completed') process.exitCode = 1;
