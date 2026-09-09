import { Stagehand } from '@browserbasehq/stagehand';

const baseUrl = (process.env.PSS_BOOKSTACK_BASE_URL || 'http://localhost:8081').replace('127.0.0.1', 'localhost');
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const modelName = process.env.CUA_MODEL || 'qwen3.7-flash';
const model = modelName.includes('/') ? modelName : `openai/${modelName}`;
const result = {
  schema_version: 'stagehand-qwen-compat-smoke.v1',
  framework: 'stagehand',
  mode: 'hybrid',
  configured_model: modelName,
  routed_model: model,
  status: 'blocked',
  strict_pass: false,
  evidence_scope: 'compatibility smoke; not a matched pilot or confirmatory result'
};

if (!process.env.CUA_API_KEY || !process.env.CUA_BASE_URL || !username || !password) {
  result.reason = 'missing CUA_API_KEY/CUA_BASE_URL or BookStack credentials';
  console.log(`PSS_STAGEHAND_RESULT:${JSON.stringify(result)}`);
  process.exit(0);
}

const stagehand = new Stagehand({
  env: 'LOCAL',
  model: { modelName: model, apiKey: process.env.CUA_API_KEY, baseURL: process.env.CUA_BASE_URL },
  enableTracing: false,
  verbose: 0,
  domSettleTimeout: 1000
});

try {
  await stagehand.init();
  const page = stagehand.context.pages()[0];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeoutMs: 30000 });
  await page.locator("//input[@name='email']").fill(username);
  await page.locator("//input[@name='password']").fill(password);
  const loginButtons = page.locator("//form//button");
  await loginButtons.nth(Math.max(0, (await loginButtons.count()) - 1)).click();
  await page.waitForTimeout(1200);
  result.login_url = (await page.url()).replace(/https?:\/\/[^/]+/, '<sut>');

  const agent = stagehand.agent({
    mode: 'hybrid',
    model: { modelName: model, apiKey: process.env.CUA_API_KEY, baseURL: process.env.CUA_BASE_URL },
    systemPrompt: 'Use the screenshot and page structure to navigate. Do not invent state. Stop after reaching the requested page.'
  });
  const started = Date.now();
  const execution = await agent.execute({
    instruction: 'Open the BookStack book named Book. Do not edit anything.',
    maxSteps: 6,
    highlightCursor: false
  });
  result.elapsed_ms = Date.now() - started;
  result.execution_completed = Boolean(execution?.completed);
  result.execution_action_count = Array.isArray(execution?.actions) ? execution.actions.length : null;
  result.final_url = (await page.url()).replace(/https?:\/\/[^/]+/, '<sut>');
  result.final_heading_count = await page.locator('h1').count();
  result.oracle_passed = result.final_url === '<sut>/books/book' && result.final_heading_count >= 1;
  result.strict_pass = result.oracle_passed;
  result.status = result.strict_pass ? 'completed' : 'failed';
} catch (error) {
  const message = String(error);
  result.reason = message.length > 240 ? `${message.slice(0, 240)}…` : message;
} finally {
  await stagehand.close().catch(() => {});
}

console.log(`PSS_STAGEHAND_RESULT:${JSON.stringify(result)}`);
