import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const file = path.join(root, 'config', 'phase2-campaign-tranches.v0.1.json');
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const target = config.primary_target;
const expected = target.applications * target.workflows_per_application * target.conditions.length * target.strategies.length * target.repetitions_per_cell;
if (expected !== target.execution_units) errors.push(`execution_units=${target.execution_units} does not equal derived ${expected}`);
if (config.current_inventory.triage_queue_candidates > target.applications) errors.push('triage queue exceeds application target');
if (config.current_inventory.matrix_workflow_bearing_applications > target.applications) errors.push('workflow-bearing application count exceeds target');
if (config.current_inventory.confirmatory_admitted_applications > config.current_inventory.matrix_workflow_bearing_applications) errors.push('admitted applications exceed workflow-bearing applications');
if (config.current_inventory.confirmatory_admitted_workflows > config.current_inventory.confirmatory_admitted_applications * target.workflows_per_application) errors.push('admitted workflows exceed admitted application capacity');
const t4 = config.tranches.find((tranche) => tranche.id === 'T4');
const t5 = config.tranches.find((tranche) => tranche.id === 'T5');
if (t4?.status !== 'blocked-until-endpoints-admitted') errors.push('T4 must remain blocked until endpoints are admitted');
if (t5?.status !== 'blocked') errors.push('T5 must remain blocked before power/confirmatory freeze');
if (!config.provider_strata.some((profile) => profile.status === 'blocked-by-provider-readiness')) errors.push('blocked provider stratum is missing');
if (!config.non_substitution_rules?.length) errors.push('non-substitution rules are required');
const result = {
  status: errors.length ? 'fail' : 'planning-valid-not-authorized',
  file,
  derived_execution_units: expected,
  target_execution_units: target.execution_units,
  inventory: config.current_inventory,
  tranches: config.tranches.map(({ id, status }) => ({ id, status })),
  errors
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
