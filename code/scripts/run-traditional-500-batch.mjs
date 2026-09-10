import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
const planPath = path.join(codeRoot, 'config/traditional-500-playwright.v0.1.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const total = Number.parseInt(process.env.PSS_TRADITIONAL_TOTAL ?? String(plan.target_executions), 10);
const allowSubset = process.env.PSS_TRADITIONAL_ALLOW_SUBSET === '1';
if (!Number.isInteger(total) || total < 1 || (!allowSubset && total < 500)) throw new Error('PSS_TRADITIONAL_TOTAL must be at least 500 unless PSS_TRADITIONAL_ALLOW_SUBSET=1 is explicitly set for a recovery probe');
if (!process.env.PSS_PRESTASHOP_USERNAME || !process.env.PSS_PRESTASHOP_PASSWORD) throw new Error('PSS_PRESTASHOP_USERNAME and PSS_PRESTASHOP_PASSWORD are required in the process environment');
const concurrency = Math.min(Math.max(Number.parseInt(process.env.PSS_TRADITIONAL_CONCURRENCY ?? String(plan.guardrails.max_concurrency), 10), 1), plan.guardrails.max_concurrency);
const seed = process.env.PSS_TRADITIONAL_SEED ?? plan.id;
const runTag = process.env.PSS_TRADITIONAL_RUN_TAG ?? `traditional-500-${Date.now()}`;
const recordsOut = path.resolve(process.env.PSS_TRADITIONAL_RECORDS_OUT ?? path.join(repositoryRoot, 'artifacts/phase2/run-records', `${runTag}.jsonl`));
const summaryOut = path.resolve(process.env.PSS_TRADITIONAL_SUMMARY_OUT ?? path.join(repositoryRoot, 'artifacts/phase2', `${runTag}-summary.json`));
fs.mkdirSync(path.dirname(recordsOut), { recursive: true });
fs.mkdirSync(path.dirname(summaryOut), { recursive: true });

const counts = { ...plan.complexity_distribution };
const scale = total / plan.target_executions;
const targetCounts = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Math.floor(value * scale)]));
let assigned = Object.values(targetCounts).reduce((sum, value) => sum + value, 0);
for (const key of ['simple', 'medium', 'complex']) if (assigned < total) { targetCounts[key] += 1; assigned += 1; }
const jobs = [];
for (const [complexity, count] of Object.entries(targetCounts)) for (let index = 0; index < count; index += 1) jobs.push({ complexity, index });
jobs.sort((left, right) => crypto.createHash('sha256').update(`${seed}|${left.complexity}|${left.index}`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${seed}|${right.complexity}|${right.index}`).digest('hex')));

const startedAt = Date.now();
const results = [];
let cursor = 0;
function runJob(job, ordinal) {
  return new Promise((resolve) => {
    const runId = `${runTag}-${String(ordinal).padStart(4, '0')}-${job.complexity}`;
    const child = spawn('node', ['scripts/run-prestashop-traditional-task.mjs'], {
      cwd: codeRoot,
      env: { ...process.env, PSS_TRADITIONAL_COMPLEXITY: job.complexity, PSS_RUN_ID: runId, PSS_RUN_RECORD_OUT: recordsOut },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ ordinal, run_id: runId, complexity: job.complexity, exit_code: 127, error: { name: error.name, message: error.message } }));
    child.on('close', (code) => {
      const line = stdout.trim().split(/\r?\n/).reverse().find((value) => value.startsWith('{'));
      let parsed = null;
      try { parsed = line ? JSON.parse(line) : null; } catch {}
      resolve({ ordinal, run_id: runId, complexity: job.complexity, exit_code: code, status: parsed?.status ?? null, independent_oracle_passed: parsed?.independent_oracle?.passed ?? null, failure: parsed?.failure ?? (stderr ? { message: stderr.slice(-500) } : null) });
    });
  });
}

async function worker() {
  while (true) {
    const ordinal = cursor++;
    if (ordinal >= jobs.length) return;
    const result = await runJob(jobs[ordinal], ordinal + 1);
    results.push(result);
    if (results.length % 25 === 0) console.error(`[traditional-500] completed ${results.length}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
results.sort((left, right) => left.ordinal - right.ordinal);
const byComplexity = Object.fromEntries(['simple', 'medium', 'complex'].map((complexity) => {
  const rows = results.filter((row) => row.complexity === complexity);
  return [complexity, { planned: rows.length, completed: rows.filter((row) => row.status === 'completed').length, failures: rows.filter((row) => row.status !== 'completed').length, oracle_passed: rows.filter((row) => row.independent_oracle_passed === true).length }];
}));
const summary = { schema_version: '0.1', campaign_id: plan.id, run_tag: runTag, status: results.length === jobs.length ? 'completed-diagnostic-batch' : 'incomplete', application: plan.application, total_planned: jobs.length, total_observed: results.length, subset_recovery_probe: allowSubset, concurrency, seed, records_out: recordsOut, by_complexity: byComplexity, wall_time_ms: Date.now() - startedAt, evidence_boundary: 'traditional-only exploratory diagnostic; no three-arm matched or confirmatory claim', results };
fs.writeFileSync(summaryOut, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ status: summary.status, total_planned: summary.total_planned, total_observed: summary.total_observed, concurrency, by_complexity: byComplexity, records_out: recordsOut, summary_out: summaryOut, wall_time_ms: summary.wall_time_ms }));
if (summary.status !== 'completed-diagnostic-batch') process.exitCode = 1;
