import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createAgentAdapter } from '../src/arms/agent-adapter.mjs';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { classifyAgentFailure } from '../src/failure-taxonomy.mjs';
import { deriveAgentOutcome } from '../src/outcome-admission.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';
import { assertProtocolMatchesFrozenProfile } from '../src/provider-profile.mjs';
import { evaluateInvoiceNinjaInvoice } from '../src/invoiceninja-oracle.mjs';
import { installInvoiceNinjaMutation } from '../src/mutations/invoiceninja.mjs';

// Invoice Ninja agent cell. Authentication is a matched preamble; credentials
// are never included in an observation or a persisted record.
dotenv.config({ path: process.env.PSS_INVOICENINJA_ENV ?? new URL('../../third_party/WebTestPilot/webapps/invoiceninja/.env', import.meta.url).pathname });
dotenv.config();

const arm = process.env.PSS_ARM ?? 'visual';
if (!['visual', 'hybrid'].includes(arm)) throw new Error('PSS_ARM must be visual or hybrid');
const baseURL = process.env.INVOICE_NINJA_BASE_URL ?? `http://127.0.0.1:${process.env.APP_PORT ?? '8082'}`;
const username = process.env.PSS_INVOICENINJA_USERNAME ?? process.env.IN_USER_EMAIL;
const password = process.env.PSS_INVOICENINJA_PASSWORD ?? process.env.IN_PASSWORD;
if (!username || !password) throw new Error('Invoice Ninja credentials are missing; set PSS_INVOICENINJA_USERNAME/PSS_INVOICENINJA_PASSWORD locally.');

const applicationId = 'invoiceninja';
const applicationVersion = process.env.PSS_INVOICENINJA_VERSION ?? '5.11.61';
const taskId = 'invoiceninja-view-invoice-details';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const mutationId = process.env.PSS_UI_MUTATION ?? null;
const expectedVerdict = process.env.PSS_EXPECTED_VERDICT ?? (mutationId === 'invoiceninja-visible-number-mismatch' ? 'fault' : 'clean');
if (!['clean', 'fault'].includes(expectedVerdict)) throw new Error('PSS_EXPECTED_VERDICT must be clean or fault');
if (expectedVerdict === 'fault' && mutationId !== 'invoiceninja-visible-number-mismatch') throw new Error('Invoice Ninja fault runs require invoiceninja-visible-number-mismatch');
if (expectedVerdict === 'clean' && mutationId === 'invoiceninja-visible-number-mismatch') throw new Error('Invoice Ninja mismatch mutation requires expected verdict fault');
const viewport = { width: 1280, height: 720 };
const runId = process.env.PSS_RUN_ID ?? `invoiceninja-${arm}-${Date.now()}`;

const { protocol } = assertProtocolMatchesFrozenProfile({
  env: process.env,
  provider: process.env.CUA_PROVIDER,
  model: process.env.CUA_MODEL,
  arm
});
const optimization = resolveAgentOptimization({ env: process.env, arm, taskFamily: 'multi-step' });
const hybridActionMode = process.env.CUA_HYBRID_ACTION_MODE ?? optimization.hybrid_action_mode ?? 'coordinate';
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? String(optimization.max_steps), 10);
const settleMs = Number.parseInt(process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimization.post_action_settle_ms), 10);
const driverEnv = {
  ...process.env,
  PSS_REQUIRE_FROZEN_PROFILE: '1',
  CUA_MAX_OUTPUT_TOKENS: process.env.CUA_MAX_OUTPUT_TOKENS ?? String(optimization.max_output_tokens),
  CUA_COORDINATE_MODE: process.env.CUA_COORDINATE_MODE ?? String(optimization.coordinate_mode),
  CUA_HYBRID_ACTION_MODE: hybridActionMode
};

const replay = createLocalReplayRecorder({ runId, applicationId, taskId, arm, maxFrames: 60 });
const trace = [];
let pendingProviderEventIds = [];
let mutationApplied = false;

async function pageState(page) {
  const url = new URL(page.url());
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const visibleInvoiceValues = await page.locator('input:visible').evaluateAll((inputs) => inputs.map((input) => input.value).filter(Boolean)).catch(() => []);
  const invoiceNumberVisible = visibleInvoiceValues.includes('999999') || bodyText.includes('999999')
    ? '999999'
    : visibleInvoiceValues.includes('123456') || bodyText.includes('123456')
      ? '123456'
      : null;
  return {
    milestone: url.pathname.includes('/login') ? 'login' : url.pathname.includes('/invoices') ? (await page.getByRole('heading', { name: 'Edit Invoice', exact: true }).isVisible().catch(() => false) ? 'invoice-detail' : 'invoices') : 'other',
    url_path: url.pathname,
    authenticated: !url.pathname.includes('/login'),
    invoices_heading_visible: await page.getByRole('heading', { name: 'Invoices', exact: true }).isVisible().catch(() => false),
    edit_invoice_heading_visible: await page.getByRole('heading', { name: 'Edit Invoice', exact: true }).isVisible().catch(() => false),
    target_invoice_visible: await page.getByText('123456', { exact: true }).first().isVisible().catch(() => false),
    invoice_number_visible: invoiceNumberVisible,
    mutation_marker_visible: await page.locator('#pss-invoiceninja-number-mismatch').count().catch(() => 0) > 0
  };
}

async function pageStructure(page) {
  const controls = await page.locator('a,button,input:not([type="hidden"]),textarea,[role="button"]')
    .evaluateAll((elements) => {
      const visible = elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return null;
        const role = element.tagName === 'A' ? 'link' : element.tagName === 'BUTTON' ? 'button' : element.getAttribute('role') || (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ? 'textbox' : element.tagName.toLowerCase());
        const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
        return { element, role, name, interaction: role === 'textbox' ? 'type' : 'click', rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
      }).filter(Boolean).slice(0, 160);
      visible.forEach((item, index) => { item.element?.setAttribute?.('data-pss-target-id', `c${index}`); });
      return visible.map((item, index) => ({
        ...item,
        element: undefined,
        target_id: `c${index}`,
        center_normalized_1000: {
          x: Math.round((item.rect.x + item.rect.width / 2) * 1000 / innerWidth),
          y: Math.round((item.rect.y + item.rect.height / 2) * 1000 / innerHeight)
        }
      }));
    });
  return { controls };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport });
const page = await context.newPage();
await installInvoiceNinjaMutation(page, mutationId);
const replayState = () => pageState(page);
const capture = async (phase, step, action = null) => {
  const image = await page.screenshot({ type: 'jpeg', quality: Number(process.env.CUA_SCREENSHOT_QUALITY ?? optimization.screenshot_quality), animations: 'disabled' });
  const state = await replayState();
  await replay.capture({ page, buffer: image, phase, step, action, state, providerEventIds: pendingProviderEventIds.splice(0) });
  return { image, state };
};
const observeScreenshot = async ({ step } = {}) => {
  const { image, state } = await capture('before-action', step);
  return { screenshot: `data:image/jpeg;base64,${image.toString('base64')}`, progressToken: `${page.url()}::${state.milestone}` };
};
const observeHybrid = async ({ step } = {}) => {
  const { image, state } = await capture('before-action', step);
  return { screenshot: image.toString('base64'), pageStructure: await pageStructure(page), viewport, progressToken: `${page.url()}::${state.milestone}` };
};
const executeAction = async (action) => {
  if (arm === 'hybrid' && action.target_id && ['click', 'double_click'].includes(action.type)) {
    const controls = await pageStructure(page);
    const target = controls.controls.find((candidate) => candidate.target_id === action.target_id);
    if (!target) throw new Error(`hybrid target is not visible: ${action.target_id}`);
    const locator = page.locator(`[data-pss-target-id="${action.target_id}"]`).first();
    if (await locator.isVisible().catch(() => false)) {
      if (action.type === 'double_click') await locator.dblclick(); else await locator.click();
    } else {
      const x = target.center_normalized_1000.x * viewport.width / 1000;
      const y = target.center_normalized_1000.y * viewport.height / 1000;
      if (action.type === 'double_click') await page.mouse.dblclick(x, y); else await page.mouse.click(x, y);
    }
  } else if (action.type === 'click') await page.mouse.click(action.x, action.y);
  else if (action.type === 'double_click') await page.mouse.dblclick(action.x, action.y);
  else if (action.type === 'type') await page.keyboard.type(action.text);
  else if (action.type === 'keypress') await page.keyboard.press(({ ENTER: 'Enter', TAB: 'Tab', ESC: 'Escape', BACK: 'Alt+Left', 'ALT+LEFT': 'Alt+Left' })[action.key?.toUpperCase()] ?? action.key);
  else if (action.type === 'scroll') await page.mouse.wheel(0, action.delta_y ?? 500);
  else if (action.type === 'wait') await page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
  else throw new Error(`Unsupported action: ${action.type}`);
  await page.waitForTimeout(Math.min(settleMs, action.type === 'type' ? 350 : settleMs));
};

let result = null;
let failure = null;
const startedAt = Date.now();
try {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1000);
  // Invoice Ninja shows a first-use company dialog after authentication. It
  // is a matched preamble, not part of the benchmark intent; Playwright and
  // both agent arms must start from the same post-onboarding state.
  const onboardingSave = page.getByRole('button', { name: 'Save', exact: true });
  if (await onboardingSave.isVisible().catch(() => false)) {
    await onboardingSave.click();
    await page.waitForTimeout(250);
  }
  // The SPA can re-mount the first-use portal once after the initial save.
  // Wait for the overlay to disappear before exposing the first observation;
  // otherwise the same matched task starts with a different clickable surface
  // depending on whether the arm queries structure or only takes a screenshot.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const overlay = page.locator('[aria-hidden="true"][data-headlessui-state="open"]');
    if (await overlay.count() === 0) break;
    if (await page.getByRole('button', { name: 'Save', exact: true }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Save', exact: true }).click().catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(250);
  }
  const driverOptions = {
    env: driverEnv,
    timeoutMs: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(optimization.timeout_ms), 10),
    maxRetries: Number.parseInt(process.env.CUA_MAX_RETRIES ?? String(optimization.max_retries), 10),
    maxDecisionRetries: Number.parseInt(process.env.CUA_MAX_DECISION_RETRIES ?? String(optimization.max_decision_retries), 10),
    coordinateMode: process.env.CUA_COORDINATE_MODE ?? optimization.coordinate_mode,
    wallTimeoutMs: Number.parseInt(process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? String(optimization.wall_timeout_ms ?? 0), 10),
    onProviderResponse: (summary) => { const id = replay.recordProviderEvent(summary); if (id) pendingProviderEventIds.push(id); },
    executeAction
  };
  const driver = arm === 'visual'
    ? createVolcengineCuaDriver({ ...driverOptions, observeScreenshot })
    : createVolcengineHybridDriver({ ...driverOptions, observeHybrid, hybridActionMode });
  const adapter = createAgentAdapter({ arm, driver, maxSteps });
  result = await adapter.run({
    intent: expectedVerdict === 'fault'
      ? 'The browser is already authenticated. Open the Invoices section, open the invoice with exact number 123456, and inspect its Edit Invoice page. If the visible invoice number is 999999 instead of 123456, report the observed fault and finish with verdict fault. If the visible invoice number is exactly 123456, finish with verdict pass. Use only the visible interface. Do not inspect source code, database state, cookies, hidden evaluator fields, or any oracle information.'
      : 'The browser is already authenticated. Open the Invoices section, open the invoice with exact number 123456, and finish only when its Edit Invoice page is visibly open with invoice number 123456. Use only the visible interface. Do not inspect source code, database state, cookies, hidden evaluator fields, or any oracle information.',
    onStep: async ({ step, action }) => { const state = await replayState(); trace.push({ step, action, url: page.url(), milestone: state.milestone, state }); await capture('after-action', step, action); }
  });
} catch (error) {
  failure = { name: error.name, message: error.message };
}

const state = await pageState(page).catch(() => ({ milestone: 'unknown' }));
const oracle = await evaluateInvoiceNinjaInvoice().catch((error) => ({ oracle: 'invoiceninja-database-invoice', passed: false, error: { name: error.name, message: error.message.slice(0, 240) } }));
const visiblePassed = state.milestone === 'invoice-detail' && state.edit_invoice_heading_visible === true && (expectedVerdict === 'fault' ? state.invoice_number_visible === '999999' : state.invoice_number_visible === '123456');
const { taskStateReached, protocolCompleted, oracleOnlySuccess, cellPassed } = deriveAgentOutcome({ failure, result, oraclePassed: visiblePassed && oracle.passed === true, expectedVerdict });
const failureCategory = cellPassed ? null : classifyAgentFailure({ failure, result, oraclePassed: taskStateReached });
const profile = protocol ?? {};
const configurationId = `${arm}-pss-native-${profile.provider_id ?? process.env.CUA_PROVIDER}-${profile.model_id ?? process.env.CUA_MODEL}-v2`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
const emittedVerdict = result?.emitted_verdict === 'pass'
  ? 'clean'
  : (['clean', 'fault', 'unknown', 'not-emitted'].includes(result?.emitted_verdict) ? result.emitted_verdict : 'unknown');
const record = createRunRecord({
  run_id: runId, application_id: applicationId, application_version: applicationVersion, task_id: taskId, condition, arm,
  status: failure ? 'test-failure' : (result?.status === 'timeout' ? 'timeout' : (cellPassed ? 'completed' : 'test-failure')),
  checkpoint_reached: taskStateReached, emitted_verdict: emittedVerdict, ground_truth_verdict: expectedVerdict,
  independent_oracle_passed: oracle.passed === true,
  timing: { wall_time_ms: result?.wall_time_ms ?? Date.now() - startedAt, actions: trace.length, retries: result?.retries ?? 0 },
  provenance: { runner_version: `invoiceninja-${arm}-agent-v0.1`, observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure', provider_id: process.env.CUA_PROVIDER ?? null, model_id: process.env.CUA_MODEL ?? null, provider_profile_id: profile.profile_id ?? null, action_mode: profile.action_mode ?? null, api_mode: profile.api_mode ?? null, action_mode_source: profile.action_mode_source ?? null, hybrid_action_mode: arm === 'hybrid' ? hybridActionMode : null },
  failure_category: failureCategory, trace
});
replay.finalize({ status: record.status, checkpointReached: taskStateReached, emittedVerdict: record.emitted_verdict, groundTruthVerdict: record.ground_truth_verdict, failureCategory, error: failure, oraclePassed: oracle.passed === true });
if (process.env.PSS_RUN_RECORD_OUT) { fs.mkdirSync(path.dirname(path.resolve(process.env.PSS_RUN_RECORD_OUT)), { recursive: true }); fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(record)}\n`, { mode: 0o600 }); }
console.log(JSON.stringify({ application: applicationId, arm, result, failure, state, independent_oracle: oracle, task_state_reached: taskStateReached, protocol_completed: protocolCompleted, oracle_only_success: oracleOnlySuccess, cell_passed: cellPassed, run_record: record }));
await browser.close();
if (!cellPassed) process.exitCode = 1;
