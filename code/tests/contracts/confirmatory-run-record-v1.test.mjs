import assert from 'node:assert/strict';
import test from 'node:test';
import { createRunRecord, validateRunRecord } from '../../src/run-records.mjs';

const digest = (character) => character.repeat(64);
const v10Record = () => ({
  schema_version: '1.0',
  run_id: 'schema-v10-smoke-001',
  application_id: 'webarena',
  application_version: 'pinned-local-image',
  task_id: 'official-task-42',
  condition: 'clean-stable',
  arm: 'visual',
  status: 'timeout',
  checkpoint_reached: false,
  independent_oracle_passed: null,
  emitted_verdict: 'not-emitted',
  ground_truth_verdict: 'not-scored',
  timing: { wall_time_ms: 1200, actions: 2, retries: 0, tokens: 12, cost_usd: 0.01 },
  provenance: {
    runner_version: 'schema-contract-test', trace_hash: digest('a'), observation_contract: 'screenshot-only',
    model_id: 'example-vision-model', seed: 17, framework_id: 'example-cua', framework_version: '1.0.0',
    provider_id: 'example-provider', prompt_digest: digest('b'), action_schema_version: 'v1',
    code_framework: null, authoring_source: null, environment_digest: digest('c')
  },
  failure_category: 'provider-timeout',
  configuration_id: 'visual-schema-test',
  strategy_family: 'visual',
  protocol_version: 'study-design-v1.0',
  run_manifest_digest: digest('d'), sut_image_digest: digest('e'), reset_digest: digest('f'), randomization_block: 'pilot-block-001',
  benchmark_provenance: {
    benchmark_id: 'webarena-verified', source_commit: '6473f72db5dcefc97b5725b59e734504edc28a21', task_source_id: 'task:42',
    task_manifest_digest: digest('1'), evaluator_digest: digest('2'), benchmark_artifact_manifest_digest: digest('3'),
    screening_manifest_digest: digest('4'), boundary_contract_digest: digest('5'), traditional_adaptation_digest: digest('6')
  }
});

test('v1.0 record binds an outcome to source, evaluator, screening, boundary, and Traditional-adaptation digests', () => {
  const record = createRunRecord({ ...v10Record(), trace: [] });
  assert.equal(record.schema_version, '1.0');
  assert.equal(record.benchmark_provenance.benchmark_id, 'webarena-verified');
  assert.equal(record.benchmark_provenance.traditional_adaptation_digest, digest('6'));
});

test('v1.0 record rejects a missing task-screening digest or undocumented provenance field', () => {
  const missing = v10Record();
  delete missing.benchmark_provenance.screening_manifest_digest;
  assert.throws(() => validateRunRecord(missing), /screening_manifest_digest/);
  const extra = v10Record();
  extra.benchmark_provenance.evaluator_outcome = 'pass';
  assert.throws(() => validateRunRecord(extra), /unsupported field/);
});
