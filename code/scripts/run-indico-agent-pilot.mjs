import dotenv from 'dotenv';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { createAgentAdapter } from '../src/arms/agent-adapter.mjs';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { classifyAgentFailure } from '../src/failure-taxonomy.mjs';
import { deriveAgentOutcome } from '../src/outcome-admission.mjs';

dotenv.config();
const arm = process.env.INDICO_ARM;
if (!['visual', 'hybrid'].includes(arm)) throw new Error('INDICO_ARM must be visual or hybrid');
const username = process.env.PSS_INDICO_USERNAME;
const password = process.env.PSS_INDICO_PASSWORD;
if (!username || !password) throw new Error('Indico credentials must be configured in the local environment');
const baseURL = process.env.INDICO_BASE_URL ?? 'http://localhost:8080';
const title = process.env.PSS_INDICO_EVENT_TITLE ?? 'PSS Phase2 Event';
const date = process.env.PSS_INDICO_EVENT_DATE ?? '15/01/2030';
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? '14', 10);
const viewport = { width: 1280, height: 720 };
const screenshotQuality = Number.parseInt(process.env.CUA_SCREENSHOT_QUALITY ?? '85', 10);
const oraclePollMs = Number.parseInt(process.env.PSS_ORACLE_POLL_MS ?? '5000', 10);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
const trace = [];

const screenshot = async () => `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: screenshotQuality, animations: 'disabled' })).toString('base64')}`;
const executeAction = async (action) => {
  if (['click', 'double_click'].includes(action.type) && (action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height)) throw new Error(`pointer action outside viewport: ${action.x},${action.y}`);
  // Indico renders the event-type form after a server-backed navigation.  A
  // short fixed settle window keeps the observation contract screenshot-only
  // while preventing the next provider decision from seeing the stale home
  // dropdown.  The delay is part of the runner timing, never an oracle signal.
  if (action.type === 'click') { await page.mouse.click(action.x, action.y); return page.waitForTimeout(1000); }
  if (action.type === 'double_click') { await page.mouse.dblclick(action.x, action.y); return page.waitForTimeout(1000); }
  if (action.type === 'type') { await page.keyboard.type(action.text); return page.waitForTimeout(200); }
  if (action.type === 'keypress') { const aliases = { ENTER: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab', SPACE: 'Space', BACKSPACE: 'Backspace' }; await page.keyboard.press(aliases[action.key.toUpperCase()] ?? action.key); return page.waitForTimeout(350); }
  if (action.type === 'scroll') return page.mouse.wheel(0, action.delta_y);
  if (action.type === 'wait') return page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
  throw new Error(`Unsupported action: ${action.type}`);
};

const hybridStructure = async () => page.locator('a,button,input:not([type="hidden"]),textarea,select').evaluateAll((elements) => elements.map((element) => {
  const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
  if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return null;
  const inputType = element.tagName === 'INPUT' ? (element.getAttribute('type') || 'text').toLowerCase() : '';
  const role = element.tagName === 'A' ? 'link' : element.tagName === 'BUTTON' || ['button', 'submit', 'reset'].includes(inputType) ? 'button' : element.tagName === 'SELECT' ? 'combobox' : 'textbox';
  const label = element.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim();
  const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || label || element.getAttribute('name') || element.getAttribute('value') || element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
  return { role, name, interaction: role === 'textbox' ? 'type' : 'click', center_normalized_1000: { x: Math.round((rect.x + rect.width / 2) * 1000 / innerWidth), y: Math.round((rect.y + rect.height / 2) * 1000 / innerHeight) } };
}).filter(Boolean).slice(0, 80));

const evaluateOracle = () => new Promise((resolve, reject) => {
  const child = spawn('node', ['scripts/evaluate-indico-event.mjs'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.on('error', reject);
  child.on('close', (code) => { const line = output.trim().split('\n').reverse().find((candidate) => candidate.startsWith('{')); resolve({ code, value: line ? JSON.parse(line) : null }); });
});

let result;
let failure;
const agentStartedAt = Date.now();
try {
  await page.goto(`${baseURL}/login/`);
  await page.getByRole('textbox', { name: 'Username or email' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login with Indico' }).click();
  await page.getByRole('button', { name: 'Create event' }).waitFor();
  const driverOptions = { executeAction, timeoutMs: Number.parseInt(process.env.CUA_TIMEOUT_MS ?? '20000', 10), wallTimeoutMs: Number.parseInt(process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0', 10) };
  if (arm === 'visual') driverOptions.observeScreenshot = screenshot;
  else driverOptions.observeHybrid = async () => ({ screenshot: await screenshot(), pageStructure: { controls: await hybridStructure() }, viewport });
  const driver = arm === 'visual' ? createVolcengineCuaDriver(driverOptions) : createVolcengineHybridDriver(driverOptions);
  const adapter = createAgentAdapter({ arm, driver, maxSteps });
  result = await adapter.run({
    intent: `Starting from the authenticated Indico home page, create one public Lecture event. Follow this visible sequence exactly: (1) click the Create event link on the home page, (2) in the event-type chooser click the link named exactly Lecture, (3) wait for the page heading Create new lecture, (4) click the Title textbox, then the very next action MUST be a type action containing exactly "${title}", (5) click the date textbox with placeholder DD/MM/YYYY, then the very next action MUST be a type action containing exactly "${date}", (6) click the Create event button on the form. In the declared controls, textboxes use interaction=type and links/buttons use interaction=click. Keep title and date in separate fields; never type twice into the same field. Finish only after the resulting event page visibly shows the exact title and formatted date 15 January 2030. Return done with verdict pass only then.`,
    onStep: async ({ step, action }) => { trace.push({ step, action, url: page.url() }); }
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
const runRecord = createRunRecord({
  run_id: `indico-${arm}-${Date.now()}`,
  application_id: 'indico', application_version: '3.3.6', task_id: 'indico-create-event', condition: 'clean-stable', arm,
  status: failure ? 'test-failure' : (passed ? 'completed' : (result?.status === 'timeout' ? 'timeout' : 'test-failure')),
  checkpoint_reached: taskStateReached,
  emitted_verdict: result?.emitted_verdict === 'pass' ? 'clean' : (result?.emitted_verdict ?? 'not-emitted'),
  ground_truth_verdict: 'clean',
  timing: { wall_time_ms: result?.wall_time_ms ?? (Date.now() - agentStartedAt), actions: trace.length, retries: result?.retries ?? 0 },
  provenance: { runner_version: 'indico-agent-pilot-v0.2', observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure', model_id: process.env.CUA_MODEL ?? null },
  failure_category: passed ? null : failureCategory, trace
});
console.log(JSON.stringify({ application: 'indico', arm, result: result ?? null, failure: failure ?? null, oracle, task_state_reached: taskStateReached, protocol_completed: protocolCompleted, oracle_only_success: oracleOnlySuccess, cell_passed: passed, trace, run_record: runRecord }));
if (process.env.PSS_RUN_RECORD_OUT) fs.appendFileSync(process.env.PSS_RUN_RECORD_OUT, `${JSON.stringify(runRecord)}\n`, { mode: 0o600 });
await browser.close();
if (!passed) process.exitCode = 1;
