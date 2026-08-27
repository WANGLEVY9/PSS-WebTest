import fs from 'node:fs';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { appendRunRecord, createTraditionalRunRecord } from '../src/traditional-run-record.mjs';

dotenv.config();

const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '1', 10);
const maxSteps = process.env.CUA_MAX_STEPS ?? '14';
const timeoutMs = process.env.CUA_TIMEOUT_MS ?? '20000';
const wallTimeoutMs = process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0';
const provider = process.env.CUA_PROVIDER ?? null;
const model = process.env.CUA_MODEL ?? null;
const pilotRunTag = process.env.PSS_PILOT_RUN_TAG ?? null;
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const slug = (value) => String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '');
const runSlug = [provider && model ? `${provider}-${model}` : 'unconfigured', pilotRunTag && slug(pilotRunTag)].filter(Boolean).join('-');
const artifact = `${root}/../artifacts/phase2/indico-three-arm-${runSlug}-pilot.json`;
const recordsPath = `${root}/../artifacts/phase2/indico-three-arm-${runSlug}-records.jsonl`;

const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
});
const lastJson = (stdout) => stdout.trim().split('\n').reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find(Boolean) ?? null;
const records = [];
const writeSummary = () => {
  fs.mkdirSync(`${root}/../artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({ application: 'indico', task_id: 'indico-create-event', condition: 'clean-stable', provider, model, pilot_run_tag: pilotRunTag, repetitions, arms: ['playwright', 'visual', 'hybrid'], max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), agent_wall_timeout_ms: Number(wallTimeoutMs), records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false }, null, 2)}\n`, { mode: 0o600 });
};

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  for (const arm of ['playwright', 'visual', 'hybrid']) {
    const reset = await run('node', ['scripts/indico-lifecycle.mjs', 'reset']);
    const preOracleRun = reset.code === 0 ? await run('node', ['scripts/evaluate-indico-event.mjs']) : { code: 1, stdout: '' };
    const preOracle = lastJson(preOracleRun.stdout);
    const cleanStateVerified = reset.code === 0 && preOracleRun.code === 1 && preOracle?.matches === 0 && preOracle?.passed === false;
    let execution; let oracle; let result = null; let cellRunRecord = null;
    if (!cleanStateVerified) {
      records.push({ repetition, arm, reset_ok: reset.code === 0, clean_state_verified: false, execution_exit_code: null, oracle_passed: false, oracle_matches: preOracle?.matches ?? null });
      writeSummary(); console.log(JSON.stringify(records.at(-1))); continue;
    }
    if (arm === 'playwright') {
      const startedAt = Date.now();
      execution = await run('npx', ['playwright', 'test', 'tests/traditional/indico-create-event.spec.js', '--project=chromium'], {
        RUN_INDICO_VERTICAL_SLICE: '1', INDICO_BASE_URL: 'http://localhost:8080', SUT_BASE_URL: 'http://localhost:8080',
        PSS_INDICO_USERNAME: process.env.PSS_INDICO_USERNAME, PSS_INDICO_PASSWORD: process.env.PSS_INDICO_PASSWORD
      });
      const oracleRun = await run('node', ['scripts/evaluate-indico-event.mjs']); oracle = lastJson(oracleRun.stdout);
      cellRunRecord = createTraditionalRunRecord({ application_id: 'indico', application_version: process.env.INDICO_VERSION ?? '3.3.6', task_id: 'indico-create-event', execution_exit_code: execution.code, oracle, wall_time_ms: Date.now() - startedAt, actions: 10, runner_version: 'indico-playwright-cell-v0.2', trace: [{ kind: 'scripted-sequence', action_count: 10 }] });
      appendRunRecord(cellRunRecord, recordsPath);
    } else {
      execution = await run('node', ['scripts/run-indico-agent-pilot.mjs'], {
        INDICO_ARM: arm, CUA_MAX_STEPS: maxSteps, CUA_TIMEOUT_MS: timeoutMs,
        PSS_INDICO_USERNAME: process.env.PSS_INDICO_USERNAME, PSS_INDICO_PASSWORD: process.env.PSS_INDICO_PASSWORD,
        PSS_RUN_RECORD_OUT: recordsPath
      });
      result = lastJson(execution.stdout); oracle = result?.oracle?.value ?? null; cellRunRecord = result?.run_record ?? null;
    }
    const agentCompleted = arm === 'playwright' ? execution.code === 0 : result?.protocol_completed === true;
    const oraclePassed = oracle?.passed === true;
    records.push({ repetition, arm, provider, model, reset_ok: reset.code === 0, clean_state_verified: true, execution_exit_code: execution.code, agent_status: result?.result?.status ?? result?.run_record?.status ?? null, emitted_verdict: result?.result?.emitted_verdict ?? result?.run_record?.emitted_verdict ?? (arm === 'playwright' && agentCompleted ? 'clean' : null), agent_completed: agentCompleted, task_state_reached: oraclePassed, oracle_passed: oraclePassed, oracle_only_success: result?.oracle_only_success === true, cell_passed: agentCompleted && oraclePassed, oracle_matches: oracle?.matches ?? null, run_id: cellRunRecord?.run_id ?? null, timing: cellRunRecord?.timing ?? null, failure_category: cellRunRecord?.failure_category ?? null });
    writeSummary(); console.log(JSON.stringify(records.at(-1)));
  }
}
const passed = records.filter((r) => r.reset_ok && r.clean_state_verified && r.oracle_passed).length;
writeSummary();
console.log(JSON.stringify({ artifact, passed_cells: passed, total_cells: records.length }));
