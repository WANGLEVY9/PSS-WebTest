import 'dotenv/config';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const repositoryRoot = `${root}/..`;
const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '1', 10);
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? '8', 10);
const timeoutMs = Number.parseInt(process.env.CUA_TIMEOUT_MS ?? '15000', 10);
const maxResetAttempts = Number.parseInt(process.env.PSS_RESET_MAX_ATTEMPTS ?? '2', 10);
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const mutation = process.env.PSS_UI_MUTATION ?? null;
const provider = process.env.CUA_PROVIDER ?? null;
const model = process.env.CUA_MODEL ?? null;
const conditionSlug = condition.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'condition';
const modelSlug = model ? `${provider ?? 'provider'}-${model}`.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') : 'unconfigured';
const runSlug = `${conditionSlug}-${modelSlug}`;
const artifactName = `bookstack-navigation-${runSlug}-pilot.json`;
const recordsName = `bookstack-navigation-${runSlug}-records.jsonl`;
const artifact = `${repositoryRoot}/artifacts/phase2/${artifactName}`;
const recordsPath = `${repositoryRoot}/artifacts/phase2/${recordsName}`;
const taskId = 'bookstack-open-book';
const arms = ['playwright', 'visual', 'hybrid'];

function run(command, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function lastJson(stdout) {
  return stdout.trim().split('\n').reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find(Boolean) ?? null;
}

async function resetWithRetry() {
  const attempts = [];
  for (let attempt = 1; attempt <= maxResetAttempts; attempt += 1) {
    const result = await run('node', ['scripts/bookstack-lifecycle.mjs', 'reset']);
    const summary = lastJson(result.stdout);
    const passed = result.code === 0 && ['seed-verified', 'seeded'].includes(summary?.status);
    attempts.push({ attempt, exit_code: result.code, status: summary?.status ?? null, stderr: result.stderr.slice(-500) });
    if (passed) return { ok: true, attempts };
  }
  return { ok: false, attempts };
}

const records = [];
const write = () => {
  fs.mkdirSync(`${repositoryRoot}/artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({ application: 'bookstack', task_id: taskId, condition, mutation, provider, model, model_slug: modelSlug, repetitions, arms, records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false }, null, 2)}\n`, { mode: 0o600 });
};

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  for (const arm of arms) {
    const reset = await resetWithRetry();
    const cleanStateVerified = reset.ok;
    let execution;
    let result;
    if (!cleanStateVerified) {
      records.push({ repetition, arm, provider, model, reset_ok: false, clean_state_verified: false, reset_attempts: reset.attempts, reset_retry_used: reset.attempts.length > 1, execution_exit_code: null, oracle_passed: false, cell_passed: false, failure_category: 'environment' });
      write();
      continue;
    }
    if (arm === 'playwright') {
      execution = await run('node', ['scripts/run-bookstack-navigation-playwright.mjs'], { PSS_RUN_RECORD_OUT: recordsPath, PSS_PILOT_CONDITION: condition, PSS_UI_MUTATION: mutation ?? '' });
      result = lastJson(execution.stdout);
    } else {
      execution = await run('node', ['scripts/run-bookstack-agent-pilot.mjs'], {
        BOOKSTACK_ARM: arm, PSS_BOOKSTACK_TASK_ID: taskId, CUA_MAX_STEPS: String(maxSteps), CUA_TIMEOUT_MS: String(timeoutMs),
        CUA_MAX_DECISION_RETRIES: process.env.CUA_MAX_DECISION_RETRIES ?? '3',
        PSS_PILOT_CONDITION: condition, PSS_UI_MUTATION: mutation ?? '',
        PSS_RUN_RECORD_OUT: recordsPath
      });
      result = lastJson(execution.stdout);
    }
    const oraclePassed = result?.oracle?.value?.passed === true || result?.oracle?.passed === true;
    const completed = execution.code === 0 && (result?.result?.status === 'completed' || result?.run_record?.status === 'completed');
    records.push({
      repetition, arm, provider, model, reset_ok: true, clean_state_verified: true, reset_attempts: reset.attempts, reset_retry_used: reset.attempts.length > 1, execution_exit_code: execution.code,
      agent_status: result?.result?.status ?? result?.run_record?.status ?? null,
      emitted_verdict: result?.result?.emitted_verdict ?? result?.run_record?.emitted_verdict ?? null,
      agent_completed: completed, oracle_passed: oraclePassed,
      oracle_url: result?.oracle?.value?.url ?? result?.oracle?.url ?? null,
      cell_passed: completed && oraclePassed,
      failure_category: result?.run_record?.failure_category ?? (execution.code === 0 ? null : 'execution'),
      failure_message: result?.failure?.message ? String(result.failure.message).slice(0, 300) : null
    });
    write();
  }
}

const summary = { application: 'bookstack', task_id: taskId, condition, mutation, provider, model, model_slug: modelSlug, repetitions, arms, records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false };
write();
console.log(JSON.stringify({ artifact, task_id: taskId, passed_cells: summary.passed_cells, total_cells: summary.total_cells }));
if (summary.passed_cells !== summary.total_cells) process.exitCode = 1;
