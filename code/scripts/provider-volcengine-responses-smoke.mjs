import 'dotenv/config';
import { chromium } from 'playwright';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';

const viewport = { width: 640, height: 480 };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
await page.setContent('<main><h1>Provider smoke</h1><button id="save">Save</button></main>');
const screenshot = (await page.screenshot({ type: 'png' })).toString('base64');
const structure = { role: 'main', children: [{ role: 'button', name: 'Save', target_id: 'c1', interaction: 'click' }] };
const common = { env: process.env, timeoutMs: 60000, maxRetries: 1, executeAction: async () => {} };
const visual = createVolcengineCuaDriver({ ...common, observeScreenshot: async () => screenshot });
const hybrid = createVolcengineHybridDriver({ ...common, hybridActionMode: 'semantic', observeHybrid: async () => ({ screenshot, pageStructure: structure, viewport }) });
const result = { provider: process.env.CUA_PROVIDER ?? null, model: process.env.CUA_MODEL ?? null, visual: null, hybrid: null };
try {
  const visualDecision = await visual.decide({ intent: 'Click the visible Save button. Return exactly one safe action.', observation: await visual.observe(), step: 0 });
  result.visual = { status: 'ok', decision_type: visualDecision.type, action_type: visualDecision.action?.type ?? null, retries: visual.getRetryCount() };
} catch (error) {
  result.visual = { status: 'error', error_name: error.name, error_message: error.message };
}
try {
  const hybridDecision = await hybrid.decide({ intent: 'Click the visible Save button. Return exactly one safe action.', observation: await hybrid.observe(), step: 0 });
  result.hybrid = { status: 'ok', decision_type: hybridDecision.type, action_type: hybridDecision.action?.type ?? null, target_id: hybridDecision.action?.target_id ?? null, retries: hybrid.getRetryCount() };
} catch (error) {
  result.hybrid = { status: 'error', error_name: error.name, error_message: error.message };
}
await browser.close();
console.log(JSON.stringify(result));
if (result.visual?.status !== 'ok' || result.hybrid?.status !== 'ok') process.exitCode = 1;
