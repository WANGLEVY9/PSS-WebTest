#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const planPath = path.join(codeRoot, 'config', 'long-cycle-experiment-plan.v1.0.json');

export function validateLongCycleExperimentPlan(plan) {
  const errors = [];
  if (plan?.schema_version !== '1.0') errors.push('schema_version must be 1.0');
  if (plan?.status !== 'planned-execution-paused') errors.push('plan must remain paused');
  if (plan?.current_state !== 'G0_COMPLETE_G1_PENDING') errors.push('current state must remain at G1 pending');
  if (plan?.confirmatory_authorized !== false) errors.push('confirmatory execution must not be authorized');
  if ((plan?.scale?.minimum_layer_a_scheduled_units ?? 0) < 3000) errors.push('Layer A scale floor must be at least 3000');
  if (plan?.scale?.units_per_task_repetition !== 5) errors.push('controlled core must have five units per task repetition');

  const layerA = (plan?.layers ?? []).find((layer) => layer.id === 'A-controlled-core');
  if (!layerA || layerA.role !== 'primary-confirmatory' || layerA.configurations?.length !== 5) errors.push('controlled core layer is incomplete');
  if (!layerA?.configurations?.includes('traditional-semantic-playwright')) errors.push('semantic Playwright primary baseline missing');
  const layerB = (plan?.layers ?? []).find((layer) => layer.id === 'B-implementation-robustness');
  if (!layerB || layerB.primary_denominator !== false || !layerB.candidate_extensions?.includes('selenium-webdriver')) errors.push('robustness layer must remain secondary and include a Traditional alternative');

  if (plan?.task_partition?.freeze_before_any_arm !== true || plan?.task_partition?.outcome_blind !== true) errors.push('task partition must be outcome-blind and pre-arm');
  if (plan?.task_partition?.pilot_excluded_from_primary_confirmatory_estimates !== true) errors.push('tuning pilot must stay outside primary confirmation');
  if ((plan?.task_partition?.screeners ?? 0) < 2) errors.push('two screeners are required');

  if (plan?.configuration_policy?.shared_models_across_visual_and_hybrid !== 2) errors.push('two shared model families are required in Layer A');
  if (plan?.configuration_policy?.admission_may_not_use_task_success !== true) errors.push('configuration admission cannot use task success');
  if ((plan?.configuration_policy?.provider_response_soak_minimum ?? 0) < 0.95) errors.push('provider soak threshold must be at least 95%');
  if ((plan?.configuration_policy?.provider_response_soak_minimum_requests_per_interface ?? 0) < 30) errors.push('provider soak must use at least 30 requests per interface');

  const candidates = plan?.repetition_policy?.candidate_confirmatory_repetitions ?? [];
  if ((plan?.repetition_policy?.pilot_repetitions ?? 0) < 5) errors.push('protocol pilot must use at least five repetitions');
  if (JSON.stringify(candidates) !== JSON.stringify([5, 7, 10])) errors.push('repetition candidates must remain 5, 7, 10');
  if ((plan?.repetition_policy?.power_target_primary ?? 0) < 0.9) errors.push('primary power target must be at least 90%');
  if (plan?.repetition_policy?.post_confirmatory_adaptive_increase !== false) errors.push('post-confirmatory adaptive sample increase is prohibited');

  if (plan?.scheduling?.pregenerated !== true || plan?.scheduling?.parallel_only_on_isolated_environment_shards !== true) errors.push('schedule and isolation policy is incomplete');
  if (plan?.failure_policy?.provider_or_model_failure_is_deployment_failure !== true) errors.push('provider/model failure must stay in deployment denominator');
  if (plan?.failure_policy?.performance_based_configuration_removal !== false) errors.push('performance-based configuration removal is prohibited');
  if (plan?.analysis?.single_weighted_score !== false || plan?.analysis?.within_model_visual_hybrid_contrasts !== true) errors.push('analysis separation or controlled contrast is incomplete');

  const expectedGates = Array.from({ length: 11 }, (_, index) => `G${index}`);
  const actualGates = (plan?.gates ?? []).map((gate) => gate.id);
  if (JSON.stringify(actualGates) !== JSON.stringify(expectedGates)) errors.push('gates must be ordered G0 through G10');
  if (plan?.gates?.[0]?.status !== 'complete' || plan?.gates?.[1]?.status !== 'pending') errors.push('only design freeze may be complete');
  if ((plan?.next_allowed_work ?? []).length < 8) errors.push('immediate implementation backlog is incomplete');
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if(!process.argv.includes('--legacy-audit')) {
    const {studyStatus}=await import('../local-lab/study-design.mjs');
    console.log(JSON.stringify({status:'active-manuscript-design-valid',...studyStatus()},null,2));
    process.exit(0);
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const errors = validateLongCycleExperimentPlan(plan);
  console.log(JSON.stringify({
    status: errors.length ? 'invalid' : 'long-cycle-plan-valid-execution-paused',
    plan: planPath,
    current_state: plan.current_state,
    layer_a_floor: plan.scale.minimum_layer_a_scheduled_units,
    gates: plan.gates.map((gate) => `${gate.id}:${gate.status}`),
    confirmatory_authorized: plan.confirmatory_authorized,
    errors
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}
