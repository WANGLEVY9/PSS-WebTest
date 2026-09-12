import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const codeDir = process.cwd(); const repoDir = path.resolve(codeDir, '..');
const repetitions = Number.parseInt(process.env.PSS_PILOT_REPS ?? '1', 10);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3) throw new Error('PSS_PILOT_REPS must be in [1,3]');
const offset = Number.parseInt(process.env.PSS_PILOT_REP_OFFSET ?? '0', 10);
const tag = (process.env.PSS_PILOT_TAG ?? 'round').replace(/[^a-z0-9_-]+/gi, '-');
const conditions = ['clean-stable', 'functional-fault', 'ui-evolution'];
const arms = [
  { id: 'playwright', script: 'pilot:invoiceninja:payments:playwright', envFile: null },
  { id: 'visual-qwen', script: 'pilot:invoiceninja:payments:visual', envFile: path.join(codeDir, '.env') },
  { id: 'hybrid-qwen', script: 'pilot:invoiceninja:payments:hybrid', envFile: path.join(codeDir, '.env') },
  { id: 'visual-deepseek', script: 'pilot:invoiceninja:payments:visual', envFile: path.join(codeDir, '.env.deepseek') },
  { id: 'hybrid-deepseek', script: 'pilot:invoiceninja:payments:hybrid', envFile: path.join(codeDir, '.env.deepseek') },
  { id: 'hybrid-doubao', script: 'pilot:invoiceninja:payments:hybrid', envFile: path.join(codeDir, '.env.volcengine-cua') }
];
const rawDir = path.join(codeDir, 'artifacts', 'phase2'); fs.mkdirSync(rawDir, { recursive: true, mode: 0o700 });
function envFile(file) { return file && fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file, 'utf8')) : {}; }
function order(block) { const values = arms.map((_, i) => i); let s = (0x9e3779b9 ^ block) >>> 0; for (let i = values.length - 1; i > 0; i -= 1) { s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0; const j = s % (i + 1); [values[i], values[j]] = [values[j], values[i]]; } return values.map((i) => arms[i]); }
function run(args, env) { return new Promise((resolve) => { const child = spawn('npm', args, { cwd: codeDir, env, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = ''; let stderr = ''; child.stdout.on('data', (x) => { stdout += x; }); child.stderr.on('data', (x) => { stderr += x; }); child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function parse(output) { for (const line of output.split(/\r?\n/).map((x) => x.trim()).reverse()) { if (!line.startsWith('{')) continue; try { const value = JSON.parse(line); if (value.run_record || value.task_id === 'invoiceninja-recent-payments') return value.run_record ?? value; } catch {} } return null; }
function armEnvironment(arm, condition, runId, out) {
  const vars = condition === 'clean-stable' ? { PSS_EXPECTED_VERDICT: 'clean' } : condition === 'functional-fault' ? { PSS_EXPECTED_VERDICT: 'fault', PSS_UI_MUTATION: 'invoiceninja-visible-payment-omission' } : { PSS_EXPECTED_VERDICT: 'clean', PSS_UI_MUTATION: 'invoiceninja-layout-v1' };
  return { ...process.env, ...envFile(arm.envFile), PSS_PILOT_CONDITION: condition, PSS_RUN_ID: runId, PSS_RUN_RECORD_OUT: out, ...vars };
}
const outcomes = []; let block = 0;
for (const condition of conditions) for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  block += 1; const reset = await run(['run', 'sut:invoiceninja:reset'], process.env); if (reset.exitCode !== 0) throw new Error(`Invoice Ninja reset failed before ${condition}/r${offset + repetition}: ${reset.stderr.slice(-400)}`);
  const label = offset + repetition; const blockRows = [];
  for (const arm of order(block)) {
    const out = path.join(rawDir, 'invoiceninja-payments-matched-runs.jsonl'); const runId = `invoiceninja-payments-matched-${condition}-${arm.id}-r${label}`;
    const result = await run(['run', arm.script], armEnvironment(arm, condition, runId, out)); const record = parse(result.stdout);
    const row = { condition, repetition: label, arm: arm.id, run_id: record?.run_id ?? runId, exit_code: result.exitCode, status: record?.status ?? 'no-record', checkpoint_reached: record?.checkpoint_reached ?? false, independent_oracle_passed: record?.independent_oracle_passed ?? false, emitted_verdict: record?.emitted_verdict ?? 'not-emitted', failure_category: record?.failure_category ?? null, provider_id: record?.provenance?.provider_id ?? null, model_id: record?.provenance?.model_id ?? null, wall_time_ms: record?.timing?.wall_time_ms ?? null };
    if (!record && result.stderr) row.error_tail = result.stderr.slice(-300); blockRows.push(row); outcomes.push(row);
  }
  console.log(JSON.stringify({ block_complete: true, condition, repetition: label, arm_order: blockRows.map((x) => x.arm), runs: blockRows }));
}
const strict = (x) => x.status === 'completed' && x.checkpoint_reached === true && x.independent_oracle_passed === true;
const lines = [`# Invoice Ninja recent-payments matched pilot — ${new Date().toISOString().slice(0, 10)}`, '', 'Evidence boundary: T1 diagnostic pilot only; no admission, repetition freeze, power, or confirmatory claim.', '', `Design: ${repetitions} repetition(s) × 3 conditions × ${arms.length} arm/model strata; each block reset the SUT before a deterministic pseudo-random arm order.`, '', '| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | Failure boundaries |', '|---|---|---:|---:|---:|---:|---|'];
for (const condition of conditions) for (const arm of arms) { const rows = outcomes.filter((x) => x.condition === condition && x.arm === arm.id); const boundaries = [...new Set(rows.map((x) => x.failure_category).filter(Boolean))]; lines.push(`| ${condition} | ${arm.id} | ${rows.length} | ${rows.filter(strict).length}/${rows.length} | ${rows.filter((x) => x.checkpoint_reached).length}/${rows.length} | ${rows.filter((x) => x.independent_oracle_passed).length}/${rows.length} | ${boundaries.length ? boundaries.map((x) => `\`${x}\``).join(', ') : 'none'} |`); }
lines.push('', 'Raw screenshots/replays and JSONL stay under ignored code/artifacts/phase2. Missing records remain failures and are never imputed.', '');
const report = path.join(repoDir, 'results', 'phase2', `${new Date().toISOString().slice(0, 10)}-invoiceninja-payments-matched-pilot-${tag}.md`); fs.mkdirSync(path.dirname(report), { recursive: true }); fs.writeFileSync(report, `${lines.join('\n')}\n`); console.log(JSON.stringify({ pilot: 'invoiceninja-recent-payments', report, records: outcomes.length, strict_passes: outcomes.filter(strict).length }));
