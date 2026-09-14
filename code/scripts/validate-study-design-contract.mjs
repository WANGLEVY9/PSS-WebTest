#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const contractPath = path.join(codeRoot, 'config', 'study-design-contract.v1.0.json');

export function validateStudyDesignContract(contract) {
  const errors = [];
  if (contract?.schema_version !== '1.0') errors.push('schema_version must be 1.0');
  if (contract?.status !== 'candidate-final-awaiting-human-confirmation') errors.push('status must remain candidate-final-awaiting-human-confirmation before explicit approval');
  if (contract?.execution_status !== 'paused') errors.push('experiment execution must remain paused during design confirmation');
  if (contract?.confirmatory_authorized !== false) errors.push('confirmatory collection must not be authorized');

  const mandatory = contract?.benchmark_portfolio?.mandatory_core ?? [];
  const mandatoryIds = new Set(mandatory.map((item) => item.id));
  for (const id of ['webarena-verified', 'visualwebarena', 'autonomous-tester-agent-benchmark']) {
    if (!mandatoryIds.has(id)) errors.push(`mandatory benchmark missing: ${id}`);
  }
  if (mandatoryIds.size !== mandatory.length) errors.push('mandatory benchmark IDs must be unique');
  for (const benchmark of mandatory) {
    if (!benchmark.official_repository || !benchmark.selection_status?.includes('pending')) errors.push(`mandatory benchmark ${benchmark.id} must retain repository and pre-execution pin status`);
  }

  const filtering = contract?.task_filtering;
  const inclusionCodes = new Set((filtering?.inclusion_criteria ?? []).map((item) => item.code));
  const exclusionCodes = new Set((filtering?.exclusion_reasons ?? []).map((item) => item.code));
  for (let i = 1; i <= 7; i += 1) if (!inclusionCodes.has(`IC${i}`)) errors.push(`missing inclusion criterion IC${i}`);
  for (let i = 1; i <= 8; i += 1) if (!exclusionCodes.has(`EX${i}`)) errors.push(`missing exclusion reason EX${i}`);
  if (filtering?.outcome_blind !== true || filtering?.screen_before_any_arm_execution !== true) errors.push('task screening must be outcome-blind and precede arm execution');
  if ((filtering?.forbidden_exclusion_reasons ?? []).length < 4) errors.push('performance-dependent exclusion guardrails are incomplete');
  if (filtering?.sampling?.freeze_before_execution !== true || !Number.isInteger(filtering?.sampling?.random_seed)) errors.push('sampling seed and pre-execution freeze are required');
  if ((filtering?.screening?.reviewers ?? 0) < 2 || filtering?.screening?.adjudication_required !== true) errors.push('two-reviewer screening and adjudication are required');

  const boundaries = contract?.information_boundaries;
  for (const arm of ['pure_visual_cua', 'hybrid_agent', 'traditional_scripted_test']) {
    if (!boundaries?.[arm]) errors.push(`information boundary missing: ${arm}`);
  }
  const visualForbidden = new Set(boundaries?.pure_visual_cua?.disallowed ?? []);
  for (const item of ['raw DOM', 'accessibility tree', 'benchmark evaluator state', 'database or API ground truth']) {
    if (!visualForbidden.has(item)) errors.push(`pure visual disallowed boundary missing: ${item}`);
  }
  const hybridForbidden = new Set(boundaries?.hybrid_agent?.disallowed ?? []);
  for (const item of ['raw HTML', 'CSS selectors', 'XPath', 'benchmark evaluator state']) {
    if (!hybridForbidden.has(item)) errors.push(`hybrid disallowed boundary missing: ${item}`);
  }
  if (boundaries?.independent_evaluator?.official_evaluator_unchanged !== true || boundaries?.independent_evaluator?.agent_or_script_self_verdict_is_not_ground_truth !== true) errors.push('independent evaluator boundary is incomplete');
  if (boundaries?.enforcement?.boundary_violation_invalidates_run !== true) errors.push('information-boundary violation must invalidate a run');

  const traditional = contract?.traditional_adaptation;
  if (traditional?.review?.minimum_reviewers < 2 || traditional?.review?.author_blind_to_agent_results !== true || traditional?.review?.reviewer_blind_to_agent_results !== true) errors.push('Traditional adaptation must be double-reviewed and blind to agent outcomes');
  if (traditional?.adaptation_failure_policy?.includes('do not exclude') !== true) errors.push('Traditional adaptation failure must remain in the denominator');
  for (const field of ['authoring_minutes', 'debugging_minutes', 'review_minutes', 'loc', 'locator_count', 'assertion_count', 'debug_edit_count']) {
    if (!(traditional?.required_cost_fields ?? []).includes(field)) errors.push(`Traditional cost field missing: ${field}`);
  }

  if ((contract?.outcomes?.primary ?? []).length < 2) errors.push('primary effectiveness and testing-verdict outcomes are required');
  if (contract?.outcomes?.single_composite_score !== 'prohibited') errors.push('single composite score must remain prohibited');
  if (contract?.implementation_readiness?.ready_for_new_evaluated_runs !== false) errors.push('new evaluated runs must remain blocked until implementation gaps close');
  if ((contract?.implementation_readiness?.blocking_gaps ?? []).length < 5) errors.push('implementation gap register is incomplete');
  if ((contract?.freeze_gates ?? []).length < 8) errors.push('freeze gate list is incomplete');
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const errors = validateStudyDesignContract(contract);
  console.log(JSON.stringify({
    status: errors.length ? 'invalid' : 'design-valid-execution-paused',
    contract: contractPath,
    benchmark_core: contract.benchmark_portfolio.mandatory_core.map((item) => item.id),
    conditional_extension: contract.benchmark_portfolio.conditional_extension.map((item) => item.id),
    inclusion_criteria: contract.task_filtering.inclusion_criteria.length,
    exclusion_reasons: contract.task_filtering.exclusion_reasons.length,
    execution_status: contract.execution_status,
    confirmatory_authorized: contract.confirmatory_authorized,
    errors
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}
