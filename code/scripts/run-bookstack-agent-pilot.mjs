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
import { deriveAgentOutcome, normalizeAgentVerdict } from '../src/outcome-admission.mjs';
import { evaluateBookStackOpenBookPage } from '../src/oracles/bookstack-visible.mjs';
import { installBookStackLayoutMutation } from '../src/mutations/bookstack-layout.mjs';

dotenv.config();
const arm = process.env.BOOKSTACK_ARM;
if (!['visual', 'hybrid'].includes(arm)) throw new Error('BOOKSTACK_ARM must be visual or hybrid');
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
if (!username || !password) throw new Error('BookStack credentials must be configured in the local environment');
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const taskId = process.env.PSS_BOOKSTACK_TASK_ID ?? 'bookstack-create-page';
if (!['bookstack-create-page', 'bookstack-open-book', 'bookstack-search-and-open-book2'].includes(taskId)) throw new Error(`Unsupported PSS_BOOKSTACK_TASK_ID: ${taskId}`);
const targetBook = process.env.PSS_BOOKSTACK_TARGET_BOOK ?? (taskId === 'bookstack-search-and-open-book2' ? 'Book2' : 'Book');
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const title = process.env.PSS_BOOKSTACK_PAGE_TITLE ?? 'PSS Phase2 Page';
const content = process.env.PSS_BOOKSTACK_PAGE_CONTENT ?? 'PSS Phase2 Content';
const expectedVerdict = process.env.PSS_EXPECTED_VERDICT ?? 'clean';
if (!['clean', 'fault'].includes(expectedVerdict)) throw new Error('PSS_EXPECTED_VERDICT must be clean or fault');
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? '14', 10);
const screenshotQuality = Number.parseInt(process.env.CUA_SCREENSHOT_QUALITY ?? '85', 10);
const oraclePollMs = Number.parseInt(process.env.PSS_ORACLE_POLL_MS ?? '5000', 10);
const viewport = { width: 1280, height: 720 };
const phase2Protocol = process.env.PSS_PROTOCOL_VERSION === '2.0-draft';
const codeRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const phase2Fields = phase2Protocol
  ? createPhase2Provenance({
    registry: loadConfigurationRegistry(),
    configurationId: process.env.PSS_CONFIGURATION_ID,
    runManifestPath: process.env.PSS_RUN_MANIFEST_PATH ?? `${codeRoot}/config/${taskId === 'bookstack-open-book' ? 'bookstack-navigation' : taskId === 'bookstack-search-and-open-book2' ? 'bookstack-search-open-book2' : 'bookstack-create-page'}-run-manifest.v0.2.json`,
    taskManifestPath: process.env.PSS_TASK_MANIFEST_PATH ?? `${codeRoot}/manifests/task-manifest.v0.1.json`,
    applicationId: 'bookstack',
    resetDigest: process.env.PSS_RESET_DIGEST,
    randomizationBlock: process.env.PSS_RANDOMIZATION_BLOCK,
    environment: {
      runner: 'bookstack-agent-pilot-v0.2', base_url: baseURL, arm,
      viewport: `${viewport.width}x${viewport.height}`, max_steps: maxSteps,
      timeout_ms: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? '15000', 10),
      coordinate_mode: process.env.CUA_COORDINATE_MODE ?? 'normalized_1000',
      action_output_mode: process.env.CUA_PROVIDER === 'aliyun' ? (process.env.CUA_ALIYUN_ACTION_MODE ?? 'tool') : null
    }
  })
  : null;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport });
if (process.env.PSS_UI_MUTATION === 'bookstack-layout-v1') await installBookStackLayoutMutation(context);
const page = await context.newPage();
const trace = [];
const screenshot = async () => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.waitForTimeout(250);
      return `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: screenshotQuality, animations: 'disabled' })).toString('base64')}`;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(attempt * 500);
    }
  }
  throw lastError;
};

await page.goto(`${baseURL}/`);
await page.getByRole('link', { name: 'Log in' }).click();
await page.getByRole('textbox', { name: 'Email' }).fill(username);
await page.getByRole('textbox', { name: 'Password' }).fill(password);
await page.getByRole('button', { name: 'Log In' }).click();
await page.getByRole('link', { name: 'Books', exact: true }).waitFor();

const executeAction = async (action) => {
  if (['click', 'double_click'].includes(action.type) && (action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height)) {
    throw new Error(`pointer action outside viewport: ${action.x},${action.y}`);
  }
  if (action.type === 'click') { await page.mouse.click(action.x, action.y); return page.waitForTimeout(350); }
  if (action.type === 'double_click') { await page.mouse.dblclick(action.x, action.y); return page.waitForTimeout(350); }
  if (action.type === 'type') { await page.keyboard.type(action.text); return page.waitForTimeout(200); }
  if (action.type === 'keypress') {
    const aliases = { ENTER: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab', SPACE: 'Space', BACKSPACE: 'Backspace' };
    await page.keyboard.press(aliases[action.key.toUpperCase()] ?? action.key); return page.waitForTimeout(350);
  }
  if (action.type === 'scroll') return page.mouse.wheel(0, action.delta_y);
  if (action.type === 'wait') return page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
  throw new Error(`Unsupported action: ${action.type}`);
};

const hybridPageStructure = async () => page.locator('a,button,input:not([type="hidden"]),textarea,iframe[title="Rich Text Area"]').evaluateAll((elements) => {
  const roleFor = (element) => {
    if (element.tagName === 'A') return 'link';
    if (element.tagName === 'BUTTON') return 'button';
    if (element.tagName === 'IFRAME') return 'textbox';
    return element.getAttribute('role') || (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ? 'textbox' : element.tagName.toLowerCase());
  };
  return elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return null;
    const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || (element.tagName === 'IFRAME' ? 'Page content editor' : '');
    return {
      role: roleFor(element),
      name,
      center_normalized_1000: {
        x: Math.round((rect.x + rect.width / 2) * 1000 / innerWidth),
        y: Math.round((rect.y + rect.height / 2) * 1000 / innerHeight)
      }
    };
  }).filter(Boolean).slice(0, 80);
});

const driverOptions = {
  executeAction,
  timeoutMs: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? '15000', 10),
  wallTimeoutMs: Number.parseInt(process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0', 10),
  coordinateMode: arm === 'visual' ? (process.env.CUA_VISUAL_COORDINATE_MODE ?? process.env.CUA_COORDINATE_MODE ?? 'normalized_1000') : (process.env.CUA_COORDINATE_MODE ?? 'normalized_1000'),
  // A navigation workflow has only the historical pass label. A test
  // workflow must be able to explicitly report either visible outcome.
  doneVerdicts: ['bookstack-open-book', 'bookstack-search-and-open-book2'].includes(taskId) ? ['pass'] : ['clean', 'fault']
};
if (arm === 'visual') {
  driverOptions.observeScreenshot = screenshot;
} else {
    driverOptions.observeHybrid = async () => ({
    screenshot: await screenshot(),
    pageStructure: { controls: await hybridPageStructure() },
    viewport
  });
}
const driver = arm === 'visual' ? createVolcengineCuaDriver(driverOptions) : createVolcengineHybridDriver(driverOptions);
let result;
let failure;
const agentStartedAt = Date.now();
try {
  const adapter = createAgentAdapter({ arm, driver, maxSteps });
  const intent = taskId === 'bookstack-open-book'
    ? `Starting from the authenticated BookStack home page, open Books, then open the book named exactly "${targetBook}". The correct success location is the book overview at the exact route /books/book, not any chapter, page, draft, or editor descendant. Do not click chapter/page links. As soon as the exact Book heading is visible on the book overview, immediately return done with verdict pass. Do not create or edit any page.`
    : taskId === 'bookstack-search-and-open-book2'
      ? `This is a pure navigation task: do not type into any textbox, search field, or other input. "Search Results" is a heading to observe, not text to enter; "${targetBook}" is a link to click, not text to type. Starting from the authenticated BookStack home page, click the visible Search control and wait until the exact heading "Search Results" is visible. Then click Books, then click the book named exactly "${targetBook}". The correct success location is the book overview at the exact route /books/book2, not any chapter, page, draft, or editor descendant. Do not click chapter/page links. As soon as the exact Book2 heading is visible on that overview, immediately return done with verdict pass. Do not create or edit any page, and do not inspect hidden state, source code, databases, or evaluator information.`
    : `Starting from the authenticated BookStack home page, create a new page in the book named "Book" (the link whose visible name is exactly Book). Open Books, open that Book, choose New Page, set the page title to "${title}". Then click once near the center of the large white page content editor below the formatting toolbar (not the title field or toolbar), and on the very next action type the page content "${content}"; keep the title and content in their separate fields, never append content to the title, and never click the editor repeatedly instead of typing. Save the page and inspect the visible saved page. If it visibly shows both the exact title and content, return done with verdict clean. If the title is visible but the saved content differs from "${content}", return done with verdict fault. If neither conclusion is visible, continue or return unknown. Do not inspect databases, triggers, source code, or hidden evaluator information.`;
  result = await adapter.run({
    intent,
    onStep: async ({ step, action }) => { trace.push({ step, action, url: page.url() }); }
  });
} catch (error) {
  failure = { name: error.name, message: error.message };
}

const evaluateCreateOracle = () => new Promise((resolve, reject) => {
  const child = spawn('node', ['scripts/evaluate-bookstack-page.mjs'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk; });
  child.on('error', reject);
  child.on('close', (code) => {
    const line = out.trim().split('\n').reverse().find((candidate) => candidate.startsWith('{'));
    resolve({ code, value: line ? JSON.parse(line) : null });
  });
});

const evaluateOracle = async () => ['bookstack-open-book', 'bookstack-search-and-open-book2'].includes(taskId)
  ? { code: 0, value: await evaluateBookStackOpenBookPage(page, targetBook) }
  : evaluateCreateOracle();

// The save request is asynchronous at the application/database boundary. Poll
// only the independent post-run oracle; no oracle result is exposed to the
// agent or used to choose its actions.
let oracle = await evaluateOracle();
const oracleDeadline = Date.now() + oraclePollMs;
while (oracle.value?.passed !== true && Date.now() < oracleDeadline) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  oracle = await evaluateOracle();
}
const { taskStateReached, protocolCompleted, oracleOnlySuccess, cellPassed: passed } = deriveAgentOutcome({ failure, result, oraclePassed: oracle.value?.passed === true, expectedVerdict });
const failureCategory = classifyAgentFailure({ failure, result, oraclePassed: taskStateReached, expectedVerdict });
const { provenance: phase2Provenance = {}, ...phase2RecordFields } = phase2Fields ?? {};
const runRecord = createRunRecord({
  ...phase2RecordFields,
  run_id: `bookstack-${arm}-${Date.now()}`,
  application_id: 'bookstack', application_version: '24.10.1', task_id: taskId, condition, arm,
  status: failure ? 'test-failure' : (passed ? 'completed' : (result?.status === 'timeout' ? 'timeout' : 'test-failure')),
  // This field represents the independently evaluated SUT postcondition, not
  // the conjunction of postcondition and agent termination correctness.
  checkpoint_reached: taskStateReached,
  emitted_verdict: normalizeAgentVerdict(result?.emitted_verdict),
  ground_truth_verdict: expectedVerdict,
  timing: { wall_time_ms: result?.wall_time_ms ?? (Date.now() - agentStartedAt), actions: trace.length, retries: result?.retries ?? 0 },
  provenance: { ...phase2Provenance, runner_version: 'bookstack-agent-pilot-v0.2', observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure', model_id: process.env.CUA_MODEL ?? null },
  failure_category: passed ? null : failureCategory, trace
});
console.log(JSON.stringify({ application: 'bookstack', arm, result: result ?? null, failure: failure ?? null, oracle, task_state_reached: taskStateReached, protocol_completed: protocolCompleted, oracle_only_success: oracleOnlySuccess, cell_passed: passed, failure_category: passed ? null : failureCategory, trace, run_record: runRecord }));
if (process.env.PSS_RUN_RECORD_OUT) fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(runRecord)}\n`, { mode: 0o600 });
await browser.close();
if (failure || !passed) process.exitCode = 1;
