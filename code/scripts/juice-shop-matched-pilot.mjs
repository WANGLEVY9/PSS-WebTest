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
const maxSteps = process.env.CUA_MAX_STEPS ?? '16';
const timeoutMs = process.env.CUA_TIMEOUT_MS ?? '20000';
const wallTimeoutMs = process.env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0';
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const provider = process.env.CUA_PROVIDER ?? null;
const model = process.env.CUA_MODEL ?? null;
const pilotRunTag = process.env.PSS_PILOT_RUN_TAG ?? null;
const slug = (value) => String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '');
const protocolVersion = process.env.PSS_PROTOCOL_VERSION ?? '2.0-draft';
const phase2Protocol = protocolVersion === '2.0-draft';
const registry = phase2Protocol ? loadConfigurationRegistry() : null;
const optimizationByArm = Object.fromEntries(['visual', 'hybrid'].map((arm) => [arm, resolveAgentOptimization({ env: { ...process.env, PSS_AGENT_PROFILE: process.env.PSS_AGENT_PROFILE ?? 'baseline-v0' }, arm, taskFamily: 'search-navigation' })]));
const taskManifestPath = `${root}/manifests/task-manifest.v0.1.json`;
const runManifestPath = `${root}/config/juice-shop-product-search-run-manifest.v0.2.json`;
const runSlug = [provider && model ? `${provider}-${model}` : 'unconfigured', pilotRunTag && slug(pilotRunTag)].filter(Boolean).join('-');
const artifact = `${root}/../artifacts/phase2/juice-shop-three-arm-${runSlug}-pilot.json`;
const recordsPath = `${root}/../artifacts/phase2/juice-shop-three-arm-${runSlug}-records.jsonl`;

const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
});
const lastJson = (stdout) => stdout.trim().split('\n').reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find(Boolean) ?? null;
const configurations = {
  visual: provider === 'deepseek' && model === 'deepseek-flash' ? 'visual-pss-native-deepseek-flash-v1' : 'visual-pss-native-aliyun-qwen3-7-flash-v1',
  hybrid: provider === 'deepseek' && model === 'deepseek-flash' ? 'hybrid-pss-native-deepseek-flash-v1' : 'hybrid-pss-native-aliyun-qwen3-7-flash-v1',
  playwright: 'scripted-playwright-accessibility-human-v2'
};
const scheduledArms = (repetition) => ['playwright', 'visual', 'hybrid'].sort((left, right) =>
  crypto.createHash('sha256').update(`juice-shop-product-search|${pilotRunTag ?? 'untagged'}|${repetition}|${left}`).digest('hex')
    .localeCompare(crypto.createHash('sha256').update(`juice-shop-product-search|${pilotRunTag ?? 'untagged'}|${repetition}|${right}`).digest('hex'))
);
const randomizationBlock = (repetition, arms) => `juice-shop-product-search-clean-${pilotRunTag ?? 'untagged'}-r${String(repetition).padStart(2, '0')}-${arms.join('-')}`;
const records = [];
const writeSummary = () => {
  fs.mkdirSync(`${root}/../artifacts/phase2`, { recursive: true });
  fs.writeFileSync(artifact, `${JSON.stringify({ application: 'juice-shop', task_id: 'juice-shop-product-search', condition: 'clean-stable', provider, model, pilot_run_tag: pilotRunTag, repetitions, arms: ['playwright', 'visual', 'hybrid'], max_steps: Number(maxSteps), timeout_ms: Number(timeoutMs), agent_wall_timeout_ms: Number(wallTimeoutMs), records, passed_cells: records.filter((r) => r.cell_passed).length, total_cells: records.length, confirmatory: false }, null, 2)}\n`, { mode: 0o600 });
};

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const orderedArms = scheduledArms(repetition);
  const block = randomizationBlock(repetition, orderedArms);
  for (const arm of orderedArms) {
    const reset = await run('node', ['scripts/juice-shop-lifecycle.mjs', 'reset']);
    const resetSummary = lastJson(reset.stdout);
    const resetDigest = resetSummary?.reset_digest ?? null;
    const clean = reset.code === 0 ? await run('node', ['scripts/verify-juice-shop-clean.mjs']) : { code: 1, stdout: '' };
    const cleanResult = lastJson(clean.stdout);
    const cleanStateVerified = reset.code === 0 && (!phase2Protocol || typeof resetDigest === 'string') && clean.code === 0 && cleanResult?.clean_state_verified === true;
    const optimization = arm === 'playwright' ? null : optimizationByArm[arm];
    const armMaxSteps = arm === 'playwright' ? Number(maxSteps) : Number.parseInt(process.env.CUA_MAX_STEPS ?? String(optimization.max_steps), 10);
    const armTimeoutMs = arm === 'playwright' ? Number(timeoutMs) : Number.parseInt(process.env.CUA_TIMEOUT_MS ?? String(optimization.timeout_ms), 10);
    const phase2Fields = phase2Protocol && cleanStateVerified ? createPhase2Provenance({
      registry, configurationId: configurations[arm], runManifestPath, taskManifestPath, applicationId: 'juice-shop',
      resetDigest, randomizationBlock: block,
      environment: { runner: arm === 'playwright' ? 'juice-shop-playwright-cell-v0.3' : `juice-shop-${arm}-agent-v0.3`, base_url: baseURL, browser: 'chromium', viewport: '1280x720', arm, max_steps: armMaxSteps, timeout_ms: armTimeoutMs, action_output_mode: arm === 'playwright' ? null : process.env.CUA_PROVIDER === 'aliyun' ? (process.env.CUA_ALIYUN_ACTION_MODE ?? 'tool') : process.env.CUA_PROVIDER === 'deepseek' ? (process.env.CUA_DEEPSEEK_ACTION_MODE ?? 'tool') : null, optimization_profile: optimization?.profile_id ?? null, hybrid_action_mode: arm === 'hybrid' ? (process.env.CUA_HYBRID_ACTION_MODE ?? 'coordinate') : null, scheduling: 'parallel-feasibility-or-sequential-pilot' }
    }) : null;
    let execution; let oracle; let result = null; let cellRunRecord = null;
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
      cellRunRecord = createTraditionalRunRecord({ application_id: 'juice-shop', application_version: process.env.JUICE_SHOP_VERSION ?? '20.0.0', task_id: 'juice-shop-product-search', execution_exit_code: execution.code, oracle, wall_time_ms: Date.now() - startedAt, actions: 5, runner_version: 'juice-shop-playwright-cell-v0.3', phase2Fields, trace: [{ kind: 'scripted-sequence', action_count: 5 }] });
      appendRunRecord(cellRunRecord, recordsPath);
    } else {
      execution = await run('node', [arm === 'visual' ? 'scripts/run-volcengine-juice-visual-smoke.mjs' : 'scripts/run-volcengine-juice-hybrid-smoke.mjs'], {
        CUA_MAX_STEPS: String(armMaxSteps), CUA_TIMEOUT_MS: String(armTimeoutMs), CUA_MAX_RETRIES: String(optimization.max_retries), CUA_MAX_DECISION_RETRIES: String(optimization.max_decision_retries), CUA_MAX_OUTPUT_TOKENS: String(optimization.max_output_tokens), CUA_SCREENSHOT_QUALITY: String(optimization.screenshot_quality), CUA_HYBRID_ACTION_MODE: arm === 'hybrid' ? (process.env.CUA_HYBRID_ACTION_MODE ?? optimization.hybrid_action_mode ?? 'coordinate') : '', CUA_AGENT_PROFILE: optimization.profile_id, PSS_AGENT_POST_ACTION_SETTLE_MS: process.env.PSS_AGENT_POST_ACTION_SETTLE_MS ?? String(optimization.post_action_settle_ms), CUA_DISMISS_OVERLAYS: process.env.CUA_DISMISS_OVERLAYS ?? '0', CUA_PREPARE_SEARCH: process.env.CUA_PREPARE_SEARCH ?? '0', CUA_TASK_MODE: process.env.CUA_TASK_MODE ?? 'full-search',
        JUICE_SHOP_BASE_URL: baseURL, PSS_PROTOCOL_VERSION: protocolVersion, PSS_CONFIGURATION_ID: configurations[arm],
        PSS_RESET_DIGEST: resetDigest ?? '', PSS_RANDOMIZATION_BLOCK: block,
        PSS_RUN_MANIFEST_PATH: runManifestPath, PSS_TASK_MANIFEST_PATH: taskManifestPath,
        PSS_RUN_RECORD_OUT: recordsPath
      });
      result = lastJson(execution.stdout); oracle = result?.ui_oracle ?? null; cellRunRecord = result?.run_record ?? null;
    }
    const agentCompleted = arm === 'playwright' ? execution.code === 0 : result?.protocol_completed === true;
    const oraclePassed = oracle?.passed === true;
    records.push({ repetition, arm, randomization_block: block, reset_digest: resetDigest, provider, model, reset_ok: reset.code === 0, clean_state_verified: true, execution_exit_code: execution.code, agent_status: result?.result?.status ?? result?.run_record?.status ?? null, emitted_verdict: result?.result?.emitted_verdict ?? result?.run_record?.emitted_verdict ?? (arm === 'playwright' && agentCompleted ? 'clean' : null), agent_completed: agentCompleted, task_state_reached: oraclePassed, oracle_passed: oraclePassed, oracle_only_success: result?.oracle_only_success === true, cell_passed: agentCompleted && oraclePassed, oracle_matches: oraclePassed ? 1 : 0, run_id: cellRunRecord?.run_id ?? null, timing: cellRunRecord?.timing ?? null, failure_category: cellRunRecord?.failure_category ?? null });
    writeSummary(); console.log(JSON.stringify(records.at(-1)));
  }
}
const passed = records.filter((r) => r.reset_ok && r.clean_state_verified && r.oracle_passed).length;
writeSummary();
console.log(JSON.stringify({ artifact, passed_cells: passed, total_cells: records.length }));
