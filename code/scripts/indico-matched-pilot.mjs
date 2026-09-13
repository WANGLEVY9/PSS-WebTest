import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { appendRunRecord, createTraditionalRunRecord } from '../src/traditional-run-record.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';
import { findProviderProfile } from '../src/provider-profile.mjs';
import { resolveExperimentCondition } from '../src/experiment-condition.mjs';

const explicitEnv = { ...process.env };
dotenv.config();

const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '1', 10);
const taskId = process.env.PSS_INDICO_TASK_ID ?? 'indico-create-event';
if (!['indico-create-event', 'indico-search-events'].includes(taskId)) throw new Error('PSS_INDICO_TASK_ID must be indico-create-event or indico-search-events');
const experimentCondition = resolveExperimentCondition();
const expectedVerdict = experimentCondition.expectedVerdict;
const taskFamily = taskId === 'indico-search-events' ? 'search-navigation' : 'multi-step';
const providerOptimizationProfile = process.env.PSS_AGENT_PROFILE?.trim()
  || findProviderProfile({ provider: process.env.CUA_PROVIDER, model: process.env.CUA_MODEL })?.optimization_profile
  || 'baseline-v0';
const optimizationByArm = Object.fromEntries(['visual', 'hybrid'].map((arm) => [arm, resolveAgentOptimization({ env: { ...process.env, PSS_AGENT_PROFILE: providerOptimizationProfile }, arm, taskFamily })]));
const maxSteps = process.env.CUA_MAX_STEPS ?? String(Math.max(optimizationByArm.visual.max_steps, optimizationByArm.hybrid.max_steps));
const timeoutMs = process.env.CUA_TIMEOUT_MS ?? String(Math.max(optimizationByArm.visual.timeout_ms, optimizationByArm.hybrid.timeout_ms));
const wallTimeoutMs = process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '120000';
const provider = process.env.CUA_PROVIDER ?? null;
const model = process.env.CUA_MODEL ?? null;
const pilotRunTag = process.env.PSS_PILOT_RUN_TAG ?? null;
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const readEnvFile = (name) => {
  const file = `${root}/${name}`;
  if (!fs.existsSync(file)) return {};
  return dotenv.parse(fs.readFileSync(file));
};
// Matched pilots are launched as child processes.  Resolve the selected
// provider profile once and pass it to every arm so a DeepSeek run cannot
// accidentally inherit the default Aliyun key from .env.
const providerEnv = (() => {
  const base = { ...readEnvFile('.env'), ...process.env };
  const profileFile = provider === 'deepseek' ? '.env.deepseek'
    : provider === 'volcengine' ? '.env.volcengine-cua' : null;
  if (profileFile) Object.assign(base, readEnvFile(profileFile));
  // Explicit command-line values always win over profile files.
  for (const key of ['CUA_PROVIDER', 'CUA_MODEL', 'CUA_BASE_URL', 'PSS_AGENT_PROFILE']) {
  if (explicitEnv[key]) base[key] = explicitEnv[key];
  }
  // The child runner must receive the same provider-specific optimization
  // profile that was used to derive the matched-cell budgets.  Without this
  // propagation it silently falls back to baseline-v0 (coordinate hybrid),
  // making a protocol mismatch look like a model failure.
  base.PSS_AGENT_PROFILE = explicitEnv.PSS_AGENT_PROFILE ?? providerOptimizationProfile;
  base.CUA_AGENT_WALL_TIMEOUT_MS = explicitEnv.CUA_AGENT_WALL_TIMEOUT_MS ?? '120000';
  base.PSS_REQUIRE_FROZEN_PROFILE = '1';
  return base;
})();
const protocolVersion = process.env.PSS_PROTOCOL_VERSION ?? '2.0-draft';
const phase2Protocol = protocolVersion === '2.0-draft';
const codeRoot = root;
const registry = phase2Protocol ? loadConfigurationRegistry() : null;
const taskManifestPath = `${codeRoot}/manifests/task-manifest.v0.1.json`;
const runManifestPath = `${codeRoot}/config/${taskId === 'indico-search-events' ? 'indico-search-events' : 'indico-create-event'}-run-manifest.v0.2.json`;
const slug = (value) => String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '');
const runSlug = [provider && model ? `${provider}-${model}` : 'unconfigured', pilotRunTag && slug(pilotRunTag)].filter(Boolean).join('-');
const artifact = `${root}/../artifacts/phase2/indico-${taskId}-three-arm-${runSlug}-${experimentCondition.condition}-pilot.json`;
const recordsPath = `${root}/../artifacts/phase2/indico-three-arm-${runSlug}-records.jsonl`;

const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: { ...providerEnv, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
});
const lastJson = (stdout) => stdout.trim().split('\n').reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find(Boolean) ?? null;
const configurations = {
  visual: provider === 'deepseek' && model === 'deepseek-v4-flash-vision-exp' ? 'visual-pss-native-deepseek-flash-v1' : 'visual-pss-native-aliyun-qwen3-7-flash-v1',
  hybrid: provider === 'deepseek' && model === 'deepseek-v4-flash-vision-exp' ? 'hybrid-pss-native-deepseek-flash-v1' : 'hybrid-pss-native-aliyun-qwen3-7-flash-v1',
  playwright: 'scripted-playwright-accessibility-human-v2'
};
const scheduledArms = (repetition) => ['playwright', 'visual', 'hybrid'].sort((left, right) =>
  crypto.createHash('sha256').update(`${taskId}|${pilotRunTag ?? 'untagged'}|${repetition}|${left}`).digest('hex')
    .localeCompare(crypto.createHash('sha256').update(`${taskId}|${pilotRunTag ?? 'untagged'}|${repetition}|${right}`).digest('hex'))
);
const randomizationBlock = (repetition, arms) => `${taskId}-${experimentCondition.condition}-${pilotRunTag ?? 'untagged'}-r${String(repetition).padStart(2, '0')}-${arms.join('-')}`;
const records = [];
const writeSummary = () => {
  fs.mkdirSync(`${root}/../artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({ application: 'indico', task_id: taskId, condition: experimentCondition.condition, expected_verdict: expectedVerdict, provider, model, pilot_run_tag: pilotRunTag, repetitions, arms: ['playwright', 'visual', 'hybrid'], max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), agent_wall_timeout_ms: Number(wallTimeoutMs), records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false }, null, 2)}\n`, { mode: 0o600 });
};
const createMissingAgentRecord = ({ arm, phase2Fields, executionCode }) => createRunRecord({
  ...(phase2Fields ?? {}),
  run_id: `indico-${arm}-missing-child-${Date.now()}`,
  application_id: 'indico', application_version: process.env.INDICO_VERSION ?? '3.3.6', task_id: taskId,
  condition: experimentCondition.condition, arm, status: 'infrastructure-error', checkpoint_reached: false,
  emitted_verdict: 'not-emitted', ground_truth_verdict: expectedVerdict,
  timing: { wall_time_ms: 0, actions: 0, retries: 0 },
  provenance: { ...(phase2Fields?.provenance ?? {}), runner_version: `indico-${arm}-matched-v0.1`, observation_contract: arm === 'visual' ? 'screenshot-only' : 'screenshot-plus-structure' },
  failure_category: 'environment', trace: [{ kind: 'runner-boundary', reason: 'child-record-missing', execution_exit_code: executionCode }]
});

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const orderedArms = scheduledArms(repetition);
  const block = randomizationBlock(repetition, orderedArms);
  for (const arm of orderedArms) {
    const reset = await run('node', ['scripts/indico-lifecycle.mjs', 'reset']);
    const resetSummary = lastJson(reset.stdout);
    const resetDigest = resetSummary?.reset_digest ?? null;
    const preOracleRun = reset.code === 0 ? await run('node', ['scripts/evaluate-indico-event.mjs']) : { code: 1, stdout: '' };
    const preOracle = lastJson(preOracleRun.stdout);
    const cleanStateVerified = reset.code === 0 && (!phase2Protocol || typeof resetDigest === 'string') && preOracleRun.code === 1 && preOracle?.matches === 0 && preOracle?.passed === false;
    const phase2Fields = phase2Protocol && cleanStateVerified ? createPhase2Provenance({
      registry, configurationId: configurations[arm], runManifestPath, taskManifestPath, applicationId: 'indico',
      resetDigest, randomizationBlock: block,
      environment: { runner: arm === 'playwright' ? `indico-${taskId}-playwright-v0.1` : `indico-${taskId}-agent-v0.1`, base_url: 'http://localhost:8080', browser: 'chromium', viewport: '1280x720', arm, task_id: taskId, max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), condition: experimentCondition.condition, action_output_mode: arm === 'playwright' ? null : process.env.CUA_PROVIDER === 'aliyun' ? (process.env.CUA_ALIYUN_ACTION_MODE ?? 'tool') : process.env.CUA_PROVIDER === 'deepseek' ? (process.env.CUA_DEEPSEEK_ACTION_MODE ?? 'tool') : null, hybrid_action_mode: arm === 'hybrid' ? (process.env.CUA_HYBRID_ACTION_MODE ?? optimizationByArm.hybrid.hybrid_action_mode ?? 'coordinate') : null, optimization_profile: arm === 'playwright' ? null : optimizationByArm[arm].profile_id, scheduling: 'parallel-feasibility-or-sequential-pilot' }
    }) : null;
    let execution; let oracle; let result = null; let cellRunRecord = null;
    if (!cleanStateVerified) {
      records.push({ repetition, arm, reset_ok: reset.code === 0, clean_state_verified: false, execution_exit_code: null, oracle_passed: false, oracle_matches: preOracle?.matches ?? null });
      writeSummary(); console.log(JSON.stringify(records.at(-1))); continue;
    }
    const databaseFault = experimentCondition.isFault && taskId === 'indico-create-event';
    const faultApply = databaseFault ? await run('node', ['scripts/indico-fault.mjs', 'apply']) : { code: 0 };
    if (faultApply.code !== 0) {
      records.push({ repetition, arm, condition: experimentCondition.condition, reset_digest: resetDigest, reset_ok: true, clean_state_verified: true, execution_exit_code: faultApply.code, oracle_passed: false, cell_passed: false, failure_category: 'execution' });
      writeSummary(); console.log(JSON.stringify(records.at(-1))); continue;
    }
    if (arm === 'playwright') {
      const startedAt = Date.now();
      const spec = experimentCondition.isFault ? 'tests/traditional/indico-create-event-fault.spec.js' : 'tests/traditional/indico-create-event.spec.js';
      execution = taskId === 'indico-search-events'
        ? await run('node', ['scripts/run-indico-search-playwright.mjs'], {
          PSS_INDICO_SEARCH_QUERY: process.env.PSS_INDICO_SEARCH_QUERY ?? 'test', INDICO_BASE_URL: 'http://localhost:8080',
          PSS_PILOT_CONDITION: experimentCondition.condition,
          PSS_PROTOCOL_VERSION: protocolVersion, PSS_CONFIGURATION_ID: configurations.playwright, PSS_RESET_DIGEST: resetDigest ?? '', PSS_RANDOMIZATION_BLOCK: block,
          PSS_RUN_MANIFEST_PATH: runManifestPath, PSS_TASK_MANIFEST_PATH: taskManifestPath, PSS_RUN_RECORD_OUT: recordsPath,
          PSS_INDICO_USERNAME: process.env.PSS_INDICO_USERNAME, PSS_INDICO_PASSWORD: process.env.PSS_INDICO_PASSWORD
        })
        : await run('npx', ['playwright', 'test', spec, '--project=chromium'], {
          RUN_INDICO_VERTICAL_SLICE: experimentCondition.isFault ? '0' : '1', RUN_INDICO_FAULT_WORKFLOW: experimentCondition.isFault ? '1' : '0', RUN_INDICO_EVOLUTION_WORKFLOW: experimentCondition.isEvolution ? '1' : '0', INDICO_BASE_URL: 'http://localhost:8080', SUT_BASE_URL: 'http://localhost:8080',
        PSS_INDICO_USERNAME: process.env.PSS_INDICO_USERNAME, PSS_INDICO_PASSWORD: process.env.PSS_INDICO_PASSWORD
        });
      if (taskId === 'indico-search-events') {
        const payload = lastJson(execution.stdout); oracle = payload?.oracle ?? null; cellRunRecord = payload?.run_record ?? null;
        if (!cellRunRecord) {
          cellRunRecord = createMissingAgentRecord({ arm, phase2Fields, executionCode: execution.code });
          appendRunRecord(cellRunRecord, recordsPath);
        }
      } else {
        const oracleRun = await run('node', ['scripts/evaluate-indico-event.mjs'], { PSS_INDICO_EXPECT_FAULT: experimentCondition.isFault ? '1' : '0' }); oracle = lastJson(oracleRun.stdout);
        cellRunRecord = createTraditionalRunRecord({ application_id: 'indico', application_version: process.env.INDICO_VERSION ?? '3.3.6', task_id: taskId, execution_exit_code: execution.code, oracle, expected_verdict: expectedVerdict, condition: experimentCondition.condition, wall_time_ms: Date.now() - startedAt, actions: 10, runner_version: 'indico-playwright-cell-v0.3', phase2Fields, trace: [{ kind: 'scripted-sequence', action_count: 10 }] });
        appendRunRecord(cellRunRecord, recordsPath);
      }
    } else {
      execution = await run('node', ['scripts/run-indico-agent-pilot.mjs'], {
        INDICO_ARM: arm,
        CUA_MAX_STEPS: process.env.CUA_MAX_STEPS ?? String(optimizationByArm[arm].max_steps),
        CUA_TIMEOUT_MS: process.env.CUA_TIMEOUT_MS ?? String(optimizationByArm[arm].timeout_ms),
        CUA_MAX_RETRIES: process.env.CUA_MAX_RETRIES ?? String(optimizationByArm[arm].max_retries),
        CUA_MAX_DECISION_RETRIES: process.env.CUA_MAX_DECISION_RETRIES ?? String(optimizationByArm[arm].max_decision_retries),
        CUA_MAX_OUTPUT_TOKENS: process.env.CUA_MAX_OUTPUT_TOKENS ?? String(optimizationByArm[arm].max_output_tokens),
        CUA_COORDINATE_MODE: process.env.CUA_COORDINATE_MODE ?? optimizationByArm[arm].coordinate_mode,
        CUA_HYBRID_ACTION_MODE: process.env.CUA_HYBRID_ACTION_MODE ?? (optimizationByArm[arm].hybrid_action_mode ?? 'coordinate'),
        PSS_AGENT_PROFILE: optimizationByArm[arm].profile_id,
        PSS_INDICO_TASK_ID: taskId,
        PSS_PILOT_CONDITION: experimentCondition.condition,
        PSS_INDICO_EXPECT_FAULT: experimentCondition.isFault ? '1' : '0',
        CUA_SCREENSHOT_QUALITY: process.env.CUA_SCREENSHOT_QUALITY ?? String(optimizationByArm[arm].screenshot_quality),
        PSS_AGENT_POST_ACTION_SETTLE_MS: process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimizationByArm[arm].post_action_settle_ms),
        PSS_INDICO_USERNAME: process.env.PSS_INDICO_USERNAME, PSS_INDICO_PASSWORD: process.env.PSS_INDICO_PASSWORD,
        PSS_PROTOCOL_VERSION: protocolVersion, PSS_CONFIGURATION_ID: configurations[arm], PSS_RESET_DIGEST: resetDigest ?? '',
        PSS_RANDOMIZATION_BLOCK: block, PSS_RUN_MANIFEST_PATH: runManifestPath, PSS_TASK_MANIFEST_PATH: taskManifestPath,
        PSS_RUN_RECORD_OUT: recordsPath
      });
      result = lastJson(execution.stdout); oracle = result?.oracle?.value ?? null; cellRunRecord = result?.run_record ?? null;
      if (!cellRunRecord) {
        cellRunRecord = createMissingAgentRecord({ arm, phase2Fields, executionCode: execution.code });
        appendRunRecord(cellRunRecord, recordsPath);
      }
    }
    const faultRemove = databaseFault ? await run('node', ['scripts/indico-fault.mjs', 'remove']) : { code: 0 };
    const agentCompleted = arm === 'playwright' ? execution.code === 0 : result?.protocol_completed === true;
    const oraclePassed = oracle?.passed === true;
    records.push({ repetition, arm, task_id: taskId, condition: experimentCondition.condition, expected_verdict: expectedVerdict, randomization_block: block, reset_digest: resetDigest, provider, model, reset_ok: reset.code === 0, clean_state_verified: true, mutation_removed: faultRemove.code === 0, execution_exit_code: execution.code, agent_status: result?.result?.status ?? result?.run_record?.status ?? null, emitted_verdict: result?.result?.emitted_verdict ?? result?.run_record?.emitted_verdict ?? (arm === 'playwright' && agentCompleted ? expectedVerdict : null), agent_completed: agentCompleted, task_state_reached: oraclePassed, oracle_passed: oraclePassed, oracle_only_success: result?.oracle_only_success === true, cell_passed: agentCompleted && oraclePassed && faultRemove.code === 0, oracle_matches: oracle?.matches ?? null, run_id: cellRunRecord?.run_id ?? null, timing: cellRunRecord?.timing ?? null, failure_category: cellRunRecord?.failure_category ?? null });
    writeSummary(); console.log(JSON.stringify(records.at(-1)));
  }
}
const passed = records.filter((r) => r.reset_ok && r.clean_state_verified && r.oracle_passed).length;
writeSummary();
console.log(JSON.stringify({ artifact, passed_cells: passed, total_cells: records.length }));
