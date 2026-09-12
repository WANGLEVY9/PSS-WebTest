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
import { evaluateInvoiceNinjaPayment } from '../src/invoiceninja-payments-oracle.mjs';
import { installInvoiceNinjaPaymentMutation } from '../src/mutations/invoiceninja-payments.mjs';
import { installInvoiceNinjaMutation } from '../src/mutations/invoiceninja.mjs';

dotenv.config({ path: process.env.PSS_INVOICENINJA_ENV ?? new URL('../../third_party/WebTestPilot/webapps/invoiceninja/.env', import.meta.url).pathname });
dotenv.config();

const arm = process.env.PSS_ARM ?? 'visual';
if (!['visual', 'hybrid'].includes(arm)) throw new Error('PSS_ARM must be visual or hybrid');
const baseURL = process.env.INVOICE_NINJA_BASE_URL ?? `http://127.0.0.1:${process.env.APP_PORT ?? '8082'}`;
const username = process.env.PSS_INVOICENINJA_USERNAME ?? process.env.IN_USER_EMAIL;
const password = process.env.PSS_INVOICENINJA_PASSWORD ?? process.env.IN_PASSWORD;
if (!username || !password) throw new Error('Invoice Ninja credentials are missing');
const taskId = 'invoiceninja-recent-payments';
const applicationId = 'invoiceninja';
const applicationVersion = process.env.PSS_INVOICENINJA_VERSION ?? '5.11.61';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const mutationId = process.env.PSS_UI_MUTATION ?? null;
const expectedVerdict = process.env.PSS_EXPECTED_VERDICT ?? (mutationId === 'invoiceninja-visible-payment-omission' ? 'fault' : 'clean');
if (!['clean', 'fault'].includes(expectedVerdict)) throw new Error('PSS_EXPECTED_VERDICT must be clean or fault');
if (expectedVerdict === 'fault' && mutationId !== 'invoiceninja-visible-payment-omission') throw new Error('Payment fault runs require invoiceninja-visible-payment-omission');
if (expectedVerdict === 'clean' && mutationId === 'invoiceninja-visible-payment-omission') throw new Error('Payment omission requires expected verdict fault');

const viewport = { width: 1280, height: 720 };
const runId = process.env.PSS_RUN_ID ?? `invoiceninja-payments-${arm}-${Date.now()}`;
const { protocol } = assertProtocolMatchesFrozenProfile({ env: process.env, provider: process.env.CUA_PROVIDER, model: process.env.CUA_MODEL, arm });
const optimization = resolveAgentOptimization({ env: process.env, arm, taskFamily: 'multi-step' });
const hybridActionMode = process.env.CUA_HYBRID_ACTION_MODE ?? optimization.hybrid_action_mode ?? 'coordinate';
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? String(optimization.max_steps), 10);
const settleMs = Number.parseInt(process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimization.post_action_settle_ms), 10);
const driverEnv = { ...process.env, PSS_REQUIRE_FROZEN_PROFILE: '1', CUA_MAX_OUTPUT_TOKENS: process.env.CUA_MAX_OUTPUT_TOKENS ?? String(optimization.max_output_tokens), CUA_COORDINATE_MODE: process.env.CUA_COORDINATE_MODE ?? String(optimization.coordinate_mode), CUA_HYBRID_ACTION_MODE: hybridActionMode };
const replay = createLocalReplayRecorder({ runId, applicationId, taskId, arm, maxFrames: 60 });
const trace = [];
let pendingProviderEventIds = [];

async function state(page) {
  const url = new URL(page.url());
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const paymentNumberVisible = await page.getByText('0001', { exact: true }).first().isVisible().catch(() => false);
  return {
    milestone: url.pathname.includes('/login') ? 'login' : url.pathname === '/payments' ? 'payments' : 'other',
    url_path: url.pathname,
    authenticated: !url.pathname.includes('/login'),
    payments_heading_visible: await page.getByRole('heading', { name: 'Payments', exact: true }).isVisible().catch(() => false),
    payment_number_visible: paymentNumberVisible ? '0001' : (bodyText.includes('0001') ? '0001' : null),
    mutation_marker_visible: await page.locator('#pss-invoiceninja-payment-omission').count().catch(() => 0) > 0
  };
}

async function structure(page) {
  const controls = await page.locator('a,button,input:not([type="hidden"]),textarea,[role="button"]').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
    if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return null;
    const role = element.tagName === 'A' ? 'link' : element.tagName === 'BUTTON' ? 'button' : element.getAttribute('role') || 'textbox';
    const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
    return { element, role, name, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  }).filter(Boolean).slice(0, 160).map((item, index) => { item.element.setAttribute('data-pss-target-id', `c${index}`); return { role: item.role, name: item.name, rect: item.rect, target_id: `c${index}`, center_normalized_1000: { x: Math.round((item.rect.x + item.rect.width / 2) * 1000 / innerWidth), y: Math.round((item.rect.y + item.rect.height / 2) * 1000 / innerHeight) } }; }));
  return { controls };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport });
const page = await context.newPage();
if (mutationId === 'invoiceninja-visible-payment-omission') await installInvoiceNinjaPaymentMutation(page, mutationId);
if (mutationId === 'invoiceninja-layout-v1') await installInvoiceNinjaMutation(page, mutationId);
const capture = async (phase, step, action = null) => {
  const image = await page.screenshot({ type: 'jpeg', quality: Number(process.env.CUA_SCREENSHOT_QUALITY ?? optimization.screenshot_quality), animations: 'disabled' });
  const current = await state(page);
  await replay.capture({ page, buffer: image, phase, step, action, state: current, providerEventIds: pendingProviderEventIds.splice(0) });
  return { image, current };
};
const observeScreenshot = async ({ step } = {}) => { const { image, current } = await capture('before-action', step); return { screenshot: `data:image/jpeg;base64,${image.toString('base64')}`, progressToken: `${page.url()}::${current.milestone}` }; };
const observeHybrid = async ({ step } = {}) => { const { image, current } = await capture('before-action', step); return { screenshot: image.toString('base64'), pageStructure: await structure(page), viewport, progressToken: `${page.url()}::${current.milestone}` }; };
const executeAction = async (action) => {
  if (arm === 'hybrid' && action.target_id && ['click', 'double_click'].includes(action.type)) {
    const candidates = await structure(page); const target = candidates.controls.find((candidate) => candidate.target_id === action.target_id); if (!target) throw new Error(`hybrid target is not visible: ${action.target_id}`);
    const locator = page.locator(`[data-pss-target-id="${action.target_id}"]`).first(); const x = target.center_normalized_1000.x * viewport.width / 1000; const y = target.center_normalized_1000.y * viewport.height / 1000;
    if (await locator.isVisible().catch(() => false)) { if (action.type === 'double_click') await locator.dblclick(); else await locator.click(); } else if (action.type === 'double_click') await page.mouse.dblclick(x, y); else await page.mouse.click(x, y);
  } else if (action.type === 'click') await page.mouse.click(action.x, action.y);
  else if (action.type === 'double_click') await page.mouse.dblclick(action.x, action.y);
  else if (action.type === 'keypress') await page.keyboard.press(({ ENTER: 'Enter', TAB: 'Tab', ESC: 'Escape', BACK: 'Alt+Left', 'ALT+LEFT': 'Alt+Left' })[action.key?.toUpperCase()] ?? action.key);
  else if (action.type === 'scroll') await page.mouse.wheel(0, action.delta_y ?? 500);
  else if (action.type === 'wait') await page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
  else throw new Error(`Unsupported action: ${action.type}`);
  await page.waitForTimeout(Math.min(settleMs, action.type === 'type' ? 350 : settleMs));
};

let result = null; let failure = null; const startedAt = Date.now();
try {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click(); await page.waitForLoadState('domcontentloaded').catch(() => {}); await page.waitForTimeout(1000);
  const save = page.getByRole('button', { name: 'Save', exact: true }); if (await save.isVisible().catch(() => false)) { await save.click(); await page.waitForTimeout(250); }
  const driverOptions = { env: driverEnv, timeoutMs: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(optimization.timeout_ms), 10), maxRetries: Number.parseInt(process.env.CUA_MAX_RETRIES ?? String(optimization.max_retries), 10), maxDecisionRetries: Number.parseInt(process.env.CUA_MAX_DECISION_RETRIES ?? String(optimization.max_decision_retries), 10), coordinateMode: process.env.CUA_COORDINATE_MODE ?? optimization.coordinate_mode, wallTimeoutMs: Number.parseInt(process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? String(optimization.wall_timeout_ms ?? 0), 10), onProviderResponse: (summary) => { const id = replay.recordProviderEvent(summary); if (id) pendingProviderEventIds.push(id); }, executeAction };
  const driver = arm === 'visual' ? createVolcengineCuaDriver({ ...driverOptions, observeScreenshot }) : createVolcengineHybridDriver({ ...driverOptions, observeHybrid, hybridActionMode });
  const adapter = createAgentAdapter({ arm, driver, maxSteps });
  result = await adapter.run({
    intent: expectedVerdict === 'fault'
      ? 'The browser is already authenticated. Open Payments. If payment number 0001 is missing from the visible Payments table, report the observed fault and finish with verdict fault. If it is visible, finish with verdict pass. Use only the visible interface; never inspect databases, source code, hidden evaluator fields, or oracle information.'
      : 'The browser is already authenticated. Open Payments and finish only when the Payments heading and payment number 0001 are visibly present. Use only the visible interface; never inspect databases, source code, hidden evaluator fields, or oracle information.',
    onStep: async ({ step, action }) => { const current = await state(page); trace.push({ step, action, url: page.url(), milestone: current.milestone, state: current }); await capture('after-action', step, action); }
  });
} catch (error) { failure = { name: error.name, message: error.message }; }

const current = await state(page).catch(() => ({ milestone: 'unknown' }));
const oracle = await evaluateInvoiceNinjaPayment();
const visiblePassed = current.milestone === 'payments' && current.payments_heading_visible === true && (expectedVerdict === 'fault' ? current.payment_number_visible === null && current.mutation_marker_visible : current.payment_number_visible === '0001');
const outcome = deriveAgentOutcome({ failure, result, oraclePassed: visiblePassed && oracle.passed === true, expectedVerdict });
const failureCategory = outcome.cellPassed ? null : classifyAgentFailure({ failure, result, oraclePassed: outcome.taskStateReached });
const profile = protocol ?? {};
const record = createRunRecord({
  run_id: runId, application_id: applicationId, application_version: applicationVersion, task_id: taskId, condition, arm,
  status: failure ? 'test-failure' : (result?.status === 'timeout' ? 'timeout' : (outcome.cellPassed ? 'completed' : 'test-failure')),
  checkpoint_reached: outcome.taskStateReached, emitted_verdict: result?.emitted_verdict === 'pass' ? 'clean' : (['clean', 'fault', 'unknown', 'not-emitted'].includes(result?.emitted_verdict) ? result.emitted_verdict : 'unknown'), ground_truth_verdict: expectedVerdict,
  independent_oracle_passed: oracle.passed === true, timing: { wall_time_ms: result?.wall_time_ms ?? Date.now() - startedAt, actions: trace.length, retries: result?.retries ?? 0 },
  provenance: { runner_version: `invoiceninja-${arm}-payments-agent-v0.1`, observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure', provider_id: process.env.CUA_PROVIDER ?? null, model_id: process.env.CUA_MODEL ?? null, provider_profile_id: profile.profile_id ?? null, action_mode: profile.action_mode ?? null, api_mode: profile.api_mode ?? null, hybrid_action_mode: arm === 'hybrid' ? hybridActionMode : null },
  failure_category: failureCategory, trace
});
replay.finalize({ status: record.status, checkpointReached: outcome.taskStateReached, emittedVerdict: record.emitted_verdict, groundTruthVerdict: expectedVerdict, failureCategory, error: failure, oraclePassed: oracle.passed === true });
if (process.env.PSS_RUN_RECORD_OUT) { fs.mkdirSync(path.dirname(path.resolve(process.env.PSS_RUN_RECORD_OUT)), { recursive: true }); fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(record)}\n`, { mode: 0o600 }); }
console.log(JSON.stringify({ application: applicationId, task_id: taskId, arm, result, failure, state: current, independent_oracle: oracle, ...outcome, run_record: record }));
await browser.close();
if (!outcome.cellPassed) process.exitCode = 1;
