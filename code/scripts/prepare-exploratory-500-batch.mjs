#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateExploratoryBatchPlan } from './validate-exploratory-batch-plan.mjs';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const planPath = path.join(codeRoot, 'config/exploratory-500-block-campaign.v0.1.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const errors = validateExploratoryBatchPlan(plan);
if (errors.length) throw new Error(`Invalid campaign plan:\n${errors.join('\n')}`);

const requestedBlocks = Number.parseInt(process.env.PSS_BATCH_MATCHED_BLOCKS ?? String(plan.target_matched_blocks), 10);
if (!Number.isInteger(requestedBlocks) || requestedBlocks < plan.target_matched_blocks) throw new Error(`PSS_BATCH_MATCHED_BLOCKS must be an integer of at least ${plan.target_matched_blocks}`);
const seed = process.env.PSS_BATCH_RANDOMIZATION_SEED ?? plan.id;
const profile = `${process.env.CUA_PROVIDER ?? ''}/${process.env.CUA_MODEL ?? ''}`;
if (profile === '/') throw new Error('CUA_PROVIDER and CUA_MODEL must be configured before preparing a provider-stratified batch');

const blocks = Array.from({ length: requestedBlocks }, (_, index) => {
  const template = plan.currently_wired_block_templates[index % plan.currently_wired_block_templates.length];
  const ordinal = index + 1;
  const armOrder = [...plan.arms].sort((left, right) => crypto.createHash('sha256').update(`${seed}|${ordinal}|${left}`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${seed}|${ordinal}|${right}`).digest('hex')));
  return {
    block_ordinal: ordinal,
    block_id: `${plan.id}-${String(ordinal).padStart(4, '0')}`,
    template_id: template.id,
    application: template.application,
    task_id: template.task_id,
    condition: template.condition,
    controller: template.controller,
    admission: template.admission,
    provider_model_stratum: profile,
    arm_order: armOrder,
    required_arms: plan.arms,
    status: 'scheduled-not-executed'
  };
});

const estimatedProviderRequests = requestedBlocks * plan.resource_guardrails.max_agent_decisions_per_block;
const summary = {
  schema_version: '0.1',
  campaign_id: plan.id,
  generated_at: new Date().toISOString(),
  collection_class: plan.collection_class,
  status: 'prepared-not-authorized-for-execution',
  target_matched_blocks: requestedBlocks,
  target_execution_units: requestedBlocks * plan.arms.length,
  provider_model_stratum: profile,
  estimated_max_provider_requests: estimatedProviderRequests,
  guardrails: plan.resource_guardrails,
  coverage_warning: 'This schedule recycles only currently wired pilot templates. It is a reliability/failure-taxonomy campaign, not the broad condition-boundary dataset.',
  blocks
};

const outputPath = process.env.PSS_BATCH_MANIFEST_OUT
  ? path.resolve(process.env.PSS_BATCH_MANIFEST_OUT)
  : path.join(codeRoot, '..', 'artifacts/phase2', `${plan.id}-${profile.replace(/[^a-zA-Z0-9._-]+/g, '-')}-manifest.json`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });

console.log(JSON.stringify({
  status: summary.status,
  manifest: outputPath,
  target_matched_blocks: summary.target_matched_blocks,
  target_execution_units: summary.target_execution_units,
  provider_model_stratum: summary.provider_model_stratum,
  estimated_max_provider_requests: summary.estimated_max_provider_requests,
  execution_requires: ['PSS_BATCH_MAX_PROVIDER_REQUESTS', 'PSS_BATCH_MAX_WALL_MINUTES', 'healthy local SUTs', 'provider-specific canary admission']
}));
