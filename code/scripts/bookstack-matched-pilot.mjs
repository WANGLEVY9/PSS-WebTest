import fs from 'node:fs';
import { spawn } from 'node:child_process';
import process from 'node:process';

const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '3', 10);
const maxSteps = process.env.CUA_MAX_STEPS ?? '3';
const timeoutMs = process.env.CUA_TIMEOUT_MS ?? '8000';
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const artifact = `${root}/../artifacts/phase2/bookstack-three-arm-pilot.json`;
const recordsPath = `${root}/../artifacts/phase2/bookstack-three-arm-records.jsonl`;

const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
});
const lastJson = (stdout) => stdout.trim().split('\n').reverse().map((x) => { try { return JSON.parse(x); } catch { return null; } }).find(Boolean) ?? null;
const records = [];
for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  for (const arm of ['playwright', 'visual', 'hybrid']) {
    const reset = await run('node', ['scripts/bookstack-lifecycle.mjs', 'reset']);
    let execution;
    let oracle;
    if (arm === 'playwright') {
      execution = await run('npx', ['playwright', 'test', 'tests/traditional/bookstack-create-page.spec.js', '--project=chromium'], {
        SUT_BASE_URL: 'http://127.0.0.1:8081', RUN_BOOKSTACK_VERTICAL_SLICE: '1',
        PSS_BOOKSTACK_USERNAME: process.env.PSS_BOOKSTACK_USERNAME, PSS_BOOKSTACK_PASSWORD: process.env.PSS_BOOKSTACK_PASSWORD
      });
      const oracleRun = await run('node', ['scripts/evaluate-bookstack-page.mjs']); oracle = lastJson(oracleRun.stdout);
    } else {
      execution = await run('node', ['scripts/run-bookstack-agent-pilot.mjs'], {
        BOOKSTACK_ARM: arm, CUA_MAX_STEPS: maxSteps, CUA_TIMEOUT_MS: timeoutMs,
        PSS_BOOKSTACK_USERNAME: process.env.PSS_BOOKSTACK_USERNAME, PSS_BOOKSTACK_PASSWORD: process.env.PSS_BOOKSTACK_PASSWORD,
        PSS_RUN_RECORD_OUT: recordsPath
      });
      const result = lastJson(execution.stdout); oracle = result?.oracle?.value ?? null;
    }
    records.push({ repetition, arm, reset_ok: reset.code === 0, execution_exit_code: execution.code, oracle_passed: oracle?.passed === true, oracle_matches: oracle?.matches ?? null });
    console.log(JSON.stringify(records.at(-1)));
  }
}
const summary = { application: 'bookstack', task_id: 'bookstack-create-page', repetitions, arms: ['playwright', 'visual', 'hybrid'], max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), records, passed_cells: records.filter((r) => r.reset_ok && r.oracle_passed).length, total_cells: records.length, confirmatory: false };
fs.mkdirSync(`${root}/../artifacts/phase2`, { recursive: true });
fs.writeFileSync(artifact, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ artifact, passed_cells: summary.passed_cells, total_cells: summary.total_cells }));
