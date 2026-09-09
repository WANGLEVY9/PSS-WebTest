import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { appendRunRecord, createTraditionalRunRecord } from '../src/traditional-run-record.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';

dotenv.config();

const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '1', 10);
const optimizationByArm = Object.fromEntries(['visual', 'hybrid'].map((arm) => [arm, resolveAgentOptimization({ env: { ...process.env, PSS_AGENT_PROFILE: process.env.PSS_AGENT_PROFILE ?? 'baseline-v0' }, arm, taskFamily: 'multi-step' })]));
const maxSteps = process.env.CUA_MAX_STEPS ?? String(Math.max(optimizationByArm.visual.max_steps, optimizationByArm.hybrid.max_steps));
const timeoutMs = process.env.CUA_TIMEOUT_MS ?? String(Math.max(optimizationByArm.visual.timeout_ms, optimizationByArm.hybrid.timeout_ms));
const wallTimeoutMs = process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0';
const provider = process.env.CUA_PROVIDER ?? null;
const model = process.env.CUA_MODEL ?? null;
const pilotRunTag = process.env.PSS_PILOT_RUN_TAG ?? null;
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const protocolVersion = process.env.PSS_PROTOCOL_VERSION ?? '2.0-draft';
const phase2Protocol = protocolVersion === '2.0-draft';
const codeRoot = root;
const registry = phase2Protocol ? loadConfigurationRegistry() : null;
const taskManifestPath = `${codeRoot}/manifests/task-manifest.v0.1.json`;
const runManifestPath = `${codeRoot}/config/indico-create-event-run-manifest.v0.2.json`;
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
const configurations = {
  visual: 'visual-pss-native-aliyun-qwen3-7-flash-v1',
  hybrid: 'hybrid-pss-native-aliyun-qwen3-7-flash-v1',
  playwright: 'scripted-playwright-accessibility-human-v2'
};
const scheduledArms = (repetition) => ['playwright', 'visual', 'hybrid'].sort((left, right) =>
  crypto.createHash('sha256').update(`indico-create-event|${pilotRunTag ?? 'untagged'}|${repetition}|${left}`).digest('hex')
    .localeCompare(crypto.createHash('sha256').update(`indico-create-event|${pilotRunTag ?? 'untagged'}|${repetition}|${right}`).digest('hex'))
);
const randomizationBlock = (repetition, arms) => `indico-create-event-clean-${pilotRunTag ?? 'untagged'}-r${String(repetition).padStart(2, '0')}-${arms.join('-')}`;
const records = [];
const writeSummary = () => {
  fs.mkdirSync(`${root}/../artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({ application: 'indico', task_id: 'indico-create-event', condition: 'clean-stable', provider, model, pilot_run_tag: pilotRunTag, repetitions, arms: ['playwright', 'visual', 'hybrid'], max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), agent_wall_timeout_ms: Number(wallTimeoutMs), records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false }, null, 2)}\n`, { mode: 0o600 });
};

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
      environment: { runner: arm === 'playwright' ? 'indico-playwright-cell-v0.3' : 'indico-agent-pilot-v0.4', base_url: 'http://localhost:8080', browser: 'chromium', viewport: '1280x720', arm, max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), action_output_mode: arm === 'playwright' || process.env.CUA_PROVIDER !== 'aliyun' ? null : (process.env.CUA_ALIYUN_ACTION_MODE ?? 'tool'), hybrid_action_mode: arm === 'hybrid' ? (process.env.CUA_HYBRID_ACTION_MODE ?? optimizationByArm.hybrid.hybrid_action_mode ?? 'coordinate') : null, optimization_profile: arm === 'playwright' ? null : optimizationByArm[arm].profile_id, scheduling: 'parallel-feasibility-or-sequential-pilot' }
    }) : null;
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
      cellRunRecord = createTraditionalRunRecord({ application_id: 'indico', application_version: process.env.INDICO_VERSION ?? '3.3.6', task_id: 'indico-create-event', execution_exit_code: execution.code, oracle, wall_time_ms: Date.now() - startedAt, actions: 10, runner_version: 'indico-playwright-cell-v0.3', phase2Fields, trace: [{ kind: 'scripted-sequence', action_count: 10 }] });
      appendRunRecord(cellRunRecord, recordsPath);
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
        CUA_SCREENSHOT_QUALITY: process.env.CUA_SCREENSHOT_QUALITY ?? String(optimizationByArm[arm].screenshot_quality),
        PSS_AGENT_POST_ACTION_SETTLE_MS: process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimizationByArm[arm].post_action_settle_ms),
        PSS_INDICO_USERNAME: process.env.PSS_INDICO_USERNAME, PSS_INDICO_PASSWORD: process.env.PSS_INDICO_PASSWORD,
        PSS_PROTOCOL_VERSION: protocolVersion, PSS_CONFIGURATION_ID: configurations[arm], PSS_RESET_DIGEST: resetDigest ?? '',
        PSS_RANDOMIZATION_BLOCK: block, PSS_RUN_MANIFEST_PATH: runManifestPath, PSS_TASK_MANIFEST_PATH: taskManifestPath,
        PSS_RUN_RECORD_OUT: recordsPath
      });
      result = lastJson(execution.stdout); oracle = result?.oracle?.value ?? null; cellRunRecord = result?.run_record ?? null;
    }
    const agentCompleted = arm === 'playwright' ? execution.code === 0 : result?.protocol_completed === true;
    const oraclePassed = oracle?.passed === true;
    records.push({ repetition, arm, randomization_block: block, reset_digest: resetDigest, provider, model, reset_ok: reset.code === 0, clean_state_verified: true, execution_exit_code: execution.code, agent_status: result?.result?.status ?? result?.run_record?.status ?? null, emitted_verdict: result?.result?.emitted_verdict ?? result?.run_record?.emitted_verdict ?? (arm === 'playwright' && agentCompleted ? 'clean' : null), agent_completed: agentCompleted, task_state_reached: oraclePassed, oracle_passed: oraclePassed, oracle_only_success: result?.oracle_only_success === true, cell_passed: agentCompleted && oraclePassed, oracle_matches: oracle?.matches ?? null, run_id: cellRunRecord?.run_id ?? null, timing: cellRunRecord?.timing ?? null, failure_category: cellRunRecord?.failure_category ?? null });
    writeSummary(); console.log(JSON.stringify(records.at(-1)));
  }
}
const passed = records.filter((r) => r.reset_ok && r.clean_state_verified && r.oracle_passed).length;
writeSummary();
console.log(JSON.stringify({ artifact, passed_cells: passed, total_cells: records.length }));
