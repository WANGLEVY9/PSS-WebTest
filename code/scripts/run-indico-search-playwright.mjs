import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createRunRecord } from '../src/run-records.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { evaluateIndicoSearch } from '../src/oracles/indico-visible-search.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';

dotenv.config();
const baseURL = process.env.INDICO_BASE_URL ?? 'http://localhost:8080';
const username = process.env.PSS_INDICO_USERNAME;
const password = process.env.PSS_INDICO_PASSWORD;
const query = process.env.PSS_INDICO_SEARCH_QUERY ?? 'test';
if (!username || !password) throw new Error('Indico credentials must be configured in the local environment');
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const phase2Fields = process.env.PSS_PROTOCOL_VERSION === '2.0-draft' ? createPhase2Provenance({
  registry: loadConfigurationRegistry(), configurationId: process.env.PSS_CONFIGURATION_ID,
  runManifestPath: process.env.PSS_RUN_MANIFEST_PATH ?? `${root}/config/indico-search-events-run-manifest.v0.2.json`,
  taskManifestPath: process.env.PSS_TASK_MANIFEST_PATH ?? `${root}/manifests/task-manifest.v0.1.json`, applicationId: 'indico',
  resetDigest: process.env.PSS_RESET_DIGEST, randomizationBlock: process.env.PSS_RANDOMIZATION_BLOCK,
  environment: { runner: 'indico-search-playwright-v0.1', base_url: baseURL, browser: 'chromium', viewport: '1280x720', query }
}) : null;
const started = Date.now(); let actions = 0; let failure = null;
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const runId = `indico-search-playwright-${Date.now()}`;
const replay = createLocalReplayRecorder({ runId, applicationId: 'indico', taskId: 'indico-search-events', arm: 'playwright' });
const replayState = async () => ({ milestone: page.url().includes('/search') ? 'search-results' : page.url().includes('/login') ? 'login' : 'authenticated-home', url_path: new URL(page.url()).pathname, title_visible: false, title_filled: false, editor_visible: false, editor_focused: false, save_visible: false, save_disabled: false, save_clicked: false, saved_page_visible: false, authenticated: !page.url().includes('/login'), request_state: 'not-submitted' });
const act = async (locator, action) => { const step = actions; await replay.capture({ page, phase: 'before-action', step, state: await replayState() }); actions += 1; const value = await locator[action.type === 'fill' ? 'fill' : action.type === 'press' ? 'press' : 'click'](...(action.type === 'fill' ? [action.value] : action.type === 'press' ? [action.key] : [])); await replay.capture({ page, phase: 'after-action', step, action: action.type === 'fill' ? { type: 'type', text: action.value } : action.type === 'press' ? { type: 'keypress', key: action.key } : { type: 'click' }, state: await replayState() }); return value; };
try {
  await page.goto(`${baseURL}/login/`); await act(page.getByRole('textbox', { name: 'Username or email' }), { type: 'fill', value: username });
  await act(page.getByRole('textbox', { name: 'Password' }), { type: 'fill', value: password });
  await act(page.getByRole('button', { name: 'Login with Indico' }), { type: 'click' });
  const search = page.getByPlaceholder('Enter your search term'); await act(search, { type: 'fill', value: query }); await act(search, { type: 'press', key: 'Enter' });
  // WebTestPilot's source task explicitly includes a post-search "Wait"
  // step.  This is a synchronization assertion, not a test oracle: the
  // oracle below still decides whether the returned links are correct.
  await page.getByRole('heading', { name: 'Search', exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('main a[href^="/event/"]').first().waitFor({ state: 'visible', timeout: 10_000 });
} catch (error) { failure = { name: error.name, message: error.message }; }
const oracle = await evaluateIndicoSearch(page, query);
const { provenance = {}, ...fields } = phase2Fields ?? {};
const passed = !failure && oracle.passed;
const record = createRunRecord({ ...fields, run_id: runId, application_id: 'indico', application_version: '3.3.6', task_id: 'indico-search-events', condition: 'clean-stable', arm: 'playwright', status: failure ? 'test-failure' : passed ? 'completed' : 'evaluator-error', checkpoint_reached: oracle.passed, emitted_verdict: passed ? 'clean' : 'not-emitted', ground_truth_verdict: 'clean', timing: { wall_time_ms: Date.now() - started, actions, retries: 0 }, provenance: { ...provenance, runner_version: 'indico-search-playwright-v0.1', observation_contract: 'scripted-locator' }, failure_category: failure ? 'execution' : passed ? null : 'oracle', trace: [{ kind: 'scripted-sequence', action_count: actions }] });
replay.finalize({ status: record.status, checkpointReached: record.checkpoint_reached, emittedVerdict: record.emitted_verdict, groundTruthVerdict: record.ground_truth_verdict, failureCategory: record.failure_category, error: failure, oraclePassed: oracle.passed === true });
appendRunRecord(record, process.env.PSS_RUN_RECORD_OUT); console.log(JSON.stringify({ application: 'indico', task_id: 'indico-search-events', arm: 'playwright', failure, oracle, run_record: record }));
await browser.close(); if (!passed) process.exitCode = 1;
