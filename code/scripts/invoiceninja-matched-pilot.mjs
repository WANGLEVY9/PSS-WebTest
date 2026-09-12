import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

// Matched diagnostic pilot controller. One SUT reset precedes each matched
// block; every arm then starts from the same seeded application state. Raw
// JSONL stays under code/artifacts (ignored by the public repository).
const codeDir = process.cwd();
const repoDir = path.resolve(codeDir, '..');
const repetitions = Number.parseInt(process.env.PSS_PILOT_REPS ?? '1', 10);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3) {
  throw new Error('PSS_PILOT_REPS must be an integer in [1,3]');
}
const repetitionOffset = Number.parseInt(process.env.PSS_PILOT_REP_OFFSET ?? '0', 10);
if (!Number.isInteger(repetitionOffset) || repetitionOffset < 0 || repetitionOffset > 20) {
  throw new Error('PSS_PILOT_REP_OFFSET must be an integer in [0,20]');
}
const campaignTag = (process.env.PSS_PILOT_TAG ?? 'round').replace(/[^a-z0-9_-]+/gi, '-');

const conditions = ['clean-stable', 'functional-fault', 'ui-evolution'];
const qwenEnv = path.join(codeDir, '.env');
const deepseekEnv = path.join(codeDir, '.env.deepseek');
const arms = [
  { id: 'playwright', npmScript: 'pilot:invoiceninja:playwright', envFile: null },
  { id: 'visual-qwen', npmScript: 'pilot:invoiceninja:visual', envFile: qwenEnv },
  { id: 'hybrid-qwen', npmScript: 'pilot:invoiceninja:hybrid', envFile: qwenEnv },
  { id: 'visual-deepseek', npmScript: 'pilot:invoiceninja:visual', envFile: deepseekEnv },
  { id: 'hybrid-deepseek', npmScript: 'pilot:invoiceninja:hybrid', envFile: deepseekEnv }
];

const now = new Date().toISOString();
const stamp = now.slice(0, 10);
const rawDir = path.join(codeDir, 'artifacts', 'phase2');
fs.mkdirSync(rawDir, { recursive: true, mode: 0o700 });

function parseEnvFile(file) {
  return file ? dotenv.parse(fs.readFileSync(file, 'utf8')) : {};
}

function blockOrder(blockIndex) {
  // Deterministic shuffle, recorded in the report, so arm order is not a
  // hidden source of variation while reruns remain reproducible.
  const values = arms.map((_, index) => index);
  let state = 0x9e3779b9 ^ (blockIndex * 0x45d9f3b);
  for (let i = values.length - 1; i > 0; i -= 1) {
    state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
    state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
    state ^= state >>> 16;
    const j = Math.abs(state) % (i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values.map((index) => arms[index]);
}

function runCommand(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: codeDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (exitCode, signal) => resolve({ exitCode, signal, stdout, stderr }));
  });
}

function parseRunRecord(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].startsWith('{')) continue;
    try {
      const parsed = JSON.parse(lines[index]);
      // Agent runners print a nested run_record; the Playwright runner prints
      // the same bounded fields at top level. Both forms are valid evidence.
      if (parsed.run_record || parsed.application === 'invoiceninja' || (parsed.status && parsed.arm)) return parsed;
    } catch {
      // A bounded parser failure is retained in the summary, never promoted
      // to a synthetic run record.
    }
  }
  return null;
}

async function resetSut() {
  const result = await runCommand('npm', ['run', 'sut:invoiceninja:reset'], process.env);
  if (result.exitCode !== 0) {
    throw new Error(`Invoice Ninja reset failed: ${result.stderr.slice(-500)}`);
  }
}

function armEnv(arm, condition, runId, outputPath) {
  const conditionVars = condition === 'clean-stable'
    ? { PSS_EXPECTED_VERDICT: 'clean' }
    : condition === 'functional-fault'
      ? { PSS_EXPECTED_VERDICT: 'fault', PSS_UI_MUTATION: 'invoiceninja-visible-number-mismatch' }
      : { PSS_EXPECTED_VERDICT: 'clean', PSS_UI_MUTATION: 'invoiceninja-layout-v1' };
  return {
    ...process.env,
    ...(arm.envFile ? parseEnvFile(arm.envFile) : {}),
    PSS_PILOT_CONDITION: condition,
    PSS_RUN_ID: runId,
    PSS_RUN_RECORD_OUT: outputPath,
    ...conditionVars
  };
}

const outcomes = [];
let blockIndex = 0;
for (const condition of conditions) {
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    blockIndex += 1;
    const order = blockOrder(blockIndex);
    await resetSut();
    const repetitionLabel = repetitionOffset + repetition;
    const block = { condition, repetition: repetitionLabel, block_index: blockIndex, arm_order: order.map((arm) => arm.id), runs: [] };
    for (const arm of order) {
      const outputPath = path.join(rawDir, `invoiceninja-matched-${arm.id}.jsonl`);
      const runId = `invoiceninja-matched-${condition}-${arm.id}-r${repetitionLabel}`;
      const result = await runCommand('npm', ['run', arm.npmScript], armEnv(arm, condition, runId, outputPath));
      const parsed = parseRunRecord(result.stdout);
      const record = parsed?.run_record ?? parsed ?? null;
      const runSummary = {
        arm: arm.id,
        run_id: record?.run_id ?? runId,
        exit_code: result.exitCode,
        status: record?.status ?? 'no-record',
        checkpoint_reached: record?.checkpoint_reached ?? false,
        independent_oracle_passed: record?.independent_oracle_passed ?? parsed?.independent_oracle?.passed ?? false,
        emitted_verdict: record?.emitted_verdict ?? 'not-emitted',
        failure_category: record?.failure_category ?? null,
        provider_id: record?.provenance?.provider_id ?? null,
        model_id: record?.provenance?.model_id ?? null,
        wall_time_ms: record?.timing?.wall_time_ms ?? parsed?.wall_time_ms ?? null
      };
      if (!parsed && result.stderr) runSummary.error_tail = result.stderr.slice(-240);
      block.runs.push(runSummary);
      outcomes.push({ condition, repetition: repetitionLabel, ...runSummary });
    }
    console.log(JSON.stringify({ block_complete: true, ...block }));
  }
}

const strictPass = (row) => row.status === 'completed' && row.checkpoint_reached === true && row.independent_oracle_passed === true;
const lines = [
  `# Invoice Ninja matched pilot round — ${stamp}`,
  '',
  'Evidence boundary: diagnostic pilot only; no application admission, repetition freeze, power decision, or confirmatory claim.',
  '',
  `Design: repetition labels ${repetitionOffset + 1}–${repetitionOffset + repetitions} × ${conditions.length} conditions × ${arms.length} arm/model strata; each block was independently reset before the deterministic randomized arm order.`,
  '',
  '| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | First boundaries |',
  '|---|---|---:|---:|---:|---:|---|'
];
for (const condition of conditions) {
  for (const arm of arms) {
    const rows = outcomes.filter((row) => row.condition === condition && row.arm === arm.id);
    const boundaries = [...new Set(rows.map((row) => row.failure_category).filter(Boolean))];
    lines.push(`| ${condition} | ${arm.id} | ${rows.length} | ${rows.filter(strictPass).length}/${rows.length} | ${rows.filter((row) => row.checkpoint_reached).length}/${rows.length} | ${rows.filter((row) => row.independent_oracle_passed).length}/${rows.length} | ${boundaries.length ? boundaries.map((value) => `\`${value}\``).join(', ') : 'none'} |`);
  }
}
lines.push('', '## Run-level audit notes', '', '- A missing or malformed run record remains `no-record` and is not converted into a success.', '- Provider/model strata are reported separately; no model pooling is performed.', '- Raw screenshots, provider summaries, and JSONL records remain local under ignored `code/artifacts/phase2/`.', '');
const reportPath = path.join(repoDir, 'results', 'phase2', `${stamp}-invoiceninja-matched-pilot-${campaignTag}.md`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ pilot: 'invoiceninja-matched', report: reportPath, records: outcomes.length, strict_passes: outcomes.filter(strictPass).length }));
