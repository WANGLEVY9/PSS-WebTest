#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(codeRoot, 'config', 'phase2-long-run-execution-manifest.v0.1.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];
const expected = manifest.target.applications * manifest.target.workflows_per_application * manifest.target.conditions.length * manifest.target.primary_arms.length * manifest.target.repetitions_per_cell;
if (manifest.status !== 'planning-not-authorized') errors.push('manifest must remain planning-not-authorized');
if (manifest.target.matched_cells !== manifest.target.applications * manifest.target.workflows_per_application * manifest.target.conditions.length * manifest.target.primary_arms.length *  manifest.target.repetitions_per_cell / manifest.target.repetitions_per_cell) errors.push('matched_cells must equal application × workflow × condition × arm');
if (manifest.target.execution_units !== expected) errors.push(`execution_units=${manifest.target.execution_units} does not equal derived ${expected}`);
const ids = new Set();
for (const lane of manifest.lane_order ?? []) {
  if (ids.has(lane.id)) errors.push(`duplicate lane id: ${lane.id}`);
  ids.add(lane.id);
  if (!lane.tranche || !lane.exit_gate) errors.push(`lane ${lane.id} is missing tranche or exit_gate`);
}
for (const branch of manifest.branch_policy ?? []) {
  if (!branch.id || !branch.trigger || !branch.action || !branch.deny) errors.push(`branch ${branch.id ?? '<unknown>'} is incomplete`);
}
if (manifest.lane_order.at(-1)?.status !== 'blocked') errors.push('power-confirmatory lane must remain blocked');
if (manifest.lane_order.find((lane) => lane.id === 'L4-cross-application')?.status !== 'blocked-until-endpoints-admitted') errors.push('cross-application lane must remain blocked until endpoints are admitted');
if (manifest.next_batch?.confirmatory_authorized !== false) errors.push('next batch must not authorize confirmatory collection');
if (manifest.concurrency_contract.shared_sut_max_parallel_instances !== 1) errors.push('shared SUT concurrency must be serialized');
for (const field of ['run_id', 'campaign_id', 'application', 'workflow', 'condition', 'arm', 'provider', 'model', 'repetition', 'reset_digest', 'step_trace', 'oracle', 'failure_classification', 'protocol_completed', 'task_state_reached', 'oracle_only_success', 'cell_passed']) {
  if (!manifest.storage_contract.required_record_fields.includes(field)) errors.push(`required run-record field missing: ${field}`);
}
const result = {
  status: errors.length ? 'fail' : 'planning-valid-not-authorized',
  manifest: manifestPath,
  target: manifest.target,
  lane_status: manifest.lane_order.map(({ id, tranche, status }) => ({ id, tranche, status })),
  branch_count: manifest.branch_policy.length,
  next_batch: manifest.next_batch,
  errors
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
