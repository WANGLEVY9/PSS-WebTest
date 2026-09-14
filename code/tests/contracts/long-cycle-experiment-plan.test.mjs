import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateLongCycleExperimentPlan } from '../../scripts/validate-long-cycle-experiment-plan.mjs';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const plan = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config', 'long-cycle-experiment-plan.v1.0.json'), 'utf8'));

test('long-cycle plan is valid, paused, and blocks confirmatory collection', () => {
  assert.deepEqual(validateLongCycleExperimentPlan(plan), []);
  assert.equal(plan.current_state, 'G0_COMPLETE_G1_PENDING');
  assert.equal(plan.confirmatory_authorized, false);
  assert.equal(plan.gates.find((gate) => gate.id === 'G8').status, 'blocked-by-G7');
});

test('controlled core separates model-matched abstraction contrasts from robustness extensions', () => {
  const core = plan.layers.find((layer) => layer.id === 'A-controlled-core');
  const robustness = plan.layers.find((layer) => layer.id === 'B-implementation-robustness');
  assert.equal(core.configurations.length, 5);
  assert.match(core.weighting, /equal-weight/);
  assert.equal(robustness.primary_denominator, false);
  assert.ok(robustness.candidate_extensions.includes('selenium-webdriver'));
});

test('task partition, repetition selection, and failure rules are outcome independent', () => {
  assert.equal(plan.task_partition.freeze_before_any_arm, true);
  assert.equal(plan.task_partition.outcome_blind, true);
  assert.equal(plan.task_partition.pilot_excluded_from_primary_confirmatory_estimates, true);
  assert.equal(plan.repetition_policy.pilot_repetitions, 5);
  assert.deepEqual(plan.repetition_policy.candidate_confirmatory_repetitions, [5, 7, 10]);
  assert.equal(plan.repetition_policy.post_confirmatory_adaptive_increase, false);
  assert.equal(plan.failure_policy.performance_based_configuration_removal, false);
  assert.equal(plan.failure_policy.provider_or_model_failure_is_deployment_failure, true);
});

test('scale floor complements rather than replaces power', () => {
  assert.equal(plan.scale.minimum_layer_a_scheduled_units, 3000);
  assert.equal(plan.scale.units_per_task_repetition, 5);
  assert.equal(plan.scale.scale_is_not_power_substitute, true);
  assert.equal(plan.repetition_policy.power_target_primary, 0.9);
  assert.equal(plan.configuration_policy.provider_response_soak_minimum_requests_per_interface, 30);
});
