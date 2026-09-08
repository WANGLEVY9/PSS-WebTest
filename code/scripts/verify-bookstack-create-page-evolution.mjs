#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function run(command, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function lastJson(stdout) {
  return stdout.trim().split('\n').reverse().map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).find(Boolean) ?? null;
}

async function freshReset() {
  const removeFault = await run('node', ['scripts/bookstack-fault.mjs', 'remove']);
  if (removeFault.code !== 0) {
    return {
      ok: false, phase: 'remove-fault', exit_code: removeFault.code,
      detail: lastJson(removeFault.stdout), stderr: removeFault.stderr.slice(-500)
    };
  }
  const reset = await run('node', ['scripts/bookstack-lifecycle.mjs', 'reset']);
  const detail = lastJson(reset.stdout);
  return {
    ok: reset.code === 0 && ['seed-verified', 'seeded'].includes(detail?.status) && typeof detail?.reset_digest === 'string',
    phase: 'reset', exit_code: reset.code, detail, stderr: reset.stderr.slice(-500)
  };
}

const before = await freshReset();
let execution = null;
let after = null;
try {
  if (before.ok) {
    execution = await run('node', ['scripts/run-bookstack-playwright-cell.mjs'], {
      PSS_PROTOCOL_VERSION: '2.0-draft',
      PSS_CONFIGURATION_ID: 'scripted-playwright-accessibility-human-v2',
      PSS_RESET_DIGEST: before.detail.reset_digest,
      PSS_RANDOMIZATION_BLOCK: 'bookstack-create-page-evolution-control-r01-playwright',
      PSS_PILOT_CONDITION: 'ui-evolution:bookstack-layout-v1',
      PSS_EXPECTED_VERDICT: 'clean',
      PSS_UI_MUTATION: 'bookstack-layout-v1'
    });
  }
} finally {
  after = await freshReset();
}

const result = execution ? lastJson(execution.stdout) : null;
const passed = before.ok && execution?.code === 0 && result?.cell_passed === true && after.ok;
const report = {
  status: passed ? 'behavior-preserved' : 'failed',
  scope: 'local scripted evolution control only; not a three-arm sample and no external model call',
  condition: 'ui-evolution:bookstack-layout-v1',
  before_reset: before,
  execution_exit_code: execution?.code ?? null,
  execution_result: result ? {
    emitted_verdict: result.result?.emitted_verdict ?? null,
    protocol_completed: result.protocol_completed === true,
    independent_oracle_passed: result.oracle?.value?.passed === true,
    cell_passed: result.cell_passed === true
  } : null,
  after_reset: after
};
console.log(JSON.stringify(report));
if (!passed) process.exitCode = 1;
