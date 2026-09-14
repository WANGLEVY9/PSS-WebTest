import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { appendAuthorizedConfirmatoryRecord } from '../../src/confirmatory-ledger.mjs';
import { createRunRecord } from '../../src/run-records.mjs';

const digest = () => 'a'.repeat(64);
const record = () => createRunRecord({
  schema_version: '1.0', run_id: 'formal-1', application_id: 'webarena', application_version: 'pinned', task_id: 'task-1', condition: 'clean-stable', arm: 'visual', status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean', timing: { wall_time_ms: 10, actions: 1, retries: 0 }, provenance: { runner_version: 'v1', observation_contract: 'screenshot-only', model_id: 'model', provider_id: 'provider', seed: 1, framework_id: 'framework', framework_version: '1.0', prompt_digest: digest(), action_schema_version: '1', code_framework: null, authoring_source: null, environment_digest: digest() }, configuration_id: 'visual-shared-model-m1', strategy_family: 'visual', protocol_version: '1.0', run_manifest_digest: digest(), sut_image_digest: digest(), reset_digest: digest(), randomization_block: 'block-1', benchmark_provenance: { benchmark_id: 'webarena-verified', source_commit: 'a'.repeat(40), task_source_id: 'task-1', task_manifest_digest: digest(), evaluator_digest: digest(), benchmark_artifact_manifest_digest: digest(), screening_manifest_digest: digest(), boundary_contract_digest: digest(), traditional_adaptation_digest: digest() }, trace: []
});

test('confirmatory writer rejects an unauthorized manifest', () => {
  assert.throws(() => appendAuthorizedConfirmatoryRecord(record(), { confirmatory_authorized: false }, path.join(os.tmpdir(), `pss-${Date.now()}.jsonl`)), /authorization is required/);
});

test('confirmatory writer appends only an authorized v1.0 record', () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pss-confirmatory-')), 'records.jsonl');
  const authorization = { confirmatory_authorized: true, status: 'frozen-confirmatory-authorized', manifest_hash: digest(), authorized_at: '2026-09-14T00:00:00Z' };
  appendAuthorizedConfirmatoryRecord(record(), authorization, output);
  const lines = fs.readFileSync(output, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).schema_version, '1.0');
});

test('confirmatory writer keeps pilot schema out of the formal ledger', () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pss-confirmatory-pilot-')), 'records.jsonl');
  const authorization = { confirmatory_authorized: true, status: 'frozen-confirmatory-authorized', manifest_hash: digest(), authorized_at: '2026-09-14T00:00:00Z' };
  const pilot = createRunRecord({ run_id: 'pilot-1', application_id: 'bookstack', application_version: 'local', task_id: 'task', condition: 'clean-stable', arm: 'visual', status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean', timing: { wall_time_ms: 1, actions: 1, retries: 0 }, provenance: { runner_version: 'pilot', observation_contract: 'screenshot-only' }, trace: [] });
  assert.throws(() => appendAuthorizedConfirmatoryRecord(pilot, authorization, output), /only schema_version 1.0/);
});
