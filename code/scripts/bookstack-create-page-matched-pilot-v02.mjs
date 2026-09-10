import 'dotenv/config';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { BOOKSTACK_CREATE_PAGE_ARMS, createBookStackCreatePagePilotPlan } from '../src/bookstack-create-page-pilot-plan.mjs';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const repositoryRoot = `${root}/..`;
const taskId = 'bookstack-create-page';
const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '1', 10);
const optimizationByArm = Object.fromEntries(['visual', 'hybrid'].map((arm) => [arm, resolveAgentOptimization({ env: { ...process.env, PSS_AGENT_PROFILE: process.env.PSS_AGENT_PROFILE ?? 'baseline-v0' }, arm, taskFamily: 'form-persistence' })]));
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? String(Math.max(optimizationByArm.visual.max_steps, optimizationByArm.hybrid.max_steps)), 10);
const timeoutMs = Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(Math.max(optimizationByArm.visual.timeout_ms, optimizationByArm.hybrid.timeout_ms)), 10);
const maxResetAttempts = Number.parseInt(process.env.PSS_RESET_MAX_ATTEMPTS ?? '2', 10);
const protocolVersion = process.env.PSS_PROTOCOL_VERSION ?? '2.0-draft';
const randomizationSeed = process.env.PSS_RANDOMIZATION_SEED ?? 'bookstack-create-page-phase2-v1';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const runTag = process.env.PSS_PILOT_RUN_TAG ?? null;
const provider = process.env.CUA_PROVIDER ?? null;
const model = process.env.CUA_MODEL ?? null;

const plan = createBookStackCreatePagePilotPlan({ condition, repetitions, randomizationSeed, runTag, provider, model });
const conditionSpec = plan.conditionSpec;
const slug = (value, fallback) => String(value ?? '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || fallback;
const conditionSlug = slug(condition, 'condition');
const modelSlug = model ? slug(`${provider ?? 'provider'}-${model}`, 'configured') : 'unconfigured';
const tagSlug = runTag ? slug(runTag, '') : null;
const runSlug = [conditionSlug, modelSlug, tagSlug].filter(Boolean).join('-');
const artifact = `${repositoryRoot}/artifacts/phase2/bookstack-create-page-${runSlug}-pilot.json`;
const recordsPath = `${repositoryRoot}/artifacts/phase2/bookstack-create-page-${runSlug}-records.jsonl`;

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

async function clearFault() {
  const result = await run('node', ['scripts/bookstack-fault.mjs', 'remove']);
  return { ok: result.code === 0, detail: lastJson(result.stdout), stderr: result.stderr.slice(-500) };
}

async function resetWithRetry() {
  const attempts = [];
  for (let attempt = 1; attempt <= maxResetAttempts; attempt += 1) {
    const result = await run('node', ['scripts/bookstack-lifecycle.mjs', 'reset']);
    const summary = lastJson(result.stdout);
    const ok = result.code === 0 && ['seed-verified', 'seeded'].includes(summary?.status) && typeof summary?.reset_digest === 'string';
    attempts.push({ attempt, exit_code: result.code, status: summary?.status ?? null, reset_digest: summary?.reset_digest ?? null, stderr: result.stderr.slice(-500) });
    if (ok) return { ok: true, attempts, resetDigest: summary.reset_digest };
  }
  return { ok: false, attempts, resetDigest: null };
}

const records = [];
function writeSummary() {
  fs.mkdirSync(`${repositoryRoot}/artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({
    application: 'bookstack', task_id: taskId, condition, expected_verdict: conditionSpec.expectedVerdict,
    ui_mutation: conditionSpec.uiMutation, fault: conditionSpec.applyFault ? 'persistence-mismatch' : null,
    protocol_version: protocolVersion, randomization_seed: randomizationSeed, run_tag: runTag,
    provider, model, repetitions, arms: BOOKSTACK_CREATE_PAGE_ARMS, records,
    passed_cells: records.filter((record) => record.cell_passed).length, total_cells: records.length,
    confirmatory: false
  }, null, 2)}\n`, { mode: 0o600 });
}

for (const scheduledCell of plan.cells) {
  const { repetition, arm, randomizationBlock: block, configurationId } = scheduledCell;
    const cleanupBefore = await clearFault();
    const reset = cleanupBefore.ok ? await resetWithRetry() : { ok: false, attempts: [], resetDigest: null };
    let preOracle = null;
    let faultApply = null;
    let execution = null;
    let result = null;
    try {
      if (reset.ok) {
        const pre = await run('node', ['scripts/evaluate-bookstack-page.mjs']);
        preOracle = lastJson(pre.stdout);
      }
      const resetStateVerified = reset.ok
        && preOracle?.candidate_count === 0
        && preOracle?.clean_matches === 0
        && preOracle?.fault_matches === 0
        && preOracle?.observed_verdict === 'unknown';
      if (!resetStateVerified) {
        records.push({ repetition, arm, randomization_block: block, reset_ok: false, reset_attempts: reset.attempts, reset_digest: reset.resetDigest, pre_oracle: preOracle, fault_applied: false, execution_exit_code: null, cell_passed: false, failure_category: 'environment' });
        writeSummary();
        continue;
      }
      if (conditionSpec.applyFault) {
        const applied = await run('node', ['scripts/bookstack-fault.mjs', 'apply']);
        faultApply = { ok: applied.code === 0, detail: lastJson(applied.stdout), stderr: applied.stderr.slice(-500) };
      }
      if (conditionSpec.applyFault && !faultApply?.ok) {
        records.push({ repetition, arm, randomization_block: block, reset_ok: true, reset_attempts: reset.attempts, reset_digest: reset.resetDigest, pre_oracle: preOracle, fault_applied: false, execution_exit_code: null, cell_passed: false, failure_category: 'environment' });
        writeSummary();
        continue;
      }
      const commonEnv = {
        PSS_PROTOCOL_VERSION: protocolVersion,
        PSS_RESET_DIGEST: reset.resetDigest,
        PSS_RANDOMIZATION_BLOCK: block,
        PSS_PILOT_CONDITION: condition,
        PSS_EXPECTED_VERDICT: conditionSpec.expectedVerdict,
        PSS_UI_MUTATION: conditionSpec.uiMutation ?? '',
        PSS_RUN_RECORD_OUT: recordsPath
      };
      if (arm === 'playwright') {
        execution = await run('node', ['scripts/run-bookstack-playwright-cell.mjs'], {
          ...commonEnv,
          PSS_CONFIGURATION_ID: configurationId
        });
      } else {
        execution = await run('node', ['scripts/run-bookstack-agent-pilot.mjs'], {
          ...commonEnv,
          BOOKSTACK_ARM: arm,
          PSS_BOOKSTACK_TASK_ID: taskId,
          CUA_MAX_STEPS: process.env.CUA_MAX_STEPS ?? String(optimizationByArm[arm].max_steps),
          CUA_TIMEOUT_MS: process.env.CUA_TIMEOUT_MS ?? String(optimizationByArm[arm].timeout_ms),
          CUA_MAX_DECISION_RETRIES: process.env.CUA_MAX_DECISION_RETRIES ?? String(optimizationByArm[arm].max_decision_retries),
          CUA_MAX_RETRIES: process.env.CUA_MAX_RETRIES ?? String(optimizationByArm[arm].max_retries),
          CUA_MAX_OUTPUT_TOKENS: process.env.CUA_MAX_OUTPUT_TOKENS ?? String(optimizationByArm[arm].max_output_tokens),
          CUA_COORDINATE_MODE: process.env.CUA_COORDINATE_MODE ?? optimizationByArm[arm].coordinate_mode,
          CUA_HYBRID_ACTION_MODE: process.env.CUA_HYBRID_ACTION_MODE ?? (optimizationByArm[arm].hybrid_action_mode ?? 'coordinate'),
          CUA_SCREENSHOT_QUALITY: process.env.CUA_SCREENSHOT_QUALITY ?? String(optimizationByArm[arm].screenshot_quality),
          PSS_AGENT_POST_ACTION_SETTLE_MS: process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimizationByArm[arm].post_action_settle_ms),
          PSS_CONFIGURATION_ID: configurationId
        });
      }
      result = lastJson(execution.stdout);
      const runRecord = result?.run_record ?? null;
      records.push({
        repetition, arm, randomization_block: block, reset_ok: true, reset_attempts: reset.attempts,
        reset_retry_used: reset.attempts.length > 1, reset_digest: reset.resetDigest, pre_oracle: preOracle,
        fault_applied: conditionSpec.applyFault, execution_exit_code: execution.code,
        agent_status: result?.result?.status ?? runRecord?.status ?? null,
        emitted_verdict: result?.result?.emitted_verdict ?? runRecord?.emitted_verdict ?? null,
        independent_oracle: result?.oracle?.value ?? null,
        protocol_completed: result?.protocol_completed === true,
        cell_passed: result?.cell_passed === true,
        run_id: runRecord?.run_id ?? null, timing: runRecord?.timing ?? null,
        failure_category: runRecord?.failure_category ?? (execution.code === 0 ? null : 'execution'),
        failure_message: result?.failure?.message ? String(result.failure.message).slice(0, 300) : null
      });
      writeSummary();
      console.log(JSON.stringify(records.at(-1)));
    } finally {
      const cleanupAfter = await clearFault();
      if (!cleanupAfter.ok && records.length > 0) records.at(-1).fault_cleanup_failed = true;
      writeSummary();
    }
}

writeSummary();
console.log(JSON.stringify({ artifact, task_id: taskId, condition, expected_verdict: conditionSpec.expectedVerdict, passed_cells: records.filter((record) => record.cell_passed).length, total_cells: records.length }));
if (records.some((record) => record.cell_passed !== true)) process.exitCode = 1;
