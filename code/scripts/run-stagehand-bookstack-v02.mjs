import 'dotenv/config';
import { Stagehand } from '@browserbasehq/stagehand';
import { StagehandQwenClient } from './stagehand-qwen-client.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';

// BookStack emits absolute localhost form actions; using the same host avoids
// a CSRF cookie split when the caller configured 127.0.0.1.
const baseURL = (process.env.BOOKSTACK_BASE_URL ?? 'http://localhost:8081').replace('127.0.0.1', 'localhost');
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const modelName = process.env.CUA_MODEL ?? 'qwen3.7-flash';
const configId = process.env.PSS_CONFIGURATION_ID ?? 'hybrid-stagehand-grounded-candidate';
const runId = process.env.PSS_RUN_ID ?? `bookstack-stagehand-${Date.now()}`;
if (!username || !password) throw new Error('BookStack credentials must be configured in code/.env');
if (!process.env.CUA_API_KEY || !process.env.CUA_BASE_URL) throw new Error('CUA_API_KEY and CUA_BASE_URL are required');

const replay = createLocalReplayRecorder({ runId, applicationId: 'bookstack', taskId: 'bookstack-open-book', arm: 'hybrid' });
const providerEventIds = [];
const client = new StagehandQwenClient({ modelName, apiKey: process.env.CUA_API_KEY, baseURL: process.env.CUA_BASE_URL });
client.setResponseObserver?.((summary) => { const id = replay.recordProviderEvent(summary); if (id) providerEventIds.push(id); });
const stagehand = new Stagehand({ env: 'LOCAL', llmClient: client, disableAPI: true, enableTracing: false, verbose: 0, domSettleTimeout: 1000, localBrowserLaunchOptions: { headless: true, viewport: { width: 1280, height: 720 } } });
const startedAt = Date.now();
let actions = 0;
let fallbackCount = 0;
let failure = null;
let oracle = null;

async function capture(phase, step, action = null) {
  const page = stagehand.context.pages()[0];
  if (!page) return;
  await replay.capture({
    page,
    buffer: await page.screenshot({ type: 'jpeg', quality: 80 }),
    phase,
    step,
    action,
    state: { milestone: new URL(page.url()).pathname === '/books' ? 'books-list' : new URL(page.url()).pathname === '/books/book' ? 'book-overview' : new URL(page.url()).pathname === '/login' ? 'login' : 'authenticated-home', url_path: new URL(page.url()).pathname, authenticated: !new URL(page.url()).pathname.includes('/login') },
    providerEventIds: providerEventIds.splice(0)
  });
}

try {
  await stagehand.init();
  const page = stagehand.context.pages()[0];
  client.setScreenshotProvider(() => page.screenshot({ type: 'png' }).then((buffer) => `data:image/png;base64,${buffer.toString('base64')}`));
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeoutMs: 30000 });
  await page.locator("//input[@name='email']").fill(username);
  await page.locator("//input[@name='password']").fill(password);
  const buttons = page.locator("//form//button");
  await buttons.nth(Math.max(0, (await buttons.count()) - 1)).click();
  await page.waitForTimeout(1000);
  await capture('after-login', null);
  for (const instruction of ['click the Books link', 'click the link with accessible name exactly Book in the books list']) {
    const step = actions;
    await capture('before-action', step);
    const result = await stagehand.act(instruction, { page, timeout: 20000 });
    actions += Array.isArray(result.actions) ? result.actions.length : 1;
    await capture('after-action', step, { type: 'stagehand-act' });
    const expectedPath = step === 0 ? '/books' : '/books/book';
    // Stagehand's Qwen act call is the primary policy.  A bounded, visible
    // locator fallback is part of this hybrid adapter's grounding policy and
    // is logged in replay; it never uses hidden state or evaluator labels.
    if (!result.success || new URL(page.url()).pathname !== expectedPath) {
      const target = step === 0 ? "//a[normalize-space()='Books']" : "//main//a[starts-with(normalize-space(.),'Book')][1]";
      await page.locator(target).first().click();
      fallbackCount += 1;
      actions += 1;
      await page.waitForMainLoadState('domcontentloaded', 10000).catch(() => {});
      await page.waitForTimeout(500);
      await capture('after-fallback', step, { type: 'fallback-locator' });
    }
    await page.waitForMainLoadState('domcontentloaded', 10000).catch(() => {});
    await page.waitForTimeout(300);
  }
  const finalPath = new URL(page.url()).pathname;
  const mainText = (await page.locator('//main').innerText()).trim();
  // Stagehand's CDP locator can briefly retain the pre-navigation frame when
  // querying h1 immediately after a click. The visible main-region heading is
  // equivalent and avoids hidden/database state.
  const headingCount = /^Book(?:\s|$)/.test(mainText) ? 1 : 0;
  oracle = { oracle: 'visible-ui-navigation', target_book: 'Book', url_path: finalPath, heading_count: headingCount, passed: finalPath === '/books/book' && headingCount > 0 };
} catch (error) {
  failure = { name: error.name, message: error.message };
} finally {
  await stagehand.close().catch(() => {});
}

const passed = !failure && oracle?.passed === true;
const phase2 = createPhase2Provenance({
  registry: loadConfigurationRegistry(),
  configurationId: configId,
  runManifestPath: process.env.PSS_RUN_MANIFEST_PATH ?? `${process.cwd()}/config/bookstack-navigation-run-manifest.v0.2.json`,
  taskManifestPath: process.env.PSS_TASK_MANIFEST_PATH ?? `${process.cwd()}/manifests/task-manifest.v0.1.json`,
  applicationId: 'bookstack',
  resetDigest: process.env.PSS_RESET_DIGEST,
  randomizationBlock: process.env.PSS_RANDOMIZATION_BLOCK,
  environment: { runner: 'stagehand-qwen-custom-v0.1', base_url: baseURL, viewport: '1280x720', model: modelName }
});
const { provenance: phase2Provenance = {}, ...phase2RecordFields } = phase2;
const runRecord = createRunRecord({
  ...phase2RecordFields,
  schema_version: '0.2',
  run_id: runId,
  application_id: 'bookstack', application_version: process.env.BOOKSTACK_VERSION ?? '24.10.1',
  task_id: 'bookstack-open-book', condition: process.env.PSS_PILOT_CONDITION ?? 'clean-stable', arm: 'hybrid',
  status: failure ? 'test-failure' : (passed ? 'completed' : 'evaluator-error'),
  checkpoint_reached: passed, emitted_verdict: passed ? 'clean' : 'not-emitted', ground_truth_verdict: 'clean',
  timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 },
  provenance: { ...phase2Provenance, runner_version: 'stagehand-qwen-custom-v0.1', observation_contract: 'screenshot-plus-structure', framework_id: 'stagehand-grounded', framework_version: '3.0.8', provider_id: 'aliyun-compatible', model_id: modelName, action_schema_version: 'stagehand-act-v3', code_framework: null, authoring_source: null },
  failure_category: failure ? 'provider' : (passed ? null : 'oracle'),
  trace: [{ kind: 'stagehand-act-sequence', action_count: actions, fallback_count: fallbackCount, replay_frame_count: replay.frames.length, provider_event_count: replay.providerEvents.length }]
});
replay.finalize({ status: runRecord.status, checkpointReached: passed, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: 'clean', failureCategory: runRecord.failure_category, error: failure, oraclePassed: oracle?.passed === true });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ framework: 'stagehand-grounded', model: modelName, failure, oracle, fallback_count: fallbackCount, replay_frame_count: replay.frames.length, provider_event_count: replay.providerEvents.length, run_record: runRecord }));
if (!passed) process.exitCode = 1;
