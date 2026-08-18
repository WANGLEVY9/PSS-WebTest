import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRunRecord } from '../src/run-records.mjs';

dotenv.config();
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const title = process.env.PSS_BOOKSTACK_PAGE_TITLE ?? 'PSS Phase2 Page';
const content = process.env.PSS_BOOKSTACK_PAGE_CONTENT ?? 'PSS Phase2 Content';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let failure = null;
try {
  await page.goto(`${baseURL}/`);
  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  await page.getByRole('link', { name: 'Book', exact: true }).first().click();
  await page.getByRole('link', { name: 'New Page' }).click();
  await page.getByRole('textbox', { name: 'Page Title' }).fill(title);
  await page.frameLocator('iframe[title="Rich Text Area"]').locator('body').fill(content);
  await page.getByRole('button', { name: 'Save Page' }).click();
} catch (error) { failure = { name: error.name, message: error.message }; }
const oracle = await new Promise((resolve, reject) => {
  const child = spawn('node', ['scripts/evaluate-bookstack-page.mjs'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'ignore'] });
  let out = ''; child.stdout.on('data', (chunk) => { out += chunk; }); child.on('error', reject); child.on('close', (code) => { const line = out.trim().split('\n').reverse().find((x) => x.startsWith('{')); resolve({ code, value: line ? JSON.parse(line) : null }); });
});
const passed = !failure && oracle.value?.passed === true;
const runRecord = createRunRecord({ run_id: `bookstack-playwright-${Date.now()}`, application_id: 'bookstack', application_version: '24.10.1', task_id: 'bookstack-create-page', condition: 'clean-stable', arm: 'playwright', status: failure ? 'test-failure' : (passed ? 'completed' : 'test-failure'), checkpoint_reached: passed, emitted_verdict: passed ? 'clean' : 'not-emitted', ground_truth_verdict: 'clean', timing: { wall_time_ms: 0, actions: 0, retries: 0 }, provenance: { runner_version: 'bookstack-playwright-cell-v0.1', observation_contract: 'scripted-locator' }, failure_category: failure ? 'execution' : (passed ? null : 'evaluator-error'), trace: [] });
console.log(JSON.stringify({ application: 'bookstack', arm: 'playwright', result: { status: passed ? 'completed' : 'test-failure' }, failure, oracle, run_record: runRecord }));
await browser.close();
if (!passed) process.exitCode = 1;
