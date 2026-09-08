#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const defaultPlanPath = path.join(codeRoot, 'config/exploratory-500-block-campaign.v0.1.json');

export function validateExploratoryBatchPlan(plan) {
  const errors = [];
  if (plan?.schema_version !== '0.1') errors.push('schema_version must be 0.1');
  if (plan?.status !== 'preflight-required') errors.push('status must preserve the preflight-required boundary');
  if (plan?.collection_class !== 'exploratory-reliability-and-failure-taxonomy') errors.push('collection_class must preserve the exploratory boundary');
  if (plan?.unit_of_collection !== 'one matched block containing exactly visual, hybrid, and playwright executions') errors.push('unit_of_collection must define an exact three-arm matched block');
  if (!Number.isInteger(plan?.target_matched_blocks) || plan.target_matched_blocks < 500) errors.push('target_matched_blocks must be an integer of at least 500');
  if (plan?.target_execution_units !== plan?.target_matched_blocks * 3) errors.push('target_execution_units must equal target_matched_blocks times three arms');
  const expectedArms = ['visual', 'hybrid', 'playwright'];
  if (!Array.isArray(plan?.arms) || plan.arms.length !== expectedArms.length || expectedArms.some((arm) => !plan.arms.includes(arm))) errors.push('arms must contain exactly visual, hybrid, playwright');
  const guardrails = plan?.resource_guardrails;
  if (!Number.isInteger(guardrails?.max_agent_decisions_per_block) || guardrails.max_agent_decisions_per_block < 2) errors.push('resource_guardrails.max_agent_decisions_per_block must be a positive integer');
  if (!Number.isInteger(guardrails?.max_consecutive_provider_failures) || guardrails.max_consecutive_provider_failures < 1) errors.push('resource_guardrails.max_consecutive_provider_failures must be a positive integer');
  if (!Number.isInteger(guardrails?.max_consecutive_reset_failures) || guardrails.max_consecutive_reset_failures < 1) errors.push('resource_guardrails.max_consecutive_reset_failures must be a positive integer');
  if (guardrails?.requires_explicit_provider_request_cap !== true || guardrails?.requires_explicit_wall_time_cap !== true || guardrails?.requires_local_sut_health_gate !== true) errors.push('resource guardrails must remain fail-closed');
  const templateIds = new Set();
  for (const template of plan?.currently_wired_block_templates ?? []) {
    if (!template?.id || templateIds.has(template.id)) errors.push(`invalid or duplicate block template: ${template?.id ?? 'unknown'}`);
    templateIds.add(template?.id);
    if (!template?.application || !template?.task_id || !template?.condition || !template?.controller) errors.push(`block template ${template?.id ?? 'unknown'} is incomplete`);
  }
  if (templateIds.size < 3) errors.push('at least three independently named wired templates are required for a reliability campaign');
  if (!Array.isArray(plan?.protocol_boundary) || plan.protocol_boundary.length < 3) errors.push('protocol_boundary must state evidence exclusions');
  if (!Array.isArray(plan?.coverage_gaps_before_conditional_claims) || plan.coverage_gaps_before_conditional_claims.length < 3) errors.push('coverage gaps must remain explicit');
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const planPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPlanPath;
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const errors = validateExploratoryBatchPlan(plan);
  if (errors.length) {
    console.error(`Exploratory batch campaign validation failed (${errors.length} error(s))`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Exploratory batch campaign validation passed: ${plan.target_matched_blocks} matched blocks, ${plan.target_execution_units} execution units, ${plan.currently_wired_block_templates.length} currently wired templates.`);
  }
}
