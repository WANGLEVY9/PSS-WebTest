import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScreeningLedgerTemplate } from '../../scripts/prepare-screening-ledger.mjs';

test('screening ledger template covers every candidate and criterion without making decisions', async () => {
  const template = buildScreeningLedgerTemplate();
  assert.equal(template.status, 'screening-template-not-started');
  assert.equal(template.confirmatory_authorized, false);
  assert.equal(template.candidate_count, 1834);
  assert.equal(template.criterion_count, 7);
  assert.equal(template.screening_row_count, 1834 * 7);
  assert.ok(template.screening_rows.every((row) => row.reviewer_1_decision === null && row.reviewer_2_decision === null && row.adjudicated_decision === null));
  assert.ok(template.task_annotations.every((row) => row.adjudicated_label === null));
});
