import dotenv from 'dotenv';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { createAgentAdapter } from '../src/arms/agent-adapter.mjs';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { classifyAgentFailure } from '../src/failure-taxonomy.mjs';
import { deriveAgentOutcome } from '../src/outcome-admission.mjs';
import { evaluateIndicoSearch } from '../src/oracles/indico-visible-search.mjs';
import { createLocalReplayRecorder } from '../src/replay-artifacts.mjs';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';

dotenv.config();
const arm = process.env.INDICO_ARM;
if (!['visual', 'hybrid'].includes(arm)) throw new Error('INDICO_ARM must be visual or hybrid');
const username = process.env.PSS_INDICO_USERNAME;
const password = process.env.PSS_INDICO_PASSWORD;
if (!username || !password) throw new Error('Indico credentials must be configured in the local environment');
const baseURL = process.env.INDICO_BASE_URL ?? 'http://localhost:8080';
const title = process.env.PSS_INDICO_EVENT_TITLE ?? 'PSS Phase2 Event';
const date = process.env.PSS_INDICO_EVENT_DATE ?? '15/01/2030';
const taskId = process.env.PSS_INDICO_TASK_ID ?? 'indico-create-event';
if (!['indico-create-event', 'indico-search-events'].includes(taskId)) throw new Error('PSS_INDICO_TASK_ID must be indico-create-event or indico-search-events');
const taskFamily = taskId === 'indico-search-events' ? 'search-navigation' : 'multi-step';
const optimization = resolveAgentOptimization({ env: { ...process.env, PSS_AGENT_PROFILE: process.env.PSS_AGENT_PROFILE ?? 'baseline-v0' }, arm, taskFamily });
const query = process.env.PSS_INDICO_SEARCH_QUERY ?? 'test';
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? String(optimization.max_steps), 10);
const viewport = { width: 1280, height: 720 };
const screenshotQuality = Number.parseInt(process.env.CUA_SCREENSHOT_QUALITY ?? String(optimization.screenshot_quality), 10);
const postActionSettleMs = Number.parseInt(process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimization.post_action_settle_ms), 10);
const structureLimit = Math.max(1, optimization.structure_items || 80);
const oraclePollMs = Number.parseInt(process.env.PSS_ORACLE_POLL_MS ?? '5000', 10);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
const trace = [];
const runId = `indico-${arm}-${Date.now()}`;
const replayRecorder = createLocalReplayRecorder({ runId, applicationId: 'indico', taskId, arm });
let pendingProviderEventIds = [];
const codeRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const protocolVersion = process.env.PSS_PROTOCOL_VERSION ?? null;
const phase2Protocol = protocolVersion === '2.0-draft';
const phase2Fields = phase2Protocol ? createPhase2Provenance({
  registry: loadConfigurationRegistry(), configurationId: process.env.PSS_CONFIGURATION_ID,
  runManifestPath: process.env.PSS_RUN_MANIFEST_PATH ?? `${codeRoot}/config/${taskId === 'indico-search-events' ? 'indico-search-events' : 'indico-create-event'}-run-manifest.v0.2.json`,
  taskManifestPath: process.env.PSS_TASK_MANIFEST_PATH ?? `${codeRoot}/manifests/task-manifest.v0.1.json`,
  applicationId: 'indico', resetDigest: process.env.PSS_RESET_DIGEST,
  randomizationBlock: process.env.PSS_RANDOMIZATION_BLOCK,
  environment: { runner: 'indico-agent-pilot-v0.4', base_url: baseURL, arm, browser: 'chromium', viewport: '1280x720', max_steps: maxSteps, timeout_ms: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(optimization.timeout_ms), 10), task_id: taskId, action_output_mode: process.env.CUA_PROVIDER === 'aliyun' ? (process.env.CUA_ALIYUN_ACTION_MODE ?? 'tool') : null, hybrid_action_mode: process.env.CUA_HYBRID_ACTION_MODE ?? optimization.hybrid_action_mode ?? 'coordinate', optimization_profile: optimization.profile_id, scheduling: 'parallel-feasibility-or-sequential-pilot' }
}) : null;

const screenshot = async ({ step } = {}) => {
  const image = await page.screenshot({ type: 'jpeg', quality: screenshotQuality, animations: 'disabled' });
  await replayRecorder.capture({ page, buffer: image, phase: 'before-action', step, state: await replayState(), providerEventIds: pendingProviderEventIds.splice(0) });
  return `data:image/jpeg;base64,${image.toString('base64')}`;
};
async function replayState() {
  const pathname = new URL(page.url()).pathname;
  const titleField = page.getByRole('textbox', { name: /Title/i }).first();
  const titleVisible = await titleField.isVisible().catch(() => false);
  const titleValue = titleVisible ? await titleField.inputValue().catch(() => '') : '';
  return { milestone: /\/event\/\d+/.test(pathname) ? 'event-page' : /create/.test(pathname) ? 'event-editor' : /search/.test(pathname) ? 'search-results' : pathname === '/login/' ? 'login' : 'authenticated-home', url_path: pathname, title_visible: titleVisible, title_filled: titleValue.length > 0, title_length: titleValue.length, editor_visible: false, editor_focused: false, save_visible: await page.getByRole('button', { name: /Create event/i }).isVisible().catch(() => false), save_disabled: false, save_clicked: false, saved_page_visible: /\/event\/\d+/.test(pathname), authenticated: pathname !== '/login/', request_state: 'not-submitted' };
}
const executeAction = async (action) => {
  if (['click', 'double_click'].includes(action.type) && (action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height)) throw new Error(`pointer action outside viewport: ${action.x},${action.y}`);
  // Indico renders the event-type form after a server-backed navigation.  A
  // short fixed settle window keeps the observation contract screenshot-only
  // while preventing the next provider decision from seeing the stale home
  // dropdown.  The delay is part of the runner timing, never an oracle signal.
  if (arm === 'hybrid' && action.target_id && ['click', 'double_click'].includes(action.type)) {
    const target = page.locator(`[data-pss-target-id="${action.target_id}"]`).first();
    if (!await target.isVisible().catch(() => false)) throw new Error(`hybrid target is not visible: ${action.target_id}`);
    if (action.type === 'double_click') await target.dblclick(); else await target.click();
    return page.waitForTimeout(postActionSettleMs);
  }
  if (action.type === 'click') { await page.mouse.click(action.x, action.y); return page.waitForTimeout(postActionSettleMs); }
  if (action.type === 'double_click') { await page.mouse.dblclick(action.x, action.y); return page.waitForTimeout(postActionSettleMs); }
  if (action.type === 'type') { await page.keyboard.type(action.text); return page.waitForTimeout(Math.min(postActionSettleMs, 350)); }
  if (action.type === 'keypress') { const aliases = { ENTER: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab', SPACE: 'Space', BACKSPACE: 'Backspace' }; await page.keyboard.press(aliases[action.key.toUpperCase()] ?? action.key); return page.waitForTimeout(postActionSettleMs); }
  if (action.type === 'scroll') return page.mouse.wheel(0, action.delta_y);
  if (action.type === 'wait') return page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
  throw new Error(`Unsupported action: ${action.type}`);
};

const hybridStructure = async () => {
  const controls = await page.locator('a,button,input:not([type="hidden"]),textarea,select').evaluateAll((elements) => elements.map((element, index) => {
  const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
  if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return null;
  const inputType = element.tagName === 'INPUT' ? (element.getAttribute('type') || 'text').toLowerCase() : '';
  const role = element.tagName === 'A' ? 'link' : element.tagName === 'BUTTON' || ['button', 'submit', 'reset'].includes(inputType) ? 'button' : element.tagName === 'SELECT' ? 'combobox' : 'textbox';
  const label = element.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim();
  const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || label || element.getAttribute('name') || element.getAttribute('value') || element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
  element.dataset.pssTargetId = `c${index}`;
  return { role, name, interaction: role === 'textbox' ? 'type' : 'click', target_id: `c${index}`, center_normalized_1000: { x: Math.round((rect.x + rect.width / 2) * 1000 / innerWidth), y: Math.round((rect.y + rect.height / 2) * 1000 / innerHeight) } };
}).filter(Boolean));
  return controls.slice(0, structureLimit);
};

const evaluateCreateEventOracle = () => new Promise((resolve, reject) => {
  const child = spawn('node', ['scripts/evaluate-indico-event.mjs'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.on('error', reject);
  child.on('close', (code) => { const line = output.trim().split('\n').reverse().find((candidate) => candidate.startsWith('{')); resolve({ code, value: line ? JSON.parse(line) : null }); });
});

const evaluateOracle = async () => taskId === 'indico-search-events'
  ? { code: 0, value: await evaluateIndicoSearch(page, query) }
  : evaluateCreateEventOracle();

let result;
let failure;
let replayEligible = false;
const agentStartedAt = Date.now();
try {
  await page.goto(`${baseURL}/login/`);
  await page.getByRole('textbox', { name: 'Username or email' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login with Indico' }).click();
  if (taskId === 'indico-search-events') await page.getByPlaceholder('Enter your search term').waitFor();
  else await page.getByRole('button', { name: 'Create event' }).waitFor();
  // Never archive a login frame.  Replay capture starts only after shared
  // fixture authentication has completed and the arm's task begins.
  replayEligible = true;
  const driverOptions = { executeAction, timeoutMs: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(optimization.timeout_ms), 10), maxRetries: Number.parseInt(process.env.CUA_MAX_RETRIES ?? String(optimization.max_retries), 10), maxDecisionRetries: Number.parseInt(process.env.CUA_MAX_DECISION_RETRIES ?? String(optimization.max_decision_retries), 10), coordinateMode: process.env.CUA_COORDINATE_MODE ?? optimization.coordinate_mode, hybridActionMode: process.env.CUA_HYBRID_ACTION_MODE ?? (optimization.hybrid_action_mode ?? 'coordinate'), wallTimeoutMs: Number.parseInt(process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0', 10), onProviderResponse: (summary) => { const id = replayRecorder.recordProviderEvent(summary); if (id) pendingProviderEventIds.push(id); } };
  if (arm === 'visual') driverOptions.observeScreenshot = screenshot;
  else driverOptions.observeHybrid = async (context) => ({ screenshot: await screenshot(context), pageStructure: { controls: await hybridStructure() }, viewport });
  const driver = arm === 'visual' ? createVolcengineCuaDriver(driverOptions) : createVolcengineHybridDriver(driverOptions);
  const adapter = createAgentAdapter({ arm, driver, maxSteps });
  const intent = taskId === 'indico-search-events'
    ? `Starting from the authenticated Indico home page, use only visible browser controls to search for the exact query "${query}". Click the visible global search textbox, type exactly "${query}", press Enter, and wait for the Search heading and results to render. Finish with done verdict pass only when the visible Search page shows one or more event-result titles and every visible event-result title contains the query "${query}" case-insensitively. Do not use DOM selectors, hidden state, or any oracle signal.`
    : `Starting from the authenticated Indico home page, create one public Lecture event. Follow this visible sequence exactly: (1) click the Create event link on the home page, (2) in the event-type chooser click the link named exactly Lecture, (3) wait for the page heading Create new lecture, (4) click the Title textbox, then the very next action MUST be a type action containing exactly "${title}", (5) click the date textbox with placeholder DD/MM/YYYY, then the very next action MUST be a type action containing exactly "${date}", (6) click the Create event button on the form. In the declared controls, textboxes use interaction=type and links/buttons use interaction=click. Keep title and date in separate fields; never type twice into the same field. Finish only after the resulting event page visibly shows the exact title and formatted date 15 January 2030. Return done with verdict pass only then.`;
  result = await adapter.run({
    intent,
    onStep: async ({ step, action }) => {
      trace.push({ step, action, url: page.url() });
      await replayRecorder.capture({ page, phase: 'after-action', step, action, state: await replayState(), providerEventIds: pendingProviderEventIds.splice(0) });
    }
  });
} catch (error) {
  failure = { name: error.name, message: error.message };
}

let oracle = await evaluateOracle();
const deadline = Date.now() + oraclePollMs;
while (oracle.value?.passed !== true && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  oracle = await evaluateOracle();
}
const { taskStateReached, protocolCompleted, oracleOnlySuccess, cellPassed: passed } = deriveAgentOutcome({ failure, result, oraclePassed: oracle.value?.passed === true });
const failureCategory = classifyAgentFailure({ failure, result, oraclePassed: taskStateReached });
if (replayEligible) await replayRecorder.capture({ page, phase: 'final' });
const runRecord = createRunRecord({
  ...(phase2Fields ?? {}),
  run_id: runId,
  application_id: 'indico', application_version: '3.3.6', task_id: taskId, condition: 'clean-stable', arm,
  status: failure ? 'test-failure' : (passed ? 'completed' : (result?.status === 'timeout' ? 'timeout' : 'test-failure')),
  checkpoint_reached: taskStateReached,
  emitted_verdict: result?.emitted_verdict === 'pass' ? 'clean' : (result?.emitted_verdict ?? 'not-emitted'),
  ground_truth_verdict: 'clean',
  timing: { wall_time_ms: result?.wall_time_ms ?? (Date.now() - agentStartedAt), actions: trace.length, retries: result?.retries ?? 0 },
  provenance: { ...(phase2Fields?.provenance ?? {}), runner_version: 'indico-agent-pilot-v0.4', observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure', model_id: process.env.CUA_MODEL ?? null, optimization_profile: optimization.profile_id, hybrid_action_mode: arm === 'hybrid' ? (process.env.CUA_HYBRID_ACTION_MODE ?? optimization.hybrid_action_mode ?? 'coordinate') : null },
  failure_category: passed ? null : failureCategory, trace
});
const replay = replayRecorder.finalize({ status: runRecord.status, checkpointReached: taskStateReached, emittedVerdict: runRecord.emitted_verdict, groundTruthVerdict: runRecord.ground_truth_verdict, failureCategory, error: failure, oraclePassed: oracle.value?.passed === true });
console.log(JSON.stringify({ application: 'indico', task_id: taskId, arm, result: result ?? null, failure: failure ?? null, oracle, task_state_reached: taskStateReached, protocol_completed: protocolCompleted, oracle_only_success: oracleOnlySuccess, cell_passed: passed, trace, replay: replay ? { frame_count: replay.frames.length, schema_version: replay.schema_version } : null, run_record: runRecord }));
if (process.env.PSS_RUN_RECORD_OUT) fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(runRecord)}\n`, { mode: 0o600 });
await browser.close();
if (!passed) process.exitCode = 1;
