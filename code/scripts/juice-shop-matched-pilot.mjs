import fs from 'node:fs';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { appendRunRecord, createTraditionalRunRecord } from '../src/traditional-run-record.mjs';

dotenv.config();

const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '1', 10);
const maxSteps = process.env.CUA_MAX_STEPS ?? '16';
const timeoutMs = process.env.CUA_TIMEOUT_MS ?? '20000';
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const artifact = `${root}/../artifacts/phase2/juice-shop-three-arm-pilot.json`;
const recordsPath = `${root}/../artifacts/phase2/juice-shop-three-arm-records.jsonl`;
const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';

const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
});
const lastJson = (stdout) => stdout.trim().split('\n').reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find(Boolean) ?? null;
const records = [];
const writeSummary = () => {
  fs.mkdirSync(`${root}/../artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({ application: 'juice-shop', task_id: 'juice-shop-product-search', repetitions, arms: ['playwright', 'visual', 'hybrid'], max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), records, passed_cells: records.filter((r) => r.reset_ok && r.clean_state_verified && r.oracle_passed).length, total_cells: records.length, confirmatory: false }, null, 2)}\n`, { mode: 0o600 });
};

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  for (const arm of ['playwright', 'visual', 'hybrid']) {
    const reset = await run('node', ['scripts/juice-shop-lifecycle.mjs', 'reset']);
    const clean = reset.code === 0 ? await run('node', ['scripts/verify-juice-shop-clean.mjs']) : { code: 1, stdout: '' };
    const cleanResult = lastJson(clean.stdout);
    const cleanStateVerified = reset.code === 0 && clean.code === 0 && cleanResult?.clean_state_verified === true;
    let execution; let oracle;
    if (!cleanStateVerified) {
      records.push({ repetition, arm, reset_ok: reset.code === 0, clean_state_verified: false, execution_exit_code: null, oracle_passed: false });
      writeSummary(); console.log(JSON.stringify(records.at(-1))); continue;
    }
    if (arm === 'playwright') {
      const startedAt = Date.now();
      execution = await run('npx', ['playwright', 'test', 'tests/traditional/juice-shop-product-search.spec.js', '--project=chromium'], {
        RUN_JUICE_SHOP_VERTICAL_SLICE: '1', SUT_BASE_URL: baseURL
      });
      const oracleRun = await run('node', ['scripts/evaluate-juice-shop-search.mjs']); oracle = lastJson(oracleRun.stdout);
      appendRunRecord(createTraditionalRunRecord({ application_id: 'juice-shop', application_version: process.env.JUICE_SHOP_VERSION ?? '20.0.0', task_id: 'juice-shop-product-search', execution_exit_code: execution.code, oracle, wall_time_ms: Date.now() - startedAt, actions: 5, runner_version: 'juice-shop-playwright-cell-v0.2', trace: [{ kind: 'scripted-sequence', action_count: 5 }] }), recordsPath);
    } else {
      execution = await run('node', [arm === 'visual' ? 'scripts/run-volcengine-juice-visual-smoke.mjs' : 'scripts/run-volcengine-juice-hybrid-smoke.mjs'], {
        CUA_MAX_STEPS: maxSteps, CUA_TIMEOUT_MS: timeoutMs, CUA_PREPARE_SEARCH: '0', CUA_TASK_MODE: 'full-search',
        JUICE_SHOP_BASE_URL: baseURL, PSS_RUN_RECORD_OUT: recordsPath
      });
      const result = lastJson(execution.stdout); oracle = result?.ui_oracle ?? null;
    }
    records.push({ repetition, arm, reset_ok: reset.code === 0, clean_state_verified: true, execution_exit_code: execution.code, oracle_passed: oracle?.passed === true, oracle_matches: oracle?.passed === true ? 1 : 0 });
    writeSummary(); console.log(JSON.stringify(records.at(-1)));
  }
}
const passed = records.filter((r) => r.reset_ok && r.clean_state_verified && r.oracle_passed).length;
writeSummary();
console.log(JSON.stringify({ artifact, passed_cells: passed, total_cells: records.length }));
