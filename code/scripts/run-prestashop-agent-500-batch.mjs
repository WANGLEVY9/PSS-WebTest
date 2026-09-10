import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
const plan = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/prestashop-agent-500-batch.v0.1.json'), 'utf8'));
const arm = process.env.PSS_AGENT_BATCH_ARM;
if (!['visual', 'hybrid'].includes(arm)) throw new Error('PSS_AGENT_BATCH_ARM must be visual or hybrid');
const total = Number.parseInt(process.env.PSS_AGENT_TOTAL ?? String(plan.target_executions_per_arm), 10);
const allowSubset = process.env.PSS_AGENT_ALLOW_SUBSET === '1';
if (!Number.isInteger(total) || total < 1 || (!allowSubset && total < plan.target_executions_per_arm)) throw new Error(`PSS_AGENT_TOTAL must be at least ${plan.target_executions_per_arm} unless PSS_AGENT_ALLOW_SUBSET=1 is explicitly set for a smoke/recovery probe`);
for (const name of ['PSS_PRESTASHOP_USERNAME', 'PSS_PRESTASHOP_PASSWORD', 'CUA_PROVIDER', 'CUA_MODEL', 'CUA_API_KEY']) if (!process.env[name]) throw new Error(`${name} is required in the process environment`);
if (process.env.CUA_PROVIDER !== plan.provider_stratum.provider || process.env.CUA_MODEL !== plan.provider_stratum.model) throw new Error(`provider stratum must be ${plan.provider_stratum.provider}/${plan.provider_stratum.model}`);
const profile = process.env.PSS_AGENT_PROFILE ?? plan.provider_stratum.profile;
const concurrency = Math.min(Math.max(Number.parseInt(process.env.PSS_AGENT_BATCH_CONCURRENCY ?? String(plan.guardrails.max_concurrency_per_arm), 10), 1), plan.guardrails.max_concurrency_per_arm);
const baseURL = process.env.PRESTASHOP_BASE_URL ?? 'http://localhost:8083';
const seed = process.env.PSS_AGENT_SEED ?? `${plan.id}|${arm}`;
const runTag = process.env.PSS_AGENT_RUN_TAG ?? `prestashop-${arm}-agent-500-${Date.now()}`;
const recordsOut = path.resolve(process.env.PSS_AGENT_RECORDS_OUT ?? path.join(repositoryRoot, 'artifacts/phase2/run-records', `${runTag}.jsonl`));
const summaryOut = path.resolve(process.env.PSS_AGENT_SUMMARY_OUT ?? path.join(repositoryRoot, 'artifacts/phase2', `${runTag}-summary.json`));
fs.mkdirSync(path.dirname(recordsOut), { recursive: true });
fs.mkdirSync(path.dirname(summaryOut), { recursive: true });

async function healthGate(label) {
  const response = await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok && response.status >= 500) throw new Error(`${label}: PrestaShop returned HTTP ${response.status}`);
  return { label, ok: true, status: response.status };
}

async function databaseSnapshot() {
  const container = process.env.PSS_PRESTASHOP_DB_CONTAINER ?? 'prestashop-db-1';
  const sql = 'SELECT COUNT(*) AS products FROM ps_product; SELECT COUNT(*) AS product_names FROM ps_product_lang;';
  try {
    const { stdout } = await execFileAsync('docker', ['exec', container, 'mysql', '-N', '-u', 'root', '-proot', 'prestashop', '-e', sql], { maxBuffer: 1024 * 1024 });
    const values = stdout.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    return { products: values[0] ?? null, product_names: values[1] ?? null };
  } catch (error) {
    return { error: { name: error.name, message: error.message.slice(0, 240) } };
  }
}

const counts = { ...plan.complexity_distribution };
const scale = total / plan.target_executions_per_arm;
const targetCounts = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Math.floor(value * scale)]));
let assigned = Object.values(targetCounts).reduce((sum, value) => sum + value, 0);
for (const key of ['simple', 'medium', 'complex']) if (assigned < total) { targetCounts[key] += 1; assigned += 1; }
const jobs = [];
for (const [complexity, count] of Object.entries(targetCounts)) for (let index = 0; index < count; index += 1) jobs.push({ complexity, index });
jobs.sort((left, right) => crypto.createHash('sha256').update(`${seed}|${left.complexity}|${left.index}`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${seed}|${right.complexity}|${right.index}`).digest('hex')));

const healthBefore = await healthGate('before');
const dbBefore = await databaseSnapshot();
const startedAt = Date.now();
const results = [];
let cursor = 0;
function runJob(job, ordinal) {
  return new Promise((resolve) => {
    const runId = `${runTag}-${String(ordinal).padStart(4, '0')}-${job.complexity}`;
    const childEnv = {
      ...process.env,
      PSS_ARM: arm,
      PSS_AGENT_COMPLEXITY: job.complexity,
      PSS_AGENT_PROFILE: profile,
      PSS_RUN_ID: runId,
      PSS_RUN_RECORD_OUT: recordsOut,
      CUA_ALIYUN_ACTION_MODE: arm === 'visual' ? (process.env.CUA_ALIYUN_ACTION_MODE ?? plan.provider_stratum.visual_action_mode) : process.env.CUA_ALIYUN_ACTION_MODE,
      CUA_HYBRID_ACTION_MODE: arm === 'hybrid' ? (process.env.CUA_HYBRID_ACTION_MODE ?? plan.provider_stratum.hybrid_action_mode) : process.env.CUA_HYBRID_ACTION_MODE
    };
    const child = spawn('node', ['scripts/run-prestashop-agent-cell.mjs'], { cwd: codeRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ ordinal, run_id: runId, complexity: job.complexity, exit_code: 127, status: null, error: { name: error.name, message: error.message } }));
    child.on('close', (code) => {
      const line = stdout.trim().split(/\r?\n/).reverse().find((value) => value.startsWith('{'));
      let parsed = null;
      try { parsed = line ? JSON.parse(line) : null; } catch {}
      resolve({ ordinal, run_id: runId, complexity: job.complexity, exit_code: code, status: parsed?.run_record?.status ?? null, cell_passed: parsed?.cell_passed ?? null, task_state_reached: parsed?.task_state_reached ?? null, oracle_passed: parsed?.independent_oracle?.passed ?? null, failure_category: parsed?.run_record?.failure_category ?? null, failure: parsed?.failure ?? (stderr ? { message: stderr.slice(-500) } : null) });
    });
  });
}

async function worker() {
  while (true) {
    const ordinal = cursor++;
    if (ordinal >= jobs.length) return;
    const result = await runJob(jobs[ordinal], ordinal + 1);
    results.push(result);
    if (results.length % 25 === 0) console.error(`[${arm}-agent-500] completed ${results.length}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
results.sort((left, right) => left.ordinal - right.ordinal);
const healthAfter = await healthGate('after').catch((error) => ({ ok: false, error: { name: error.name, message: error.message } }));
const dbAfter = await databaseSnapshot();
const byComplexity = Object.fromEntries(['simple', 'medium', 'complex'].map((complexity) => {
  const rows = results.filter((row) => row.complexity === complexity);
  return [complexity, { planned: rows.length, completed: rows.filter((row) => row.status === 'completed').length, failures: rows.filter((row) => row.status !== 'completed').length, task_state_reached: rows.filter((row) => row.task_state_reached === true).length, oracle_passed: rows.filter((row) => row.oracle_passed === true).length, failure_categories: Object.fromEntries([...new Set(rows.map((row) => row.failure_category).filter(Boolean))].map((category) => [category, rows.filter((row) => row.failure_category === category).length])) }];
}));
const summary = { schema_version: '0.1', campaign_id: plan.id, run_tag: runTag, arm, provider: process.env.CUA_PROVIDER, model: process.env.CUA_MODEL, profile, status: results.length === jobs.length && healthAfter.ok ? 'completed-diagnostic-batch' : 'incomplete', application: plan.application, total_planned: jobs.length, total_observed: results.length, subset_recovery_probe: allowSubset, concurrency, seed, health_before: healthBefore, health_after: healthAfter, database_before: dbBefore, database_after: dbAfter, records_out: recordsOut, by_complexity: byComplexity, wall_time_ms: Date.now() - startedAt, evidence_boundary: 'CUA/Hybrid exploratory diagnostic; same distribution as traditional arm, but no three-arm matched or confirmatory claim', results };
fs.writeFileSync(summaryOut, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ status: summary.status, arm, provider: summary.provider, model: summary.model, profile, total_planned: summary.total_planned, total_observed: summary.total_observed, concurrency, by_complexity: summary.by_complexity, records_out: recordsOut, summary_out: summaryOut, wall_time_ms: summary.wall_time_ms }));
if (summary.status !== 'completed-diagnostic-batch') process.exitCode = 1;
