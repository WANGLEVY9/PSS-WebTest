import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Stagehand } from '@browserbasehq/stagehand';

const codeRoot = resolve(import.meta.dirname, '..');
const outputPath = resolve(codeRoot, process.env.PSS_FRAMEWORK_TASK_SMOKE_OUT || '../research/framework-task-smoke-2026-09-09.json');

async function stagehandCompatibility() {
  const result = { framework: 'stagehand', status: 'blocked', strict_pass: false, task_adapter: 'pending' };
  // Stagehand validates its model registry when execute() is called. Keep the
  // current Qwen-compatible endpoint fail-closed instead of pretending that
  // agent construction is a task run.
  if (process.env.CUA_MODEL && !['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini', 'gpt-4o', 'gpt-4o-mini', 'moonshotai/kimi-k2-instruct'].includes(process.env.CUA_MODEL)) {
    return { ...result, reason: 'configured model is rejected by Stagehand at execute-time (outside its supported model registry)' };
  }
  const stagehand = new Stagehand({ env: 'LOCAL', enableTracing: false, verbose: 0 });
  try {
    await stagehand.init();
    stagehand.agent({
      mode: 'hybrid',
      model: { provider: 'openai', modelName: process.env.CUA_MODEL, apiKey: process.env.CUA_API_KEY, baseURL: process.env.CUA_BASE_URL }
    });
    result.status = 'model-config-accepted';
    result.reason = 'agent construction accepted the configured model; task run remains pending';
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
  variants: { stagehand, browser_use: browserUse, agentlab_browsergym: { status: 'blocked', strict_pass: false, task_adapter: 'pending', reason: 'BrowserGym task adapter not implemented for this PSS task' } },
  fail_closed: true
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ ...result, output: outputPath }, null, 2));
