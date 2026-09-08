#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const planPath = path.join(codeRoot, 'config/phase2-scaling-plan.v0.1.json');

export function validateScalingPlan(plan) {
  const errors = [];
  if (plan?.schema_version !== '0.1') errors.push('schema_version must be 0.1');
  if (plan?.status !== 'pre-collection') errors.push('status must preserve pre-collection boundary');
  const panelById = new Map();
  for (const panel of plan?.near_term_panels ?? []) {
    if (panelById.has(panel.id)) errors.push(`duplicate panel id ${panel.id}`);
    panelById.set(panel.id, panel);
    const dimensions = panel.id === 'P1-existing-sut-reference'
      ? [panel.applications?.length, panel.workflows_per_application, panel.conditions?.length, panel.configuration_count, panel.repetitions]
      : panel.id === 'P2-sentinel-generalisation'
      ? [panel.sentinel_workflows, panel.conditions?.length, panel.additional_configuration_count, panel.repetitions]
      : panel.id === 'P3-reliability-drift-sentinel'
      ? [panel.sentinel_cells, panel.configuration_count, panel.repetitions_per_window, panel.time_windows]
      : null;
    if (!dimensions || dimensions.some((value) => !Number.isInteger(value) || value < 1)) {
      errors.push(`${panel.id} has invalid sampling dimensions`);
    } else if (dimensions.reduce((product, value) => product * value, 1) !== panel.expected_runs) {
      errors.push(`${panel.id}.expected_runs does not equal its declared sampling dimensions`);
    }
  }
  for (const id of ['P1-existing-sut-reference', 'P2-sentinel-generalisation', 'P3-reliability-drift-sentinel']) if (!panelById.has(id)) errors.push(`missing ${id}`);
  const primary = panelById.get('P1-existing-sut-reference');
  if (primary && (!primary.conditions.includes('functional-fault') || !primary.conditions.includes('ui-evolved'))) errors.push('P1 must include fault and evolution rather than only clean repetitions');
  const target = plan?.confirmatory_target;
  if (!target || target.reference_panel_runs !== target.core_applications * target.workflows_per_application * target.reference_conditions.length * target.reference_configuration_count * target.repetitions) errors.push('confirmatory reference_panel_runs is inconsistent');
  if (!target || target.target_total_run_range?.[0] < target.reference_panel_runs + target.generalisation_panel_minimum_runs + target.external_replication_minimum_runs) errors.push('confirmatory target range is lower than its required panels');
  if (!Array.isArray(plan?.non_substitution_rules) || plan.non_substitution_rules.length < 3) errors.push('non_substitution_rules must remain explicit');
  return errors;
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const errors = validateScalingPlan(plan);
if (errors.length) {
  console.error(`Phase 2 scaling plan validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const total = plan.near_term_panels.reduce((sum, panel) => sum + panel.expected_runs, 0);
  console.log(`Phase 2 scaling plan validation passed: ${plan.near_term_panels.length} near-term panels, ${total} planned runs, confirmatory target ${plan.confirmatory_target.target_total_run_range.join('-')}.`);
}
