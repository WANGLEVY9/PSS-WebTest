import assert from 'node:assert/strict';
import test from 'node:test';
import { createPilotVarianceReport } from '../../scripts/pilot-variance-report.mjs';

test('pilot variance report preserves arm failures and matched repetition coverage', () => {
  const report = createPilotVarianceReport({
    application: 'bookstack', task_id: 'bookstack-open-book', condition: 'clean-stable', repetitions: 2,
    records: [
      { repetition: 1, arm: 'playwright', reset_ok: true, cell_passed: true },
      { repetition: 1, arm: 'visual', reset_ok: true, cell_passed: true },
      { repetition: 1, arm: 'hybrid', reset_ok: true, cell_passed: false, failure_category: 'planning' },
      { repetition: 2, arm: 'playwright', reset_ok: true, cell_passed: true },
      { repetition: 2, arm: 'visual', reset_ok: false, cell_passed: false, failure_category: 'environment' },
      { repetition: 2, arm: 'hybrid', reset_ok: true, reset_retry_used: true, cell_passed: true }
    ]
  });
  assert.equal(report.arms.playwright.success_rate.estimate, 1);
  assert.equal(report.arms.visual.reset_failures, 1);
  assert.equal(report.arms.hybrid.reset_retry_rate, 0.5);
  assert.deepEqual(report.matched_successful_repetitions, []);
  assert.equal(report.planning_only, true);
});
