import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createAgentAdapter } from '../src/arms/agent-adapter.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';
import { evaluateJuiceShopUiSearch } from '../src/oracles/juice-shop-ui-search.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { classifyAgentFailure } from '../src/failure-taxonomy.mjs';
import { deriveAgentOutcome } from '../src/outcome-admission.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';
import { resolveExperimentCondition } from '../src/experiment-condition.mjs';
import { evaluateJuiceShopCondition } from '../src/oracles/juice-shop-condition.mjs';
import { evaluateJuiceShopProductDetail } from '../src/oracles/juice-shop-product-detail.mjs';
import { evaluateJuiceShopBasket } from '../src/oracles/juice-shop-basket.mjs';
import { evaluateJuiceShopBasketQuantity } from '../src/oracles/juice-shop-basket-quantity.mjs';
import { evaluateJuiceShopBasketFeedback } from '../src/oracles/juice-shop-basket-feedback.mjs';
import { evaluateJuiceShopAuthorization } from '../src/oracles/juice-shop-authorization.mjs';
import { evaluateJuiceShopPagination } from '../src/oracles/juice-shop-pagination.mjs';
import { installJuiceShopAuthorizationFault, installJuiceShopFeedbackDelay, installJuiceShopLayoutEvolution, installJuiceShopSearchOmission, installJuiceShopProductOmission } from '../src/mutations/juice-shop.mjs';
import { installJuiceShopPaginationOmission } from '../src/mutations/juice-shop-pagination.mjs';

dotenv.config();
const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const experimentCondition = resolveExperimentCondition();
const expectedVerdict = experimentCondition.expectedVerdict;
const taskMode = process.env.CUA_TASK_MODE ?? 'full-search';
const taskId = process.env.PSS_JUICE_TASK_ID ?? (taskMode === 'product-detail' ? 'juice-shop-product-detail' : taskMode === 'add-to-basket' ? 'juice-shop-add-to-basket' : taskMode === 'basket-quantity' ? 'juice-shop-basket-quantity' : taskMode === 'basket-feedback' ? 'juice-shop-basket-feedback' : taskMode === 'authorization' ? 'juice-shop-authorization-guard' : taskMode === 'pagination-last-item' ? 'juice-shop-pagination-last-item' : taskMode === 'pagination' ? 'juice-shop-pagination' : 'juice-shop-product-search');
const isPaginationTask = taskId === 'juice-shop-pagination' || taskId === 'juice-shop-pagination-last-item';
const isBasketFeedbackTask = taskId === 'juice-shop-basket-feedback';
const isBasketQuantityTask = taskId === 'juice-shop-basket-quantity';
const isAuthorizationTask = taskId === 'juice-shop-authorization-guard';
const paginationTarget = process.env.PSS_JUICE_PAGINATION_TARGET ?? (taskId === 'juice-shop-pagination-last-item' ? 'OWASP Juice Shop Sticker Page' : 'Lemon Juice (500ml)');
const taskFamily = isAuthorizationTask ? 'authorization' : (taskId === 'juice-shop-add-to-basket' || isBasketQuantityTask) ? 'cross-page-state' : isBasketFeedbackTask ? 'runtime' : isPaginationTask ? 'pagination-filter' : 'search-navigation';
const optimization = resolveAgentOptimization({ env: { ...process.env, PSS_AGENT_PROFILE: process.env.PSS_AGENT_PROFILE ?? process.env.CUA_AGENT_PROFILE ?? 'baseline-v0' }, arm: 'hybrid', taskFamily });
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? String(optimization.max_steps), 10);
const prepareSearch = process.env.CUA_PREPARE_SEARCH === '1';
const dismissOverlaysOnly = process.env.CUA_DISMISS_OVERLAYS === '1';
const oraclePollMs = Number.parseInt(process.env.PSS_ORACLE_POLL_MS ?? '5000', 10);
const postActionSettleMs = Number.parseInt(process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimization.post_action_settle_ms), 10);
const viewport = { width: 1280, height: 720 };
const codeRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const protocolVersion = process.env.PSS_PROTOCOL_VERSION ?? null;
const phase2Protocol = protocolVersion === '2.0-draft';
const phase2Fields = phase2Protocol ? createPhase2Provenance({
  registry: loadConfigurationRegistry(), configurationId: process.env.PSS_CONFIGURATION_ID,
  runManifestPath: process.env.PSS_RUN_MANIFEST_PATH ?? `${codeRoot}/config/archive/${taskId === 'juice-shop-product-detail' ? 'juice-shop-product-detail-run-manifest.v0.1.json' : taskId === 'juice-shop-add-to-basket' ? 'juice-shop-basket-run-manifest.v0.1.json' : isBasketQuantityTask ? 'juice-shop-basket-quantity-run-manifest.v0.1.json' : taskId === 'juice-shop-basket-feedback' ? 'juice-shop-basket-feedback-run-manifest.v0.1.json' : taskId === 'juice-shop-authorization-guard' ? 'juice-shop-authorization-run-manifest.v0.1.json' : taskId === 'juice-shop-pagination-last-item' ? 'juice-shop-pagination-last-item-run-manifest.v0.1.json' : taskId === 'juice-shop-pagination' ? 'juice-shop-pagination-run-manifest.v0.1.json' : 'juice-shop-product-search-run-manifest.v0.2.json'}`,
  taskManifestPath: process.env.PSS_TASK_MANIFEST_PATH ?? `${codeRoot}/manifests/task-manifest.v0.1.json`,
  applicationId: 'juice-shop', resetDigest: process.env.PSS_RESET_DIGEST,
  randomizationBlock: process.env.PSS_RANDOMIZATION_BLOCK,
  environment: { runner: 'juice-shop-hybrid-agent-v0.3', base_url: baseURL, arm: 'hybrid', browser: 'chromium', viewport: '1280x720', max_steps: maxSteps, timeout_ms: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(optimization.timeout_ms), 10), task_mode: taskMode, condition: experimentCondition.condition, action_output_mode: process.env.CUA_PROVIDER === 'aliyun' ? (process.env.CUA_ALIYUN_ACTION_MODE ?? 'tool') : process.env.CUA_PROVIDER === 'deepseek' ? (process.env.CUA_DEEPSEEK_ACTION_MODE ?? 'tool') : null, optimization_profile: optimization.profile_id, hybrid_action_mode: process.env.CUA_HYBRID_ACTION_MODE ?? 'coordinate', scheduling: 'parallel-feasibility-or-sequential-pilot' }
}) : null;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
const trace = [];
const runId = `juice-shop-hybrid-${Date.now()}`;
const replay = createLocalReplayRecorder({ runId, applicationId: 'juice-shop', taskId, arm: 'hybrid' });
let pendingProviderEventIds = [];
const replayState = async () => ({ milestone: isPaginationTask ? 'catalog-page' : page.url().includes('/search') ? 'search-results' : 'catalog', url_path: new URL(page.url()).pathname, save_clicked: false, saved_page_visible: false, authenticated: true, request_state: 'not-submitted', title_visible: false, title_filled: false, editor_visible: false, editor_focused: false });

const hybridPageStructure = async () => {
  const controls = await page.locator(isPaginationTask ? 'a,button,input:not([type="hidden"]),textarea,[role="button"],mat-card-title' : 'a,button,input:not([type="hidden"]),textarea,[role="button"]').evaluateAll((elements, activeTaskId) => {
    const roleFor = (element) => {
      if (element.tagName === 'A') return 'link';
      if (element.tagName === 'BUTTON') return 'button';
      return element.getAttribute('role') || (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ? 'textbox' : element.tagName.toLowerCase());
    };
    const visible = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return null;
      let name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
      if (activeTaskId === 'juice-shop-add-to-basket' && name === 'Add to Basket') {
        const card = element.closest('mat-card');
        const title = card?.querySelector('mat-card-title')?.textContent?.replace(/\s+/g, ' ').trim()
          || card?.textContent?.replace(/\s+/g, ' ').trim().split(/\s+\d[\d.,]*¤/)[0]?.trim()
          || '';
        name = `Add to Basket: ${title}`;
      }
      const landmark = (activeTaskId === 'juice-shop-pagination' || activeTaskId === 'juice-shop-pagination-last-item') && element.tagName === 'MAT-CARD-TITLE';
      return { element, role: landmark ? 'text' : roleFor(element), name, interaction: landmark ? 'observe' : (roleFor(element) === 'textbox' ? 'type' : 'click'), center_normalized_1000: { x: Math.round((rect.x + rect.width / 2) * 1000 / innerWidth), y: Math.round((rect.y + rect.height / 2) * 1000 / innerHeight) } };
    }).filter(Boolean).slice(0, 120);
    // Reserve bounded semantic IDs for the paginator controls.  They remain
    // stable when card landmarks enter/leave the structure, while preserving
    // the common c0..c999 action schema used by the provider contract.
    const targetIdFor = (item, index) => item.name === 'Next page' ? 'c998' : item.name === 'Previous page' ? 'c997' : `c${index}`;
    visible.forEach((item, index) => { item.element.dataset.pssTargetId = targetIdFor(item, index); });
    return visible.map((item, index) => ({ ...item, target_id: targetIdFor(item, index), element: undefined }));
  }, taskId);
  return { controls };
};

const hybridActionMode = process.env.CUA_HYBRID_ACTION_MODE ?? optimization.hybrid_action_mode ?? 'coordinate';

const driver = createVolcengineHybridDriver({
  observeHybrid: async ({ step } = {}) => {
    const image = await page.screenshot({ type: 'jpeg', quality: Number(process.env.CUA_SCREENSHOT_QUALITY ?? optimization.screenshot_quality), animations: 'disabled' });
    await replay.capture({ page, buffer: image, phase: 'before-action', step, state: await replayState(), providerEventIds: pendingProviderEventIds.splice(0) });
    return { screenshot: image.toString('base64'), pageStructure: await hybridPageStructure(), viewport };
  },
  onProviderResponse: (summary) => { const id = replay.recordProviderEvent(summary); if (id) pendingProviderEventIds.push(id); },
  hybridActionMode,
  wallTimeoutMs: Number.parseInt(process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0', 10),
  doneVerdicts: [expectedVerdict],
  executeAction: async (action) => {
    if (['click', 'double_click'].includes(action.type) && (action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height)) {
      throw new Error(`pointer action outside viewport: ${action.x},${action.y}`);
    }
    if (action.target_id && ['click', 'double_click'].includes(action.type)) {
      const target = page.locator(`[data-pss-target-id="${action.target_id}"]`).first();
      if (!await target.isVisible().catch(() => false)) throw new Error(`hybrid target is not visible: ${action.target_id}`);
      const targetMetadata = (await hybridPageStructure()).controls.find((candidate) => candidate.target_id === action.target_id);
      if (targetMetadata?.interaction === 'observe') return page.waitForTimeout(50);
      // A semantic target can become disabled after the previous action (for
      // example, the paginator's Next page control after entering page 2).
      // Treat this as a bounded rejected action so the driver can observe the
      // unchanged page and re-plan, instead of waiting for Playwright's full
      // actionability timeout and misclassifying the cell as SUT execution.
      if (!await target.isEnabled().catch(() => false)) return page.waitForTimeout(50);
      if (action.type === 'double_click') await target.dblclick(); else await target.click();
      return page.waitForTimeout(postActionSettleMs);
    }
    if (action.type === 'click') { await page.mouse.click(action.x, action.y); return page.waitForTimeout(postActionSettleMs); }
    if (action.type === 'double_click') { await page.mouse.dblclick(action.x, action.y); return page.waitForTimeout(postActionSettleMs); }
    if (action.type === 'type') { await page.keyboard.type(action.text); return page.waitForTimeout(Math.min(postActionSettleMs, 350)); }
    if (action.type === 'keypress') {
      const keyAliases = { ENTER: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab', SPACE: 'Space', BACKSPACE: 'Backspace' };
      await page.keyboard.press(keyAliases[action.key.toUpperCase()] ?? action.key); return page.waitForTimeout(postActionSettleMs);
    }
    if (action.type === 'scroll') return page.mouse.wheel(0, action.delta_y);
    if (action.type === 'wait') return page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
    throw new Error(`Unsupported action: ${action.type}`);
  }
});

const runnerProvenance = {
  ...(phase2Fields?.provenance ?? {}),
  runner_version: 'juice-shop-hybrid-agent-v0.3',
  observation_contract: 'screenshot-plus-structure',
  model_id: process.env.CUA_MODEL ?? null
};
if (phase2Protocol) {
  runnerProvenance.optimization_profile = optimization.profile_id;
  runnerProvenance.hybrid_action_mode = hybridActionMode;
}

let result;
let failure;
const agentStartedAt = Date.now();
try {
  if (isBasketFeedbackTask) await installJuiceShopFeedbackDelay(page);
  if (isAuthorizationTask && experimentCondition.isFault) await installJuiceShopAuthorizationFault(page);
  if ((taskId === 'juice-shop-product-detail' || taskId === 'juice-shop-add-to-basket' || isBasketQuantityTask || isBasketFeedbackTask) && experimentCondition.isFault) await installJuiceShopProductOmission(page);
  if (isPaginationTask && experimentCondition.isFault) await installJuiceShopPaginationOmission(page, { omitName: paginationTarget });
  if (taskId === 'juice-shop-product-search' && experimentCondition.isFault) await installJuiceShopSearchOmission(page);
  if (experimentCondition.isEvolution) await installJuiceShopLayoutEvolution(page);
  await page.goto(isAuthorizationTask ? `${baseURL}/#/administration` : baseURL, { waitUntil: 'domcontentloaded' });
  // Wait for the API-backed catalog before exposing the first screenshot to
  // the provider; otherwise a 0-of-0 shell can consume the first action.
  if (isAuthorizationTask) await page.locator('body').waitFor({ state: 'attached', timeout: 15000 });
  else await page.locator('mat-card').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(250);
  if (dismissOverlaysOnly) {
    const dismiss = page.getByText('Dismiss', { exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click({ force: true });
    const cookies = page.getByText('Me want it!', { exact: true });
    if (await cookies.isVisible().catch(() => false)) await cookies.click({ force: true });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(250);
  }
  if (prepareSearch) {
    const dismiss = page.getByText('Dismiss', { exact: true });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click({ force: true });
    const cookies = page.getByText('Me want it!', { exact: true });
    if (await cookies.isVisible().catch(() => false)) await cookies.click({ force: true });
    await page.keyboard.press('Escape').catch(() => {});
    await page.getByRole('button', { name: 'Open search' }).click({ force: true });
    if (taskMode === 'submit-only') await page.getByRole('textbox').first().fill('apple');
  }
  const adapter = createAgentAdapter({ arm: 'hybrid', driver, maxSteps });
  result = await adapter.run({
    intent: isAuthorizationTask
      ? (experimentCondition.isFault
        ? 'The anonymous administration page is already open. If it lacks the visible 403 denial and the exact "You are not allowed to access this page!" message, finish with verdict fault; otherwise finish with verdict clean.'
        : 'The anonymous administration page is already open. Finish only when the visible 403 denial and exact "You are not allowed to access this page!" message are present, then return done with verdict clean.')
      : isBasketQuantityTask
      ? (experimentCondition.isFault
        ? 'In the Juice Shop catalog, inspect the product cards. The declared functional fault means Apple Juice (1000ml) may be absent; if it is absent, finish with verdict fault. Otherwise add it twice, open the shopping cart, and finish with verdict clean.'
        : 'In the Juice Shop catalog, locate the card whose title is exactly Apple Juice (1000ml). Click its Add to Basket control exactly twice, then click the top-right shopping-cart control. Finish only when the basket visibly shows Apple Juice (1000ml), quantity 2, and total price 3.98¤; then return done with verdict clean.')
      : isBasketFeedbackTask
      ? (experimentCondition.isFault
        ? 'In the Juice Shop catalog, inspect the product cards. The declared functional fault means Apple Juice (1000ml) may be absent; if it is absent and no confirmation appears, finish with verdict fault. Otherwise return verdict clean.'
        : 'In the Juice Shop catalog, locate the card whose title is exactly Apple Juice (1000ml). Click its Add to Basket control exactly once, then wait for the delayed confirmation message "Placed Apple Juice (1000ml) into basket." to become visible. Finish only after that confirmation appears, then return done with verdict clean.')
      : isPaginationTask
      ? (experimentCondition.isFault
        ? `In the Juice Shop catalog, go to the second catalog page using the visible Next page control. The declared functional fault means ${paginationTarget} may be absent; if the second page is visible and that target is absent, finish with verdict fault. Otherwise finish with verdict clean.`
        : `In the Juice Shop catalog, click the visible Next page control exactly once. After that click, the paginator and product-title landmarks describe the new page even if the target card is offscreen; do not click Next page again. Finish only when the paginator shows the second page and ${paginationTarget} is present in the screenshot or declared landmarks, then return done with verdict clean.`)
      : taskId === 'juice-shop-add-to-basket'
      ? (experimentCondition.isFault
        ? 'In the Juice Shop catalog, inspect the product cards. The declared functional fault means Apple Juice (1000ml) may be absent; if it is absent, finish with verdict fault. If it is visible, add it to the basket, open the shopping cart, and finish with verdict clean.'
        : 'In the Juice Shop catalog, locate the card whose title is exactly Apple Juice (1000ml). Click the Add to Basket control whose visible label includes that same product, then click the top-right shopping-cart control. Finish only when the basket visibly shows Apple Juice (1000ml) and 1.99 price; then return done with verdict clean.')
      : taskId === 'juice-shop-product-detail'
      ? (experimentCondition.isFault
        ? 'In the Juice Shop catalog, inspect the product cards. The declared functional fault means Apple Juice (1000ml) may be absent; if it is absent, finish with verdict fault. If it is visible, open its product details dialog and finish with verdict clean.'
        : 'In the Juice Shop catalog, open the product details for Apple Juice (1000ml). Finish only when the dialog visibly shows that exact product and its 1.99 price; then return done with verdict clean.')
      : taskMode === 'submit-only'
      ? 'The product search box is already open and already contains apple. Press the Enter key exactly once, wait for the results, then return done with verdict pass.'
      : prepareSearch
      ? 'The product search box is already open. Type apple into it and press Enter. Finish only after the search results for apple are visible; then return done with verdict pass.'
      : experimentCondition.isFault
      ? 'In the Juice Shop product catalog, search for apple and inspect the expected results. The declared test condition is a functional fault: if Apple Pomace is missing while the other expected results remain visible, return done with verdict fault; otherwise return done with verdict clean.'
      : 'In the Juice Shop product catalog, search for apple. Handle any welcome or cookie overlays. Finish only after the search results for apple are visible; then return done with verdict clean.',
    onStep: async ({ step, action }) => { trace.push({ step, action, url: page.url() }); await replay.capture({ page, phase: 'after-action', step, action, state: await replayState(), providerEventIds: pendingProviderEventIds.splice(0) }); }
  });
} catch (error) {
  failure = { name: error.name, message: error.message };
}

const oracleDeadline = Date.now() + oraclePollMs;
let uiOracle = isAuthorizationTask
  ? await evaluateJuiceShopAuthorization(page, { condition: experimentCondition.condition })
  : isBasketQuantityTask
  ? await evaluateJuiceShopBasketQuantity(page, { condition: experimentCondition.condition })
  : isBasketFeedbackTask
  ? await evaluateJuiceShopBasketFeedback(page, { condition: experimentCondition.condition })
  : isPaginationTask
  ? await evaluateJuiceShopPagination(page, { condition: experimentCondition.condition, targetName: paginationTarget })
  : taskId === 'juice-shop-product-detail'
  ? await evaluateJuiceShopProductDetail(page, { condition: experimentCondition.condition })
  : taskId === 'juice-shop-add-to-basket'
    ? await evaluateJuiceShopBasket(page, { condition: experimentCondition.condition })
    : await evaluateJuiceShopCondition(page, { condition: experimentCondition.condition, query: 'apple' });
while (uiOracle?.passed !== true && Date.now() < oracleDeadline) {
  await page.waitForTimeout(250);
  uiOracle = isPaginationTask
    ? await evaluateJuiceShopPagination(page, { condition: experimentCondition.condition, targetName: paginationTarget })
    : taskId === 'juice-shop-product-detail'
    ? await evaluateJuiceShopProductDetail(page, { condition: experimentCondition.condition })
    : isAuthorizationTask
      ? await evaluateJuiceShopAuthorization(page, { condition: experimentCondition.condition })
      : isBasketQuantityTask
      ? await evaluateJuiceShopBasketQuantity(page, { condition: experimentCondition.condition })
      : isBasketFeedbackTask
      ? await evaluateJuiceShopBasketFeedback(page, { condition: experimentCondition.condition })
      : taskId === 'juice-shop-add-to-basket'
      ? await evaluateJuiceShopBasket(page, { condition: experimentCondition.condition })
      : await evaluateJuiceShopCondition(page, { condition: experimentCondition.condition, query: 'apple' });
}
const { taskStateReached, protocolCompleted, oracleOnlySuccess, cellPassed } = deriveAgentOutcome({ failure, result, oraclePassed: uiOracle?.passed === true, expectedVerdict });
const failureCategory = classifyAgentFailure({ failure, result, oraclePassed: taskStateReached, expectedVerdict });
const runRecord = createRunRecord({
  ...(phase2Fields ?? {}),
  run_id: runId,
  application_id: 'juice-shop',
  application_version: '20.0.0',
  task_id: taskId,
  condition: experimentCondition.condition,
  arm: 'hybrid',
  status: failure ? 'test-failure' : (result?.status === 'timeout' ? 'timeout' : (uiOracle?.passed ? 'completed' : 'test-failure')),
  checkpoint_reached: taskStateReached,
  emitted_verdict: result?.emitted_verdict === 'pass' ? 'clean' : (result?.emitted_verdict ?? 'not-emitted'),
  ground_truth_verdict: expectedVerdict,
  timing: { wall_time_ms: result?.wall_time_ms ?? (Date.now() - agentStartedAt), actions: trace.length, retries: result?.retries ?? 0 },
  provenance: runnerProvenance,
  failure_category: cellPassed ? null : failureCategory,
  trace
});
replay.finalize({ status: runRecord.status, checkpointReached: taskStateReached, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: runRecord.ground_truth_verdict, failureCategory: runRecord.failure_category, error: failure, oraclePassed: uiOracle?.passed === true });
console.log(JSON.stringify({ application: 'juice-shop', arm: 'hybrid', task_mode: taskMode, result: result ?? null, failure: failure ?? null, trace, ui_oracle: uiOracle, task_state_reached: taskStateReached, protocol_completed: protocolCompleted, oracle_only_success: oracleOnlySuccess, cell_passed: cellPassed, run_record: runRecord }));
if (process.env.PSS_RUN_RECORD_OUT) fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(runRecord)}\n`, { mode: 0o600 });
await browser.close();
if (!cellPassed) process.exitCode = 1;
