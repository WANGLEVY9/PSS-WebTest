import test from 'node:test';
import assert from 'node:assert/strict';
import { createTraditionalRunRecord } from '../../src/traditional-run-record.mjs';

test('traditional helper emits the same ledger schema as agent arms', () => {
  const record = createTraditionalRunRecord({
    application_id: 'bookstack',
    application_version: '24.10.1',
    task_id: 'bookstack-create-page',
    execution_exit_code: 0,
    oracle: { passed: true },
    wall_time_ms: 1234.6,
    actions: 11
  });
  assert.equal(record.arm, 'playwright');
  assert.equal(record.status, 'completed');
  assert.equal(record.timing.wall_time_ms, 1235);
  assert.equal(record.timing.actions, 11);
  assert.equal(record.provenance.observation_contract, 'scripted-locator');
  assert.equal(record.provenance.model_id, null);
  assert.equal(record.independent_oracle_passed, true);
});

test('traditional helper preserves failed execution as a non-success record', () => {
  const record = createTraditionalRunRecord({
    application_id: 'juice-shop',
    application_version: '20.0.0',
    task_id: 'juice-shop-product-search',
    execution_exit_code: 1,
    oracle: { passed: false },
    wall_time_ms: 100,
    actions: 5
  });
  assert.equal(record.status, 'test-failure');
  assert.equal(record.checkpoint_reached, false);
  assert.equal(record.failure_category, 'execution');
});

test('traditional helper can record an independently verified fault verdict', () => {
  const record = createTraditionalRunRecord({
    application_id: 'bookstack', application_version: '24.10.1', task_id: 'bookstack-create-page',
    execution_exit_code: 0, oracle: { passed: true }, wall_time_ms: 100, actions: 11,
    expected_verdict: 'fault'
  });
  assert.equal(record.checkpoint_reached, true);
  assert.equal(record.emitted_verdict, 'fault');
  assert.equal(record.ground_truth_verdict, 'fault');
});

test('traditional helper preserves registry-resolved v0.2 provenance', () => {
  const record = createTraditionalRunRecord({
    application_id: 'juice-shop', application_version: '20.0.0', task_id: 'juice-shop-product-search',
    execution_exit_code: 0, oracle: { passed: true }, wall_time_ms: 100, actions: 5,
    phase2Fields: {
      schema_version: '0.2', configuration_id: 'scripted-playwright-accessibility-human-v2', strategy_family: 'scripted',
      protocol_version: '2.0-draft', run_manifest_digest: 'a'.repeat(64), sut_image_digest: 'b'.repeat(64),
      reset_digest: 'c'.repeat(64), randomization_block: 'juice-shop-search-clean-r01-playwright',
      provenance: {
        framework_id: 'playwright', framework_version: '1.55', provider_id: null, model_id: null,
        prompt_digest: null, action_schema_version: null, code_framework: 'playwright-accessibility-locator',
        authoring_source: 'human', environment_digest: 'd'.repeat(64)
      }
    }
  });
  assert.equal(record.schema_version, '0.2');
  assert.equal(record.configuration_id, 'scripted-playwright-accessibility-human-v2');
  assert.equal(record.provenance.runner_version, 'playwright-traditional-cell-v0.1');
  assert.equal(record.provenance.provider_id, null);
});
