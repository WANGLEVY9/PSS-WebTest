#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { evaluateBatchAuthorisation, classifyControllerBoundary } from '../src/exploratory-batch-guards.mjs';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = process.env.PSS_BATCH_MANIFEST
  ? path.resolve(process.env.PSS_BATCH_MANIFEST)
  : path.join(codeRoot, '..', 'artifacts/phase2', 'phase2-exploratory-500-blocks-v1-manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error(`Prepared batch manifest not found: ${manifestPath}. Run npm run batch:prepare-500 first.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const start = Number.parseInt(process.env.PSS_BATCH_START_BLOCK ?? '1', 10);
const requestedLimit = Number.parseInt(process.env.PSS_BATCH_BLOCK_LIMIT ?? String(manifest.blocks?.length ?? 0), 10);
const selectedBlocks = (manifest.blocks ?? []).filter((block) => block.block_ordinal >= start).slice(0, requestedLimit);
const currentProfile = `${process.env.CUA_PROVIDER ?? ''}/${process.env.CUA_MODEL ?? ''}`;
const authorisation = evaluateBatchAuthorisation({
  manifest, currentProfile, executeFlag: process.env.PSS_BATCH_EXECUTE,
  maxProviderRequests: Number.parseInt(process.env.PSS_BATCH_MAX_PROVIDER_REQUESTS ?? '', 10),
  maxWallMinutes: Number.parseInt(process.env.PSS_BATCH_MAX_WALL_MINUTES ?? '', 10),
  selectedBlockCount: selectedBlocks.length
});
if (authorisation.errors.length) throw new Error(`Batch execution refused:\n${authorisation.errors.map((error) => `- ${error}`).join('\n')}`);
if (process.env.PSS_BATCH_ALLOW_CANDIDATE_TASKS !== '1') throw new Error('This manifest contains pilot/candidate templates. Set PSS_BATCH_ALLOW_CANDIDATE_TASKS=1 only for the explicitly labelled exploratory campaign.');

const progressPath = process.env.PSS_BATCH_PROGRESS_OUT
  ? path.resolve(process.env.PSS_BATCH_PROGRESS_OUT)
  : path.join(codeRoot, '..', 'artifacts/phase2', `${manifest.campaign_id}-${currentProfile.replace(/[^a-zA-Z0-9._-]+/g, '-')}-progress.jsonl`);
fs.mkdirSync(path.dirname(progressPath), { recursive: true });
const startedAt = Date.now();
const guardrails = manifest.guardrails;
let consecutiveProviderFailures = 0;
let consecutiveResetFailures = 0;

function runController(controller, env) {
  return new Promise((resolve) => {
    const child = spawn('node', [controller], { cwd: codeRoot, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}
function appendProgress(row) { fs.appendFileSync(progressPath, `${JSON.stringify(row)}\n`, { mode: 0o600 }); }

for (const block of selectedBlocks) {
  const elapsedMinutes = (Date.now() - startedAt) / 60000;
  if (elapsedMinutes >= Number.parseInt(process.env.PSS_BATCH_MAX_WALL_MINUTES, 10)) {
    appendProgress({ timestamp: new Date().toISOString(), block_id: block.block_id, status: 'stopped-wall-time-cap', elapsed_minutes: elapsedMinutes });
    throw new Error(`Stopped before ${block.block_id}: PSS_BATCH_MAX_WALL_MINUTES exhausted.`);
  }
  const baseEnv = {
    PSS_MATCHED_REPETITIONS: '1', PSS_PILOT_RUN_TAG: `exploratory-500-${String(block.block_ordinal).padStart(4, '0')}`,
    PSS_RANDOMIZATION_SEED: `${manifest.campaign_id}|${block.block_id}`, PSS_PILOT_CONDITION: block.condition,
    PSS_BATCH_BLOCK_ID: block.block_id
  };
  if (block.task_id.startsWith('bookstack-')) baseEnv.PSS_BOOKSTACK_TASK_ID = block.task_id;
  const result = await runController(block.controller, baseEnv);
  const boundary = classifyControllerBoundary(result);
  consecutiveProviderFailures = boundary.providerFailure ? consecutiveProviderFailures + 1 : 0;
  consecutiveResetFailures = boundary.resetFailure ? consecutiveResetFailures + 1 : 0;
  appendProgress({
    timestamp: new Date().toISOString(), campaign_id: manifest.campaign_id, block_id: block.block_id,
    template_id: block.template_id, application: block.application, task_id: block.task_id, condition: block.condition,
    provider_model_stratum: currentProfile, required_arms: block.required_arms, arm_order: block.arm_order,
    controller_exit_code: result.code, full_three_arm_record_observed: boundary.fullThreeArmRecord,
    provider_failure_boundary: boundary.providerFailure, reset_failure_boundary: boundary.resetFailure,
    consecutive_provider_failures: consecutiveProviderFailures, consecutive_reset_failures: consecutiveResetFailures,
    status: boundary.fullThreeArmRecord ? 'executed-three-arm-block' : 'incomplete-controller-output'
  });
  if (consecutiveProviderFailures >= guardrails.max_consecutive_provider_failures) throw new Error(`Circuit breaker: ${consecutiveProviderFailures} consecutive provider-failure boundaries.`);
  if (consecutiveResetFailures >= guardrails.max_consecutive_reset_failures) throw new Error(`Circuit breaker: ${consecutiveResetFailures} consecutive reset-failure boundaries.`);
}

console.log(JSON.stringify({ status: 'batch-window-complete', campaign_id: manifest.campaign_id, selected_matched_blocks: selectedBlocks.length, planned_execution_units: selectedBlocks.length * 3, provider_model_stratum: currentProfile, estimated_reserved_provider_requests: authorisation.requiredRequests, progress: progressPath, confirmatory: false }));
