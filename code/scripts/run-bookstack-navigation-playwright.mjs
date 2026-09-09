import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createRunRecord } from '../src/run-records.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { evaluateBookStackOpenBookPage } from '../src/oracles/bookstack-visible.mjs';
import { installBookStackLayoutMutation } from '../src/mutations/bookstack-layout.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';

dotenv.config();
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const targetBook = process.env.PSS_BOOKSTACK_TARGET_BOOK ?? 'Book';
const taskId = process.env.PSS_BOOKSTACK_TASK_ID ?? 'bookstack-open-book';
if (!['bookstack-open-book', 'bookstack-search-and-open-book2'].includes(taskId)) throw new Error(`Unsupported PSS_BOOKSTACK_TASK_ID: ${taskId}`);
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const phase2Protocol = process.env.PSS_PROTOCOL_VERSION === '2.0-draft';
const codeRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const phase2Fields = phase2Protocol
  ? createPhase2Provenance({
    registry: loadConfigurationRegistry(),
    configurationId: process.env.PSS_CONFIGURATION_ID,
    runManifestPath: process.env.PSS_RUN_MANIFEST_PATH ?? `${codeRoot}/config/${taskId === 'bookstack-open-book' ? 'bookstack-navigation' : 'bookstack-search-open-book2'}-run-manifest.v0.2.json`,
    taskManifestPath: process.env.PSS_TASK_MANIFEST_PATH ?? `${codeRoot}/manifests/task-manifest.v0.1.json`,
    applicationId: 'bookstack',
    resetDigest: process.env.PSS_RESET_DIGEST,
    randomizationBlock: process.env.PSS_RANDOMIZATION_BLOCK,
    environment: { runner: 'bookstack-navigation-playwright-v0.3', base_url: baseURL, browser: 'chromium', viewport: '1280x720', task_id: taskId }
  })
  : null;
if (!username || !password) throw new Error('BookStack credentials must be configured in the local environment');

const startedAt = Date.now();
const runId = process.env.PSS_RUN_ID ?? `${taskId}-playwright-${Date.now()}`;
let actions = 0;
let failure = null;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
if (process.env.PSS_UI_MUTATION === 'bookstack-layout-v1') await installBookStackLayoutMutation(context);
const page = await context.newPage();
const replay = createLocalReplayRecorder({ runId, applicationId: 'bookstack', taskId, arm: 'playwright' });
async function replayState() {
  try {
    const pathname = new URL(page.url()).pathname;
    const savedPageVisible = pathname === '/books/book' || pathname === '/books/book2';
    return { milestone: pathname === '/' ? 'authenticated-home' : pathname === '/books' ? 'books-list' : savedPageVisible ? 'book-overview' : /search/.test(pathname) ? 'search-results' : 'other', url_path: pathname, saved_page_visible: false, authenticated: await page.getByRole('link', { name: 'Books', exact: true }).isVisible().catch(() => false), request_state: 'not-submitted' };
  } catch { return { milestone: 'state-read-error', url_path: new URL(page.url()).pathname }; }
}
const click = async (locator) => { const step = actions; await replay.capture({ page, phase: 'before-action', step, state: await replayState() }); actions += 1; const result = await locator.click(); await replay.capture({ page, phase: 'after-action', step, action: { type: 'click' }, state: await replayState() }); return result; };
const fill = async (locator, value) => { const step = actions; await replay.capture({ page, phase: 'before-action', step, state: await replayState() }); actions += 1; const result = await locator.fill(value); await replay.capture({ page, phase: 'after-action', step, action: { type: 'type', text: value }, state: await replayState() }); return result; };
try {
  await page.goto(`${baseURL}/`);
  await click(page.getByRole('link', { name: 'Log in' }));
  await fill(page.getByRole('textbox', { name: 'Email' }), username);
  await fill(page.getByRole('textbox', { name: 'Password' }), password);
  await click(page.getByRole('button', { name: 'Log In' }));
  if (taskId === 'bookstack-search-and-open-book2') {
    await click(page.getByRole('button', { name: 'Search', exact: true }));
    await page.getByRole('heading', { name: 'Search Results', exact: true }).waitFor();
  }
  await click(page.getByRole('link', { name: 'Books', exact: true }));
  await click(page.getByRole('link', { name: targetBook, exact: true }).first());
} catch (error) {
  failure = { name: error.name, message: error.message };
}
const oracle = await evaluateBookStackOpenBookPage(page, targetBook);
const passed = !failure && oracle.passed === true;
const { provenance: phase2Provenance = {}, ...phase2RecordFields } = phase2Fields ?? {};
const runRecord = createRunRecord({
  ...phase2RecordFields,
  run_id: runId,
  application_id: 'bookstack', application_version: process.env.BOOKSTACK_VERSION ?? '24.10.1',
  task_id: taskId, condition, arm: 'playwright',
  status: failure ? 'test-failure' : (passed ? 'completed' : 'evaluator-error'),
  checkpoint_reached: passed, emitted_verdict: passed ? 'clean' : 'not-emitted', ground_truth_verdict: 'clean',
  timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 },
  provenance: { ...phase2Provenance, runner_version: 'bookstack-navigation-playwright-v0.3', observation_contract: 'scripted-locator' },
  failure_category: failure ? 'execution' : (passed ? null : 'oracle'),
  trace: [{ kind: 'scripted-sequence', action_count: actions }]
});
replay.finalize({ status: runRecord.status, checkpointReached: runRecord.checkpoint_reached, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: 'clean', failureCategory: runRecord.failure_category, error: failure, oraclePassed: oracle.passed === true });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ application: 'bookstack', task_id: taskId, arm: 'playwright', failure, oracle, run_record: runRecord }));
await browser.close();
if (!passed) process.exitCode = 1;
