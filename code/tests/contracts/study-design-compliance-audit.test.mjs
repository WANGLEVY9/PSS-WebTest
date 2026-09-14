import assert from 'node:assert/strict';
import test from 'node:test';
import { auditStudyDesignCompliance } from '../../scripts/audit-study-design-compliance.mjs';

test('study design compliance audit passes only for the frozen paused contract', () => {
  const result = auditStudyDesignCompliance();
  assert.equal(result.status, 'design-compliance-passed-execution-paused');
  assert.equal(result.confirmatory_authorized, false);
  assert.deepEqual(result.errors, []);
  assert.ok(Object.values(result.checks).every(Boolean));
});

test('study design compliance audit catches benchmark or authorization drift', () => {
  const result = auditStudyDesignCompliance({ design: { benchmark_portfolio: { mandatory_core: [{ id: 'local-pilot' }] }, task_filtering: {}, information_boundaries: {}, traditional_adaptation: {}, implementation_readiness: {}, execution_status: 'running', confirmatory_authorized: true }, cycle: { scale: {} }, metricDictionary: {} });
  assert.equal(result.status, 'design-compliance-failed');
  assert.ok(result.errors.length >= 4);
});
