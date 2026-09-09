import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardAnalysis } from '../../src/dashboard-analytics.mjs';

const plan = {
  target: { application_count: 30, workflows_per_application: 8, conditions: ['clean-stable', 'functional-fault', 'ui-evolved'], strategies: ['visual', 'hybrid', 'playwright'], repetitions_per_cell: 14 },
  derived_totals: { matched_cells: 2160, execution_units: 30240 }
};
const matrix = { applications: [{ id: 'bookstack', status: 'admitted-pilot-only', workflows: [{ id: 'bookstack-open-book' }] }] };
const record = (overrides = {}) => ({ run_id: `r-${Math.random()}`, application_id: 'bookstack', task_id: 'bookstack-open-book', condition: 'clean-stable', arm: 'visual', status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean', wall_time_ms: 1000, actions: 3, retries: 0, randomization_block: 'b1', ...overrides });

test('dashboard analytics preserves arm denominators and matched block completeness', () => {
  const analysis = buildDashboardAnalysis({ records: [record(), record({ run_id: 'r-2', arm: 'hybrid' }), record({ run_id: 'r-3', arm: 'playwright' }), record({ run_id: 'r-4', arm: 'visual', failure_category: 'provider-timeout', status: 'timeout', checkpoint_reached: false, emitted_verdict: 'not-emitted', ground_truth_verdict: 'not-scored' })], matrix, expansionPlan: plan });
  assert.equal(analysis.summary.observed_runs, 4);
  assert.equal(analysis.summary.complete_three_arm_blocks, 1);
  assert.equal(analysis.target.execution_units, 30240);
  assert.equal(analysis.summary.declared_applications, 1);
  assert.equal(analysis.summary.admitted_applications, 0);
  assert.match(analysis.summary.admission_blockers.join('\n'), /admitted/);
  assert.equal(analysis.strategy_comparison.find((item) => item.arm === 'visual').n, 2);
  assert.equal(analysis.failure_taxonomy[0].failure_category, 'provider-timeout');
});

test('dashboard analytics keeps unknown/not-scored records in the denominator without calling them correct', () => {
  const analysis = buildDashboardAnalysis({ records: [record({ emitted_verdict: 'unknown', ground_truth_verdict: 'not-scored', checkpoint_reached: false, status: 'timeout' })], matrix, expansionPlan: plan });
  assert.equal(analysis.strategy_comparison.find((item) => item.arm === 'visual').strict_pass_rate, 0);
  assert.equal(analysis.summary.strict_pass_rate, 0);
  assert.equal(analysis.condition_comparison.find((item) => item.arm === 'visual').n, 1);
});
