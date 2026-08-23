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
