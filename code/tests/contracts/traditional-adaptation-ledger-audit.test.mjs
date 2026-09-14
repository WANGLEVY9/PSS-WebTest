import assert from 'node:assert/strict';
import test from 'node:test';
import { auditTraditionalAdaptationLedger } from '../../scripts/validate-traditional-adaptation-ledger.mjs';

const digest = 'a'.repeat(64);
const included = [{ benchmark: 'webarena-verified', benchmark_version: 'b'.repeat(40), task_id: 't1', task_instruction_digest: digest }];
const row = { benchmark: included[0].benchmark, benchmark_version: included[0].benchmark_version, task_id: included[0].task_id, official_instruction_digest: digest, author_pseudonym: 'R1', script_path: 'scripts/t1.mjs', script_hash: 'c'.repeat(64), authoring_minutes: '10', debugging_minutes: '2', review_minutes: '3', loc: '20', locator_count: '4', assertion_count: '2', debug_edit_count: '1', semantic_review_status: 'PASS', black_box_conformance_status: 'PASS', freeze_timestamp: '2026-09-14T00:00:00Z', notes: 'blind review' };

test('Traditional adaptation audit remains blocked while screening has no included tasks', () => {
  const result = auditTraditionalAdaptationLedger({ includedTasks: [], adaptationRows: [] });
  assert.equal(result.status, 'blocked-by-screening');
  assert.equal(result.confirmatory_authorized, false);
});

test('Traditional adaptation audit requires one complete row per included task', () => {
  const result = auditTraditionalAdaptationLedger({ includedTasks: included, adaptationRows: [row] });
  assert.equal(result.status, 'traditional-adaptation-complete-pending-script-freeze');
  assert.deepEqual(result.errors, []);
});

test('Traditional adaptation failures remain represented rather than deleting the task', () => {
  const result = auditTraditionalAdaptationLedger({ includedTasks: included, adaptationRows: [{ ...row, semantic_review_status: 'FAIL', black_box_conformance_status: 'FAIL', notes: 'adaptation failed; retain in denominator' }] });
  assert.equal(result.status, 'traditional-adaptation-complete-pending-script-freeze');
  assert.deepEqual(result.errors, []);
});
