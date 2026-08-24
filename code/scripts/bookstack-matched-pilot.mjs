import 'dotenv/config';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { appendRunRecord, createTraditionalRunRecord } from '../src/traditional-run-record.mjs';

const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '3', 10);
const maxSteps = process.env.CUA_MAX_STEPS ?? '3';
const timeoutMs = process.env.CUA_TIMEOUT_MS ?? '8000';
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const mutation = process.env.PSS_UI_MUTATION ?? null;
const provider = process.env.CUA_PROVIDER ?? null;
const model = process.env.CUA_MODEL ?? null;
const maxResetAttempts = Number.parseInt(process.env.PSS_RESET_MAX_ATTEMPTS ?? '2', 10);
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const conditionSlug = condition.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'condition';
const modelSlug = model ? `${provider ?? 'provider'}-${model}`.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') : 'unconfigured';
const runSlug = `${conditionSlug}-${modelSlug}`;
const artifactName = `bookstack-three-arm-${runSlug}-pilot.json`;
const recordsName = `bookstack-three-arm-${runSlug}-records.jsonl`;
const artifact = `${root}/../artifacts/phase2/${artifactName}`;
const recordsPath = `${root}/../artifacts/phase2/${recordsName}`;

const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
});
const lastJson = (stdout) => stdout.trim().split('\n').reverse().map((x) => { try { return JSON.parse(x); } catch { return null; } }).find(Boolean) ?? null;
async function resetWithRetry() {
  const attempts = [];
  for (let attempt = 1; attempt <= maxResetAttempts; attempt += 1) {
    const result = await run('node', ['scripts/bookstack-lifecycle.mjs', 'reset']);
    const summary = lastJson(result.stdout);
    const passed = result.code === 0 && summary?.status === 'seeded';
    attempts.push({ attempt, exit_code: result.code, status: summary?.status ?? null, stderr: result.stderr.slice(-500) });
    if (passed) return { ok: true, attempts };
  }
  return { ok: false, attempts };
}
const records = [];
const writeSummary = () => {
  fs.mkdirSync(`${root}/../artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({ application: 'bookstack', task_id: 'bookstack-create-page', condition, mutation, provider, model, model_slug: modelSlug, repetitions, arms: ['playwright', 'visual', 'hybrid'], max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false }, null, 2)}\n`, { mode: 0o600 });
};
for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  for (const arm of ['playwright', 'visual', 'hybrid']) {
    const reset = await resetWithRetry();
    const preOracleRun = reset.ok ? await run('node', ['scripts/evaluate-bookstack-page.mjs']) : { code: 1, stdout: '' };
    const preOracle = lastJson(preOracleRun.stdout);
    const cleanStateVerified = reset.ok && preOracleRun.code === 1 && preOracle?.matches === 0 && preOracle?.passed === false;
    let execution;
    let oracle;
    let result = null;
    if (!cleanStateVerified) {
      records.push({ repetition, arm, provider, model, reset_ok: reset.ok, clean_state_verified: false, reset_attempts: reset.attempts, reset_retry_used: reset.attempts.length > 1, execution_exit_code: null, oracle_passed: false, oracle_matches: preOracle?.matches ?? null, failure_category: 'environment' });
      writeSummary();
      console.log(JSON.stringify(records.at(-1)));
      continue;
    }
    if (arm === 'playwright') {
      const startedAt = Date.now();
      execution = await run('npx', ['playwright', 'test', 'tests/traditional/bookstack-create-page.spec.js', '--project=chromium'], {
        SUT_BASE_URL: baseURL, RUN_BOOKSTACK_VERTICAL_SLICE: '1',
        PSS_BOOKSTACK_USERNAME: process.env.PSS_BOOKSTACK_USERNAME, PSS_BOOKSTACK_PASSWORD: process.env.PSS_BOOKSTACK_PASSWORD
      });
      const oracleRun = await run('node', ['scripts/evaluate-bookstack-page.mjs']); oracle = lastJson(oracleRun.stdout);
      appendRunRecord(createTraditionalRunRecord({ application_id: 'bookstack', application_version: process.env.BOOKSTACK_VERSION ?? '24.10.1', task_id: 'bookstack-create-page', execution_exit_code: execution.code, oracle, wall_time_ms: Date.now() - startedAt, actions: 11, runner_version: 'bookstack-playwright-cell-v0.2', trace: [{ kind: 'scripted-sequence', action_count: 11 }] }), recordsPath);
    } else {
      execution = await run('node', ['scripts/run-bookstack-agent-pilot.mjs'], {
        BOOKSTACK_ARM: arm, CUA_MAX_STEPS: maxSteps, CUA_TIMEOUT_MS: timeoutMs,
        PSS_BOOKSTACK_USERNAME: process.env.PSS_BOOKSTACK_USERNAME, PSS_BOOKSTACK_PASSWORD: process.env.PSS_BOOKSTACK_PASSWORD,
        PSS_RUN_RECORD_OUT: recordsPath
      });
      result = lastJson(execution.stdout); oracle = result?.oracle?.value ?? null;
    }
    const agentCompleted = execution.code === 0;
    const oraclePassed = oracle?.passed === true;
    records.push({
      repetition, arm, provider, model, reset_ok: reset.ok, clean_state_verified: true, reset_attempts: reset.attempts, reset_retry_used: reset.attempts.length > 1,
      execution_exit_code: execution.code,
      agent_status: result?.result?.status ?? result?.run_record?.status ?? null,
      agent_completed: agentCompleted, oracle_passed: oraclePassed,
      cell_passed: agentCompleted && oraclePassed, oracle_matches: oracle?.matches ?? null,
      run_id: result?.run_record?.run_id ?? null,
      failure_category: result?.run_record?.failure_category ?? null,
      failure_message: result?.failure?.message ? String(result.failure.message).slice(0, 300) : null
    });
    writeSummary();
    console.log(JSON.stringify(records.at(-1)));
  }
}
const summary = { application: 'bookstack', task_id: 'bookstack-create-page', condition, mutation, provider, model, model_slug: modelSlug, repetitions, arms: ['playwright', 'visual', 'hybrid'], max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false };
writeSummary();
console.log(JSON.stringify({ artifact, passed_cells: summary.passed_cells, total_cells: summary.total_cells }));
