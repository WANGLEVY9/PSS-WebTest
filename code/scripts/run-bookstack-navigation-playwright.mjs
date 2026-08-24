import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createRunRecord } from '../src/run-records.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { evaluateBookStackOpenBookPage } from '../src/oracles/bookstack-visible.mjs';
import { installBookStackLayoutMutation } from '../src/mutations/bookstack-layout.mjs';

dotenv.config();
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const targetBook = process.env.PSS_BOOKSTACK_TARGET_BOOK ?? 'Book';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
if (!username || !password) throw new Error('BookStack credentials must be configured in the local environment');

const startedAt = Date.now();
let actions = 0;
let failure = null;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
if (process.env.PSS_UI_MUTATION === 'bookstack-layout-v1') await installBookStackLayoutMutation(context);
const page = await context.newPage();
const click = async (locator) => { actions += 1; return locator.click(); };
try {
  await page.goto(`${baseURL}/`);
  await click(page.getByRole('link', { name: 'Log in' }));
  await page.getByRole('textbox', { name: 'Email' }).fill(username); actions += 1;
  await page.getByRole('textbox', { name: 'Password' }).fill(password); actions += 1;
  await click(page.getByRole('button', { name: 'Log In' }));
  await click(page.getByRole('link', { name: 'Books', exact: true }));
  await click(page.getByRole('link', { name: targetBook, exact: true }).first());
} catch (error) {
  failure = { name: error.name, message: error.message };
}
const oracle = await evaluateBookStackOpenBookPage(page, targetBook);
const passed = !failure && oracle.passed === true;
const runRecord = createRunRecord({
  run_id: `bookstack-open-book-playwright-${Date.now()}`,
  application_id: 'bookstack', application_version: process.env.BOOKSTACK_VERSION ?? '24.10.1',
  task_id: 'bookstack-open-book', condition, arm: 'playwright',
  status: failure ? 'test-failure' : (passed ? 'completed' : 'evaluator-error'),
  checkpoint_reached: passed, emitted_verdict: passed ? 'clean' : 'not-emitted', ground_truth_verdict: 'clean',
  timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 },
  provenance: { runner_version: 'bookstack-navigation-playwright-v0.1', observation_contract: 'scripted-locator' },
  failure_category: failure ? 'execution' : (passed ? null : 'oracle'),
  trace: [{ kind: 'scripted-sequence', action_count: actions }]
});
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'bookstack', task_id: 'bookstack-open-book', arm: 'playwright', failure, oracle, run_record: runRecord }));
await browser.close();
if (!passed) process.exitCode = 1;
