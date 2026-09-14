import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScreeningLedgerTemplate } from '../../scripts/prepare-screening-ledger.mjs';
import { auditScreeningLedger } from '../../scripts/validate-screening-ledger.mjs';

const candidate = { benchmark_id: 'webarena-verified', source_commit: 'a'.repeat(40), task_source_id: 'task-1', source_file: 'x', instruction_digest: 'd'.repeat(64) };
const inventory = { status: 'source-inventory-only-screening-pending', confirmatory_authorized: false, candidates: [candidate] };

test('screening audit fails closed on the blank template', () => {
  const template = buildScreeningLedgerTemplate(inventory);
  const result = auditScreeningLedger(inventory, template);
  assert.equal(result.status, 'screening-pending');
  assert.equal(result.confirmatory_authorized, false);
  assert.equal(result.errors.length, 0);
});

test('screening audit admits a fully completed candidate only for manifest freeze', () => {
  const template = buildScreeningLedgerTemplate(inventory);
  for (const row of template.screening_rows) {
    row.reviewer_1_decision = 'yes';
    row.reviewer_2_decision = 'yes';
    row.agreement = true;
    row.adjudicated_decision = 'yes';
    row.timestamp = '2026-09-14T00:00:00Z';
  }
  Object.assign(template.task_annotations[0], {
    interaction_horizon: 'short', visual_dependency: 'low', structural_dependency: 'medium',
    workflow_composition: 'single-site', cross_site: 'no', annotator_1: 'r1', annotator_2: 'r2',
    adjudicated_label: 'eligible', agreement_batch: 'pilot-1'
  });
  const result = auditScreeningLedger(inventory, template);
  assert.equal(result.status, 'screening-complete-pending-manifest-freeze');
  assert.deepEqual(result.errors, []);
  assert.equal(result.confirmatory_authorized, false);
});
