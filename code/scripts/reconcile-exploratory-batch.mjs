#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readBlockPilotSummary } from '../src/exploratory-batch-artifacts.mjs';
import { classifyControllerBoundary } from '../src/exploratory-batch-guards.mjs';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = process.env.PSS_BATCH_MANIFEST ? path.resolve(process.env.PSS_BATCH_MANIFEST) : path.join(codeRoot, '..', 'artifacts/phase2', `phase2-exploratory-500-blocks-v1-${`${process.env.CUA_PROVIDER ?? ''}/${process.env.CUA_MODEL ?? ''}`.replace(/[^a-zA-Z0-9._-]+/g, '-')}-manifest.json`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const artifactRoot = path.join(codeRoot, '..', 'artifacts/phase2');
const observed = [];
for (const block of manifest.blocks ?? []) {
  const tag = `exploratory-500-${String(block.block_ordinal).padStart(4, '0')}`;
  const evidence = readBlockPilotSummary({ artifactRoot, runTag: tag, requiredArms: block.required_arms });
  if (!evidence) continue;
  const boundary = classifyControllerBoundary({ code: null, stdout: '', stderr: '', records: evidence.records });
  observed.push({ block_id: block.block_id, template_id: block.template_id, application: block.application, task_id: block.task_id, condition: block.condition, summary_artifact: evidence.summaryPath, observed_arms: evidence.observedArms, full_three_arm_record_observed: evidence.fullThreeArmRecord, strict_passed_cells: evidence.strictPassedCells, total_cells: evidence.totalCells, provider_failure_boundary: boundary.providerFailure, reset_failure_boundary: boundary.resetFailure });
}
const reconciliation = {
  schema_version: '0.1', campaign_id: manifest.campaign_id, reconciled_at: new Date().toISOString(), collection_class: manifest.collection_class,
  status: 'exploratory-canary-reconciliation', confirmatory: false, observed_matched_blocks: observed.length,
  full_three_arm_blocks: observed.filter((block) => block.full_three_arm_record_observed).length,
  all_three_arms_strictly_passed_blocks: observed.filter((block) => block.strict_passed_cells === 3).length,
  blocks: observed
};
const outputPath = process.env.PSS_BATCH_RECONCILIATION_OUT ? path.resolve(process.env.PSS_BATCH_RECONCILIATION_OUT) : path.join(artifactRoot, `${manifest.campaign_id}-${manifest.provider_model_stratum.replace(/[^a-zA-Z0-9._-]+/g, '-')}-reconciliation.json`);
fs.writeFileSync(outputPath, `${JSON.stringify(reconciliation, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ status: reconciliation.status, output: outputPath, observed_matched_blocks: reconciliation.observed_matched_blocks, full_three_arm_blocks: reconciliation.full_three_arm_blocks, all_three_arms_strictly_passed_blocks: reconciliation.all_three_arms_strictly_passed_blocks, confirmatory: false }));
