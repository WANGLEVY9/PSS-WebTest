import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Stagehand } from '@browserbasehq/stagehand';

const codeRoot = resolve(import.meta.dirname, '..');
const outputPath = resolve(codeRoot, process.env.PSS_FRAMEWORK_TASK_SMOKE_OUT || '../research/framework-task-smoke-2026-09-09.json');

async function stagehandCompatibility() {
  const result = { framework: 'stagehand', status: 'blocked', strict_pass: false, task_adapter: 'stagehand-qwen-custom-v0.1' };
  // Stagehand's built-in agent.execute path emits AI-SDK tool-result parts
  // rejected by DashScope Qwen. The repository therefore uses a custom
  // LLMClient with stagehand.act plus visible locator fallback.
  if (process.env.CUA_MODEL && !['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini', 'gpt-4o', 'gpt-4o-mini', 'moonshotai/kimi-k2-instruct'].includes(process.env.CUA_MODEL)) {
    return { ...result, status: 'implemented-custom-client', reason: 'Qwen custom LLMClient is available; run framework:stagehand:qwen:v02 for a real task record' };
  }
  const stagehand = new Stagehand({ env: 'LOCAL', enableTracing: false, verbose: 0 });
  try {
    await stagehand.init();
    stagehand.agent({
      mode: 'hybrid',
      model: { provider: 'openai', modelName: process.env.CUA_MODEL, apiKey: process.env.CUA_API_KEY, baseURL: process.env.CUA_BASE_URL }
    });
    result.status = 'model-config-accepted';
    result.reason = 'built-in agent construction accepted the configured model; custom client remains the Qwen path';
  } catch (error) {
    const message = String(error);
    result.reason = message.includes('UnsupportedModelError') ? 'configured Qwen model is not in Stagehand supported-model registry' : 'stagehand model configuration failed';
  } finally {
    await stagehand.close().catch(() => {});
  }
  return result;
}

function runBrowserUse() {
  return new Promise((resolvePromise) => {
    const python = process.env.PSS_BROWSER_USE_PYTHON || process.env.PSS_BROWSER_USE_BIN;
    if (!python) return resolvePromise({ framework: 'browser-use', status: 'blocked', strict_pass: false, reason: 'PSS_BROWSER_USE_PYTHON not configured' });
    const child = spawn(python, ['scripts/framework-browser-use-smoke.py'], { cwd: codeRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.on('close', () => {
      const line = stdout.trim().split('\n').find((candidate) => candidate.startsWith('PSS_FRAMEWORK_RESULT:'));
      if (!line) return resolvePromise({ framework: 'browser-use', status: 'error', strict_pass: false, reason: 'no redacted result marker' });
      try { return resolvePromise(JSON.parse(line.slice('PSS_FRAMEWORK_RESULT:'.length))); } catch { return resolvePromise({ framework: 'browser-use', status: 'error', strict_pass: false, reason: 'invalid result marker' }); }
    });
  });
}

const stagehand = await stagehandCompatibility();
const browserUse = await runBrowserUse();
const result = {
  schema_version: 'framework-task-smoke.v1',
  generated_at: new Date().toISOString(),
  sut: 'BookStack',
  task: 'bookstack-open-book',
  evidence_scope: 'exploratory framework smoke only; not a matched three-arm run and not confirmatory evidence',
  variants: { stagehand, browser_use: browserUse, agentlab_browsergym: { status: 'adapter-ready', strict_pass: false, task_adapter: 'pss-bookstack-open-book', reason: 'setup/observation/oracle adapter is implemented; model-backed AgentLab policy remains a separate adapter' } },
  fail_closed: true
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ ...result, output: outputPath }, null, 2));
