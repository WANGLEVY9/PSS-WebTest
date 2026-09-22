import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/phase2-long-run-execution-manifest.v0.1.json'), 'utf8'));

test('legacy long-run manifest preserves its arithmetic while remaining superseded and paused', () => {
  const target = manifest.target;
  const cells = target.applications * target.workflows_per_application * target.conditions.length * target.primary_arms.length;
  assert.equal(target.matched_cells, cells);
  assert.equal(target.execution_units, cells * target.repetitions_per_cell);
  assert.equal(manifest.status, 'paused-superseded-by-study-design-v1.0');
  assert.equal(manifest.superseded_by, 'code/config/study-design-contract.v1.0.json');
  assert.equal(manifest.next_batch.confirmatory_authorized, false);
  assert.equal(manifest.next_batch.campaign_class, 'none-study-design-freeze');
  assert.deepEqual(manifest.next_batch.applications, []);
});

test('long-run manifest keeps cross-app and confirmatory lanes blocked', () => {
  const lanes = new Map(manifest.lane_order.map((lane) => [lane.id, lane]));
  assert.equal(lanes.get('L4-cross-application').status, 'blocked-until-endpoints-admitted');
  assert.equal(lanes.get('L5-power-confirmatory').status, 'blocked');
  assert.equal(manifest.concurrency_contract.shared_sut_max_parallel_instances, 1);
});

test('long-run manifest enumerates branch and run-record guardrails', () => {
  assert.ok(manifest.branch_policy.length >= 5);
  for (const field of ['run_id', 'reset_digest', 'step_trace', 'oracle', 'failure_classification', 'cell_passed']) {
    assert.ok(manifest.storage_contract.required_record_fields.includes(field), `missing ${field}`);
  }
});
