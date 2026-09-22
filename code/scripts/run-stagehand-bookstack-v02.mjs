import 'dotenv/config';
import crypto from 'node:crypto';
import { Stagehand } from '@browserbasehq/stagehand';
import { StagehandQwenClient } from './stagehand-qwen-client.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';
import { assertFrameworkVersion, assertRegistryAgreesWithManifest, probeNodeFrameworkVersion } from '../src/framework-version.mjs';
import { assertAdapterPayloadIsContractClean, deriveFrameworkAdapterOutcome } from '../src/framework-adapter-outcome.mjs';
import { getObservationContract } from '../src/arms/observation-contracts.mjs';

// BookStack emits absolute localhost form actions; using the same host avoids
// a CSRF cookie split when the caller configured 127.0.0.1.
const baseURL = (process.env.BOOKSTACK_BASE_URL ?? 'http://localhost:8081').replace('127.0.0.1', 'localhost');
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const modelName = process.env.CUA_MODEL ?? 'qwen3.7-flash';
const configId = process.env.PSS_CONFIGURATION_ID ?? 'hybrid-stagehand-grounded-candidate';
const frameworkTrack = process.env.PSS_FRAMEWORK_TRACK ?? 'historical';
const runId = process.env.PSS_RUN_ID ?? `bookstack-stagehand-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
if (!username || !password) throw new Error('BookStack credentials must be configured in code/.env');
if (!process.env.CUA_API_KEY || !process.env.CUA_BASE_URL) throw new Error('CUA_API_KEY and CUA_BASE_URL are required');

// Version truth: read the installed Stagehand version instead of the literal
// '3.0.8'. A rebuilt environment would otherwise keep reporting 3.0.8.
const installedStagehand = probeNodeFrameworkVersion({ frameworkId: 'stagehand-grounded', track: frameworkTrack });
if (!installedStagehand.ok) throw new Error(`Stagehand version probe failed: ${installedStagehand.detail}`);
const frameworkVersion = assertFrameworkVersion({
  frameworkId: 'stagehand-grounded',
  track: frameworkTrack,
  installed: installedStagehand.version,
  installedFrom: installedStagehand.source
});

// Observation boundary. Stagehand builds its own accessibility snapshot, so the
// adapter cannot assert the contract on Stagehand's internal prompt. It can and
// does assert that every payload the adapter controls is contract-clean, which
// is the part the adapter is responsible for.
const hybridForbidden = getObservationContract('hybrid').forbidden;
function assertNoForbiddenTokens(payload, label) {
  return assertAdapterPayloadIsContractClean(payload, hybridForbidden, label);
}

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
    assertNoForbiddenTokens(instruction, `instruction-step-${step}`);
    await capture('before-action', step);
    const result = await stagehand.act(instruction, { page, timeout: 20000 });
    actions += Array.isArray(result.actions) ? result.actions.length : 1;
    await capture('after-action', step, { type: 'stagehand-act' });
    const expectedPath = step === 0 ? '/books' : '/books/book';
    // Stagehand's Qwen act call is the primary policy. A bounded, visible
    // locator fallback is part of this hybrid adapter's grounding policy and
    // is logged in replay; it never uses hidden state or evaluator labels.
    //
    // The fallback is NOT a model success. It is counted here and the cell is
    // downgraded after the loop: previously `passed` ignored fallbackCount, so a
    // fallback-assisted run was recorded as `completed` and the "not pure model
    // success" claim was prose only.
    if (!result.success || new URL(page.url()).pathname !== expectedPath) {
      // Select by canonical route rather than by link text. The seeded shelf
      // holds three books whose anchors all begin with "Book" ("Book", "Book1",
      // "Book2") and whose anchor text also contains the description, so
      // `starts-with(...,'Book')` matched all three and `normalize-space(.)='Book'`
      // matched none. The href is unique and is exactly what the oracle checks.
      const target = step === 0
        ? page.locator("a[href$='/books']").first()
        : page.locator("a[href$='/books/book']").first();
      await target.click();
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

// A fallback-assisted cell reached the checkpoint through the harness's visible
// locator, not through model grounding. `checkpoint_reached` stays true because
// the checkpoint really was reached, but the cell must not be reported as a
// model-only success. The rule lives in a tested module, not inline.
const outcome = deriveFrameworkAdapterOutcome({ failure, oraclePassed: oracle?.passed === true, fallbackCount });
const oraclePassed = outcome.checkpoint_reached;
const fallbackAssisted = outcome.fallback_assisted;
const passed = outcome.model_only_success;
const registry = loadConfigurationRegistry();
const configuration = registry.configurations.find((entry) => entry.configuration_id === configId);
if (configuration) {
  assertRegistryAgreesWithManifest({
    registryFrameworkId: configuration.framework.id,
    registryVersion: configuration.framework.version,
    frameworkId: 'stagehand-grounded',
    track: frameworkTrack
  });
  if (configuration.runtime?.model_id && configuration.runtime.model_id !== modelName) {
    throw new Error(`CUA_MODEL=${modelName} does not match the registry model_id=${configuration.runtime.model_id} for ${configId}`);
  }
}
const phase2 = createPhase2Provenance({
  registry,
  configurationId: configId,
  runManifestPath: process.env.PSS_RUN_MANIFEST_PATH ?? `${process.cwd()}/config/archive/bookstack-navigation-run-manifest.v0.2.json`,
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
  status: outcome.status,
  checkpoint_reached: outcome.checkpoint_reached, emitted_verdict: outcome.emitted_verdict, ground_truth_verdict: 'clean',
  timing: { wall_time_ms: Date.now() - startedAt, actions, retries: 0 },
  provenance: {
    ...phase2Provenance,
    runner_version: 'stagehand-qwen-custom-v0.2',
    observation_contract: 'screenshot-plus-structure',
    framework_id: 'stagehand-grounded',
    framework_version: frameworkVersion.installed_version,
    framework_environment_id: frameworkVersion.environment_id,
    framework_track: frameworkVersion.track,
    provider_id: 'aliyun-compatible',
    model_id: modelName,
    action_schema_version: 'stagehand-act-v3',
    code_framework: null,
    authoring_source: null
  },
  failure_category: outcome.failure_category,
  trace: [{
    kind: 'stagehand-act-sequence',
    action_count: actions,
    fallback_count: fallbackCount,
    fallback_assisted: fallbackAssisted,
    model_only_success: passed,
    observation_contract_asserted: true,
    replay_frame_count: replay.frames.length,
    provider_event_count: replay.providerEvents.length
  }]
});
replay.finalize({ status: runRecord.status, checkpointReached: passed, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: 'clean', failureCategory: runRecord.failure_category, error: failure, oraclePassed: oracle?.passed === true });
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({
  framework: 'stagehand-grounded',
  framework_version: frameworkVersion.installed_version,
  framework_environment_id: frameworkVersion.environment_id,
  model: modelName,
  failure,
  oracle,
  fallback_count: fallbackCount,
  fallback_assisted: fallbackAssisted,
  model_only_success: passed,
  replay_frame_count: replay.frames.length,
  provider_event_count: replay.providerEvents.length,
  run_record: runRecord
}));
if (!passed) process.exitCode = 1;
