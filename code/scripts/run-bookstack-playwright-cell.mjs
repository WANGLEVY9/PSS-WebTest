import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRunRecord } from '../src/run-records.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { installBookStackLayoutMutation } from '../src/mutations/bookstack-layout.mjs';

dotenv.config();
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const title = process.env.PSS_BOOKSTACK_PAGE_TITLE ?? 'PSS Phase2 Page';
const content = process.env.PSS_BOOKSTACK_PAGE_CONTENT ?? 'PSS Phase2 Content';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const expectedVerdict = process.env.PSS_EXPECTED_VERDICT ?? 'clean';
if (!['clean', 'fault'].includes(expectedVerdict)) throw new Error('PSS_EXPECTED_VERDICT must be clean or fault');
const phase2Protocol = process.env.PSS_PROTOCOL_VERSION === '2.0-draft';
const codeRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const phase2Fields = phase2Protocol
  ? createPhase2Provenance({
    registry: loadConfigurationRegistry(),
    configurationId: process.env.PSS_CONFIGURATION_ID,
    runManifestPath: process.env.PSS_RUN_MANIFEST_PATH ?? `${codeRoot}/config/bookstack-create-page-run-manifest.v0.2.json`,
    taskManifestPath: process.env.PSS_TASK_MANIFEST_PATH ?? `${codeRoot}/manifests/task-manifest.v0.1.json`,
    applicationId: 'bookstack',
    resetDigest: process.env.PSS_RESET_DIGEST,
    randomizationBlock: process.env.PSS_RANDOMIZATION_BLOCK,
    environment: { runner: 'bookstack-create-page-playwright-v0.2', base_url: baseURL, browser: 'chromium', viewport: '1280x720' }
  })
  : null;
const startedAt = Date.now();
let actions = 0;
const click = async (locator) => { actions += 1; return locator.click(); };
const fill = async (locator, value) => { actions += 1; return locator.fill(value); };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
if (process.env.PSS_UI_MUTATION === 'bookstack-layout-v1') await installBookStackLayoutMutation(context);
const page = await context.newPage();
let failure = null;
let visibleVerdict = 'not-emitted';
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
  const visibleTitle = (await page.locator('#bkmrk-page-title').textContent() ?? '').trim();
  const visibleMain = (await page.locator('main').textContent() ?? '').replace(/\s+/g, ' ').trim();
  // The scripted strategy can inspect only its ordinary visible UI
  // assertions. It does not receive the independent oracle's DB outcome.
  visibleVerdict = visibleTitle === title && visibleMain.includes(content)
    ? 'clean'
    : visibleTitle === title
      ? 'fault'
      : 'unknown';
} catch (error) { failure = { name: error.name, message: error.message }; }
const oracle = await new Promise((resolve, reject) => {
  const child = spawn('node', ['scripts/evaluate-bookstack-page.mjs'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'ignore'] });
  let out = ''; child.stdout.on('data', (chunk) => { out += chunk; }); child.on('error', reject); child.on('close', (code) => { const line = out.trim().split('\n').reverse().find((x) => x.startsWith('{')); resolve({ code, value: line ? JSON.parse(line) : null }); });
});
const protocolCompleted = !failure && visibleVerdict === expectedVerdict;
const passed = protocolCompleted && oracle.value?.passed === true;
const { provenance: phase2Provenance = {}, ...phase2RecordFields } = phase2Fields ?? {};
const runRecord = createRunRecord({ ...phase2RecordFields, run_id: `bookstack-playwright-${Date.now()}`, application_id: 'bookstack', application_version: process.env.BOOKSTACK_VERSION ?? '24.10.1', task_id: 'bookstack-create-page', condition, arm: 'playwright', status: failure ? 'test-failure' : (passed ? 'completed' : 'evaluator-error'), checkpoint_reached: oracle.value?.passed === true, emitted_verdict: failure ? 'not-emitted' : visibleVerdict, ground_truth_verdict: expectedVerdict, timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 }, provenance: { ...phase2Provenance, runner_version: 'bookstack-playwright-cell-v0.2', observation_contract: 'scripted-locator' }, failure_category: failure ? 'execution' : (passed ? null : (oracle.value?.passed === true ? 'agent-verdict' : 'oracle')), trace: [{ kind: 'scripted-sequence', action_count: actions }] });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'bookstack', arm: 'playwright', result: { status: failure ? 'test-failure' : 'completed', emitted_verdict: visibleVerdict }, failure, oracle, protocol_completed: protocolCompleted, cell_passed: passed, run_record: runRecord }));
await browser.close();
if (!passed) process.exitCode = 1;
