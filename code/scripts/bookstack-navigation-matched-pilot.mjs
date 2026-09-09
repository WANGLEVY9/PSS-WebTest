import 'dotenv/config';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const repositoryRoot = `${root}/..`;
const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '1', 10);
const taskId = process.env.PSS_BOOKSTACK_TASK_ID ?? 'bookstack-open-book';
if (!['bookstack-open-book', 'bookstack-search-and-open-book2'].includes(taskId)) throw new Error(`Unsupported PSS_BOOKSTACK_TASK_ID: ${taskId}`);
const isSearchTask = taskId === 'bookstack-search-and-open-book2';
const taskFamily = isSearchTask ? 'search-navigation' : 'navigation';
const optimizationByArm = Object.fromEntries(['visual', 'hybrid'].map((arm) => [arm, resolveAgentOptimization({ env: { ...process.env, PSS_AGENT_PROFILE: process.env.PSS_AGENT_PROFILE ?? 'baseline-v0' }, arm, taskFamily })]));
const maxSteps = Number.parseInt(process.env.CUA_MAX_STEPS ?? String(Math.max(optimizationByArm.visual.max_steps, optimizationByArm.hybrid.max_steps)), 10);
const timeoutMs = Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(Math.max(optimizationByArm.visual.timeout_ms, optimizationByArm.hybrid.timeout_ms)), 10);
const maxResetAttempts = Number.parseInt(process.env.PSS_RESET_MAX_ATTEMPTS ?? '2', 10);
const condition = process.env.PSS_PILOT_CONDITION ?? 'clean-stable';
const mutation = process.env.PSS_UI_MUTATION ?? null;
const protocolVersion = process.env.PSS_PROTOCOL_VERSION ?? '2.0-draft';
const randomizationSeed = process.env.PSS_RANDOMIZATION_SEED ?? `${taskId}-phase2-v1`;
const provider = process.env.CUA_PROVIDER ?? null;
const model = process.env.CUA_MODEL ?? null;
const runTag = process.env.PSS_PILOT_RUN_TAG ?? null;
const conditionSlug = condition.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'condition';
const modelSlug = model ? `${provider ?? 'provider'}-${model}`.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') : 'unconfigured';
const tagSlug = runTag ? runTag.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') : null;
if (runTag && !tagSlug) throw new Error('PSS_PILOT_RUN_TAG must contain at least one letter or digit');
const runSlug = [conditionSlug, modelSlug, tagSlug].filter(Boolean).join('-');
const taskSlug = isSearchTask ? 'bookstack-search-open-book2' : 'bookstack-navigation';
const artifactName = `${taskSlug}-${runSlug}-pilot.json`;
const recordsName = `${taskSlug}-${runSlug}-records.jsonl`;
const artifact = `${repositoryRoot}/artifacts/phase2/${artifactName}`;
const recordsPath = `${repositoryRoot}/artifacts/phase2/${recordsName}`;
const targetBook = isSearchTask ? 'Book2' : 'Book';
const runManifestPath = `${root}/config/${isSearchTask ? 'bookstack-search-open-book2' : 'bookstack-navigation'}-run-manifest.v0.2.json`;
const arms = ['playwright', 'visual', 'hybrid'];

function randomizedArms(repetition) {
  return [...arms].sort((left, right) => crypto.createHash('sha256').update(`${randomizationSeed}|${repetition}|${left}`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${randomizationSeed}|${repetition}|${right}`).digest('hex')));
}

function randomizationBlock(repetition, orderedArms) {
  const executionLabel = tagSlug ? `-${tagSlug}` : '';
  return `${taskSlug}-${conditionSlug}${executionLabel}-r${String(repetition).padStart(2, '0')}-${orderedArms.join('-')}`;
}

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
    if (passed && typeof summary?.reset_digest === 'string') return { ok: true, attempts, resetDigest: summary.reset_digest };
    if (passed) attempts[attempts.length - 1].reset_digest_missing = true;
  }
  return { ok: false, attempts };
}

const records = [];
const write = () => {
  fs.mkdirSync(`${repositoryRoot}/artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({ application: 'bookstack', task_id: taskId, condition, mutation, run_tag: runTag, protocol_version: protocolVersion, randomization_seed: randomizationSeed, provider, model, model_slug: modelSlug, repetitions, arms, records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false }, null, 2)}\n`, { mode: 0o600 });
};

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const orderedArms = randomizedArms(repetition);
  const block = randomizationBlock(repetition, orderedArms);
  for (const arm of orderedArms) {
    const reset = await resetWithRetry();
    const cleanStateVerified = reset.ok;
    let execution;
    let result;
    if (!cleanStateVerified) {
      records.push({ repetition, arm, randomization_block: block, provider, model, reset_ok: false, clean_state_verified: false, reset_attempts: reset.attempts, reset_retry_used: reset.attempts.length > 1, execution_exit_code: null, oracle_passed: false, cell_passed: false, failure_category: 'environment' });
      write();
      continue;
    }
    if (arm === 'playwright') {
      execution = await run('node', ['scripts/run-bookstack-navigation-playwright.mjs'], { PSS_PROTOCOL_VERSION: protocolVersion, PSS_CONFIGURATION_ID: 'scripted-playwright-accessibility-human-v2', PSS_RUN_MANIFEST_PATH: runManifestPath, PSS_BOOKSTACK_TASK_ID: taskId, PSS_BOOKSTACK_TARGET_BOOK: targetBook, PSS_RESET_DIGEST: reset.resetDigest, PSS_RANDOMIZATION_BLOCK: block, PSS_RUN_RECORD_OUT: recordsPath, PSS_PILOT_CONDITION: condition, PSS_UI_MUTATION: mutation ?? '' });
      result = lastJson(execution.stdout);
    } else {
      execution = await run('node', ['scripts/run-bookstack-agent-pilot.mjs'], {
        BOOKSTACK_ARM: arm, PSS_BOOKSTACK_TASK_ID: taskId, PSS_BOOKSTACK_TARGET_BOOK: targetBook, PSS_RUN_MANIFEST_PATH: runManifestPath,
        CUA_MAX_STEPS: process.env.CUA_MAX_STEPS ?? String(optimizationByArm[arm].max_steps),
        CUA_TIMEOUT_MS: process.env.CUA_TIMEOUT_MS ?? String(optimizationByArm[arm].timeout_ms),
        CUA_MAX_DECISION_RETRIES: process.env.CUA_MAX_DECISION_RETRIES ?? String(optimizationByArm[arm].max_decision_retries),
        CUA_MAX_RETRIES: process.env.CUA_MAX_RETRIES ?? String(optimizationByArm[arm].max_retries),
        CUA_MAX_OUTPUT_TOKENS: process.env.CUA_MAX_OUTPUT_TOKENS ?? String(optimizationByArm[arm].max_output_tokens),
        CUA_COORDINATE_MODE: process.env.CUA_COORDINATE_MODE ?? optimizationByArm[arm].coordinate_mode,
        CUA_HYBRID_ACTION_MODE: process.env.CUA_HYBRID_ACTION_MODE ?? (optimizationByArm[arm].hybrid_action_mode ?? 'coordinate'),
        CUA_SCREENSHOT_QUALITY: process.env.CUA_SCREENSHOT_QUALITY ?? String(optimizationByArm[arm].screenshot_quality),
        PSS_AGENT_POST_ACTION_SETTLE_MS: process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimizationByArm[arm].post_action_settle_ms),
        PSS_PROTOCOL_VERSION: protocolVersion, PSS_CONFIGURATION_ID: arm === 'visual' ? 'visual-pss-native-aliyun-qwen3-7-flash-v1' : 'hybrid-pss-native-aliyun-qwen3-7-flash-v1', PSS_RESET_DIGEST: reset.resetDigest, PSS_RANDOMIZATION_BLOCK: block,
        PSS_PILOT_CONDITION: condition, PSS_UI_MUTATION: mutation ?? '',
        PSS_RUN_RECORD_OUT: recordsPath
      });
      result = lastJson(execution.stdout);
    }
    const oraclePassed = result?.oracle?.value?.passed === true || result?.oracle?.passed === true;
    const completed = execution.code === 0 && (result?.result?.status === 'completed' || result?.run_record?.status === 'completed');
    records.push({
      repetition, arm, randomization_block: block, reset_digest: reset.resetDigest, provider, model, reset_ok: true, clean_state_verified: true, reset_attempts: reset.attempts, reset_retry_used: reset.attempts.length > 1, execution_exit_code: execution.code,
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

const summary = { application: 'bookstack', task_id: taskId, condition, mutation, run_tag: runTag, protocol_version: protocolVersion, randomization_seed: randomizationSeed, provider, model, model_slug: modelSlug, repetitions, arms, records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false };
write();
console.log(JSON.stringify({ artifact, task_id: taskId, passed_cells: summary.passed_cells, total_cells: summary.total_cells }));
if (summary.passed_cells !== summary.total_cells) process.exitCode = 1;
