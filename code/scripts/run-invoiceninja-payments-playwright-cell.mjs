import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createRunRecord } from '../src/run-records.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';
import { evaluateInvoiceNinjaPayment } from '../src/invoiceninja-payments-oracle.mjs';
import { installInvoiceNinjaPaymentMutation } from '../src/mutations/invoiceninja-payments.mjs';
import { installInvoiceNinjaMutation } from '../src/mutations/invoiceninja.mjs';

dotenv.config({ path: process.env.PSS_INVOICENINJA_ENV ?? new URL('../../third_party/WebTestPilot/webapps/invoiceninja/.env', import.meta.url).pathname });
dotenv.config();
const baseURL = process.env.INVOICE_NINJA_BASE_URL ?? `http://127.0.0.1:${process.env.APP_PORT ?? '8082'}`;
const username = process.env.PSS_INVOICENINJA_USERNAME ?? process.env.IN_USER_EMAIL;
const password = process.env.PSS_INVOICENINJA_PASSWORD ?? process.env.IN_PASSWORD;
if (!username || !password) throw new Error('Invoice Ninja credentials are missing');
const taskId = 'invoiceninja-recent-payments';
const runId = process.env.PSS_RUN_ID ?? `invoiceninja-payments-playwright-${Date.now()}`;
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const mutationId = process.env.PSS_UI_MUTATION ?? null;
const expectedVerdict = process.env.PSS_EXPECTED_VERDICT ?? (mutationId === 'invoiceninja-visible-payment-omission' ? 'fault' : 'clean');
const startedAt = Date.now(); let actions = 0; let failure = null; let visibleVerdict = 'not-emitted'; const trace = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
if (mutationId === 'invoiceninja-visible-payment-omission') await installInvoiceNinjaPaymentMutation(page, mutationId);
if (mutationId === 'invoiceninja-layout-v1') await installInvoiceNinjaMutation(page, mutationId);
const replay = createLocalReplayRecorder({ runId, applicationId: 'invoiceninja', taskId, arm: 'playwright' });
async function state() {
  const url = new URL(page.url()); const bodyText = await page.locator('body').innerText().catch(() => '');
  const paymentVisible = await page.getByText('0001', { exact: true }).first().isVisible().catch(() => false);
  return { milestone: url.pathname.includes('/login') ? 'login' : url.pathname === '/payments' ? 'payments' : 'other', url_path: url.pathname, authenticated: !url.pathname.includes('/login'), payments_heading_visible: await page.getByRole('heading', { name: 'Payments', exact: true }).isVisible().catch(() => false), payment_number_visible: paymentVisible || bodyText.includes('0001') ? '0001' : null, mutation_marker_visible: await page.locator('#pss-invoiceninja-payment-omission').count().catch(() => 0) > 0 };
}
async function capture(phase, step, action = null) { const current = await state(); trace.push({ phase, step, action, state: current }); await replay.capture({ page, phase, step, action, state: current }); }
async function click(locator, label) { const step = actions; await capture('before-action', step); actions += 1; await locator.click(); await capture('after-action', step, { type: 'click', label }); }
try {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(username); await page.getByRole('textbox', { name: 'Password' }).fill(password); await click(page.getByRole('button', { name: 'Login' }), 'login');
  await page.waitForTimeout(1000); const save = page.getByRole('button', { name: 'Save', exact: true }); if (await save.isVisible().catch(() => false)) { await save.click(); await page.waitForTimeout(250); }
  await click(page.getByRole('link', { name: 'Payments', exact: true }), 'open-payments'); await page.waitForTimeout(700);
  const finalState = await state();
  visibleVerdict = finalState.payments_heading_visible ? (expectedVerdict === 'fault' && finalState.payment_number_visible === null && finalState.mutation_marker_visible ? 'fault' : finalState.payment_number_visible === '0001' ? 'clean' : 'unknown') : 'unknown';
} catch (error) { failure = { name: error.name, message: error.message }; }
const oracle = await evaluateInvoiceNinjaPayment();
const checkpointReached = !failure && oracle.passed === true && visibleVerdict === expectedVerdict;
const runRecord = createRunRecord({ run_id: runId, application_id: 'invoiceninja', application_version: '5.11.61', task_id: taskId, condition, arm: 'playwright', status: failure ? 'test-failure' : (checkpointReached ? 'completed' : 'evaluator-error'), checkpoint_reached: checkpointReached, independent_oracle_passed: oracle.passed === true, emitted_verdict: visibleVerdict, ground_truth_verdict: expectedVerdict, timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 }, provenance: { runner_version: 'invoiceninja-playwright-payments-cell-v0.1', observation_contract: 'scripted-locator' }, failure_category: failure ? 'execution' : (checkpointReached ? null : 'oracle'), trace: [{ kind: 'scripted-sequence', action_count: actions, replay_steps: trace.length, independent_oracle: oracle }] });
replay.finalize({ status: runRecord.status, checkpointReached, emittedVerdict: visibleVerdict, groundTruthVerdict: expectedVerdict, failureCategory: runRecord.failure_category, error: failure, oraclePassed: oracle.passed === true });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'invoiceninja', task_id: taskId, arm: 'playwright', status: runRecord.status, emitted_verdict: visibleVerdict, checkpoint_reached: checkpointReached, actions, replay_steps: trace.length, independent_oracle: oracle, failure, run_record: runRecord }));
await browser.close();
if (!checkpointReached) process.exitCode = 1;
