import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createRunRecord } from '../src/run-records.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';

dotenv.config({ path: process.env.PSS_INVOICENINJA_ENV ?? new URL('../../third_party/WebTestPilot/webapps/invoiceninja/.env', import.meta.url).pathname });
const baseURL = process.env.INVOICE_NINJA_BASE_URL ?? `http://127.0.0.1:${process.env.APP_PORT ?? '8082'}`;
const username = process.env.PSS_INVOICENINJA_USERNAME ?? process.env.IN_USER_EMAIL;
const password = process.env.PSS_INVOICENINJA_PASSWORD ?? process.env.IN_PASSWORD;
const runId = process.env.PSS_RUN_ID ?? `invoiceninja-playwright-${Date.now()}`;
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const taskId = 'invoiceninja-view-invoice-details';
if (!username || !password) throw new Error('Invoice Ninja credentials are missing; set PSS_INVOICENINJA_USERNAME/PSS_INVOICENINJA_PASSWORD locally.');

const startedAt = Date.now();
let actions = 0;
let failure = null;
let visibleVerdict = 'not-emitted';
const trace = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const replay = createLocalReplayRecorder({ runId, applicationId: 'invoiceninja', taskId, arm: 'playwright' });

async function state() {
  return {
    milestone: page.url().includes('/login') ? 'login' : page.url().includes('/invoices') ? 'invoices' : 'other',
    url_path: new URL(page.url()).pathname,
    invoices_heading_visible: await page.getByRole('heading', { name: 'Invoices', exact: true }).isVisible().catch(() => false),
    edit_invoice_heading_visible: await page.getByRole('heading', { name: 'Edit Invoice', exact: true }).isVisible().catch(() => false),
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
  await page.getByRole('button', { name: 'Save' }).click().catch(() => {});
  await click(page.getByRole('link', { name: 'Invoices', exact: true }), 'open-invoices');
  await click(page.getByRole('link', { name: '123456', exact: true }), 'open-invoice-123456');
  visibleVerdict = await page.getByRole('heading', { name: 'Edit Invoice', exact: true }).isVisible().catch(() => false) ? 'clean' : 'unknown';
} catch (error) {
  failure = { name: error.name, message: error.message };
}

const runRecord = createRunRecord({
  run_id: runId,
  application_id: 'invoiceninja',
  application_version: '5.11.61',
  task_id: taskId,
  condition,
  arm: 'playwright',
  status: failure ? 'test-failure' : (visibleVerdict === 'clean' ? 'completed' : 'evaluator-error'),
  checkpoint_reached: visibleVerdict === 'clean',
  emitted_verdict: failure ? 'not-emitted' : visibleVerdict,
  ground_truth_verdict: 'clean',
  timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 },
  provenance: { runner_version: 'invoiceninja-playwright-cell-v0.1', observation_contract: 'scripted-locator' },
  failure_category: failure ? 'execution' : (visibleVerdict === 'clean' ? null : 'oracle'),
  trace: [{ kind: 'scripted-sequence', action_count: actions, replay_steps: trace.length }]
});
replay.finalize({ status: runRecord.status, checkpointReached: runRecord.checkpoint_reached, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: 'clean', failureCategory: runRecord.failure_category, error: failure });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'invoiceninja', task_id: taskId, arm: 'playwright', status: runRecord.status, emitted_verdict: runRecord.emitted_verdict, actions, replay_steps: trace.length, wall_time_ms: runRecord.timing.wall_time_ms, failure }));
await browser.close();
if (runRecord.status !== 'completed') process.exitCode = 1;
