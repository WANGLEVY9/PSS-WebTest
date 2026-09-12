#!/usr/bin/env node
// PrestaShop matched three-arm pilot orchestrator.
//
// For every provider stratum it resets the SUT before each arm, runs the three
// arms in a per-repetition randomised order, and writes one aligned append-only
// ledger per provider.  Provider/model/framework strata are never pooled.
//
// Evidence boundary: this is admission/pilot evidence only. Records are written
// with confirmatory=false and must not be reported as a strategy comparison.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { loadProviderProfileManifest } from '../src/provider-profile.mjs';
import { createRunRecord } from '../src/run-records.mjs';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
const artifactRoot = path.join(repositoryRoot, 'artifacts', 'phase2');
const recordsDir = path.join(artifactRoot, 'run-records');

const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '3', 10);
const complexity = process.env.PSS_AGENT_COMPLEXITY ?? 'simple';
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const mutation = process.env.PSS_UI_MUTATION ?? null;
const expectedVerdict = process.env.PSS_EXPECTED_VERDICT ?? (mutation === 'search-result-label-omission' ? 'fault' : 'clean');
const query = process.env.PSS_PRESTASHOP_QUERY ?? 'Mug';
// The fault condition's expected product must be the product the mutation
// actually renames. Deriving it from the mutation definition prevents the
// benchmark-definition mismatch recorded on 2026-09-11, where the runner
// expected 'Mug The adventure begins' while the mutation renamed
// 'Pack Mug + Framed poster'. With a misaligned expected product every agent
// arm correctly reported `clean`, which was then mis-scored as an oracle
// failure.
let expectedProduct = process.env.PSS_PRESTASHOP_EXPECTED_PRODUCT ?? null;
if (!expectedProduct && mutation) {
  const mutationDocument = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config', 'prestashop-mutations.v0.1.json'), 'utf8'));
  const definition = (mutationDocument.mutations ?? []).find((entry) => entry.id === mutation);
  if (!definition) throw new Error(`Unknown PSS_UI_MUTATION: ${mutation}`);
  expectedProduct = definition.target_text ?? null;
  if (definition.condition === 'functional-fault' && !expectedProduct) {
    throw new Error(`Mutation ${mutation} declares no target_text, so the fault condition cannot align its expected product`);
  }
}
const maxResetAttempts = Number.parseInt(process.env.PSS_RESET_MAX_ATTEMPTS ?? '2', 10);
// Reset isolation policy. `per-arm` is the strictest and is the default for a
// small canary. `per-block` follows the declared scale-up policy in
// prestashop-agent-model-matrix.v0.1.json (reset_isolation =
// reset-before-each-cell-block, block_size = 100): one reset per block of
// repetitions, shared by all arms inside that block.
const resetPolicy = process.env.PSS_RESET_POLICY ?? 'per-arm';
if (!['per-arm', 'per-repetition', 'per-block'].includes(resetPolicy)) throw new Error(`Unsupported PSS_RESET_POLICY: ${resetPolicy}`);
const resetBlockSize = Math.max(Number.parseInt(process.env.PSS_RESET_BLOCK_SIZE ?? '100', 10), 1);
const resetPerArm = resetPolicy === 'per-arm';
const arms = ['playwright', 'visual', 'hybrid'];
const runDate = process.env.PSS_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const runTag = process.env.PSS_PILOT_RUN_TAG ?? null;

const requested = (process.env.PSS_MATCHED_PROVIDERS ?? 'aliyun,deepseek').split(',').map((value) => value.trim()).filter(Boolean);

function slug(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '');
}

function readEnvFile(name) {
  const envPath = path.join(codeRoot, name);
  if (!fs.existsSync(envPath)) throw new Error(`local env file is missing: ${name}`);
  return dotenv.parse(fs.readFileSync(envPath));
}

function profileEnv(profile) {
  // SUT fixture credentials are fixture-level and shared; the profile file is
  // applied last so provider settings cannot bleed between strata.
  const env = { ...process.env, ...readEnvFile('.env') };
  if (profile.local_env_file) Object.assign(env, readEnvFile(profile.local_env_file));
  env.PSS_REQUIRE_FROZEN_PROFILE = '1';
  env.PSS_AGENT_PROFILE = profile.optimization_profile;
  return env;
}

function run(command, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: codeRoot, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function lastJson(stdout) {
  return stdout.trim().split('\n').reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find(Boolean) ?? null;
}

function allJson(stdout) {
  return stdout.trim().split('\n').map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}

function randomizedArms(seed, repetition) {
  const order = (arm) => crypto.createHash('sha256').update(`${seed}|${repetition}|${arm}`).digest('hex');
  return [...arms].sort((left, right) => order(left).localeCompare(order(right)));
}

async function resetWithRetry(env) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxResetAttempts; attempt += 1) {
    const result = await run('node', ['scripts/webtestpilot-lifecycle.mjs', 'prestashop', 'reset'], env);
    const lines = allJson(result.stdout);
    const seedVerified = lines.find((line) => line.status === 'seed-verified') ?? null;
    const ready = lines.find((line) => line.status === 'ready') ?? null;
    const ok = result.code === 0 && Boolean(seedVerified);
    attempts.push({
      attempt,
      exit_code: result.code,
      status: seedVerified?.status ?? ready?.status ?? null,
      seed_counts: seedVerified?.counts ?? null,
      // PrestaShop does not emit a cryptographic reset digest yet (unlike
      // BookStack). The verified seed counts are the determinism evidence
      // available today; this gap is recorded, not papered over.
      reset_digest: null,
      stderr_tail: result.stderr.slice(-300)
    });
    if (ok) return { ok: true, attempts, seedCounts: seedVerified.counts ?? null };
  }
  return { ok: false, attempts, seedCounts: null };
}

const manifest = loadProviderProfileManifest();
const profiles = manifest.profiles
  // Only collection-eligible strata participate in a matched canary; a
  // legacy-registered model id stays readable but is not a new collection arm.
  .filter((profile) => profile.status === 'frozen-pilot')
  .filter((profile) => requested.includes(profile.provider_id) || requested.includes(profile.profile_id));

// A stratum that the readiness gate marked blocked (for example an account
// quota limit) is recorded as blocked instead of burning SUT resets on calls
// that cannot succeed. Set PSS_IGNORE_READINESS=1 to force a re-attempt.
const readinessPath = path.join(codeRoot, 'config', 'provider-readiness.v0.1.json');
const readinessByProfile = new Map();
if (fs.existsSync(readinessPath)) {
  for (const entry of JSON.parse(fs.readFileSync(readinessPath, 'utf8')).profiles ?? []) {
    readinessByProfile.set(entry.profile_id, entry.status);
  }
}
if (profiles.length === 0) {
  console.error(`No provider profile matched PSS_MATCHED_PROVIDERS=${requested.join(',')}`);
  process.exitCode = 1;
} else {
  fs.mkdirSync(recordsDir, { recursive: true });
  const strata = [];
  for (const profile of profiles) {
    const providerSlug = slug(`${profile.provider_id}-${profile.model_id}`);
    const tagSuffix = runTag ? `-${slug(runTag)}` : '';
    const conditionSlug = slug(condition);
    const ledgerPath = path.join(recordsDir, `${runDate}-${providerSlug}-prestashop-${conditionSlug}-canary${tagSuffix}-aligned.jsonl`);
    const summaryPath = path.join(artifactRoot, `${runDate}-${providerSlug}-prestashop-${conditionSlug}-canary${tagSuffix}-pilot.json`);
    let env;
    try {
      env = profileEnv(profile);
    } catch (error) {
      console.error(`\n=== ${profile.profile_id}: blocked (${error.message})`);
      strata.push({ profile_id: profile.profile_id, provider_id: profile.provider_id, model_id: profile.model_id, status: 'blocked', reason: error.message, records: [], ledger: null, summary: null });
      continue;
    }
    console.log(`\n=== ${profile.profile_id} (${profile.provider_id}/${profile.model_id}) -> ${path.relative(repositoryRoot, ledgerPath)}`);
    const readiness = readinessByProfile.get(profile.profile_id);
    if (readiness && readiness !== 'ready' && process.env.PSS_IGNORE_READINESS !== '1') {
      console.log(`skipped: readiness gate reports "${readiness}"; run "npm run readiness:provider" after the provider boundary is resolved`);
      strata.push({ profile_id: profile.profile_id, provider_id: profile.provider_id, model_id: profile.model_id, status: 'blocked', reason: `readiness=${readiness}`, records: [], ledger: null, summary: null });
      continue;
    }
    const records = [];
    // Carried across repetitions inside a reset block when the declared policy
    // is reset-before-each-cell-block. The block is counted in executions, not
    // repetitions, so block_size keeps its declared meaning.
    let lastBlockReset = null;
    let executionsSinceReset = 0;
    const writeSummary = () => {
      fs.writeFileSync(summaryPath, `${JSON.stringify({
        application: 'prestashop',
        task_id: complexity === 'simple' ? 'prestashop-buyer-search-product' : complexity === 'medium' ? 'prestashop-search-open-product' : 'prestashop-search-revisit-product',
        complexity, condition, mutation, run_tag: runTag, provider_id: profile.provider_id, model_id: profile.model_id, profile_id: profile.profile_id,
        optimization_profile: profile.optimization_profile, repetitions, arms, records,
        passed_cells: records.filter((record) => record.cell_passed).length, total_cells: records.length,
        confirmatory: false,
        evidence_boundary: 'admission/pilot evidence only; not a strategy comparison and not confirmatory'
      }, null, 2)}\n`, { mode: 0o600 });
    };
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const orderedArms = randomizedArms(process.env.PSS_RANDOMIZATION_SEED ?? `${profile.profile_id}-prestashop-canary-v1`, repetition);
      const needsBlockReset = resetPolicy === 'per-block'
        ? (lastBlockReset === null || executionsSinceReset >= resetBlockSize)
        : true;
      if (!resetPerArm && needsBlockReset) {
        lastBlockReset = await resetWithRetry(env);
        executionsSinceReset = 0;
      }
      const blockBoundary = resetPerArm || needsBlockReset;
      const sharedReset = lastBlockReset;
      for (const arm of orderedArms) {
        const reset = resetPerArm ? await resetWithRetry(env) : sharedReset;
        // The run tag is part of the run id. Without it, a re-run in a new
        // execution context would collide with the previous ledger's ids and
        // the ledger audit would report duplicates instead of isolating the
        // new block.
        const tagIdSuffix = runTag ? `-${slug(runTag)}` : '';
        const runId = `prestashop-${providerSlug}-${arm}-${conditionSlug}${tagIdSuffix}-r${String(repetition).padStart(2, '0')}`;
        const base = {
          repetition, arm, run_id: runId, provider_id: profile.provider_id, model_id: profile.model_id, profile_id: profile.profile_id,
          randomization_block: `prestashop-${conditionSlug}-${providerSlug}-r${String(repetition).padStart(2, '0')}-${orderedArms.join('-')}`,
          reset_ok: reset?.ok === true, reset_seed_counts: reset?.seedCounts ?? null, reset_attempts: reset?.attempts ?? [],
          reset_retry_used: (reset?.attempts?.length ?? 0) > 1, reset_policy: resetPolicy,
          reset_reused_from_block: !resetPerArm && !blockBoundary
        };
        if (reset?.ok !== true) {
          const resetRecord = createRunRecord({
            run_id: runId,
            application_id: 'prestashop',
            application_version: process.env.PSS_PRESTASHOP_VERSION ?? '8.1.2',
            task_id: complexity === 'simple' ? 'prestashop-buyer-search-product' : complexity === 'medium' ? 'prestashop-search-open-product' : 'prestashop-search-revisit-product',
            condition,
            arm,
            status: 'infrastructure-error',
            checkpoint_reached: false,
            independent_oracle_passed: false,
            emitted_verdict: 'not-emitted',
            ground_truth_verdict: expectedVerdict,
            timing: { wall_time_ms: 0, actions: 0, retries: Math.max((reset?.attempts?.length ?? 1) - 1, 0) },
            provenance: { runner_version: 'prestashop-matched-pilot-v0.3', observation_contract: arm === 'playwright' ? 'scripted-locator' : arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure', provider_id: profile.provider_id, model_id: profile.model_id, provider_profile_id: profile.profile_id },
            failure_category: 'environment'
          });
          fs.appendFileSync(ledgerPath, `${JSON.stringify(resetRecord)}\n`, { mode: 0o600 });
          records.push({ ...base, clean_state_verified: false, execution_exit_code: null, cell_passed: false, failure_category: 'environment' });
          console.log(`  r${repetition} ${arm}: reset failed`);
          writeSummary();
          continue;
        }
        const cellEnv = {
          ...env,
          PSS_ARM: arm,
          PSS_AGENT_COMPLEXITY: complexity,
          PSS_PILOT_CONDITION: condition,
          PSS_EXPECTED_VERDICT: expectedVerdict,
          PSS_RUN_ID: runId,
          PSS_RUN_RECORD_OUT: ledgerPath,
          PSS_PRESTASHOP_QUERY: query
        };
        if (expectedProduct) cellEnv.PSS_PRESTASHOP_EXPECTED_PRODUCT = expectedProduct;
        if (mutation) cellEnv.PSS_UI_MUTATION = mutation;
        const cell = arm === 'playwright'
          ? await run('node', ['scripts/run-prestashop-playwright-cell.mjs'], cellEnv)
          : await run('node', ['scripts/run-prestashop-agent-cell.mjs'], cellEnv);
        const result = lastJson(cell.stdout);
        // The agent cell prints a full run_record; the scripted cell prints a
        // flatter summary without one. Normalise both shapes here rather than
        // changing the cell contracts.
        const runRecord = result?.run_record ?? null;
        const scripted = arm === 'playwright';
        const oraclePassed = result?.independent_oracle?.passed === true;
        const status = runRecord?.status ?? result?.status ?? null;
        const emittedVerdict = runRecord?.emitted_verdict ?? result?.emitted_verdict ?? null;
        const actions = runRecord?.timing?.actions ?? result?.actions ?? null;
        const wallTimeMs = runRecord?.timing?.wall_time_ms ?? result?.wall_time_ms ?? null;
        const checkpointReached = scripted ? oraclePassed : result?.task_state_reached === true;
        const cellPassed = scripted
          ? (status === 'completed' && oraclePassed)
          : result?.cell_passed === true;
        records.push({
          ...base,
          clean_state_verified: true,
          execution_exit_code: cell.code,
          status,
          emitted_verdict: emittedVerdict,
          ground_truth_verdict: runRecord?.ground_truth_verdict ?? expectedVerdict,
          checkpoint_reached: checkpointReached,
          oracle_passed: oraclePassed,
          oracle_only_success: result?.oracle_only_success === true,
          cell_passed: cellPassed,
          action_mode: runRecord?.provenance?.action_mode ?? null,
          api_mode: runRecord?.provenance?.api_mode ?? null,
          provider_profile_id: runRecord?.provenance?.provider_profile_id ?? null,
          actions,
          wall_time_ms: wallTimeMs,
          failure_category: runRecord?.failure_category ?? (cellPassed ? null : 'execution'),
          failure_message: result?.failure?.message ? String(result.failure.message).slice(0, 300) : null
        });
        const last = records.at(-1);
        executionsSinceReset += 1;
        console.log(`  r${repetition} ${arm}: ${last.cell_passed ? 'PASS' : 'fail'} status=${last.status ?? '-'} verdict=${last.emitted_verdict ?? '-'} actions=${last.actions ?? '-'} ${last.wall_time_ms ?? '-'}ms ${last.failure_category ?? ''}`);
        if (!last.cell_passed) {
          last.cell_stdout_tail = cell.stdout.slice(-400);
          last.cell_stderr_tail = cell.stderr.slice(-600);
          console.log(`      stdout: ${last.cell_stdout_tail.replace(/\s+/g, ' ').slice(0, 300)}`);
          if (last.cell_stderr_tail.trim()) console.log(`      stderr: ${last.cell_stderr_tail.replace(/\s+/g, ' ').slice(0, 300)}`);
        }
        writeSummary();
      }
    }
    const passed = records.filter((record) => record.cell_passed).length;
    strata.push({ profile_id: profile.profile_id, provider_id: profile.provider_id, model_id: profile.model_id, status: 'collected', passed_cells: passed, total_cells: records.length, records, ledger: ledgerPath, summary: summaryPath });
  }
  console.log(`\n=== canary summary ===`);
  for (const stratum of strata) {
    console.log(`${stratum.profile_id}: ${stratum.status}${stratum.status === 'collected' ? ` ${stratum.passed_cells}/${stratum.total_cells}` : ` (${stratum.reason})`}`);
  }
}
