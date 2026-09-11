import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const planPath = path.join(root, 'config', 'phase2-3000plus-multifactor-plan.v0.1.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const errors = [];

const scale = plan.scale_contract;
const core = scale.admitted_application_minimum * scale.workflows_per_admitted_application * scale.conditions_per_workflow * scale.primary_strategies_per_cell * scale.minimum_repetitions_per_arm_condition;
const confirmatory = scale.admitted_application_minimum * scale.workflows_per_admitted_application * scale.conditions_per_workflow * scale.primary_strategies_per_cell * scale.confirmatory_repetitions_per_arm_condition;

if (plan.status !== 'planning-not-authorized') errors.push('plan must remain planning-not-authorized until admission gates pass');
if (plan.evidence_boundary?.includes('not empirical observations') !== true) errors.push('evidence boundary must distinguish design from observations');
if (scale.admitted_application_minimum < 30) errors.push('admitted application minimum must be at least 30');
if (core !== scale.minimum_core_executions) errors.push(`minimum_core_executions mismatch: expected ${core}, found ${scale.minimum_core_executions}`);
if (confirmatory !== scale.confirmatory_core_executions) errors.push(`confirmatory_core_executions mismatch: expected ${confirmatory}, found ${scale.confirmatory_core_executions}`);
if (scale.minimum_core_executions <= 3000) errors.push('minimum core cohort must exceed 3000 executions');
if (scale.confirmatory_repetitions_per_arm_condition < scale.minimum_repetitions_per_arm_condition) errors.push('confirmatory repetitions must be no smaller than pilot minimum');

const lengths = plan.task_stratification.length_bands ?? [];
for (const id of ['short', 'medium', 'long']) if (!lengths.some((band) => band.id === id)) errors.push(`missing length band: ${id}`);
for (const id of ['single-goal', 'sequential-multi-goal', 'dependent-multi-goal']) if (!plan.task_stratification.goal_cardinality.some((goal) => goal.id === id)) errors.push(`missing goal cardinality: ${id}`);
for (const id of ['single-app-single-page', 'single-app-cross-page', 'cross-app-handoff', 'multi-app-workflow']) if (!plan.task_stratification.scope_levels.some((scope) => scope.id === id)) errors.push(`missing scope level: ${id}`);

if (plan.primary_arms.length !== 3) errors.push('exactly three primary arms are required');
if (!plan.analysis_contract.no_universal_winner) errors.push('analysis contract must not presuppose a universal winner');
if (plan.current_registry_boundary.currently_admitted_applications !== 0) errors.push('current admitted application count must remain zero until gates pass');
if ((plan.current_registry_boundary.named_application_rows_now + plan.current_registry_boundary.additional_application_slots_required) < scale.admitted_application_minimum) errors.push('named rows plus expansion slots do not reach the application minimum');

if (errors.length) {
  console.error(JSON.stringify({ status: 'invalid', errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'valid',
  plan_id: plan.plan_id,
  evidence_boundary: plan.evidence_boundary,
  minimum_core_executions: scale.minimum_core_executions,
  confirmatory_core_executions: scale.confirmatory_core_executions,
  admitted_applications: plan.current_registry_boundary.currently_admitted_applications,
  named_application_rows_now: plan.current_registry_boundary.named_application_rows_now,
  additional_application_slots_required: plan.current_registry_boundary.additional_application_slots_required,
  no_universal_winner: plan.analysis_contract.no_universal_winner
}, null, 2));
