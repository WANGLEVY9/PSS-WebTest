import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRunRecord } from '../src/run-records.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';

dotenv.config();
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const title = process.env.PSS_BOOKSTACK_PAGE_TITLE ?? 'PSS Phase2 Page';
const content = process.env.PSS_BOOKSTACK_PAGE_CONTENT ?? 'PSS Phase2 Content';
const startedAt = Date.now();
let actions = 0;
const click = async (locator) => { actions += 1; return locator.click(); };
const fill = async (locator, value) => { actions += 1; return locator.fill(value); };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let failure = null;
try {
  await page.goto(`${baseURL}/`);
  await click(page.getByRole('link', { name: 'Log in' }));
  await fill(page.getByRole('textbox', { name: 'Email' }), username);
  await fill(page.getByRole('textbox', { name: 'Password' }), password);
  await click(page.getByRole('button', { name: 'Log In' }));
  await click(page.getByRole('link', { name: 'Books', exact: true }));
  await click(page.getByRole('link', { name: 'Book', exact: true }).first());
  await click(page.getByRole('link', { name: 'New Page' }));
  await fill(page.getByRole('textbox', { name: 'Page Title' }), title);
  await fill(page.frameLocator('iframe[title="Rich Text Area"]').locator('body'), content);
  await click(page.getByRole('button', { name: 'Save Page' }));
} catch (error) { failure = { name: error.name, message: error.message }; }
const oracle = await new Promise((resolve, reject) => {
  const child = spawn('node', ['scripts/evaluate-bookstack-page.mjs'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'ignore'] });
  let out = ''; child.stdout.on('data', (chunk) => { out += chunk; }); child.on('error', reject); child.on('close', (code) => { const line = out.trim().split('\n').reverse().find((x) => x.startsWith('{')); resolve({ code, value: line ? JSON.parse(line) : null }); });
});
const passed = !failure && oracle.value?.passed === true;
const runRecord = createRunRecord({ run_id: `bookstack-playwright-${Date.now()}`, application_id: 'bookstack', application_version: process.env.BOOKSTACK_VERSION ?? '24.10.1', task_id: 'bookstack-create-page', condition: 'clean-stable', arm: 'playwright', status: failure ? 'test-failure' : (passed ? 'completed' : 'evaluator-error'), checkpoint_reached: passed, emitted_verdict: passed ? 'clean' : 'not-emitted', ground_truth_verdict: 'clean', timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 }, provenance: { runner_version: 'bookstack-playwright-cell-v0.2', observation_contract: 'scripted-locator' }, failure_category: failure ? 'execution' : (passed ? null : 'oracle'), trace: [{ kind: 'scripted-sequence', action_count: actions }] });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'bookstack', arm: 'playwright', result: { status: passed ? 'completed' : 'test-failure' }, failure, oracle, run_record: runRecord }));
await browser.close();
if (!passed) process.exitCode = 1;
